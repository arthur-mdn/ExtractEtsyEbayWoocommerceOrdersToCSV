chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'languageChanged') {
        chrome.runtime.sendMessage({ type: 'languageChanged', language: message.language });
    }
});
