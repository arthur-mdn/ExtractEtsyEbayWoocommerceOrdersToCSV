document.addEventListener('DOMContentLoaded', async function () {
    const content = document.getElementById('content');
    const homeTab = document.getElementById('homeTab');
    const sessionTab = document.getElementById('sessionTab');
    const settingsTab = document.getElementById('settingsTab');

    let lang = await getSelectedLanguage();
    let translations = await loadTranslations(lang);

    applyTranslations(translations);

    homeTab.addEventListener('click', async () => {
        lang = await getSelectedLanguage();
        translations = await loadTranslations(lang);
        loadContent('home', translations);
    });

    sessionTab.addEventListener('click', async () => {
        lang = await getSelectedLanguage();
        translations = await loadTranslations(lang);
        loadContent('session', translations);
    })

    settingsTab.addEventListener('click', async () => {
        lang = await getSelectedLanguage();
        translations = await loadTranslations(lang);
        loadContent('settings', translations);
    });

    // Load home by default
    loadContent('home', translations);

    async function loadContent(page, translations) {
        if (page === 'home') {
            homeTab.classList.add('active');
            sessionTab.classList.remove('active');
            settingsTab.classList.remove('active');
            fetch('home.html')
                .then(response => response.text())
                .then(data => {
                    content.innerHTML = data;
                    initHome(translations);
                })
                .catch(error => console.error('Error loading content:', error));
        } else if (page === 'session') {
            homeTab.classList.remove('active');
            sessionTab.classList.add('active');
            settingsTab.classList.remove('active');
            fetch('session.html')
                .then(response => response.text())
                .then(data => {
                    content.innerHTML = data;
                    session(translations);
                })
                .catch(error => console.error('Error loading content:', error));
        } else if (page === 'settings') {
            homeTab.classList.remove('active');
            sessionTab.classList.remove('active');
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
        document.querySelectorAll('[data-translation-id]').forEach(element => {
            const translationId = element.getAttribute('data-translation-id');
            element.innerHTML = translations[translationId] || element.innerHTML;
        });
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
