function initSettings(translations) {
    const languageSelect = document.getElementById('languageSelect');
    const label = document.querySelector('label[for="languageSelect"]');

    document.querySelectorAll('[data-translation-id]').forEach(element => {
        const translationId = element.getAttribute('data-translation-id');
        element.innerHTML = translations[translationId] || element.innerHTML;
    });

    languageSelect.addEventListener('change', function () {
        const selectedLang = languageSelect.value;
        chrome.storage.local.set({ 'language': selectedLang }, function () {
            console.log('Language set to:', selectedLang);
            chrome.runtime.sendMessage({ type: 'languageChanged', language: selectedLang });
        });
    });

    chrome.storage.local.get('language', function (data) {
        if (data.language) {
            languageSelect.value = data.language;
        }
    });
}
