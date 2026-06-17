/**
 * RCCService (Roblox Cloud Compute) Adapter
 * 
 * Implementation of BackendAdapter for RCCService backend.
 * This adapter is for future use with Roblox's cloud compute infrastructure.
 */

const BackendAdapter = require('./Adapter');
const http = require('http');
const https = require('https');

class RCCAdapter extends BackendAdapter {
  constructor(config = {}) {
    super(config);
    this.endpoint = config.endpoint || 'http://localhost:3000';
    this.apiKey = config.apiKey || '';
    this.agent = this.endpoint.startsWith('https') ? https : http;
  }

  /**
   * Initialize the RCC adapter
   */
  async initialize() {
    // Test connection
    try {
      await this.request('/health', 'GET');
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('RCC connection failed:', error.message);
      return false;
    }
  }

  /**
   * Make request to RCC API
   */
  async request(path, method = 'GET', data = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.endpoint);
      
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        timeout: 30000
      };

      const req = this.agent.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body));
            } catch {
              resolve(body);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${body}`));
          }
        });
      });

      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));

      if (data) {
        req.write(JSON.stringify(data));
      }
      req.end();
    });
  }

  /**
   * Start a server instance
   */
  async startServer(config) {
    const result = await this.request('/api/servers', 'POST', config);
    return result;
  }

  /**
   * Stop a server instance
   */
  async stopServer(serverId) {
    await this.request(`/api/servers/${serverId}`, 'DELETE');
    return true;
  }

  /**
   * Restart a server instance
   */
  async restartServer(serverId) {
    const result = await this.request(`/api/servers/${serverId}/restart`, 'POST');
    return result;
  }

  /**
   * Get server status
   */
  async getServerStatus(serverId) {
    return await this.request(`/api/servers/${serverId}/status`, 'GET');
  }

  /**
   * Get server logs
   */
  async getServerLogs(serverId, lines = 100) {
    const result = await this.request(`/api/servers/${serverId}/logs?lines=${lines}`, 'GET');
    return result.logs || [];
  }

  /**
   * Execute command on server console
   */
  async executeCommand(serverId, command) {
    const result = await this.request(`/api/servers/${serverId}/console`, 'POST', { command });
    return result.output || '';
  }

  /**
   * Get online players
   */
  async getOnlinePlayers(serverId) {
    const result = await this.request(`/api/servers/${serverId}/players`, 'GET');
    return result.players || [];
  }

  /**
   * Kick a player
   */
  async kickPlayer(serverId, playerId, reason = '') {
    await this.request(`/api/servers/${serverId}/players/${playerId}/kick`, 'POST', { reason });
    return true;
  }

  /**
   * Send data to player
   */
  async sendToPlayer(serverId, playerId, data) {
    await this.request(`/api/servers/${serverId}/players/${playerId}/data`, 'POST', data);
    return true;
  }

  /**
   * Load a place file
   */
  async loadPlace(serverId, placePath) {
    await this.request(`/api/servers/${serverId}/place`, 'POST', { path: placePath });
    return true;
  }

  /**
   * Get GameConfig
   */
  async getGameConfig(serverId) {
    const result = await this.request(`/api/servers/${serverId}/config`, 'GET');
    return result.config;
  }

  /**
   * Set GameConfig
   */
  async setGameConfig(serverId, config) {
    await this.request(`/api/servers/${serverId}/config`, 'PUT', config);
    return true;
  }

  /**
   * Get asset
   */
  async getAsset(assetId) {
    return await this.request(`/api/assets/${assetId}`, 'GET');
  }

  /**
   * Cache an asset
   */
  async cacheAsset(assetId, url) {
    await this.request('/api/assets', 'POST', { id: assetId, url });
    return true;
  }

  /**
   * Get cached assets
   */
  async getCachedAssets(options = {}) {
    const params = new URLSearchParams(options).toString();
    const result = await this.request(`/api/assets?${params}`, 'GET');
    return result.assets || [];
  }

  /**
   * Delete cached asset
   */
  async deleteCachedAsset(assetId) {
    await this.request(`/api/assets/${assetId}`, 'DELETE');
    return true;
  }

  /**
   * Get console stream (polling mode)
   */
  getConsoleStream(serverId) {
    // RCC may not support streaming, return empty array
    return [];
  }

  /**
   * Register console output listener (polling mode)
   */
  onConsoleOutput(callback) {
    // Would need to implement polling here
    this.on('console', callback);
  }

  /**
   * Detect installation
   */
  async detectInstallation() {
    return {
      found: true,
      endpoint: this.endpoint,
      version: 'RCC/1.0'
    };
  }

  /**
   * Get version
   */
  async getVersion() {
    const result = await this.request('/version', 'GET');
    return result.version;
  }

  /**
   * Get resource usage
   */
  async getResourceUsage() {
    return await this.request('/api/stats/resources', 'GET');
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      await this.request('/health', 'GET');
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = RCCAdapter;
