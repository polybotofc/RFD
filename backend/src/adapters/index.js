/**
 * Backend Adapter Factory
 * 
 * Factory for creating and managing backend adapters.
 * Supports RFD, RCCService, and custom adapters.
 */

const BackendAdapter = require('./Adapter');
const RFDAdapter = require('./RFDAdapter');
const RCCAdapter = require('./RCCAdapter');
const CustomAdapter = require('./CustomAdapter');

class AdapterFactory {
  constructor() {
    this.adapters = new Map();
    this.activeAdapter = null;
    this.activeType = null;
  }

  /**
   * Create an adapter by type
   * @param {string} type - Adapter type ('rfd', 'rcc', 'custom')
   * @param {Object} config - Adapter configuration
   * @returns {Promise<BackendAdapter>}
   */
  async create(type, config = {}) {
    let adapter;

    switch (type.toLowerCase()) {
      case 'rfd':
        adapter = new RFDAdapter(config);
        break;
      case 'rcc':
        adapter = new RCCAdapter(config);
        break;
      case 'custom':
        adapter = new CustomAdapter(config);
        break;
      default:
        throw new Error(`Unknown adapter type: ${type}`);
    }

    await adapter.initialize();
    this.adapters.set(type, adapter);
    return adapter;
  }

  /**
   * Set the active adapter
   * @param {string} type - Adapter type
   */
  async setActive(type) {
    if (!this.adapters.has(type)) {
      throw new Error(`Adapter ${type} not created. Call create() first.`);
    }
    this.activeAdapter = this.adapters.get(type);
    this.activeType = type;
  }

  /**
   * Get the active adapter
   * @returns {BackendAdapter}
   */
  getActive() {
    return this.activeAdapter;
  }

  /**
   * Get adapter by type
   * @param {string} type - Adapter type
   * @returns {BackendAdapter|null}
   */
  get(type) {
    return this.adapters.get(type) || null;
  }

  /**
   * Get all adapters
   * @returns {Map<string, BackendAdapter>}
   */
  getAll() {
    return this.adapters;
  }

  /**
   * Check if adapter exists
   * @param {string} type - Adapter type
   * @returns {boolean}
   */
  has(type) {
    return this.adapters.has(type);
  }

  /**
   * Remove an adapter
   * @param {string} type - Adapter type
   */
  async remove(type) {
    const adapter = this.adapters.get(type);
    if (adapter) {
      await adapter.destroy();
      this.adapters.delete(type);
      if (this.activeType === type) {
        this.activeAdapter = null;
        this.activeType = null;
      }
    }
  }

  /**
   * Remove all adapters
   */
  async clear() {
    for (const type of this.adapters.keys()) {
      await this.remove(type);
    }
  }

  /**
   * Get active adapter type
   * @returns {string|null}
   */
  getActiveType() {
    return this.activeType;
  }

  /**
   * List available adapter types
   * @returns {string[]}
   */
  getAvailableTypes() {
    return ['rfd', 'rcc', 'custom'];
  }

  /**
   * Auto-detect and create the best adapter
   * @param {Object} config - Configuration options
   * @returns {Promise<{adapter: BackendAdapter, type: string}>}
   */
  async autoDetect(config = {}) {
    // Try RFD first (most common)
    try {
      const rfdAdapter = new RFDAdapter(config);
      await rfdAdapter.initialize();
      const detection = await rfdAdapter.detectInstallation();
      
      if (detection.found) {
        this.adapters.set('rfd', rfdAdapter);
        this.activeAdapter = rfdAdapter;
        this.activeType = 'rfd';
        return { adapter: rfdAdapter, type: 'rfd', detection };
      }
    } catch (error) {
      console.log('RFD not detected:', error.message);
    }

    // Try RCC
    try {
      const rccAdapter = new RCCAdapter(config);
      await rccAdapter.initialize();
      
      this.adapters.set('rcc', rccAdapter);
      this.activeAdapter = rccAdapter;
      this.activeType = 'rcc';
      return { adapter: rccAdapter, type: 'rcc', detection: { found: true } };
    } catch (error) {
      console.log('RCC not detected:', error.message);
    }

    // Fall back to custom with no handlers
    const customAdapter = new CustomAdapter({ handlers: {}, methods: {} });
    await customAdapter.initialize();
    this.adapters.set('custom', customAdapter);
    this.activeAdapter = customAdapter;
    this.activeType = 'custom';
    
    return { adapter: customAdapter, type: 'custom', detection: { found: false } };
  }
}

// Singleton instance
const factory = new AdapterFactory();

module.exports = {
  BackendAdapter,
  RFDAdapter,
  RCCAdapter,
  CustomAdapter,
  AdapterFactory,
  factory
};
