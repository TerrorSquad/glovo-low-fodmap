import { Config } from './Config'
import { Logger } from './Logger'
import { MetricsCollector } from './MetricsCollector'

export interface ErrorBoundaryOptions {
  maxRetries?: number
  retryDelayMs?: number
  onError?: (error: Error, context: string) => void
  onRecovery?: (context: string) => void
}

export interface RecoveryStrategy {
  name: string
  execute: () => Promise<boolean>
  priority: number
}

/**
 * Error boundary and recovery system for handling critical failures
 */
export class ErrorBoundary {
  private static readonly DEFAULT_OPTIONS: Required<ErrorBoundaryOptions> = {
    maxRetries: 3,
    retryDelayMs: 1000,
    onError: () => {},
    onRecovery: () => {},
  }

  private static retryCount = new Map<string, number>()
  private static recoveryStrategies = new Map<string, RecoveryStrategy[]>()

  /**
   * Wraps a function with error boundary protection
   */
  static async protect<T>(
    fn: () => Promise<T>,
    context: string,
    options: ErrorBoundaryOptions = {},
  ): Promise<T | null> {
    const opts = { ...ErrorBoundary.DEFAULT_OPTIONS, ...options }
    const retryKey = `${context}-${fn.name}`

    try {
      const result = await fn()

      // Reset retry count on success
      if (ErrorBoundary.retryCount.has(retryKey)) {
        ErrorBoundary.retryCount.delete(retryKey)
        Logger.info('ErrorBoundary', `Recovery successful for ${context}`)
        opts.onRecovery(context)
        MetricsCollector.record('error.boundary.recovery', 1, { context })
      }

      return result
    } catch (error) {
      const currentRetries = ErrorBoundary.retryCount.get(retryKey) || 0
      ErrorBoundary.retryCount.set(retryKey, currentRetries + 1)

      Logger.error(
        'ErrorBoundary',
        `Error in ${context} (attempt ${currentRetries + 1}/${opts.maxRetries})`,
        error,
      )
      MetricsCollector.record('error.boundary.triggered', 1, {
        context,
        attempt: currentRetries + 1,
      })

      opts.onError(
        error instanceof Error ? error : new Error(String(error)),
        context,
      )

      // Try recovery strategies
      if (currentRetries < opts.maxRetries) {
        const recovered = await ErrorBoundary.attemptRecovery(context)
        if (recovered) {
          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, opts.retryDelayMs))
          return ErrorBoundary.protect(fn, context, options)
        }
      }

      Logger.error(
        'ErrorBoundary',
        `Failed to recover from error in ${context} after ${opts.maxRetries} attempts`,
      )
      MetricsCollector.record('error.boundary.failed', 1, {
        context,
        totalAttempts: opts.maxRetries,
      })

      return null
    }
  }

  /**
   * Registers recovery strategies for a specific context
   */
  static registerRecoveryStrategy(
    context: string,
    strategy: RecoveryStrategy,
  ): void {
    if (!ErrorBoundary.recoveryStrategies.has(context)) {
      ErrorBoundary.recoveryStrategies.set(context, [])
    }

    const strategies = ErrorBoundary.recoveryStrategies.get(context)!
    strategies.push(strategy)
    strategies.sort((a, b) => b.priority - a.priority) // Higher priority first

    Logger.info(
      'ErrorBoundary',
      `Registered recovery strategy '${strategy.name}' for ${context}`,
    )
  }

  /**
   * Attempts to recover from an error using registered strategies
   */
  private static async attemptRecovery(context: string): Promise<boolean> {
    const strategies = ErrorBoundary.recoveryStrategies.get(context) || []

    if (strategies.length === 0) {
      Logger.warn(
        'ErrorBoundary',
        `No recovery strategies available for ${context}`,
      )
      return false
    }

    Logger.info(
      'ErrorBoundary',
      `Attempting recovery for ${context} using ${strategies.length} strategies`,
    )

    for (const strategy of strategies) {
      try {
        Logger.info(
          'ErrorBoundary',
          `Trying recovery strategy: ${strategy.name}`,
        )
        const success = await strategy.execute()

        if (success) {
          Logger.info(
            'ErrorBoundary',
            `Recovery successful using strategy: ${strategy.name}`,
          )
          MetricsCollector.record('error.boundary.strategy.success', 1, {
            context,
            strategy: strategy.name,
          })
          return true
        }

        Logger.warn(
          'ErrorBoundary',
          `Recovery strategy '${strategy.name}' did not succeed`,
        )
      } catch (strategyError) {
        Logger.error(
          'ErrorBoundary',
          `Recovery strategy '${strategy.name}' failed`,
          strategyError,
        )
        MetricsCollector.record('error.boundary.strategy.error', 1, {
          context,
          strategy: strategy.name,
        })
      }
    }

    Logger.error(
      'ErrorBoundary',
      `All recovery strategies failed for ${context}`,
    )
    return false
  }

  /**
   * Creates a resilient version of a function that automatically handles errors
   */
  static createResilientFunction<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    context: string,
    options: ErrorBoundaryOptions = {},
  ): (...args: T) => Promise<R | null> {
    return async (...args: T): Promise<R | null> => {
      return ErrorBoundary.protect(() => fn(...args), context, options)
    }
  }

  /**
   * Gets retry statistics for debugging
   */
  static getRetryStats(): Record<string, number> {
    return Object.fromEntries(ErrorBoundary.retryCount.entries())
  }

  /**
   * Clears retry statistics
   */
  static clearRetryStats(): void {
    ErrorBoundary.retryCount.clear()
    Logger.info('ErrorBoundary', 'Retry statistics cleared')
  }

  /**
   * Sets up default recovery strategies for common contexts
   */
  static setupDefaultRecoveryStrategies(): void {
    // DOM recovery strategies
    ErrorBoundary.registerRecoveryStrategy('dom', {
      name: 'wait-for-dom-ready',
      priority: 10,
      execute: async () => {
        if (typeof document === 'undefined') return false

        if (document.readyState === 'complete') return true

        return new Promise((resolve) => {
          const timeout = setTimeout(() => resolve(false), 5000)

          const checkReady = () => {
            if (document.readyState === 'complete') {
              clearTimeout(timeout)
              resolve(true)
            } else {
              setTimeout(checkReady, 100)
            }
          }

          checkReady()
        })
      },
    })

    ErrorBoundary.registerRecoveryStrategy('dom', {
      name: 'reinject-styles',
      priority: 5,
      execute: async () => {
        try {
          // Remove existing styles
          const existingStyle = document.getElementById(
            Config.CSS_CLASSES.STYLE_ID,
          )
          if (existingStyle) {
            existingStyle.remove()
          }

          // Wait a moment
          await new Promise((resolve) => setTimeout(resolve, 100))

          return true
        } catch {
          return false
        }
      },
    })

    // Storage recovery strategies
    ErrorBoundary.registerRecoveryStrategy('storage', {
      name: 'clear-corrupted-storage',
      priority: 5,
      execute: async () => {
        try {
          if (typeof chrome !== 'undefined' && chrome.storage) {
            // Clear potentially corrupted data
            await chrome.storage.local.clear()
            Logger.warn(
              'ErrorBoundary',
              'Cleared local storage due to corruption',
            )
            return true
          }
          return false
        } catch {
          return false
        }
      },
    })

    // Network recovery strategies
    ErrorBoundary.registerRecoveryStrategy('network', {
      name: 'wait-for-network',
      priority: 10,
      execute: async () => {
        if (typeof navigator !== 'undefined' && 'onLine' in navigator) {
          if (navigator.onLine) return true

          return new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(false), 10000)

            const handleOnline = () => {
              clearTimeout(timeout)
              window.removeEventListener('online', handleOnline)
              resolve(true)
            }

            window.addEventListener('online', handleOnline)
          })
        }
        return false
      },
    })

    // Memory recovery strategies
    ErrorBoundary.registerRecoveryStrategy('memory', {
      name: 'garbage-collect',
      priority: 8,
      execute: async () => {
        try {
          // Force garbage collection if available
          if ('gc' in window) {
            ;(window as any).gc()
          }

          // Clear some caches
          MetricsCollector.clear()

          await new Promise((resolve) => setTimeout(resolve, 100))
          return true
        } catch {
          return false
        }
      },
    })

    Logger.info('ErrorBoundary', 'Default recovery strategies registered')
  }

  /**
   * Monitors and reports system health for error prevention
   */
  static async performSystemCheck(): Promise<{
    status: 'healthy' | 'warning' | 'critical'
    issues: string[]
    recommendations: string[]
  }> {
    const issues: string[] = []
    const recommendations: string[] = []

    try {
      // Check memory usage
      if ('memory' in performance) {
        const memory = (performance as any).memory
        const usagePercent =
          (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100

        if (usagePercent > 80) {
          issues.push(`High memory usage: ${usagePercent.toFixed(1)}%`)
          recommendations.push(
            'Consider refreshing the page or restarting the extension',
          )
        }
      }

      // Check retry counts
      const retryStats = ErrorBoundary.getRetryStats()
      const highRetryContexts = Object.entries(retryStats).filter(
        ([, count]) => count >= 2,
      )

      if (highRetryContexts.length > 0) {
        issues.push(
          `High retry counts: ${highRetryContexts.map(([ctx, count]) => `${ctx}:${count}`).join(', ')}`,
        )
        recommendations.push(
          'Check for underlying issues causing repeated failures',
        )
      }

      // Check DOM state
      if (typeof document !== 'undefined') {
        if (document.readyState !== 'complete') {
          issues.push('DOM not fully loaded')
          recommendations.push('Wait for page to fully load')
        }
      }

      const status =
        issues.length === 0
          ? 'healthy'
          : issues.length <= 2
            ? 'warning'
            : 'critical'

      return { status, issues, recommendations }
    } catch (error) {
      Logger.error('ErrorBoundary', 'System check failed', error)
      return {
        status: 'critical',
        issues: ['System check failed'],
        recommendations: ['Restart the extension'],
      }
    }
  }
}
