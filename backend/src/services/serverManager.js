const { spawn, exec } = require('child_process');
const net = require('net');
const fs = require('fs');
const path = require('path');

class ServerManager {
  constructor(db, io) {
    this.db = db;
    this.io = io;
    this.processes = new Map();
    this.scanPorts = [2005, 53640, 53641, 53642];
  }

  // Scan for available ports
  async scanPorts(host = '127.0.0.1', ports = this.scanPorts) {
    const results = [];
    
    for (const port of ports) {
      const isOpen = await this.checkPort(host, port);
      results.push({ port, status: isOpen ? 'open' : 'closed' });
    }
    
    return results;
  }

  checkPort(host, port) {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(1000);
      
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });
      
      socket.connect(port, host);
    });
  }

  // Start RFD server
  async startServer(serverId, options = {}) {
    const server = this.db.getServerById(serverId);
    if (!server) {
      throw new Error('Server not found');
    }

    if (this.processes.has(serverId)) {
      throw new Error('Server already running');
    }

    const rfdPath = options.rfdPath || this.db.getConfig('rfdPath') || 'RFD.exe';
    const placeFile = options.placeFile || server.placeFile || this.db.getConfig('placeFile');
    const port = options.port || server.port;
    
    const args = ['server', '-p', port.toString()];
    if (placeFile) {
      args.push('-i', placeFile);
    }

    try {
      const process = spawn(rfdPath, args, {
        cwd: path.dirname(rfdPath) || process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.processes.set(serverId, process);
      
      process.stdout.on('data', (data) => {
        this.emitLog(serverId, 'info', data.toString());
      });

      process.stderr.on('data', (data) => {
        this.emitLog(serverId, 'error', data.toString());
      });

      process.on('exit', (code) => {
        this.processes.delete(serverId);
        this.db.updateServerStatus(serverId, 'offline');
        this.emitLog(serverId, 'info', `Server stopped with code ${code}`);
        this.io.to('admin-logs').emit('server-status', { serverId, status: 'offline' });
      });

      // Wait a bit and check if server is actually running
      await this.delay(2000);
      const isRunning = await this.checkPort(server.host, port);
      
      if (isRunning) {
        this.db.updateServerStatus(serverId, 'running', process.pid);
        this.emitLog(serverId, 'info', 'Server started successfully');
        this.io.to('admin-logs').emit('server-status', { serverId, status: 'running' });
        return { success: true, pid: process.pid };
      } else {
        this.processes.delete(serverId);
        this.db.updateServerStatus(serverId, 'offline');
        return { success: false, error: 'Server failed to start' };
      }
    } catch (error) {
      this.processes.delete(serverId);
      throw error;
    }
  }

  // Stop server
  stopServer(serverId) {
    const process = this.processes.get(serverId);
    
    if (!process) {
      // Try to find process by PID from database
      const server = this.db.getServerById(serverId);
      if (server && server.pid) {
        try {
          process.kill('SIGTERM');
        } catch (e) {
          // Process may already be dead
        }
      }
      this.db.updateServerStatus(serverId, 'offline');
      return { success: true };
    }

    process.kill('SIGTERM');
    this.processes.delete(serverId);
    this.db.updateServerStatus(serverId, 'offline');
    this.emitLog(serverId, 'info', 'Server stopped');
    
    return { success: true };
  }

  // Restart server
  async restartServer(serverId, options = {}) {
    this.stopServer(serverId);
    await this.delay(1000);
    return this.startServer(serverId, options);
  }

  // Get server status
  getServerStatus(serverId) {
    const server = this.db.getServerById(serverId);
    if (!server) return null;

    const process = this.processes.get(serverId);
    const isRunning = process && !process.killed;
    
    return {
      ...server,
      processRunning: isRunning,
      pid: process?.pid || server.pid
    };
  }

  // Stop all servers
  stopAllServers() {
    for (const [serverId, process] of this.processes) {
      process.kill('SIGTERM');
    }
    this.processes.clear();
  }

  // Restore servers from database
  restoreServers() {
    const servers = this.db.getServers();
    for (const server of servers) {
      if (server.status === 'running' && server.pid) {
        try {
          process.kill(server.pid, 0);
          this.processes.set(server.id, { pid: server.pid, killed: false });
        } catch (e) {
          this.db.updateServerStatus(server.id, 'offline');
        }
      }
    }
  }

  // Auto detect RFD installation
  async detectRFDPath() {
    const possiblePaths = [
      'C:\\RFD\\RFD.exe',
      'C:\\RFD\\FreedomDistribution.exe',
      'C:\\Program Files\\RFD\\RFD.exe',
      'C:\\Program Files (x86)\\RFD\\RFD.exe',
      path.join(process.env.LOCALAPPDATA || '', 'RFD', 'RFD.exe'),
      'RFD.exe',
      'FreedomDistribution.exe'
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return null;
  }

  // Auto detect GameConfig.toml
  async detectGameConfig(rfdPath) {
    const configDir = path.dirname(rfdPath);
    const possiblePaths = [
      path.join(configDir, 'GameConfig.toml'),
      path.join(configDir, 'config', 'GameConfig.toml'),
      path.join(process.env.LOCALAPPDATA || '', 'RFD', 'GameConfig.toml')
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    return null;
  }

  // Parse GameConfig.toml
  parseGameConfig(configPath) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = {};
      
      content.split('\n').forEach(line => {
        const match = line.match(/^(\w+)\s*=\s*"?([^"]*)"?/);
        if (match) {
          config[match[1]] = match[2];
        }
      });
      
      return config;
    } catch (error) {
      return null;
    }
  }

  // Generate GameConfig.toml
  generateGameConfig(config) {
    let content = '# RFD Game Configuration\n\n';
    content += `[Game]\n`;
    content += `Name = "${config.name || 'RFD Server'}"\n`;
    content += `Port = ${config.port || 53640}\n`;
    content += `MaxPlayers = ${config.maxPlayers || 100}\n`;
    content += `PlaceId = ${config.placeId || 0}\n\n`;
    content += `[Roblox]\n`;
    content += `Version = "${config.version || '0.485.0.452074'}"\n`;
    content += `PlaceFile = "${config.placeFile || ''}"\n`;
    
    return content;
  }

  // Health check
  async healthCheck(serverId) {
    const server = this.db.getServerById(serverId);
    if (!server) return { healthy: false, error: 'Server not found' };

    const isPortOpen = await this.checkPort(server.host, server.port);
    
    return {
      healthy: isPortOpen && server.status === 'running',
      portOpen: isPortOpen,
      dbStatus: server.status,
      pid: server.pid
    };
  }

  // Update player count
  updatePlayerCount(serverId, action, player) {
    const server = this.db.getServerById(serverId);
    if (!server) return;

    let count = server.currentPlayers;
    if (action === 'join') count++;
    else if (action === 'leave') count = Math.max(0, count - 1);

    this.db.updateServerPlayerCount(serverId, count);
    this.io.emit('player-count', { serverId, count });
  }

  // Helper methods
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  emitLog(serverId, type, message) {
    const log = { serverId, type, message, timestamp: new Date().toISOString() };
    this.io.to(`server-logs-${serverId}`).emit('server-log', log);
    this.io.to('admin-logs').emit('server-log', log);
    
    // Also save to database
    this.db.createAuditLog(null, 'server-log', JSON.stringify(log), '');
  }
}

module.exports = ServerManager;
