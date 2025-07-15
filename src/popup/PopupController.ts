import { DiagnosticUtils } from '../shared/DiagnosticUtils'
import { ErrorHandler } from '../shared/ErrorHandler'
import { PerformanceMonitor } from '../shared/PerformanceMonitor'

/**
 * Handles popup UI interactions and Chrome API communication
 */
export class PopupController {
  private toggleSwitch: HTMLInputElement
  private syncButton: HTMLButtonElement
  private statusElement: HTMLElement
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
    this.syncButton = document.getElementById('syncButton') as HTMLButtonElement

    // Status elements
    this.statusElement = document.getElementById('status') as HTMLElement
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

    if (!this.toggleSwitch || !this.syncButton) {
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

  private async loadStatistics(): Promise<void> {
    try {
      // Get product counts from storage
      return new Promise<void>((resolve) => {
        chrome.storage.local.get(['products'], (data) => {
          const products = data.products || []
          const lowFodmapProducts = products.filter(
            (p: any) => p.fodmapStatus === 'low',
          )

          this.totalProductsElement.textContent = products.length.toString()
          this.lowFodmapCountElement.textContent =
            lowFodmapProducts.length.toString()

          ErrorHandler.logInfo(
            'Popup',
            `Loaded statistics: ${products.length} total, ${lowFodmapProducts.length} low FODMAP`,
          )
          resolve()
        })
      })
    } catch (error) {
      ErrorHandler.logError('Popup', error, { context: 'Loading statistics' })
      this.totalProductsElement.textContent = '?'
      this.lowFodmapCountElement.textContent = '?'
    }
  }

  private setupEventListeners(): void {
    this.toggleSwitch.addEventListener('change', this.handleToggleChange)
    this.syncButton.addEventListener('click', this.handleSyncClick)

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

  private handleSyncClick = async (): Promise<void> => {
    try {
      this.updateStatus('Syncing...', 'warning')
      this.syncButton.disabled = true

      ErrorHandler.logInfo('Popup', 'Sync button clicked')
      chrome.runtime.sendMessage({ action: 'syncWithApi' })

      // Wait a moment then refresh statistics
      setTimeout(async () => {
        await this.loadStatistics()
        this.updateStatus('Sync completed', 'healthy')
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

    // D: Diagnostics
    if (event.key === 'd' && !event.ctrlKey && !event.metaKey) {
      this.handleDiagnostics()
    }
  }
}
