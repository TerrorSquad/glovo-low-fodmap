chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-hide-products') {
    chrome.storage.sync.get('hideNonLowFodmap', (data) => {
      const newState = !data.hideNonLowFodmap;

      chrome.storage.sync.set({ hideNonLowFodmap: newState });

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab?.id) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'toggleHide',
            hide: newState,
          });
        }
      });
    });
  }
});
