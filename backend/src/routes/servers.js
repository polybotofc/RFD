const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all servers
router.get('/', authenticate, (req, res) => {
  const db = req.app.get('db');
  const servers = db.getServers();
  res.json({ success: true, servers });
});

// Get server by ID
router.get('/:id', authenticate, (req, res) => {
  const db = req.app.get('db');
  const serverManager = req.app.get('serverManager');
  
  const server = db.getServerById(req.params.id);
  if (!server) {
    return res.status(404).json({ success: false, error: 'Server not found' });
  }

  const status = serverManager.getServerStatus(req.params.id);
  res.json({ success: true, server: status });
});

// Create server (admin only)
router.post('/', authenticate, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const { name, host, port, maxPlayers, placeFile, rfdPath } = req.body;

  if (!name || !host || !port) {
    return res.status(400).json({ success: false, error: 'Name, host, and port are required' });
  }

  // Check if port is already in use
  const existing = db.getServerByPort(port);
  if (existing) {
    return res.status(400).json({ success: false, error: 'Port already in use' });
  }

  const serverId = db.createServer({ name, host, port, maxPlayers, placeFile, rfdPath });
  db.createAuditLog(req.user.id, 'server-create', `Created server ${name} on port ${port}`, req.ip);

  res.status(201).json({ success: true, serverId });
});

// Update server (admin only)
router.put('/:id', authenticate, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const server = db.getServerById(req.params.id);
  
  if (!server) {
    return res.status(404).json({ success: false, error: 'Server not found' });
  }

  const { name, maxPlayers, placeFile, rfdPath } = req.body;
  
  if (name) db.db.prepare('UPDATE servers SET name = ? WHERE id = ?').run(name, req.params.id);
  if (maxPlayers) db.db.prepare('UPDATE servers SET maxPlayers = ? WHERE id = ?').run(maxPlayers, req.params.id);
  if (placeFile !== undefined) db.db.prepare('UPDATE servers SET placeFile = ? WHERE id = ?').run(placeFile, req.params.id);
  if (rfdPath !== undefined) db.db.prepare('UPDATE servers SET rfdPath = ? WHERE id = ?').run(rfdPath, req.params.id);

  db.createAuditLog(req.user.id, 'server-update', `Updated server ${req.params.id}`, req.ip);
  
  const updated = db.getServerById(req.params.id);
  res.json({ success: true, server: updated });
});

// Delete server (admin only)
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const serverManager = req.app.get('serverManager');
  
  const server = db.getServerById(req.params.id);
  if (!server) {
    return res.status(404).json({ success: false, error: 'Server not found' });
  }

  // Stop server if running
  if (server.status === 'running') {
    serverManager.stopServer(req.params.id);
  }

  db.deleteServer(req.params.id);
  db.createAuditLog(req.user.id, 'server-delete', `Deleted server ${server.name}`, req.ip);

  res.json({ success: true, message: 'Server deleted' });
});

// Start server (admin only)
router.post('/:id/start', authenticate, requireAdmin, async (req, res) => {
  try {
    const db = req.app.get('db');
    const serverManager = req.app.get('serverManager');
    
    const server = db.getServerById(req.params.id);
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }

    const result = await serverManager.startServer(req.params.id, req.body);
    
    if (result.success) {
      db.createAuditLog(req.user.id, 'server-start', `Started server ${server.name}`, req.ip);
      res.json({ success: true, message: 'Server started', pid: result.pid });
    } else {
      res.status(500).json({ success: false, error: result.error || 'Failed to start server' });
    }
  } catch (error) {
    console.error('Start server error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Stop server (admin only)
router.post('/:id/stop', authenticate, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const serverManager = req.app.get('serverManager');
  
  const server = db.getServerById(req.params.id);
  if (!server) {
    return res.status(404).json({ success: false, error: 'Server not found' });
  }

  serverManager.stopServer(req.params.id);
  db.createAuditLog(req.user.id, 'server-stop', `Stopped server ${server.name}`, req.ip);

  res.json({ success: true, message: 'Server stopped' });
});

// Restart server (admin only)
router.post('/:id/restart', authenticate, requireAdmin, async (req, res) => {
  try {
    const db = req.app.get('db');
    const serverManager = req.app.get('serverManager');
    
    const server = db.getServerById(req.params.id);
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }

    const result = await serverManager.restartServer(req.params.id, req.body);
    
    if (result.success) {
      db.createAuditLog(req.user.id, 'server-restart', `Restarted server ${server.name}`, req.ip);
      res.json({ success: true, message: 'Server restarted', pid: result.pid });
    } else {
      res.status(500).json({ success: false, error: result.error || 'Failed to restart server' });
    }
  } catch (error) {
    console.error('Restart server error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Scan ports
router.get('/scan/ports', authenticate, async (req, res) => {
  const serverManager = req.app.get('serverManager');
  const host = req.query.host || '127.0.0.1';
  const customPorts = req.query.ports ? req.query.ports.split(',').map(Number) : null;
  const ports = customPorts || serverManager.scanPorts;

  const results = await serverManager.scanPorts(host, ports);
  res.json({ success: true, results });
});

// Health check
router.get('/:id/health', authenticate, async (req, res) => {
  const serverManager = req.app.get('serverManager');
  const health = await serverManager.healthCheck(req.params.id);
  res.json({ success: true, health });
});

// Get server logs (admin only)
router.get('/:id/logs', authenticate, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const logs = db.getAuditLogs(100).filter(log => 
    log.action === 'server-log' && log.details.includes(req.params.id)
  );
  res.json({ success: true, logs });
});

module.exports = router;
