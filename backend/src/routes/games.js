const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

const authMiddleware = require('../middleware/auth');
const adminMiddleware = require('../middleware/auth').adminOnly;

// Configure multer for file uploads - use local directories
const gamesDir = path.join(__dirname, '../../../uploads/games');
const thumbnailsDir = path.join(__dirname, '../../../uploads/thumbnails');

// Ensure directories exist
[gamesDir, thumbnailsDir].forEach(dir => {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (err) {
    console.warn(`Warning: Could not create ${dir}:`, err.message);
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.gif' || ext === '.webp') {
      cb(null, thumbnailsDir);
    } else {
      cb(null, gamesDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.rbxl', '.rbxlx', '.png', '.jpg', '.jpeg', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// GET /api/games - Get all games
router.get('/', (req, res) => {
  try {
    const games = req.app.get('db').getAllGames();
    
    // Add server count for each game
    const gamesWithServers = games.map(game => {
      const servers = req.app.get('db').getServersByGameId(game.id);
      const runningServers = servers.filter(s => s.status === 'running');
      return {
        ...game,
        serverCount: servers.length,
        runningServers: runningServers.length
      };
    });

    res.json({
      success: true,
      games: gamesWithServers
    });
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// GET /api/games/:id - Get single game
router.get('/:id', (req, res) => {
  try {
    const game = req.app.get('db').getGameById(req.params.id);
    
    if (!game) {
      return res.status(404).json({ 
        success: false, 
        error: 'Game not found' 
      });
    }

    // Get servers for this game
    const servers = req.app.get('db').getServersByGameId(game.id);
    
    res.json({
      success: true,
      game: {
        ...game,
        servers
      }
    });
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// POST /api/games - Create new game (admin only)
router.post('/', authMiddleware, adminMiddleware, upload.fields([
  { name: 'game', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]), (req, res) => {
  try {
    const { title, description, creator, default_port } = req.body;

    if (!title) {
      return res.status(400).json({ 
        success: false, 
        error: 'Title is required' 
      });
    }

    let rbxlPath = '';
    let thumbnail = '';

    // Handle game file upload
    if (req.files?.game?.[0]) {
      rbxlPath = req.files.game[0].path;
    }

    // Handle thumbnail upload
    if (req.files?.thumbnail?.[0]) {
      thumbnail = `/uploads/thumbnails/${req.files.thumbnail[0].filename}`;
    }

    const game = req.app.get('db').createGame({
      title,
      description: description || '',
      creator: creator || req.user.username,
      rbxl_path: rbxlPath,
      thumbnail,
      default_port: parseInt(default_port) || 2000
    });

    res.status(201).json({
      success: true,
      game: {
        id: game.id,
        title,
        description,
        creator,
        rbxl_path: rbxlPath,
        thumbnail,
        default_port: default_port || 2000
      }
    });
  } catch (error) {
    console.error('Error creating game:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// PUT /api/games/:id - Update game (admin only)
router.put('/:id', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const gameId = req.params.id;
    const existingGame = req.app.get('db').getGameById(gameId);
    
    if (!existingGame) {
      return res.status(404).json({ 
        success: false, 
        error: 'Game not found' 
      });
    }

    const { title, description, creator, default_port } = req.body;
    
    const updates = {};
    if (title) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (creator) updates.creator = creator;
    if (default_port) updates.default_port = parseInt(default_port);

    req.app.get('db').updateGame(gameId, updates);

    const updatedGame = req.app.get('db').getGameById(gameId);
    
    res.json({
      success: true,
      game: updatedGame
    });
  } catch (error) {
    console.error('Error updating game:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

// DELETE /api/games/:id - Delete game (admin only)
router.delete('/:id', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const gameId = req.params.id;
    const game = req.app.get('db').getGameById(gameId);
    
    if (!game) {
      return res.status(404).json({ 
        success: false, 
        error: 'Game not found' 
      });
    }

    // Delete associated files
    if (game.rbxl_path && fs.existsSync(game.rbxl_path)) {
      fs.unlinkSync(game.rbxl_path);
    }

    // Delete associated servers
    const servers = req.app.get('db').getServersByGameId(gameId);
    servers.forEach(server => {
      req.app.get('serverManager').stopServer(server.id);
      req.app.get('db').deleteServer(server.id);
    });

    req.app.get('db').deleteGame(gameId);
    
    res.json({
      success: true,
      message: 'Game deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting game:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
});

module.exports = router;