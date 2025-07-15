import { BackgroundMessageHandler } from './background/BackgroundMessageHandler'
import { SyncOrchestrator } from './background/SyncOrchestrator'
import { Config } from './shared/Config'
import { ErrorHandler } from './shared/ErrorHandler'
import { ExtensionMonitor } from './shared/ExtensionMonitor'

// Initialize the background services
const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT
const syncOrchestrator = new SyncOrchestrator(API_ENDPOINT)
const messageHandler = new BackgroundMessageHandler(syncOrchestrator)
const monitor = ExtensionMonitor.getInstance()

// Validate configuration
if (!Config.validate()) {
  ErrorHandler.logError(
    'Background',
    new Error('Invalid configuration detected'),
  )
}

// Setup message listener
messageHandler.setupListener()

// Start extension monitoring
monitor.start()

// Start periodic sync if enabled
if (Config.ENABLE_SYNC) {
  ErrorHandler.logInfo('Background', 'Starting background sync system...')
  syncOrchestrator.startPeriodicSync()
} else {
  ErrorHandler.logInfo('Background', 'Background sync is disabled')
}

// Cleanup on extension shutdown
chrome.runtime.onSuspend.addListener(() => {
  ErrorHandler.logInfo('Background', 'Extension suspending, cleaning up...')
  syncOrchestrator.stopPeriodicSync()
  monitor.stop()
})
