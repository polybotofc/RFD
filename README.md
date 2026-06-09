# RFD Platform - Roblox Freedom Distribution Web Platform

A complete Roblox-style web platform integrated with RFD (Roblox Freedom Distribution) for private game server networks.

## 🎮 Features

- **User Authentication**: Register, login, JWT-based sessions with bcrypt password hashing
- **Game Browser**: Browse, search, and filter all available games
- **Server Management**: View servers, join games, manage server lifecycle
- **Real-time Updates**: Live server status, player counts, and logs via Socket.IO
- **Admin Dashboard**: Full control over users, games, and servers
- **RFD Integration**: Automatic server discovery, process management, and log monitoring
- **Custom Protocol**: `rfd://` protocol support for game launching

## 🏗️ Tech Stack

### Backend
- **Runtime**: Node.js 20+
- **Framework**: Express.js
- **Database**: SQLite (better-sqlite3)
- **Real-time**: Socket.IO
- **Authentication**: JWT + bcrypt
- **File Upload**: Multer

### Frontend
- **Framework**: Next.js 14 (React)
- **Styling**: TailwindCSS
- **State**: React Hooks + Context
- **Real-time**: Socket.IO Client

## 📁 Project Structure

```
/workspace/project/RFD/
├── backend/
│   ├── src/
│   │   ├── server.js          # Main server entry
│   │   ├── routes/            # API route handlers
│   │   │   ├── auth.js        # Authentication routes
│   │   │   ├── games.js       # Game management routes
│   │   │   ├── servers.js     # Server management routes
│   │   │   └── api.js         # General API routes
│   │   ├── services/          # Business logic
│   │   │   ├── database.js    # SQLite database service
│   │   │   ├── serverManager.js # RFD process manager
│   │   │   └── logWatcher.js  # RFD log parser
│   │   └── middleware/        # Express middleware
│   │       └── auth.js        # JWT authentication
│   └── uploads/               # Game and thumbnail storage
├── frontend/
│   ├── src/
│   │   ├── app/               # Next.js App Router pages
│   │   │   ├── page.tsx       # Homepage
│   │   │   ├── discover/      # Game discovery
│   │   │   ├── game/[id]/     # Individual game page
│   │   │   ├── servers/       # Server browser
│   │   │   ├── admin/         # Admin dashboard
│   │   │   ├── login/         # Login page
│   │   │   └── register/      # Registration page
│   │   ├── components/        # React components
│   │   ├── hooks/             # Custom React hooks
│   │   ├── lib/               # Utilities and API client
│   │   └── styles/            # Global styles
│   └── public/               # Static assets
├── docker-compose.yml         # Production Docker setup
├── docker-compose.dev.yml     # Development Docker setup
└── Dockerfile                 # Multi-stage build

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (for containerized deployment)
- RFD.exe (for actual game server hosting)

### Local Development

1. **Install dependencies**
   ```bash
   npm run install:all
   ```

2. **Configure environment**
   ```bash
   cp .env.example backend/.env
   # Edit backend/.env with your settings
   ```

3. **Start development servers**
   ```bash
   npm run dev
   ```
   
   This will start:
   - Backend API at http://localhost:3001
   - Frontend at http://localhost:3000

### Docker Deployment

1. **Build and run**
   ```bash
   # Production
   docker-compose up -d
   
   # Development
   docker-compose -f docker-compose.dev.yml up -d
   ```

2. **With RFD executable**
   ```bash
   RFD_EXECUTABLE_PATH=./RFD.exe docker-compose up -d
   ```

## 🔐 Default Credentials

On first startup, a default admin user is created:
- **Username**: admin
- **Password**: admin123

⚠️ **Change these credentials in production!**

## 🌐 API Reference

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| POST | `/api/auth/logout` | Logout user |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/auth/users` | List all users (admin) |

### Games

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/games` | List all games |
| GET | `/api/games/:id` | Get game details |
| POST | `/api/games` | Create game (admin) |
| PUT | `/api/games/:id` | Update game (admin) |
| DELETE | `/api/games/:id` | Delete game (admin) |

### Servers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/servers` | List all servers |
| GET | `/api/servers/:id` | Get server details |
| POST | `/api/servers` | Create server (admin) |
| POST | `/api/servers/start/:id` | Start server (admin) |
| POST | `/api/servers/stop/:id` | Stop server (admin) |
| POST | `/api/servers/restart/:id` | Restart server (admin) |
| DELETE | `/api/servers/:id` | Delete server (admin) |

### Game Join

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/join/:serverId` | Get server connection info |

### Stats

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/stats` | Get platform statistics |

## 🎮 Game Launching

The platform uses a custom protocol for launching games:

```
rfd://join?host=<host>&port=<port>
```

When clicked, this will launch the RFD client to connect to the specified server.

## 📊 Database Schema

### users
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| username | TEXT | Unique username |
| password_hash | TEXT | Bcrypt hashed password |
| created_at | DATETIME | Account creation time |
| is_admin | INTEGER | Admin flag (0/1) |

### games
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| title | TEXT | Game title |
| description | TEXT | Game description |
| creator | TEXT | Creator username |
| rbxl_path | TEXT | Path to .rbxl file |
| thumbnail | TEXT | Thumbnail URL/path |
| default_port | INTEGER | Default server port |
| created_at | DATETIME | Creation time |

### servers
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| game_id | INTEGER | Foreign key to games |
| port | INTEGER | Server port |
| pid | INTEGER | RFD process ID |
| status | TEXT | running/stopped |
| players | TEXT | JSON array of players |
| max_players | INTEGER | Max player capacity |
| uptime | REAL | Server uptime in seconds |
| started_at | DATETIME | Server start time |

## 🔧 RFD Integration

### Starting a Server

```bash
RFD.exe server --place "<rbxl_path>" -p <port>
```

### Server Manager Features

- Process spawning and management
- Automatic port allocation
- Server state tracking
- Real-time log streaming
- Graceful shutdown handling

### Log Watcher

Automatically detects:
- Server startup (extracts port, map info)
- Player join/leave events
- Server shutdown

## 🛡️ Security

- Passwords hashed with bcrypt (cost factor 10)
- JWT tokens with configurable expiration
- CORS configuration for API access
- Input validation on all endpoints
- SQL injection prevention via prepared statements

## 📝 Development

### Adding New Features

1. Create route handler in `backend/src/routes/`
2. Add service logic in `backend/src/services/`
3. Create React component in `frontend/src/components/`
4. Add page in `frontend/src/app/`
5. Update API client in `frontend/src/lib/api.ts`

### Testing

```bash
# Backend tests
cd backend && npm test

# Frontend tests
cd frontend && npm test

# E2E tests (requires running servers)
npm run test:e2e
```

## 🐛 Troubleshooting

### Server won't start
- Check RFD.exe path in environment
- Verify port is available
- Check logs for errors

### Database issues
- Delete `backend/data/rfds.db` to reset
- Check file permissions on data directory

### Frontend can't connect to API
- Verify backend is running on port 3001
- Check CORS settings
- Check environment variables

## 📄 License

This project is provided as-is for private RFD network deployments.

## 🤝 Contributing

Contributions welcome! Please read the contributing guidelines before submitting PRs.
