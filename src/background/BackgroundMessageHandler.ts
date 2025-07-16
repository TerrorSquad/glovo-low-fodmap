import { ErrorHandler } from '../shared/ErrorHandler'
import { PerformanceMonitor } from '../shared/PerformanceMonitor'
import { SyncOrchestrator } from './SyncOrchestrator'

export type BackgroundMessageAction =
  | 'syncWithApi'
  | 'syncUnknownProducts'
  | 'newProductsFound'
  | 'getSyncStatus'
  | 'pollStatus'

export interface BackgroundMessage {
  action: BackgroundMessageAction
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

            case 'syncUnknownProducts':
              this.handleUnknownProductsSync()
              return { success: true }

            case 'newProductsFound':
              this.handleNewProducts()
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
              ErrorHandler.logWarning('Background', errorMsg)
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
    ErrorHandler.logInfo('Background', 'Received manual sync request')
    this.syncOrchestrator.syncPendingProducts()
  }

  private handleNewProducts(): void {
    ErrorHandler.logInfo(
      'Background',
      'Received new products list for classification',
    )
    this.syncOrchestrator.syncPendingProducts()
  }

  private handleUnknownProductsSync(): void {
    ErrorHandler.logInfo('Background', 'Received unknown products sync request')
    this.syncOrchestrator.syncUnknownProducts()
  }

  private handlePollStatus(): void {
    ErrorHandler.logInfo('Background', 'Manual status poll requested')
    this.syncOrchestrator.forcePollStatus().catch((error) => {
      ErrorHandler.logError('Background', error, {
        context: 'Manual status polling',
      })
    })
  }

  setupListener(): void {
    chrome.runtime.onMessage.addListener(this.handleMessage)
  }
}
