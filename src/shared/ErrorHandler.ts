/**
 * Centralized error handling and logging utilities
 */
export class ErrorHandler {
  private static readonly ERROR_PREFIX = '[FODMAP Helper]'

  static logError(
    context: string,
    error: unknown,
    ...details: unknown[]
  ): void {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined

    console.error(
      `${ErrorHandler.ERROR_PREFIX} ${context}:`,
      errorMessage,
      ...details,
    )
    if (stack) {
      console.error('Stack trace:', stack)
    }
  }

  static logWarning(
    context: string,
    message: string,
    ...details: unknown[]
  ): void {
    console.warn(
      `${ErrorHandler.ERROR_PREFIX} ${context}:`,
      message,
      ...details,
    )
  }

  static logInfo(
    context: string,
    message: string,
    ...details: unknown[]
  ): void {
    console.log(`${ErrorHandler.ERROR_PREFIX} ${context}:`, message, ...details)
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
