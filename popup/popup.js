document.addEventListener('DOMContentLoaded', function () {
    const content = document.getElementById('content');
    const homeTab = document.getElementById('homeTab');
    const settingsTab = document.getElementById('settingsTab');

    homeTab.addEventListener('click', () => loadContent('home'));
    settingsTab.addEventListener('click', () => loadContent('settings'));

    // Load home by default
    loadContent('home');

    function loadContent(page) {
        console.log('Loading content:', page)
        if (page === 'home') {
            homeTab.classList.add('active');
            settingsTab.classList.remove('active');
            fetch('home.html')
                .then(response => response.text())
                .then(data => {
                    content.innerHTML = data;
                    initHome();
                })
                .catch(error => console.error('Error loading content:', error));
        } else if (page === 'settings') {
            homeTab.classList.remove('active');
            settingsTab.classList.add('active');
            fetch('settings.html')
                .then(response => response.text())
                .then(data => {
                    content.innerHTML = data;
                    initSettings();
                })
                .catch(error => console.error('Error loading content:', error));
        }
    }
});
