import { BackgroundMessageHandler } from './background/BackgroundMessageHandler'
import { SyncOrchestrator } from './background/SyncOrchestrator'
import { ExtensionMonitor } from './shared/ExtensionMonitor'

// Initialize the background services
const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT
const syncOrchestrator = new SyncOrchestrator(API_ENDPOINT)
const messageHandler = new BackgroundMessageHandler(syncOrchestrator)
const monitor = ExtensionMonitor.getInstance()

// Setup message listener
messageHandler.setupListener()

// Start extension monitoring
monitor.start()

// Cleanup on extension shutdown
chrome.runtime.onSuspend.addListener(() => {
  monitor.stop()
})
