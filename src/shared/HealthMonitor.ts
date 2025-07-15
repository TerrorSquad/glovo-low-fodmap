import { Config } from './Config'
import { FeatureFlags } from './FeatureFlags'
import { Logger } from './Logger'

export interface HealthCheckResult {
  component: string
  status: 'healthy' | 'warning' | 'error'
  message: string
  details?: Record<string, unknown>
  timestamp: number
}

export interface SystemHealth {
  overall: 'healthy' | 'warning' | 'error'
  checks: HealthCheckResult[]
  timestamp: number
}

/**
 * Health monitoring system for the extension
 */
export class HealthMonitor {
  private static lastCheck: SystemHealth | null = null
  private static checkInterval: number | null = null

  /**
   * Performs a comprehensive health check
   */
  static async performHealthCheck(): Promise<SystemHealth> {
    const timestamp = Date.now()
    const checks: HealthCheckResult[] = []

    // Configuration health
    checks.push(HealthMonitor.checkConfiguration())

    // Storage health
    checks.push(await HealthMonitor.checkStorage())

    // API connectivity (if sync is enabled)
    if (FeatureFlags.isSyncEnabled()) {
      checks.push(await HealthMonitor.checkApiConnectivity())
    }

    // DOM health (content script only)
    if (typeof document !== 'undefined') {
      checks.push(HealthMonitor.checkDomHealth())
    }

    // Performance health
    checks.push(HealthMonitor.checkPerformanceHealth())

    // Determine overall status
    const errorCount = checks.filter((c) => c.status === 'error').length
    const warningCount = checks.filter((c) => c.status === 'warning').length

    let overall: 'healthy' | 'warning' | 'error' = 'healthy'
    if (errorCount > 0) {
      overall = 'error'
    } else if (warningCount > 0) {
      overall = 'warning'
    }

    const result: SystemHealth = {
      overall,
      checks,
      timestamp,
    }

    HealthMonitor.lastCheck = result

    Logger.debug('HealthMonitor', `Health check completed: ${overall}`, {
      errorCount,
      warningCount,
      totalChecks: checks.length,
    })

    return result
  }

  /**
   * Checks configuration health
   */
  private static checkConfiguration(): HealthCheckResult {
    const validation = FeatureFlags.validateConfiguration()

    return {
      component: 'Configuration',
      status: validation.isValid ? 'healthy' : 'warning',
      message: validation.isValid
        ? 'Configuration is valid'
        : `Configuration issues: ${validation.issues.join(', ')}`,
      details: Config.getInfo(),
      timestamp: Date.now(),
    }
  }

  /**
   * Checks Chrome storage health
   */
  private static async checkStorage(): Promise<HealthCheckResult> {
    try {
      const testKey = '_health_check_test'
      const testValue = Date.now().toString()

      // Test write
      await chrome.storage.sync.set({ [testKey]: testValue })

      // Test read
      const result = await chrome.storage.sync.get([testKey])

      // Test cleanup
      await chrome.storage.sync.remove([testKey])

      if (result[testKey] === testValue) {
        return {
          component: 'Storage',
          status: 'healthy',
          message: 'Chrome storage is working correctly',
          timestamp: Date.now(),
        }
      } else {
        return {
          component: 'Storage',
          status: 'error',
          message: 'Chrome storage read/write test failed',
          timestamp: Date.now(),
        }
      }
    } catch (error) {
      return {
        component: 'Storage',
        status: 'error',
        message: `Chrome storage error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
      }
    }
  }

  /**
   * Checks API connectivity (basic)
   */
  private static async checkApiConnectivity(): Promise<HealthCheckResult> {
    if (!Config.API_ENDPOINT) {
      return {
        component: 'API',
        status: 'warning',
        message: 'API endpoint not configured',
        timestamp: Date.now(),
      }
    }

    try {
      // Basic connectivity test - just check if the endpoint is reachable
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000) // 5 second timeout

      const response = await fetch(Config.API_ENDPOINT, {
        method: 'HEAD',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      return {
        component: 'API',
        status: response.ok ? 'healthy' : 'warning',
        message: response.ok
          ? 'API endpoint is reachable'
          : `API returned status ${response.status}`,
        details: {
          endpoint: Config.API_ENDPOINT,
          status: response.status,
        },
        timestamp: Date.now(),
      }
    } catch (error) {
      return {
        component: 'API',
        status: 'error',
        message: `API connectivity error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
      }
    }
  }

  /**
   * Checks DOM health (content script)
   */
  private static checkDomHealth(): HealthCheckResult {
    try {
      const productCards = document.querySelectorAll(Config.SELECTORS.CARD)
      const styledCards = document.querySelectorAll(
        `${Config.SELECTORS.CARD}[data-fodmap-status]`,
      )
      const injectedStyles = document.getElementById(
        Config.CSS_CLASSES.STYLE_ID,
      )

      const details = {
        totalCards: productCards.length,
        styledCards: styledCards.length,
        stylesInjected: !!injectedStyles,
        url: window.location.href,
      }

      let status: 'healthy' | 'warning' | 'error' = 'healthy'
      let message = 'DOM is healthy'

      if (!injectedStyles) {
        status = 'warning'
        message = 'FODMAP styles not injected'
      } else if (productCards.length === 0) {
        status = 'warning'
        message = 'No product cards found on page'
      } else if (styledCards.length === 0 && productCards.length > 0) {
        status = 'warning'
        message = 'Product cards found but none are styled'
      }

      return {
        component: 'DOM',
        status,
        message,
        details,
        timestamp: Date.now(),
      }
    } catch (error) {
      return {
        component: 'DOM',
        status: 'error',
        message: `DOM check error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
      }
    }
  }

  /**
   * Checks performance health
   */
  private static checkPerformanceHealth(): HealthCheckResult {
    try {
      const details: Record<string, unknown> = {}

      // Memory usage (if available)
      if ('memory' in performance) {
        const memory = (performance as any).memory
        const usedMB = memory.usedJSHeapSize / 1024 / 1024
        const limitMB = memory.jsHeapSizeLimit / 1024 / 1024
        const usagePercent = (usedMB / limitMB) * 100

        details.memoryUsed = `${usedMB.toFixed(2)} MB`
        details.memoryLimit = `${limitMB.toFixed(2)} MB`
        details.memoryUsagePercent = `${usagePercent.toFixed(1)}%`

        if (usagePercent > 80) {
          return {
            component: 'Performance',
            status: 'warning',
            message: 'High memory usage detected',
            details,
            timestamp: Date.now(),
          }
        }
      }

      // Performance timing
      const navigation = performance.getEntriesByType(
        'navigation',
      )[0] as PerformanceNavigationTiming
      if (navigation) {
        details.pageLoadTime = `${(navigation.loadEventEnd - navigation.fetchStart).toFixed(2)}ms`
      }

      return {
        component: 'Performance',
        status: 'healthy',
        message: 'Performance metrics are normal',
        details,
        timestamp: Date.now(),
      }
    } catch (error) {
      return {
        component: 'Performance',
        status: 'error',
        message: `Performance check error: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now(),
      }
    }
  }

  /**
   * Gets the last health check result
   */
  static getLastHealthCheck(): SystemHealth | null {
    return HealthMonitor.lastCheck
  }

  /**
   * Starts periodic health monitoring
   */
  static startPeriodicHealthCheck(intervalMs = 30000): void {
    if (HealthMonitor.checkInterval) {
      clearInterval(HealthMonitor.checkInterval)
    }

    HealthMonitor.checkInterval = window.setInterval(async () => {
      const health = await HealthMonitor.performHealthCheck()

      if (health.overall === 'error') {
        Logger.error('HealthMonitor', 'System health check failed', undefined, {
          errors: health.checks.filter((c) => c.status === 'error'),
        })
      } else if (health.overall === 'warning') {
        Logger.warn('HealthMonitor', 'System health check has warnings', {
          warnings: health.checks.filter((c) => c.status === 'warning'),
        })
      }
    }, intervalMs)

    Logger.info(
      'HealthMonitor',
      `Started periodic health monitoring (interval: ${intervalMs}ms)`,
    )
  }

  /**
   * Stops periodic health monitoring
   */
  static stopPeriodicHealthCheck(): void {
    if (HealthMonitor.checkInterval) {
      clearInterval(HealthMonitor.checkInterval)
      HealthMonitor.checkInterval = null
      Logger.info('HealthMonitor', 'Stopped periodic health monitoring')
    }
  }

  /**
   * Gets a human-readable health summary
   */
  static getHealthSummary(health: SystemHealth): string {
    const healthyCount = health.checks.filter(
      (c) => c.status === 'healthy',
    ).length
    const warningCount = health.checks.filter(
      (c) => c.status === 'warning',
    ).length
    const errorCount = health.checks.filter((c) => c.status === 'error').length

    return `Health: ${health.overall.toUpperCase()} (${healthyCount} healthy, ${warningCount} warnings, ${errorCount} errors)`
  }
}
