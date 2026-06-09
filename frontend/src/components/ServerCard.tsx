'use client';

import { Server } from '@/hooks/useServers';
import { formatUptime, launchGame, getStatusBadgeClass, classNames } from '@/lib/utils';

interface ServerCardProps {
  server: Server;
  onJoin?: () => void;
  onStart?: () => void;
  onStop?: () => void;
  onRestart?: () => void;
  showActions?: boolean;
}

export default function ServerCard({ 
  server, 
  onJoin, 
  onStart, 
  onStop, 
  onRestart,
  showActions = false 
}: ServerCardProps) {
  const players = typeof server.players === 'string' 
    ? JSON.parse(server.players || '[]') 
    : server.players;
  
  const playerCount = Array.isArray(players) ? players.length : 0;

  const handleJoin = async () => {
    if (server.status !== 'running') return;
    
    try {
      await launchGame('127.0.0.1', server.port);
      onJoin?.();
    } catch (error) {
      console.error('Failed to launch game:', error);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Status indicator */}
          <div className={classNames(
            'status-dot',
            server.status === 'running' ? 'online' : 'offline'
          )} />
          
          {/* Server info */}
          <div>
            <h4 className="font-semibold">
              {server.game_title || `Server #${server.id}`}
            </h4>
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <span>Port: {server.port}</span>
              <span>•</span>
              <span>Players: {playerCount}/{server.max_players || 20}</span>
              {server.status === 'running' && server.uptime > 0 && (
                <>
                  <span>•</span>
                  <span>Uptime: {formatUptime(server.uptime)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <span className={classNames('badge', getStatusBadgeClass(server.status))}>
            {server.status}
          </span>
          
          {showActions ? (
            <div className="flex gap-2 ml-4">
              {server.status !== 'running' ? (
                <button onClick={onStart} className="btn-secondary text-sm py-1 px-3">
                  Start
                </button>
              ) : (
                <>
                  <button onClick={onJoin} className="btn-primary text-sm py-1 px-3">
                    Join
                  </button>
                  <button onClick={onRestart} className="btn-ghost text-sm py-1 px-3">
                    ↻
                  </button>
                  <button onClick={onStop} className="btn-ghost text-sm py-1 px-3 text-red-400">
                    ■
                  </button>
                </>
              )}
            </div>
          ) : (
            server.status === 'running' && (
              <button onClick={handleJoin} className="btn-primary text-sm py-1 px-3">
                Join
              </button>
            )
          )}
        </div>
      </div>

      {/* Player list */}
      {server.status === 'running' && playerCount > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-xs text-gray-400 mb-2">Players Online</p>
          <div className="flex flex-wrap gap-2">
            {players.map((player: any, index: number) => (
              <span key={index} className="px-2 py-1 bg-roblox-secondary rounded text-sm">
                {player.name || 'Player'}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}