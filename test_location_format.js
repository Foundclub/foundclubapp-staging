
const formatLocation = (locationDetails) => {
    if (!locationDetails) return '';

    let address = '';
    let cityFromObj = '';
    let zipFromObj = '';

    try {
        const details = typeof locationDetails === 'string' ? JSON.parse(locationDetails) : locationDetails;

        cityFromObj = details.city || '';
        zipFromObj = details.zipCode || details.postcode || '';

        // Priority 1: Structured data (Clubs format) - if both exist
        if (cityFromObj && zipFromObj) {
            return `${zipFromObj} ${cityFromObj}`;
        }

        address = details.address || '';
    } catch (e) {
        // Fallback: Raw string
        address = typeof locationDetails === 'string' ? locationDetails : '';
    }

    if (!address) {
        if (zipFromObj || cityFromObj) {
            return `${zipFromObj} ${cityFromObj}`.trim();
        }
        return '';
    }

    const cleanAddress = address.trim();

    // Priority 2: "City (Zip)" format (e.g., "Marseille (13001)")
    const cityZipMatch = cleanAddress.match(/^(.*)\s*\((\d{5})\)$/);
    if (cityZipMatch) {
        let cityPart = cityZipMatch[1].trim();
        const zip = cityZipMatch[2];

        // If the "city" part contains a zip code, it's likely a full address with a duplicate zip at the end.
        // In that case, we should let Priority 3 handle it (extracting from the first zip).
        if (!/\d{5}/.test(cityPart)) {
            if (cityPart.startsWith(zip)) {
                return cityPart;
            }
            return `${zip} ${cityPart}`;
        }
    }

    // Priority 3: Extract "Zip City" from string
    const zipMatch = cleanAddress.match(/\d{5}/);
    if (zipMatch) {
        let result = cleanAddress.substring(zipMatch.index).trim();
        const zip = zipMatch[0];
        if (result.endsWith(`(${zip})`)) {
            result = result.replace(`(${zip})`, '').trim();
        }
        return result;
    }

    // Priority 4: If we have city from object but no zip, return city
    if (cityFromObj) {
        return cityFromObj;
    }

    return cleanAddress;
};

const testCases = [
    { input: '{"city": "Paris", "zipCode": "75001"}', expected: "75001 Paris" },
    { input: '{"city": "Lyon", "postcode": "69002"}', expected: "69002 Lyon" },
    { input: '{"address": "123 Rue de la Paix, 75000 Paris"}', expected: "75000 Paris" },
    { input: 'Marseille (13001)', expected: "13001 Marseille" },
    { input: '123 Avenue du Prado, 13008 Marseille', expected: "13008 Marseille" },
    { input: 'Stade de France', expected: "Stade de France" },
    { input: '{"address": "Some Place"}', expected: "Some Place" },
    { input: '89230 City (89230)', expected: "89230 City" },
    { input: null, expected: "" },
    { input: undefined, expected: "" },
    { input: '{"city": "Bordeaux"}', expected: "Bordeaux" },
    { input: '{"zipCode": "33000"}', expected: "33000" },
    { input: 'Route de quelque part, 12345 Ville (12345)', expected: "12345 Ville" },
];

let allPass = true;
testCases.forEach((test, index) => {
    const result = formatLocation(test.input);
    const pass = result === test.expected;
    if (!pass) {
        allPass = false;
        console.log(`Test ${index + 1} FAILED`);
        console.log(`   Input: ${JSON.stringify(test.input)}`);
        console.log(`   Expected: ${test.expected}`);
        console.log(`   Actual:   ${result}`);
    }
});

if (allPass) {
    console.log("All tests passed!");
}
