document.addEventListener('DOMContentLoaded', () => {
  const toggleSwitch = document.getElementById(
    'toggleSwitch',
  ) as HTMLInputElement
  const syncButton = document.getElementById('syncButton') as HTMLButtonElement

  chrome.storage.sync.get({ hideNonLowFodmap: false }, (data) => {
    toggleSwitch.checked = !!data.hideNonLowFodmap
  })

  toggleSwitch.addEventListener('change', () => {
    const shouldHide = toggleSwitch.checked
    chrome.storage.sync.set({ hideNonLowFodmap: shouldHide })
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 're-evaluate',
          hide: shouldHide,
        })
      }
    })
  })

  syncButton.addEventListener('click', () => {
    console.log('Popup: Kliknuto dugme za sinhronizaciju.')
    chrome.runtime.sendMessage({ action: 'syncWithApi' })
  })
})
