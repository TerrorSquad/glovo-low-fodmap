import { BackgroundLogger } from './BackgroundLogger'
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
  private logger = BackgroundLogger

  constructor(syncOrchestrator: SyncOrchestrator) {
    this.syncOrchestrator = syncOrchestrator
  }

  handleMessage = (message: BackgroundMessage): boolean => {
    switch (message.action) {
      case 'syncWithApi':
        this.handleManualSync()
        return true

      case 'newProductsFound':
        this.handleNewProducts()
        return true

      default:
        return false
    }
  }

  private handleManualSync(): void {
    this.logger.log('Received manual sync request')
    this.syncOrchestrator.syncPendingProducts()
  }

  private handleNewProducts(): void {
    this.logger.log('Received new products list for classification')
    this.syncOrchestrator.syncPendingProducts()
  }

  setupListener(): void {
    chrome.runtime.onMessage.addListener(this.handleMessage)
  }
}
