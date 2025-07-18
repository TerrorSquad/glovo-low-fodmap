import { Config } from './Config'
import { ErrorHandler } from './ErrorHandler'
import { Logger } from './Logger'

/**
 * Feature flag management for runtime configuration
 */
export class FeatureFlags {
  private static cache = new Map<string, boolean>()

  /**
   * Checks if sync functionality is enabled
   */
  static isSyncEnabled(): boolean {
    return Config.ENABLE_SYNC && !!Config.API_ENDPOINT
  }

  /**
   * Checks if periodic updates are enabled
   */
  static isPeriodicUpdateEnabled(): boolean {
    return Config.ENABLE_PERIODIC_UPDATE
  }

  /**
   * Checks if performance monitoring is enabled
   */
  static isPerformanceMonitoringEnabled(): boolean {
    return Config.PERFORMANCE_MONITORING
  }

  /**
   * Checks if memory monitoring is enabled
   */
  static isMemoryMonitoringEnabled(): boolean {
    return Config.MEMORY_MONITORING
  }

  /**
   * Checks if debug mode is enabled
   */
  static isDebugModeEnabled(): boolean {
    return Config.DEBUG_MODE
  }

  /**
   * Gets the update interval with bounds checking
   */
  static getUpdateInterval(): number {
    const interval = Config.UPDATE_INTERVAL
    // Ensure minimum interval of 100ms to prevent excessive CPU usage
    return Math.max(interval, 100)
  }

  /**
   * Checks a custom feature flag from storage
   */
  static async checkCustomFeature(
    flagName: string,
    defaultValue = false,
  ): Promise<boolean> {
    const cacheKey = `feature_${flagName}`

    if (FeatureFlags.cache.has(cacheKey)) {
      return FeatureFlags.cache.get(cacheKey) ?? false
    }

    try {
      const result = await chrome.storage.sync.get({ [flagName]: defaultValue })
      const value = Boolean(result[flagName])
      FeatureFlags.cache.set(cacheKey, value)

      Logger.debug('FeatureFlags', `Custom feature ${flagName}: ${value}`)
      return value
    } catch (error) {
      ErrorHandler.logError('FeatureFlags', error, {
        context: 'Checking custom feature flag',
        flagName,
        defaultValue,
      })
      return defaultValue
    }
  }

  /**
   * Sets a custom feature flag in storage
   */
  static async setCustomFeature(
    flagName: string,
    value: boolean,
  ): Promise<void> {
    const cacheKey = `feature_${flagName}`

    try {
      await chrome.storage.sync.set({ [flagName]: value })
      FeatureFlags.cache.set(cacheKey, value)

      Logger.info('FeatureFlags', `Set custom feature ${flagName} to ${value}`)
    } catch (error) {
      ErrorHandler.logError('FeatureFlags', error, {
        context: 'Setting custom feature flag',
        flagName,
        value,
      })
    }
  }

  /**
   * Clears the feature flag cache
   */
  static clearCache(): void {
    FeatureFlags.cache.clear()
    Logger.debug('FeatureFlags', 'Feature flag cache cleared')
  }

  /**
   * Gets all current feature flag states
   */
  static getAllFlags(): Record<string, boolean | number | string> {
    return {
      syncEnabled: FeatureFlags.isSyncEnabled(),
      periodicUpdateEnabled: FeatureFlags.isPeriodicUpdateEnabled(),
      performanceMonitoringEnabled:
        FeatureFlags.isPerformanceMonitoringEnabled(),
      memoryMonitoringEnabled: FeatureFlags.isMemoryMonitoringEnabled(),
      debugModeEnabled: FeatureFlags.isDebugModeEnabled(),
      updateInterval: FeatureFlags.getUpdateInterval(),
      apiEndpoint: Config.API_ENDPOINT ? 'configured' : 'not configured',
      logLevel: Config.LOG_LEVEL,
    }
  }

  /**
   * Validates feature flag configuration
   */
  static validateConfiguration(): { isValid: boolean; issues: string[] } {
    const issues: string[] = []

    if (FeatureFlags.isSyncEnabled() && !Config.API_ENDPOINT) {
      issues.push('Sync is enabled but API endpoint is not configured')
    }

    if (FeatureFlags.getUpdateInterval() < 100) {
      issues.push('Update interval is too low (minimum 100ms recommended)')
    }

    if (FeatureFlags.getUpdateInterval() > 10000) {
      issues.push('Update interval is very high (may affect user experience)')
    }

    const isValid = issues.length === 0

    if (!isValid) {
      Logger.warn('FeatureFlags', 'Configuration validation failed', { issues })
    } else {
      Logger.debug('FeatureFlags', 'Configuration validation passed')
    }

    return { isValid, issues }
  }
}
