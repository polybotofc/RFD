const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/auth').adminOnly;

// GET /api/servers - Get all servers
router.get('/', (req, res) => {
  try {
    const servers = req.app.get('db').getAllServers();
    const serverManager = req.app.get('serverManager');
    
    // Get detailed status for each server
    const serversWithStatus = servers.map(server => {
      return serverManager.getServerStatus(server.id) || server;
    });

    res.json({
      success: true,
      servers: serversWithStatus
    });
  } catch (error) {
    console.error('Error fetching servers:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// GET /api/servers/:id - Get single server
router.get('/:id', (req, res) => {
  try {
    const server = req.app.get('db').getServerById(req.params.id);
    
    if (!server) {
      return res.status(404).json({ 
        success: false, 
        error: 'Server not found' 
      });
    }

    const serverManager = req.app.get('serverManager');
    const detailedServer = serverManager.getServerStatus(server.id);

    res.json({
      success: true,
      server: detailedServer
    });
  } catch (error) {
    console.error('Error fetching server:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// GET /api/servers/game/:gameId - Get servers for a specific game
router.get('/game/:gameId', (req, res) => {
  try {
    const servers = req.app.get('db').getServersByGameId(req.params.gameId);
    const serverManager = req.app.get('serverManager');
    
    const serversWithStatus = servers.map(server => {
      return serverManager.getServerStatus(server.id) || server;
    });

    res.json({
      success: true,
      servers: serversWithStatus
    });
  } catch (error) {
    console.error('Error fetching game servers:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// POST /api/servers - Create new server (admin only)
router.post('/', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { game_id, port } = req.body;

    if (!game_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Game ID is required' 
      });
    }

    // Verify game exists
    const game = req.app.get('db').getGameById(game_id);
    if (!game) {
      return res.status(404).json({ 
        success: false, 
        error: 'Game not found' 
      });
    }

    // Get available port
    const serverManager = req.app.get('serverManager');
    const availablePort = port || serverManager.getAvailablePort(game.default_port || 2000);

    const result = req.app.get('db').createServer({
      game_id,
      port: availablePort
    });

    res.status(201).json({
      success: true,
      server: {
        id: result.id,
        game_id,
        port: availablePort,
        status: 'stopped'
      }
    });
  } catch (error) {
    console.error('Error creating server:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// POST /api/servers/start/:id - Start server (admin only)
router.post('/start/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const serverId = parseInt(req.params.id);
    const server = req.app.get('db').getServerById(serverId);
    
    if (!server) {
      return res.status(404).json({ 
        success: false, 
        error: 'Server not found' 
      });
    }

    if (server.status === 'running') {
      return res.status(400).json({ 
        success: false, 
        error: 'Server is already running' 
      });
    }

    const serverManager = req.app.get('serverManager');
    const result = await serverManager.startServer(serverId, server.game_id);

    if (!result.success) {
      return res.status(500).json({ 
        success: false, 
        error: result.error 
      });
    }

    res.json({
      success: true,
      message: 'Server started successfully',
      pid: result.pid,
      port: result.port
    });
  } catch (error) {
    console.error('Error starting server:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// POST /api/servers/stop/:id - Stop server (admin only)
router.post('/stop/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const serverId = parseInt(req.params.id);
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

    const serverManager = req.app.get('serverManager');
    const result = await serverManager.stopServer(serverId);

    if (!result.success) {
      return res.status(500).json({ 
        success: false, 
        error: result.error 
      });
    }

    res.json({
      success: true,
      message: 'Server stopped successfully'
    });
  } catch (error) {
    console.error('Error stopping server:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// POST /api/servers/restart/:id - Restart server (admin only)
router.post('/restart/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const serverId = parseInt(req.params.id);
    const server = req.app.get('db').getServerById(serverId);
    
    if (!server) {
      return res.status(404).json({ 
        success: false, 
        error: 'Server not found' 
      });
    }

    const serverManager = req.app.get('serverManager');
    const result = await serverManager.restartServer(serverId);

    if (!result.success) {
      return res.status(500).json({ 
        success: false, 
        error: result.error 
      });
    }

    res.json({
      success: true,
      message: 'Server restarted successfully'
    });
  } catch (error) {
    console.error('Error restarting server:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// DELETE /api/servers/:id - Delete server (admin only)
router.delete('/:id', authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const serverId = parseInt(req.params.id);
    const server = req.app.get('db').getServerById(serverId);
    
    if (!server) {
      return res.status(404).json({ 
        success: false, 
        error: 'Server not found' 
      });
    }

    // Stop server if running
    if (server.status === 'running') {
      const serverManager = req.app.get('serverManager');
      await serverManager.stopServer(serverId);
    }

    req.app.get('db').deleteServer(serverId);
    
    res.json({
      success: true,
      message: 'Server deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting server:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

module.exports = router;