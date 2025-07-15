import { Config } from '../shared/Config'
import type { Product } from '../shared/db'
import { ErrorHandler } from '../shared/ErrorHandler'
import { PerformanceMonitor } from '../shared/PerformanceMonitor'
import { ContentMessenger } from './ContentMessenger'
import { FodmapApiClient } from './FodmapApiClient'

/**
 * Orchestrates the background sync process
 */
export class SyncOrchestrator {
  private apiClient: FodmapApiClient
  private syncTimer?: ReturnType<typeof setInterval>
  private lastSyncTime: number = 0
  private isSyncing: boolean = false

  constructor(apiEndpoint: string) {
    this.apiClient = new FodmapApiClient(apiEndpoint)
  }

  /**
   * Starts periodic background sync
   */
  startPeriodicSync(): void {
    if (!Config.ENABLE_SYNC) {
      ErrorHandler.logInfo(
        'Background',
        'Sync is disabled, not starting periodic sync',
      )
      return
    }

    if (!this.apiClient.isConfigured()) {
      ErrorHandler.logWarning(
        'Background',
        'API not configured, cannot start periodic sync',
      )
      return
    }

    if (this.syncTimer) {
      ErrorHandler.logWarning('Background', 'Periodic sync already running')
      return
    }

    const intervalMs = Config.SYNC_INTERVAL
    ErrorHandler.logInfo(
      'Background',
      `Starting periodic sync every ${intervalMs / 1000} seconds`,
    )

    this.syncTimer = setInterval(() => {
      this.performPeriodicSync()
    }, intervalMs)

    // Perform initial sync after a short delay
    setTimeout(() => this.performPeriodicSync(), 5000)
  }

  /**
   * Stops periodic background sync
   */
  stopPeriodicSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer)
      this.syncTimer = undefined
      ErrorHandler.logInfo('Background', 'Stopped periodic sync')
    }
  }

  /**
   * Performs a sync operation (either manual or periodic)
   */
  async syncPendingProducts(): Promise<void> {
    return await this.performSync('manual', 'syncPendingProducts')
  }

  async syncUnknownProducts(): Promise<void> {
    return await this.performSync('unknown', 'syncUnknownProducts')
  }

  private async performPeriodicSync(): Promise<void> {
    return await this.performSync('periodic')
  }

  private async performSync(
    syncType: 'manual' | 'periodic' | 'unknown',
    caller?: string,
  ): Promise<void> {
    return await PerformanceMonitor.measureAsync(
      'syncPendingProducts',
      async () => {
        try {
          if (this.isSyncing) {
            ErrorHandler.logInfo(
              'Background',
              `Skipping ${syncType} sync - already in progress`,
            )
            return
          }

          if (!this.apiClient.isConfigured()) {
            ErrorHandler.logWarning(
              'Background',
              'API endpoint is not configured',
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
                'No active Glovo tab found for manual sync',
              )
            }
            return
          }

          let pendingProducts: Product[]
          if (syncType === 'unknown') {
            pendingProducts = await ContentMessenger.getUnknownProducts()
          } else {
            pendingProducts = await ContentMessenger.getPendingProducts()
          }

          if (!pendingProducts.length) {
            if (syncType === 'manual') {
              ErrorHandler.logInfo(
                'Background',
                'No products to classify from content script',
              )
            }
            return
          }

          ErrorHandler.logInfo(
            'Background',
            `${syncType} sync: Processing ${pendingProducts.length} products...`,
          )

          const classifiedProducts =
            await this.apiClient.classifyProducts(pendingProducts)

          if (classifiedProducts.length > 0) {
            await ContentMessenger.updateProductStatuses(classifiedProducts)
            this.lastSyncTime = syncStartTime

            // Store last sync time in storage for persistence
            await chrome.storage.local.set({
              [Config.STORAGE_KEYS.LAST_SYNC]: this.lastSyncTime,
            })

            ErrorHandler.logInfo(
              'Background',
              `${syncType} sync completed: ${classifiedProducts.length} products classified and updated`,
            )
          }
        } catch (error) {
          ErrorHandler.logError('Background', error, {
            context: `${syncType} sync process`,
          })
        } finally {
          this.isSyncing = false
        }
      },
      {
        threshold: 2000, // Log if sync takes > 2 seconds
        metadata: { syncType, caller },
      },
    )
  }

  /**
   * Gets sync status information
   */
  getSyncStatus(): {
    isRunning: boolean
    isSyncing: boolean
    lastSyncTime: number
    nextSyncTime: number | null
  } {
    return {
      isRunning: !!this.syncTimer,
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      nextSyncTime: this.syncTimer
        ? this.lastSyncTime + Config.SYNC_INTERVAL
        : null,
    }
  }
}
