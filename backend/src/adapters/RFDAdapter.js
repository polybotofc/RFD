/**
 * RFD (Roblox Freedom Distribution) Adapter
 * 
 * Implementation of BackendAdapter for RFD backend.
 * Handles all communication with RFD server instances.
 */

const BackendAdapter = require('./Adapter');
const { spawn, exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const toml = require('toml');
const EventEmitter = require('events');

class RFDAdapter extends BackendAdapter {
  constructor(config = {}) {
    super(config);
    this.servers = new Map();
    this.processes = new Map();
    this.logBuffers = new Map();
    this.consoleListeners = [];
    this.configPaths = {
      rfd: config.rfdPath || '',
      gameConfig: config.gameConfigPath || '',
      assetCache: config.assetCachePath || '',
      sqlite: config.sqlitePath || '',
      player: config.playerPath || '',
      studio: config.studioPath || ''
    };
  }

  /**
   * Initialize the RFD adapter
   */
  async initialize() {
    // Auto-detect RFD installation if not configured
    if (!this.configPaths.rfd) {
      await this.detectInstallation();
    }
    this.initialized = true;
    return true;
  }

  /**
   * Detect RFD installation
   */
  async detectInstallation() {
    const possiblePaths = [
      path.join(process.env.LOCALAPPDATA || '', 'RFD'),
      path.join(process.env.APPDATA || '', 'RFD'),
      path.join(os.homedir(), 'RFD'),
      path.join(os.homedir(), 'Roblox', 'RFD'),
      '/usr/local/bin/rfd',
      '/usr/bin/rfd'
    ];

    for (const searchPath of possiblePaths) {
      try {
        if (await fs.access(searchPath).then(() => true).catch(() => false)) {
          this.configPaths.rfd = searchPath;
          
          // Check for version
          try {
            const version = await this.getVersion();
            return { found: true, path: searchPath, version };
          } catch {
            return { found: true, path: searchPath, version: 'unknown' };
          }
        }
      } catch {
        continue;
      }
    }

    return { found: false, path: '', version: '' };
  }

  /**
   * Get RFD version
   */
  async getVersion() {
    if (!this.configPaths.rfd) {
      throw new Error('RFD path not configured');
    }

    return new Promise((resolve, reject) => {
      const rfdExe = this.getRFDExecutable();
      exec(`"${rfdExe}" --version`, (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout.trim() || '0.1.0');
        }
      });
    });
  }

  /**
   * Get RFD executable path
   */
  getRFDExecutable() {
    const exeName = process.platform === 'win32' ? 'RFD.exe' : 'rfd';
    return path.join(this.configPaths.rfd, exeName);
  }

  /**
   * Start a server instance
   */
  async startServer(config) {
    const {
      id,
      port = 53640,
      placeFile,
      gameConfig,
      maxPlayers = 100,
      args = []
    } = config;

    const serverId = id.toString();
    const logBuffer = [];
    this.logBuffers.set(serverId, logBuffer);

    // Build command arguments
    const cmdArgs = [
      '--port', port.toString(),
      '--max-players', maxPlayers.toString()
    ];

    if (placeFile) {
      cmdArgs.push('--place', placeFile);
    }

    if (gameConfig) {
      cmdArgs.push('--config', gameConfig);
    }

    cmdArgs.push(...args);

    return new Promise((resolve, reject) => {
      try {
        const rfdExe = this.getRFDExecutable();
        const child = spawn(rfdExe, cmdArgs, {
          cwd: this.configPaths.rfd,
          stdio: ['pipe', 'pipe', 'pipe'],
          detached: false
        });

        this.processes.set(serverId, child);

        child.stdout.on('data', (data) => {
          const output = data.toString();
          logBuffer.push({ type: 'out', text: output, time: Date.now() });
          this.emit('console', { serverId, type: 'out', text: output, time: Date.now() });
          this.consoleListeners.forEach(cb => cb(serverId, 'out', output));
        });

        child.stderr.on('data', (data) => {
          const output = data.toString();
          logBuffer.push({ type: 'err', text: output, time: Date.now() });
          this.emit('console', { serverId, type: 'err', text: output, time: Date.now() });
          this.consoleListeners.forEach(cb => cb(serverId, 'err', output));
        });

        child.on('error', (error) => {
          this.emit('error', { serverId, error: error.message });
          reject(error);
        });

        child.on('exit', (code) => {
          this.emit('exit', { serverId, code });
          this.processes.delete(serverId);
          this.logBuffers.delete(serverId);
        });

        // Give it a moment to start
        setTimeout(() => {
          resolve({
            id: serverId,
            pid: child.pid,
            port,
            status: 'starting'
          });
        }, 1000);

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop a server instance
   */
  async stopServer(serverId) {
    const process = this.processes.get(serverId);
    if (!process) {
      return false;
    }

    return new Promise((resolve) => {
      // Try graceful shutdown first
      process.kill('SIGTERM');
      
      const timeout = setTimeout(() => {
        // Force kill if graceful shutdown fails
        if (this.processes.has(serverId)) {
          process.kill('SIGKILL');
        }
        resolve(true);
      }, 5000);

      process.on('exit', () => {
        clearTimeout(timeout);
        this.processes.delete(serverId);
        resolve(true);
      });
    });
  }

  /**
   * Restart a server instance
   */
  async restartServer(serverId) {
    const status = await this.getServerStatus(serverId);
    if (!status) {
      throw new Error('Server not found');
    }

    await this.stopServer(serverId);
    await new Promise(r => setTimeout(r, 1000));
    
    // Restart with same config (would need to store config)
    return this.getServerStatus(serverId);
  }

  /**
   * Get server status
   */
  async getServerStatus(serverId) {
    const process = this.processes.get(serverId);
    const isRunning = process && !process.killed;

    const status = {
      serverId,
      status: isRunning ? 'running' : 'offline',
      players: 0,
      memory: 0,
      cpu: 0,
      uptime: 0
    };

    if (isRunning) {
      try {
        // Get process info
        const pid = process.pid;
        if (process.platform !== 'win32') {
          const memCmd = `ps -p ${pid} -o %mem=`;
          const cpuCmd = `ps -p ${pid} -o %cpu=`;
          
          status.memory = await this.execCommand(memCmd).catch(() => 0);
          status.cpu = await this.execCommand(cpuCmd).catch(() => 0);
        }
        
        // Calculate uptime
        status.uptime = Date.now() - (this.servers.get(serverId)?.startTime || Date.now());
      } catch (error) {
        console.error('Error getting server status:', error);
      }
    }

    return status;
  }

  /**
   * Get server logs
   */
  async getServerLogs(serverId, lines = 100) {
    const buffer = this.logBuffers.get(serverId);
    if (!buffer) {
      return [];
    }
    return buffer.slice(-lines);
  }

  /**
   * Execute command on server console
   */
  async executeCommand(serverId, command) {
    const process = this.processes.get(serverId);
    if (!process || process.killed) {
      throw new Error('Server not running');
    }

    if (process.stdin.writable) {
      process.stdin.write(command + '\n');
      return 'Command sent';
    }
    throw new Error('Cannot write to stdin');
  }

  /**
   * Get online players
   */
  async getOnlinePlayers(serverId) {
    // This would typically be fetched from the server
    // For now, return from our internal tracking
    const server = this.servers.get(serverId);
    return server?.players || [];
  }

  /**
   * Kick a player
   */
  async kickPlayer(serverId, playerId, reason = '') {
    await this.executeCommand(serverId, `/kick ${playerId} ${reason}`);
    return true;
  }

  /**
   * Send data to player
   */
  async sendToPlayer(serverId, playerId, data) {
    const jsonData = JSON.stringify(data).replace(/"/g, '\\"');
    await this.executeCommand(serverId, `/data ${playerId} "${jsonData}"`);
    return true;
  }

  /**
   * Load a place file
   */
  async loadPlace(serverId, placePath) {
    await this.executeCommand(serverId, `/load "${placePath}"`);
    return true;
  }

  /**
   * Get GameConfig as object
   */
  async getGameConfig(serverId) {
    const configPath = this.servers.get(serverId)?.gameConfig 
      || this.configPaths.gameConfig;
    
    if (!configPath) {
      throw new Error('GameConfig path not configured');
    }

    try {
      const content = await fs.readFile(configPath, 'utf-8');
      return toml.parse(content);
    } catch (error) {
      throw new Error(`Failed to read GameConfig: ${error.message}`);
    }
  }

  /**
   * Set GameConfig
   */
  async setGameConfig(serverId, config) {
    const configPath = this.servers.get(serverId)?.gameConfig 
      || this.configPaths.gameConfig;
    
    if (!configPath) {
      throw new Error('GameConfig path not configured');
    }

    try {
      const tomlString = toml.stringify(config);
      await fs.writeFile(configPath, tomlString, 'utf-8');
      return true;
    } catch (error) {
      throw new Error(`Failed to write GameConfig: ${error.message}`);
    }
  }

  /**
   * Get asset from cache
   */
  async getAsset(assetId) {
    const assetCacheDir = this.configPaths.assetCache;
    if (!assetCacheDir) {
      throw new Error('AssetCache path not configured');
    }

    const assetPath = path.join(assetCacheDir, assetId.toString());
    
    try {
      const exists = await fs.access(assetPath).then(() => true).catch(() => false);
      if (!exists) {
        return null;
      }

      const stats = await fs.stat(assetPath);
      return {
        id: assetId,
        path: assetPath,
        size: stats.size,
        modified: stats.mtime
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Cache an asset
   */
  async cacheAsset(assetId, url) {
    const assetCacheDir = this.configPaths.assetCache;
    if (!assetCacheDir) {
      throw new Error('AssetCache path not configured');
    }

    // Use curl to download the asset
    const assetPath = path.join(assetCacheDir, assetId.toString());
    await this.execCommand(`curl -s -o "${assetPath}" "${url}"`);
    return true;
  }

  /**
   * Get cached assets list
   */
  async getCachedAssets(options = {}) {
    const assetCacheDir = this.configPaths.assetCache;
    if (!assetCacheDir) {
      return [];
    }

    try {
      const files = await fs.readdir(assetCacheDir);
      const assets = [];

      for (const file of files) {
        const filePath = path.join(assetCacheDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile()) {
          assets.push({
            id: file,
            name: file,
            path: filePath,
            size: stats.size,
            modified: stats.mtime
          });
        }
      }

      // Apply filters
      let filtered = assets;
      if (options.type) {
        filtered = filtered.filter(a => a.name.endsWith(options.type));
      }
      if (options.search) {
        const search = options.search.toLowerCase();
        filtered = filtered.filter(a => a.name.toLowerCase().includes(search));
      }

      return filtered;
    } catch (error) {
      return [];
    }
  }

  /**
   * Delete cached asset
   */
  async deleteCachedAsset(assetId) {
    const assetCacheDir = this.configPaths.assetCache;
    if (!assetCacheDir) {
      throw new Error('AssetCache path not configured');
    }

    const assetPath = path.join(assetCacheDir, assetId.toString());
    await fs.unlink(assetPath);
    return true;
  }

  /**
   * Register console output listener
   */
  onConsoleOutput(callback) {
    this.consoleListeners.push(callback);
  }

  /**
   * Remove console output listener
   */
  removeConsoleListener(callback) {
    const index = this.consoleListeners.indexOf(callback);
    if (index > -1) {
      this.consoleListeners.splice(index, 1);
    }
  }

  /**
   * Get console stream
   */
  getConsoleStream(serverId) {
    return this.logBuffers.get(serverId) || [];
  }

  /**
   * Get resource usage
   */
  async getResourceUsage() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      cpu: os.loadavg()[0] * 100 / os.cpus().length,
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        percent: (usedMem / totalMem) * 100
      },
      uptime: os.uptime()
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      // Check if we can access the configured paths
      if (this.configPaths.rfd) {
        await fs.access(this.configPaths.rfd);
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Helper to run shell command
   */
  execCommand(cmd) {
    return new Promise((resolve, reject) => {
      exec(cmd, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  /**
   * Cleanup
   */
  async destroy() {
    // Stop all running servers
    for (const [serverId] of this.processes) {
      await this.stopServer(serverId);
    }
    this.processes.clear();
    this.logBuffers.clear();
    this.servers.clear();
    this.consoleListeners = [];
    await super.destroy();
  }
}

module.exports = RFDAdapter;
