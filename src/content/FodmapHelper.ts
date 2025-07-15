import { DiagnosticUtils } from '../shared/DiagnosticUtils'
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
  }

  async init(): Promise<void> {
    StyleManager.inject()
    this.setupEventListeners()
    await this.loadSettings()
    this.startPeriodicUpdate()
  }

  setHideNonLowFodmap(hide: boolean): void {
    this.hideNonLowFodmap = hide
  }

  async updatePageStyles(): Promise<void> {
    await CardManager.updateAllCards(this.hideNonLowFodmap)
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
