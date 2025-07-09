document.addEventListener('DOMContentLoaded', () => {
  const toggleSwitch = document.getElementById(
    'toggleSwitch'
  ) as HTMLInputElement;
  const syncButton = document.getElementById('syncButton') as HTMLButtonElement;

  chrome.storage.sync.get(
    'hideNonLowFodmap',
    (data: { hideNonLowFodmap: boolean }) => {
      toggleSwitch.checked = !!data.hideNonLowFodmap;
    }
  );

  toggleSwitch.addEventListener('change', () => {
    const shouldHide = toggleSwitch.checked;
    chrome.storage.sync.set({ hideNonLowFodmap: shouldHide });

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      chrome.tabs.sendMessage(tab.id as number, {
        action: 'toggleHide',
        hide: shouldHide,
      });
    });
  });



  // Logika za novo dugme za sinhronizaciju
  syncButton.addEventListener('click', () => {
    console.log('Popup: Kliknuto dugme za sinhronizaciju.');
    // Šalje poruku pozadinskoj skripti da pokrene sinhronizaciju
    chrome.runtime.sendMessage({ action: "syncWithApi" });
    // Zatvori popup da ne smeta
    window.close();
  });
});
