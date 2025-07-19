import './styles/tailwind.css'
import { PopupController } from './popup/PopupController'
import { FeatureFlags } from './shared/FeatureFlags'

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const controller = new PopupController()
    await controller.init()
  } catch (error) {
    console.error('Failed to initialize popup:', error)
  }

  const debugSection = document.querySelector('.debug-section') as HTMLElement
  const debugMode = FeatureFlags.isDebugModeEnabled() ?? false
  if (debugSection) {
    debugSection.style.display = debugMode ? 'block' : 'none'
  }
})
