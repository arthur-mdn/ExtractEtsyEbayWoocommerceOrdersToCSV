function initSettings(translations) {
    const languageSelect = document.getElementById('languageSelect');
    const exportSelect = document.getElementById('exportSelect');

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

    exportSelect.addEventListener('change', function () {
        const selectedExport = exportSelect.value;
        chrome.storage.local.set({ 'exportSelect': selectedExport }, function () {
            console.log('exportSelect set to:', selectedExport);
            chrome.runtime.sendMessage({ type: 'exportSelectChanged', status: status });
        });
    });

    chrome.storage.local.get('language', function (data) {
        if (data.language) {
            languageSelect.value = data.language;
        }
    });
    chrome.storage.local.get('exportSelect', function (data) {
        if (data.exportSelect) {
            exportSelect.value = data.exportSelect;
        }
    });
}
