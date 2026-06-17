/**
 * Admin Routes
 */
const express = require('express');
const { authenticate, requireAdmin, getClientIP } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate, requireAdmin);

router.get('/users', (req, res) => {
  const db = req.app.get('db');
  const users = db.getAllUsers(true);
  res.json({ success: true, users, count: users.length });
});

router.post('/users/:id/ban', (req, res) => {
  const db = req.app.get('db');
  const userId = parseInt(req.params.id);
  const { reason } = req.body;
  db.banUser(userId, reason);
  db.createAuditLog(req.user.id, 'user_ban', `Banned user ${userId}`, getClientIP(req), 'user', userId);
  res.json({ success: true, message: 'User banned' });
});

router.post('/users/:id/unban', (req, res) => {
  const db = req.app.get('db');
  const userId = parseInt(req.params.id);
  db.unbanUser(userId);
  db.createAuditLog(req.user.id, 'user_unban', `Unbanned user ${userId}`, getClientIP(req), 'user', userId);
  res.json({ success: true, message: 'User unbanned' });
});

router.post('/users/:id/promote', (req, res) => {
  const db = req.app.get('db');
  const userId = parseInt(req.params.id);
  db.changeUserRole(userId, 'admin');
  db.createAuditLog(req.user.id, 'user_promote', `Promoted user ${userId} to admin`, getClientIP(req), 'user', userId);
  res.json({ success: true, message: 'User promoted to admin' });
});

router.post('/users/:id/demote', (req, res) => {
  const db = req.app.get('db');
  const userId = parseInt(req.params.id);
  db.changeUserRole(userId, 'user');
  db.createAuditLog(req.user.id, 'user_demote', `Demoted user ${userId} to user`, getClientIP(req), 'user', userId);
  res.json({ success: true, message: 'User demoted' });
});

router.get('/logs', (req, res) => {
  const db = req.app.get('db');
  const { limit = 100, action } = req.query;
  const logs = db.getAuditLogs(parseInt(limit), null, action);
  res.json({ success: true, logs, count: logs.length });
});

router.post('/broadcast', (req, res) => {
  const db = req.app.get('db');
  const { title, message, priority = 'normal' } = req.body;
  db.createAnnouncement({ title, content: message, authorId: req.user.id, priority });
  const io = req.app.get('io');
  io.emit('announcement', { title, message, priority });
  db.createAuditLog(req.user.id, 'broadcast', `Broadcast: ${title}`, getClientIP(req));
  res.json({ success: true, message: 'Broadcast sent' });
});

router.post('/maintenance', (req, res) => {
  const db = req.app.get('db');
  const { enabled } = req.body;
  db.setConfig('maintenanceMode', enabled ? 'true' : 'false', 'boolean');
  const io = req.app.get('io');
  io.emit('maintenance-mode', { enabled });
  db.createAuditLog(req.user.id, 'maintenance_mode', `Set maintenance mode to ${enabled}`, getClientIP(req));
  res.json({ success: true, message: 'Maintenance mode updated' });
});

router.get('/backups', async (req, res) => {
  const rfdManager = req.app.get('rfdManager');
  const backups = await rfdManager.getBackups();
  res.json({ success: true, backups, count: backups.length });
});

router.post('/backups', async (req, res) => {
  const rfdManager = req.app.get('rfdManager');
  const { type = 'all' } = req.body;
  const backup = await rfdManager.createBackup(type, req.user.id);
  res.json({ success: true, backup });
});

router.post('/backups/:id/restore', async (req, res) => {
  const rfdManager = req.app.get('rfdManager');
  const backupId = parseInt(req.params.id);
  await rfdManager.restoreBackup(backupId, req.user.id);
  res.json({ success: true, message: 'Backup restored' });
});

router.delete('/backups/:id', async (req, res) => {
  const rfdManager = req.app.get('rfdManager');
  const backupId = parseInt(req.params.id);
  await rfdManager.deleteBackup(backupId);
  res.json({ success: true, message: 'Backup deleted' });
});

router.get('/system', async (req, res) => {
  const rfdManager = req.app.get('rfdManager');
  const systemInfo = await rfdManager.getSystemInfo();
  const stats = db.getStats();
  res.json({ success: true, system: systemInfo, stats });
});

module.exports = router;
