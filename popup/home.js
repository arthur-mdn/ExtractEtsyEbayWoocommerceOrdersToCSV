async function initHome(translations) {
    const countButton = document.getElementById('countButton');
    const details = document.getElementById('details');
    let exportSelect = "fullOrderDetails";

    await chrome.storage.local.get('exportSelect', function (data) {
        if (data.exportSelect) {
            exportSelect = data.exportSelect;
        }
    });

    countButton.textContent = translations.retrieve_orders;

    const style = document.createElement('style');
    style.textContent = `
        ul li::after {
            content: "${translations.copied}";
        }
    `;
    document.head.appendChild(style);

    countButton.addEventListener('click', function () {
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
                            details.textContent = translations[response.error];
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
                                    ${order.website === 'etsy' ? `<i class="fa fa-etsy"></i>` : ''}
                                    ${order.website === 'woocommerce' ? `<i class="fa fa-wordpress"></i>` : ''}
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

                        details.innerHTML = `
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
                        details.textContent = translations.no_orders_found;
                    }
                }
            );
        });
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
        })
    }

    if (url.includes("shop_order")) { // woocommerce
        let ordersElements = document.querySelectorAll('#wpbody #posts-filter .wp-list-table.posts tbody#the-list tr');
        ordersElements = Array.from(ordersElements).filter(el => el.querySelector('td.order_status mark.status-completed')); // Filter only completed orders
        orders = Array.from(ordersElements).map(el => {
            const order = {};
            const addressElement = el.querySelector('td.shipping_address');
            const address = {};

            const descriptionSpans = addressElement.querySelectorAll('span.description');
            descriptionSpans.forEach(span => span.remove());

            let addressText = addressElement.innerText;

            addressText.split(',').forEach((line, index) => {
                address[`line-${index}`] = line.trim();
            });

            // If the last line is a French zip code, add the country name
            const lastLine = address[`line-${Object.keys(address).length - 1}`];
            const frenchZipCodeRegex = /^[0-9]{5}$/;
            const isLastLineFrench = lastLine && lastLine.split(' ').some(part => frenchZipCodeRegex.test(part));

            if (!address["country-name"] && isLastLineFrench) {
                address["country-name"] = "France";
            } else if (!address["country-name"]) {
                address["country-name"] = lastLine;
            }

            // Convert to Etsy-like structure
            const etsyAddress = {};
            Object.keys(address).forEach(key => {
                if (key === "line-0") {
                    etsyAddress["name"] = address[key];
                } else if (key === "line-1") {
                    etsyAddress["first-line"] = address[key];
                } else if (key === "line-2") {
                    const zipCityMatch = address[key].match(/(\d{5})\s(.+)/);
                    if (zipCityMatch) {
                        etsyAddress["zip"] = zipCityMatch[1];
                        etsyAddress["city"] = zipCityMatch[2];
                    } else {
                        etsyAddress["second-line"] = address[key];
                    }
                } else if (key === "line-3") {
                    etsyAddress["third-line"] = address[key];
                } else if (key === "country-name") {
                    etsyAddress["country-name"] = address[key];
                }
            });

            // Remove the line that contains the country name to avoid duplication
            if (etsyAddress["third-line"] && etsyAddress["third-line"].toLowerCase() === etsyAddress["country-name"].toLowerCase()) {
                delete etsyAddress["third-line"];
            } else if (etsyAddress["second-line"] && etsyAddress["second-line"].toLowerCase() === etsyAddress["country-name"].toLowerCase()) {
                delete etsyAddress["second-line"];
            }

            order.orderId = el.querySelector('td.order_number a').getAttribute('data-order-id');
            order.address = etsyAddress;
            order.website = "woocommerce";

            return order;
        });
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
