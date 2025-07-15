import { type Product } from '../shared/db'
import { ErrorHandler } from '../shared/ErrorHandler'
import { PerformanceMonitor } from '../shared/PerformanceMonitor'
import { type ChromeMessage, type LogPayload } from '../shared/types'
import { ProductManager } from './ProductManager'

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

          case 'getPendingProducts':
            this.handleGetPendingProducts(sendResponse)
            return true

          case 'getUnknownProducts':
            this.handleGetUnknownProducts(sendResponse)
            return true

          case 'updateStatuses':
            this.handleUpdateStatuses(message.data, sendResponse)
            return true

          case 'refreshStyles':
            this.fodmapHelper.updatePageStyles()
            break

          case 're-evaluate':
            this.fodmapHelper.setHideNonLowFodmap(message.hide || false)
            this.fodmapHelper.updatePageStyles()
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

  private async handleGetPendingProducts(
    sendResponse: (response?: any) => void,
  ): Promise<void> {
    return await PerformanceMonitor.measureAsync(
      'handleGetPendingProducts',
      async () => {
        try {
          const products = await ProductManager.getPendingProducts()
          sendResponse(products)
          ErrorHandler.logInfo(
            'Content',
            `Sent ${products.length} pending products to background`,
          )
        } catch (error) {
          ErrorHandler.logError('Content', error, {
            context: 'Getting pending products',
          })
          sendResponse([])
        }
      },
    )
  }

  private async handleGetUnknownProducts(
    sendResponse: (response?: any) => void,
  ): Promise<void> {
    return await PerformanceMonitor.measureAsync(
      'handleGetUnknownProducts',
      async () => {
        try {
          const products = await ProductManager.getUnknownProducts()
          sendResponse(products)
          ErrorHandler.logInfo(
            'Content',
            `Sent ${products.length} unknown products to background`,
          )
        } catch (error) {
          ErrorHandler.logError('Content', error, {
            context: 'Getting unknown products',
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
}
