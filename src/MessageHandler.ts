import type { Product } from './db'
import { ProductManager } from './ProductManager'
import type { ChromeMessage, LogPayload } from './types'

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
    switch (message.action) {
      case 'log':
        this.handleLogMessage(message.payload)
        break

      case 'getPendingProducts':
        this.handleGetPendingProducts(sendResponse)
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
  }

  private handleLogMessage(payload: LogPayload): void {
    const level = payload.level || 'log'
    const msg = payload.message || ''
    const optionalParams = payload.optionalParams || []
    console[level](`BG ${msg}`, ...optionalParams)
  }

  private async handleGetPendingProducts(
    sendResponse: (response?: any) => void,
  ): Promise<void> {
    try {
      const products = await ProductManager.getPendingProducts()
      sendResponse(products)
    } catch (error) {
      console.error('[Content] Error getting pending products:', error)
      sendResponse([])
    }
  }

  private async handleUpdateStatuses(
    data: Product[],
    sendResponse: (response?: any) => void,
  ): Promise<void> {
    try {
      await ProductManager.updateStatuses(data)
      await this.fodmapHelper.updatePageStyles()
      sendResponse({ success: true })
    } catch (error) {
      console.error('[Content] Error updating statuses:', error)
      sendResponse({ success: false, error: (error as Error).message })
    }
  }
}
