chrome.commands.onCommand.addListener((command) => {
  if (command === "toggle-hide-products") {

    chrome.storage.sync.get('hideNonLowFodmap', (data) => {
      const newState = !data.hideNonLowFodmap;

      chrome.storage.sync.set({ hideNonLowFodmap: newState });


      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { action: "toggleHide", hide: newState });
        }
      });
    });
  }
});
