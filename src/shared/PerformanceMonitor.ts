import { ErrorHandler } from './ErrorHandler'

/**
 * Performance monitoring utilities
 */
export class PerformanceMonitor {
  private static timers = new Map<string, number>()

  static startTimer(name: string): void {
    PerformanceMonitor.timers.set(name, performance.now())
    ErrorHandler.logInfo('Performance', `Started timer: ${name}`)
  }

  static endTimer(name: string): number {
    const startTime = PerformanceMonitor.timers.get(name)
    if (!startTime) {
      ErrorHandler.logWarning('Performance', `Timer "${name}" was not started`)
      return 0
    }

    const endTime = performance.now()
    const duration = endTime - startTime
    PerformanceMonitor.timers.delete(name)

    ErrorHandler.logInfo('Performance', `${name}: ${duration.toFixed(2)}ms`)
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
    if ('memory' in performance) {
      const memory = (performance as any).memory
      ErrorHandler.logInfo('Performance', 'Memory usage:', {
        used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`,
      })
    }
  }
}
