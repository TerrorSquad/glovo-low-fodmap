/**
 * Configuration management for the extension
 */
export class Config {
  // API Configuration
  static readonly API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || ''

  // Debug and Logging
  static readonly DEBUG_MODE = process.env.NODE_ENV === 'development'
  static readonly LOG_LEVEL = import.meta.env.VITE_LOG_LEVEL || 'warn'

  // Performance Monitoring
  static readonly PERFORMANCE_MONITORING =
    import.meta.env.VITE_PERFORMANCE_MONITORING === 'true'
  static readonly MEMORY_MONITORING =
    import.meta.env.VITE_MEMORY_MONITORING === 'true'

  // Feature Flags
  static readonly ENABLE_SYNC = import.meta.env.VITE_ENABLE_SYNC === 'true'
  static readonly ENABLE_PERIODIC_UPDATE =
    import.meta.env.VITE_ENABLE_PERIODIC_UPDATE === 'true'
  static readonly UPDATE_INTERVAL =
    Number(import.meta.env.VITE_UPDATE_INTERVAL) || 1000

  // Sync Configuration
  static readonly SYNC_INTERVAL =
    Number(import.meta.env.VITE_SYNC_INTERVAL) || 15000 // 15 seconds default (optimized for 5s backend queue)
  static readonly SYNC_POLL_INTERVAL =
    Number(import.meta.env.VITE_SYNC_POLL_INTERVAL) || 10000 // 10 seconds default (fast polling for 5s backend)
  static readonly SYNC_RETRY_ATTEMPTS =
    Number(import.meta.env.VITE_SYNC_RETRY_ATTEMPTS) || 3
  static readonly SYNC_RETRY_DELAY =
    Number(import.meta.env.VITE_SYNC_RETRY_DELAY) || 2000 // 2 seconds default
  static readonly SYNC_BATCH_SIZE =
    Number(import.meta.env.VITE_SYNC_BATCH_SIZE) || 100
  static readonly POLL_BATCH_SIZE =
    Number(import.meta.env.VITE_POLL_BATCH_SIZE) || 500

  // Extension Configuration
  static readonly EXTENSION_NAME = 'Glovo FODMAP Helper'
  static readonly STORAGE_KEYS = {
    HIDE_NON_LOW_FODMAP: 'hideNonLowFodmap',
    API_ENDPOINT: 'apiEndpoint',
    LAST_SYNC: 'lastSync',
  } as const

  // DOM Selectors
  static readonly SELECTORS = {
    CARD: 'section[type="PRODUCT_TILE"]',
    CARD_NAME: 'span.tile__description',
  } as const

  // CSS Classes
  static readonly CSS_CLASSES = {
    LOW_HIGHLIGHT: 'fodmap-low-highlight',
    BADGE: 'fodmap-badge',
    BADGE_HIGH: 'fodmap-badge-high',
    STYLE_ID: 'fodmap-helper-styles',
  } as const

  /**
   * Validates the current configuration
   */
  static validate(): boolean {
    const issues: string[] = []

    if (Config.ENABLE_SYNC && !Config.API_ENDPOINT) {
      issues.push('API endpoint is required when sync is enabled')
    }

    if (Config.UPDATE_INTERVAL < 100) {
      issues.push('Update interval should be at least 100ms')
    }

    if (Config.SYNC_INTERVAL < 15000) {
      issues.push('Sync interval should be at least 15 seconds (15000ms)')
    }

    if (Config.SYNC_POLL_INTERVAL < 10000) {
      issues.push('Sync poll interval should be at least 10 seconds (10000ms)')
    }

    if (Config.SYNC_RETRY_ATTEMPTS < 1 || Config.SYNC_RETRY_ATTEMPTS > 10) {
      issues.push('Sync retry attempts should be between 1 and 10')
    }

    if (Config.SYNC_RETRY_DELAY < 1000) {
      issues.push('Sync retry delay should be at least 1 second (1000ms)')
    }

    if (issues.length > 0) {
      return false
    }

    return true
  }

  /**
   * Gets runtime configuration info
   */
  static getInfo(): Record<string, unknown> {
    return {
      apiEndpoint: Config.API_ENDPOINT ? '***configured***' : 'not configured',
      debugMode: Config.DEBUG_MODE,
      logLevel: Config.LOG_LEVEL,
      performanceMonitoring: Config.PERFORMANCE_MONITORING,
      memoryMonitoring: Config.MEMORY_MONITORING,
      syncEnabled: Config.ENABLE_SYNC,
      periodicUpdateEnabled: Config.ENABLE_PERIODIC_UPDATE,
      updateInterval: Config.UPDATE_INTERVAL,
      syncInterval: Config.SYNC_INTERVAL,
      syncPollInterval: Config.SYNC_POLL_INTERVAL,
      syncRetryAttempts: Config.SYNC_RETRY_ATTEMPTS,
      syncRetryDelay: Config.SYNC_RETRY_DELAY,
      syncBatchSize: Config.SYNC_BATCH_SIZE,
    }
  }
}
