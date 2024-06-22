async function initHome(translations) {
    const countButton = document.getElementById('countButton');
    const details = document.getElementById('details');
    let getCompleteAdress = "default";

    await chrome.storage.local.get('getCompleteAdress', function (data) {
        getCompleteAdress = data.getCompleteAdress === 'on';
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
                    args: [getCompleteAdress]
                },
                (results) => {
                    if (results && results[0] && results[0].result) {
                        const destinations = results[0].result;
                        details.innerHTML = '';

                        let franceDestinations = [];
                        let otherDestinations = [];

                        franceDestinations = destinations.filter(dest => dest["country-name"].includes('France'));
                        otherDestinations = destinations.filter(dest => !dest["country-name"].includes('France'));
                        const list = document.createElement('ul');

                        destinations.forEach(dest => {
                            const li = document.createElement('li');
                            li.innerHTML = formatDestination(dest);
                            li.addEventListener('click', () => {
                                copyToClipboard(li.innerText, li);
                            });
                            list.appendChild(li);
                        });

                        const franceCount = franceDestinations.length;
                        const otherCount = otherDestinations.length;

                        details.innerHTML = `
                            <div class="counter">
                                <h3>${translations.total_orders}</h3>
                                <h1>${destinations.length}</h1>
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

                        if (list.children.length > 0) {
                            const listTitle = document.createElement('h2');
                            listTitle.textContent = translations.destinations;
                            listTitle.style.margin = '0.5rem auto 0 0 ';
                            details.appendChild(listTitle);
                        }
                        details.appendChild(list);

                        if (destinations.length > 0) {
                            const exportButton = document.createElement('button');
                            exportButton.classList.add('export-btn');
                            exportButton.innerHTML = `
                                <i class="fa fa-download"></i>
                                ${translations.export_csv}
                            `
                            exportButton.addEventListener('click', () => {
                                exportToCSV(destinations, translations.csv_filename);
                            });
                            details.appendChild(exportButton);
                        }

                    } else {
                        details.textContent = translations.no_destinations_found;
                    }
                }
            );
        });
    });
}

function exportToCSV(destinations, filename) {
    const headers = ["name", "address", "city_and_zip", "country-name"];
    const rows = destinations.map(dest => {
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



async function getDestinations(getCompleteAdress) {
    let destinations = [];
    if (getCompleteAdress) {
        const destinationButtons = document.querySelectorAll('section[aria-label="orders"] .panel-body .flag .flag-body .col-group .col-md-4 .wt-mt-xs-2 div button[aria-expanded="false"]');
        await destinationButtons.forEach(button => button.click());
        const destinationElements = document.querySelectorAll('section[aria-label="orders"] .panel-body .flag .flag-body .col-group .col-md-4 .wt-mt-xs-2 div .address.break-word p');
        destinations = Array.from(destinationElements).map(el => {
            const spans = el.querySelectorAll('span');
            const destination = {};
            spans.forEach(span => {
                destination[span.className] = span.textContent.trim();
            });
            return destination;
        });
    } else {
        const destinationButtons = document.querySelectorAll('section[aria-label="orders"] .panel-body .flag .flag-body .col-group .col-md-4 .wt-mt-xs-2 div button[aria-expanded="true"]');
        await destinationButtons.forEach(button => button.click());
        const destinationElements = document.querySelectorAll('section[aria-label="orders"] .panel-body .flag .flag-body .col-group .col-md-4 .wt-mt-xs-2 div .break-word .text-body-smaller:not(.strong) span span span:nth-child(2)');
        destinations = Array.from(destinationElements).map(el => {
            return {
                "country-name": el.textContent.trim()
            };
        })
    }
    return destinations;
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
