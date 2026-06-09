const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');

class DatabaseService {
  constructor() {
    this.db = null;
    this.dbPath = path.join(__dirname, '../../../database/rfd.db');
  }

  initialize() {
    const dbDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    
    this.createTables();
    this.seedData();
    
    console.log('Database initialized at:', this.dbPath);
    return this;
  }

  createTables() {
    // Users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        userCode TEXT UNIQUE NOT NULL,
        role TEXT DEFAULT 'user',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        lastLogin DATETIME,
        isOnline INTEGER DEFAULT 0
      )
    `);

    // Servers table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS servers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        maxPlayers INTEGER DEFAULT 100,
        currentPlayers INTEGER DEFAULT 0,
        version TEXT DEFAULT '1.0.0',
        status TEXT DEFAULT 'offline',
        placeFile TEXT,
        rfdPath TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        startedAt DATETIME,
        pid INTEGER
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

    // Audit logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER,
        action TEXT NOT NULL,
        details TEXT,
        ipAddress TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id)
      )
    `);

    // Config table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
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
        FOREIGN KEY (userId) REFERENCES users(id),
        FOREIGN KEY (serverId) REFERENCES servers(id)
      )
    `);

    // Sessions table for JWT blacklisting
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId INTEGER,
        token TEXT UNIQUE,
        expiresAt DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id)
      )
    `);
  }

  seedData() {
    const adminExists = this.db.prepare('SELECT id FROM users WHERE role = ?').get('admin');
    
    if (!adminExists) {
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      this.db.prepare(`
        INSERT INTO users (username, password, userCode, role)
        VALUES (?, ?, ?, ?)
      `).run('admin', hashedPassword, 'U00001', 'admin');
      console.log('Default admin created: admin / admin123');
    }

    const clientExists = this.db.prepare('SELECT id FROM roblox_clients WHERE name = ?').get('Roblox 2021');
    if (!clientExists) {
      this.db.prepare(`
        INSERT INTO roblox_clients (name, clientVersion, launchArguments, isDefault)
        VALUES (?, ?, ?, ?)
      `).run('Roblox 2021', '0.485.0.452074', '--gc 1', 1);
      this.db.prepare(`
        INSERT INTO roblox_clients (name, clientVersion, launchArguments, isDefault)
        VALUES (?, ?, ?, ?)
      `).run('Roblox 2020', '0.450.0.406763', '--gc 1', 0);
    }

    const configs = [
      ['serverName', 'RFD Server'],
      ['maxPlayers', '100'],
      ['port', '53640'],
      ['rfdPath', ''],
      ['placeFile', ''],
      ['autoStart', 'false'],
      ['autoScan', 'true']
    ];

    const insertConfig = this.db.prepare(`INSERT OR IGNORE INTO config (key, value) VALUES (?, ?)`);
    for (const [key, value] of configs) {
      insertConfig.run(key, value);
    }
  }

  // User methods
  createUser(username, password, userCode) {
    const stmt = this.db.prepare(`
      INSERT INTO users (username, password, userCode) VALUES (?, ?, ?)
    `);
    const result = stmt.run(username, password, userCode);
    return result.lastInsertRowid;
  }

  getUserByUsername(username) {
    return this.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  }

  getUserById(id) {
    return this.db.prepare('SELECT id, username, userCode, role, createdAt, lastLogin, isOnline FROM users WHERE id = ?').get(id);
  }

  getUserByUserCode(userCode) {
    return this.db.prepare('SELECT * FROM users WHERE userCode = ?').get(userCode);
  }

  updateLastLogin(userId) {
    this.db.prepare('UPDATE users SET lastLogin = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
  }

  setUserOnline(userId, isOnline) {
    this.db.prepare('UPDATE users SET isOnline = ? WHERE id = ?').run(isOnline ? 1 : 0, userId);
  }

  updateUsername(userId, newUsername) {
    this.db.prepare('UPDATE users SET username = ? WHERE id = ?').run(newUsername, userId);
  }

  getAllUsers() {
    return this.db.prepare('SELECT id, username, userCode, role, createdAt, isOnline FROM users').all();
  }

  // Server methods
  createServer(server) {
    const stmt = this.db.prepare(`
      INSERT INTO servers (name, host, port, maxPlayers, placeFile, rfdPath)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(server.name, server.host, server.port, server.maxPlayers || 100, server.placeFile || '', server.rfdPath || '');
    return result.lastInsertRowid;
  }

  getServers() {
    return this.db.prepare('SELECT * FROM servers ORDER BY id DESC').all();
  }

  getServerById(id) {
    return this.db.prepare('SELECT * FROM servers WHERE id = ?').get(id);
  }

  getServerByPort(port) {
    return this.db.prepare('SELECT * FROM servers WHERE port = ?').get(port);
  }

  updateServerStatus(id, status, pid = null) {
    if (status === 'running') {
      this.db.prepare('UPDATE servers SET status = ?, pid = ?, startedAt = CURRENT_TIMESTAMP WHERE id = ?').run(status, pid, id);
    } else {
      this.db.prepare('UPDATE servers SET status = ?, pid = NULL WHERE id = ?').run(status, id);
    }
  }

  updateServerPlayerCount(id, count) {
    this.db.prepare('UPDATE servers SET currentPlayers = ? WHERE id = ?').run(count, id);
  }

  deleteServer(id) {
    this.db.prepare('DELETE FROM servers WHERE id = ?').run(id);
  }

  // Roblox client methods
  getClients() {
    return this.db.prepare('SELECT * FROM roblox_clients ORDER BY isDefault DESC, id ASC').all();
  }

  getDefaultClient() {
    return this.db.prepare('SELECT * FROM roblox_clients WHERE isDefault = 1').get();
  }

  createClient(client) {
    const stmt = this.db.prepare(`
      INSERT INTO roblox_clients (name, clientVersion, clientPath, launchArguments, isDefault)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(client.name, client.clientVersion, client.clientPath || '', client.launchArguments || '', client.isDefault ? 1 : 0);
    return result.lastInsertRowid;
  }

  setDefaultClient(id) {
    this.db.prepare('UPDATE roblox_clients SET isDefault = 0').run();
    this.db.prepare('UPDATE roblox_clients SET isDefault = 1 WHERE id = ?').run(id);
  }

  deleteClient(id) {
    this.db.prepare('DELETE FROM roblox_clients WHERE id = ?').run(id);
  }

  // Config methods
  getConfig(key) {
    const row = this.db.prepare('SELECT value FROM config WHERE key = ?').get(key);
    return row ? row.value : null;
  }

  setConfig(key, value) {
    this.db.prepare(`INSERT OR REPLACE INTO config (key, value, updatedAt) VALUES (?, ?, CURRENT_TIMESTAMP)`).run(key, value);
  }

  getAllConfig() {
    const rows = this.db.prepare('SELECT * FROM config').all();
    const config = {};
    for (const row of rows) {
      config[row.key] = row.value;
    }
    return config;
  }

  // Audit log methods
  createAuditLog(userId, action, details, ipAddress) {
    this.db.prepare(`INSERT INTO audit_logs (userId, action, details, ipAddress) VALUES (?, ?, ?, ?)`).run(userId, action, details || '', ipAddress || '');
  }

  getAuditLogs(limit = 100) {
    return this.db.prepare(`
      SELECT al.*, u.username 
      FROM audit_logs al
      LEFT JOIN users u ON al.userId = u.id
      ORDER BY al.createdAt DESC
      LIMIT ?
    `).all(limit);
  }

  // Join history methods
  addJoinHistory(userId, serverId, userCode) {
    this.db.prepare(`INSERT INTO join_history (userId, serverId, userCode) VALUES (?, ?, ?)`).run(userId, serverId, userCode);
  }

  getJoinHistory(userId, limit = 50) {
    return this.db.prepare(`
      SELECT jh.*, s.name as serverName, s.host, s.port
      FROM join_history jh
      LEFT JOIN servers s ON jh.serverId = s.id
      WHERE jh.userId = ?
      ORDER BY jh.joinedAt DESC
      LIMIT ?
    `).all(userId, limit);
  }

  // Stats
  getStats() {
    const totalUsers = this.db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const onlineUsers = this.db.prepare('SELECT COUNT(*) as count FROM users WHERE isOnline = 1').get().count;
    const runningServers = this.db.prepare("SELECT COUNT(*) as count FROM servers WHERE status = 'running'").get().count;
    const activePort = this.db.prepare("SELECT port FROM servers WHERE status = 'running' LIMIT 1").get()?.port || null;
    return { totalUsers, onlineUsers, runningServers, activePort };
  }

  close() {
    if (this.db) this.db.close();
  }
}

module.exports = DatabaseService;
