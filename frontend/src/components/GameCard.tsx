'use client';

import Link from 'next/link';
import { Game } from '@/hooks/useGames';
import { getStatusBadgeClass } from '@/lib/utils';

interface GameCardProps {
  game: Game;
  featured?: boolean;
}

export default function GameCard({ game, featured = false }: GameCardProps) {
  return (
    <Link href={`/game/${game.id}`}>
      <div className={`
        card group cursor-pointer overflow-hidden
        ${featured ? 'aspect-video' : ''}
      `}>
        {/* Thumbnail */}
        <div className="relative aspect-video bg-roblox-darker rounded-lg overflow-hidden mb-4">
          {game.thumbnail ? (
            <img
              src={game.thumbnail}
              alt={game.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-6xl bg-gradient-to-br from-roblox-primary to-roblox-secondary">
              🎮
            </div>
          )}
          
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
            <span className="btn-primary text-sm">Play</span>
          </div>
          
          {/* Server count badge */}
          {(game.runningServers ?? 0) > 0 && (
            <div className="absolute top-3 right-3">
              <span className="badge badge-success">
                {game.runningServers} Online
              </span>
            </div>
          )}
        </div>

        {/* Info */}
        <h3 className="font-semibold text-lg truncate group-hover:text-roblox-accent transition-colors">
          {game.title}
        </h3>
        <p className="text-sm text-gray-400 truncate">{game.creator || 'Unknown Creator'}</p>
        
        {game.serverCount !== undefined && (
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-400">
            <span>🖥️</span>
            <span>{game.serverCount} servers</span>
          </div>
        )}
      </div>
    </Link>
  );
}