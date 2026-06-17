/**
 * Config Routes
 */
const express = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const db = req.app.get('db');
  const config = db.getAllConfig();
  res.json({ success: true, config });
});

router.get('/:key', authenticate, (req, res) => {
  const db = req.app.get('db');
  const value = db.getConfig(req.params.key);
  res.json({ success: true, key: req.params.key, value });
});

router.put('/:key', authenticate, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const { value, type = 'string' } = req.body;
  db.setConfig(req.params.key, value, type);
  res.json({ success: true, message: 'Config updated' });
});

module.exports = router;
