import { type Product } from '../shared/db'
import { ErrorHandler } from '../shared/ErrorHandler'
import { PerformanceMonitor } from '../shared/PerformanceMonitor'
import { type ChromeMessage, type LogPayload } from '../shared/types'
import { ProductManager } from './ProductManager'
import { StorageManager } from './StorageManager'

export interface IFodmapHelper {
  updatePageStyles(): Promise<void>
  setHideNonLowFodmap(hide: boolean): void
}

/**
 * Handles Chrome extension messaging for the content script side.
 * Manages communication between content script, background script, and popup.
 * Acts as the message routing and processing center for all extension communication.
 *
 * Key responsibilities:
 * - Processing Chrome runtime messages from background script and popup
 * - Routing data requests to appropriate content script modules
 * - Managing asynchronous response handling for data queries
 * - Coordinating UI updates based on received messages
 * - Handling logging and diagnostic message forwarding
 *
 * Message types handled:
 * - Product data queries (unsubmitted, submitted unprocessed, by IDs)
 * - Settings updates (hide/show preferences)
 * - Logging and diagnostic requests
 * - Statistics and metrics collection
 * - Extension state management
 *
 * The handler implements the Chrome extension messaging protocol with proper
 * async response handling and error management.
 */
export class MessageHandler {
  private fodmapHelper: IFodmapHelper

  constructor(fodmapHelper: IFodmapHelper) {
    this.fodmapHelper = fodmapHelper
  }

  /**
   * Main message routing handler for all Chrome runtime messages
   * Processes incoming messages and delegates to appropriate handler methods
   *
   * @param message - Chrome message object containing action and data
   * @param _ - Message sender (unused but required by Chrome API)
   * @param sendResponse - Callback function for sending async responses
   * @returns Boolean indicating if response will be sent asynchronously
   *
   * Supported message actions:
   * - 'log': Forward log messages to console
   * - 'getUnsubmittedProducts': Retrieve products pending API submission
   * - 'getSubmittedUnprocessedProducts': Get products awaiting classification
   * - 'getProductsByExternalIds': Fetch specific products by ID
   * - 'getProductStatistics': Return product database metrics
   * - 'updateProductStatuses': Update FODMAP classifications
   * - 'toggleHideNonLowFodmap': Toggle visibility preferences
   *
   * Performance monitoring and error handling are applied to all message processing.
   */
  handleRuntimeMessage = (
    message: ChromeMessage,
    _: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void,
  ): boolean => {
    return PerformanceMonitor.measure('handleRuntimeMessage', () => {
      try {
        switch (message.action) {
          case 'log':
            this.handleLogMessage(message.payload)
            break

          case 'getUnsubmittedProducts':
            this.handleGetUnsubmittedProducts(sendResponse)
            return true

          case 'getSubmittedUnprocessedProducts':
            this.handleGetSubmittedUnprocessedProducts(sendResponse)
            return true

          case 'getProductsByExternalIds':
            this.handleGetProductsByExternalIds(message.data, sendResponse)
            return true

          case 'getProductStatistics':
            this.handleGetProductStatistics(sendResponse)
            return true

          case 'updateStatuses':
            this.handleUpdateStatuses(message.data, sendResponse)
            return true

          case 'refreshStyles':
            // Handle async operation for setting preference and refreshing styles
            this.handleRefreshStyles(message).catch((error: unknown) => {
              console.error('Error handling refreshStyles:', error)
            })
            break

          case 're-evaluate':
            // Handle async operation without blocking the message handler
            this.handleReEvaluate(message).catch((error) => {
              console.error('Error handling re-evaluate:', error)
            })
            break
        }
        return false
      } catch (error) {
        ErrorHandler.logError('Content', error, {
          context: 'Message handling',
          metadata: { action: message.action },
        })
        return false
      }
    })
  }

  /**
   * Handles log message forwarding from background script to content script console
   * Enables unified logging across extension contexts for debugging
   *
   * @param payload - Log message data including level, message, and optional parameters
   *
   * Forwards background script log messages to content script console with 'BG' prefix
   * for easy identification during debugging and development.
   */
  private handleLogMessage(payload: LogPayload): void {
    try {
      const level = payload.level || 'log'
      const msg = payload.message || ''
      const optionalParams = payload.optionalParams || []
      console[level](`BG ${msg}`, ...optionalParams)
    } catch (error) {
      ErrorHandler.logError('Content', error, {
        context: 'Log message handling',
      })
    }
  }

  /**
   * Retrieves products that haven't been submitted to the FODMAP API yet
   * Used by background script to identify products needing classification
   *
   * @param sendResponse - Callback to send product array back to requester
   *
   * Returns products with status 'UNKNOWN' that haven't been sent for classification.
   * Essential for the background script's API submission workflow.
   */
  private async handleGetUnsubmittedProducts(
    sendResponse: (response?: any) => void,
  ): Promise<void> {
    return await PerformanceMonitor.measureAsync(
      'handleGetUnsubmittedProducts',
      async () => {
        try {
          const products = await ProductManager.getUnsubmittedProducts()
          sendResponse(products)
          ErrorHandler.logInfo(
            'Content',
            `Sent ${products.length} unsubmitted products to background`,
          )
        } catch (error) {
          ErrorHandler.logError('Content', error, {
            context: 'Getting unsubmitted products',
          })
          sendResponse([])
        }
      },
    )
  }

  /**
   * Retrieves products that have been submitted but are still awaiting classification results
   * Used by background script for polling API responses and checking processing status
   *
   * @param sendResponse - Callback to send product array back to requester
   *
   * Returns products with status 'PENDING' that are in the API processing pipeline.
   * Critical for the background script's result polling and update workflow.
   */
  private async handleGetSubmittedUnprocessedProducts(
    sendResponse: (response?: any) => void,
  ): Promise<void> {
    return await PerformanceMonitor.measureAsync(
      'handleGetSubmittedUnprocessedProducts',
      async () => {
        try {
          const products =
            await ProductManager.getSubmittedUnprocessedProducts()
          sendResponse(products)
          ErrorHandler.logInfo(
            'Content',
            `Sent ${products.length} submitted unprocessed products to background`,
          )
        } catch (error) {
          ErrorHandler.logError('Content', error, {
            context: 'Getting submitted unprocessed products',
          })
          sendResponse([])
        }
      },
    )
  }

  /**
   * Retrieves specific products by their external IDs
   * Used for targeted product data queries and batch operations
   *
   * @param data - Object containing array of external IDs to look up
   * @param sendResponse - Callback to send matching product array back to requester
   *
   * Efficiently fetches products by ID for background script operations,
   * popup displays, and other targeted data access scenarios.
   */
  private async handleGetProductsByExternalIds(
    data: { externalIds: string[] },
    sendResponse: (response?: any) => void,
  ): Promise<void> {
    return await PerformanceMonitor.measureAsync(
      'handleGetProductsByExternalIds',
      async () => {
        try {
          const products = await ProductManager.getProductsArrayByExternalIds(
            data.externalIds,
          )
          sendResponse(products)
          ErrorHandler.logInfo(
            'Content',
            `Sent ${products.length} products by external IDs to background`,
          )
        } catch (error) {
          ErrorHandler.logError('Content', error, {
            context: 'Getting products by external IDs',
            metadata: { externalIds: data.externalIds },
          })
          sendResponse([])
        }
      },
    )
  }

  /**
   * Updates product FODMAP classifications and refreshes page styling
   * Processes classification results from the API and applies visual updates
   *
   * @param data - Array of products with updated status information
   * @param sendResponse - Callback to confirm successful update completion
   *
   * Workflow:
   * 1. Updates product statuses in database
   * 2. Triggers page style refresh to show new classifications
   * 3. Confirms successful completion to background script
   *
   * Critical for applying FODMAP classification results to the user interface.
   */
  private async handleUpdateStatuses(
    data: Product[],
    sendResponse: (response?: any) => void,
  ): Promise<void> {
    return await PerformanceMonitor.measureAsync(
      'handleUpdateStatuses',
      async () => {
        try {
          await ProductManager.updateStatuses(data)
          await this.fodmapHelper.updatePageStyles()
          sendResponse({ success: true })
          ErrorHandler.logInfo(
            'Content',
            `Updated ${data.length} product statuses and refreshed styles`,
          )
        } catch (error) {
          ErrorHandler.logError('Content', error, {
            context: 'Updating product statuses',
          })
          sendResponse({ success: false, error: (error as Error).message })
        }
      },
    )
  }

  /**
   * Generates and returns comprehensive product database statistics
   * Provides metrics for popup display and analytics purposes
   *
   * @param sendResponse - Callback to send statistics object back to requester
   *
   * Statistics include:
   * - Total products in database
   * - Count by FODMAP status (LOW, HIGH, UNKNOWN, PENDING)
   * - Breakdown for user insights and debugging
   *
   * Used by popup for displaying user progress and database health metrics.
   */
  private async handleGetProductStatistics(
    sendResponse: (response?: any) => void,
  ): Promise<void> {
    return await PerformanceMonitor.measureAsync(
      'handleGetProductStatistics',
      async () => {
        try {
          const allProducts = await ProductManager.getAllProducts()
          const lowFodmapProducts = allProducts.filter(
            (p: Product) => p.status === 'LOW',
          )

          const statistics = {
            total: allProducts.length,
            lowFodmap: lowFodmapProducts.length,
            high: allProducts.filter((p: Product) => p.status === 'HIGH')
              .length,
            unknown: allProducts.filter((p: Product) => p.status === 'UNKNOWN')
              .length,
            pending: allProducts.filter((p: Product) => p.status === 'PENDING')
              .length,
          }

          sendResponse(statistics)
          ErrorHandler.logInfo(
            'Content',
            `Sent statistics to popup: ${statistics.total} total, ${statistics.lowFodmap} low FODMAP`,
          )
        } catch (error) {
          ErrorHandler.logError('Content', error, {
            context: 'Getting product statistics',
          })
          sendResponse({ total: 0, lowFodmap: 0 })
        }
      },
    )
  }

  /**
   * Handles style refresh requests with optional hide preference updates
   * Updates both runtime state and persistent storage when hide preference is provided
   *
   * @param message - Chrome message containing optional hideNonLowFodmap preference
   *
   * Process:
   * 1. Updates FodmapHelper runtime preference if provided
   * 2. Persists setting to browser storage if provided
   * 3. Triggers immediate page style refresh to apply changes
   *
   * Used when popup changes the hide preference or requests a general style refresh.
   */
  private async handleRefreshStyles(message: ChromeMessage): Promise<void> {
    // Update hide preference if provided
    if (typeof message.hideNonLowFodmap === 'boolean') {
      this.fodmapHelper.setHideNonLowFodmap(message.hideNonLowFodmap)
      // Save the setting to storage for persistence
      await StorageManager.setHideNonLowFodmap(message.hideNonLowFodmap)
    }

    // Force update all cards to ensure visibility changes take effect
    await this.fodmapHelper.updatePageStyles()
  }

  /**
   * Handles preference changes for hiding/showing non-low-FODMAP products
   * Updates both runtime state and persistent storage, then refreshes page styling
   *
   * @param message - Chrome message containing hide preference boolean
   *
   * Process:
   * 1. Updates FodmapHelper runtime preference
   * 2. Persists setting to browser storage for future sessions
   * 3. Triggers immediate page style refresh to apply changes
   *
   * Ensures preference changes take effect immediately and persist across sessions.
   */
  private async handleReEvaluate(message: ChromeMessage): Promise<void> {
    this.fodmapHelper.setHideNonLowFodmap(message.hide || false)

    // Save the setting to storage for persistence
    await StorageManager.setHideNonLowFodmap(message.hide || false)

    // Force update all cards to ensure visibility changes take effect
    await this.fodmapHelper.updatePageStyles()
  }
}
