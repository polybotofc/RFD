const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class ServerManager {
  constructor(db, io) {
    this.db = db;
    this.io = io;
    this.processes = new Map(); // serverId -> { process, startTime }
    this.portsInUse = new Set();
    
    // RFD executable path
    this.rfdPath = process.env.RFD_PATH || '/app/RFD.exe';
    
    // Initialize ports from existing servers
    this.initializePorts();
  }

  initializePorts() {
    const servers = this.db.getAllServers();
    servers.forEach(server => {
      if (server.status === 'running') {
        this.portsInUse.add(server.port);
      }
    });
  }

  async startServer(serverId, gameId) {
    const game = this.db.getGameById(gameId);
    if (!game || !game.rbxl_path) {
      throw new Error('Game not found or missing RBXL file');
    }

    const server = this.db.getServerById(serverId);
    if (!server) {
      throw new Error('Server not found');
    }

    if (this.processes.has(serverId)) {
      return { success: false, error: 'Server already running' };
    }

    // Check if RFD exists
    if (!fs.existsSync(this.rfdPath)) {
      console.log('RFD.exe not found at:', this.rfdPath);
      // For development, simulate server start
      return this.simulateServerStart(serverId, game);
    }

    const port = server.port;
    const args = [
      'server',
      '--place', game.rbxl_path,
      '-p', port.toString()
    ];

    console.log(`Starting RFD server: ${this.rfdPath} ${args.join(' ')}`);

    try {
      const process = spawn(this.rfdPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
      });

      this.processes.set(serverId, {
        process,
        startTime: Date.now(),
        gameTitle: game.title
      });

      this.portsInUse.add(port);

      process.stdout.on('data', (data) => {
        const log = data.toString();
        this.emitLog(serverId, 'info', log);
        this.io.to('admin-logs').emit('server-log', { serverId, log, type: 'stdout' });
      });

      process.stderr.on('data', (data) => {
        const log = data.toString();
        this.emitLog(serverId, 'error', log);
        this.io.to('admin-logs').emit('server-log', { serverId, log, type: 'stderr' });
      });

      process.on('error', (error) => {
        console.error(`Server ${serverId} error:`, error);
        this.emitLog(serverId, 'error', `Process error: ${error.message}`);
        this.cleanupServer(serverId);
      });

      process.on('exit', (code) => {
        console.log(`Server ${serverId} exited with code ${code}`);
        this.emitLog(serverId, 'info', `Server exited with code ${code}`);
        this.cleanupServer(serverId);
      });

      // Update database
      this.db.updateServer(serverId, {
        status: 'running',
        pid: process.pid,
        started_at: new Date().toISOString()
      });

      this.io.emit('server-started', { serverId, port });
      
      return { success: true, pid: process.pid, port };
    } catch (error) {
      console.error('Failed to start server:', error);
      return { success: false, error: error.message };
    }
  }

  simulateServerStart(serverId, game) {
    // Simulate server for development without RFD
    const port = this.db.getServerById(serverId)?.port || 2000;
    
    this.portsInUse.add(port);
    
    const startTime = Date.now();
    const fakeProcess = {
      pid: Math.floor(Math.random() * 10000) + 5000,
      kill: () => {}
    };

    this.processes.set(serverId, {
      process: fakeProcess,
      startTime,
      gameTitle: game.title,
      simulated: true
    });

    // Simulate periodic logs
    const logInterval = setInterval(() => {
      if (!this.processes.has(serverId)) {
        clearInterval(logInterval);
        return;
      }
      this.emitLog(serverId, 'info', `[Simulated] Server running on port ${port}`);
    }, 30000);

    this.db.updateServer(serverId, {
      status: 'running',
      pid: fakeProcess.pid,
      started_at: new Date().toISOString()
    });

    this.io.emit('server-started', { serverId, port });
    
    return { success: true, simulated: true, port };
  }

  async stopServer(serverId) {
    const serverData = this.processes.get(serverId);
    
    if (!serverData) {
      // Try to cleanup database entry
      const server = this.db.getServerById(serverId);
      if (server) {
        this.db.updateServer(serverId, {
          status: 'stopped',
          pid: null,
          uptime: 0
        });
      }
      return { success: true, message: 'Server was not running' };
    }

    try {
      if (serverData.process && !serverData.simulated) {
        serverData.process.kill('SIGTERM');
        
        // Give it 5 seconds to terminate gracefully
        setTimeout(() => {
          if (serverData.process && !serverData.process.killed) {
            serverData.process.kill('SIGKILL');
          }
        }, 5000);
      }

      this.cleanupServer(serverId);
      
      this.db.updateServer(serverId, {
        status: 'stopped',
        pid: null,
        uptime: 0
      });

      this.io.emit('server-stopped', { serverId });
      
      return { success: true };
    } catch (error) {
      console.error('Failed to stop server:', error);
      return { success: false, error: error.message };
    }
  }

  async restartServer(serverId) {
    const server = this.db.getServerById(serverId);
    if (!server) {
      return { success: false, error: 'Server not found' };
    }

    await this.stopServer(serverId);
    
    // Small delay before restart
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return this.startServer(serverId, server.game_id);
  }

  cleanupServer(serverId) {
    const serverData = this.processes.get(serverId);
    if (serverData) {
      this.portsInUse.delete(serverData.port);
      this.processes.delete(serverId);
    }
  }

  emitLog(serverId, level, message) {
    const logEntry = {
      serverId,
      level,
      message,
      timestamp: new Date().toISOString()
    };

    this.db.addLog(serverId, `[${level.toUpperCase()}] ${message}`);
    
    // Emit to server-specific room
    this.io.to(`server-logs-${serverId}`).emit('server-log', logEntry);
  }

  updatePlayerCount(serverId, action, player) {
    const server = this.db.getServerById(serverId);
    if (!server) return;

    let players = [];
    try {
      players = JSON.parse(server.players || '[]');
    } catch (e) {
      players = [];
    }

    if (action === 'join') {
      if (!players.find(p => p.id === player.id)) {
        players.push(player);
      }
    } else if (action === 'leave') {
      players = players.filter(p => p.id !== player.id);
    }

    this.db.updateServer(serverId, {
      players: JSON.stringify(players)
    });

    this.io.emit('player-update', {
      serverId,
      players,
      count: players.length
    });
  }

  getServerStatus(serverId) {
    const server = this.db.getServerById(serverId);
    if (!server) return null;

    const serverData = this.processes.get(serverId);
    let uptime = 0;
    
    if (serverData && server.status === 'running') {
      uptime = (Date.now() - serverData.startTime) / 1000;
    }

    let players = [];
    try {
      players = JSON.parse(server.players || '[]');
    } catch (e) {
      players = [];
    }

    return {
      ...server,
      uptime,
      players,
      playerCount: players.length
    };
  }

  getAvailablePort(startPort = 2000) {
    let port = startPort;
    while (this.portsInUse.has(port) && port < 65535) {
      port++;
    }
    return port;
  }

  stopAllServers() {
    console.log('Stopping all servers...');
    for (const [serverId, serverData] of this.processes) {
      try {
        if (serverData.process && !serverData.simulated) {
          serverData.process.kill('SIGTERM');
        }
      } catch (e) {
        console.error(`Failed to stop server ${serverId}:`, e);
      }
    }
    this.processes.clear();
    this.portsInUse.clear();
  }

  restoreServers() {
    // Check for any servers that were running before shutdown
    const servers = this.db.getAllServers();
    servers.forEach(server => {
      if (server.status === 'running' && server.pid) {
        // Try to verify if process is still running
        try {
          process.kill(server.pid, 0);
          console.log(`Restored server ${server.id} with PID ${server.pid}`);
        } catch (e) {
          // Process not running, update status
          this.db.updateServer(server.id, { status: 'stopped', pid: null });
        }
      }
    });
  }

  getAllServerStatuses() {
    const servers = this.db.getAllServers();
    return servers.map(server => this.getServerStatus(server.id)).filter(Boolean);
  }
}

module.exports = ServerManager;