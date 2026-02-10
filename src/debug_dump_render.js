const fs = require('fs');

const filePath = 'd:\\App\\fc\\app\\src\\views\\league\\match\\MatchCenterScreen.js';

try {
    const buffer = fs.readFileSync(filePath);
    const content = buffer.toString('utf8');

    // 1. DUMP AROUND PIN
    // I replaced the pin with <Image ... LocationIcon ...>
    const pinIndex = content.indexOf('LocationIcon');
    if (pinIndex !== -1) {
        console.log('--- Render Logic around Pin ---');
        console.log(content.slice(pinIndex, pinIndex + 500));
    } else {
        console.log('LocationIcon not found in file (maybe previous step failed?)');
        // Fallback to searching for "Zone"
    }

    // 2. SEARCH FOR "Zone"
    const zoneIndex = content.toLowerCase().indexOf('zone');
    if (zoneIndex !== -1) {
        console.log('\n--- Logic for "Zone" ---');
        console.log(content.slice(zoneIndex - 100, zoneIndex + 200));
    }

} catch (err) {
    console.error('Error:', err);
}
