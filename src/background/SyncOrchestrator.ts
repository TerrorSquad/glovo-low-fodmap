import { Config } from '../shared/Config'
import type { Product } from '../shared/db'
import { ErrorBoundary } from '../shared/ErrorBoundary'
import { ErrorHandler } from '../shared/ErrorHandler'
import { PerformanceMonitor } from '../shared/PerformanceMonitor'
import { ContentMessenger } from './ContentMessenger'
import { FodmapApiClient } from './FodmapApiClient'

type SyncType = 'manual' | 'periodic' | 'unknown'

/**
 * Orchestrates background sync operations using submit-and-poll pattern
 */
export class SyncOrchestrator {
  private static instance?: SyncOrchestrator
  private readonly apiClient: FodmapApiClient
  private isSyncing = false
  private isPolling = false
  private lastSyncTime = 0
  private syncInterval?: NodeJS.Timeout
  private pollInterval?: NodeJS.Timeout

  private constructor() {
    this.apiClient = new FodmapApiClient(Config.API_ENDPOINT)
  }

  static getInstance(): SyncOrchestrator {
    if (!SyncOrchestrator.instance) {
      SyncOrchestrator.instance = new SyncOrchestrator()
    }
    return SyncOrchestrator.instance
  }

  async startPeriodicSync(): Promise<void> {
    await ErrorBoundary.protect(async () => {
      if (this.syncInterval) {
        return
      }

      ErrorHandler.logInfo('Background', 'Starting periodic sync and polling')

      // Start submit sync (for new unknown/pending products)
      this.syncInterval = setInterval(() => {
        this.performSubmitSync('periodic').catch((error: unknown) => {
          ErrorHandler.logError('Background', error, {
            context: 'Periodic submit sync',
          })
        })
      }, Config.SYNC_INTERVAL)

      // Start status polling (for previously submitted products)
      this.pollInterval = setInterval(() => {
        this.performStatusPoll().catch((error: unknown) => {
          ErrorHandler.logError('Background', error, {
            context: 'Periodic status polling',
          })
        })
      }, Config.SYNC_POLL_INTERVAL)

      // Perform initial sync
      await this.performSubmitSync('periodic')
    }, 'SyncOrchestrator.startPeriodicSync')
  }

  async stopPeriodicSync(): Promise<void> {
    await ErrorBoundary.protect(async () => {
      if (this.syncInterval) {
        clearInterval(this.syncInterval)
        this.syncInterval = undefined
      }
      if (this.pollInterval) {
        clearInterval(this.pollInterval)
        this.pollInterval = undefined
      }
      ErrorHandler.logInfo('Background', 'Stopped periodic sync and polling')
    }, 'SyncOrchestrator.stopPeriodicSync')
  }

  async syncPendingProducts(): Promise<void> {
    return await this.performSubmitSync('manual')
  }

  async syncUnknownProducts(): Promise<void> {
    return await this.performSubmitSync('unknown')
  }

  async forcePollStatus(): Promise<void> {
    return await this.performStatusPoll()
  }

  private async performSubmitSync(syncType: SyncType): Promise<void> {
    await PerformanceMonitor.measureAsync(
      'performSubmitSync',
      async () => {
        await ErrorBoundary.protect(async () => {
          if (this.isSyncing) {
            ErrorHandler.logInfo(
              'Background',
              'Submit sync already in progress, skipping',
            )
            return
          }

          if (!this.apiClient.isConfigured()) {
            ErrorHandler.logInfo(
              'Background',
              'API client not configured, skipping submit sync',
            )
            return
          }

          this.isSyncing = true
          const syncStartTime = Date.now()

          const tab = await ContentMessenger.findActiveGlovoTab()
          if (!tab?.id) {
            if (syncType === 'manual' || syncType === 'unknown') {
              ErrorHandler.logInfo(
                'Background',
                `No active Glovo tab found for ${syncType} sync`,
              )
            }
            return
          }

          // Get products to submit based on sync type
          let productsToSubmit: Product[]
          if (syncType === 'unknown') {
            productsToSubmit = await ContentMessenger.getUnknownProducts()
          } else {
            productsToSubmit = await ContentMessenger.getPendingProducts()
          }

          if (!productsToSubmit.length) {
            ErrorHandler.logInfo(
              'Background',
              `No products to submit for ${syncType} sync`,
            )
            return
          }

          ErrorHandler.logInfo(
            'Background',
            `Starting ${syncType} submit sync for ${productsToSubmit.length} products`,
          )

          // Submit products to API
          const submitResult =
            await this.apiClient.submitProducts(productsToSubmit)

          if (submitResult.success) {
            // Mark submitted products as pending
            const updatedProducts = productsToSubmit.map((product) => ({
              ...product,
              status: 'PENDING' as const,
            }))

            await ContentMessenger.updateProductStatuses(updatedProducts)

            const syncDuration = Date.now() - syncStartTime
            this.lastSyncTime = Date.now()

            ErrorHandler.logInfo(
              'Background',
              `${syncType} submit sync completed: ${submitResult.submitted_count} products submitted in ${syncDuration}ms`,
            )
          } else {
            throw new Error(`Submit sync failed: ${submitResult.message}`)
          }
        }, `SyncOrchestrator.performSubmitSync.${syncType}`)
      },
      {
        threshold: 2000,
        metadata: { syncType },
      },
    )
    this.isSyncing = false
  }

  private async performStatusPoll(): Promise<void> {
    await PerformanceMonitor.measureAsync(
      'performStatusPoll',
      async () => {
        await ErrorBoundary.protect(async () => {
          if (this.isPolling) {
            return
          }

          if (!this.apiClient.isConfigured()) {
            return
          }

          this.isPolling = true

          const tab = await ContentMessenger.findActiveGlovoTab()
          if (!tab?.id) {
            return
          }

          // Get products with pending status
          const pendingProducts = await ContentMessenger.getPendingProducts()
          const unknownProducts = await ContentMessenger.getUnknownProducts()
          const allProducts = [...pendingProducts, ...unknownProducts]
          const externalIds = allProducts.map((p) => p.externalId)

          if (!externalIds.length) {
            return
          }

          // Poll for status updates
          const statusResult =
            await this.apiClient.pollProductStatus(externalIds)

          if (statusResult.results.length > 0) {
            // Update products with new statuses (only non-PENDING)
            const updatedProducts = statusResult.results
              .filter((apiProduct) => apiProduct.status !== 'PENDING') // Only update completed classifications
              .map((apiProduct) => {
                const originalProduct = allProducts.find(
                  (p) => p.externalId === apiProduct.externalId,
                )
                if (!originalProduct) return null

                return {
                  ...originalProduct,
                  status: apiProduct.status, // Status is already in correct format (LOW/HIGH/UNKNOWN/PENDING)
                } as Product
              })
              .filter((product): product is Product => product !== null)

            if (updatedProducts.length > 0) {
              await ContentMessenger.updateProductStatuses(updatedProducts)

              ErrorHandler.logInfo(
                'Background',
                `Status poll completed: ${updatedProducts.length} products updated (${statusResult.found} found, ${statusResult.missing} missing)`,
              )
            } else if (statusResult.results.length > 0) {
              ErrorHandler.logInfo(
                'Background',
                `Status poll completed: All ${statusResult.results.length} products still pending`,
              )
            }
          }
        }, 'SyncOrchestrator.performStatusPoll')
      },
      {
        threshold: 1000,
      },
    )
    this.isPolling = false
  }

  getSyncStatus(): {
    isSyncing: boolean
    isPolling: boolean
    lastSyncTime: number
    nextSyncTime?: number
  } {
    return {
      isSyncing: this.isSyncing,
      isPolling: this.isPolling,
      lastSyncTime: this.lastSyncTime,
      nextSyncTime: this.lastSyncTime + Config.SYNC_INTERVAL,
    }
  }
}
