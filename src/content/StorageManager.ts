/**
 * Manages Chrome extension storage operations for user preferences and settings.
 * Provides a simplified interface for Chrome storage API with type safety and error handling.
 * Uses Chrome's sync storage to maintain settings across devices and browser sessions.
 *
 * Key responsibilities:
 * - Managing user preference persistence
 * - Providing type-safe storage operations
 * - Abstracting Chrome storage API complexity
 * - Ensuring settings sync across user's Chrome instances
 *
 * Current settings managed:
 * - hideNonLowFodmap: Controls visibility of non-low-FODMAP products
 *
 * Uses Chrome sync storage for automatic cross-device synchronization,
 * ensuring user preferences are maintained across all their Chrome browsers.
 */
export class StorageManager {
  /**
   * Retrieves the user's preference for hiding non-low-FODMAP products
   *
   * @returns Promise that resolves to boolean indicating if non-low-FODMAP products should be hidden
   *
   * Defaults to false if no preference has been set, ensuring all products
   * are visible by default for new users. Uses Chrome sync storage for
   * cross-device preference synchronization.
   */
  static async getHideNonLowFodmap(): Promise<boolean> {
    return new Promise((resolve) => {
      chrome.storage.sync.get({ hideNonLowFodmap: false }, (data) => {
        resolve(!!data.hideNonLowFodmap)
      })
    })
  }

  /**
   * Saves the user's preference for hiding non-low-FODMAP products
   *
   * @param hide - Boolean indicating whether non-low-FODMAP products should be hidden
   * @returns Promise that resolves when the preference is successfully saved
   *
   * Persists the setting to Chrome sync storage, making it available across
   * all the user's Chrome browsers and ensuring it survives browser restarts.
   */
  static async setHideNonLowFodmap(hide: boolean): Promise<void> {
    return new Promise((resolve) => {
      chrome.storage.sync.set({ hideNonLowFodmap: hide }, () => {
        resolve()
      })
    })
  }
}
