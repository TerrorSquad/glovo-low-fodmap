import { ErrorHandler } from '../shared/ErrorHandler'
import { PerformanceMonitor } from '../shared/PerformanceMonitor'
import { SyncOrchestrator } from './SyncOrchestrator'

export type BackgroundMessageAction = 'syncWithApi' | 'newProductsFound'

export interface BackgroundMessage {
  action: BackgroundMessageAction
}

/**
 * Handles Chrome runtime messages in the background script
 */
export class BackgroundMessageHandler {
  private syncOrchestrator: SyncOrchestrator

  constructor(syncOrchestrator: SyncOrchestrator) {
    this.syncOrchestrator = syncOrchestrator
  }

  handleMessage = (message: BackgroundMessage): boolean => {
    return PerformanceMonitor.measure('handleBackgroundMessage', () => {
      try {
        switch (message.action) {
          case 'syncWithApi':
            this.handleManualSync()
            return true

          case 'newProductsFound':
            this.handleNewProducts()
            return true

          default:
            ErrorHandler.logWarning(
              'Background',
              `Unknown message action: ${message.action}`,
            )
            return false
        }
      } catch (error) {
        ErrorHandler.logError('Background', error, {
          context: 'Background message handling',
          metadata: { action: message.action },
        })
        return false
      }
    })
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

  setupListener(): void {
    chrome.runtime.onMessage.addListener(this.handleMessage)
  }
}
