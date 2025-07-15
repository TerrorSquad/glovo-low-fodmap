import { ErrorHandler } from './ErrorHandler'

/**
 * Configuration management for the extension
 */
export class Config {
  // API Configuration
  static readonly API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || ''

  // Debug and Logging
  static readonly DEBUG_MODE = import.meta.env.VITE_DEBUG_MODE === 'true'
  static readonly LOG_LEVEL = import.meta.env.VITE_LOG_LEVEL || 'info'

  // Performance Monitoring
  static readonly PERFORMANCE_MONITORING =
    import.meta.env.VITE_PERFORMANCE_MONITORING !== 'false'
  static readonly MEMORY_MONITORING =
    import.meta.env.VITE_MEMORY_MONITORING === 'true'

  // Feature Flags
  static readonly ENABLE_SYNC = import.meta.env.VITE_ENABLE_SYNC !== 'false'
  static readonly ENABLE_PERIODIC_UPDATE =
    import.meta.env.VITE_ENABLE_PERIODIC_UPDATE !== 'false'
  static readonly UPDATE_INTERVAL =
    Number(import.meta.env.VITE_UPDATE_INTERVAL) || 1000

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

    if (issues.length > 0) {
      ErrorHandler.logWarning('Config', 'Configuration issues found:', issues)
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
    }
  }
}
