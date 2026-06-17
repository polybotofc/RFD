/**
 * Database Service
 * 
 * SQLite-based database service for RFD Platform.
 * Handles all database operations with proper migrations.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

class DatabaseService {
  constructor() {
    this.db = null;
    this.dbPath = path.join(__dirname, '../../../database/rfd.db');
    this.migrations = [];
  }

  /**
   * Initialize the database
   */
  initialize() {
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    
    this.createTables();
    this.runMigrations();
    this.seedData();
    
    console.log('Database initialized at:', this.dbPath);
    return this;
  }

  /**
   * Create all database tables
   */
  createTables() {
    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT UNIQUE,
        userCode TEXT UNIQUE NOT NULL,
        role TEXT DEFAULT 'user',
        avatar TEXT,
        avatarThumbnail TEXT,
        description TEXT,
        membership TEXT DEFAULT 'none',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        lastLogin DATETIME,
        isOnline INTEGER DEFAULT 0,
        isBanned INTEGER DEFAULT 0,
        banReason TEXT,
        friendsCount INTEGER DEFAULT 0,
        followersCount INTEGER DEFAULT 0,
        followingCount INTEGER DEFAULT 0,
        preferences TEXT DEFAULT '{}'
      )
    `);

    // Servers table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS servers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        gameId INTEGER,
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        maxPlayers INTEGER DEFAULT 100,
        currentPlayers INTEGER DEFAULT 0,
        version TEXT DEFAULT '1.0.0',
        status TEXT DEFAULT 'offline',
        placeFile TEXT,
        rfdPath TEXT,
        gameConfigPath TEXT,
        ping INTEGER DEFAULT 0,
        map TEXT DEFAULT 'Unknown',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        startedAt DATETIME,
        stoppedAt DATETIME,
        pid INTEGER,
        FOREIGN KEY (gameId) REFERENCES games(id) ON DELETE SET NULL
      )
    `);

    // Games table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        creator TEXT,
        icon TEXT,
        banner TEXT,
        version TEXT DEFAULT '1.0.0',
        placeFile TEXT,
        gameConfig TEXT,
        visits INTEGER DEFAULT 0,
        playing INTEGER DEFAULT 0,
        favorites INTEGER DEFAULT 0,
        maxPlayers INTEGER DEFAULT 100,
        genre TEXT DEFAULT 'Adventure',
        subgenre TEXT DEFAULT 'RPG',
        isPublic INTEGER DEFAULT 1,
        isFeatured INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME
      )
    `);

    // Players (online session tracking)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        odId INTEGER UNIQUE,
        odusername TEXT NOT NULL,
        userCode TEXT NOT NULL,
        userId INTEGER,
        serverId INTEGER,
        ipAddress TEXT,
        joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        leftAt DATETIME,
        lastActivity DATETIME,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (serverId) REFERENCES servers(id) ON DELETE SET NULL
      )
    `);

    // Friends table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS friends (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        friendId INTEGER NOT NULL,
        status TEXT DEFAULT 'pending',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (friendId) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(userId, friendId)
      )
    `);

    // Messages table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        senderId INTEGER NOT NULL,
        receiverId INTEGER NOT NULL,
        content TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        isRead INTEGER DEFAULT 0,
        isDeleted INTEGER DEFAULT 0,
        FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (receiverId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Avatars table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS avatars (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER UNIQUE,
        rigType TEXT DEFAULT 'R15',
        bodyColors TEXT DEFAULT '{"headColor3": 194, "torsoColor3": 194, "leftArmColor3": 194, "rightArmColor3": 194, "leftLegColor3": 194, "rightLegColor3": 194}',
        assets TEXT DEFAULT '[]',
        animations TEXT DEFAULT '[]',
        cachedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Roblox clients table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS roblox_clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        clientVersion TEXT NOT NULL,
        clientPath TEXT,
        launchArguments TEXT,
        isDefault INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Assets table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assetId INTEGER UNIQUE NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        path TEXT,
        url TEXT,
        size INTEGER DEFAULT 0,
        mimeType TEXT,
        thumbnail TEXT,
        metadata TEXT DEFAULT '{}',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        cachedAt DATETIME
      )
    `);

    // Audit logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER,
        action TEXT NOT NULL,
        targetType TEXT,
        targetId INTEGER,
        details TEXT,
        ipAddress TEXT,
        userAgent TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Config table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT,
        type TEXT DEFAULT 'string',
        category TEXT DEFAULT 'general',
        description TEXT,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        refreshToken TEXT,
        expiresAt DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        ipAddress TEXT,
        userAgent TEXT,
        rememberMe INTEGER DEFAULT 0,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Join history table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS join_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER,
        serverId INTEGER,
        userCode TEXT,
        joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (serverId) REFERENCES servers(id) ON DELETE SET NULL
      )
    `);

    // Backups table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS backups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        path TEXT NOT NULL,
        size INTEGER DEFAULT 0,
        createdBy INTEGER,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Announcements table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        authorId INTEGER,
        priority TEXT DEFAULT 'normal',
        isActive INTEGER DEFAULT 1,
        expiresAt DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (authorId) REFERENCES users(id) ON DELETE SET NULL
      )
    `);

    // Notifications table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        data TEXT DEFAULT '{}',
        isRead INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Activity feed table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS activity_feed (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER NOT NULL,
        type TEXT NOT NULL,
        targetType TEXT,
        targetId INTEGER,
        metadata TEXT DEFAULT '{}',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create indexes
    this.createIndexes();
  }

  /**
   * Create database indexes for better performance
   */
  createIndexes() {
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_isBanned ON users(isBanned);
      
      CREATE INDEX IF NOT EXISTS idx_servers_status ON servers(status);
      CREATE INDEX IF NOT EXISTS idx_servers_gameId ON servers(gameId);
      
      CREATE INDEX IF NOT EXISTS idx_players_userId ON players(userId);
      CREATE INDEX IF NOT EXISTS idx_players_serverId ON players(serverId);
      CREATE INDEX IF NOT EXISTS idx_players_userCode ON players(userCode);
      
      CREATE INDEX IF NOT EXISTS idx_friends_userId ON friends(userId);
      CREATE INDEX IF NOT EXISTS idx_friends_friendId ON friends(friendId);
      CREATE INDEX IF NOT EXISTS idx_friends_status ON friends(status);
      
      CREATE INDEX IF NOT EXISTS idx_messages_senderId ON messages(senderId);
      CREATE INDEX IF NOT EXISTS idx_messages_receiverId ON messages(receiverId);
      CREATE INDEX IF NOT EXISTS idx_messages_createdAt ON messages(createdAt);
      
      CREATE INDEX IF NOT EXISTS idx_notifications_userId ON notifications(userId);
      CREATE INDEX IF NOT EXISTS idx_notifications_isRead ON notifications(isRead);
      
      CREATE INDEX IF NOT EXISTS idx_audit_logs_userId ON audit_logs(userId);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_createdAt ON audit_logs(createdAt);
    `);
  }

  /**
   * Run database migrations
   */
  runMigrations() {
    // Track schema version
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        appliedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const currentVersion = this.db.prepare('SELECT MAX(version) as v FROM schema_migrations').get()?.v || 0;
    
    const migrations = [
      // Add new tables/columns here for future migrations
      // Example:
      // `ALTER TABLE users ADD COLUMN newColumn TEXT DEFAULT 'default'`
    ];

    for (let i = currentVersion + 1; i <= migrations.length; i++) {
      if (migrations[i - 1]) {
        try {
          this.db.exec(migrations[i - 1]);
        } catch (error) {
          console.error(`Migration ${i} failed:`, error.message);
        }
        this.db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(i);
      }
    }
  }

  /**
   * Seed initial data
   */
  seedData() {
    // Create default admin
    const adminExists = this.db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
    if (!adminExists) {
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      this.db.prepare(`
        INSERT INTO users (username, password, userCode, role, membership, description)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('admin', hashedPassword, 'U00001', 'admin', 'premium', 'Server Administrator');
      console.log('Default admin created: admin / admin123');
    }

    // Create default test user
    const testExists = this.db.prepare('SELECT id FROM users WHERE username = ?').get('testuser');
    if (!testExists) {
      const hashedPassword = bcrypt.hashSync('test123', 10);
      this.db.prepare(`
        INSERT INTO users (username, password, userCode, role, description)
        VALUES (?, ?, ?, ?, ?)
      `).run('testuser', hashedPassword, 'U00002', 'user', 'Welcome to RFD Platform!');
    }

    // Create default Roblox clients
    const clientExists = this.db.prepare('SELECT id FROM roblox_clients WHERE name = ?').get('Roblox 2021');
    if (!clientExists) {
      const clients = [
        ['Roblox 2024', '0.620.0.5670202', '--gc 1', 1],
        ['Roblox 2023', '0.550.0.5230210', '--gc 1', 0],
        ['Roblox 2022', '0.500.0.4850214', '--gc 1', 0],
        ['Roblox 2021', '0.485.0.452074', '--gc 1', 0]
      ];
      const stmt = this.db.prepare(`
        INSERT INTO roblox_clients (name, clientVersion, launchArguments, isDefault)
        VALUES (?, ?, ?, ?)
      `);
      for (const [name, version, args, isDefault] of clients) {
        stmt.run(name, version, args, isDefault);
      }
    }

    // Create default config
    const configs = [
      ['serverName', 'RFD Platform', 'string', 'general', 'Server display name'],
      ['maxPlayers', '100', 'number', 'server', 'Maximum players per server'],
      ['port', '53640', 'number', 'server', 'Default server port'],
      ['rfdPath', '', 'string', 'paths', 'RFD installation path'],
      ['gameConfigPath', '', 'string', 'paths', 'GameConfig directory path'],
      ['assetCachePath', '', 'string', 'paths', 'Asset cache directory path'],
      ['sqlitePath', '', 'string', 'paths', 'SQLite database path'],
      ['playerPath', '', 'string', 'paths', 'Player executable path'],
      ['studioPath', '', 'string', 'paths', 'Studio executable path'],
      ['autoStart', 'false', 'boolean', 'server', 'Auto-start server on launch'],
      ['autoScan', 'true', 'boolean', 'server', 'Auto-detect RFD installation'],
      ['maintenanceMode', 'false', 'boolean', 'system', 'Enable maintenance mode'],
      ['registrationEnabled', 'true', 'boolean', 'system', 'Allow new user registration'],
      ['discordWebhook', '', 'string', 'discord', 'Discord webhook URL'],
      ['discordBotToken', '', 'string', 'discord', 'Discord bot token'],
      ['theme', 'dark', 'string', 'appearance', 'Default theme (dark/light)'],
      ['accentColor', '#E2231A', 'string', 'appearance', 'Accent color'],
      ['language', 'en', 'string', 'appearance', 'Default language'],
      ['logLevel', 'info', 'string', 'system', 'Logging level'],
      ['backupRetentionDays', '30', 'number', 'backup', 'Days to keep backups']
    ];

    const insertConfig = this.db.prepare(`
      INSERT OR IGNORE INTO config (key, value, type, category, description) 
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const [key, value, type, category, description] of configs) {
      insertConfig.run(key, value, type, category, description);
    }

    // Create sample game
    const gameExists = this.db.prepare('SELECT id FROM games WHERE name = ?').get('Sample Game');
    if (!gameExists) {
      this.db.prepare(`
        INSERT INTO games (name, description, creator, genre, subgenre, isFeatured)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('Sample Game', 'A sample game for testing RFD Platform', 'RFD Admin', 'Adventure', 'RPG', 1);
    }

    // Create sample announcement
    const announcementExists = this.db.prepare('SELECT id FROM announcements WHERE title = ?').get('Welcome to RFD Platform');
    if (!announcementExists) {
      this.db.prepare(`
        INSERT INTO announcements (title, content, priority, isActive)
        VALUES (?, ?, ?, ?)
      `).run(
        'Welcome to RFD Platform',
        'Welcome to the RFD Platform! This is your control center for managing Roblox Freedom Distribution servers. Get started by exploring the dashboard and server browser.',
        'normal',
        1
      );
    }
  }

  // ==================== User Methods ====================

  /**
   * Create a new user
   */
  createUser({ username, password, email, userCode, role = 'user', description = '' }) {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const stmt = this.db.prepare(`
      INSERT INTO users (username, password, email, userCode, role, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(username, hashedPassword, email || null, userCode, role, description);
    return result.lastInsertRowid;
  }

  /**
   * Get user by username
   */
  getUserByUsername(username) {
    return this.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  }

  /**
   * Get user by ID
   */
  getUserById(id) {
    return this.db.prepare(`
      SELECT id, username, userCode, role, email, avatar, avatarThumbnail, description, 
             membership, createdAt, lastLogin, isOnline, isBanned, friendsCount, 
             followersCount, followingCount, preferences
      FROM users WHERE id = ?
    `).get(id);
  }

  /**
   * Get user by userCode
   */
  getUserByUserCode(userCode) {
    return this.db.prepare('SELECT * FROM users WHERE userCode = ?').get(userCode);
  }

  /**
   * Get user by email
   */
  getUserByEmail(email) {
    return this.db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  }

  /**
   * Get all users
   */
  getAllUsers(includeBanned = false) {
    if (includeBanned) {
      return this.db.prepare('SELECT * FROM users ORDER BY createdAt DESC').all();
    }
    return this.db.prepare('SELECT * FROM users WHERE isBanned = 0 ORDER BY createdAt DESC').all();
  }

  /**
   * Update user
   */
  updateUser(id, updates) {
    const allowedFields = ['username', 'email', 'avatar', 'avatarThumbnail', 'description', 'preferences'];
    const fields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(typeof value === 'object' ? JSON.stringify(value) : value);
      }
    }
    
    if (fields.length === 0) return false;
    
    values.push(id);
    this.db.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return true;
  }

  /**
   * Update last login
   */
  updateLastLogin(userId) {
    this.db.prepare('UPDATE users SET lastLogin = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
  }

  /**
   * Set user online status
   */
  setUserOnline(userId, isOnline) {
    this.db.prepare('UPDATE users SET isOnline = ? WHERE id = ?').run(isOnline ? 1 : 0, userId);
  }

  /**
   * Ban user
   */
  banUser(userId, reason = '') {
    this.db.prepare('UPDATE users SET isBanned = 1, banReason = ? WHERE id = ?').run(reason, userId);
  }

  /**
   * Unban user
   */
  unbanUser(userId) {
    this.db.prepare('UPDATE users SET isBanned = 0, banReason = NULL WHERE id = ?').run(userId);
  }

  /**
   * Change user role
   */
  changeUserRole(userId, role) {
    this.db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
  }

  /**
   * Generate unique user code
   */
  generateUserCode() {
    const code = 'U' + Math.random().toString(36).substring(2, 7).toUpperCase();
    const exists = this.db.prepare('SELECT id FROM users WHERE userCode = ?').get(code);
    return exists ? this.generateUserCode() : code;
  }

  /**
   * Search users
   */
  searchUsers(query, limit = 20) {
    const pattern = `%${query}%`;
    return this.db.prepare(`
      SELECT id, username, userCode, avatarThumbnail, membership, isOnline
      FROM users 
      WHERE username LIKE ? AND isBanned = 0
      LIMIT ?
    `).all(pattern, limit);
  }

  // ==================== Server Methods ====================

  /**
   * Create server
   */
  createServer(server) {
    const stmt = this.db.prepare(`
      INSERT INTO servers (name, gameId, host, port, maxPlayers, placeFile, rfdPath, gameConfigPath, version, map)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      server.name,
      server.gameId || null,
      server.host,
      server.port,
      server.maxPlayers || 100,
      server.placeFile || '',
      server.rfdPath || '',
      server.gameConfigPath || '',
      server.version || '1.0.0',
      server.map || 'Unknown'
    );
    return result.lastInsertRowid;
  }

  /**
   * Get all servers
   */
  getServers(status = null) {
    if (status) {
      return this.db.prepare('SELECT * FROM servers WHERE status = ? ORDER BY id DESC').all(status);
    }
    return this.db.prepare('SELECT * FROM servers ORDER BY id DESC').all();
  }

  /**
   * Get server by ID
   */
  getServerById(id) {
    return this.db.prepare(`
      SELECT s.*, g.name as gameName, g.icon as gameIcon
      FROM servers s
      LEFT JOIN games g ON s.gameId = g.id
      WHERE s.id = ?
    `).get(id);
  }

  /**
   * Get server by port
   */
  getServerByPort(port) {
    return this.db.prepare('SELECT * FROM servers WHERE port = ?').get(port);
  }

  /**
   * Update server
   */
  updateServer(id, updates) {
    const allowedFields = ['name', 'gameId', 'host', 'port', 'maxPlayers', 'placeFile', 'version', 'map'];
    const fields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    
    if (fields.length === 0) return false;
    
    values.push(id);
    this.db.prepare(`UPDATE servers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return true;
  }

  /**
   * Update server status
   */
  updateServerStatus(id, status, pid = null) {
    if (status === 'running') {
      this.db.prepare('UPDATE servers SET status = ?, pid = ?, startedAt = CURRENT_TIMESTAMP, stoppedAt = NULL WHERE id = ?')
        .run(status, pid, id);
    } else if (status === 'offline') {
      this.db.prepare('UPDATE servers SET status = ?, pid = NULL, stoppedAt = CURRENT_TIMESTAMP WHERE id = ?')
        .run(status, id);
    } else {
      this.db.prepare('UPDATE servers SET status = ? WHERE id = ?').run(status, id);
    }
  }

  /**
   * Update server player count
   */
  updateServerPlayerCount(id, count) {
    this.db.prepare('UPDATE servers SET currentPlayers = ? WHERE id = ?').run(count, id);
  }

  /**
   * Delete server
   */
  deleteServer(id) {
    this.db.prepare('DELETE FROM servers WHERE id = ?').run(id);
  }

  /**
   * Search servers
   */
  searchServers(query, filters = {}) {
    let sql = `
      SELECT s.*, g.name as gameName
      FROM servers s
      LEFT JOIN games g ON s.gameId = g.id
      WHERE 1=1
    `;
    const params = [];
    
    if (query) {
      sql += ' AND (s.name LIKE ? OR g.name LIKE ?)';
      const pattern = `%${query}%`;
      params.push(pattern, pattern);
    }
    
    if (filters.status) {
      sql += ' AND s.status = ?';
      params.push(filters.status);
    }
    
    if (filters.minPlayers !== undefined) {
      sql += ' AND s.currentPlayers >= ?';
      params.push(filters.minPlayers);
    }
    
    if (filters.maxPlayers !== undefined) {
      sql += ' AND s.currentPlayers <= ?';
      params.push(filters.maxPlayers);
    }
    
    sql += ' ORDER BY s.status DESC, s.currentPlayers DESC';
    
    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }
    
    return this.db.prepare(sql).all(...params);
  }

  // ==================== Game Methods ====================

  /**
   * Create game
   */
  createGame(game) {
    const stmt = this.db.prepare(`
      INSERT INTO games (name, description, creator, icon, banner, version, placeFile, genre, subgenre)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      game.name,
      game.description || '',
      game.creator || '',
      game.icon || '',
      game.banner || '',
      game.version || '1.0.0',
      game.placeFile || '',
      game.genre || 'Adventure',
      game.subgenre || 'RPG'
    );
    return result.lastInsertRowid;
  }

  /**
   * Get all games
   */
  getGames(includePrivate = false) {
    if (includePrivate) {
      return this.db.prepare('SELECT * FROM games ORDER BY updatedAt DESC, createdAt DESC').all();
    }
    return this.db.prepare('SELECT * FROM games WHERE isPublic = 1 ORDER BY updatedAt DESC, createdAt DESC').all();
  }

  /**
   * Get game by ID
   */
  getGameById(id) {
    return this.db.prepare('SELECT * FROM games WHERE id = ?').get(id);
  }

  /**
   * Update game
   */
  updateGame(id, updates) {
    const fields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (key !== 'id') {
        fields.push(`${key} = ?`);
        values.push(typeof value === 'object' ? JSON.stringify(value) : value);
      }
    }
    
    fields.push('updatedAt = CURRENT_TIMESTAMP');
    values.push(id);
    
    this.db.prepare(`UPDATE games SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    return true;
  }

  /**
   * Delete game
   */
  deleteGame(id) {
    this.db.prepare('DELETE FROM games WHERE id = ?').run(id);
  }

  /**
   * Increment game visits
   */
  incrementGameVisits(id) {
    this.db.prepare('UPDATE games SET visits = visits + 1 WHERE id = ?').run(id);
  }

  /**
   * Search games
   */
  searchGames(query, filters = {}) {
    let sql = 'SELECT * FROM games WHERE isPublic = 1 AND name LIKE ?';
    const params = [`%${query}%`];
    
    if (filters.genre) {
      sql += ' AND genre = ?';
      params.push(filters.genre);
    }
    
    sql += ' ORDER BY favorites DESC, visits DESC';
    
    return this.db.prepare(sql).all(...params);
  }

  // ==================== Player Methods ====================

  /**
   * Add online player
   */
  addOnlinePlayer({ odId, odusername, userCode, userId, serverId, ipAddress }) {
    // Remove existing entry if any
    this.db.prepare('DELETE FROM players WHERE odId = ?').run(odId);
    
    const stmt = this.db.prepare(`
      INSERT INTO players (odId, odusername, userCode, userId, serverId, ipAddress, lastActivity)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    return stmt.run(odId, odusername, userCode, userId || null, serverId || null, ipAddress || null);
  }

  /**
   * Remove online player
   */
  removeOnlinePlayer(odId) {
    this.db.prepare('UPDATE players SET leftAt = CURRENT_TIMESTAMP, serverId = NULL WHERE odId = ?').run(odId);
  }

  /**
   * Get online players
   */
  getOnlinePlayers(serverId = null) {
    if (serverId) {
      return this.db.prepare(`
        SELECT p.*, u.username, u.avatarThumbnail, u.membership
        FROM players p
        LEFT JOIN users u ON p.userId = u.id
        WHERE p.serverId = ? AND p.leftAt IS NULL
      `).all(serverId);
    }
    return this.db.prepare(`
      SELECT p.*, u.username, u.avatarThumbnail, u.membership
      FROM players p
      LEFT JOIN users u ON p.userId = u.id
      WHERE p.leftAt IS NULL
    `).all();
  }

  /**
   * Update player activity
   */
  updatePlayerActivity(odId) {
    this.db.prepare('UPDATE players SET lastActivity = CURRENT_TIMESTAMP WHERE odId = ?').run(odId);
  }

  // ==================== Friend Methods ====================

  /**
   * Add friend request
   */
  addFriend(userId, friendId) {
    const stmt = this.db.prepare(`
      INSERT INTO friends (userId, friendId, status)
      VALUES (?, ?, 'pending')
    `);
    return stmt.run(userId, friendId);
  }

  /**
   * Accept friend request
   */
  acceptFriend(friendId) {
    this.db.prepare('UPDATE friends SET status = "accepted", updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(friendId);
    
    // Update counts
    const friendship = this.db.prepare('SELECT userId, friendId FROM friends WHERE id = ?').get(friendId);
    if (friendship) {
      this.db.prepare('UPDATE users SET friendsCount = friendsCount + 1 WHERE id = ?').run(friendship.userId);
      this.db.prepare('UPDATE users SET friendsCount = friendsCount + 1 WHERE id = ?').run(friendship.friendId);
    }
  }

  /**
   * Remove friend
   */
  removeFriend(userId, friendId) {
    this.db.prepare('DELETE FROM friends WHERE (userId = ? AND friendId = ?) OR (userId = ? AND friendId = ?)')
      .run(userId, friendId, friendId, userId);
  }

  /**
   * Get friends list
   */
  getFriends(userId) {
    return this.db.prepare(`
      SELECT u.id, u.username, u.userCode, u.avatarThumbnail, u.isOnline, f.status, f.createdAt as friendSince
      FROM friends f
      JOIN users u ON (f.friendId = u.id OR f.userId = u.id) AND u.id != ?
      WHERE (f.userId = ? OR f.friendId = ?) AND f.status = 'accepted'
    `).all(userId, userId, userId);
  }

  /**
   * Get pending friend requests
   */
  getPendingFriendRequests(userId) {
    return this.db.prepare(`
      SELECT u.id, u.username, u.userCode, u.avatarThumbnail, f.id as requestId, f.createdAt
      FROM friends f
      JOIN users u ON f.userId = u.id
      WHERE f.friendId = ? AND f.status = 'pending'
    `).all(userId);
  }

  // ==================== Message Methods ====================

  /**
   * Send message
   */
  sendMessage(senderId, receiverId, content) {
    const stmt = this.db.prepare(`
      INSERT INTO messages (senderId, receiverId, content)
      VALUES (?, ?, ?)
    `);
    return stmt.run(senderId, receiverId, content);
  }

  /**
   * Get messages between users
   */
  getMessages(userId, otherUserId, limit = 50) {
    return this.db.prepare(`
      SELECT m.*, 
             s.username as senderUsername, s.avatarThumbnail as senderAvatar,
             r.username as receiverUsername, r.avatarThumbnail as receiverAvatar
      FROM messages m
      JOIN users s ON m.senderId = s.id
      JOIN users r ON m.receiverId = r.id
      WHERE (m.senderId = ? AND m.receiverId = ?) OR (m.senderId = ? AND m.receiverId = ?)
      ORDER BY m.createdAt DESC
      LIMIT ?
    `).all(userId, otherUserId, otherUserId, userId, limit);
  }

  /**
   * Mark messages as read
   */
  markMessagesRead(userId, otherUserId) {
    this.db.prepare('UPDATE messages SET isRead = 1 WHERE receiverId = ? AND senderId = ?')
      .run(userId, otherUserId);
  }

  /**
   * Get unread message count
   */
  getUnreadMessageCount(userId) {
    return this.db.prepare('SELECT COUNT(*) as count FROM messages WHERE receiverId = ? AND isRead = 0').get(userId).count;
  }

  // ==================== Avatar Methods ====================

  /**
   * Get user avatar
   */
  getAvatar(userId) {
    return this.db.prepare('SELECT * FROM avatars WHERE userId = ?').get(userId);
  }

  /**
   * Update avatar
   */
  updateAvatar(userId, avatarData) {
    const existing = this.getAvatar(userId);
    
    if (existing) {
      const updates = [];
      const values = [];
      
      if (avatarData.rigType !== undefined) {
        updates.push('rigType = ?');
        values.push(avatarData.rigType);
      }
      if (avatarData.bodyColors !== undefined) {
        updates.push('bodyColors = ?');
        values.push(typeof avatarData.bodyColors === 'string' ? avatarData.bodyColors : JSON.stringify(avatarData.bodyColors));
      }
      if (avatarData.assets !== undefined) {
        updates.push('assets = ?');
        values.push(typeof avatarData.assets === 'string' ? avatarData.assets : JSON.stringify(avatarData.assets));
      }
      if (avatarData.animations !== undefined) {
        updates.push('animations = ?');
        values.push(typeof avatarData.animations === 'string' ? avatarData.animations : JSON.stringify(avatarData.animations));
      }
      
      updates.push('cachedAt = CURRENT_TIMESTAMP');
      values.push(userId);
      
      this.db.prepare(`UPDATE avatars SET ${updates.join(', ')} WHERE userId = ?`).run(...values);
    } else {
      this.db.prepare(`
        INSERT INTO avatars (userId, rigType, bodyColors, assets, animations)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        userId,
        avatarData.rigType || 'R15',
        typeof avatarData.bodyColors === 'string' ? avatarData.bodyColors : JSON.stringify(avatarData.bodyColors || {}),
        typeof avatarData.assets === 'string' ? avatarData.assets : JSON.stringify(avatarData.assets || []),
        typeof avatarData.animations === 'string' ? avatarData.animations : JSON.stringify(avatarData.animations || [])
      );
    }
    return true;
  }

  // ==================== Roblox Client Methods ====================

  /**
   * Get all clients
   */
  getClients() {
    return this.db.prepare('SELECT * FROM roblox_clients ORDER BY isDefault DESC, id ASC').all();
  }

  /**
   * Get default client
   */
  getDefaultClient() {
    return this.db.prepare('SELECT * FROM roblox_clients WHERE isDefault = 1').get();
  }

  /**
   * Create client
   */
  createClient(client) {
    const stmt = this.db.prepare(`
      INSERT INTO roblox_clients (name, clientVersion, clientPath, launchArguments, isDefault)
      VALUES (?, ?, ?, ?, ?)
    `);
    return stmt.run(client.name, client.clientVersion, client.clientPath || '', client.launchArguments || '', client.isDefault ? 1 : 0);
  }

  /**
   * Set default client
   */
  setDefaultClient(id) {
    this.db.prepare('UPDATE roblox_clients SET isDefault = 0').run();
    this.db.prepare('UPDATE roblox_clients SET isDefault = 1 WHERE id = ?').run(id);
  }

  /**
   * Delete client
   */
  deleteClient(id) {
    this.db.prepare('DELETE FROM roblox_clients WHERE id = ?').run(id);
  }

  // ==================== Asset Methods ====================

  /**
   * Add asset to cache
   */
  addAsset(asset) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO assets (assetId, name, type, path, url, size, mimeType, thumbnail, metadata, cachedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);
    return stmt.run(
      asset.assetId,
      asset.name,
      asset.type,
      asset.path || '',
      asset.url || '',
      asset.size || 0,
      asset.mimeType || '',
      asset.thumbnail || '',
      typeof asset.metadata === 'string' ? asset.metadata : JSON.stringify(asset.metadata || {})
    );
  }

  /**
   * Get assets
   */
  getAssets(options = {}) {
    let sql = 'SELECT * FROM assets WHERE 1=1';
    const params = [];
    
    if (options.type) {
      sql += ' AND type = ?';
      params.push(options.type);
    }
    
    if (options.search) {
      sql += ' AND name LIKE ?';
      params.push(`%${options.search}%`);
    }
    
    sql += ' ORDER BY cachedAt DESC';
    
    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
    }
    
    return this.db.prepare(sql).all(...params);
  }

  /**
   * Get asset by ID
   */
  getAssetById(assetId) {
    return this.db.prepare('SELECT * FROM assets WHERE assetId = ?').get(assetId);
  }

  /**
   * Delete asset
   */
  deleteAsset(assetId) {
    this.db.prepare('DELETE FROM assets WHERE assetId = ?').run(assetId);
  }

  // ==================== Config Methods ====================

  /**
   * Get config value
   */
  getConfig(key) {
    const row = this.db.prepare('SELECT value, type FROM config WHERE key = ?').get(key);
    if (!row) return null;
    
    // Parse based on type
    if (row.type === 'number') return Number(row.value);
    if (row.type === 'boolean') return row.value === 'true';
    return row.value;
  }

  /**
   * Set config value
   */
  setConfig(key, value, type = 'string') {
    const stringValue = typeof value === 'string' ? value : String(value);
    this.db.prepare(`
      INSERT OR REPLACE INTO config (key, value, type, updatedAt)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).run(key, stringValue, type);
  }

  /**
   * Get all config
   */
  getAllConfig() {
    const rows = this.db.prepare('SELECT * FROM config ORDER BY category, key').all();
    const config = {};
    for (const row of rows) {
      let value = row.value;
      if (row.type === 'number') value = Number(value);
      else if (row.type === 'boolean') value = value === 'true';
      config[row.key] = value;
    }
    return config;
  }

  /**
   * Get config by category
   */
  getConfigByCategory(category) {
    const rows = this.db.prepare('SELECT * FROM config WHERE category = ? ORDER BY key').all(category);
    const config = {};
    for (const row of rows) {
      config[row.key] = row.value;
    }
    return config;
  }

  // ==================== Audit Log Methods ====================

  /**
   * Create audit log
   */
  createAuditLog(userId, action, details = '', ipAddress = '', targetType = null, targetId = null, userAgent = '') {
    this.db.prepare(`
      INSERT INTO audit_logs (userId, action, targetType, targetId, details, ipAddress, userAgent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, action, targetType, targetId, details, ipAddress, userAgent || '');
  }

  /**
   * Get audit logs
   */
  getAuditLogs(limit = 100, userId = null, action = null) {
    let sql = `
      SELECT al.*, u.username 
      FROM audit_logs al
      LEFT JOIN users u ON al.userId = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (userId) {
      sql += ' AND al.userId = ?';
      params.push(userId);
    }
    
    if (action) {
      sql += ' AND al.action = ?';
      params.push(action);
    }
    
    sql += ' ORDER BY al.createdAt DESC LIMIT ?';
    params.push(limit);
    
    return this.db.prepare(sql).all(...params);
  }

  // ==================== Session Methods ====================

  /**
   * Create session
   */
  createSession({ userId, token, refreshToken, expiresAt, ipAddress, userAgent, rememberMe }) {
    const stmt = this.db.prepare(`
      INSERT INTO sessions (userId, token, refreshToken, expiresAt, ipAddress, userAgent, rememberMe)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    return stmt.run(userId, token, refreshToken || null, expiresAt, ipAddress || '', userAgent || '', rememberMe ? 1 : 0);
  }

  /**
   * Get session by token
   */
  getSessionByToken(token) {
    return this.db.prepare('SELECT * FROM sessions WHERE token = ? AND expiresAt > datetime('now')').get(token);
  }

  /**
   * Delete session
   */
  deleteSession(token) {
    this.db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }

  /**
   * Delete user sessions
   */
  deleteUserSessions(userId) {
    this.db.prepare('DELETE FROM sessions WHERE userId = ?').run(userId);
  }

  /**
   * Clean expired sessions
   */
  cleanExpiredSessions() {
    this.db.prepare('DELETE FROM sessions WHERE expiresAt < datetime('now')').run();
  }

  // ==================== Announcement Methods ====================

  /**
   * Get active announcements
   */
  getActiveAnnouncements() {
    return this.db.prepare(`
      SELECT a.*, u.username as authorName
      FROM announcements a
      LEFT JOIN users u ON a.authorId = u.id
      WHERE a.isActive = 1 AND (a.expiresAt IS NULL OR a.expiresAt > datetime('now'))
      ORDER BY a.priority DESC, a.createdAt DESC
    `).all();
  }

  /**
   * Create announcement
   */
  createAnnouncement({ title, content, authorId, priority = 'normal' }) {
    return this.db.prepare(`
      INSERT INTO announcements (title, content, authorId, priority)
      VALUES (?, ?, ?, ?)
    `).run(title, content, authorId, priority);
  }

  /**
   * Delete announcement
   */
  deleteAnnouncement(id) {
    this.db.prepare('UPDATE announcements SET isActive = 0 WHERE id = ?').run(id);
  }

  // ==================== Notification Methods ====================

  /**
   * Create notification
   */
  createNotification({ userId, type, title, message, data = {} }) {
    return this.db.prepare(`
      INSERT INTO notifications (userId, type, title, message, data)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, type, title, message, typeof data === 'string' ? data : JSON.stringify(data));
  }

  /**
   * Get user notifications
   */
  getUserNotifications(userId, limit = 20) {
    return this.db.prepare(`
      SELECT * FROM notifications
      WHERE userId = ?
      ORDER BY createdAt DESC
      LIMIT ?
    `).all(userId, limit);
  }

  /**
   * Get unread notification count
   */
  getUnreadNotificationCount(userId) {
    return this.db.prepare('SELECT COUNT(*) as count FROM notifications WHERE userId = ? AND isRead = 0').get(userId).count;
  }

  /**
   * Mark notification as read
   */
  markNotificationRead(id) {
    this.db.prepare('UPDATE notifications SET isRead = 1 WHERE id = ?').run(id);
  }

  /**
   * Mark all notifications as read
   */
  markAllNotificationsRead(userId) {
    this.db.prepare('UPDATE notifications SET isRead = 1 WHERE userId = ?').run(userId);
  }

  // ==================== Backup Methods ====================

  /**
   * Create backup record
   */
  createBackup({ name, type, path, size, createdBy }) {
    return this.db.prepare(`
      INSERT INTO backups (name, type, path, size, createdBy)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, type, path, size || 0, createdBy || null);
  }

  /**
   * Get backups
   */
  getBackups(type = null) {
    if (type) {
      return this.db.prepare('SELECT * FROM backups WHERE type = ? ORDER BY createdAt DESC').all(type);
    }
    return this.db.prepare('SELECT * FROM backups ORDER BY createdAt DESC').all();
  }

  /**
   * Delete backup record
   */
  deleteBackup(id) {
    this.db.prepare('DELETE FROM backups WHERE id = ?').run(id);
  }

  // ==================== Stats Methods ====================

  /**
   * Get basic stats
   */
  getStats() {
    const totalUsers = this.db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const onlineUsers = this.db.prepare('SELECT COUNT(*) as count FROM users WHERE isOnline = 1').get().count;
    const bannedUsers = this.db.prepare('SELECT COUNT(*) as count FROM users WHERE isBanned = 1').get().count;
    const runningServers = this.db.prepare("SELECT COUNT(*) as count FROM servers WHERE status = 'running'").get().count;
    const totalServers = this.db.prepare('SELECT COUNT(*) as count FROM servers').get().count;
    const totalGames = this.db.prepare('SELECT COUNT(*) as count FROM games').get().count;
    const activePlayers = this.db.prepare("SELECT COUNT(*) as count FROM players WHERE leftAt IS NULL").get().count;
    
    // Database size
    let dbSize = 0;
    try {
      const stats = fs.statSync(this.dbPath);
      dbSize = stats.size;
    } catch {}
    
    return {
      totalUsers,
      onlineUsers,
      bannedUsers,
      runningServers,
      totalServers,
      totalGames,
      activePlayers,
      dbSize
    };
  }

  /**
   * Get historical stats
   */
  getHistoricalStats(hours = 24) {
    return this.db.prepare(`
      SELECT 
        DATE(createdAt) as date,
        COUNT(*) as count
      FROM join_history
      WHERE createdAt > datetime('now', '-' || ? || ' hours')
      GROUP BY DATE(createdAt)
      ORDER BY date
    `).all(hours);
  }

  // ==================== Activity Feed Methods ====================

  /**
   * Add activity
   */
  addActivity({ userId, type, targetType, targetId, metadata = {} }) {
    return this.db.prepare(`
      INSERT INTO activity_feed (userId, type, targetType, targetId, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, type, targetType, targetId, typeof metadata === 'string' ? metadata : JSON.stringify(metadata));
  }

  /**
   * Get user activity
   */
  getUserActivity(userId, limit = 50) {
    return this.db.prepare(`
      SELECT * FROM activity_feed
      WHERE userId = ?
      ORDER BY createdAt DESC
      LIMIT ?
    `).all(userId, limit);
  }

  /**
   * Get recent activity
   */
  getRecentActivity(limit = 100) {
    return this.db.prepare(`
      SELECT af.*, u.username, u.avatarThumbnail
      FROM activity_feed af
      JOIN users u ON af.userId = u.id
      ORDER BY af.createdAt DESC
      LIMIT ?
    `).all(limit);
  }

  // ==================== Utility Methods ====================

  /**
   * Execute raw query
   */
  query(sql, params = []) {
    return this.db.prepare(sql).all(...params);
  }

  /**
   * Get database size
   */
  getDatabaseSize() {
    try {
      const stats = fs.statSync(this.dbPath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  /**
   * Export database to JSON
   */
  exportToJSON() {
    const tables = ['users', 'servers', 'games', 'players', 'friends', 'messages', 'assets', 'config', 'audit_logs', 'backups'];
    const data = {};
    
    for (const table of tables) {
      data[table] = this.db.prepare(`SELECT * FROM ${table}`).all();
    }
    
    return JSON.stringify(data, null, 2);
  }

  /**
   * Close database
   */
  close() {
    if (this.db) {
      this.cleanExpiredSessions();
      this.db.close();
      this.db = null;
    }
  }
}

module.exports = DatabaseService;
