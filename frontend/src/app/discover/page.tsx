'use client';

import { useState } from 'react';
import Layout from '@/components/Layout';
import GameCard from '@/components/GameCard';
import { useGames } from '@/hooks/useGames';

export default function DiscoverPage() {
  const { games, loading, error } = useGames();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'title' | 'newest' | 'servers'>('newest');

  const filteredGames = games
    .filter(game => 
      game.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.description.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'servers':
          return (b.runningServers || 0) - (a.runningServers || 0);
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">Discover Games</h1>
          
          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="flex-1 min-w-[300px]">
              <input
                type="text"
                placeholder="Search games..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input"
              />
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-roblox-primary border border-white/20 rounded-lg px-4 py-3 text-white"
            >
              <option value="newest">Newest First</option>
              <option value="title">Alphabetical</option>
              <option value="servers">Most Servers</option>
            </select>
          </div>
        </div>

        {/* Games Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-roblox-accent border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-400">Failed to load games</p>
            <p className="text-gray-400 text-sm mt-2">{error}</p>
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            {games.length === 0 ? (
              <>
                <p className="text-4xl mb-4">🔍</p>
                <p>No games available</p>
              </>
            ) : (
              <>
                <p className="text-4xl mb-4">🔍</p>
                <p>No games match your search</p>
                <button
                  onClick={() => setSearchQuery('')}
                  className="btn-secondary mt-4"
                >
                  Clear search
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {filteredGames.map(game => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        )}

        {/* Results count */}
        {!loading && filteredGames.length > 0 && (
          <p className="text-center text-gray-400 mt-8">
            Showing {filteredGames.length} of {games.length} games
          </p>
        )}
      </div>
    </Layout>
  );
}