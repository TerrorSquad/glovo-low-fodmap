import { Config } from './Config'
import { Logger } from './Logger'

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private static timers = new Map<string, number>()

  static startTimer(name: string): void {
    if (!Config.PERFORMANCE_MONITORING) return

    PerformanceMonitor.timers.set(name, performance.now())
    Logger.debug('Performance', `Started timer: ${name}`)
  }

  static endTimer(name: string): number {
    if (!Config.PERFORMANCE_MONITORING) return 0

    const startTime = PerformanceMonitor.timers.get(name)
    if (!startTime) {
      Logger.warn('Performance', `Timer "${name}" was not started`)
      return 0
    }

    const endTime = performance.now()
    const duration = endTime - startTime
    PerformanceMonitor.timers.delete(name)

    Logger.perf('Performance', name, duration)

    // Record metrics if MetricsCollector is available
    try {
      const { MetricsCollector } = require('./MetricsCollector')
      MetricsCollector.recordPerformance(name, duration)
    } catch {
      // MetricsCollector not available, ignore
    }

    return duration
  }

  static async measureAsync<T>(
    name: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    PerformanceMonitor.startTimer(name)
    try {
      const result = await operation()
      PerformanceMonitor.endTimer(name)
      return result
    } catch (error) {
      PerformanceMonitor.endTimer(name)
      throw error
    }
  }

  static measure<T>(name: string, operation: () => T): T {
    PerformanceMonitor.startTimer(name)
    try {
      const result = operation()
      PerformanceMonitor.endTimer(name)
      return result
    } catch (error) {
      PerformanceMonitor.endTimer(name)
      throw error
    }
  }

  static logMemoryUsage(): void {
    if (!Config.MEMORY_MONITORING) return

    if ('memory' in performance) {
      const memory = (performance as any).memory
      Logger.info('Performance', 'Memory usage', {
        used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`,
      })
    }
  }
}
