import { PopupController } from './popup/PopupController'

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const popupController = new PopupController()
    await popupController.init()
  } catch (error) {
    console.error('Failed to initialize popup:', error)
  }
})
