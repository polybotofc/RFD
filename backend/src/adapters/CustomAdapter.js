/**
 * Custom Adapter
 * 
 * Implementation of BackendAdapter for custom third-party backends.
 * Allows configuration via JavaScript/JSON for any backend system.
 */

const BackendAdapter = require('./Adapter');

class CustomAdapter extends BackendAdapter {
  constructor(config = {}) {
    super(config);
    
    // Custom handlers configuration
    this.handlers = {
      startServer: config.handlers?.startServer || null,
      stopServer: config.handlers?.stopServer || null,
      restartServer: config.handlers?.restartServer || null,
      getServerStatus: config.handlers?.getServerStatus || null,
      getServerLogs: config.handlers?.getServerLogs || null,
      executeCommand: config.handlers?.executeCommand || null,
      getOnlinePlayers: config.handlers?.getOnlinePlayers || null,
      kickPlayer: config.handlers?.kickPlayer || null,
      sendToPlayer: config.handlers?.sendToPlayer || null,
      teleportPlayer: config.handlers?.teleportPlayer || null,
      loadPlace: config.handlers?.loadPlace || null,
      getGameConfig: config.handlers?.getGameConfig || null,
      setGameConfig: config.handlers?.setGameConfig || null,
      getAsset: config.handlers?.getAsset || null,
      cacheAsset: config.handlers?.cacheAsset || null,
      getCachedAssets: config.handlers?.getCachedAssets || null,
      deleteCachedAsset: config.handlers?.deleteCachedAsset || null,
      detectInstallation: config.handlers?.detectInstallation || null,
      getVersion: config.handlers?.getVersion || null,
      getResourceUsage: config.handlers?.getResourceUsage || null,
      healthCheck: config.handlers?.healthCheck || null
    };

    this.customMethods = config.methods || {};
  }

  /**
   * Initialize the custom adapter
   */
  async initialize() {
    // Validate handlers exist
    const requiredHandlers = ['startServer', 'stopServer', 'getServerStatus'];
    for (const handler of requiredHandlers) {
      if (!this.handlers[handler]) {
        throw new Error(`Missing required handler: ${handler}`);
      }
    }
    this.initialized = true;
    return true;
  }

  /**
   * Call a custom handler
   */
  async callHandler(handlerName, ...args) {
    const handler = this.handlers[handlerName];
    if (typeof handler === 'function') {
      return await handler(...args, this.config);
    }
    throw new Error(`Handler ${handlerName} is not a function`);
  }

  /**
   * Check if handler exists
   */
  hasHandler(name) {
    return this.handlers[name] != null;
  }

  /**
   * Register a new handler at runtime
   */
  registerHandler(name, fn) {
    if (typeof fn === 'function') {
      this.handlers[name] = fn;
      return true;
    }
    return false;
  }

  // Server Management

  async startServer(config) {
    return this.callHandler('startServer', config);
  }

  async stopServer(serverId) {
    return this.callHandler('stopServer', serverId);
  }

  async restartServer(serverId) {
    return this.callHandler('restartServer', serverId);
  }

  async getServerStatus(serverId) {
    return this.callHandler('getServerStatus', serverId);
  }

  async getServerLogs(serverId, lines) {
    if (this.hasHandler('getServerLogs')) {
      return this.callHandler('getServerLogs', serverId, lines);
    }
    return [];
  }

  async executeCommand(serverId, command) {
    if (this.hasHandler('executeCommand')) {
      return this.callHandler('executeCommand', serverId, command);
    }
    return '';
  }

  // Player Management

  async getOnlinePlayers(serverId) {
    if (this.hasHandler('getOnlinePlayers')) {
      return this.callHandler('getOnlinePlayers', serverId);
    }
    return [];
  }

  async kickPlayer(serverId, playerId, reason) {
    if (this.hasHandler('kickPlayer')) {
      return this.callHandler('kickPlayer', serverId, playerId, reason);
    }
    return false;
  }

  async sendToPlayer(serverId, playerId, data) {
    if (this.hasHandler('sendToPlayer')) {
      return this.callHandler('sendToPlayer', serverId, playerId, data);
    }
    return false;
  }

  async teleportPlayer(serverId, playerId, targetServerId) {
    if (this.hasHandler('teleportPlayer')) {
      return this.callHandler('teleportPlayer', serverId, playerId, targetServerId);
    }
    return false;
  }

  // Game Operations

  async loadPlace(serverId, placePath) {
    if (this.hasHandler('loadPlace')) {
      return this.callHandler('loadPlace', serverId, placePath);
    }
    return false;
  }

  async getGameConfig(serverId) {
    if (this.hasHandler('getGameConfig')) {
      return this.callHandler('getGameConfig', serverId);
    }
    return {};
  }

  async setGameConfig(serverId, config) {
    if (this.hasHandler('setGameConfig')) {
      return this.callHandler('setGameConfig', serverId, config);
    }
    return false;
  }

  // Asset Operations

  async getAsset(assetId) {
    if (this.hasHandler('getAsset')) {
      return this.callHandler('getAsset', assetId);
    }
    return null;
  }

  async cacheAsset(assetId, url) {
    if (this.hasHandler('cacheAsset')) {
      return this.callHandler('cacheAsset', assetId, url);
    }
    return false;
  }

  async getCachedAssets(options) {
    if (this.hasHandler('getCachedAssets')) {
      return this.callHandler('getCachedAssets', options);
    }
    return [];
  }

  async deleteCachedAsset(assetId) {
    if (this.hasHandler('deleteCachedAsset')) {
      return this.callHandler('deleteCachedAsset', assetId);
    }
    return false;
  }

  // Console

  getConsoleStream(serverId) {
    return [];
  }

  onConsoleOutput(callback) {
    this.on('console', callback);
  }

  // Utility

  async detectInstallation() {
    if (this.hasHandler('detectInstallation')) {
      return this.callHandler('detectInstallation');
    }
    return { found: false };
  }

  async getVersion() {
    if (this.hasHandler('getVersion')) {
      return this.callHandler('getVersion');
    }
    return 'custom/1.0.0';
  }

  async getResourceUsage() {
    if (this.hasHandler('getResourceUsage')) {
      return this.callHandler('getResourceUsage');
    }
    return { cpu: 0, memory: { total: 0, used: 0, free: 0 } };
  }

  async healthCheck() {
    if (this.hasHandler('healthCheck')) {
      return this.callHandler('healthCheck');
    }
    return this.initialized;
  }

  // Custom method executor
  async executeCustomMethod(methodName, ...args) {
    const method = this.customMethods[methodName];
    if (typeof method === 'function') {
      return await method(...args, this.config);
    }
    throw new Error(`Custom method ${methodName} not found`);
  }
}

module.exports = CustomAdapter;
