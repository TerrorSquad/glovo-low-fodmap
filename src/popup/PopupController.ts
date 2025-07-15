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
    await this.loadSettings()
    this.setupEventListeners()
  }

  private async loadSettings(): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.sync.get({ hideNonLowFodmap: false }, (data) => {
        this.toggleSwitch.checked = !!data.hideNonLowFodmap
        resolve()
      })
    })
  }

  private setupEventListeners(): void {
    this.toggleSwitch.addEventListener('change', this.handleToggleChange)
    this.syncButton.addEventListener('click', this.handleSyncClick)
  }

  private handleToggleChange = (): void => {
    const shouldHide = this.toggleSwitch.checked

    // Save setting to storage
    chrome.storage.sync.set({ hideNonLowFodmap: shouldHide })

    // Notify content script
    this.sendMessageToActiveTab({
      action: 're-evaluate',
      hide: shouldHide,
    })
  }

  private handleSyncClick = (): void => {
    console.log('Popup: Sync button clicked')
    chrome.runtime.sendMessage({ action: 'syncWithApi' })
  }

  private sendMessageToActiveTab(message: any): void {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, message)
      }
    })
  }
}
