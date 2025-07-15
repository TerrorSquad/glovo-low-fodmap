import { ErrorHandler } from '../shared/ErrorHandler'
import { PerformanceMonitor } from '../shared/PerformanceMonitor'

/**
 * Handles popup UI interactions and Chrome API communication
 */
export class PopupController {
  private toggleSwitch: HTMLInputElement
  private syncButton: HTMLButtonElement

  constructor() {
    this.toggleSwitch = document.getElementById(
      'toggleSwitch',
    ) as HTMLInputElement
    this.syncButton = document.getElementById('syncButton') as HTMLButtonElement

    if (!this.toggleSwitch || !this.syncButton) {
      throw new Error('Required DOM elements not found')
    }
  }

  async init(): Promise<void> {
    return await PerformanceMonitor.measureAsync('popupInit', async () => {
      try {
        await this.loadSettings()
        this.setupEventListeners()
        ErrorHandler.logInfo('Popup', 'Popup initialized successfully')
      } catch (error) {
        ErrorHandler.logError('Popup', error, {
          context: 'Popup initialization',
        })
      }
    })
  }

  private async loadSettings(): Promise<void> {
    return await ErrorHandler.safeExecute(async () => {
      return new Promise<void>((resolve) => {
        chrome.storage.sync.get({ hideNonLowFodmap: false }, (data) => {
          this.toggleSwitch.checked = !!data.hideNonLowFodmap
          ErrorHandler.logInfo(
            'Popup',
            `Loaded setting: hideNonLowFodmap = ${data.hideNonLowFodmap}`,
          )
          resolve()
        })
      })
    }, 'Popup')
  }

  private setupEventListeners(): void {
    this.toggleSwitch.addEventListener('change', this.handleToggleChange)
    this.syncButton.addEventListener('click', this.handleSyncClick)
  }

  private handleToggleChange = (): void => {
    try {
      const shouldHide = this.toggleSwitch.checked

      // Save setting to storage
      chrome.storage.sync.set({ hideNonLowFodmap: shouldHide })
      ErrorHandler.logInfo(
        'Popup',
        `Toggle changed: hideNonLowFodmap = ${shouldHide}`,
      )

      // Notify content script
      this.sendMessageToActiveTab({
        action: 're-evaluate',
        hide: shouldHide,
      })
    } catch (error) {
      ErrorHandler.logError('Popup', error, {
        context: 'Toggle change handling',
      })
    }
  }

  private handleSyncClick = (): void => {
    try {
      ErrorHandler.logInfo('Popup', 'Sync button clicked')
      chrome.runtime.sendMessage({ action: 'syncWithApi' })
    } catch (error) {
      ErrorHandler.logError('Popup', error, { context: 'Sync button click' })
    }
  }

  private sendMessageToActiveTab(message: any): void {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, message)
          ErrorHandler.logInfo(
            'Popup',
            `Sent message to tab: ${message.action}`,
          )
        } else {
          ErrorHandler.logWarning(
            'Popup',
            'No active tab found to send message',
          )
        }
      })
    } catch (error) {
      ErrorHandler.logError('Popup', error, {
        context: 'Sending message to active tab',
      })
    }
  }
}
