import { ContentMessenger } from '@/entrypoints/background/ContentMessenger'
import {
  FodmapApiClient,
  type StatusResponse,
} from '@/entrypoints/background/FodmapApiClient'
import { Config } from '@/utils/Config'
import { Product } from '@/utils/db'
import { ErrorHandler } from '@/utils/ErrorHandler'
import { Logger } from '@/utils/Logger'

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
    if (this.syncInterval) {
      return
    }

    Logger.info('Background', 'Starting periodic sync and polling')

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
  }

  async stopPeriodicSync(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = undefined
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = undefined
    }
    Logger.info('Background', 'Stopped periodic sync and polling')
  }

  async syncWithApi(): Promise<void> {
    return await this.performSubmitSync('manual')
  }

  async syncSpecificProducts(hashes: string[]): Promise<void> {
    return await this.performSpecificProductsSync(hashes)
  }

  async forcePollStatus(): Promise<StatusResponse | undefined> {
    return await this.performStatusPoll()
  }

  /**
   * Resets submittedAt for products that are stuck in PENDING and not found by API.
   * This is the background-context version of the same function in ProductManager.
   * @param hashes - The hashes of the products to reset.
   */
  async resetSubmittedAtForMissingProducts(hashes: string[]): Promise<void> {
    if (this.isPolling) {
      return
    }

    if (!this.apiClient.isConfigured()) {
      return
    }

    this.isPolling = true

    const tab = await ContentMessenger.findActiveGlovoTab()
    if (!tab?.id) {
      Logger.info(
        'Background',
        'No active Glovo tab found for resetting submittedAt',
      )
      this.isPolling = false
      return
    }

    await ContentMessenger.resetSubmittedAtForMissingProducts(hashes)
    Logger.info('Background', `Reset submittedAt for ${hashes.length} products`)
    this.isPolling = false
  }

  private async performSpecificProductsSync(hashes: string[]): Promise<void> {
    if (this.isSyncing) {
      Logger.info(
        'Background',
        'Submit sync already in progress, skipping specific products sync',
      )
      return
    }

    this.isSyncing = true
    try {
      const tab = await ContentMessenger.findActiveGlovoTab()
      if (!tab?.id) {
        Logger.info(
          'Background',
          'No active Glovo tab found for specific products sync',
        )
        this.isSyncing = false
        return
      }

      // Get specific products by their hashes
      const allProducts = await ContentMessenger.getProductsByHashes(hashes)

      // Filter to only unsubmitted products (no submittedAt AND status is UNKNOWN/PENDING)
      const productsToSubmit = allProducts.filter(
        (product) =>
          (product.submittedAt === null || product.submittedAt === undefined) &&
          (product.status === 'UNKNOWN' || product.status === 'PENDING'),
      )

      if (!productsToSubmit.length) {
        Logger.info(
          'Background',
          `No unsubmitted products found for specific sync with hashes: ${hashes.join(', ')}`,
        )
        this.isSyncing = false
        return
      }

      Logger.info(
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
        await this.apiClient.submitProducts(productsToSubmit)
        const syncDuration = Math.round(performance.now() - startTime)
        Logger.info(
          'Background',
          `Specific products sync completed: ${productsToSubmit.length} products submitted in ${syncDuration}ms`,
        )
      } catch (error) {
        ErrorHandler.logError('Background', error, {
          context: 'Specific products submit sync',
          metadata: { productCount: productsToSubmit.length, hashes },
        })
      } finally {
        this.isSyncing = false
      }
    } finally {
      this.isSyncing = false
    }
  }

  private async performSubmitSync(syncType: SyncType): Promise<void> {
    if (this.isSyncing) {
      Logger.info('Background', 'Submit sync already in progress, skipping')
      return
    }

    if (!this.apiClient.isConfigured()) {
      Logger.info(
        'Background',
        'API client not configured, skipping submit sync',
      )
      return
    }

    this.isSyncing = true
    try {
      const syncStartTime = Date.now()

      const tab = await ContentMessenger.findActiveGlovoTab()
      if (!tab?.id) {
        if (syncType === 'manual') {
          Logger.info(
            'Background',
            `No active Glovo tab found for ${syncType} sync`,
          )
        }
        this.isSyncing = false
        return
      }

      // Get unsubmitted products
      const productsToSubmit = await ContentMessenger.getUnsubmittedProducts()

      if (!productsToSubmit.length) {
        Logger.info('Background', `No products to submit for ${syncType} sync`)
        this.isSyncing = false
        return
      }

      Logger.info(
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
      const submitResult = await this.apiClient.submitProducts(productsToSubmit)

      if (submitResult.success) {
        // Mark submitted products as pending
        const updatedProducts = productsToSubmit.map((product) => ({
          ...product,
          status: 'PENDING' as const,
        }))

        await ContentMessenger.updateProductStatuses(updatedProducts)

        const syncDuration = Date.now() - syncStartTime
        this.lastSyncTime = Date.now()

        Logger.info(
          'Background',
          `${syncType} submit sync completed: ${submitResult.submitted_count} products submitted in ${syncDuration}ms`,
        )

        // Immediately poll for any quick classifications
        Logger.info(
          'Background',
          'Performing immediate status poll after submission...',
        )
      } else {
        throw new Error(`Submit sync failed: ${submitResult.message}`)
      }
    } finally {
      this.isSyncing = false
    }
  }

  private async performStatusPoll(): Promise<StatusResponse | undefined> {
    if (this.isPolling) {
      return
    }
    if (!this.apiClient.isConfigured()) {
      return
    }
    this.isPolling = true
    try {
      let statusResult: StatusResponse | undefined

      const tab = await ContentMessenger.findActiveGlovoTab()
      if (!tab?.id) {
        Logger.info('Background', 'No active Glovo tab found for status poll')
        this.isPolling = false
        return
      }

      // Get products that have been submitted but not yet processed
      const submittedUnprocessedProducts =
        await ContentMessenger.getSubmittedUnprocessedProducts()
      const hashes = submittedUnprocessedProducts.map((p) => p.hash)

      if (!hashes.length) {
        Logger.info('Background', 'No submitted products found for status poll')
        this.isPolling = false
        return
      }

      statusResult = await this.apiClient.pollProductStatus(hashes)
      if (statusResult.results.length > 0) {
        const updatedProducts = statusResult.results
          .filter((apiProduct: any) => apiProduct.status !== 'PENDING')
          .map((apiProduct: any) => {
            const originalProduct = submittedUnprocessedProducts.find(
              (p: Product) => p.hash === apiProduct.nameHash,
            )
            if (!originalProduct) return null

            return {
              ...originalProduct,
              status: apiProduct.status,
              processedAt: apiProduct.processedAt
                ? new Date(apiProduct.processedAt)
                : new Date(),
              explanation: apiProduct.explanation,
              isFood: apiProduct.isFood,
            } as Product
          })
          .filter((product: any): product is Product => product !== null)

        if (updatedProducts.length > 0) {
          await ContentMessenger.updateProductStatuses(updatedProducts)

          Logger.info(
            'Background',
            `Status poll completed: ${updatedProducts.length} products updated (${statusResult.found} found, ${statusResult.missing} missing)`,
          )
        } else if (statusResult.results.length > 0) {
          Logger.info(
            'Background',
            `Status poll completed: All ${statusResult.results.length} products still pending`,
          )
        }
      }
      return statusResult
    } finally {
      this.isPolling = false
    }
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
