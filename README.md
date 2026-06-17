# RFD - Roblox Freedom Distribution Platform

Web launcher dan panel management untuk server RFD yang berjalan di Windows dengan fokus Roblox 2021 client compatibility.

![RFD Platform](https://img.shields.io/badge/Platform-Windows-blue)
![Roblox](https://img.shields.io/badge/Roblox-2021-green)

## Fitur Utama

### 1. Authentication
- Register/Login dengan bcrypt password hashing
- User Code unik otomatis (contoh: U12345)
- JWT session management
- Rate limiting untuk login attempts

### 2. RFD Integration
- Konfigurasi lokasi RFD.exe
- Auto scan port server (2005, 53640, 53641, 53642)
- Auto detect GameConfig.toml
- Health check server

### 3. Join Game
```bash
RFD.exe player -h SERVER_IP -p SERVER_PORT -u USERCODE
```
- Generate launch command otomatis
- Copy to clipboard
- Join history tracking

### 4. Server Browser
- Display: Server Name, Host, Port, Players, Status
- Auto refresh setiap 10 detik
- Quick join untuk server yang running

### 5. Admin Panel
- Create/Start/Stop/Restart servers
- Real-time console viewer
- Upload .rbxl place files
- User management
- Audit logs
- Configuration management

### 6. Roblox 2021 Compatibility
- Multiple client profiles
- Custom client versions
- Launch arguments support
- Default client selection

## Tech Stack

- **Backend**: Node.js + Express
- **Database**: SQLite (better-sqlite3)
- **Frontend**: HTML + TailwindCSS + Vanilla JS
- **Auth**: JWT + bcrypt
- **Real-time**: Socket.IO

## Installation

### Prerequisites
- Node.js 18+
- npm atau yarn
- RFD.exe (untuk server management)

### Quick Start

1. **Clone/Download repository**
```bash
cd RFD
```

2. **Setup Backend**
```bash
cd backend
npm install
cp ../.env.example ../.env
npm run dev
```

3. **Setup Frontend**
Buka file `frontend/index.html` di browser, atau serve dengan static server:

```bash
# Using Python
cd frontend
python -m http.server 3000

# Using npx
npx serve frontend
```

4. **Login**
- Buka browser ke `http://localhost:3000`
- Login dengan default admin:
  - Username: `admin`
  - Password: `admin123`

## Windows Deployment Guide

### 1. Install Node.js
Download dan install Node.js 18+ dari https://nodejs.org/

### 2. Setup Project
```batch
cd C:\RFD
npm install
```

### 3. Create Start Script
Buat file `start.bat`:
```batch
@echo off
cd /d %~dp0
title RFD Platform
echo Starting RFD Platform...
npm run dev
pause
```

### 4. Auto-start with Windows
1. Tekan `Win + R`, ketik `shell:startup`
2. Buat shortcut ke `start.bat`

### 5. Firewall Setup
```batch
netsh advfirewall firewall add rule name="RFD Platform" dir=in action=allow protocol=tcp localport=3001
```

## Configuration

### GameConfig.toml Generator
Web menyediakan UI untuk generate `GameConfig.toml`:

```toml
# RFD Game Configuration

[Game]
Name = "My RFD Server"
Port = 53640
MaxPlayers = 100
PlaceId = 0

[Roblox]
Version = "0.485.0.452074"
PlaceFile = "path/to/place.rbxl"
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3001 | Server port |
| JWT_SECRET | (random) | JWT signing secret |
| FRONTEND_URL | http://localhost:3000 | CORS origin |

## API Reference

### Authentication
```
POST /api/auth/register - Register new user
POST /api/auth/login    - Login
POST /api/auth/logout   - Logout
GET  /api/auth/profile  - Get profile
PUT  /api/auth/profile  - Update profile
```

### Servers
```
GET    /api/servers           - List all servers
POST   /api/servers           - Create server (admin)
GET    /api/servers/:id       - Get server details
PUT    /api/servers/:id       - Update server (admin)
DELETE /api/servers/:id       - Delete server (admin)
POST   /api/servers/:id/start - Start server (admin)
POST   /api/servers/:id/stop  - Stop server (admin)
GET    /api/servers/scan/ports - Scan available ports
```

### Game
```
POST /api/join    - Get join info & command
GET  /api/stats  - Dashboard statistics
```

### Admin
```
GET    /api/config          - Get all config
POST   /api/config/bulk     - Update config
GET    /api/clients          - List Roblox clients
POST   /api/clients          - Add client (admin)
POST   /api/upload/place     - Upload place file
GET    /api/audit-logs       - Get audit logs
GET    /api/users            - List all users
GET    /api/detect-rfd       - Auto-detect RFD installation
POST   /api/generate-config  - Generate GameConfig.toml
```

## Security Features

- **Rate Limiting**: 5 login attempts per minute per IP
- **JWT Auth**: 24-hour token expiration
- **Password Hashing**: bcrypt with salt rounds
- **Input Validation**: Username/password validation
- **Audit Logging**: All actions logged
- **CORS Protection**: Configurable origins

## Project Structure

```
RFD/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js      # Authentication routes
│   │   │   ├── servers.js    # Server management routes
│   │   │   └── api.js        # General API routes
│   │   ├── middleware/
│   │   │   └── auth.js       # Auth middleware
│   │   ├── services/
│   │   │   ├── database.js      # SQLite service
│   │   │   └── serverManager.js # RFD process manager
│   │   └── server.js         # Main entry point
│   └── package.json
├── frontend/
│   ├── index.html         # Main HTML
│   ├── css/
│   │   └── styles.css     # Custom styles
│   └── js/
│       └── app.js         # Frontend logic
├── database/              # SQLite database (auto-created)
├── config/                # Config files
├── uploads/               # Uploaded place files
├── logs/                  # Server logs
└── README.md
```

## Troubleshooting

### "Failed to fetch" Error
1. Pastikan backend server running di port 3001
2. Cek CORS configuration
3. Pastikan tidak ada firewall blocking

### Server tidak start
1. Pastikan RFD.exe path benar
2. Cek port belum digunakan
3. Lihat console logs untuk error details

### Database error
1. Hapus file `database/rfd.db`
2. Restart server - database akan dibuat ulang

## Default Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | admin123 |

⚠️ **PENTING**: Ganti password admin setelah pertama login!

## License

MIT License - Bebas digunakan untuk project apapun.

## Support

Untuk bug reports atau feature requests, buat issue di repository.
