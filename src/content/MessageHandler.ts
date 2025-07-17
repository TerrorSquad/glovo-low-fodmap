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
 * Handles Chrome extension messaging
 */
export class MessageHandler {
  private fodmapHelper: IFodmapHelper

  constructor(fodmapHelper: IFodmapHelper) {
    this.fodmapHelper = fodmapHelper
  }

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
            this.fodmapHelper.updatePageStyles()
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

  private async handleReEvaluate(message: ChromeMessage): Promise<void> {
    this.fodmapHelper.setHideNonLowFodmap(message.hide || false)

    // Save the setting to storage for persistence
    await StorageManager.setHideNonLowFodmap(message.hide || false)

    // Force update all cards to ensure visibility changes take effect
    await this.fodmapHelper.updatePageStyles()
  }
}
