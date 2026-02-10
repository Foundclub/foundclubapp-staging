const fs = require('fs');

const filePath = 'd:\\App\\fc\\app\\src\\views\\league\\match\\MatchCenterScreen.js';

try {
    const buffer = fs.readFileSync(filePath);
    const content = buffer.toString('utf8');

    // 1. DUMP AROUND KNOWN PIN LOCATION (approx index 37800)
    // Detailed search for LocationIcon usage
    const pinIndex = content.indexOf('LocationIcon');
    // Find the SECOND usage (active code), first is import
    const secondIndex = content.indexOf('LocationIcon', pinIndex + 50);
    
    if (secondIndex !== -1) {
        console.log(`\n--- Context around Pin at ${secondIndex} ---`);
        console.log(content.slice(secondIndex - 100, secondIndex + 1000));
    } else {
        console.log("Second LocationIcon usage not found.");
    }
    
} catch (err) {
    console.error('Error:', err);
}
