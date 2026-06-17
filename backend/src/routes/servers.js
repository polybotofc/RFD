const express = require('express');
const { authenticate, requireAdmin, sanitizeInput, getClientIP } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const db = req.app.get('db');
  const { status, search } = req.query;
  let servers = status ? db.getServers(status) : db.getServers();
  if (search) {
    servers = servers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  }
  res.json({ success: true, servers, count: servers.length });
});

router.get('/:id', authenticate, (req, res) => {
  const db = req.app.get('db');
  const serverId = parseInt(req.params.id);
  const server = db.getServerById(serverId);
  if (!server) return res.status(404).json({ success: false, error: 'Server not found', code: 'SERVER_NOT_FOUND' });
  const players = db.getOnlinePlayers(serverId);
  res.json({ success: true, server: { ...server, players } });
});

router.post('/', authenticate, requireAdmin, sanitizeInput, (req, res) => {
  const db = req.app.get('db');
  const { name, host, port, maxPlayers, placeFile, version, map, gameId } = req.body;
  if (!name || !port) return res.status(400).json({ success: false, error: 'Name and port required', code: 'INVALID_INPUT' });
  const existing = db.getServerByPort(port);
  if (existing) return res.status(400).json({ success: false, error: 'Port in use', code: 'PORT_IN_USE' });
  const serverId = db.createServer({ name, host: host || 'localhost', port: parseInt(port), maxPlayers: parseInt(maxPlayers) || 100, placeFile, version, map, gameId });
  db.createAuditLog(req.user.id, 'server_create', `Created server: ${name}`, getClientIP(req), 'server', serverId);
  res.status(201).json({ success: true, server: db.getServerById(serverId) });
});

router.put('/:id', authenticate, requireAdmin, sanitizeInput, (req, res) => {
  const db = req.app.get('db');
  const serverId = parseInt(req.params.id);
  const server = db.getServerById(serverId);
  if (!server) return res.status(404).json({ success: false, error: 'Server not found', code: 'SERVER_NOT_FOUND' });
  const { name, host, port, maxPlayers, placeFile, version, map, gameId } = req.body;
  if (port && port !== server.port) {
    const existing = db.getServerByPort(port);
    if (existing) return res.status(400).json({ success: false, error: 'Port in use', code: 'PORT_IN_USE' });
  }
  db.updateServer(serverId, { name, host, port: port ? parseInt(port) : undefined, maxPlayers: maxPlayers ? parseInt(maxPlayers) : undefined, placeFile, version, map, gameId });
  db.createAuditLog(req.user.id, 'server_update', `Updated server: ${name || server.name}`, getClientIP(req), 'server', serverId);
  res.json({ success: true, server: db.getServerById(serverId) });
});

router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const serverId = parseInt(req.params.id);
  const server = db.getServerById(serverId);
  if (!server) return res.status(404).json({ success: false, error: 'Server not found', code: 'SERVER_NOT_FOUND' });
  if (server.status === 'running') {
    const rfdManager = req.app.get('rfdManager');
    try { rfdManager.stopServer(serverId); } catch (e) { console.error('Failed to stop server:', e); }
  }
  db.deleteServer(serverId);
  db.createAuditLog(req.user.id, 'server_delete', `Deleted server: ${server.name}`, getClientIP(req), 'server', serverId);
  res.json({ success: true, message: 'Server deleted' });
});

router.post('/:id/start', authenticate, requireAdmin, async (req, res) => {
  const db = req.app.get('db');
  const serverId = parseInt(req.params.id);
  const server = db.getServerById(serverId);
  if (!server) return res.status(404).json({ success: false, error: 'Server not found', code: 'SERVER_NOT_FOUND' });
  if (server.status === 'running') return res.status(400).json({ success: false, error: 'Already running', code: 'ALREADY_RUNNING' });
  try {
    const rfdManager = req.app.get('rfdManager');
    const result = await rfdManager.startServer(serverId);
    db.createAuditLog(req.user.id, 'server_start', `Started server: ${server.name}`, getClientIP(req), 'server', serverId);
    res.json({ success: true, message: 'Server started', ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, code: 'START_FAILED' });
  }
});

router.post('/:id/stop', authenticate, requireAdmin, async (req, res) => {
  const db = req.app.get('db');
  const serverId = parseInt(req.params.id);
  const server = db.getServerById(serverId);
  if (!server) return res.status(404).json({ success: false, error: 'Server not found', code: 'SERVER_NOT_FOUND' });
  if (server.status !== 'running') return res.status(400).json({ success: false, error: 'Not running', code: 'NOT_RUNNING' });
  try {
    const rfdManager = req.app.get('rfdManager');
    await rfdManager.stopServer(serverId);
    db.createAuditLog(req.user.id, 'server_stop', `Stopped server: ${server.name}`, getClientIP(req), 'server', serverId);
    res.json({ success: true, message: 'Server stopped' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, code: 'STOP_FAILED' });
  }
});

router.post('/:id/restart', authenticate, requireAdmin, async (req, res) => {
  const db = req.app.get('db');
  const serverId = parseInt(req.params.id);
  const server = db.getServerById(serverId);
  if (!server) return res.status(404).json({ success: false, error: 'Server not found', code: 'SERVER_NOT_FOUND' });
  try {
    const rfdManager = req.app.get('rfdManager');
    const result = await rfdManager.restartServer(serverId);
    db.createAuditLog(req.user.id, 'server_restart', `Restarted server: ${server.name}`, getClientIP(req), 'server', serverId);
    res.json({ success: true, message: 'Server restarted', ...result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, code: 'RESTART_FAILED' });
  }
});

router.get('/:id/logs', authenticate, requireAdmin, async (req, res) => {
  const serverId = parseInt(req.params.id);
  const { lines = 100 } = req.query;
  try {
    const rfdManager = req.app.get('rfdManager');
    const logs = await rfdManager.getLogs(serverId, parseInt(lines));
    res.json({ success: true, logs, count: logs.length });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, code: 'LOG_READ_ERROR' });
  }
});

router.get('/:id/console', authenticate, requireAdmin, (req, res) => {
  const serverId = parseInt(req.params.id);
  const { lines = 100 } = req.query;
  const rfdManager = req.app.get('rfdManager');
  const buffer = rfdManager.getConsoleBuffer(serverId, parseInt(lines));
  res.json({ success: true, console: buffer, count: buffer.length });
});

router.post('/:id/console', authenticate, requireAdmin, async (req, res) => {
  const serverId = parseInt(req.params.id);
  const { command } = req.body;
  if (!command) return res.status(400).json({ success: false, error: 'Command required', code: 'NO_COMMAND' });
  try {
    const rfdManager = req.app.get('rfdManager');
    await rfdManager.sendCommand(serverId, command);
    res.json({ success: true, message: 'Command sent' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, code: 'COMMAND_FAILED' });
  }
});

router.post('/:id/console/clear', authenticate, requireAdmin, (req, res) => {
  const serverId = parseInt(req.params.id);
  const rfdManager = req.app.get('rfdManager');
  rfdManager.clearConsole(serverId);
  res.json({ success: true, message: 'Console cleared' });
});

router.get('/:id/players', authenticate, (req, res) => {
  const db = req.app.get('db');
  const serverId = parseInt(req.params.id);
  const server = db.getServerById(serverId);
  if (!server) return res.status(404).json({ success: false, error: 'Server not found', code: 'SERVER_NOT_FOUND' });
  const players = db.getOnlinePlayers(serverId);
  res.json({ success: true, players, count: players.length });
});

router.get('/:id/status', authenticate, (req, res) => {
  const serverId = parseInt(req.params.id);
  const rfdManager = req.app.get('rfdManager');
  const status = rfdManager.getServerStatus(serverId);
  res.json({ success: true, status });
});

module.exports = router;
