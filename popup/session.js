async function session(translations) {
    const details = document.getElementById('details');
    let exportSelect = "onlyAddress";

    await chrome.storage.local.get('exportSelect', function (data) {
        if (data.exportSelect) {
            exportSelect = data.exportSelect;
        }
    });

    const storedOrders = await new Promise(resolve => {
        chrome.storage.local.get('storedOrders', data => resolve(data.storedOrders || []));
    });

    details.innerHTML = '';

    let franceDestinations = storedOrders.filter(order => order.address["country-name"] === 'France');
    let otherDestinations = storedOrders.filter(order => order.address["country-name"] !== 'France');

    const list = document.createElement('ul');

    storedOrders.forEach(order => {
        const li = document.createElement('li');
        const addressContainer = document.createElement('div');
        addressContainer.classList.add('address-container');
        addressContainer.innerHTML = formatDestination(order.address);
        li.appendChild(addressContainer);
        li.innerHTML += `
            <div class="fc g0-25 jc-sb ai-fe">
                <span class="c-lg">#${order.orderId}</span>
                <span class="c-lg formated-first-detection">${formatDate(order.firstDetection)}</span>
                ${order.website === 'etsy' ? `<i class="fa-brands fa-etsy fs1-25"></i>` : ''}
                ${order.website === 'woocommerce' ? `<i class="fa-brands fa-wordpress fs1-25"></i>` : ''}
                ${order.website === 'ebay' ? `<i class="fa-brands fa-ebay fs1-25"></i>` : ''}
            </div>
        `;
        li.addEventListener('click', () => {
            const addressText = addressContainer.innerHTML.replace(/<br\s*\/?>/gi, '\n');
            copyToClipboard(addressText, li);
        });
        list.appendChild(li);
    });

    const franceCount = franceDestinations.length;
    const otherCount = otherDestinations.length;

    const keyValues = document.createElement('div');
    keyValues.classList.add('key-values');
    keyValues.innerHTML = `
        <div class="counter">
            <h3>${translations.total_orders}</h3>
            <h1>${storedOrders.length}</h1>
        </div>
        <div class="fr g0-5 w100">
            <div class="counter">
                <img src="elements/france.svg" alt="Map">
                <h3>${translations.france}</h3>
                <h1>${franceCount}</h1>
            </div>
            <div class="counter">
                <img src="elements/map.svg" alt="Map">
                <h3>${translations.other}</h3>
                <h1>${otherCount}</h1>
            </div>
        </div>
    `;
    details.appendChild(keyValues);

    details.appendChild(list);

    if (storedOrders.length > 0) {
        const exportButton = document.createElement('button');
        exportButton.classList.add('export-btn');
        exportButton.innerHTML = `
            <i class="fa-solid fa-download"></i>
            ${translations.export_csv}
        `
        exportButton.addEventListener('click', () => {
            exportToCSV(storedOrders, translations.csv_filename, exportSelect);
        });
        details.appendChild(exportButton);

        const clearButton = document.createElement('button');
        clearButton.classList.add('clear-btn');
        clearButton.innerHTML = `
            <i class="fa-solid fa-trash"></i>
            ${translations.clear_session}
        `
        clearButton.addEventListener('click', async () => {
            await new Promise(resolve => {
                chrome.storage.local.set({ storedOrders: [] }, resolve);
            });
            session(translations); // Refresh the session tab
        });
        details.appendChild(clearButton);
    }
}

function formatDate(date) {
    const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' };
    return new Date(date).toLocaleString('fr-FR', options);
}