/**
 * Assets Routes
 */
const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

router.get('/', authenticate, async (req, res) => {
  const rfdManager = req.app.get('rfdManager');
  const { type, search } = req.query;
  const assets = await rfdManager.getCachedAssets({ type, search });
  res.json({ success: true, assets, count: assets.length });
});

router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  const rfdManager = req.app.get('rfdManager');
  const assetPath = decodeURIComponent(req.params.id);
  await rfdManager.deleteAsset(assetPath);
  res.json({ success: true, message: 'Asset deleted' });
});

router.post('/clear', authenticate, requireAdmin, async (req, res) => {
  const rfdManager = req.app.get('rfdManager');
  const deleted = await rfdManager.clearAssetCache();
  res.json({ success: true, message: `Cleared ${deleted} assets` });
});

module.exports = router;
