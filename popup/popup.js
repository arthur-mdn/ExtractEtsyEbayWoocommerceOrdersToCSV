
document.addEventListener('DOMContentLoaded', async function () {
    const countButton = document.getElementById('countButton');
    const list = document.createElement('ul');
    const details = document.getElementById('details');

    const lang = 'en';
    const translations = await loadTranslations(lang);
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
                    function: getDestinations
                },
                (results) => {
                    console.log(results);

                    if (results && results[0] && results[0].result) {
                        const destinations = results[0].result;
                        details.innerHTML = '';
                        list.innerHTML = '';

                        let franceDestinations = [];
                        let otherDestinations = [];

                        if (true) { // getCompleteAddress
                            franceDestinations = destinations.filter(dest => dest["country-name"].includes('France'));
                            otherDestinations = destinations.filter(dest => !dest["country-name"].includes('France'));
                            destinations.forEach(dest => {
                                const li = document.createElement('li');
                                li.innerHTML = formatDestination(dest);
                                li.addEventListener('click', () => {
                                    copyToClipboard(li.innerText, li);
                                });
                                list.appendChild(li);
                            });
                        } else { // get only country
                            console.log(destinations)
                            franceDestinations = destinations.filter(dest => dest.includes('France'));
                            otherDestinations = destinations.filter(dest => !dest.includes('France'));
                            destinations.forEach(dest => {
                                const li = document.createElement('li');
                                li.textContent = dest;
                                li.addEventListener('click', () => {
                                    copyToClipboard(li.innerText, li);
                                });
                                list.appendChild(li);
                            });
                        }

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

                        if (list.children.length > 0){
                            const listTitle = document.createElement('h2');
                            listTitle.textContent = translations.destinations;
                            listTitle.style.margin = '0.5rem auto 0 0 ';
                            details.appendChild(listTitle);
                        }
                        details.appendChild(list);

                    } else {
                        result.textContent = translations.no_destinations_found;
                    }
                }
            );
        });
    });
});

async function getDestinations() {
    let destinations = [];
    if (true) { // getCompleteAddress
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
    } else { // get only country
        const destinationButtons = document.querySelectorAll('section[aria-label="orders"] .panel-body .flag .flag-body .col-group .col-md-4 .wt-mt-xs-2 div button[aria-expanded="true"]');
        await destinationButtons.forEach(button => button.click());
        const destinationElements = document.querySelectorAll('section[aria-label="orders"] .panel-body .flag .flag-body .col-group .col-md-4 .wt-mt-xs-2 div .break-word .text-body-smaller:not(.strong) span span span:nth-child(2)');
        console.log(destinationElements)
        destinations = Array.from(destinationElements).map(el => el.textContent.trim());
    }
    return destinations;
}


function formatDestination(dest) {
    const fields = ["name", "first-line", "second-line", "third-line"];
    const seenValues = new Set();
    const values = [];

    // Function to capitalize the first letter of a string
    function capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    // Add standard fields
    fields.forEach(field => {
        if (dest[field]) {
            const lowerValue = dest[field].toLowerCase();
            if (!seenValues.has(lowerValue)) {
                seenValues.add(lowerValue);
                values.push(capitalizeFirstLetter(dest[field]));
            }
        }
    });

    // Combine zip and city if they are not the same
    const zip = dest["zip"] ? dest["zip"].trim() : '';
    const city = dest["city"] ? capitalizeFirstLetter(dest["city"].trim()) : '';
    const zipCity = zip === city ? zip : `${zip} ${city}`.trim();
    if (zipCity) {
        const lowerZipCity = zipCity.toLowerCase();
        if (!seenValues.has(lowerZipCity)) {
            seenValues.add(lowerZipCity);
            values.push(zipCity);
        }
    }

    // Add state if it's not the same as city
    if (dest["state"] && dest["state"].toLowerCase() !== (dest["city"] ? dest["city"].toLowerCase() : '')) {
        const lowerState = dest["state"].toLowerCase();
        if (!seenValues.has(lowerState)) {
            seenValues.add(lowerState);
            values.push(capitalizeFirstLetter(dest["state"]));
        }
    }

    // Add country-name last
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

async function loadTranslations(lang) {
    const response = await fetch(`../lang/${lang}.json`);
    return await response.json();
}
