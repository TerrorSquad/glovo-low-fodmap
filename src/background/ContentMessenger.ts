import { type Product } from '../shared/db'
import { ErrorHandler } from '../shared/ErrorHandler'
import { PerformanceMonitor } from '../shared/PerformanceMonitor'

/**
 * Handles communication between background script and content scripts.
 * Provides abstraction layer for Chrome tabs messaging API with error handling.
 * Manages finding active Glovo tabs and sending/receiving product data.
 */
export class ContentMessenger {
  /** URL pattern for matching Glovo website tabs */
  private static readonly GLOVO_URL_PATTERN = 'https://glovoapp.com/*'

  /**
   * Finds the currently active Glovo tab in the browser.
   * Used to ensure operations only happen on Glovo pages.
   *
   * @returns Promise resolving to active Glovo tab or null if none found
   */
  static async findActiveGlovoTab(): Promise<chrome.tabs.Tab | null> {
    return (
      (await ErrorHandler.safeExecute(
        async () => {
          const tabs = await chrome.tabs.query({
            active: true,
            url: ContentMessenger.GLOVO_URL_PATTERN,
          })
          return tabs[0] || null
        },
        'Background',
        null,
      )) || null
    )
  }

  /**
   * Sends a message to a content script running in a specific tab.
   * Wrapper around Chrome's tabs.sendMessage with error handling.
   *
   * @param tabId - Chrome tab ID to send message to
   * @param message - Message object to send to content script
   * @returns Promise resolving to the response from content script
   */
  static async sendToContent(tabId: number, message: any): Promise<any> {
    return await ErrorHandler.safeExecute(
      async () => chrome.tabs.sendMessage(tabId, message),
      'Background',
      null,
    )
  }

  /**
   * Retrieves products that need to be submitted to the FODMAP API.
   * Delegates to content script to query the database for unsubmitted products.
   *
   * @returns Promise resolving to array of unsubmitted products
   */
  static async getUnsubmittedProducts(): Promise<Product[]> {
    return await PerformanceMonitor.measureAsync(
      'getUnsubmittedProducts',
      async () => {
        const tab = await ContentMessenger.findActiveGlovoTab()
        if (!tab?.id) {
          ErrorHandler.logInfo(
            'Background',
            'No active Glovo tab found for unsubmitted products',
          )
          return []
        }

        try {
          const products = await ContentMessenger.sendToContent(tab.id, {
            action: 'getUnsubmittedProducts',
          })
          ErrorHandler.logInfo(
            'Background',
            `Retrieved ${products?.length || 0} unsubmitted products`,
          )
          return products || []
        } catch (error) {
          ErrorHandler.logError('Background', error, {
            context: 'Getting unsubmitted products',
          })
          return []
        }
      },
    )
  }

  /**
   * Retrieves products that have been submitted to API but not yet processed.
   * Used by polling operations to check for completed classifications.
   * Delegates to content script to query the database.
   *
   * @returns Promise resolving to array of submitted but unprocessed products
   */
  static async getSubmittedUnprocessedProducts(): Promise<Product[]> {
    return await PerformanceMonitor.measureAsync(
      'getSubmittedUnprocessedProducts',
      async () => {
        const tab = await ContentMessenger.findActiveGlovoTab()
        if (!tab?.id) {
          ErrorHandler.logInfo(
            'Background',
            'No active Glovo tab found for submitted unprocessed products',
          )
          return []
        }

        try {
          const products = await ContentMessenger.sendToContent(tab.id, {
            action: 'getSubmittedUnprocessedProducts',
          })
          ErrorHandler.logInfo(
            'Background',
            `Retrieved ${products?.length || 0} submitted unprocessed products`,
          )
          return products || []
        } catch (error) {
          ErrorHandler.logError('Background', error, {
            context: 'Getting submitted unprocessed products',
          })
          return []
        }
      },
    )
  }

  /**
   * Retrieves specific products by their external IDs.
   * Used when sync operations need to get full product data for specific items.
   * Delegates to content script to query the database.
   *
   * @param externalIds - Array of Glovo product IDs to retrieve
   * @returns Promise resolving to array of matching products
   */
  static async getProductsByExternalIds(
    externalIds: string[],
  ): Promise<Product[]> {
    return await PerformanceMonitor.measureAsync(
      'getProductsByExternalIds',
      async () => {
        const tab = await ContentMessenger.findActiveGlovoTab()
        if (!tab?.id) {
          ErrorHandler.logInfo(
            'Background',
            'No active Glovo tab found for specific products',
          )
          return []
        }

        try {
          const products = await ContentMessenger.sendToContent(tab.id, {
            action: 'getProductsByExternalIds',
            data: { externalIds },
          })
          ErrorHandler.logInfo(
            'Background',
            `Retrieved ${products?.length || 0} products by external IDs`,
          )
          return products || []
        } catch (error) {
          ErrorHandler.logError('Background', error, {
            context: 'Getting products by external IDs',
            metadata: { externalIds },
          })
          return []
        }
      },
    )
  }

  /**
   * Updates product statuses and timestamps in the database.
   * Used to save API responses and sync results back to the database.
   * Delegates to content script to perform the database updates.
   *
   * @param results - Array of products with updated status information
   */
  static async updateProductStatuses(results: Product[]): Promise<void> {
    return await PerformanceMonitor.measureAsync(
      'updateProductStatuses',
      async () => {
        const tab = await ContentMessenger.findActiveGlovoTab()
        if (!tab?.id) {
          ErrorHandler.logWarning(
            'Background',
            'No active Glovo tab found for status update',
          )
          return
        }

        try {
          await ContentMessenger.sendToContent(tab.id, {
            action: 'updateStatuses',
            data: results,
          })
          ErrorHandler.logInfo(
            'Background',
            `Updated ${results.length} product statuses`,
          )
        } catch (error) {
          ErrorHandler.logError('Background', error, {
            context: 'Updating product statuses',
          })
        }
      },
    )
  }

  /**
   * Sends log messages to content script for unified logging.
   * Allows background script logs to be forwarded to content script logger.
   * Used to consolidate logging output from both contexts.
   *
   * @param level - Log level (log, warn, error)
   * @param message - Main log message
   * @param optionalParams - Additional parameters to log
   */
  static sendLogMessage(
    level: 'log' | 'warn' | 'error',
    message: unknown,
    optionalParams: unknown[],
  ): void {
    chrome.tabs.query(
      { active: true, url: ContentMessenger.GLOVO_URL_PATTERN },
      (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'log',
            payload: {
              level,
              message,
              optionalParams,
            },
          })
        }
      },
    )
  }
}
