import { DiagnosticUtils } from '../shared/DiagnosticUtils'
import { ErrorBoundary } from '../shared/ErrorBoundary'
import { ErrorHandler } from '../shared/ErrorHandler'
import { Logger } from '../shared/Logger'
import { type InjectedProductData } from '../shared/types'
import { CardManager } from './CardManager'
import { DomProductScanner } from './DomProductScanner'
import { type IFodmapHelper, MessageHandler } from './MessageHandler'
import { ProductManager } from './ProductManager'
import { StorageManager } from './StorageManager'

/**
 * Main orchestrator class for the FODMAP Helper Chrome extension.
 * Coordinates product scanning, FODMAP classification, UI updates, and user interactions.
 * Acts as the central controller that ties together all content script functionality.
 *
 * Key responsibilities:
 * - Scanning Glovo pages for products
 * - Managing product data and FODMAP classifications
 * - Updating UI with visual indicators
 * - Handling user preference changes
 * - Coordinating with background script for API operations
 */
export class FodmapHelper implements IFodmapHelper {
  /** Controls whether non-low-FODMAP products should be hidden */
  private hideNonLowFodmap = false
  /** Controls whether non-food items should be hidden */
  private hideNonFoodItems = false
  /** Handles Chrome extension messaging */
  private messageHandler: MessageHandler

  /**
   * Initializes the FodmapHelper instance
   * Creates message handler and sets up communication with background script
   *
   * Called automatically when content script loads on Glovo pages
   */
  constructor() {
    this.messageHandler = new MessageHandler(this)
  }

  /**
   * Initializes all extension functionality on the page
   * Orchestrates the complete setup process including DOM scanning,
   * style application, and event listener setup
   *
   * @returns Promise that resolves when initialization is complete
   *
   * Initialization sequence:
   * 1. Sets up default error recovery strategies
   * 2. Loads user settings and preferences
   * 3. Performs initial DOM scan for existing products
   * 4. Sets up DOM mutation observer for dynamic content
   * 5. Establishes Chrome runtime message listeners
   * 6. Starts periodic style updates
   * 7. Applies current FODMAP styling to page
   *
   * Called by: Content script main entry point after DOM is ready
   */
  async init(): Promise<void> {
    return (
      (await ErrorBoundary.protect(
        async () => {
          ErrorBoundary.setupDefaultRecoveryStrategies()
          this.setupEventListeners()
          await this.loadSettings()
          await this.loadTooltipFontSize()

          // Perform initial DOM scan for existing products
          await this.performInitialDomScan()

          // Setup mutation observer for dynamic content
          this.setupMutationObserver()
        },
        'content-init',
        {
          maxRetries: 3,
          retryDelayMs: 1000,
          onError: (error) => {
            Logger.warn(
              'FodmapHelper',
              `FODMAP Helper initialization failed: ${error.message}`,
            )
          },
          onRecovery: () => {
            Logger.info(
              'FodmapHelper',
              'FODMAP Helper successfully recovered from initialization error',
            )
          },
        },
      )) ?? Promise.resolve()
    )
  }

  /**
   * Updates the user preference for hiding non-low-FODMAP products.
   * Called when user toggles the hide/show setting in the popup.
   *
   * @param hide - Whether to hide non-low-FODMAP products
   */
  setHideNonLowFodmap(hide: boolean): void {
    this.hideNonLowFodmap = hide
  }

  /**
   * Sets the hide non-food items preference and triggers UI update
   * Controls whether products marked as non-food should be hidden from view
   *
   * @param hide - Whether to hide non-food items
   */
  setHideNonFoodItems(hide: boolean): void {
    this.hideNonFoodItems = hide
  }

  /**
   * Updates visual styling of all product cards on the page.
   * Applies FODMAP indicators and visibility based on user preferences.
   * Called after classification updates or setting changes.
   */
  async updatePageStyles(): Promise<void> {
    ;(await ErrorBoundary.protect(async () => {
      await CardManager.updateAllCards(
        this.hideNonLowFodmap,
        this.hideNonFoodItems,
      )
    }, 'update-styles')) ?? Promise.resolve()
  }

  /**
   * Sets up Chrome runtime message listeners for communication with background script
   * Enables the extension to receive commands, data updates, and setting changes
   *
   * Handles messages for: Product data updates, setting changes, diagnostic requests,
   * and communication between popup, background, and content scripts
   */
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

  /**
   * Handles new products injected by content script or DOM scanning
   * Saves products to database and immediately applies visual tags to cards
   *
   * @param products - Array of product data to process and save
   * @returns Promise that resolves when products are saved and cards are tagged
   *
   * Used by: Message handlers when receiving product data from background scripts,
   * and DOM scanning when new products are detected on the page
   */
  private async handleIncomingProducts(
    products: InjectedProductData[],
  ): Promise<void> {
    await ProductManager.saveNewProducts(products)
    CardManager.tagVisibleCards(products)
  }

  /**
   * Loads user preferences from storage
   * Currently loads the "hide non-low FODMAP" and "hide non-food items" settings which control
   * whether high/unknown FODMAP products and non-food items should be visually hidden
   *
   * @returns Promise that resolves when settings are loaded and applied to instance
   *
   * Called during: Initialization and when settings change via popup or options
   */
  private async loadSettings(): Promise<void> {
    this.hideNonLowFodmap = await StorageManager.getHideNonLowFodmap()
    this.hideNonFoodItems = await StorageManager.getHideNonFoodItems()
  }

  /**
   * Loads and applies the tooltip font size setting from storage
   */
  private async loadTooltipFontSize(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get({ tooltipFontSize: 13 })
      const fontSize = result.tooltipFontSize as number

      // Apply font size by creating CSS style
      const style = document.createElement('style')
      style.id = 'fodmap-tooltip-font-size'
      style.textContent = `
        .fodmap-tooltip {
          font-size: ${fontSize}px !important;
        }
        .fodmap-tooltip-title {
          font-size: ${fontSize + 1}px !important;
        }
        .fodmap-tooltip-explanation {
          font-size: ${fontSize - 1}px !important;
        }
      `
      document.head.appendChild(style)
    } catch (error) {
      ErrorHandler.logError('FodmapHelper', error, {
        context: 'Loading tooltip font size',
      })
    }
  }

  // Removed periodic interval; mutation observer now handles all dynamic updates

  /**
   * Debug helper - generates and logs comprehensive diagnostic report
   * Includes database status, extension state, and performance metrics
   *
   * @returns Promise that resolves when diagnostics are logged to console
   *
   * Used for: Troubleshooting extension issues, performance analysis,
   * and debugging user-reported problems
   */
  async getDiagnostics(): Promise<void> {
    await DiagnosticUtils.logDiagnostics()
  }

  /**
   * Debug helper - performs quick health check of extension components
   * Returns summary status of database, styling, and core functionality
   *
   * @returns Promise that resolves to health status string
   *
   * Used for: Quick validation that extension is working properly,
   * popup status display, and automated health monitoring
   */
  async healthCheck(): Promise<string> {
    return await DiagnosticUtils.quickHealthCheck()
  }

  /**
   * Performs initial DOM scan for products already on the page
   * Uses progressive retry strategy for Nuxt/SPA apps
   */
  private async performInitialDomScan(): Promise<void> {
    await ErrorBoundary.protect(async () => {
      Logger.info(
        'FodmapHelper',
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

        Logger.debug(
          'FodmapHelper',
          `🔍 FODMAP Helper: Scan attempt ${attempt}/${maxRetries} (waiting ${waitTime}ms)`,
        )
        await new Promise((resolve) => setTimeout(resolve, waitTime))

        const scanResult = DomProductScanner.scanPage()

        if (scanResult.extractedProducts > 0) {
          Logger.info(
            'FodmapHelper',
            `✅ FODMAP Helper: Found ${scanResult.extractedProducts} products on attempt ${attempt}`,
          )

          // Instead of creating new products, look up existing ones in DB by name
          const productNames = scanResult.products.map((product) =>
            product.name.trim(),
          )
          const existingProducts =
            await ProductManager.getProductsByNames(productNames)

          if (existingProducts.length > 0) {
            Logger.info(
              'FodmapHelper',
              `📄 FODMAP Helper: Found ${existingProducts.length} products in database from ${productNames.length} scanned`,
            )

            // Tag the cards with their hashes from the database
            CardManager.tagVisibleCardsByName(existingProducts)
            await this.updatePageStyles()

            totalFound += existingProducts.length
          } else {
            Logger.info(
              'FodmapHelper',
              `ℹ️ FODMAP Helper: No products found in database for scanned names`,
            )
          }

          // If we found products, wait a bit more to see if more load, then break
          await new Promise((resolve) => setTimeout(resolve, 1000))
          const finalScan = DomProductScanner.scanPage()
          if (finalScan.extractedProducts <= scanResult.extractedProducts) {
            Logger.info(
              'FodmapHelper',
              `✅ FODMAP Helper: Scan completed with ${totalFound} total products`,
            )
            break
          }
        } else {
          Logger.info(
            'FodmapHelper',
            `ℹ️ FODMAP Helper: No products found on attempt ${attempt}`,
          )
        }

        if (scanResult.errors.length > 0) {
          Logger.warn(
            'FodmapHelper',
            `⚠️ FODMAP Helper: Scan attempt ${attempt} had errors:`,
            { errors: scanResult.errors },
          )
        }
      }

      if (totalFound === 0) {
        Logger.warn(
          'FodmapHelper',
          '⚠️ FODMAP Helper: No products found after all retry attempts. Page may not have loaded or selectors may be incorrect.',
        )
        Logger.debug('FodmapHelper', '🔍 Debug: Current page HTML structure:')
        Logger.debug(
          'FodmapHelper',
          document.body.innerHTML.substring(0, 2000) + '...',
        )
      }
    }, 'initial-dom-scan')
  }

  /**
   * Sets up mutation observer to detect dynamically added products
   * Monitors DOM changes for new product cards and automatically processes them
   *
   * Handles: Single-page app navigation, infinite scroll loading,
   * dynamic content updates, and AJAX-loaded product lists
   *
   * When new products are detected:
   * 1. Looks up existing products in database by name
   * 2. Tags visible cards with FODMAP status
   * 3. Applies appropriate styling based on current settings
   */
  private setupMutationObserver(): void {
    DomProductScanner.setupMutationObserver(async (products) => {
      await ErrorBoundary.protect(async () => {
        Logger.debug(
          'FodmapHelper',
          `🔍 FODMAP Helper: Detected ${products.length} new products via DOM changes`,
        )

        // Look up existing products in DB by name instead of creating new ones
        const productNames = products.map((product) => product.name.trim())
        const existingProducts =
          await ProductManager.getProductsByNames(productNames)

        if (existingProducts.length > 0) {
          Logger.info(
            'FodmapHelper',
            `📄 FODMAP Helper: Found ${existingProducts.length} new products in database`,
          )
          CardManager.tagVisibleCardsByName(existingProducts)
          await this.updatePageStyles()
        }
      }, 'mutation-products')
    })
  }
}
