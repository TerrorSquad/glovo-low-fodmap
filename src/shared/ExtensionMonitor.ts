import { ErrorBoundary } from '../shared/ErrorBoundary'
import { Logger } from '../shared/Logger'
import { MetricsCollector } from '../shared/MetricsCollector'
import { ErrorHandler } from './ErrorHandler'

export interface SystemStatus {
  timestamp: number
  uptime: number
  health: 'healthy' | 'warning' | 'critical'
  activeContentScripts: number
  errorRate: number
  memoryUsage?: number
  lastActivity: number
}

/**
 * Monitors extension health and performance across all contexts
 */
export class ExtensionMonitor {
  private static instance: ExtensionMonitor
  private static readonly CHECK_INTERVAL = 30000 // 30 seconds
  private static readonly ERROR_THRESHOLD = 0.1 // 10% error rate

  private startTime = Date.now()
  private lastActivity = Date.now()
  private checkInterval?: ReturnType<typeof setInterval>
  private activeContentScripts = 0
  private isRunning = false

  static getInstance(): ExtensionMonitor {
    if (!ExtensionMonitor.instance) {
      ExtensionMonitor.instance = new ExtensionMonitor()
    }
    return ExtensionMonitor.instance
  }

  start(): void {
    if (this.isRunning) return

    this.isRunning = true
    Logger.info('ExtensionMonitor', 'Starting extension monitoring')

    // Setup error boundary recovery strategies
    ErrorBoundary.setupDefaultRecoveryStrategies()

    // Register custom recovery strategies for extension-specific issues
    this.registerExtensionRecoveryStrategies()

    // Start periodic health checks
    this.checkInterval = setInterval(() => {
      this.performHealthCheck()
    }, ExtensionMonitor.CHECK_INTERVAL)

    // Listen for content script registrations
    this.setupContentScriptTracking()

    // Perform initial health check
    this.performHealthCheck()

    MetricsCollector.record('monitor.started', 1)
  }

  stop(): void {
    if (!this.isRunning) return

    this.isRunning = false
    Logger.info('ExtensionMonitor', 'Stopping extension monitoring')

    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = undefined
    }

    MetricsCollector.record('monitor.stopped', 1)
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const status = await this.getSystemStatus()

      Logger.debug('ExtensionMonitor', 'Health check completed', {
        health: status.health,
        uptime: `${(status.uptime / 1000 / 60).toFixed(1)}min`,
        errorRate: `${(status.errorRate * 100).toFixed(1)}%`,
        activeScripts: status.activeContentScripts,
      })

      // Record health metrics
      MetricsCollector.record('health.check', 1, {
        status: status.health,
        uptime: status.uptime,
        errorRate: status.errorRate,
      })

      // Take action based on health status
      if (status.health === 'critical') {
        await this.handleCriticalHealth(status)
      } else if (status.health === 'warning') {
        await this.handleWarningHealth(status)
      }
    } catch (error) {
      ErrorHandler.logError('ExtensionMonitor', error, {
        context: 'Performing health check',
      })
      MetricsCollector.record('health.check.error', 1)
    }
  }

  private async getSystemStatus(): Promise<SystemStatus> {
    const timestamp = Date.now()
    const uptime = timestamp - this.startTime

    // Calculate error rate from metrics
    const metrics = MetricsCollector.getSummary()
    const errorEvents = Object.entries(metrics.eventCounts)
      .filter(([name]) => name.includes('error'))
      .reduce((sum, [, count]) => sum + count, 0)

    const errorRate =
      metrics.totalEvents > 0 ? errorEvents / metrics.totalEvents : 0

    // Determine health status
    let health: 'healthy' | 'warning' | 'critical' = 'healthy'

    if (errorRate > ExtensionMonitor.ERROR_THRESHOLD) {
      health = 'critical'
    } else if (errorRate > ExtensionMonitor.ERROR_THRESHOLD / 2) {
      health = 'warning'
    }

    // Check for extended inactivity
    const inactivityDuration = timestamp - this.lastActivity
    if (inactivityDuration > 300000) {
      // 5 minutes
      health = health === 'healthy' ? 'warning' : 'critical'
    }

    return {
      timestamp,
      uptime,
      health,
      activeContentScripts: this.activeContentScripts,
      errorRate,
      lastActivity: this.lastActivity,
    }
  }

  private async handleCriticalHealth(status: SystemStatus): Promise<void> {
    Logger.warn(
      'ExtensionMonitor',
      'Critical health detected, attempting recovery',
      {
        errorRate: status.errorRate,
        uptime: status.uptime,
        activeScripts: status.activeContentScripts,
      },
    )

    // Attempt system recovery
    const systemCheck = await ErrorBoundary.performSystemCheck()

    if (systemCheck.recommendations.length > 0) {
      Logger.info('ExtensionMonitor', 'System recommendations:', {
        recommendations: systemCheck.recommendations,
      })
    }

    // Clear metrics to reset error rate
    if (status.errorRate > 0.5) {
      MetricsCollector.clear()
      Logger.info('ExtensionMonitor', 'Cleared metrics due to high error rate')
    }

    MetricsCollector.record('health.critical.recovery', 1)
  }

  private async handleWarningHealth(status: SystemStatus): Promise<void> {
    Logger.info('ExtensionMonitor', 'Warning health detected', {
      errorRate: status.errorRate,
      uptime: status.uptime,
    })

    MetricsCollector.record('health.warning', 1)
  }

  private setupContentScriptTracking(): void {
    // Listen for content script lifecycle messages
    chrome.runtime.onMessage.addListener((message, sender) => {
      if (message.type === 'content-script-ready') {
        this.activeContentScripts++
        this.lastActivity = Date.now()
        MetricsCollector.record('content.script.registered', 1, {
          tabId: sender.tab?.id,
          url: sender.tab?.url,
        })
      } else if (message.type === 'content-script-unload') {
        this.activeContentScripts = Math.max(0, this.activeContentScripts - 1)
        MetricsCollector.record('content.script.unregistered', 1)
      }
    })
  }

  private registerExtensionRecoveryStrategies(): void {
    // Recovery strategy for content script communication failures
    ErrorBoundary.registerRecoveryStrategy('content-communication', {
      name: 'reload-content-scripts',
      priority: 8,
      execute: async () => {
        try {
          // Query all tabs and reload content scripts if needed
          const tabs = await chrome.tabs.query({
            url: ['https://glovoapp.com/*'],
          })

          for (const tab of tabs) {
            if (tab.id) {
              try {
                await chrome.tabs.sendMessage(tab.id, { type: 'health-check' })
              } catch {
                // Content script not responding, reload it
                await chrome.tabs.reload(tab.id)
                Logger.info(
                  'ExtensionMonitor',
                  `Reloaded tab ${tab.id} due to unresponsive content script`,
                )
              }
            }
          }

          return true
        } catch (error) {
          ErrorHandler.logError('ExtensionMonitor', error, {
            context: 'Reloading content scripts',
          })
          return false
        }
      },
    })

    // Recovery strategy for storage corruption
    ErrorBoundary.registerRecoveryStrategy('storage-corruption', {
      name: 'repair-storage',
      priority: 7,
      execute: async () => {
        try {
          // Validate storage data
          const data = await chrome.storage.local.get()

          // Check for corruption indicators
          const hasValidProducts = Array.isArray(data.products)
          const hasValidSettings = typeof data.hideNonLowFodmap === 'boolean'

          if (!hasValidProducts || !hasValidSettings) {
            // Reset corrupted data
            await chrome.storage.local.clear()
            await chrome.storage.local.set({
              products: [],
              hideNonLowFodmap: false,
            })

            Logger.info('ExtensionMonitor', 'Repaired corrupted storage data')
            return true
          }

          return true
        } catch (error) {
          ErrorHandler.logError('ExtensionMonitor', error, {
            context: 'Repairing storage',
          })
          return false
        }
      },
    })

    Logger.info(
      'ExtensionMonitor',
      'Extension-specific recovery strategies registered',
    )
  }

  /**
   * Records user activity to track extension usage
   */
  recordActivity(): void {
    this.lastActivity = Date.now()
  }

  /**
   * Gets current system status for diagnostics
   */
  async getCurrentStatus(): Promise<SystemStatus> {
    return this.getSystemStatus()
  }

  /**
   * Forces a health check (useful for debugging)
   */
  async forceHealthCheck(): Promise<SystemStatus> {
    await this.performHealthCheck()
    return this.getSystemStatus()
  }
}
