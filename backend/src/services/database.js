const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class DatabaseService {
  constructor() {
    const dbDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    this.dbPath = path.join(dbDir, 'rfds.db');
    this.db = null;
  }

  initialize() {
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    
    this.createTables();
    this.createDefaultAdmin();
    console.log('Database initialized at:', this.dbPath);
  }

  createTables() {
    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_admin INTEGER DEFAULT 0
      )
    `);

    // Games table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        creator TEXT,
        rbxl_path TEXT,
        thumbnail TEXT,
        default_port INTEGER DEFAULT 2000,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Servers table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS servers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id INTEGER,
        port INTEGER NOT NULL,
        pid INTEGER,
        status TEXT DEFAULT 'stopped',
        players TEXT DEFAULT '[]',
        max_players INTEGER DEFAULT 20,
        uptime REAL DEFAULT 0,
        started_at DATETIME,
        FOREIGN KEY (game_id) REFERENCES games(id)
      )
    `);

    // Logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS server_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        server_id INTEGER,
        message TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (server_id) REFERENCES servers(id)
      )
    `);

    // Sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        token TEXT UNIQUE,
        expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    console.log('Database tables created');
  }

  createDefaultAdmin() {
    const bcrypt = require('bcrypt');
    const existingAdmin = this.db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    
    if (!existingAdmin) {
      const passwordHash = bcrypt.hashSync('admin123', 10);
      this.db.prepare(
        'INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)'
      ).run('admin', passwordHash);
      console.log('Default admin user created (username: admin, password: admin123)');
    }
  }

  // User methods
  createUser(username, passwordHash) {
    try {
      const stmt = this.db.prepare(
        'INSERT INTO users (username, password_hash) VALUES (?, ?)'
      );
      const result = stmt.run(username, passwordHash);
      return { success: true, id: result.lastInsertRowid };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getUserByUsername(username) {
    return this.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  }

  getUserById(id) {
    return this.db.prepare('SELECT id, username, is_admin, created_at FROM users WHERE id = ?').get(id);
  }

  getAllUsers() {
    return this.db.prepare('SELECT id, username, is_admin, created_at FROM users').all();
  }

  // Game methods
  createGame(game) {
    const stmt = this.db.prepare(`
      INSERT INTO games (title, description, creator, rbxl_path, thumbnail, default_port)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      game.title,
      game.description || '',
      game.creator || '',
      game.rbxl_path || '',
      game.thumbnail || '',
      game.default_port || 2000
    );
    return { success: true, id: result.lastInsertRowid };
  }

  getGameById(id) {
    return this.db.prepare('SELECT * FROM games WHERE id = ?').get(id);
  }

  getAllGames() {
    return this.db.prepare('SELECT * FROM games ORDER BY created_at DESC').all();
  }

  updateGame(id, updates) {
    const fields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (['title', 'description', 'creator', 'rbxl_path', 'thumbnail', 'default_port'].includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    
    if (fields.length > 0) {
      values.push(id);
      this.db.prepare(`UPDATE games SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }
    return { success: true };
  }

  deleteGame(id) {
    this.db.prepare('DELETE FROM games WHERE id = ?').run(id);
    return { success: true };
  }

  // Server methods
  createServer(server) {
    const stmt = this.db.prepare(`
      INSERT INTO servers (game_id, port, status) VALUES (?, ?, ?)
    `);
    const result = stmt.run(server.game_id, server.port, 'stopped');
    return { success: true, id: result.lastInsertRowid };
  }

  getServerById(id) {
    return this.db.prepare('SELECT * FROM servers WHERE id = ?').get(id);
  }

  getServerByPort(port) {
    return this.db.prepare('SELECT * FROM servers WHERE port = ?').get(port);
  }

  getAllServers() {
    return this.db.prepare(`
      SELECT s.*, g.title as game_title 
      FROM servers s 
      LEFT JOIN games g ON s.game_id = g.id 
      ORDER BY s.id DESC
    `).all();
  }

  getServersByGameId(gameId) {
    return this.db.prepare(`
      SELECT s.*, g.title as game_title 
      FROM servers s 
      LEFT JOIN games g ON s.game_id = g.id 
      WHERE s.game_id = ?
    `).all(gameId);
  }

  updateServer(id, updates) {
    const fields = [];
    const values = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (['status', 'pid', 'players', 'max_players', 'uptime', 'started_at'].includes(key)) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    
    if (fields.length > 0) {
      values.push(id);
      this.db.prepare(`UPDATE servers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
    }
    return { success: true };
  }

  deleteServer(id) {
    this.db.prepare('DELETE FROM servers WHERE id = ?').run(id);
    return { success: true };
  }

  // Log methods
  addLog(serverId, message) {
    this.db.prepare(
      'INSERT INTO server_logs (server_id, message) VALUES (?, ?)'
    ).run(serverId, message);
  }

  getLogs(serverId, limit = 100) {
    return this.db.prepare(
      'SELECT * FROM server_logs WHERE server_id = ? ORDER BY timestamp DESC LIMIT ?'
    ).all(serverId, limit);
  }

  // Cleanup
  close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = DatabaseService;