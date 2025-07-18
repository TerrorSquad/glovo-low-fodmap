import { DiagnosticUtils } from '../shared/DiagnosticUtils'
import { ErrorHandler } from '../shared/ErrorHandler'
import { PerformanceMonitor } from '../shared/PerformanceMonitor'

/**
 * Handles popup UI interactions and Chrome API communication
 */
export class PopupController {
  private toggleSwitch: HTMLInputElement
  private hideNonFoodToggle: HTMLInputElement
  private darkModeToggle: HTMLInputElement
  private syncButton: HTMLButtonElement
  private pollStatusButton: HTMLButtonElement
  private statusIcon: HTMLElement
  private statusText: HTMLElement
  private totalProductsElement: HTMLElement
  private lowFodmapCountElement: HTMLElement

  // Debug elements
  private healthCheckButton: HTMLButtonElement
  private diagnosticsButton: HTMLButtonElement
  private exportDataButton: HTMLButtonElement
  private clearDataButton: HTMLButtonElement

  constructor() {
    // Core elements
    this.toggleSwitch = document.getElementById(
      'hideNonLowFodmap',
    ) as HTMLInputElement
    this.hideNonFoodToggle = document.getElementById(
      'hideNonFoodItems',
    ) as HTMLInputElement
    this.darkModeToggle = document.getElementById(
      'darkModeToggle',
    ) as HTMLInputElement
    this.syncButton = document.getElementById('syncButton') as HTMLButtonElement
    this.pollStatusButton = document.getElementById(
      'pollStatusButton',
    ) as HTMLButtonElement

    // Status elements
    this.statusIcon = document.getElementById('statusIcon') as HTMLElement
    this.statusText = document.getElementById('statusText') as HTMLElement

    // Stats elements
    this.totalProductsElement = document.getElementById(
      'totalProducts',
    ) as HTMLElement
    this.lowFodmapCountElement = document.getElementById(
      'lowFodmapCount',
    ) as HTMLElement

    // Debug elements
    this.healthCheckButton = document.getElementById(
      'healthCheck',
    ) as HTMLButtonElement
    this.diagnosticsButton = document.getElementById(
      'diagnostics',
    ) as HTMLButtonElement
    this.exportDataButton = document.getElementById(
      'exportData',
    ) as HTMLButtonElement
    this.clearDataButton = document.getElementById(
      'clearData',
    ) as HTMLButtonElement

    if (
      !this.toggleSwitch ||
      !this.hideNonFoodToggle ||
      !this.darkModeToggle ||
      !this.syncButton ||
      !this.pollStatusButton
    ) {
      throw new Error('Required DOM elements not found')
    }
  }

  async init(): Promise<void> {
    return await PerformanceMonitor.measureAsync('popupInit', async () => {
      try {
        await this.loadSettings()
        await this.loadStatistics()
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
        chrome.storage.sync.get(
          { hideNonLowFodmap: false, hideNonFoodItems: false, darkMode: false },
          (data) => {
            this.toggleSwitch.checked = data.hideNonLowFodmap
            this.hideNonFoodToggle.checked = data.hideNonFoodItems
            this.darkModeToggle.checked = data.darkMode
            this.applyDarkMode(data.darkMode)
            resolve()
          },
        )
      })
    }, 'Popup')
  }

  private async loadStatistics(): Promise<void> {
    return await PerformanceMonitor.measureAsync('loadStatistics', async () => {
      try {
        const response = await new Promise<any>((resolve) => {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
              chrome.tabs.sendMessage(
                tabs[0].id,
                { action: 'getProductStatistics' },
                resolve,
              )
            } else {
              resolve(null)
            }
          })
        })

        if (response && typeof response === 'object') {
          this.totalProductsElement.textContent =
            response.total?.toString() || '0'
          this.lowFodmapCountElement.textContent =
            response.lowFodmap?.toString() || '0'
          ErrorHandler.logInfo(
            'Popup',
            `Statistics loaded: ${response.total || 0} total, ${response.lowFodmap || 0} low FODMAP`,
          )
        } else {
          this.totalProductsElement.textContent = 'No tab'
          this.lowFodmapCountElement.textContent = 'No tab'
        }
      } catch (error) {
        this.totalProductsElement.textContent = 'Error'
        this.lowFodmapCountElement.textContent = 'Error'
        ErrorHandler.logError('Popup', error, {
          context: 'Loading statistics',
        })
      }
    })
  }

  private setupEventListeners(): void {
    this.toggleSwitch.addEventListener('change', this.handleToggleChange)
    this.hideNonFoodToggle.addEventListener(
      'change',
      this.handleHideNonFoodToggle,
    )
    this.darkModeToggle.addEventListener('change', this.handleDarkModeToggle)
    this.syncButton.addEventListener('click', this.handleSyncClick)
    this.pollStatusButton.addEventListener('click', this.handlePollStatusClick)

    // Debug event listeners
    this.healthCheckButton.addEventListener('click', this.handleHealthCheck)
    this.diagnosticsButton.addEventListener('click', this.handleDiagnostics)
    this.exportDataButton.addEventListener('click', this.handleExportData)
    this.clearDataButton.addEventListener('click', this.handleClearData)

    // Keyboard shortcuts
    document.addEventListener('keydown', this.handleKeyDown)
  }

  private handleToggleChange = (): void => {
    try {
      const hideNonLowFodmap = this.toggleSwitch.checked

      // Save setting to storage
      chrome.storage.sync.set({ hideNonLowFodmap })
      ErrorHandler.logInfo(
        'Popup',
        `Toggle changed: hideNonLowFodmap = ${hideNonLowFodmap}`,
      )

      // Send message to content script to update styles
      this.sendMessageToActiveTab({
        action: 'refreshStyles',
        hideNonLowFodmap,
      })
    } catch (error) {
      ErrorHandler.logError('Popup', error, {
        context: 'Toggle change handling',
      })
    }
  }

  private handleDarkModeToggle = (): void => {
    try {
      const isDarkMode = this.darkModeToggle.checked

      // Save setting to storage
      chrome.storage.sync.set({ darkMode: isDarkMode })
      ErrorHandler.logInfo(
        'Popup',
        `Dark mode changed: darkMode = ${isDarkMode}`,
      )

      // Apply dark mode immediately
      this.applyDarkMode(isDarkMode)
    } catch (error) {
      ErrorHandler.logError('Popup', error, {
        context: 'Dark mode toggle handling',
      })
    }
  }

  private applyDarkMode(isDarkMode: boolean): void {
    const popupContainer = document.querySelector('.popup-container')
    if (popupContainer) {
      if (isDarkMode) {
        popupContainer.classList.add('dark')
      } else {
        popupContainer.classList.remove('dark')
      }
    }
  }

  private handleSyncClick = async (): Promise<void> => {
    try {
      this.updateStatus('Syncing unsubmitted products...', 'warning')
      this.syncButton.disabled = true

      ErrorHandler.logInfo('Popup', 'Sync products button clicked')
      chrome.runtime.sendMessage({ action: 'syncWithApi' })

      // Wait a moment then refresh statistics
      setTimeout(async () => {
        await this.loadStatistics()
        this.updateStatus('Products sync completed', 'healthy')
        this.syncButton.disabled = false

        // Reset status after 3 seconds
        setTimeout(() => {
          this.updateStatus('Ready', 'healthy')
        }, 3000)
      }, 2000)
    } catch (error) {
      ErrorHandler.logError('Popup', error, { context: 'Sync button click' })
      this.updateStatus('Sync failed', 'error')
      this.syncButton.disabled = false
    }
  }

  private handlePollStatusClick = async (): Promise<void> => {
    try {
      this.updateStatus('Polling status...', 'warning')
      this.pollStatusButton.disabled = true

      ErrorHandler.logInfo('Popup', 'Poll status button clicked')
      chrome.runtime.sendMessage({ action: 'pollStatus' })

      // Wait a moment then refresh statistics
      setTimeout(async () => {
        await this.loadStatistics()
        this.updateStatus('Status poll completed', 'healthy')
        this.pollStatusButton.disabled = false

        // Reset status after 3 seconds
        setTimeout(() => {
          this.updateStatus('Ready', 'healthy')
        }, 3000)
      }, 2000)
    } catch (error) {
      ErrorHandler.logError('Popup', error, {
        context: 'Poll status button click',
      })
      this.updateStatus('Status poll failed', 'error')
      this.pollStatusButton.disabled = false
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

  // Debug handlers
  private handleHealthCheck = async (): Promise<void> => {
    try {
      this.updateStatus('Checking health...', 'warning')
      const healthSummary = await DiagnosticUtils.quickHealthCheck()
      this.updateStatus(healthSummary, 'healthy')
      console.log('Health Check:', healthSummary)
    } catch (error) {
      this.updateStatus('Health check failed', 'error')
      console.error('Health check error:', error)
    }
  }

  private handleDiagnostics = async (): Promise<void> => {
    try {
      this.updateStatus('Generating report...', 'warning')
      await DiagnosticUtils.logDiagnostics()
      this.updateStatus('Report generated (check console)', 'healthy')
    } catch (error) {
      this.updateStatus('Report failed', 'error')
      console.error('Diagnostics error:', error)
    }
  }

  private handleExportData = async (): Promise<void> => {
    try {
      this.updateStatus('Exporting data...', 'warning')
      await DiagnosticUtils.downloadDiagnostics()
      this.updateStatus('Data exported', 'healthy')
    } catch (error) {
      this.updateStatus('Export failed', 'error')
      console.error('Export error:', error)
    }
  }

  private handleClearData = (): void => {
    if (confirm('Are you sure you want to clear all diagnostic data?')) {
      try {
        DiagnosticUtils.clearAllData()
        this.updateStatus('Data cleared', 'healthy')
      } catch (error) {
        this.updateStatus('Clear failed', 'error')
        console.error('Clear data error:', error)
      }
    }
  }

  private updateStatus(
    text: string,
    type: 'healthy' | 'warning' | 'error',
  ): void {
    this.statusText.textContent = text
    this.statusIcon.className = `status-icon ${type}`
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    // Ctrl/Cmd + R: Refresh statistics
    if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
      event.preventDefault()
      this.loadStatistics()
    }

    // Ctrl/Cmd + S: Sync
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault()
      this.handleSyncClick()
    }

    // Ctrl/Cmd + P: Poll status
    if ((event.ctrlKey || event.metaKey) && event.key === 'p') {
      event.preventDefault()
      this.handlePollStatusClick()
    }

    // Ctrl/Cmd + D: Toggle dark mode
    if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
      event.preventDefault()
      this.darkModeToggle.checked = !this.darkModeToggle.checked
      this.handleDarkModeToggle()
    }

    // Space: Toggle switch
    if (event.key === ' ' && event.target === document.body) {
      event.preventDefault()
      this.toggleSwitch.checked = !this.toggleSwitch.checked
      this.handleToggleChange()
    }

    // H: Health check
    if (event.key === 'h' && !event.ctrlKey && !event.metaKey) {
      this.handleHealthCheck()
    }

    // T: Diagnostics (changed from D to avoid conflict with dark mode)
    if (event.key === 't' && !event.ctrlKey && !event.metaKey) {
      this.handleDiagnostics()
    }
  }

  private handleHideNonFoodToggle = (): void => {
    try {
      const hideNonFoodItems = this.hideNonFoodToggle.checked

      // Save setting to storage
      chrome.storage.sync.set({ hideNonFoodItems })
      ErrorHandler.logInfo(
        'Popup',
        `Hide non-food toggle changed: hideNonFoodItems = ${hideNonFoodItems}`,
      )

      // Send message to content script to update styles
      this.sendMessageToActiveTab({
        action: 'refreshStyles',
        hideNonFoodItems,
      })
    } catch (error) {
      ErrorHandler.logError('Popup', error, {
        context: 'Hide non-food toggle handling',
      })
    }
  }
}
