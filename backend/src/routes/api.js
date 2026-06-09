const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth');

// GET /api/join/:serverId - Get server connection info
router.get('/join/:serverId', (req, res) => {
  try {
    const serverId = parseInt(req.params.serverId);
    const server = req.app.get('db').getServerById(serverId);
    
    if (!server) {
      return res.status(404).json({ 
        success: false, 
        error: 'Server not found' 
      });
    }

    if (server.status !== 'running') {
      return res.status(400).json({ 
        success: false, 
        error: 'Server is not running' 
      });
    }

    // Get host from environment or use localhost
    const host = process.env.SERVER_HOST || '127.0.0.1';

    res.json({
      success: true,
      host,
      port: server.port,
      protocol: 'rfd'
    });
  } catch (error) {
    console.error('Error joining server:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// GET /api/server-status/:serverId - Get detailed server status
router.get('/server-status/:serverId', (req, res) => {
  try {
    const serverId = parseInt(req.params.serverId);
    const serverManager = req.app.get('serverManager');
    const status = serverManager.getServerStatus(serverId);
    
    if (!status) {
      return res.status(404).json({ 
        success: false, 
        error: 'Server not found' 
      });
    }

    res.json({
      success: true,
      status
    });
  } catch (error) {
    console.error('Error fetching server status:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// POST /api/player-update - Update player count (internal)
router.post('/player-update', authMiddleware, (req, res) => {
  try {
    const { serverId, action, player } = req.body;
    
    if (!serverId || !action) {
      return res.status(400).json({ 
        success: false, 
        error: 'Server ID and action are required' 
      });
    }

    const serverManager = req.app.get('serverManager');
    serverManager.updatePlayerCount(serverId, action, player);

    res.json({
      success: true
    });
  } catch (error) {
    console.error('Error updating player:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// GET /api/stats - Get platform statistics
router.get('/stats', (req, res) => {
  try {
    const db = req.app.get('db');
    
    const games = db.getAllGames();
    const servers = db.getAllServers();
    const users = db.getAllUsers();
    
    const runningServers = servers.filter(s => s.status === 'running');
    
    // Calculate total players
    let totalPlayers = 0;
    runningServers.forEach(server => {
      try {
        const players = JSON.parse(server.players || '[]');
        totalPlayers += players.length;
      } catch (e) {}
    });

    res.json({
      success: true,
      stats: {
        totalGames: games.length,
        totalServers: servers.length,
        runningServers: runningServers.length,
        totalUsers: users.length,
        totalPlayers
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// GET /api/logs/:serverId - Get server logs
router.get('/logs/:serverId', (req, res) => {
  try {
    const serverId = parseInt(req.params.serverId);
    const limit = parseInt(req.query.limit) || 100;
    
    const logs = req.app.get('db').getLogs(serverId, limit);
    
    res.json({
      success: true,
      logs
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

module.exports = router;