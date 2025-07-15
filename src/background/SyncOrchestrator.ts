import { BackgroundLogger } from './BackgroundLogger'
import { ContentMessenger } from './ContentMessenger'
import { FodmapApiClient } from './FodmapApiClient'

/**
 * Orchestrates the background sync process
 */
export class SyncOrchestrator {
  private apiClient: FodmapApiClient
  private logger = BackgroundLogger

  constructor(apiEndpoint: string) {
    this.apiClient = new FodmapApiClient(apiEndpoint)
  }

  async syncPendingProducts(): Promise<void> {
    try {
      if (!this.apiClient.isConfigured()) {
        this.logger.warn('API endpoint is not configured')
        return
      }

      const tab = await ContentMessenger.findActiveGlovoTab()
      if (!tab?.id) {
        this.logger.log('No active Glovo tab found')
        return
      }

      const pendingProducts = await ContentMessenger.getPendingProducts()
      if (!pendingProducts.length) {
        this.logger.log('No products to classify from content script')
        return
      }

      this.logger.log(
        `Got ${pendingProducts.length} products from content script. Sending to API...`,
      )

      const classifiedProducts =
        await this.apiClient.classifyProducts(pendingProducts)

      if (classifiedProducts.length > 0) {
        await ContentMessenger.updateProductStatuses(classifiedProducts)
        this.logger.log('Updated statuses sent back to content script')
      }
    } catch (error) {
      this.logger.error('Error in sync process:', error)
    }
  }
}
