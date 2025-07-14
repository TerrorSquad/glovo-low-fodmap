/**
 * Manages Chrome storage operations
 */
export class StorageManager {
  static async getHideNonLowFodmap(): Promise<boolean> {
    return new Promise((resolve) => {
      chrome.storage.sync.get({ hideNonLowFodmap: false }, (data) => {
        resolve(!!data.hideNonLowFodmap)
      })
    })
  }

  static async setHideNonLowFodmap(hide: boolean): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ hideNonLowFodmap: hide }, () => {
        resolve()
      })
    })
  }
}
