const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('rfd_token', token);
      } else {
        localStorage.removeItem('rfd_token');
      }
    }
  }

  getToken(): string | null {
    if (!this.token && typeof window !== 'undefined') {
      this.token = localStorage.getItem('rfd_token');
    }
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  // Auth
  async login(username: string, password: string, rememberMe = false) {
    const res = await this.request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password, rememberMe }),
    });
    if (res.token) this.setToken(res.token);
    return res;
  }

  async register(username: string, password: string, email?: string) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, email }),
    });
  }

  async logout() {
    try { await this.request('/auth/logout', { method: 'POST' }); } finally { this.setToken(null); }
  }

  async getMe() { return this.request<{ user: any }>('/auth/me'); }
  async updateProfile(data: any) { return this.request('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }); }

  // Servers
  async getServers(params?: any) {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request(`/servers${q}`);
  }
  async getServer(id: number) { return this.request(`/servers/${id}`); }
  async createServer(data: any) { return this.request('/servers', { method: 'POST', body: JSON.stringify(data) }); }
  async updateServer(id: number, data: any) { return this.request(`/servers/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
  async deleteServer(id: number) { return this.request(`/servers/${id}`, { method: 'DELETE' }); }
  async startServer(id: number) { return this.request(`/servers/${id}/start`, { method: 'POST' }); }
  async stopServer(id: number) { return this.request(`/servers/${id}/stop`, { method: 'POST' }); }
  async restartServer(id: number) { return this.request(`/servers/${id}/restart`, { method: 'POST' }); }
  async getServerLogs(id: number, lines = 100) { return this.request(`/servers/${id}/logs?lines=${lines}`); }
  async getServerConsole(id: number, lines = 100) { return this.request(`/servers/${id}/console?lines=${lines}`); }
  async sendServerCommand(id: number, command: string) { return this.request(`/servers/${id}/console`, { method: 'POST', body: JSON.stringify({ command }) }); }
  async clearServerConsole(id: number) { return this.request(`/servers/${id}/console/clear`, { method: 'POST' }); }
  async getServerPlayers(id: number) { return this.request(`/servers/${id}/players`); }
  async getServerStatus(id: number) { return this.request(`/servers/${id}/status`); }

  // Games
  async getGames(params?: any) {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request(`/games${q}`);
  }
  async getGame(id: number) { return this.request(`/games/${id}`); }
  async createGame(data: any) { return this.request('/games', { method: 'POST', body: JSON.stringify(data) }); }
  async updateGame(id: number, data: any) { return this.request(`/games/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
  async deleteGame(id: number) { return this.request(`/games/${id}`, { method: 'DELETE' }); }
  async getGameConfig(id: number) { return this.request(`/games/${id}/config`); }
  async updateGameConfig(id: number, config: any) { return this.request(`/games/${id}/config`, { method: 'PUT', body: JSON.stringify({ config }) }); }

  // Players
  async getPlayers(serverId?: number) { return this.request(`/players${serverId ? `?serverId=${serverId}` : ''}`); }
  async getPlayer(id: number) { return this.request(`/players/${id}`); }
  async searchPlayers(q: string) { return this.request(`/players/search?q=${encodeURIComponent(q)}`); }
  async getPlayerFriends(id: number) { return this.request(`/players/${id}/friends`); }
  async sendFriendRequest(id: number) { return this.request(`/players/${id}/friend`, { method: 'POST' }); }
  async removeFriend(id: number) { return this.request(`/players/${id}/friend`, { method: 'DELETE' }); }
  async getMessages(id: number) { return this.request(`/players/${id}/messages`); }
  async sendMessage(id: number, content: string) { return this.request(`/players/${id}/messages`, { method: 'POST', body: JSON.stringify({ content }) }); }
  async getPlayerAvatar(id: number) { return this.request(`/players/${id}/avatar`); }

  // Admin
  async getAdminUsers() { return this.request('/admin/users'); }
  async banUser(id: number, reason?: string) { return this.request(`/admin/users/${id}/ban`, { method: 'POST', body: JSON.stringify({ reason }) }); }
  async unbanUser(id: number) { return this.request(`/admin/users/${id}/unban`, { method: 'POST' }); }
  async promoteUser(id: number) { return this.request(`/admin/users/${id}/promote`, { method: 'POST' }); }
  async demoteUser(id: number) { return this.request(`/admin/users/${id}/demote`, { method: 'POST' }); }
  async getAdminLogs(limit?: number) { return this.request(`/admin/logs${limit ? `?limit=${limit}` : ''}`); }
  async broadcast(title: string, message: string, priority?: string) { return this.request('/admin/broadcast', { method: 'POST', body: JSON.stringify({ title, message, priority }) }); }
  async setMaintenanceMode(enabled: boolean) { return this.request('/admin/maintenance', { method: 'POST', body: JSON.stringify({ enabled }) }); }
  async getBackups() { return this.request('/admin/backups'); }
  async createBackup(type = 'all') { return this.request('/admin/backups', { method: 'POST', body: JSON.stringify({ type }) }); }
  async restoreBackup(id: number) { return this.request(`/admin/backups/${id}/restore`, { method: 'POST' }); }
  async deleteBackup(id: number) { return this.request(`/admin/backups/${id}`, { method: 'DELETE' }); }
  async getAdminSystem() { return this.request('/admin/system'); }

  // Stats
  async getStats() { return this.request('/stats'); }
  async getPlayerStats() { return this.request('/stats/players'); }
  async getServerStats() { return this.request('/stats/servers'); }
  async getResourceStats() { return this.request('/stats/resources'); }
  async getHistoricalStats(hours?: number) { return this.request(`/stats/history${hours ? `?hours=${hours}` : ''}`); }

  // Assets
  async getAssets(params?: any) {
    const q = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request(`/assets${q}`);
  }
  async deleteAsset(id: string) { return this.request(`/assets/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
  async clearAssets() { return this.request('/assets/clear', { method: 'POST' }); }

  // Config
  async getConfig() { return this.request('/config'); }
  async updateConfig(key: string, value: any, type?: string) { return this.request(`/config/${key}`, { method: 'PUT', body: JSON.stringify({ value, type }) }); }
}

export const api = new ApiClient();
export default api;
