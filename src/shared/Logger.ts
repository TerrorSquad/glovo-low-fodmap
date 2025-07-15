import { Config } from './Config'

export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

/**
 * Enhanced logging utility with configurable log levels
 */
export class Logger {
  private static readonly LOG_LEVELS: Record<LogLevel, number> = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
  }

  private static readonly PREFIX = '[FODMAP Helper]'

  /**
   * Gets the current log level threshold
   */
  private static getCurrentLogLevel(): number {
    return (
      Logger.LOG_LEVELS[Config.LOG_LEVEL as LogLevel] ?? Logger.LOG_LEVELS.info
    )
  }

  /**
   * Checks if a log level should be output
   */
  private static shouldLog(level: LogLevel): boolean {
    return Logger.LOG_LEVELS[level] <= Logger.getCurrentLogLevel()
  }

  /**
   * Formats log message with context and metadata
   */
  private static formatMessage(
    level: LogLevel,
    context: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): string {
    const timestamp = new Date().toISOString().substring(11, 23) // HH:mm:ss.sss
    let formatted = `${Logger.PREFIX} [${timestamp}] [${level.toUpperCase()}] ${context}: ${message}`

    if (metadata && Object.keys(metadata).length > 0) {
      formatted += ` | ${JSON.stringify(metadata)}`
    }

    return formatted
  }

  /**
   * Error logging - always shown
   */
  static error(
    context: string,
    message: string,
    error?: unknown,
    metadata?: Record<string, unknown>,
  ): void {
    if (!Logger.shouldLog('error')) return

    const formattedMessage = Logger.formatMessage(
      'error',
      context,
      message,
      metadata,
    )
    console.error(formattedMessage)

    if (error instanceof Error) {
      console.error('Stack trace:', error.stack)
    } else if (error) {
      console.error('Error details:', error)
    }
  }

  /**
   * Warning logging
   */
  static warn(
    context: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    if (!Logger.shouldLog('warn')) return

    const formattedMessage = Logger.formatMessage(
      'warn',
      context,
      message,
      metadata,
    )
    console.warn(formattedMessage)
  }

  /**
   * Info logging
   */
  static info(
    context: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    if (!Logger.shouldLog('info')) return

    const formattedMessage = Logger.formatMessage(
      'info',
      context,
      message,
      metadata,
    )
    console.log(formattedMessage)
  }

  /**
   * Debug logging - only in debug mode
   */
  static debug(
    context: string,
    message: string,
    metadata?: Record<string, unknown>,
  ): void {
    if (!Logger.shouldLog('debug') || !Config.DEBUG_MODE) return

    const formattedMessage = Logger.formatMessage(
      'debug',
      context,
      message,
      metadata,
    )
    console.debug(formattedMessage)
  }

  /**
   * Performance logging for timing operations
   */
  static perf(
    context: string,
    operation: string,
    duration: number,
    metadata?: Record<string, unknown>,
  ): void {
    if (!Config.PERFORMANCE_MONITORING) return

    Logger.info(
      context,
      `Performance: ${operation} took ${duration.toFixed(2)}ms`,
      metadata,
    )
  }

  /**
   * Logs extension startup info
   */
  static logStartup(context: string): void {
    Logger.info(context, 'Extension starting up')
    Logger.debug(context, 'Configuration:', Config.getInfo())

    if (Config.DEBUG_MODE) {
      Logger.debug(context, 'Debug mode enabled - verbose logging active')
    }
  }

  /**
   * Groups related log messages
   */
  static group(label: string, callback: () => void): void {
    if (!Logger.shouldLog('debug')) return

    console.group(`${Logger.PREFIX} ${label}`)
    try {
      callback()
    } finally {
      console.groupEnd()
    }
  }
}
