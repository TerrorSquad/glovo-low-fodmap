import { BackgroundMessageHandler } from '@/entrypoints/background/BackgroundMessageHandler'
import { SyncOrchestrator } from '@/entrypoints/background/SyncOrchestrator'

export default defineBackground(() => {
  console.log('Background script initialized')
  const syncOrchestrator = SyncOrchestrator.getInstance()
  const handler = new BackgroundMessageHandler(syncOrchestrator)

  handler.setupListener()

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
  })
})
