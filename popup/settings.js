function initSettings(translations) {
    const languageSelect = document.getElementById('languageSelect');
    const label = document.querySelector('label[for="languageSelect"]');
    label.textContent = translations.select_language;

    const options = languageSelect.querySelectorAll('option');
    options[0].textContent = translations.en;
    options[1].textContent = translations.fr;


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
