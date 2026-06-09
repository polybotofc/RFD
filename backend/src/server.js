require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');

// Import routes
const authRoutes = require('./routes/auth');
const serversRoutes = require('./routes/servers');
const apiRoutes = require('./routes/api');

// Import services
const DatabaseService = require('./services/database');
const ServerManager = require('./services/serverManager');

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST']
  }
});

app.set('io', io);

// Initialize database
const db = new DatabaseService();
db.initialize();
app.set('db', db);

// Initialize server manager
const serverManager = new ServerManager(db, io);
app.set('serverManager', serverManager);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../../../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/servers', serversRoutes);
app.use('/api', apiRoutes);

// RFD Compatibility endpoints
app.get('/asset/:id', (req, res) => {
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

  socket.on('join-server-logs', (serverId) => {
    socket.join(`server-logs-${serverId}`);
  });

  socket.on('leave-server-logs', (serverId) => {
    socket.leave(`server-logs-${serverId}`);
  });

  socket.on('join-admin-logs', () => {
    socket.join('admin-logs');
  });

  socket.on('player-joined', (data) => {
    if (serverManager) {
      serverManager.updatePlayerCount(data.serverId, 'join', data.player);
    }
  });

  socket.on('player-left', (data) => {
    if (serverManager) {
      serverManager.updatePlayerCount(data.serverId, 'leave', data.player);
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`RFD Platform server running on port ${PORT}`);
  console.log(`API available at http://localhost:${PORT}/api`);
  console.log(`Default admin: admin / admin123`);
  
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
