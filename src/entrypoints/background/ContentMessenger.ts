import type { Product } from '@/utils/db'
import { ErrorHandler } from '@/utils/ErrorHandler'
import { Logger } from '@/utils/Logger'
import { PerformanceMonitor } from '@/utils/PerformanceMonitor'

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
          Logger.info(
            'Background',
            'No active Glovo tab found for unsubmitted products',
          )
          return []
        }

        try {
          const products = await ContentMessenger.sendToContent(tab.id, {
            action: 'getUnsubmittedProducts',
          })
          Logger.info(
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
          Logger.info(
            'Background',
            'No active Glovo tab found for submitted unprocessed products',
          )
          return []
        }

        try {
          const products = await ContentMessenger.sendToContent(tab.id, {
            action: 'getSubmittedUnprocessedProducts',
          })
          Logger.info(
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
   * Retrieves specific products by their hashes.
   * Used when sync operations need to get full product data for specific items.
   * Delegates to content script to query the database.
   *
   * @param hashes - Array of product hashes to retrieve
   * @returns Promise resolving to array of matching products
   */
  static async getProductsByHashes(hashes: string[]): Promise<Product[]> {
    return await PerformanceMonitor.measureAsync(
      'getProductsByHashes',
      async () => {
        const tab = await ContentMessenger.findActiveGlovoTab()
        if (!tab?.id) {
          Logger.info(
            'Background',
            'No active Glovo tab found for specific products',
          )
          return []
        }

        try {
          const products = await ContentMessenger.sendToContent(tab.id, {
            action: 'getProductsByHashes',
            data: { hashes },
          })
          Logger.info(
            'Background',
            `Retrieved ${products?.length || 0} products by hashes`,
          )
          return products || []
        } catch (error) {
          ErrorHandler.logError('Background', error, {
            context: 'Getting products by hashes',
            metadata: { hashes },
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
          Logger.warn(
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
          Logger.info(
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

  static async resetSubmittedAtForMissingProducts(
    hashes: string[],
  ): Promise<void> {
    return await PerformanceMonitor.measureAsync(
      'resetSubmittedAtForMissingProducts',
      async () => {
        const tab = await ContentMessenger.findActiveGlovoTab()
        if (!tab?.id) {
          Logger.warn(
            'Background',
            'No active Glovo tab found for resetting submittedAt',
          )
          return
        }

        try {
          await ContentMessenger.sendToContent(tab.id, {
            action: 'resetSubmittedAtForMissingProducts',
            data: { hashes },
          })
          Logger.info(
            'Background',
            `Reset submittedAt for ${hashes.length} products`,
          )
        } catch (error) {
          ErrorHandler.logError('Background', error, {
            context: 'Resetting submittedAt for missing products',
            metadata: { hashes },
          })
        }
      },
    )
  }
}
