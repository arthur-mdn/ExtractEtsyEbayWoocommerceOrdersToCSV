function initSettings() {
    document.addEventListener('DOMContentLoaded', function () {
        const languageSelect = document.getElementById('languageSelect');

        languageSelect.addEventListener('change', function () {
            const selectedLang = languageSelect.value;
            chrome.storage.local.set({ 'language': selectedLang }, function () {
                location.reload();
            });
        });

        chrome.storage.local.get('language', function (data) {
            if (data.language) {
                languageSelect.value = data.language;
            }
        });
    });
}
