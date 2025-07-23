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
}
