function initSettings(translations) {
    const languageSelect = document.getElementById('languageSelect');
    const getCompleteAdress = document.getElementById('getCompleteAdress');
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

    getCompleteAdress.addEventListener('change', function () {
        const status = getCompleteAdress.checked ? 'on' : 'off';
        chrome.storage.local.set({ 'getCompleteAdress': status }, function () {
            console.log('getCompleteAdress set to:', status);
            chrome.runtime.sendMessage({ type: 'getCompleteAdressChanged', status: status });
        });
    });

    chrome.storage.local.get('language', function (data) {
        if (data.language) {
            languageSelect.value = data.language;
        }
    });
    chrome.storage.local.get('getCompleteAdress', function (data) {
        if (data.getCompleteAdress) {
            console.log(data.getCompleteAdress)
            getCompleteAdress.checked = data.getCompleteAdress === 'on';
        }
    });
}
