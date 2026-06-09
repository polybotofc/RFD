const fs = require('fs');
const path = require('path');

class LogWatcher {
  constructor(db, serverManager, io) {
    this.db = db;
    this.serverManager = serverManager;
    this.io = io;
    this.watchedFiles = new Map();
    
    // Log directory
    this.logDir = process.env.RFD_LOG_DIR || '/app/logs';
    
    this.initialize();
  }

  initialize() {
    // Ensure log directory exists
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (err) {
      console.warn('Warning: Could not create log directory:', err.message);
      // Use a fallback local directory
      this.logDir = path.join(__dirname, '../../../logs');
      try {
        if (!fs.existsSync(this.logDir)) {
          fs.mkdirSync(this.logDir, { recursive: true });
        }
      } catch (e) {
        console.warn('Fallback log directory also failed:', e.message);
      }
    }

    // Start watching for new log files
    this.startWatcher();
    
    console.log('Log watcher initialized');
  }

  startWatcher() {
    // Poll for new log files every 5 seconds
    setInterval(() => {
      this.checkForNewLogs();
    }, 5000);
  }

  checkForNewLogs() {
    try {
      if (!fs.existsSync(this.logDir)) return;

      const files = fs.readdirSync(this.logDir)
        .filter(f => f.endsWith('.log'))
        .map(f => path.join(this.logDir, f));

      files.forEach(file => {
        if (!this.watchedFiles.has(file)) {
          this.watchFile(file);
        }
      });
    } catch (error) {
      console.error('Error checking logs:', error);
    }
  }

  watchFile(filePath) {
    let lastSize = 0;
    
    try {
      const stats = fs.statSync(filePath);
      lastSize = stats.size;
    } catch (e) {
      return;
    }

    const watcher = fs.watch(filePath, (eventType) => {
      if (eventType === 'change') {
        this.readNewLogs(filePath, lastSize);
        try {
          const stats = fs.statSync(filePath);
          lastSize = stats.size;
        } catch (e) {}
      }
    });

    this.watchedFiles.set(filePath, watcher);
  }

  readNewLogs(filePath, fromPosition) {
    try {
      const buffer = Buffer.alloc(65536);
      const fd = fs.openSync(filePath, 'r');
      
      const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, fromPosition);
      fs.closeSync(fd);

      if (bytesRead > 0) {
        const newLogs = buffer.toString('utf8', 0, bytesRead);
        const lines = newLogs.split('\n').filter(l => l.trim());

        lines.forEach(line => {
          this.parseLogLine(line, filePath);
        });
      }
    } catch (error) {
      // File might be locked, ignore
    }
  }

  parseLogLine(line, filePath) {
    // Detect server start patterns
    const serverStartPattern = /Started network server on port (\d+)/i;
    const serverStartMatch = line.match(serverStartPattern);
    
    if (serverStartMatch) {
      const port = parseInt(serverStartMatch[1]);
      this.handleServerStarted(port, line);
    }

    // Detect player join
    const playerJoinPattern = /Player (\w+) joined/i;
    const playerJoinMatch = line.match(playerJoinPattern);
    
    if (playerJoinMatch) {
      const playerName = playerJoinMatch[1];
      this.handlePlayerJoin(port || 0, playerName, line);
    }

    // Detect player leave
    const playerLeavePattern = /Player (\w+) left/i;
    const playerLeaveMatch = line.match(playerLeavePattern);
    
    if (playerLeaveMatch) {
      const playerName = playerLeaveMatch[1];
      this.handlePlayerLeave(port || 0, playerName, line);
    }

    // Detect server stop
    const serverStopPattern = /Server (?:stopped|shut down)/i;
    if (serverStopPattern.test(line)) {
      this.handleServerStopped(line);
    }

    // Broadcast to admin logs
    this.io.to('admin-logs').emit('log-line', {
      file: path.basename(filePath),
      line,
      timestamp: new Date().toISOString()
    });
  }

  handleServerStarted(port, line) {
    console.log(`Auto-discovered server on port ${port}`);
    
    // Check if server already exists in database
    let server = this.db.getServerByPort(port);
    
    if (!server) {
      // Auto-register new server
      // Try to determine game from log context
      const gameId = this.findGameForPort(port);
      
      const result = this.db.createServer({
        game_id: gameId || 1,
        port,
        status: 'running'
      });
      
      server = this.db.getServerById(result.id);
      
      this.io.emit('server-discovered', {
        server,
        source: 'log-watcher'
      });
    }
  }

  handlePlayerJoin(port, playerName, line) {
    const server = this.db.getServerByPort(port);
    if (server) {
      this.serverManager.updatePlayerCount(server.id, 'join', {
        id: Date.now().toString(),
        name: playerName,
        joinedAt: new Date().toISOString()
      });
    }
  }

  handlePlayerLeave(port, playerName, line) {
    const server = this.db.getServerByPort(port);
    if (server) {
      this.serverManager.updatePlayerCount(server.id, 'leave', {
        name: playerName
      });
    }
  }

  handleServerStopped(line) {
    // Update any servers that appear to have stopped
    // This is a best-effort detection
    this.io.emit('server-stopped-detected', {
      reason: 'log-watcher',
      line
    });
  }

  findGameForPort(port) {
    // Simple mapping: use game with matching default_port or first game
    const games = this.db.getAllGames();
    const game = games.find(g => g.default_port === port);
    return game ? game.id : (games[0]?.id || 1);
  }

  stop() {
    this.watchedFiles.forEach((watcher, file) => {
      watcher.close();
    });
    this.watchedFiles.clear();
  }
}

module.exports = LogWatcher;