const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return this.token;
  }

  private async request<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
    const token = this.getToken();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `Request failed with status ${response.status}`);
    }

    return response.json();
  }

  // Auth endpoints
  async register(username: string, password: string) {
    return this.request<any>('/api/auth/register', {
      method: 'POST',
      body: { username, password },
    });
  }

  async login(username: string, password: string) {
    return this.request<any>('/api/auth/login', {
      method: 'POST',
      body: { username, password },
    });
  }

  async logout() {
    return this.request<any>('/api/auth/logout', {
      method: 'POST',
    });
  }

  async getMe() {
    return this.request<any>('/api/auth/me');
  }

  async getUsers() {
    return this.request<any>('/api/auth/users');
  }

  // Games endpoints
  async getGames() {
    return this.request<any>('/api/games');
  }

  async getGame(id: string | number) {
    return this.request<any>(`/api/games/${id}`);
  }

  async createGame(game: any) {
    return this.request<any>('/api/games', {
      method: 'POST',
      body: game,
    });
  }

  async updateGame(id: string | number, updates: any) {
    return this.request<any>(`/api/games/${id}`, {
      method: 'PUT',
      body: updates,
    });
  }

  async deleteGame(id: string | number) {
    return this.request<any>(`/api/games/${id}`, {
      method: 'DELETE',
    });
  }

  // Servers endpoints
  async getServers() {
    return this.request<any>('/api/servers');
  }

  async getServer(id: string | number) {
    return this.request<any>(`/api/servers/${id}`);
  }

  async getGameServers(gameId: string | number) {
    return this.request<any>(`/api/servers/game/${gameId}`);
  }

  async createServer(gameId: number, port?: number) {
    return this.request<any>('/api/servers', {
      method: 'POST',
      body: { game_id: gameId, port },
    });
  }

  async startServer(id: string | number) {
    return this.request<any>(`/api/servers/start/${id}`, {
      method: 'POST',
    });
  }

  async stopServer(id: string | number) {
    return this.request<any>(`/api/servers/stop/${id}`, {
      method: 'POST',
    });
  }

  async restartServer(id: string | number) {
    return this.request<any>(`/api/servers/restart/${id}`, {
      method: 'POST',
    });
  }

  async deleteServer(id: string | number) {
    return this.request<any>(`/api/servers/${id}`, {
      method: 'DELETE',
    });
  }

  // Join endpoint
  async joinServer(serverId: string | number) {
    return this.request<any>(`/api/join/${serverId}`);
  }

  // Stats endpoint
  async getStats() {
    return this.request<any>('/api/stats');
  }

  // Logs endpoint
  async getLogs(serverId: string | number, limit = 100) {
    return this.request<any>(`/api/logs/${serverId}?limit=${limit}`);
  }
}

export const api = new ApiClient();
export default api;