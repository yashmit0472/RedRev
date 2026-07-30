chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "PRODUCT") {
        chrome.storage.local.set({ currentProductTitle: msg.title });
    }
});
