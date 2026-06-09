'use client';

import { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import ServerCard from '@/components/ServerCard';
import { useServers, useServerActions } from '@/hooks/useServers';
import { launchGame } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

export default function ServersPage() {
  const { servers, loading, error, refetch } = useServers();
  const { joinServer } = useServerActions();
  const { isAdmin } = useAuth();
  const [filter, setFilter] = useState<'all' | 'running' | 'stopped'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [joining, setJoining] = useState<number | null>(null);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(refetch, 5000);
    return () => clearInterval(interval);
  }, [refetch]);

  const filteredServers = servers
    .filter(server => {
      if (filter === 'running') return server.status === 'running';
      if (filter === 'stopped') return server.status !== 'running';
      return true;
    })
    .filter(server =>
      (server.game_title || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

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

  const runningCount = servers.filter(s => s.status === 'running').length;
  const totalPlayers = servers
    .filter(s => s.status === 'running')
    .reduce((acc, s) => acc + (s.playerCount || 0), 0);

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-4">Server Browser</h1>
          
          {/* Stats */}
          <div className="flex gap-6 mb-6">
            <div className="card px-6 py-4 text-center">
              <div className="text-2xl font-bold text-green-400">{runningCount}</div>
              <div className="text-sm text-gray-400">Online</div>
            </div>
            <div className="card px-6 py-4 text-center">
              <div className="text-2xl font-bold">{totalPlayers}</div>
              <div className="text-sm text-gray-400">Players</div>
            </div>
            <div className="card px-6 py-4 text-center">
              <div className="text-2xl font-bold">{servers.length}</div>
              <div className="text-sm text-gray-400">Total</div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="flex-1 min-w-[300px]">
              <input
                type="text"
                placeholder="Search servers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input"
              />
            </div>

            {/* Filter buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filter === 'all'
                    ? 'bg-roblox-accent text-white'
                    : 'bg-roblox-primary text-gray-300 hover:bg-white/10'
                }`}
              >
                All ({servers.length})
              </button>
              <button
                onClick={() => setFilter('running')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filter === 'running'
                    ? 'bg-green-500 text-white'
                    : 'bg-roblox-primary text-gray-300 hover:bg-white/10'
                }`}
              >
                Online ({runningCount})
              </button>
              <button
                onClick={() => setFilter('stopped')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filter === 'stopped'
                    ? 'bg-gray-500 text-white'
                    : 'bg-roblox-primary text-gray-300 hover:bg-white/10'
                }`}
              >
                Offline ({servers.length - runningCount})
              </button>
            </div>

            {/* Refresh */}
            <button
              onClick={refetch}
              className="btn-ghost"
              disabled={loading}
            >
              {loading ? '⟳' : '↻'} Refresh
            </button>
          </div>
        </div>

        {/* Servers List */}
        {loading && servers.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-roblox-accent border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-400">Failed to load servers</p>
            <p className="text-gray-400 text-sm mt-2">{error}</p>
          </div>
        ) : filteredServers.length === 0 ? (
          <div className="text-center py-12 bg-roblox-primary/30 rounded-xl">
            <p className="text-4xl mb-4">🖥️</p>
            <p className="text-gray-400">No servers found</p>
            {filter !== 'all' && (
              <button
                onClick={() => setFilter('all')}
                className="btn-secondary mt-4"
              >
                Show all servers
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-400 border-b border-white/10">
                  <th className="pb-4 font-medium">Status</th>
                  <th className="pb-4 font-medium">Game</th>
                  <th className="pb-4 font-medium">Port</th>
                  <th className="pb-4 font-medium">Players</th>
                  <th className="pb-4 font-medium">Uptime</th>
                  <th className="pb-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredServers.map(server => (
                  <tr key={server.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <div className={`status-dot ${server.status === 'running' ? 'online' : 'offline'}`} />
                        <span className={`badge ${getStatusBadge(server.status)}`}>
                          {server.status}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 font-medium">
                      {server.game_title || `Server #${server.id}`}
                    </td>
                    <td className="py-4 text-gray-400">
                      {server.port}
                    </td>
                    <td className="py-4">
                      <div className="flex items-center gap-2">
                        <span>{server.playerCount || 0}</span>
                        <span className="text-gray-600">/</span>
                        <span>{server.max_players || 20}</span>
                      </div>
                    </td>
                    <td className="py-4 text-gray-400">
                      {server.status === 'running' && server.uptime > 0
                        ? formatUptime(server.uptime)
                        : '-'}
                    </td>
                    <td className="py-4">
                      {server.status === 'running' ? (
                        <button
                          onClick={() => handleJoin(server.id)}
                          disabled={joining === server.id}
                          className="btn-primary text-sm"
                        >
                          {joining === server.id ? 'Joining...' : 'Join'}
                        </button>
                      ) : isAdmin ? (
                        <span className="text-gray-500 text-sm">Offline</span>
                      ) : (
                        <span className="text-gray-500 text-sm">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'running':
      return 'badge-success';
    case 'starting':
      return 'badge-warning';
    default:
      return 'bg-gray-500/20 text-gray-400';
  }
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}