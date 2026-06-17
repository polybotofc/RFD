/**
 * Games Routes
 * 
 * Handles game/place management and GameConfig operations.
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticate, requireAdmin, sanitizeInput, getClientIP } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.rbxl', '.rbxlx'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .rbxl and .rbxlx files are allowed'));
    }
  }
});

/**
 * GET /api/games
 * Get all games
 */
router.get('/', authenticate, (req, res) => {
  const db = req.app.get('db');
  const { genre, search, featured } = req.query;
  
  let games = db.getGames(true);
  
  if (genre) {
    games = games.filter(g => g.genre === genre);
  }
  
  if (featured === 'true') {
    games = games.filter(g => g.isFeatured);
  }
  
  if (search) {
    games = games.filter(g => 
      g.name.toLowerCase().includes(search.toLowerCase())
    );
  }
  
  // Get server counts for each game
  const servers = db.getServers();
  games = games.map(game => {
    const gameServers = servers.filter(s => s.gameId === game.id);
    return {
      ...game,
      runningServers: gameServers.filter(s => s.status === 'running').length,
      totalServers: gameServers.length,
      currentPlayers: gameServers.reduce((sum, s) => sum + (s.currentPlayers || 0), 0)
    };
  });
  
  res.json({
    success: true,
    games,
    count: games.length
  });
});

/**
 * GET /api/games/:id
 * Get game details
 */
router.get('/:id', authenticate, (req, res) => {
  const db = req.app.get('db');
  const gameId = parseInt(req.params.id);
  
  const game = db.getGameById(gameId);
  if (!game) {
    return res.status(404).json({
      success: false,
      error: 'Game not found',
      code: 'GAME_NOT_FOUND'
    });
  }
  
  // Get servers for this game
  const servers = db.getServers().filter(s => s.gameId === gameId);
  
  res.json({
    success: true,
    game: {
      ...game,
      servers,
      runningServers: servers.filter(s => s.status === 'running').length,
      currentPlayers: servers.reduce((sum, s) => sum + (s.currentPlayers || 0), 0)
    }
  });
});

/**
 * POST /api/games
 * Create new game
 */
router.post('/', authenticate, requireAdmin, sanitizeInput, (req, res) => {
  const db = req.app.get('db');
  const { name, description, creator, genre, subgenre, icon, banner } = req.body;
  
  if (!name) {
    return res.status(400).json({
      success: false,
      error: 'Game name is required',
      code: 'NAME_REQUIRED'
    });
  }
  
  const gameId = db.createGame({
    name,
    description,
    creator,
    genre: genre || 'Adventure',
    subgenre: subgenre || 'RPG',
    icon,
    banner
  });
  
  db.createAuditLog(
    req.user.id,
    'game_create',
    `Created game: ${name}`,
    getClientIP(req),
    'game',
    gameId
  );
  
  const game = db.getGameById(gameId);
  
  res.status(201).json({
    success: true,
    game
  });
});

/**
 * PUT /api/games/:id
 * Update game
 */
router.put('/:id', authenticate, requireAdmin, sanitizeInput, (req, res) => {
  const db = req.app.get('db');
  const gameId = parseInt(req.params.id);
  
  const game = db.getGameById(gameId);
  if (!game) {
    return res.status(404).json({
      success: false,
      error: 'Game not found',
      code: 'GAME_NOT_FOUND'
    });
  }
  
  const { name, description, creator, genre, subgenre, icon, banner, placeFile, version, isPublic, isFeatured, maxPlayers } = req.body;
  
  db.updateGame(gameId, {
    name,
    description,
    creator,
    genre,
    subgenre,
    icon,
    banner,
    placeFile,
    version,
    isPublic: isPublic !== undefined ? (isPublic ? 1 : 0) : undefined,
    isFeatured: isFeatured !== undefined ? (isFeatured ? 1 : 0) : undefined,
    maxPlayers
  });
  
  db.createAuditLog(
    req.user.id,
    'game_update',
    `Updated game: ${name || game.name}`,
    getClientIP(req),
    'game',
    gameId
  );
  
  const updatedGame = db.getGameById(gameId);
  
  res.json({
    success: true,
    game: updatedGame
  });
});

/**
 * DELETE /api/games/:id
 * Delete game
 */
router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const gameId = parseInt(req.params.id);
  
  const game = db.getGameById(gameId);
  if (!game) {
    return res.status(404).json({
      success: false,
      error: 'Game not found',
      code: 'GAME_NOT_FOUND'
    });
  }
  
  db.deleteGame(gameId);
  
  db.createAuditLog(
    req.user.id,
    'game_delete',
    `Deleted game: ${game.name}`,
    getClientIP(req),
    'game',
    gameId
  );
  
  res.json({
    success: true,
    message: 'Game deleted'
  });
});

/**
 * POST /api/games/:id/upload
 * Upload place file
 */
router.post('/:id/upload', authenticate, requireAdmin, upload.single('place'), async (req, res) => {
  const db = req.app.get('db');
  const gameId = parseInt(req.params.id);
  
  const game = db.getGameById(gameId);
  if (!game) {
    return res.status(404).json({
      success: false,
      error: 'Game not found',
      code: 'GAME_NOT_FOUND'
    });
  }
  
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded',
      code: 'NO_FILE'
    });
  }
  
  try {
    const rfdManager = req.app.get('rfdManager');
    const { filename, path: filepath } = await rfdManager.uploadPlace(req.file, gameId);
    
    // Update game with place file
    db.updateGame(gameId, { placeFile: filepath });
    
    db.createAuditLog(
      req.user.id,
      'place_upload',
      `Uploaded place for ${game.name}`,
      getClientIP(req),
      'game',
      gameId
    );
    
    res.json({
      success: true,
      message: 'Place uploaded',
      filename,
      path: filepath
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'UPLOAD_FAILED'
    });
  }
});

/**
 * GET /api/games/:id/config
 * Get GameConfig
 */
router.get('/:id/config', authenticate, requireAdmin, async (req, res) => {
  const db = req.app.get('db');
  const gameId = parseInt(req.params.id);
  
  const game = db.getGameById(gameId);
  if (!game) {
    return res.status(404).json({
      success: false,
      error: 'Game not found',
      code: 'GAME_NOT_FOUND'
    });
  }
  
  // Get server with this game to find GameConfig
  const servers = db.getServers().filter(s => s.gameId === gameId);
  if (servers.length === 0) {
    return res.json({
      success: true,
      config: {},
      message: 'No servers configured for this game'
    });
  }
  
  try {
    const rfdManager = req.app.get('rfdManager');
    const config = await rfdManager.getGameConfig(servers[0].id);
    
    res.json({
      success: true,
      config
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'CONFIG_READ_ERROR'
    });
  }
});

/**
 * PUT /api/games/:id/config
 * Update GameConfig
 */
router.put('/:id/config', authenticate, requireAdmin, sanitizeInput, async (req, res) => {
  const db = req.app.get('db');
  const gameId = parseInt(req.params.id);
  
  const game = db.getGameById(gameId);
  if (!game) {
    return res.status(404).json({
      success: false,
      error: 'Game not found',
      code: 'GAME_NOT_FOUND'
    });
  }
  
  const { config } = req.body;
  if (!config || typeof config !== 'object') {
    return res.status(400).json({
      success: false,
      error: 'Invalid config object',
      code: 'INVALID_CONFIG'
    });
  }
  
  // Get server with this game
  const servers = db.getServers().filter(s => s.gameId === gameId);
  if (servers.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No servers configured for this game',
      code: 'NO_SERVER'
    });
  }
  
  try {
    const rfdManager = req.app.get('rfdManager');
    await rfdManager.updateGameConfig(servers[0].id, config);
    
    db.createAuditLog(
      req.user.id,
      'gameconfig_update',
      `Updated GameConfig for ${game.name}`,
      getClientIP(req),
      'game',
      gameId
    );
    
    res.json({
      success: true,
      message: 'GameConfig updated'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      code: 'CONFIG_WRITE_ERROR'
    });
  }
});

/**
 * GET /api/games/genres
 * Get available genres
 */
router.get('/meta/genres', (req, res) => {
  const genres = [
    { id: 'adventure', name: 'Adventure', icon: '🗺️' },
    { id: 'rpg', name: 'RPG', icon: '⚔️' },
    { id: 'simulation', name: 'Simulation', icon: '🎯' },
    { id: 'fps', name: 'FPS', icon: '🔫' },
    { id: 'tps', name: 'TPS', icon: '🎮' },
    { id: 'puzzle', name: 'Puzzle', icon: '🧩' },
    { id: 'racing', name: 'Racing', icon: '🏎️' },
    { id: 'sports', name: 'Sports', icon: '⚽' },
    { id: 'mmo', name: 'MMO', icon: '🌍' },
    { id: 'sandbox', name: 'Sandbox', icon: '🏗️' },
    { id: 'social', name: 'Social', icon: '👥' },
    { id: 'horror', name: 'Horror', icon: '👻' }
  ];
  
  res.json({
    success: true,
    genres
  });
});

module.exports = router;