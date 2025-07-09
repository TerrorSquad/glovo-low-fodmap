document.addEventListener('DOMContentLoaded', () => {
  const toggleSwitch = document.getElementById(
    'toggleSwitch'
  ) as HTMLInputElement;

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
});
