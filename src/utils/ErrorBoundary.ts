import { Config } from './Config'
import { ErrorHandler } from './ErrorHandler'
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

      ErrorHandler.logError('ErrorBoundary', error, {
        context,
        metadata: { attempt: currentRetries + 1, maxRetries: opts.maxRetries },
      })
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

      ErrorHandler.logError(
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
        ErrorHandler.logError('ErrorBoundary', strategyError, {
          context: `Executing recovery strategy '${strategy.name}'`,
          metadata: { strategyName: strategy.name },
        })
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
      const retryStats = Object.fromEntries(ErrorBoundary.retryCount.entries())
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
      ErrorHandler.logError('ErrorBoundary', error, {
        context: 'Performing system check',
      })
      return {
        status: 'critical',
        issues: ['System check failed'],
        recommendations: ['Restart the extension'],
      }
    }
  }
}
