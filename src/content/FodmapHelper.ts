import { DiagnosticUtils } from '../shared/DiagnosticUtils'
import { ErrorBoundary } from '../shared/ErrorBoundary'
import { type InjectedProductData } from '../shared/types'
import { CardManager } from './CardManager'
import { DomProductScanner } from './DomProductScanner'
import { type IFodmapHelper, MessageHandler } from './MessageHandler'
import { ProductManager } from './ProductManager'
import { StorageManager } from './StorageManager'

/**
 * Main class that orchestrates the FODMAP helper functionality
 */
export class FodmapHelper implements IFodmapHelper {
  private hideNonLowFodmap = false
  private messageHandler: MessageHandler
  private updateInterval?: number
  private mutationObserver?: MutationObserver

  constructor() {
    this.messageHandler = new MessageHandler(this)

    // Setup error boundary recovery strategies
    ErrorBoundary.setupDefaultRecoveryStrategies()
  }

  async init(): Promise<void> {
    return (
      (await ErrorBoundary.protect(
        async () => {
          this.setupEventListeners()
          await this.loadSettings()

          // Perform initial DOM scan for existing products
          await this.performInitialDomScan()

          // Setup mutation observer for dynamic content
          this.setupMutationObserver()

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

    if (this.mutationObserver) {
      this.mutationObserver.disconnect()
    }
  }

  /**
   * Performs initial DOM scan for products already on the page
   * Uses progressive retry strategy for Nuxt/SPA apps
   */
  private async performInitialDomScan(): Promise<void> {
    await ErrorBoundary.protect(async () => {
      console.log(
        '🔍 FODMAP Helper: Starting progressive scan for existing products...',
      )

      // Progressive retry strategy for SPA/Nuxt apps
      const maxRetries = 10
      const retryDelay = 500
      let attempt = 0
      let totalFound = 0

      while (attempt < maxRetries) {
        attempt++
        const waitTime = retryDelay * attempt // Increasing delay

        console.log(
          `🔍 FODMAP Helper: Scan attempt ${attempt}/${maxRetries} (waiting ${waitTime}ms)`,
        )
        await new Promise((resolve) => setTimeout(resolve, waitTime))

        const scanResult = DomProductScanner.scanPage()

        if (scanResult.extractedProducts > 0) {
          console.log(
            `✅ FODMAP Helper: Found ${scanResult.extractedProducts} products on attempt ${attempt}`,
          )

          // Instead of creating new products, look up existing ones in DB by name
          const productNames = scanResult.products.map((product) =>
            product.name.trim(),
          )
          const existingProducts =
            await ProductManager.getProductsByNames(productNames)

          if (existingProducts.length > 0) {
            console.log(
              `📄 FODMAP Helper: Found ${existingProducts.length} products in database from ${productNames.length} scanned`,
            )

            // Tag the cards with their external IDs from the database
            CardManager.tagVisibleCardsByName(existingProducts)
            await this.updatePageStyles()

            totalFound += existingProducts.length
          } else {
            console.log(
              `ℹ️ FODMAP Helper: No products found in database for scanned names`,
            )
          }

          // If we found products, wait a bit more to see if more load, then break
          await new Promise((resolve) => setTimeout(resolve, 1000))
          const finalScan = DomProductScanner.scanPage()
          if (finalScan.extractedProducts <= scanResult.extractedProducts) {
            console.log(
              `✅ FODMAP Helper: Scan completed with ${totalFound} total products`,
            )
            break
          }
        } else {
          console.log(
            `ℹ️ FODMAP Helper: No products found on attempt ${attempt}`,
          )
        }

        if (scanResult.errors.length > 0) {
          console.warn(
            `⚠️ FODMAP Helper: Scan attempt ${attempt} had errors:`,
            scanResult.errors,
          )
        }
      }

      if (totalFound === 0) {
        console.warn(
          '⚠️ FODMAP Helper: No products found after all retry attempts. Page may not have loaded or selectors may be incorrect.',
        )
        console.log('🔍 Debug: Current page HTML structure:')
        console.log(document.body.innerHTML.substring(0, 2000) + '...')
      }
    }, 'initial-dom-scan')
  }

  /**
   * Sets up mutation observer to detect dynamically added products
   */
  private setupMutationObserver(): void {
    this.mutationObserver = DomProductScanner.setupMutationObserver(
      async (products) => {
        await ErrorBoundary.protect(async () => {
          console.log(
            `🔍 FODMAP Helper: Detected ${products.length} new products via DOM changes`,
          )

          // Look up existing products in DB by name instead of creating new ones
          const productNames = products.map((product) => product.name.trim())
          const existingProducts =
            await ProductManager.getProductsByNames(productNames)

          if (existingProducts.length > 0) {
            console.log(
              `📄 FODMAP Helper: Found ${existingProducts.length} new products in database`,
            )
            CardManager.tagVisibleCardsByName(existingProducts)
            await this.updatePageStyles()
          }
        }, 'mutation-products')
      },
    )
  }
}
