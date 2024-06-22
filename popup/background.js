chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'languageChanged') {
        chrome.runtime.sendMessage({ type: 'languageChanged', language: message.language });
    }
    if (message.type === 'exportSelectChanged') {
        chrome.runtime.sendMessage({ type: 'exportSelectChanged', exportSelect: message.exportSelect });
    }
});
