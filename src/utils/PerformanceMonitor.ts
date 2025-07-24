import { Config } from './Config'
import { Logger } from './Logger'

type PerformanceOptions = {
  /** Only log if duration exceeds this threshold (ms) */
  threshold?: number
  /** Only log in debug mode */
  debugOnly?: boolean
  /** Always log regardless of other conditions */
  forceLog?: boolean
  /** Additional metadata to include in log */
  metadata?: Record<string, any>
}

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

  static endTimer(name: string, options: PerformanceOptions = {}): number {
    if (!Config.PERFORMANCE_MONITORING) return 0

    const startTime = PerformanceMonitor.timers.get(name)
    if (!startTime) {
      Logger.warn('Performance', `Timer "${name}" was not started`)
      return 0
    }

    const endTime = performance.now()
    const duration = endTime - startTime
    PerformanceMonitor.timers.delete(name)

    // Determine if we should log based on options
    const shouldLog = PerformanceMonitor.shouldLog(duration, options)

    if (shouldLog) {
      Logger.perf('Performance', name, duration, options.metadata)
    }

    return duration
  }

  private static shouldLog(
    duration: number,
    options: PerformanceOptions,
  ): boolean {
    const { threshold = 0, debugOnly = false, forceLog = false } = options

    if (forceLog) return true
    if (debugOnly && !Config.DEBUG_MODE) return false
    if (duration < threshold) return false

    return true
  }

  static async measureAsync<T>(
    name: string,
    operation: () => Promise<T>,
    options: PerformanceOptions = {},
  ): Promise<T> {
    PerformanceMonitor.startTimer(name)
    try {
      const result = await operation()
      PerformanceMonitor.endTimer(name, options)
      return result
    } catch (error) {
      PerformanceMonitor.endTimer(name, options)
      throw error
    }
  }

  static measure<T>(
    name: string,
    operation: () => T,
    options: PerformanceOptions = {},
  ): T {
    PerformanceMonitor.startTimer(name)
    try {
      const result = operation()
      PerformanceMonitor.endTimer(name, options)
      return result
    } catch (error) {
      PerformanceMonitor.endTimer(name, options)
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
