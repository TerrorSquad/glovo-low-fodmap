import { type Product } from '../shared/db'
import { ErrorHandler } from '../shared/ErrorHandler'
import { PerformanceMonitor } from '../shared/PerformanceMonitor'

/**
 * Handles communication with content scripts
 */
export class ContentMessenger {
  private static readonly GLOVO_URL_PATTERN = 'https://glovoapp.com/*'

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

  static async sendToContent(tabId: number, message: any): Promise<any> {
    return await ErrorHandler.safeExecute(
      async () => chrome.tabs.sendMessage(tabId, message),
      'Background',
      null,
    )
  }

  static async getPendingProducts(): Promise<Product[]> {
    return await PerformanceMonitor.measureAsync(
      'getPendingProducts',
      async () => {
        const tab = await ContentMessenger.findActiveGlovoTab()
        if (!tab?.id) {
          ErrorHandler.logInfo(
            'Background',
            'No active Glovo tab found for pending products',
          )
          return []
        }

        try {
          const products = await ContentMessenger.sendToContent(tab.id, {
            action: 'getPendingProducts',
          })
          ErrorHandler.logInfo(
            'Background',
            `Retrieved ${products?.length || 0} pending products`,
          )
          return products || []
        } catch (error) {
          ErrorHandler.logError('Background', error, {
            context: 'Getting pending products',
          })
          return []
        }
      },
    )
  }

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
