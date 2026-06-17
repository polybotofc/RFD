/**
 * Stats Routes
 */
const express = require('express');
const { authenticate } = require('../middleware/auth');
const router = express.Router();

router.use(authenticate);

router.get('/', (req, res) => {
  const db = req.app.get('db');
  const stats = db.getStats();
  res.json({ success: true, stats });
});

router.get('/players', (req, res) => {
  const db = req.app.get('db');
  const players = db.getOnlinePlayers();
  res.json({ success: true, players, count: players.length });
});

router.get('/servers', (req, res) => {
  const db = req.app.get('db');
  const servers = db.getServers();
  res.json({ success: true, servers, count: servers.length });
});

router.get('/resources', async (req, res) => {
  const rfdManager = req.app.get('rfdManager');
  const usage = await rfdManager.getResourceUsage();
  res.json({ success: true, resources: usage });
});

router.get('/history', (req, res) => {
  const db = req.app.get('db');
  const { hours = 24 } = req.query;
  const history = db.getHistoricalStats(parseInt(hours));
  res.json({ success: true, history });
});

module.exports = router;
