import { BackgroundMessageHandler } from './background/BackgroundMessageHandler'
import { SyncOrchestrator } from './background/SyncOrchestrator'
import { Config } from './shared/Config'
import { ErrorHandler } from './shared/ErrorHandler'
import { ExtensionMonitor } from './shared/ExtensionMonitor'
import { Logger } from './shared/Logger'

// Initialize the background services
const syncOrchestrator = SyncOrchestrator.getInstance()
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
  Logger.info('Background', 'Starting background sync system...')
  syncOrchestrator.startPeriodicSync()
} else {
  Logger.info('Background', 'Background sync is disabled')
}

// Cleanup on extension shutdown
chrome.runtime.onSuspend.addListener(() => {
  Logger.info('Background', 'Extension suspending, cleaning up...')
  syncOrchestrator.stopPeriodicSync()
  monitor.stop()
})
