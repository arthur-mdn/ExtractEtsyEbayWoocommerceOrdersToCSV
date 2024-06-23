async function initHome(translations) {
    const details = document.getElementById('details');
    let exportSelect = "fullOrderDetails";

    await chrome.storage.local.get('exportSelect', function (data) {
        if (data.exportSelect) {
            exportSelect = data.exportSelect;
        }
    });

    const style = document.createElement('style');
    style.textContent = `
        ul li::after {
            content: "${translations.copied}";
        }
    `;
    document.head.appendChild(style);

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        chrome.scripting.executeScript(
            {
                target: { tabId: tabs[0].id },
                func: getDestinations,
                args: [exportSelect]
            },
            (responses) => {
                if (responses && responses[0] && responses[0].result) {
                    const response = responses[0].result;

                    if (!response.success) {
                        const errorElement = document.createElement('div');
                        errorElement.classList.add('error-message');
                        errorElement.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i>${translations[response.error]}`;
                        details.appendChild(errorElement);

                        if(response.error === 'website_not_supported') {
                            details.innerHTML += `
                                <h2>${translations.supported_websites}</h2>
                                <div class="fr g1">
                                    <div class="fc g0-25 card">
                                        <i class="fa-brands fa-etsy fs1-25"></i>
                                        Etsy
                                    </div>
                                    <div class="fc g0-25 card">
                                        <i class="fa-brands fa-wordpress fs1-25"></i>
                                        WooCommerce
                                    </div>
                                    <div class="fc g0-25 card">
                                        <i class="fa-brands fa-ebay fs1-25"></i>
                                        eBay
                                    </div>
                                  
                                </div>
                            `;
                        }
                        return;
                    }
                    console.log(response)
                    let orders = response.orders;

                    details.innerHTML = '';

                    let franceDestinations = [];
                    let otherDestinations = [];

                    console.log(orders);

                    franceDestinations = orders.filter(order => order.address["country-name"] === 'France');
                    otherDestinations = orders.filter(order => order.address["country-name"] !== 'France');

                    const list = document.createElement('ul');

                    orders.forEach(order => {
                        const li = document.createElement('li');
                        const addressContainer = document.createElement('div');
                        addressContainer.classList.add('address-container');
                        addressContainer.innerHTML = formatDestination(order.address);
                        li.appendChild(addressContainer);
                        li.innerHTML += `
                            <div class="fc g1 ai-fe">
                                <span class="c-lg">#${order.orderId}</span>
                                ${order.website === 'etsy' ? `<i class="fa-brands fa-etsy"></i>` : ''}
                                ${order.website === 'woocommerce' ? `<i class="fa-brands fa-wordpress"></i>` : ''}
                                ${order.website === 'ebay' ? `<i class="fa-brands fa-ebay"></i>` : ''}
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

                    if ( response.website ) {
                        const website = document.createElement('div');
                        website.classList.add('website');
                        website.innerHTML = `
                            <h3>${translations.website_detected}</h3>
                            <div class="fc g0-25">
                                <i class="fa-brands fa-${response.website} fs1-25"></i>
                                ${translations[response.website]}
                            </div>
                            
                        `;
                        details.appendChild(website);
                    }
                    const keyValues = document.createElement('div');
                    keyValues.classList.add('key-values');
                    keyValues.innerHTML = `
                        <div class="counter">
                            <h3>${translations.total_orders}</h3>
                            <h1>${orders.length}</h1>
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

                    if (orders.length > 0) {
                        const exportButton = document.createElement('button');
                        exportButton.classList.add('export-btn');
                        exportButton.innerHTML = `
                            <i class="fa fa-download"></i>
                            ${translations.export_csv}
                        `
                        exportButton.addEventListener('click', () => {
                            exportToCSV(orders, translations.csv_filename, exportSelect);
                        });
                        details.appendChild(exportButton);
                    }

                } else {
                    const errorElement = document.createElement('div');
                    errorElement.classList.add('error-message');
                    errorElement.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i>${translations.no_orders_found}`;
                    details.appendChild(errorElement);
                }
            }
        );
    });
}

function exportToCSV(destinations, filename, exportSelect) {
    console.log(exportSelect)
    const headers = ["name", "address", "city_and_zip", "country-name"];
    const rows = destinations.map(order => {
        const dest = order.address;
        const address = formatAddressForCSV(dest);
        const cityAndZip = formatCityAndZipForCSV(dest);
        return [
            dest["name"] || '',
            address,
            cityAndZip,
            dest["country-name"] || ''
        ].join(";");
    });

    let csvContent = "data:text/csv;charset=utf-8," + [headers.join(";"), ...rows].join("\n");
    let encodedUri = encodeURI(csvContent);
    let link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link); // Required for FF

    link.click();
    document.body.removeChild(link);
}

function formatAddressForCSV(dest) {
    const fields = ["first-line", "second-line", "third-line"];
    const seenValues = new Set();
    const values = [];

    const zip = dest["zip"] ? dest["zip"].trim() : '';
    const city = dest["city"] ? capitalizeFirstLetter(dest["city"].trim()) : '';
    const zipCityRegex = new RegExp(`(${zip}\\s*${city}|${city}\\s*${zip})`, 'i');

    fields.forEach(field => {
        if (dest[field]) {
            let fieldValue = dest[field];
            // Remove zip+city or city+zip from the address fields
            fieldValue = fieldValue.replace(zipCityRegex, '').trim();
            const lowerValue = fieldValue.toLowerCase();
            if (!seenValues.has(lowerValue) && fieldValue) {
                seenValues.add(lowerValue);
                values.push(capitalizeFirstLetter(fieldValue));
            }
        }
    });

    return values.join(" ");
}

function formatCityAndZipForCSV(dest) {
    const zip = dest["zip"] ? dest["zip"].trim() : '';
    const city = dest["city"] ? capitalizeFirstLetter(dest["city"].trim()) : '';
    return zip === city ? zip : `${zip} ${city}`.trim();
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

async function getDestinations(exportSelect) {
    let orders = [];
    let message = {
        success: false,
        orders: [],
        error: 'error_occurred'
    };

    const url = window.location.href;
    const allowedWebsites = ["etsy", "ebay", "shop_order"];
    const isAllowedWebsite = allowedWebsites.some(website => url.includes(website));

    if (!isAllowedWebsite) {
        message.error = "website_not_supported";
        return message;
    }

    if (url.includes("etsy")) {
        const destinationButtons = document.querySelectorAll('section[aria-label="orders"] .panel-body .flag .flag-body .col-group .col-md-4 .wt-mt-xs-2 div button[aria-expanded="false"]');
        await destinationButtons.forEach(button => button.click());
        const ordersElements = document.querySelectorAll('section[aria-label="orders"] .panel-body .flag .flag-body .col-group.col-flush:not(.mt-xs-1)');

        orders = Array.from(ordersElements).map(el => {
            const order = {};
            const addressElement = el.querySelector('.col-md-4 .wt-mt-xs-2 div .address.break-word p:not(.wt-text-slime)');
            const address = {};
            addressElement.querySelectorAll('span').forEach(span => {
                address[span.className] = span.textContent.trim();
            });

            order.orderId = el.querySelector('.col-md-8 .col-group a[aria-current="page"]').textContent.replace("#", "");
            order.address = address;
            order.website = "etsy";

            return order;
        });
        message.website = "etsy";
    }

    else if (url.includes("shop_order")) { // WooCommerce
        let ordersElements = document.querySelectorAll('#wpbody #posts-filter .wp-list-table.posts tbody#the-list tr');
        ordersElements = Array.from(ordersElements).filter(el => el.querySelector('td.order_status mark.status-processing')); // Filter only processing orders
        orders = Array.from(ordersElements).map(el => {
            const order = {};
            const addressElement = el.querySelector('td.shipping_address');
            const address = {};

            const descriptionSpans = addressElement.querySelectorAll('span.description');
            descriptionSpans.forEach(span => span.remove());

            let addressText = addressElement.innerText;

            const lines = addressText.split(',').map(line => line.trim());

            // Convert to Etsy-like structure
            const etsyAddress = {};

            if (lines.length > 0) {
                etsyAddress["name"] = lines[0]; // First line is always the name
            }

            const zipCityRegex = /(\d{5})\s*(.+)/;
            const frenchZipCodeRegex = /^[0-9]{5}$/;
            const countryRegex = /^[A-Za-z\s]+$/;

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                const zipCityMatch = line.match(zipCityRegex);

                if (i === lines.length - 1 && !zipCityMatch) {
                    // Last line without zip is the country
                    if (!frenchZipCodeRegex.test(line)) {
                        etsyAddress["country-name"] = line;
                    }
                } else if (zipCityMatch) {
                    // Line with zip and city
                    etsyAddress["zip"] = zipCityMatch[1];
                    etsyAddress["city"] = zipCityMatch[2];
                    if (i === lines.length - 1) {
                        etsyAddress["country-name"] = "France";
                    }
                } else {
                    // Other address lines
                    if (!etsyAddress["first-line"]) {
                        etsyAddress["first-line"] = line;
                    } else if (!etsyAddress["second-line"]) {
                        etsyAddress["second-line"] = line;
                    } else {
                        etsyAddress[`line-${i}`] = line;
                    }
                }
            }

            // Ensure country-name is set if not already set
            if (!etsyAddress["country-name"]) {
                etsyAddress["country-name"] = lines[lines.length - 1];
            }

            // Remove any redundant country name line
            Object.keys(etsyAddress).forEach(key => {
                if (key.startsWith('line-') && etsyAddress[key].toLowerCase() === etsyAddress["country-name"].toLowerCase()) {
                    delete etsyAddress[key];
                }
            });

            order.orderId = el.querySelector('td.order_number a').getAttribute('data-order-id');
            order.address = etsyAddress;
            order.website = "woocommerce";

            return order;
        });
        message.website = "woocommerce";
    }
    else if (url.includes("ebay") && !url.includes("details")) { // eBay but not on order details page
        message.error = "ebay_order_details_required";
        return message;
    }
    else if (url.includes("ebay")) { // eBay
        let ordersElements = document.querySelectorAll('.sh-core-page .sh-core-layout__body .wrapper');
        ordersElements = Array.from(ordersElements).filter(el => !el.querySelector('.widget .shipping-info .content .details .tracking-info')); // Filter only orders without shipping number
        if (ordersElements.length === 0) {
            message.error = "ebay_no_orders_found";
            return message;
        }
        orders = Array.from(ordersElements).map(el => {
            const order = {};
            const addressElement = el.querySelector('.content .widget .shipping-info .content .details .shipping-address .address');
            const address = {};
            let lines = Array.from(addressElement.querySelectorAll('span button')).map(field => field.textContent.trim());

            // Convert to Etsy-like structure
            const etsyAddress = {};

            if (lines.length > 0) {
                etsyAddress["name"] = lines[0]; // First line is always the name
            }

            if (lines.length > 3) {
                etsyAddress["country-name"] = lines[lines.length - 1]; // Last line is the country name
                etsyAddress["city"] = lines[lines.length - 2]; // Second last line is the city
                etsyAddress["zip"] = lines[lines.length - 3]; // Third last line is the zip

                for (let i = 1; i < lines.length - 3; i++) {
                    if (!etsyAddress["first-line"]) {
                        etsyAddress["first-line"] = lines[i];
                    } else if (!etsyAddress["second-line"]) {
                        etsyAddress["second-line"] = lines[i];
                    } else {
                        etsyAddress[`line-${i}`] = lines[i];
                    }
                }
            }

            order.orderId = el.querySelector('.side .widget .order-info .info-item:nth-child(1) .info-value').textContent;
            order.address = etsyAddress;
            order.website = "ebay";

            return order;
        });
        message.website = "ebay";
    }




    if (orders.length === 0) {
        message.error = "no_orders_found";
        return message;
    }
    message.success = true;
    message.orders = orders;
    return message;
}

function formatDestination(dest) {
    const fields = ["name", "first-line", "second-line", "third-line"];
    const seenValues = new Set();
    const values = [];

    const zip = dest["zip"] ? dest["zip"].trim() : '';
    const city = dest["city"] ? capitalizeFirstLetter(dest["city"].trim()) : '';
    const zipCityRegex = new RegExp(`(${zip}\\s*${city}|${city}\\s*${zip})`, 'i');

    fields.forEach(field => {
        if (dest[field]) {
            let fieldValue = dest[field];
            if (field !== "name") {
                fieldValue = fieldValue.replace(zipCityRegex, '').trim();
            }
            const lowerValue = fieldValue.toLowerCase();
            if (!seenValues.has(lowerValue) && fieldValue) {
                seenValues.add(lowerValue);
                values.push(capitalizeFirstLetter(fieldValue));
            }
        }
    });

    const zipCity = zip === city ? zip : `${zip} ${city}`.trim();
    if (zipCity) {
        const lowerZipCity = zipCity.toLowerCase();
        if (!seenValues.has(lowerZipCity)) {
            seenValues.add(lowerZipCity);
            values.push(zipCity);
        }
    }

    if (dest["state"] && dest["state"].toLowerCase() !== (dest["city"] ? dest["city"].toLowerCase() : '')) {
        const lowerState = dest["state"].toLowerCase();
        if (!seenValues.has(lowerState)) {
            seenValues.add(lowerState);
            values.push(capitalizeFirstLetter(dest["state"]));
        }
    }

    if (dest["country-name"]) {
        const lowerCountryName = dest["country-name"].toLowerCase();
        if (!seenValues.has(lowerCountryName)) {
            seenValues.add(lowerCountryName);
            values.push(capitalizeFirstLetter(dest["country-name"]));
        }
    }

    return values.join('<br>');
}

function copyToClipboard(text, element) {
    navigator.clipboard.writeText(text).then(() => {
        element.classList.add('copied');
        setTimeout(() => {
            element.classList.remove('copied');
        }, 500);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
}
