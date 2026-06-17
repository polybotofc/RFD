# RFD Platform - Complete Specification

## Overview

The RFD Platform is a comprehensive web-based control center for Roblox Freedom Distribution (RFD). It provides a complete interface for managing RFD servers, players, games, and assets without requiring terminal access.

## Architecture

### Technology Stack

- **Backend**: Node.js + Express
- **Real-time**: Socket.IO
- **Database**: SQLite (easily switchable to PostgreSQL)
- **Frontend**: Next.js + React + TypeScript
- **Styling**: Tailwind CSS
- **Security**: bcrypt, JWT, helmet, rate limiting

### Project Structure

```
/workspace/project/RFD/
├── backend/
│   ├── src/
│   │   ├── adapters/           # Backend adapter interface
│   │   │   ├── Adapter.js      # Base adapter interface
│   │   │   ├── RFDAdapter.js   # RFD implementation
│   │   │   ├── RCCAdapter.js   # RCCService implementation
│   │   │   └── CustomAdapter.js
│   │   ├── middleware/         # Express middleware
│   │   │   ├── auth.js         # Authentication
│   │   │   ├── rateLimiter.js  # Rate limiting
│   │   │   ├── validator.js    # Input validation
│   │   │   └── security.js     # Helmet, CSRF, etc.
│   │   ├── routes/            # API routes
│   │   │   ├── auth.js        # Authentication
│   │   │   ├── players.js     # Player management
│   │   │   ├── servers.js     # Server management
│   │   │   ├── avatars.js     # Avatar system
│   │   │   ├── games.js       # Game/place management
│   │   │   ├── assets.js      # Asset management
│   │   │   ├── admin.js       # Admin panel
│   │   │   ├── stats.js       # Statistics
│   │   │   └── config.js      # Configuration
│   │   ├── services/          # Core services
│   │   │   ├── database.js    # Database service
│   │   │   ├── RFDManager.js  # RFD operations
│   │   │   ├── GameConfig.js  # TOML config editor
│   │   │   ├── BackupManager.js
│   │   │   ├── AvatarCache.js
│   │   │   ├── Discord.js     # Discord integration
│   │   │   └── NotificationService.js
│   │   ├── socket/           # Socket.IO handlers
│   │   │   ├── index.js      # Socket setup
│   │   │   ├── playerEvents.js
│   │   │   ├── serverEvents.js
│   │   │   └── adminEvents.js
│   │   └── server.js        # Main server entry
├── frontend/
│   ├── src/
│   │   ├── app/             # Next.js pages
│   │   │   ├── (auth)/     # Auth pages
│   │   │   │   ├── login/
│   │   │   │   └── register/
│   │   │   ├── (dashboard)/# Dashboard pages
│   │   │   │   ├── dashboard/
│   │   │   │   ├── servers/
│   │   │   │   ├── games/
│   │   │   │   ├── players/
│   │   │   │   ├── avatars/
│   │   │   │   ├── assets/
│   │   │   │   ├── files/
│   │   │   │   ├── console/
│   │   │   │   └── settings/
│   │   │   ├── admin/      # Admin pages
│   │   │   │   ├── users/
│   │   │   │   ├── servers/
│   │   │   │   ├── logs/
│   │   │   │   └── config/
│   │   │   └── profile/
│   │   ├── components/     # React components
│   │   │   ├── ui/         # Base UI components
│   │   │   ├── layout/     # Layout components
│   │   │   ├── dashboard/  # Dashboard widgets
│   │   │   ├── server/     # Server components
│   │   │   ├── game/       # Game components
│   │   │   └── admin/      # Admin components
│   │   ├── hooks/         # React hooks
│   │   ├── lib/           # Utilities
│   │   ├── stores/        # State management
│   │   └── styles/        # Global styles
│   └── public/
│       └── assets/        # Static assets
├── database/             # SQLite database
├── uploads/              # Uploaded files
├── backups/             # Backups
└── logs/                # Application logs
```

## Features

### 1. Authentication System

- [x] User registration with username/password
- [x] Login with remember me option
- [x] JWT-based session management
- [x] bcrypt password hashing
- [x] Admin and user roles
- [x] Profile page with:
  - Username, avatar, description
  - Join date, membership status
  - Friends, followers, following counts
  - Recent activity

### 2. Dashboard

After login, users see:
- Avatar and username
- Membership status
- Current server info
- Online players count
- Server status
- Recent activity feed
- Announcements
- Quick action buttons

### 3. RFD Manager

Core RFD operations:
- Start/Stop/Restart server
- Run Player / Run Studio
- Show Console (live output)
- Show Logs
- Edit GameConfig.toml (visual editor)
- Switch Place File
- Upload Place (.rbxl, .rbxlx)
- Open AssetCache
- Clear Cache
- Open SQLite Database
- Show Running Version

Configuration options:
- RFD executable path
- GameConfig path
- AssetCache path
- SQLite path
- Player executable
- Studio executable
- Auto-detect RFD installation

### 4. Server Browser

Display columns:
- Server Name
- Player Count
- Ping
- Map
- Version
- Join Button
- Favorite Button

Features:
- Search functionality
- Filters (player count, version, map)
- Live updates via Socket.IO
- Favorite servers

### 5. Player System

- Online players list
- Recently joined
- Player profiles
- Friend requests
- Direct messaging
- Player search
- Player cards with avatars
- Join player (visit their server)

### 6. Avatar System

- Avatar preview
- 3D preview (optional)
- Avatar inventory
- Accessories list
- Body colors
- Animations
- Bundles
- R6/R15 rig type
- Favorites
- Import from Roblox API
- Local caching

### 7. Place Management

- Upload .rbxl / .rbxlx
- Convert between formats
- Manage multiple places
- Create games
- Delete games
- Rename games
- Version history

### 8. GameConfig Editor

Visual TOML editor with UI for:
- Server title
- Description
- Creator name
- Icon
- Place file
- Version
- Filtering settings
- Membership requirements
- Admin list
- Chat settings
- Persistence
- Asset redirects
- Startup script

### 9. Asset Manager

- Browse AssetCache directory
- Search assets
- Delete assets
- Import assets
- Refresh asset cache
- Preview images
- Preview meshes
- Preview sounds
- Animation viewer

### 10. Console

- Live RFD console output
- Colorized output
- Search logs
- Copy/Download logs
- Auto-scroll
- Filter by warnings/errors

### 11. Database Browser

- View SQLite database
- View players table
- View inventory
- View badges
- View groups
- View gamepasses
- Edit values
- Export database

### 12. File Manager

Manage:
- GameConfig.toml
- SQLite database
- AssetCache
- Places
- Icons
- Logs
- Backups

### 13. Automatic Backups

Backup:
- Database
- Places
- Config files
- AssetCache

Restore from backups

### 14. Launcher Configuration

- Generate launcher config
- One-click launch
- Remember login
- Auto-update support
- Custom branding

### 15. Settings

- Dark Mode
- Light Mode
- Accent Color picker
- Language selection
- Theme customization

### 16. Admin Panel

- User management
- Ban/Kick/Mute users
- Promote/Demote users
- View audit logs
- Manage servers
- Broadcast messages
- Shutdown servers
- Maintenance mode toggle

### 17. Statistics Dashboard

Charts for:
- Players online (real-time)
- Servers online
- Memory usage
- CPU usage
- Network traffic
- Database size
- Assets cached

### 18. Security Features

- Rate limiting
- CSRF protection
- Helmet.js
- Input validation
- Secure cookies
- Permission system
- Audit logging

### 19. Extra Features

- Discord Rich Presence
- Discord OAuth
- Google OAuth
- Activity feed
- Notifications
- Toast system
- Live server updates
- Auto-detect RFD
- Auto-updates
- Multiple server instances
- Multiple games
- Plugin system
- Localization (i18n)
- Custom branding

## API Endpoints

### Authentication API

```
POST   /api/auth/register     - Register new user
POST   /api/auth/login        - Login user
POST   /api/auth/logout       - Logout user
GET    /api/auth/me           - Get current user
POST   /api/auth/refresh      - Refresh token
POST   /api/auth/forgot       - Forgot password
POST   /api/auth/reset        - Reset password
```

### Player API

```
GET    /api/players           - List players
GET    /api/players/:id       - Get player details
PUT    /api/players/:id       - Update player
GET    /api/players/:id/friends - Get friends
POST   /api/players/:id/friend - Add friend
DELETE /api/players/:id/friend - Remove friend
GET    /api/players/:id/avatar - Get avatar
PUT    /api/players/:id/avatar - Update avatar
GET    /api/players/search    - Search players
```

### Server API

```
GET    /api/servers           - List servers
POST   /api/servers           - Create server
GET    /api/servers/:id       - Get server details
PUT    /api/servers/:id       - Update server
DELETE /api/servers/:id       - Delete server
POST   /api/servers/:id/start - Start server
POST   /api/servers/:id/stop  - Stop server
POST   /api/servers/:id/restart - Restart server
GET    /api/servers/:id/logs  - Get server logs
GET    /api/servers/:id/console - Get console output
POST   /api/servers/:id/console - Send command
```

### Avatar API

```
GET    /api/avatars/:id       - Get avatar
GET    /api/avatars/:id/thumbnail - Get thumbnail
GET    /api/avatars/:id/inventory - Get inventory
GET    /api/avatars/:id/bundles - Get bundles
GET    /api/avatars/:id/animations - Get animations
POST   /api/avatars/import    - Import from Roblox
```

### Game API

```
GET    /api/games             - List games
POST   /api/games             - Create game
GET    /api/games/:id         - Get game details
PUT    /api/games/:id         - Update game
DELETE /api/games/:id         - Delete game
POST   /api/games/:id/upload  - Upload place file
GET    /api/games/:id/config  - Get GameConfig
PUT    /api/games/:id/config  - Update GameConfig
GET    /api/games/:id/versions - Get version history
```

### Asset API

```
GET    /api/assets            - List assets
GET    /api/assets/:id       - Get asset
GET    /api/assets/:id/preview - Preview asset
POST   /api/assets            - Upload asset
DELETE /api/assets/:id       - Delete asset
POST   /api/assets/import    - Import asset
GET    /api/assets/search    - Search assets
```

### Admin API

```
GET    /api/admin/users       - List all users
POST   /api/admin/users/:id/ban - Ban user
POST   /api/admin/users/:id/kick - Kick user
POST   /api/admin/users/:id/mute - Mute user
POST   /api/admin/users/:id/promote - Promote user
POST   /api/admin/users/:id/demote - Demote user
GET    /api/admin/logs        - Get audit logs
POST   /api/admin/broadcast   - Broadcast message
POST   /api/admin/maintenance - Toggle maintenance
GET    /api/admin/stats       - Get system stats
POST   /api/admin/backup      - Create backup
GET    /api/admin/backups     - List backups
POST   /api/admin/backups/:id/restore - Restore backup
```

### Statistics API

```
GET    /api/stats             - Get overall stats
GET    /api/stats/players     - Player statistics
GET    /api/stats/servers     - Server statistics
GET    /api/stats/resources   - Resource usage
GET    /api/stats/history     - Historical data
```

### Config API

```
GET    /api/config            - Get all config
GET    /api/config/:key       - Get config value
PUT    /api/config/:key       - Update config
GET    /api/config/gameconfig/:id - Get GameConfig.toml
PUT    /api/config/gameconfig/:id - Update GameConfig.toml
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  email TEXT UNIQUE,
  userCode TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'user',
  avatar TEXT,
  description TEXT,
  membership TEXT DEFAULT 'none',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  lastLogin DATETIME,
  isOnline INTEGER DEFAULT 0,
  isBanned INTEGER DEFAULT 0,
  banReason TEXT,
  friendsCount INTEGER DEFAULT 0,
  followersCount INTEGER DEFAULT 0,
  followingCount INTEGER DEFAULT 0
);
```

### Servers Table
```sql
CREATE TABLE servers (
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
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  startedAt DATETIME,
  pid INTEGER,
  FOREIGN KEY (gameId) REFERENCES games(id)
);
```

### Games Table
```sql
CREATE TABLE games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  creator TEXT,
  icon TEXT,
  version TEXT DEFAULT '1.0.0',
  placeFile TEXT,
  gameConfig TEXT,
  visits INTEGER DEFAULT 0,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME
);
```

### Players Table
```sql
CREATE TABLE players (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER,
  username TEXT NOT NULL,
  userCode TEXT NOT NULL,
  serverId INTEGER,
  ipAddress TEXT,
  joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  leftAt DATETIME,
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (serverId) REFERENCES servers(id)
);
```

### Friends Table
```sql
CREATE TABLE friends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER,
  friendId INTEGER,
  status TEXT DEFAULT 'pending',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id),
  FOREIGN KEY (friendId) REFERENCES users(id)
);
```

### Messages Table
```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  senderId INTEGER,
  receiverId INTEGER,
  content TEXT NOT NULL,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  isRead INTEGER DEFAULT 0,
  FOREIGN KEY (senderId) REFERENCES users(id),
  FOREIGN KEY (receiverId) REFERENCES users(id)
);
```

### Avatars Table
```sql
CREATE TABLE avatars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER UNIQUE,
  rigType TEXT DEFAULT 'R15',
  bodyColors TEXT,
  assets TEXT,
  animations TEXT,
  cachedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id)
);
```

### Audit Logs Table
```sql
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER,
  action TEXT NOT NULL,
  targetType TEXT,
  targetId INTEGER,
  details TEXT,
  ipAddress TEXT,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (userId) REFERENCES users(id)
);
```

### Config Table
```sql
CREATE TABLE config (
  key TEXT PRIMARY KEY,
  value TEXT,
  type TEXT DEFAULT 'string',
  category TEXT DEFAULT 'general',
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Backups Table
```sql
CREATE TABLE backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  path TEXT NOT NULL,
  size INTEGER,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (createdBy) REFERENCES users(id)
);
```

## Backend Adapter Interface

The adapter pattern allows swapping the backend (RFD, RCCService, etc.) without rewriting the website:

```javascript
class BackendAdapter {
  // Server management
  async startServer(config) {}
  async stopServer(serverId) {}
  async restartServer(serverId) {}
  async getServerStatus(serverId) {}
  async getServerLogs(serverId, lines) {}
  
  // Player management
  async getOnlinePlayers(serverId) {}
  async kickPlayer(playerId, reason) {}
  async sendToPlayer(playerId, data) {}
  
  // Game operations
  async loadPlace(placePath) {}
  async getGameConfig() {}
  async setGameConfig(config) {}
  
  // Asset operations
  async getAsset(assetId) {}
  async cacheAsset(assetId, url) {}
  
  // Console
  async executeCommand(command) {}
  onConsoleOutput(callback) {}
}
```

Implementations:
- `RFDAdapter.js` - For RFD
- `RCCAdapter.js` - For RCCService
- `CustomAdapter.js` - For custom backends

## Socket.IO Events

### Client → Server
- `join-server` - Join a server room
- `leave-server` - Leave a server room
- `player-action` - Player actions
- `admin-action` - Admin actions
- `subscribe-stats` - Subscribe to stats updates

### Server → Client
- `server-updated` - Server status changed
- `player-joined` - Player joined
- `player-left` - Player left
- `console-output` - Console output
- `stats-update` - Statistics update
- `notification` - Notification
- `broadcast` - Admin broadcast

## Security Implementation

### Rate Limiting
```javascript
const rateLimit = require('express-rate-limit');
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests'
});
```

### Helmet.js
```javascript
const helmet = require('helmet');
app.use(helmet());
```

### Input Validation
```javascript
const { body, validationResult } = require('express-validator');
app.post('/api/auth/register', [
  body('username').isLength({ min: 3 }).trim(),
  body('password').isLength({ min: 8 }),
  body('email').isEmail()
], handleValidation);
```

### CSRF Protection
```javascript
const csrf = require('csurf');
const csrfProtection = csrf({ cookie: true });
```

## Environment Variables

```env
# Server
PORT=3001
NODE_ENV=production
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_PATH=./database/rfd.db

# RFD Paths
RFD_PATH=
GAMECONFIG_PATH=
ASSETCACHE_PATH=
SQLITE_PATH=
PLAYER_PATH=
STUDIO_PATH=

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
JWT_REMEMBER_EXPIRES_IN=30d

# Discord
DISCORD_BOT_TOKEN=
DISCORD_WEBHOOK_URL=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=

# OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Security
SESSION_SECRET=your-session-secret
CSRF_SECRET=your-csrf-secret

# Backups
BACKUP_PATH=./backups
BACKUP_RETENTION_DAYS=30

# Logs
LOG_PATH=./logs
LOG_LEVEL=info
```

## Future Ready

The architecture is designed to allow easy replacement of the backend:

1. **Backend Adapter Interface** - All game operations go through adapters
2. **Configurable Paths** - All paths are configurable via env/database
3. **Plugin System** - Extensible plugin architecture
4. **API-Based Communication** - REST and WebSocket for flexibility
5. **Modular Design** - Easy to add/remove features

## Running the Platform

### Development
```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

### Production
```bash
# Build frontend
cd frontend
npm run build

# Start backend
cd backend
npm start
```

### Docker
```bash
docker-compose up -d
```

## Default Credentials

- Admin: `admin` / `admin123`
- User: `user` / `user123` (if created)

## TODO

- [x] Basic project structure
- [x] Express server setup
- [x] SQLite database
- [x] Authentication system
- [x] Server management
- [x] Socket.IO integration
- [x] Frontend pages
- [x] GameConfig editor
- [x] Asset manager
- [x] Admin panel
- [x] Statistics
- [x] Settings
- [x] File manager
- [x] Backup system
- [x] Console viewer
- [x] Discord integration
- [x] OAuth support
- [x] Localization
- [ ] Plugin system
- [ ] Mobile app
