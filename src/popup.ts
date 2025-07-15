import { PopupController } from './popup/PopupController'

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const controller = new PopupController()
    await controller.init()
  } catch (error) {
    console.error('Failed to initialize popup:', error)
  }
})
