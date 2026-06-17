'use client';

import { use, useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import ServerCard from '@/components/ServerCard';
import { useGame } from '@/hooks/useGames';
import { useServerActions } from '@/hooks/useServers';
import { useAuth } from '@/hooks/useAuth';
import { launchGame, formatDate } from '@/lib/utils';
import Link from 'next/link';

export default function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const { game, loading, error, refetch } = useGame(resolvedParams.id);
  const { startServer, stopServer, restartServer, joinServer } = useServerActions();
  const { isAdmin } = useAuth();
  const [servers, setServers] = useState<any[]>([]);
  const [joining, setJoining] = useState<number | null>(null);

  useEffect(() => {
    if (game?.servers) {
      setServers(game.servers);
    }
  }, [game]);

  useEffect(() => {
    // Refresh game data periodically
    const interval = setInterval(refetch, 30000);
    return () => clearInterval(interval);
  }, [refetch]);

  const handleJoin = async (serverId: number) => {
    setJoining(serverId);
    try {
      const info = await joinServer(serverId);
      await launchGame(info.host, info.port);
    } catch (error) {
      console.error('Failed to join:', error);
      alert('Failed to join server. Please try again.');
    } finally {
      setJoining(null);
    }
  };

  const handleStartServer = async (gameId: number) => {
    try {
      // First create a server entry
      const res = await fetch(process.env.NEXT_PUBLIC_API_URL + '/api/servers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ game_id: gameId }),
      });
      const data = await res.json();
      if (data.success && data.server) {
        await startServer(data.server.id);
        refetch();
      }
    } catch (error) {
      console.error('Failed to start server:', error);
    }
  };

  const handleStopServer = async (serverId: number) => {
    await stopServer(serverId);
    refetch();
  };

  const handleRestartServer = async (serverId: number) => {
    await restartServer(serverId);
    refetch();
  };

  const runningServers = servers.filter(s => s.status === 'running');

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin w-12 h-12 border-4 border-roblox-accent border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  if (error || !game) {
    return (
      <Layout>
        <div className="p-8 text-center">
          <p className="text-4xl mb-4">😕</p>
          <h1 className="text-2xl font-bold mb-2">Game not found</h1>
          <p className="text-gray-400">{error || 'This game does not exist'}</p>
          <Link href="/discover" className="btn-secondary mt-4 inline-block">
            Browse Games
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8">
        {/* Game Header */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Thumbnail */}
          <div className="lg:col-span-1">
            <div className="aspect-video bg-roblox-darker rounded-xl overflow-hidden">
              {game.thumbnail ? (
                <img
                  src={game.thumbnail}
                  alt={game.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-8xl bg-gradient-to-br from-roblox-primary to-roblox-secondary">
                  🎮
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="lg:col-span-2">
            <h1 className="text-4xl font-bold mb-4">{game.title}</h1>
            
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2 text-gray-400">
                <span>👤</span>
                <span>Created by {game.creator || 'Unknown'}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <span>📅</span>
                <span>Added {formatDate(game.created_at)}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <span>🖥️</span>
                <span>{runningServers.length} of {servers.length} servers online</span>
              </div>
            </div>

            {game.description && (
              <p className="text-gray-300 mb-6">{game.description}</p>
            )}

            {/* Quick actions */}
            <div className="flex gap-4">
              {runningServers.length > 0 ? (
                <button
                  onClick={() => handleJoin(runningServers[0].id)}
                  disabled={joining !== null}
                  className="btn-primary text-lg px-8"
                >
                  {joining !== null ? 'Launching...' : 'Play'}
                </button>
              ) : (
                <button
                  onClick={() => handleStartServer(game.id)}
                  className="btn-primary text-lg px-8"
                >
                  Start Server
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Servers Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Servers</h2>
            {isAdmin && (
              <button
                onClick={() => handleStartServer(game.id)}
                className="btn-secondary"
              >
                + Add Server
              </button>
            )}
          </div>

          {servers.length === 0 ? (
            <div className="text-center py-12 bg-roblox-primary/30 rounded-xl">
              <p className="text-4xl mb-4">🖥️</p>
              <p className="text-gray-400">No servers available for this game</p>
              {isAdmin && (
                <button
                  onClick={() => handleStartServer(game.id)}
                  className="btn-primary mt-4"
                >
                  Create Server
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {servers.map(server => (
                <ServerCard
                  key={server.id}
                  server={server}
                  onJoin={() => handleJoin(server.id)}
                  onStart={isAdmin ? () => startServer(server.id) : undefined}
                  onStop={isAdmin ? () => handleStopServer(server.id) : undefined}
                  onRestart={isAdmin ? () => handleRestartServer(server.id) : undefined}
                  showActions={isAdmin}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}