/**
 * Base Backend Adapter Interface
 * 
 * This abstract class defines the contract for all backend adapters.
 * Each adapter implements communication with a specific backend (RFD, RCCService, etc.)
 * 
 * The website uses this interface to interact with any backend without
 * needing to know the specific implementation details.
 */

class BackendAdapter {
  constructor(config = {}) {
    this.config = config;
    this.initialized = false;
    this.listeners = new Map();
  }

  /**
   * Initialize the adapter
   * @returns {Promise<boolean>}
   */
  async initialize() {
    throw new Error('initialize() must be implemented by subclass');
  }

  /**
   * Get the adapter name
   * @returns {string}
   */
  getName() {
    return this.constructor.name;
  }

  /**
   * Check if adapter is ready
   * @returns {boolean}
   */
  isReady() {
    return this.initialized;
  }

  // ==================== Server Management ====================

  /**
   * Start a server instance
   * @param {Object} config - Server configuration
   * @returns {Promise<Object>} - Server info { id, pid, port }
   */
  async startServer(config) {
    throw new Error('startServer() must be implemented by subclass');
  }

  /**
   * Stop a server instance
   * @param {string} serverId - Server identifier
   * @returns {Promise<boolean>}
   */
  async stopServer(serverId) {
    throw new Error('stopServer() must be implemented by subclass');
  }

  /**
   * Restart a server instance
   * @param {string} serverId - Server identifier
   * @returns {Promise<Object>}
   */
  async restartServer(serverId) {
    throw new Error('restartServer() must be implemented by subclass');
  }

  /**
   * Get server status
   * @param {string} serverId - Server identifier
   * @returns {Promise<Object>} - { status, players, memory, uptime }
   */
  async getServerStatus(serverId) {
    throw new Error('getServerStatus() must be implemented by subclass');
  }

  /**
   * Get server logs
   * @param {string} serverId - Server identifier
   * @param {number} lines - Number of lines to retrieve
   * @returns {Promise<string[]>}
   */
  async getServerLogs(serverId, lines = 100) {
    throw new Error('getServerLogs() must be implemented by subclass');
  }

  /**
   * Execute a command on the server
   * @param {string} serverId - Server identifier
   * @param {string} command - Command to execute
   * @returns {Promise<string>}
   */
  async executeCommand(serverId, command) {
    throw new Error('executeCommand() must be implemented by subclass');
  }

  // ==================== Player Management ====================

  /**
   * Get online players on a server
   * @param {string} serverId - Server identifier
   * @returns {Promise<Object[]>} - Array of player objects
   */
  async getOnlinePlayers(serverId) {
    throw new Error('getOnlinePlayers() must be implemented by subclass');
  }

  /**
   * Kick a player from server
   * @param {string} serverId - Server identifier
   * @param {string} playerId - Player identifier
   * @param {string} reason - Kick reason
   * @returns {Promise<boolean>}
   */
  async kickPlayer(serverId, playerId, reason = '') {
    throw new Error('kickPlayer() must be implemented by subclass');
  }

  /**
   * Send data to a specific player
   * @param {string} serverId - Server identifier
   * @param {string} playerId - Player identifier
   * @param {Object} data - Data to send
   * @returns {Promise<boolean>}
   */
  async sendToPlayer(serverId, playerId, data) {
    throw new Error('sendToPlayer() must be implemented by subclass');
  }

  /**
   * Teleport player to another server
   * @param {string} serverId - Server identifier
   * @param {string} playerId - Player identifier
   * @param {string} targetServerId - Target server identifier
   * @returns {Promise<boolean>}
   */
  async teleportPlayer(serverId, playerId, targetServerId) {
    throw new Error('teleportPlayer() must be implemented by subclass');
  }

  // ==================== Game Operations ====================

  /**
   * Load a place file
   * @param {string} serverId - Server identifier
   * @param {string} placePath - Path to place file
   * @returns {Promise<boolean>}
   */
  async loadPlace(serverId, placePath) {
    throw new Error('loadPlace() must be implemented by subclass');
  }

  /**
   * Get GameConfig as object
   * @param {string} serverId - Server identifier
   * @returns {Promise<Object>}
   */
  async getGameConfig(serverId) {
    throw new Error('getGameConfig() must be implemented by subclass');
  }

  /**
   * Set GameConfig
   * @param {string} serverId - Server identifier
   * @param {Object} config - GameConfig object
   * @returns {Promise<boolean>}
   */
  async setGameConfig(serverId, config) {
    throw new Error('setGameConfig() must be implemented by subclass');
  }

  // ==================== Asset Operations ====================

  /**
   * Get an asset by ID
   * @param {number} assetId - Asset ID
   * @returns {Promise<Object|null>}
   */
  async getAsset(assetId) {
    throw new Error('getAsset() must be implemented by subclass');
  }

  /**
   * Cache an asset
   * @param {number} assetId - Asset ID
   * @param {string} url - Asset URL
   * @returns {Promise<boolean>}
   */
  async cacheAsset(assetId, url) {
    throw new Error('cacheAsset() must be implemented by subclass');
  }

  /**
   * Get list of cached assets
   * @param {Object} options - Filter options
   * @returns {Promise<Object[]>}
   */
  async getCachedAssets(options = {}) {
    throw new Error('getCachedAssets() must be implemented by subclass');
  }

  /**
   * Delete cached asset
   * @param {number} assetId - Asset ID
   * @returns {Promise<boolean>}
   */
  async deleteCachedAsset(assetId) {
    throw new Error('deleteCachedAsset() must be implemented by subclass');
  }

  // ==================== Console Operations ====================

  /**
   * Get console output stream
   * @param {string} serverId - Server identifier
   * @returns {ReadableStream}
   */
  getConsoleStream(serverId) {
    throw new Error('getConsoleStream() must be implemented by subclass');
  }

  /**
   * Register console output listener
   * @param {Function} callback - Callback function
   */
  onConsoleOutput(callback) {
    throw new Error('onConsoleOutput() must be implemented by subclass');
  }

  // ==================== Utility Methods ====================

  /**
   * Detect RFD installation
   * @returns {Promise<Object>} - { found: boolean, path: string, version: string }
   */
  async detectInstallation() {
    throw new Error('detectInstallation() must be implemented by subclass');
  }

  /**
   * Get backend version
   * @returns {Promise<string>}
   */
  async getVersion() {
    throw new Error('getVersion() must be implemented by subclass');
  }

  /**
   * Get system resource usage
   * @returns {Promise<Object>} - { cpu, memory, network }
   */
  async getResourceUsage() {
    throw new Error('getResourceUsage() must be implemented by subclass');
  }

  /**
   * Health check
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    throw new Error('healthCheck() must be implemented by subclass');
  }

  // ==================== Event System ====================

  /**
   * Register an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Remove an event listener
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit an event to all listeners
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Cleanup resources
   */
  async destroy() {
    this.listeners.clear();
    this.initialized = false;
  }
}

module.exports = BackendAdapter;
