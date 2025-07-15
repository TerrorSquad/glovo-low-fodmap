import { DiagnosticUtils } from '../shared/DiagnosticUtils'
import { ErrorBoundary } from '../shared/ErrorBoundary'
import { type InjectedProductData } from '../shared/types'
import { CardManager } from './CardManager'
import { type IFodmapHelper, MessageHandler } from './MessageHandler'
import { ProductManager } from './ProductManager'
import { StorageManager } from './StorageManager'
import { StyleManager } from './StyleManager'

/**
 * Main class that orchestrates the FODMAP helper functionality
 */
export class FodmapHelper implements IFodmapHelper {
  private hideNonLowFodmap = false
  private messageHandler: MessageHandler
  private updateInterval?: number

  constructor() {
    this.messageHandler = new MessageHandler(this)

    // Setup error boundary recovery strategies
    ErrorBoundary.setupDefaultRecoveryStrategies()
  }

  async init(): Promise<void> {
    return (
      (await ErrorBoundary.protect(
        async () => {
          StyleManager.inject()
          this.setupEventListeners()
          await this.loadSettings()
          this.startPeriodicUpdate()
        },
        'content-init',
        {
          maxRetries: 3,
          retryDelayMs: 1000,
          onError: (error) => {
            console.warn(
              `FODMAP Helper initialization failed: ${error.message}`,
            )
          },
          onRecovery: () => {
            console.log(
              'FODMAP Helper successfully recovered from initialization error',
            )
          },
        },
      )) ?? Promise.resolve()
    )
  }

  setHideNonLowFodmap(hide: boolean): void {
    this.hideNonLowFodmap = hide
  }

  async updatePageStyles(): Promise<void> {
    ;(await ErrorBoundary.protect(async () => {
      await CardManager.updateAllCards(this.hideNonLowFodmap)
    }, 'update-styles')) ?? Promise.resolve()
  }

  private setupEventListeners(): void {
    // Listen for injected product data
    window.addEventListener('message', (event) => {
      if (
        event.source === window &&
        event.data?.type === 'GVO_FODMAP_PRODUCTS'
      ) {
        this.handleIncomingProducts(event.data.products)
      }
    })

    // Listen for Chrome runtime messages
    chrome.runtime.onMessage.addListener(
      this.messageHandler.handleRuntimeMessage,
    )
  }

  private async handleIncomingProducts(
    products: InjectedProductData[],
  ): Promise<void> {
    await ProductManager.saveNewProducts(products)
    CardManager.tagVisibleCards(products)
  }

  private async loadSettings(): Promise<void> {
    this.hideNonLowFodmap = await StorageManager.getHideNonLowFodmap()
  }

  private startPeriodicUpdate(): void {
    this.updateInterval = window.setInterval(() => {
      this.updatePageStyles()
    }, 1000)
  }

  /**
   * Debug helper - get diagnostic report
   */
  async getDiagnostics(): Promise<void> {
    await DiagnosticUtils.logDiagnostics()
  }

  /**
   * Debug helper - quick health check
   */
  async healthCheck(): Promise<string> {
    return await DiagnosticUtils.quickHealthCheck()
  }

  destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
    }
  }
}
