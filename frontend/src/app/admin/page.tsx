'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Layout from '@/components/Layout';
import LogViewer from '@/components/LogViewer';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/api';
import { formatDate } from '@/lib/utils';

type Tab = 'overview' | 'games' | 'servers' | 'users' | 'logs';

export default function AdminPage() {
  const router = useRouter();
  const { user, isAdmin, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [games, setGames] = useState<any[]>([]);
  const [servers, setServers] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Redirect if not admin
  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push('/');
    }
  }, [user, isAdmin, loading, router]);

  // Fetch data based on active tab
  useEffect(() => {
    if (!isAdmin) return;
    
    const fetchData = async () => {
      setLoadingData(true);
      try {
        switch (activeTab) {
          case 'games':
            const gamesRes = await api.getGames();
            setGames(gamesRes.games);
            break;
          case 'servers':
            const serversRes = await api.getServers();
            setServers(serversRes.servers);
            break;
          case 'users':
            const usersRes = await api.getUsers();
            setUsers(usersRes.users);
            break;
        }
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [activeTab, isAdmin]);

  const handleStartServer = async (serverId: number) => {
    try {
      await api.startServer(serverId);
      const serversRes = await api.getServers();
      setServers(serversRes.servers);
    } catch (error) {
      console.error('Failed to start server:', error);
    }
  };

  const handleStopServer = async (serverId: number) => {
    try {
      await api.stopServer(serverId);
      const serversRes = await api.getServers();
      setServers(serversRes.servers);
    } catch (error) {
      console.error('Failed to stop server:', error);
    }
  };

  const handleDeleteGame = async (gameId: number) => {
    if (!confirm('Are you sure you want to delete this game?')) return;
    try {
      await api.deleteGame(gameId);
      setGames(games.filter(g => g.id !== gameId));
    } catch (error) {
      console.error('Failed to delete game:', error);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin w-12 h-12 border-4 border-roblox-accent border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const stats = {
    games: games.length,
    servers: servers.length,
    runningServers: servers.filter(s => s.status === 'running').length,
    users: users.length,
  };

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-gray-400">Manage your RFD Platform</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-white/10">
          {(['overview', 'games', 'servers', 'users', 'logs'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 capitalize transition-colors ${
                activeTab === tab
                  ? 'text-roblox-accent border-b-2 border-roblox-accent'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card">
              <div className="text-3xl mb-2">🎮</div>
              <div className="text-2xl font-bold">{stats.games}</div>
              <div className="text-sm text-gray-400">Total Games</div>
            </div>
            <div className="card">
              <div className="text-3xl mb-2">🖥️</div>
              <div className="text-2xl font-bold">{stats.servers}</div>
              <div className="text-sm text-gray-400">Total Servers</div>
            </div>
            <div className="card">
              <div className="text-3xl mb-2">✅</div>
              <div className="text-2xl font-bold text-green-400">{stats.runningServers}</div>
              <div className="text-sm text-gray-400">Running Servers</div>
            </div>
            <div className="card">
              <div className="text-3xl mb-2">👤</div>
              <div className="text-2xl font-bold">{stats.users}</div>
              <div className="text-sm text-gray-400">Total Users</div>
            </div>
          </div>
        )}

        {activeTab === 'games' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Games Management</h2>
              <button className="btn-primary">+ Add Game</button>
            </div>
            
            {loadingData ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-roblox-accent border-t-transparent rounded-full" />
              </div>
            ) : games.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-4">🎮</p>
                <p>No games uploaded yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-white/10">
                      <th className="pb-4 font-medium">ID</th>
                      <th className="pb-4 font-medium">Title</th>
                      <th className="pb-4 font-medium">Creator</th>
                      <th className="pb-4 font-medium">Servers</th>
                      <th className="pb-4 font-medium">Created</th>
                      <th className="pb-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {games.map(game => (
                      <tr key={game.id} className="border-b border-white/5">
                        <td className="py-4 text-gray-400">{game.id}</td>
                        <td className="py-4 font-medium">{game.title}</td>
                        <td className="py-4 text-gray-400">{game.creator || 'Unknown'}</td>
                        <td className="py-4">
                          <span className="badge badge-info">{game.serverCount || 0}</span>
                        </td>
                        <td className="py-4 text-gray-400">{formatDate(game.created_at)}</td>
                        <td className="py-4">
                          <div className="flex gap-2">
                            <button className="btn-ghost text-sm">Edit</button>
                            <button 
                              onClick={() => handleDeleteGame(game.id)}
                              className="btn-ghost text-sm text-red-400"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'servers' && (
          <div>
            <h2 className="text-xl font-bold mb-4">Servers Management</h2>
            
            {loadingData ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-roblox-accent border-t-transparent rounded-full" />
              </div>
            ) : servers.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="text-4xl mb-4">🖥️</p>
                <p>No servers created yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-white/10">
                      <th className="pb-4 font-medium">ID</th>
                      <th className="pb-4 font-medium">Game</th>
                      <th className="pb-4 font-medium">Port</th>
                      <th className="pb-4 font-medium">Status</th>
                      <th className="pb-4 font-medium">Players</th>
                      <th className="pb-4 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {servers.map(server => (
                      <tr key={server.id} className="border-b border-white/5">
                        <td className="py-4 text-gray-400">{server.id}</td>
                        <td className="py-4 font-medium">{server.game_title || `Server #${server.id}`}</td>
                        <td className="py-4 text-gray-400">{server.port}</td>
                        <td className="py-4">
                          <span className={`badge ${server.status === 'running' ? 'badge-success' : 'bg-gray-500/20 text-gray-400'}`}>
                            {server.status}
                          </span>
                        </td>
                        <td className="py-4">
                          {server.playerCount || 0} / {server.max_players || 20}
                        </td>
                        <td className="py-4">
                          <div className="flex gap-2">
                            {server.status !== 'running' ? (
                              <button 
                                onClick={() => handleStartServer(server.id)}
                                className="btn-secondary text-sm"
                              >
                                Start
                              </button>
                            ) : (
                              <button 
                                onClick={() => handleStopServer(server.id)}
                                className="btn-ghost text-sm text-red-400"
                              >
                                Stop
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div>
            <h2 className="text-xl font-bold mb-4">User Management</h2>
            
            {loadingData ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-roblox-accent border-t-transparent rounded-full" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-gray-400 border-b border-white/10">
                      <th className="pb-4 font-medium">ID</th>
                      <th className="pb-4 font-medium">Username</th>
                      <th className="pb-4 font-medium">Role</th>
                      <th className="pb-4 font-medium">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id} className="border-b border-white/5">
                        <td className="py-4 text-gray-400">{user.id}</td>
                        <td className="py-4 font-medium">{user.username}</td>
                        <td className="py-4">
                          <span className={`badge ${user.is_admin ? 'badge-warning' : 'badge-info'}`}>
                            {user.is_admin ? 'Admin' : 'User'}
                          </span>
                        </td>
                        <td className="py-4 text-gray-400">{formatDate(user.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'logs' && (
          <div>
            <h2 className="text-xl font-bold mb-4">Server Logs</h2>
            <LogViewer autoJoin />
          </div>
        )}
      </div>
    </Layout>
  );
}