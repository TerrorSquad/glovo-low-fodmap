import { BackgroundMessageHandler } from '@/entrypoints/background/BackgroundMessageHandler'
import { SyncOrchestrator } from '@/entrypoints/background/SyncOrchestrator'
import { ExtensionMonitor } from '@/utils/ExtensionMonitor'
export default defineBackground(() => {
  console.log('Background script initialized')
  const syncOrchestrator = SyncOrchestrator.getInstance()
  const handler = new BackgroundMessageHandler(syncOrchestrator)
  const monitor = ExtensionMonitor.getInstance()

  handler.setupListener()

  monitor.start()

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
})
