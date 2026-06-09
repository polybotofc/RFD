# Frontend

## Pages

- `/` - Homepage with featured games and stats
- `/discover` - Game discovery and search
- `/game/[id]` - Individual game page with servers
- `/servers` - Server browser
- `/admin` - Admin dashboard
- `/login` - User login
- `/register` - User registration

## Components

- Layout - Main layout with sidebar
- GameCard - Game display card
- ServerCard - Server display card
- LogViewer - Real-time log viewer
- StatsBar - Platform statistics

## Hooks

- useAuth - Authentication context
- useSocket - Socket.IO connection
- useGames - Game data fetching
- useServers - Server data fetching

## Environment Variables

- NEXT_PUBLIC_API_URL - Backend API URL
- NEXT_PUBLIC_SOCKET_URL - Socket.IO server URL