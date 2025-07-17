import { Config } from '../shared/Config'
import type { Product } from '../shared/db'
import { ErrorBoundary } from '../shared/ErrorBoundary'
import { ErrorHandler } from '../shared/ErrorHandler'
import { PerformanceMonitor } from '../shared/PerformanceMonitor'
import { ContentMessenger } from './ContentMessenger'
import { FodmapApiClient } from './FodmapApiClient'

type SyncType = 'manual' | 'periodic'

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

      // Start submit sync (for unsubmitted products)
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

  async syncWithApi(): Promise<void> {
    return await this.performSubmitSync('manual')
  }

  async syncSpecificProducts(externalIds: string[]): Promise<void> {
    return await this.performSpecificProductsSync(externalIds)
  }

  async forcePollStatus(): Promise<void> {
    return await this.performStatusPoll()
  }

  private async performSpecificProductsSync(
    externalIds: string[],
  ): Promise<void> {
    await PerformanceMonitor.measureAsync(
      'performSpecificProductsSync',
      async () => {
        await ErrorBoundary.protect(async () => {
          if (this.isSyncing) {
            ErrorHandler.logInfo(
              'Background',
              'Submit sync already in progress, skipping specific products sync',
            )
            return
          }

          this.isSyncing = true

          const tab = await ContentMessenger.findActiveGlovoTab()
          if (!tab?.id) {
            ErrorHandler.logInfo(
              'Background',
              'No active Glovo tab found for specific products sync',
            )
            return
          }

          // Get specific products by their external IDs
          const allProducts =
            await ContentMessenger.getProductsByExternalIds(externalIds)

          // Filter to only unsubmitted products (no submittedAt AND status is UNKNOWN/PENDING)
          const productsToSubmit = allProducts.filter(
            (product) =>
              (product.submittedAt === null ||
                product.submittedAt === undefined) &&
              (product.status === 'UNKNOWN' || product.status === 'PENDING'),
          )

          if (!productsToSubmit.length) {
            ErrorHandler.logInfo(
              'Background',
              `No unsubmitted products found for specific sync with IDs: ${externalIds.join(', ')}`,
            )
            return
          }

          ErrorHandler.logInfo(
            'Background',
            `Starting specific products sync for ${productsToSubmit.length} unsubmitted products`,
          )

          // Set submittedAt timestamp before submitting to API
          const currentTime = new Date()
          const productsWithSubmittedAt = productsToSubmit.map((product) => ({
            ...product,
            submittedAt: currentTime,
          }))

          // Update products with submittedAt timestamp
          await ContentMessenger.updateProductStatuses(productsWithSubmittedAt)

          const startTime = performance.now()
          this.isSyncing = true

          try {
            const submitResult =
              await this.apiClient.submitProducts(productsToSubmit)
            const syncDuration = Math.round(performance.now() - startTime)

            ErrorHandler.logInfo(
              'Background',
              `Specific products sync completed: ${submitResult.submitted_count} products submitted in ${syncDuration}ms`,
            )

            // Immediately poll for status of newly submitted products
            this.performImmediateStatusPoll(
              productsToSubmit.map((p: Product) => p.externalId),
            )
          } catch (error) {
            ErrorHandler.logError('Background', error, {
              context: 'Specific products submit sync',
              metadata: { productCount: productsToSubmit.length, externalIds },
            })
          } finally {
            this.isSyncing = false
          }
        }, 'SyncOrchestrator.performSpecificProductsSync')
      },
      { threshold: 500, debugOnly: false },
    )
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
            if (syncType === 'manual') {
              ErrorHandler.logInfo(
                'Background',
                `No active Glovo tab found for ${syncType} sync`,
              )
            }
            return
          }

          // Get unsubmitted products
          const productsToSubmit =
            await ContentMessenger.getUnsubmittedProducts()

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

          // Set submittedAt timestamp before submitting to API
          const currentTime = new Date()
          const productsWithSubmittedAt = productsToSubmit.map((product) => ({
            ...product,
            submittedAt: currentTime,
          }))

          // Update products with submittedAt timestamp
          await ContentMessenger.updateProductStatuses(productsWithSubmittedAt)

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

            // Immediately poll for any quick classifications
            ErrorHandler.logInfo(
              'Background',
              'Performing immediate status poll after submission...',
            )

            // Small delay to allow for quick processing
            await new Promise((resolve) => setTimeout(resolve, 3000))

            try {
              await this.performImmediateStatusPoll(
                productsToSubmit.map((p) => p.externalId),
              )
            } catch (error) {
              ErrorHandler.logError('Background', error, {
                context: 'Immediate status poll after submission',
              })
              // Don't fail the entire submission if polling fails
            }
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

          // Get products that need submission
          const unsubmittedProducts =
            await ContentMessenger.getUnsubmittedProducts()
          const externalIds = unsubmittedProducts.map((p) => p.externalId)

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
                const originalProduct = unsubmittedProducts.find(
                  (p) => p.externalId === apiProduct.externalId,
                )
                if (!originalProduct) return null

                return {
                  ...originalProduct,
                  status: apiProduct.status, // Status is already in correct format (LOW/HIGH/UNKNOWN/PENDING)
                  processedAt: apiProduct.processedAt
                    ? new Date(apiProduct.processedAt)
                    : new Date(),
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

  /**
   * Performs an immediate status poll for specific product IDs after submission
   */
  private async performImmediateStatusPoll(
    productIds: string[],
  ): Promise<void> {
    if (productIds.length === 0) return

    await ErrorBoundary.protect(async () => {
      ErrorHandler.logInfo(
        'Background',
        `Starting immediate status poll for ${productIds.length} products`,
      )

      const statusResult = await this.apiClient.pollProductStatus(productIds)

      if (statusResult.results.length > 0) {
        // Get unsubmitted products to have full Product objects
        const unsubmittedProducts =
          await ContentMessenger.getUnsubmittedProducts()

        const updatedProducts = statusResult.results
          .filter((apiProduct) => apiProduct.status !== 'PENDING') // Only update completed classifications
          .map((apiProduct) => {
            const originalProduct = unsubmittedProducts.find(
              (p: Product) => p.externalId === apiProduct.externalId,
            )
            if (!originalProduct) return null

            return {
              ...originalProduct,
              status: apiProduct.status,
              processedAt: apiProduct.processedAt
                ? new Date(apiProduct.processedAt)
                : new Date(),
            } as Product
          })
          .filter((product): product is Product => product !== null)

        if (updatedProducts.length > 0) {
          await ContentMessenger.updateProductStatuses(updatedProducts)

          ErrorHandler.logInfo(
            'Background',
            `Immediate status poll completed: ${updatedProducts.length} products quickly classified`,
          )
        } else {
          ErrorHandler.logInfo(
            'Background',
            'Immediate status poll: All products still pending classification',
          )
        }
      }
    }, 'SyncOrchestrator.performImmediateStatusPoll')
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
