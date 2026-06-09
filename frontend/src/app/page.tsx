'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import GameCard from '@/components/GameCard';
import StatsBar from '@/components/StatsBar';
import { useGames } from '@/hooks/useGames';
import { useServers, useServerActions } from '@/hooks/useServers';
import { useAuth } from '@/hooks/useAuth';
import Link from 'next/link';

export default function HomePage() {
  const { games, loading: gamesLoading } = useGames();
  const { servers, loading: serversLoading } = useServers();
  const { user, isAdmin } = useAuth();
  const [featuredGames, setFeaturedGames] = useState<any[]>([]);
  const [popularGames, setPopularGames] = useState<any[]>([]);

  useEffect(() => {
    if (games.length > 0) {
      // Featured: first 4 games with servers
      setFeaturedGames(games.filter(g => (g.runningServers || 0) > 0).slice(0, 4));
      // Popular: all games sorted by server count
      setPopularGames([...games].sort((a, b) => ((b.runningServers || 0)) - ((a.runningServers || 0))));
    }
  }, [games]);

  const runningServers = servers.filter(s => s.status === 'running');

  return (
    <Layout>
      <div className="p-8">
        {/* Hero section */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-roblox-primary to-purple-900 p-8 mb-8">
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative z-10">
            <h1 className="text-4xl font-bold mb-4">
              Welcome to RFD Platform
            </h1>
            <p className="text-xl text-gray-300 mb-6">
              Your private Roblox Freedom Distribution network
            </p>
            {!user ? (
              <div className="flex gap-4">
                <Link href="/register" className="btn-primary">
                  Get Started
                </Link>
                <Link href="/discover" className="btn-secondary">
                  Browse Games
                </Link>
              </div>
            ) : (
              <Link href="/discover" className="btn-primary">
                Play Now
              </Link>
            )}
          </div>
          <div className="absolute -right-20 -top-20 text-9xl opacity-10">
            🎮
          </div>
        </div>

        {/* Stats */}
        <div className="mb-8">
          <StatsBar />
        </div>

        {/* Running Servers */}
        {runningServers.length > 0 && (
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Active Servers</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {runningServers.slice(0, 6).map(server => (
                <div key={server.id} className="card">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="status-dot online" />
                    <span className="font-semibold">{server.game_title || `Server #${server.id}`}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-400">
                    <span>Port: {server.port}</span>
                    <span>Players: {server.playerCount || 0}/{server.max_players || 20}</span>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/servers" className="inline-block mt-4 text-roblox-accent hover:underline">
              View all servers →
            </Link>
          </section>
        )}

        {/* Featured Games */}
        {featuredGames.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Featured Games</h2>
              <Link href="/discover" className="text-roblox-accent hover:underline">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {featuredGames.map(game => (
                <GameCard key={game.id} game={game} featured />
              ))}
            </div>
          </section>
        )}

        {/* Popular Games */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">All Games</h2>
            <Link href="/discover" className="text-roblox-accent hover:underline">
              Browse →
            </Link>
          </div>
          {gamesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-roblox-accent border-t-transparent rounded-full" />
            </div>
          ) : games.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-4xl mb-4">🎮</p>
              <p>No games available yet</p>
              {isAdmin && (
                <Link href="/admin" className="btn-primary mt-4 inline-block">
                  Upload a game
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {popularGames.map(game => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}