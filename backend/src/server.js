/**
 * RFD Platform Server
 * 
 * Main server entry point for the RFD Platform backend.
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const https = require('https');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

// Import routes
const authRoutes = require('./routes/auth');
const serversRoutes = require('./routes/servers');
const playersRoutes = require('./routes/players');
const gamesRoutes = require('./routes/games');
const apiRoutes = require('./routes/api');

// Import services
const DatabaseService = require('./services/database');
const RFDManager = require('./services/RFDManager');

// Import socket handlers
const { setupSocketHandlers } = require('./socket');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Socket.IO setup with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Set app references
app.set('io', io);
app.set('server', server);

// Initialize database
const db = new DatabaseService();
db.initialize();
app.set('db', db);

// Initialize RFD Manager
const rfdManager = new RFDManager(db, io);
rfdManager.initialize().catch(err => {
  console.warn('RFD Manager initialization warning:', err.message);
});
app.set('rfdManager', rfdManager);

// Setup Socket.IO handlers
const socketHandlers = setupSocketHandlers(io, db, rfdManager);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parsing (if needed)
app.use((req, res, next) => {
  // Simple cookie parsing
  req.cookies = {};
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const [name, ...rest] = cookie.split('=');
      req.cookies[name.trim()] = rest.join('=').trim();
    });
  }
  next();
});

// Request logging (simple)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production' || req.path.startsWith('/api')) {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// Create necessary directories
const dirs = [
  path.join(__dirname, '../../../uploads'),
  path.join(__dirname, '../../../uploads/places'),
  path.join(__dirname, '../../../uploads/avatars'),
  path.join(__dirname, '../../../uploads/assets'),
  path.join(__dirname, '../../../database'),
  path.join(__dirname, '../../../logs'),
  path.join(__dirname, '../../../backups'),
  path.join(__dirname, '../../../places')
];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../../../uploads')));

// Health check
app.get('/health', (req, res) => {
  const uptime = process.uptime();
  const memory = process.memoryUsage();
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptime),
    memory: {
      heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
      heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
      rss: Math.round(memory.rss / 1024 / 1024)
    },
    adapters: rfdManager.adapter ? [rfdManager.adapter.getName()] : []
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/servers', serversRoutes);
app.use('/api/players', playersRoutes);
app.use('/api/games', gamesRoutes);
app.use('/api', apiRoutes);

// ==================== Admin Routes ====================
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// ==================== Stats Routes ====================
const statsRoutes = require('./routes/stats');
app.use('/api/stats', statsRoutes);

// ==================== Assets Routes ====================
const assetsRoutes = require('./routes/assets');
app.use('/api/assets', assetsRoutes);

// ==================== Config Routes ====================
const configRoutes = require('./routes/config');
app.use('/api/config', configRoutes);

// RFD Compatibility endpoints
app.get('/asset/:id', (req, res) => {
  res.status(200).json({ success: true, assetId: req.params.id });
});

app.get('/rfd/roblox-version', (req, res) => {
  rfdManager.getVersion()
    .then(version => res.json({ version, protocol: 'RFD/1.0' }))
    .catch(() => res.json({ version: '0.1.0', protocol: 'RFD/1.0' }));
});

app.get('/rfd/default-user-code', (req, res) => {
  res.json({ userCode: 'RBX000' });
});

app.post('/v1.1/game-start-info', (req, res) => {
  res.json({ status: 'ok' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    code: 'NOT_FOUND',
    path: req.path
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    code: err.code || 'INTERNAL_ERROR',
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
});

// Start server
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           RFD Platform Server                              ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║  Server running on port ${PORT}`.padEnd(56) + '║');
  console.log(`║  API available at http://localhost:${PORT}/api`.padEnd(56) + '║');
  console.log(`║  Health check: http://localhost:${PORT}/health`.padEnd(56) + '║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║  Default admin: admin / admin123'.padEnd(56) + '║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`${signal} received, shutting down gracefully...`);
  
  try {
    // Stop all servers
    await rfdManager.stopAllServers();
    
    // Close database
    db.close();
    
    // Close server
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
    
    // Force exit after 10 seconds
    setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = { app, server, io, db, rfdManager };
