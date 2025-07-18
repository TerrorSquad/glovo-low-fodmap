import { Logger } from './Logger'

/**
 * Centralized error handling and logging utilities
 */
export class ErrorHandler {
  static logError(
    context: string,
    error: unknown,
    metadata?: Record<string, unknown>,
  ): void {
    const errorMessage = error instanceof Error ? error.message : String(error)
    Logger.error(context, errorMessage, error, metadata)
  }

  static async safeExecute<T>(
    operation: () => Promise<T>,
    context: string,
    fallback?: T,
  ): Promise<T | undefined> {
    try {
      return await operation()
    } catch (error) {
      ErrorHandler.logError(context, error)
      return fallback
    }
  }

  static safeExecuteSync<T>(
    operation: () => T,
    context: string,
    fallback?: T,
  ): T | undefined {
    try {
      return operation()
    } catch (error) {
      ErrorHandler.logError(context, error)
      return fallback
    }
  }

  static createErrorBoundary<T extends unknown[], R>(
    fn: (...args: T) => R,
    context: string,
    fallback?: R,
  ): (...args: T) => R | undefined {
    return (...args: T) => {
      try {
        return fn(...args)
      } catch (error) {
        ErrorHandler.logError(context, error, { args })
        return fallback
      }
    }
  }
}
