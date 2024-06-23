async function initHome(translations) {
    const details = document.getElementById('details');

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
                args: []
            },
            async (responses) => {
                if (responses && responses[0] && responses[0].result) {
                    const response = responses[0].result;

                    if (!response.success) {
                        console.log(response)
                        if (response.website) {
                            const website = document.createElement('div');
                            website.classList.add('website');
                            website.innerHTML = `
                                <h3>${translations.website_detected}</h3>
                                <div class="fc g0-25">
                                    ${response.website === 'etsy' ? `<i class="fa-brands fa-etsy fs1-25"></i>` : ''}
                                    ${response.website === 'woocommerce' ? `<i class="fa-brands fa-wordpress fs1-25"></i>` : ''}
                                    ${response.website === 'ebay' ? `<i class="fa-brands fa-ebay fs1-25"></i>` : ''}
                                    ${translations[response.website]}
                                </div>
                            `;
                            details.appendChild(website);
                        }
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

                    let orders = response.orders;

                    // Stocker les commandes en mémoire
                    const storedOrders = await new Promise(resolve => {
                        chrome.storage.local.get('storedOrders', data => resolve(data.storedOrders || []));
                    });

                    let newOrdersCount = 0;
                    let alreadyStoredCount = 0;

                    orders.forEach(order => {
                        const uniqueId = `${order.website}-${order.orderId}`;
                        if (!storedOrders.some(storedOrder => `${storedOrder.website}-${storedOrder.orderId}` === uniqueId)) {
                            storedOrders.push(order);
                            newOrdersCount++;
                        } else {
                            alreadyStoredCount++;
                        }
                    });

                    await new Promise(resolve => {
                        chrome.storage.local.set({ storedOrders }, resolve);
                    });

                    details.innerHTML = '';

                    const website = document.createElement('div');
                    website.classList.add('website');
                    website.innerHTML = `
                        <h3>${orders.length} ${orders.length > 1 ? translations.orders_detected : translations.order_detected} </h3>
                        <div class="fc g0-25">
                            ${response.website === 'etsy' ? `<i class="fa-brands fa-etsy fs1-25"></i>` : ''}
                            ${response.website === 'woocommerce' ? `<i class="fa-brands fa-wordpress fs1-25"></i>` : ''}
                            ${response.website === 'ebay' ? `<i class="fa-brands fa-ebay fs1-25"></i>` : ''}
                            ${translations[response.website]}
                        </div>
                    `;
                    details.appendChild(website);

                    const stats = document.createElement('div');
                    stats.classList.add('stats');
                    stats.innerHTML = `
                        <div class="newly_detected">
                            <i class="fa-solid fa-eye"></i>
                            ${newOrdersCount} ${newOrdersCount > 1 ? translations.new_orders : translations.new_order}
                        </div>
                        <div class="already_detected">
                            <i class="fa-solid fa-eye-slash"></i>
                            ${alreadyStoredCount} ${alreadyStoredCount > 1 ? translations.already_detected_orders : translations.already_detected_order}
                        </div>
                    `;
                    details.appendChild(stats);
                } else {
                    const errorElement = document.createElement('div');
                    errorElement.classList.add('error-message');
                    errorElement.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i>${translations.error_occurred}`;
                    details.appendChild(errorElement);
                }
            }
        );
    });
}

function exportToCSV(orders, filename, exportSelect) {
    let headers = [];
    const rows = orders.map(order => {
        console.log(order)
        const dest = order.address;
        const address = formatAddressForCSV(dest);
        const cityAndZip = formatCityAndZipForCSV(dest);
        if (exportSelect === 'onlyAddress') {
            headers = ["name", "address", "city_and_zip", "country-name"];
            return [
                dest["name"] || '',
                address,
                cityAndZip,
                dest["country-name"] || ''
            ].join(";");
        } else if (exportSelect === 'fullOrderDetails') {
            headers = ["name", "address", "city_and_zip", "country-name", "order-id", "website"];
            return [
                dest["name"] || '',
                address,
                cityAndZip,
                dest["country-name"] || '',
                order.orderId || '',
                order.website || ''
            ].join(";");
        } else if (exportSelect === 'onlyCountry') {
            headers = ["country-name"];
            return [
                dest["country-name"] || ''
            ].join(";");
        }

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
            fieldValue = escapeSpecialCharacters(fieldValue.replace(/[\r\n]+/g, ' ').trim()); // Remove line breaks and escape special characters
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
    const zipCity = zip === city ? zip : `${zip} ${city}`.trim();
    return escapeSpecialCharacters(zipCity.replace(/[\r\n]+/g, ' ').replace(/[^\w\s\-]/g, '').trim()); // Remove line breaks and escape special characters
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function escapeSpecialCharacters(str) {
    return str.replace(/[#]/g, ''); // Escape special characters
}

async function getDestinations() {
    let orders = [];
    let message = {
        success: false,
        orders: [],
        error: 'error_occurred'
    };

    const url = window.location.href;
    const allowedWebsites = ["etsy", "ebay", "wp-admin"];
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

            order.firstDetection = new Date().toISOString();
            order.orderId = el.querySelector('.col-md-8 .col-group a[aria-current="page"]').textContent.replace("#", "");
            order.address = address;
            order.website = "etsy";

            return order;
        });
        message.website = "etsy";
    }

    else if (url.includes("wp-admin") && url.includes("action=edit")) { // WooCommerce order details page
        let ordersElements = document.querySelectorAll('#wpbody .wrap form[name="post"]');
        ordersElements = Array.from(ordersElements).filter(el => !el.querySelector('#postbox-container-2 #woocommerce-order-data .inside input[name="post_status"][value="processing"]')); // Filter only processing orders

        if (ordersElements.length === 0) {
            message.error = "woocommerce_no_orders_found";
            message.website = "woocommerce";
            return message;
        }
        orders = Array.from(ordersElements).map(el => {
            const order = {};
            const addressElement = el.querySelector('#order_data div.address p:nth-child(1)');
            const address = {};

            let addressText = addressElement.innerHTML;

            const lines = addressText.split('<br>').map(line => line.trim());

            // Convert to Etsy-like structure
            const etsyAddress = {};

            if (lines.length > 0) {
                etsyAddress["name"] = lines[0]; // First line is always the name
            }

            const zipCityRegex = /(\d{5})\s*(.+)/; // Regex to detect French zip codes
            const countryRegex = /^[A-Za-z\s]+$/; // Regex to detect country names

            if (lines.length > 1) {
                const lastLine = lines[lines.length - 1];
                const secondLastLine = lines[lines.length - 2];

                // Check if the last line is a country name
                if (countryRegex.test(lastLine)) {
                    etsyAddress["country-name"] = lastLine;

                    // Check if the second last line contains zip and city
                    const zipCityMatch = secondLastLine.match(/(\S+)\s+(.+)/);
                    if (zipCityMatch) {
                        etsyAddress["zip"] = zipCityMatch[1];
                        etsyAddress["city"] = zipCityMatch[2];
                    } else {
                        etsyAddress["zip"] = "";
                        etsyAddress["city"] = secondLastLine;
                    }

                    // Other address lines
                    for (let i = 1; i < lines.length - 2; i++) {
                        if (!etsyAddress["first-line"]) {
                            etsyAddress["first-line"] = lines[i];
                        } else if (!etsyAddress["second-line"]) {
                            etsyAddress["second-line"] = lines[i];
                        } else {
                            etsyAddress[`line-${i}`] = lines[i];
                        }
                    }
                } else {
                    // Case for French addresses or addresses without explicit country name
                    const zipCityMatch = lastLine.match(zipCityRegex);
                    if (zipCityMatch) {
                        etsyAddress["zip"] = zipCityMatch[1];
                        etsyAddress["city"] = zipCityMatch[2];
                        etsyAddress["country-name"] = "France";
                    } else {
                        etsyAddress["zip"] = "";
                        etsyAddress["city"] = lastLine;
                        etsyAddress["country-name"] = lines.length > 2 ? secondLastLine : "France";
                    }

                    // Other address lines
                    for (let i = 1; i < lines.length - 1; i++) {
                        if (!etsyAddress["first-line"]) {
                            etsyAddress["first-line"] = lines[i];
                        } else if (!etsyAddress["second-line"]) {
                            etsyAddress["second-line"] = lines[i];
                        } else {
                            etsyAddress[`line-${i}`] = lines[i];
                        }
                    }
                }
            }

            order.firstDetection = new Date().toISOString();
            order.orderId = el.querySelector('#post_ID').getAttribute('value');
            order.address = etsyAddress;
            order.website = "woocommerce";

            return order;
        });
        message.website = "woocommerce";
    }
    else if (url.includes("wp-admin")) { // WooCommerce Orders list page
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

            const zipCityRegex = /(\d{5})\s*(.+)/; // Regex to detect French zip codes
            const countryRegex = /^[A-Za-z\s]+$/; // Regex to detect country names

            if (lines.length > 1) {
                const lastLine = lines[lines.length - 1];
                const secondLastLine = lines[lines.length - 2];

                // Check if the last line is a country name
                if (countryRegex.test(lastLine)) {
                    etsyAddress["country-name"] = lastLine;

                    // Check if the second last line contains zip and city
                    const zipCityMatch = secondLastLine.match(/(\S+)\s+(.+)/);
                    if (zipCityMatch) {
                        etsyAddress["zip"] = zipCityMatch[1];
                        etsyAddress["city"] = zipCityMatch[2];
                    } else {
                        etsyAddress["zip"] = "";
                        etsyAddress["city"] = secondLastLine;
                    }

                    // Other address lines
                    for (let i = 1; i < lines.length - 2; i++) {
                        if (!etsyAddress["first-line"]) {
                            etsyAddress["first-line"] = lines[i];
                        } else if (!etsyAddress["second-line"]) {
                            etsyAddress["second-line"] = lines[i];
                        } else {
                            etsyAddress[`line-${i}`] = lines[i];
                        }
                    }
                } else {
                    // Case for French addresses or addresses without explicit country name
                    const zipCityMatch = lastLine.match(zipCityRegex);
                    if (zipCityMatch) {
                        etsyAddress["zip"] = zipCityMatch[1];
                        etsyAddress["city"] = zipCityMatch[2];
                        etsyAddress["country-name"] = "France";
                    } else {
                        etsyAddress["zip"] = "";
                        etsyAddress["city"] = lastLine;
                        etsyAddress["country-name"] = lines.length > 2 ? secondLastLine : "France";
                    }

                    // Other address lines
                    for (let i = 1; i < lines.length - 1; i++) {
                        if (!etsyAddress["first-line"]) {
                            etsyAddress["first-line"] = lines[i];
                        } else if (!etsyAddress["second-line"]) {
                            etsyAddress["second-line"] = lines[i];
                        } else {
                            etsyAddress[`line-${i}`] = lines[i];
                        }
                    }
                }
            }

            order.firstDetection = new Date().toISOString();
            order.orderId = el.querySelector('td.order_number a').getAttribute('data-order-id');
            order.address = etsyAddress;
            order.website = "woocommerce";

            return order;
        });
        message.website = "woocommerce";
    }

    else if (url.includes("ebay") && !url.includes("details")) { // eBay but not on order details page
        message.error = "ebay_order_details_required";
        message.website = "ebay";
        return message;
    }
    else if (url.includes("ebay")) { // eBay
        let ordersElements = document.querySelectorAll('.sh-core-page .sh-core-layout__body .wrapper');
        ordersElements = Array.from(ordersElements).filter(el => !el.querySelector('.widget .shipping-info .content .details .tracking-info')); // Filter only orders without shipping number
        if (ordersElements.length === 0) {
            message.error = "ebay_no_orders_found";
            message.website = "ebay";
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

            order.firstDetection = new Date().toISOString();
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
