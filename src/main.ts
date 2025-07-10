document.addEventListener('DOMContentLoaded', () => {
  // Logika za novo dugme za sinhronizaciju
  const syncButton = document.getElementById('syncButton') as HTMLButtonElement;

  syncButton.addEventListener('click', () => {
    console.log('Popup: Kliknuto dugme za sinhronizaciju.');

    chrome.runtime.sendMessage({ action: 'syncWithApi' });
  });
});
