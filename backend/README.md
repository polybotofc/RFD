# Backend

## API Endpoints

### Auth
- POST /api/auth/register - Register new user
- POST /api/auth/login - Login
- POST /api/auth/logout - Logout
- GET /api/auth/me - Get current user
- GET /api/auth/users - List users (admin)

### Games
- GET /api/games - List all games
- GET /api/games/:id - Get game details
- POST /api/games - Create game (admin)
- PUT /api/games/:id - Update game (admin)
- DELETE /api/games/:id - Delete game (admin)

### Servers
- GET /api/servers - List all servers
- GET /api/servers/:id - Get server details
- POST /api/servers - Create server (admin)
- POST /api/servers/start/:id - Start server
- POST /api/servers/stop/:id - Stop server
- POST /api/servers/restart/:id - Restart server
- DELETE /api/servers/:id - Delete server

### Join
- GET /api/join/:serverId - Get connection info

## Environment Variables

- PORT - Server port (default: 3001)
- JWT_SECRET - JWT signing secret
- JWT_EXPIRES_IN - Token expiration (default: 7d)
- RFD_PATH - Path to RFD.exe
- GAMES_DIR - Games directory
- THUMBNAILS_DIR - Thumbnails directory