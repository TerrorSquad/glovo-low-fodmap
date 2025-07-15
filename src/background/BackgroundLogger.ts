import { ContentMessenger } from './ContentMessenger'

/**
 * Background logger that forwards messages to content script
 */
export class BackgroundLogger {
  static log(message: unknown, ...optionalParams: unknown[]): void {
    console.log(`BG ${message}`, ...optionalParams)
    ContentMessenger.sendLogMessage('log', message, optionalParams)
  }

  static warn(message: unknown, ...optionalParams: unknown[]): void {
    console.warn(`BG ${message}`, ...optionalParams)
    ContentMessenger.sendLogMessage('warn', message, optionalParams)
  }

  static error(message: unknown, ...optionalParams: unknown[]): void {
    const serializedParams = optionalParams.map((param) => {
      if (param instanceof Error) {
        return {
          name: param.name,
          message: param.message,
          stack: param.stack,
        }
      }
      return param
    })

    console.error(`BG ${message}`, ...optionalParams)
    ContentMessenger.sendLogMessage('error', message, serializedParams)
  }
}
