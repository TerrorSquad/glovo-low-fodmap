import { ErrorHandler } from '../shared/ErrorHandler'
import { Logger } from '../shared/Logger'
import { PerformanceMonitor } from '../shared/PerformanceMonitor'
import { SyncOrchestrator } from './SyncOrchestrator'

export type BackgroundMessageAction =
  | 'syncWithApi'
  | 'newProductsFound'
  | 'getSyncStatus'
  | 'pollStatus'

export interface BackgroundMessage {
  action: BackgroundMessageAction
  data?: {
    newProductIds?: string[]
  }
}

export interface BackgroundMessageResponse {
  success: boolean
  data?: any
  error?: string
}

/**
 * Handles Chrome runtime messages in the background script
 */
export class BackgroundMessageHandler {
  private syncOrchestrator: SyncOrchestrator

  constructor(syncOrchestrator: SyncOrchestrator) {
    this.syncOrchestrator = syncOrchestrator
  }

  handleMessage = (message: BackgroundMessage): BackgroundMessageResponse => {
    return PerformanceMonitor.measure(
      'handleBackgroundMessage',
      () => {
        try {
          switch (message.action) {
            case 'syncWithApi':
              this.handleManualSync()
              return { success: true }

            case 'newProductsFound':
              this.handleNewProducts(message)
              return { success: true }

            case 'getSyncStatus':
              return {
                success: true,
                data: this.syncOrchestrator.getSyncStatus(),
              }

            case 'pollStatus':
              this.handlePollStatus()
              return { success: true }

            default: {
              const errorMsg = `Unknown message action: ${message.action}`
              Logger.warn('Background', errorMsg)
              return { success: false, error: errorMsg }
            }
          }
        } catch (error) {
          const errorMsg = `Background message handling failed: ${(error as Error).message}`
          ErrorHandler.logError('Background', error, {
            context: 'Background message handling',
            metadata: { action: message.action },
          })
          return { success: false, error: errorMsg }
        }
      },
      { debugOnly: true },
    )
  }

  private handleManualSync(): void {
    Logger.info('Background', 'Received manual sync request')
    this.syncOrchestrator.syncWithApi()
  }

  private handleNewProducts(message: BackgroundMessage): void {
    const newProductIds = message.data?.newProductIds
    if (!newProductIds || newProductIds.length === 0) {
      Logger.warn(
        'Background',
        'Received newProductsFound message without product IDs',
      )
      return
    }

    Logger.info(
      'Background',
      `Received ${newProductIds.length} new products, syncing specific products`,
    )
    this.syncOrchestrator.syncSpecificProducts(newProductIds)
  }

  private handlePollStatus(): void {
    Logger.info('Background', 'Manual status poll requested')
    this.syncOrchestrator
      .forcePollStatus()
      .then(async (pollResult) => {
        if (
          pollResult &&
          Array.isArray(pollResult.missing_hashes) &&
          pollResult.missing_hashes.length > 0
        ) {
          await this.syncOrchestrator.resetSubmittedAtForMissingProducts(
            pollResult.missing_hashes,
          )
        }
      })
      .catch((error) => {
        ErrorHandler.logError('Background', error, {
          context: 'Manual status polling',
        })
      })
  }

  setupListener(): void {
    chrome.runtime.onMessage.addListener(this.handleMessage)
  }
}
