document.addEventListener('DOMContentLoaded', async function () {
    const content = document.getElementById('content');
    const homeTab = document.getElementById('homeTab');
    const settingsTab = document.getElementById('settingsTab');

    const lang = await getSelectedLanguage();
    const translations = await loadTranslations(lang);

    applyTranslations(translations);

    homeTab.addEventListener('click', () => loadContent('home', translations));
    settingsTab.addEventListener('click', () => loadContent('settings', translations));

    // Load home by default
    loadContent('home', translations);

    async function loadContent(page, translations) {
        console.log('Loading content:', page);
        if (page === 'home') {
            homeTab.classList.add('active');
            settingsTab.classList.remove('active');
            fetch('home.html')
                .then(response => response.text())
                .then(data => {
                    content.innerHTML = data;
                    initHome(translations);
                })
                .catch(error => console.error('Error loading content:', error));
        } else if (page === 'settings') {
            homeTab.classList.remove('active');
            settingsTab.classList.add('active');
            fetch('settings.html')
                .then(response => response.text())
                .then(data => {
                    content.innerHTML = data;
                    initSettings(translations);
                })
                .catch(error => console.error('Error loading content:', error));
        }
    }

    async function getSelectedLanguage() {
        return new Promise((resolve) => {
            chrome.storage.local.get('language', function (data) {
                resolve(data.language || 'en');
            });
        });
    }

    async function loadTranslations(lang) {
        const response = await fetch(`../lang/${lang}.json`);
        return await response.json();
    }

    function applyTranslations(translations) {
        document.getElementById('homeTab').innerHTML = `<i class="fa fa-home"></i> ${translations.home}`;
        document.getElementById('settingsTab').innerHTML = `<i class="fa fa-cog"></i> ${translations.settings}`;
    }

    // Listen for language change messages
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'languageChanged') {
            const lang = message.language || 'en';
            loadTranslations(lang).then((translations) => {
                applyTranslations(translations);
                const activeTab = document.querySelector('.menu .active');
                if (activeTab.id === 'homeTab') {
                    loadContent('home', translations);
                } else if (activeTab.id === 'settingsTab') {
                    loadContent('settings', translations);
                }
            });
        }
    });
});
