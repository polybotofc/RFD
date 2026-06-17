const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const allowedExt = ['.rbxl', '.rbxlx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExt.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .rbxl and .rbxlx files are allowed'));
    }
  }
});

// Get dashboard stats
router.get('/stats', authenticate, (req, res) => {
  const db = req.app.get('db');
  const stats = db.getStats();
  res.json({ success: true, stats });
});

// Get config
router.get('/config', authenticate, (req, res) => {
  const db = req.app.get('db');
  const config = db.getAllConfig();
  res.json({ success: true, config });
});

// Update config (admin only)
router.post('/config', authenticate, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const { key, value } = req.body;

  if (!key) {
    return res.status(400).json({ success: false, error: 'Config key is required' });
  }

  db.setConfig(key, value);
  db.createAuditLog(req.user.id, 'config-update', `Updated config: ${key}`, req.ip);

  res.json({ success: true, message: 'Config updated' });
});

// Bulk update config (admin only)
router.post('/config/bulk', authenticate, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const config = req.body;

  for (const [key, value] of Object.entries(config)) {
    db.setConfig(key, value);
  }

  db.createAuditLog(req.user.id, 'config-bulk-update', 'Bulk config update', req.ip);
  res.json({ success: true, message: 'Config updated' });
});

// Join game endpoint
router.post('/join', authenticate, (req, res) => {
  const db = req.app.get('db');
  const { serverId } = req.body;

  const server = db.getServerById(serverId);
  if (!server) {
    return res.status(404).json({ success: false, error: 'Server not found' });
  }

  if (server.status !== 'running') {
    return res.status(400).json({ success: false, error: 'Server is not running' });
  }

  const user = db.getUserById(req.user.id);
  
  // Generate launch command
  const rfdPath = server.rfdPath || 'RFD.exe';
  const launchCommand = `${rfdPath} player -h ${server.host} -p ${server.port} -u ${user.userCode}`;

  // Record join history
  db.addJoinHistory(req.user.id, serverId, user.userCode);
  db.createAuditLog(req.user.id, 'join-game', `Joined server ${server.name}`, req.ip);

  res.json({
    success: true,
    data: {
      host: server.host,
      port: server.port,
      userCode: user.userCode,
      serverName: server.name,
      launchCommand
    }
  });
});

// Get Roblox clients
router.get('/clients', authenticate, (req, res) => {
  const db = req.app.get('db');
  const clients = db.getClients();
  res.json({ success: true, clients });
});

// Create Roblox client (admin only)
router.post('/clients', authenticate, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const { name, clientVersion, clientPath, launchArguments, isDefault } = req.body;

  if (!name || !clientVersion) {
    return res.status(400).json({ success: false, error: 'Name and version are required' });
  }

  const clientId = db.createClient({ name, clientVersion, clientPath, launchArguments, isDefault });
  
  if (isDefault) {
    db.setDefaultClient(clientId);
  }

  db.createAuditLog(req.user.id, 'client-create', `Created client ${name}`, req.ip);
  res.status(201).json({ success: true, clientId });
});

// Set default client (admin only)
router.post('/clients/:id/default', authenticate, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  db.setDefaultClient(req.params.id);
  db.createAuditLog(req.user.id, 'client-set-default', `Set client ${req.params.id} as default`, req.ip);
  res.json({ success: true, message: 'Default client updated' });
});

// Delete client (admin only)
router.delete('/clients/:id', authenticate, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  db.deleteClient(req.params.id);
  db.createAuditLog(req.user.id, 'client-delete', `Deleted client ${req.params.id}`, req.ip);
  res.json({ success: true, message: 'Client deleted' });
});

// Upload place file (admin only)
router.post('/upload/place', authenticate, requireAdmin, upload.single('place'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }

  const db = req.app.get('db');
  db.createAuditLog(req.user.id, 'upload-place', `Uploaded ${req.file.originalname}`, req.ip);

  res.json({
    success: true,
    message: 'File uploaded',
    file: {
      name: req.file.originalname,
      path: req.file.path,
      size: req.file.size
    }
  });
});

// Get audit logs (admin only)
router.get('/audit-logs', authenticate, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const limit = parseInt(req.query.limit) || 100;
  const logs = db.getAuditLogs(limit);
  res.json({ success: true, logs });
});

// Get all users (admin only)
router.get('/users', authenticate, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const users = db.getAllUsers();
  res.json({ success: true, users });
});

// Detect RFD installation (admin only)
router.get('/detect-rfd', authenticate, requireAdmin, async (req, res) => {
  const serverManager = req.app.get('serverManager');
  const rfdPath = await serverManager.detectRFDPath();
  const configPath = rfdPath ? await serverManager.detectGameConfig(rfdPath) : null;
  const config = configPath ? serverManager.parseGameConfig(configPath) : null;

  res.json({
    success: true,
    detection: {
      rfdPath,
      configPath,
      config
    }
  });
});

// Generate GameConfig.toml
router.post('/generate-config', authenticate, requireAdmin, (req, res) => {
  const serverManager = req.app.get('serverManager');
  const config = req.body;
  const content = serverManager.generateGameConfig(config);

  res.json({
    success: true,
    content,
    downloadUrl: `data:text/plain;charset=utf-8,${encodeURIComponent(content)}`
  });
});

module.exports = router;
