import { ErrorHandler } from '../shared/ErrorHandler'
import { PerformanceMonitor } from '../shared/PerformanceMonitor'
import { ContentMessenger } from './ContentMessenger'
import { FodmapApiClient } from './FodmapApiClient'

/**
 * Orchestrates the background sync process
 */
export class SyncOrchestrator {
  private apiClient: FodmapApiClient

  constructor(apiEndpoint: string) {
    this.apiClient = new FodmapApiClient(apiEndpoint)
  }

  async syncPendingProducts(): Promise<void> {
    return await PerformanceMonitor.measureAsync(
      'syncPendingProducts',
      async () => {
        try {
          if (!this.apiClient.isConfigured()) {
            ErrorHandler.logWarning(
              'Background',
              'API endpoint is not configured',
            )
            return
          }

          const tab = await ContentMessenger.findActiveGlovoTab()
          if (!tab?.id) {
            ErrorHandler.logInfo('Background', 'No active Glovo tab found')
            return
          }

          const pendingProducts = await ContentMessenger.getPendingProducts()
          if (!pendingProducts.length) {
            ErrorHandler.logInfo(
              'Background',
              'No products to classify from content script',
            )
            return
          }

          ErrorHandler.logInfo(
            'Background',
            `Got ${pendingProducts.length} products from content script. Sending to API...`,
          )

          const classifiedProducts =
            await this.apiClient.classifyProducts(pendingProducts)

          if (classifiedProducts.length > 0) {
            await ContentMessenger.updateProductStatuses(classifiedProducts)
            ErrorHandler.logInfo(
              'Background',
              'Updated statuses sent back to content script',
            )
          }
        } catch (error) {
          ErrorHandler.logError('Background', error, {
            context: 'Sync process',
          })
        }
      },
    )
  }
}
