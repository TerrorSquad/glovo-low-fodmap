document.addEventListener('DOMContentLoaded', () => {
  const toggleSwitch = document.getElementById('toggleSwitch');

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
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'toggleHide',
        hide: shouldHide,
      });
    });
  });
});
