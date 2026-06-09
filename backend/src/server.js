require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');

// Import routes
const authRoutes = require('./routes/auth');
const gamesRoutes = require('./routes/games');
const serversRoutes = require('./routes/servers');
const apiRoutes = require('./routes/api');

// Import services
const Database = require('./services/database');
const ServerManager = require('./services/serverManager');
const LogWatcher = require('./services/logWatcher');

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

// Make io accessible to routes
app.set('io', io);

// Initialize database
const db = new Database();
db.initialize();
app.set('db', db);

// Initialize server manager
const serverManager = new ServerManager(db, io);
app.set('serverManager', serverManager);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api/servers', serversRoutes);
app.use('/api', apiRoutes);

// RFD Compatibility endpoints
app.get('/asset/:id', (req, res) => {
  // RFD asset endpoint - serve from local storage or proxy
  res.status(200).json({ success: true });
});

app.get('/rfd/roblox-version', (req, res) => {
  res.json({ version: '0.1.0', protocol: 'RFD/1.0' });
});

app.get('/rfd/default-user-code', (req, res) => {
  res.json({ userCode: 'RBX000' });
});

app.post('/v1.1/game-start-info', (req, res) => {
  res.json({ status: 'ok' });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Join room for server logs
  socket.on('join-server-logs', (serverId) => {
    socket.join(`server-logs-${serverId}`);
  });

  socket.on('leave-server-logs', (serverId) => {
    socket.leave(`server-logs-${serverId}`);
  });

  // Join admin room for all logs
  socket.on('join-admin-logs', () => {
    socket.join('admin-logs');
  });

  // Handle player join/leave
  socket.on('player-joined', (data) => {
    if (app.get('serverManager')) {
      app.get('serverManager').updatePlayerCount(data.serverId, 'join', data.player);
    }
  });

  socket.on('player-left', (data) => {
    if (app.get('serverManager')) {
      app.get('serverManager').updatePlayerCount(data.serverId, 'leave', data.player);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Initialize log watcher
const logWatcher = new LogWatcher(db, serverManager, io);
app.set('logWatcher', logWatcher);

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`RFD Platform server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
  
  // Restore running servers from database
  serverManager.restoreServers();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  serverManager.stopAllServers();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  serverManager.stopAllServers();
  process.exit(0);
});

module.exports = { app, server, io };