import { CardManager } from './CardManager'
import { type IFodmapHelper, MessageHandler } from './MessageHandler'
import { ProductManager } from './ProductManager'
import { StorageManager } from './StorageManager'
import { StyleManager } from './StyleManager'
import type { InjectedProductData } from './types'

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

  destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
    }
  }
}
