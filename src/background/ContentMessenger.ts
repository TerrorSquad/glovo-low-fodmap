import { type Product } from '../shared/db'

/**
 * Handles communication with content scripts
 */
export class ContentMessenger {
  private static readonly GLOVO_URL_PATTERN = 'https://glovoapp.com/*'

  static async findActiveGlovoTab(): Promise<chrome.tabs.Tab | null> {
    const tabs = await chrome.tabs.query({
      active: true,
      url: ContentMessenger.GLOVO_URL_PATTERN,
    })
    return tabs[0] || null
  }

  static async sendToContent(tabId: number, message: any): Promise<any> {
    return chrome.tabs.sendMessage(tabId, message)
  }

  static async getPendingProducts(): Promise<Product[]> {
    const tab = await ContentMessenger.findActiveGlovoTab()
    if (!tab?.id) return []

    try {
      const products = await ContentMessenger.sendToContent(tab.id, {
        action: 'getPendingProducts',
      })
      return products || []
    } catch (error) {
      console.error('Error getting pending products:', error)
      return []
    }
  }

  static async updateProductStatuses(results: Product[]): Promise<void> {
    const tab = await ContentMessenger.findActiveGlovoTab()
    if (!tab?.id) return

    await ContentMessenger.sendToContent(tab.id, {
      action: 'updateStatuses',
      data: results,
    })
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
