/**
 * RFD Manager Service
 * 
 * Manages RFD server instances, console output, and configuration.
 */

const { spawn, exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const EventEmitter = require('events');
const toml = require('toml');
const { AdapterFactory } = require('../adapters');

class RFDManager extends EventEmitter {
  constructor(db, io) {
    super();
    this.db = db;
    this.io = io;
    this.processes = new Map();
    this.consoleBuffers = new Map();
    this.adapterFactory = new AdapterFactory();
    this.adapter = null;
    this.logPath = path.join(__dirname, '../../../logs');
    this.placesPath = path.join(__dirname, '../../../places');
    this.backupsPath = path.join(__dirname, '../../../backups');
    this.assetCachePath = '';
    this.config = {};

    // Initialize directories
    this.initDirectories();
  }

  /**
   * Initialize required directories
   */
  async initDirectories() {
    const dirs = [this.logPath, this.placesPath, this.backupsPath];
    for (const dir of dirs) {
      const dirPath = path.join(dir);
      if (!fsSync.existsSync(dirPath)) {
        fsSync.mkdirSync(dirPath, { recursive: true });
      }
    }
  }

  /**
   * Initialize the RFD Manager
   */
  async initialize() {
    // Load configuration from database
    this.config = this.db.getAllConfig();
    
    // Set up paths from config
    if (this.config.rfdPath) {
      this.assetCachePath = this.config.assetCachePath || path.join(this.config.rfdPath, 'AssetCache');
    }

    // Initialize adapter
    await this.initializeAdapter();
    
    // Restore any running servers from previous session
    await this.restoreServers();
    
    console.log('RFD Manager initialized');
  }

  /**
   * Initialize the backend adapter
   */
  async initializeAdapter() {
    const adapterConfig = {
      rfdPath: this.config.rfdPath,
      gameConfigPath: this.config.gameConfigPath,
      assetCachePath: this.assetCachePath,
      sqlitePath: this.config.sqlitePath,
      playerPath: this.config.playerPath,
      studioPath: this.config.studioPath
    };

    const { adapter, type } = await this.adapterFactory.autoDetect(adapterConfig);
    this.adapter = adapter;
    
    // Forward adapter events to Socket.IO
    this.adapter.on('console', (data) => {
      this.io.emit('rfd-console', data);
    });

    this.adapter.on('player-joined', (data) => {
      this.io.emit('player-joined', data);
    });

    this.adapter.on('player-left', (data) => {
      this.io.emit('player-left', data);
    });

    console.log(`RFD Manager using ${type} adapter`);
  }

  /**
   * Get the adapter
   */
  getAdapter() {
    return this.adapter;
  }

  /**
   * Detect RFD installation
   */
  async detectRFD() {
    if (this.adapter) {
      return await this.adapter.detectInstallation();
    }
    return { found: false };
  }

  /**
   * Get RFD version
   */
  async getVersion() {
    if (this.adapter) {
      return await this.adapter.getVersion();
    }
    return 'unknown';
  }

  // ==================== Server Management ====================

  /**
   * Start a server
   */
  async startServer(serverId) {
    const server = this.db.getServerById(serverId);
    if (!server) {
      throw new Error('Server not found');
    }

    if (this.processes.has(serverId)) {
      throw new Error('Server already running');
    }

    const logBuffer = [];
    this.consoleBuffers.set(serverId, logBuffer);

    // Get RFD executable
    const rfdPath = server.rfdPath || this.config.rfdPath;
    if (!rfdPath) {
      throw new Error('RFD path not configured');
    }

    const rfdExe = this.getRFDExecutable(rfdPath);

    // Build command arguments
    const args = [
      '--port', server.port.toString(),
      '--max-players', server.maxPlayers.toString()
    ];

    if (server.placeFile) {
      args.push('--place', server.placeFile);
    }

    if (server.gameConfigPath) {
      args.push('--config', server.gameConfigPath);
    }

    return new Promise((resolve, reject) => {
      try {
        const child = spawn(rfdExe, args, {
          cwd: rfdPath,
          stdio: ['pipe', 'pipe', 'pipe'],
          detached: false,
          env: { ...process.env, RFD_PATH: rfdPath }
        });

        this.processes.set(serverId, child);

        // Handle stdout
        child.stdout.on('data', (data) => {
          const output = data.toString();
          logBuffer.push({ type: 'out', text: output, time: Date.now() });
          this.emit('console', { serverId, type: 'out', text: output });
          this.io.to(`server-${serverId}`).emit('console-output', { serverId, type: 'out', text: output });
          
          // Parse player count from output
          this.parseServerOutput(serverId, output);
        });

        // Handle stderr
        child.stderr.on('data', (data) => {
          const output = data.toString();
          logBuffer.push({ type: 'err', text: output, time: Date.now() });
          this.emit('console', { serverId, type: 'err', text: output });
          this.io.to(`server-${serverId}`).emit('console-output', { serverId, type: 'err', text: output });
        });

        // Handle errors
        child.on('error', (error) => {
          console.error(`Server ${serverId} error:`, error);
          this.processes.delete(serverId);
          this.consoleBuffers.delete(serverId);
          this.db.updateServerStatus(serverId, 'offline');
          this.emit('error', { serverId, error: error.message });
          reject(error);
        });

        // Handle exit
        child.on('exit', (code) => {
          console.log(`Server ${serverId} exited with code ${code}`);
          this.processes.delete(serverId);
          this.consoleBuffers.delete(serverId);
          this.db.updateServerStatus(serverId, 'offline');
          this.db.updateServerPlayerCount(serverId, 0);
          this.emit('stopped', { serverId, code });
          this.io.emit('server-status', { serverId, status: 'offline' });
        });

        // Update database
        this.db.updateServerStatus(serverId, 'running', child.pid);

        // Emit events
        this.emit('started', { serverId, pid: child.pid });
        this.io.emit('server-status', { serverId, status: 'running', pid: child.pid });

        // Log to file
        this.logToFile(serverId, `Server started with PID ${child.pid}`);

        resolve({ serverId, pid: child.pid, port: server.port });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop a server
   */
  async stopServer(serverId) {
    const child = this.processes.get(serverId);
    if (!child) {
      throw new Error('Server not running');
    }

    return new Promise((resolve) => {
      // Try graceful shutdown first
      child.kill('SIGTERM');
      
      const timeout = setTimeout(() => {
        // Force kill if graceful shutdown fails
        if (this.processes.has(serverId)) {
          child.kill('SIGKILL');
        }
        resolve(true);
      }, 5000);

      child.on('exit', () => {
        clearTimeout(timeout);
        this.processes.delete(serverId);
        this.db.updateServerStatus(serverId, 'offline');
        this.logToFile(serverId, 'Server stopped');
        resolve(true);
      });
    });
  }

  /**
   * Restart a server
   */
  async restartServer(serverId) {
    await this.stopServer(serverId);
    await new Promise(r => setTimeout(r, 2000));
    return await this.startServer(serverId);
  }

  /**
   * Get server status
   */
  getServerStatus(serverId) {
    const child = this.processes.get(serverId);
    const server = this.db.getServerById(serverId);
    
    return {
      running: child && !child.killed,
      pid: child?.pid || null,
      status: server?.status || 'unknown',
      playerCount: server?.currentPlayers || 0,
      maxPlayers: server?.maxPlayers || 100,
      uptime: server?.startedAt ? Date.now() - new Date(server.startedAt).getTime() : 0
    };
  }

  /**
   * Parse server output for player count and other info
   */
  parseServerOutput(serverId, output) {
    // Try to extract player count from output
    const playerMatch = output.match(/Players:\s*(\d+)/i) || output.match(/(\d+)\s*players/i);
    if (playerMatch) {
      const count = parseInt(playerMatch[1], 10);
      this.db.updateServerPlayerCount(serverId, count);
      this.io.emit('server-updated', { serverId, playerCount: count });
    }
  }

  /**
   * Get RFD executable path
   */
  getRFDExecutable(rfdPath) {
    const exeName = process.platform === 'win32' ? 'RFD.exe' : 'rfd';
    return path.join(rfdPath, exeName);
  }

  // ==================== Console Management ====================

  /**
   * Get console buffer for server
   */
  getConsoleBuffer(serverId, lines = 100) {
    const buffer = this.consoleBuffers.get(serverId);
    if (!buffer) return [];
    return buffer.slice(-lines);
  }

  /**
   * Send command to server
   */
  async sendCommand(serverId, command) {
    const child = this.processes.get(serverId);
    if (!child || child.killed) {
      throw new Error('Server not running');
    }

    if (child.stdin.writable) {
      child.stdin.write(command + '\n');
      this.logToFile(serverId, `> ${command}`);
      return 'Command sent';
    }
    throw new Error('Cannot write to stdin');
  }

  /**
   * Get server logs
   */
  async getLogs(serverId, lines = 100) {
    const buffer = this.consoleBuffers.get(serverId);
    if (buffer) {
      return buffer.slice(-lines).map(entry => ({
        text: entry.text,
        type: entry.type,
        time: new Date(entry.time).toISOString()
      }));
    }

    // Try to read from log file
    const logFile = path.join(this.logPath, `server-${serverId}.log`);
    try {
      const content = await fs.readFile(logFile, 'utf-8');
      const logLines = content.split('\n').filter(Boolean).slice(-lines);
      return logLines.map(line => ({
        text: line,
        type: line.includes('[ERROR]') ? 'err' : 'out',
        time: new Date().toISOString()
      }));
    } catch {
      return [];
    }
  }

  /**
   * Clear console buffer
   */
  clearConsole(serverId) {
    this.consoleBuffers.set(serverId, []);
  }

  /**
   * Log to file
   */
  async logToFile(serverId, message) {
    const logFile = path.join(this.logPath, `server-${serverId}.log`);
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${message}\n`;
    
    try {
      await fs.appendFile(logFile, logLine);
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  // ==================== GameConfig Management ====================

  /**
   * Get GameConfig for server
   */
  async getGameConfig(serverId) {
    const server = this.db.getServerById(serverId);
    const configPath = server?.gameConfigPath || this.config.gameConfigPath;
    
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
   * Update GameConfig for server
   */
  async updateGameConfig(serverId, config) {
    const server = this.db.getServerById(serverId);
    const configPath = server?.gameConfigPath || this.config.gameConfigPath;
    
    if (!configPath) {
      throw new Error('GameConfig path not configured');
    }

    try {
      const tomlString = toml.stringify(config);
      await fs.writeFile(configPath, tomlString, 'utf-8');
      
      // Log the change
      this.db.createAuditLog(
        null, 'gameconfig_update', 
        `Updated GameConfig for server ${serverId}`,
        '', 'server', serverId
      );
      
      return true;
    } catch (error) {
      throw new Error(`Failed to write GameConfig: ${error.message}`);
    }
  }

  // ==================== Place Management ====================

  /**
   * Upload a place file
   */
  async uploadPlace(file, gameId) {
    const filename = `${Date.now()}-${file.originalname}`;
    const filepath = path.join(this.placesPath, filename);
    
    try {
      await fs.writeFile(filepath, file.buffer);
      
      // If gameId provided, update game
      if (gameId) {
        this.db.updateGame(gameId, { placeFile: filepath });
      }
      
      this.db.createAuditLog(
        null, 'place_upload',
        `Uploaded place file: ${file.originalname}`,
        ''
      );
      
      return { filename, path: filepath };
    } catch (error) {
      throw new Error(`Failed to upload place: ${error.message}`);
    }
  }

  /**
   * Get places list
   */
  async getPlaces() {
    try {
      const files = await fs.readdir(this.placesPath);
      const places = [];
      
      for (const file of files) {
        if (file.endsWith('.rbxl') || file.endsWith('.rbxlx')) {
          const filepath = path.join(this.placesPath, file);
          const stats = await fs.stat(filepath);
          places.push({
            name: file,
            path: filepath,
            size: stats.size,
            modified: stats.mtime
          });
        }
      }
      
      return places;
    } catch (error) {
      return [];
    }
  }

  /**
   * Delete a place file
   */
  async deletePlace(filepath) {
    // Security check - ensure path is within places directory
    const normalizedPath = path.normalize(filepath);
    if (!normalizedPath.startsWith(this.placesPath)) {
      throw new Error('Invalid path');
    }

    await fs.unlink(normalizedPath);
    this.db.createAuditLog(null, 'place_delete', `Deleted place: ${filepath}`, '');
    return true;
  }

  // ==================== Asset Management ====================

  /**
   * Get cached assets list
   */
  async getCachedAssets(options = {}) {
    if (!this.assetCachePath || !fsSync.existsSync(this.assetCachePath)) {
      return [];
    }

    try {
      const files = await fs.readdir(this.assetCachePath);
      const assets = [];

      for (const file of files) {
        const filepath = path.join(this.assetCachePath, file);
        const stats = await fs.stat(filepath);
        
        if (stats.isFile()) {
          const ext = path.extname(file).toLowerCase();
          let type = 'unknown';
          
          if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
            type = 'image';
          } else if (['.ogg', '.mp3', '.wav'].includes(ext)) {
            type = 'audio';
          } else if (['.obj', '.fbx', '.gltf'].includes(ext)) {
            type = 'mesh';
          }

          if (!options.type || options.type === type || options.type === 'all') {
            if (!options.search || file.toLowerCase().includes(options.search.toLowerCase())) {
              assets.push({
                name: file,
                path: filepath,
                size: stats.size,
                type,
                modified: stats.mtime
              });
            }
          }
        }
      }

      return assets;
    } catch (error) {
      console.error('Error reading asset cache:', error);
      return [];
    }
  }

  /**
   * Delete cached asset
   */
  async deleteAsset(assetPath) {
    // Security check
    if (this.assetCachePath && !assetPath.startsWith(this.assetCachePath)) {
      throw new Error('Invalid asset path');
    }

    await fs.unlink(assetPath);
    this.db.createAuditLog(null, 'asset_delete', `Deleted asset: ${assetPath}`, '');
    return true;
  }

  /**
   * Clear asset cache
   */
  async clearAssetCache() {
    if (!this.assetCachePath || !fsSync.existsSync(this.assetCachePath)) {
      return 0;
    }

    const files = await fs.readdir(this.assetCachePath);
    let deleted = 0;

    for (const file of files) {
      const filepath = path.join(this.assetCachePath, file);
      try {
        await fs.unlink(filepath);
        deleted++;
      } catch {
        // Ignore errors
      }
    }

    this.db.createAuditLog(null, 'asset_cache_clear', `Cleared ${deleted} cached assets`, '');
    return deleted;
  }

  // ==================== Backup Management ====================

  /**
   * Create a backup
   */
  async createBackup(type = 'all', userId = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup-${timestamp}`;
    const backupDir = path.join(this.backupsPath, backupName);
    
    await fs.mkdir(backupDir, { recursive: true });

    const backups = [];

    if (type === 'all' || type === 'database') {
      const dbBackupPath = path.join(backupDir, 'database.db');
      await fs.copyFile(this.db.dbPath, dbBackupPath);
      backups.push({ type: 'database', path: dbBackupPath });
    }

    if (type === 'all' || type === 'places') {
      const placesBackupPath = path.join(backupDir, 'places');
      await fs.mkdir(placesBackupPath, { recursive: true });
      
      const places = await this.getPlaces();
      for (const place of places) {
        try {
          await fs.copyFile(place.path, path.join(placesBackupPath, place.name));
        } catch {
          // Ignore
        }
      }
      backups.push({ type: 'places', path: placesBackupPath });
    }

    if (type === 'all' || type === 'config') {
      const configBackupPath = path.join(backupDir, 'config.json');
      await fs.writeFile(configBackupPath, JSON.stringify(this.config, null, 2));
      backups.push({ type: 'config', path: configBackupPath });
    }

    // Calculate total size
    let totalSize = 0;
    for (const backup of backups) {
      const stats = await fs.stat(backup.path);
      totalSize += stats.size;
    }

    // Save backup record
    const backupRecord = this.db.createBackup({
      name: backupName,
      type,
      path: backupDir,
      size: totalSize,
      createdBy: userId
    });

    this.db.createAuditLog(
      userId, 'backup_create',
      `Created backup: ${backupName} (${type})`,
      ''
    );

    return { id: backupRecord.lastInsertRowid, name: backupName, path: backupDir, size: totalSize };
  }

  /**
   * Get backups list
   */
  async getBackups() {
    return this.db.getBackups();
  }

  /**
   * Restore from backup
   */
  async restoreBackup(backupId, userId) {
    const backup = this.db.getBackups().find(b => b.id === backupId);
    if (!backup) {
      throw new Error('Backup not found');
    }

    const backupDir = backup.path;

    // Restore database
    const dbBackupPath = path.join(backupDir, 'database.db');
    if (fsSync.existsSync(dbBackupPath)) {
      await fs.copyFile(dbBackupPath, this.db.dbPath);
    }

    this.db.createAuditLog(
      userId, 'backup_restore',
      `Restored from backup: ${backup.name}`,
      ''
    );

    return true;
  }

  /**
   * Delete backup
   */
  async deleteBackup(backupId) {
    const backup = this.db.getBackups().find(b => b.id === backupId);
    if (!backup) {
      throw new Error('Backup not found');
    }

    // Delete files
    await fs.rm(backup.path, { recursive: true, force: true });
    
    // Delete record
    this.db.deleteBackup(backupId);

    return true;
  }

  // ==================== Utility Methods ====================

  /**
   * Get system information
   */
  async getSystemInfo() {
    const os = require('os');
    const adapter = this.adapter;

    let adapterInfo = { name: 'unknown', status: 'not initialized' };
    if (adapter) {
      adapterInfo = {
        name: adapter.getName(),
        status: adapter.isReady() ? 'ready' : 'not ready',
        version: await adapter.getVersion().catch(() => 'unknown')
      };
    }

    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      uptime: os.uptime(),
      adapter: adapterInfo,
      config: {
        rfdPath: this.config.rfdPath || 'not configured',
        assetCachePath: this.assetCachePath || 'not configured',
        placesPath: this.placesPath,
        logPath: this.logPath,
        backupsPath: this.backupsPath
      }
    };
  }

  /**
   * Get resource usage
   */
  async getResourceUsage() {
    const os = require('os');
    const adapter = this.adapter;

    let adapterUsage = { cpu: 0, memory: { total: 0, used: 0, free: 0 } };
    if (adapter && adapter.getResourceUsage) {
      adapterUsage = await adapter.getResourceUsage().catch(() => adapterUsage);
    }

    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    return {
      cpu: os.loadavg()[0],
      memory: {
        total: totalMem,
        used: totalMem - freeMem,
        free: freeMem,
        percent: ((totalMem - freeMem) / totalMem) * 100
      },
      platform: adapterUsage
    };
  }

  /**
   * Stop all servers
   */
  async stopAllServers() {
    const stopPromises = [];
    for (const [serverId] of this.processes) {
      stopPromises.push(this.stopServer(serverId).catch(e => console.error(e)));
    }
    await Promise.all(stopPromises);
  }

  /**
   * Restore servers from database
   */
  async restoreServers() {
    const servers = this.db.getServers('running');
    for (const server of servers) {
      console.log(`Restoring server ${server.id}: ${server.name}`);
      // Don't auto-restart - just mark as offline
      this.db.updateServerStatus(server.id, 'offline');
    }
  }

  /**
   * Cleanup
   */
  async destroy() {
    await this.stopAllServers();
    this.processes.clear();
    this.consoleBuffers.clear();
    await this.adapter?.destroy();
  }
}

module.exports = RFDManager;
