const fs = require('fs');

const filePath = 'd:\\App\\fc\\app\\src\\views\\league\\match\\MatchCenterScreen.js';

try {
    const buffer = fs.readFileSync(filePath);
    const content = buffer.toString('utf8');

    // 1. Dump State Definitions (start of component)
    const componentStart = content.indexOf('export default function MatchCenterScreen');
    if (componentStart !== -1) {
        console.log('--- Component State Definitions ---');
        console.log(content.slice(componentStart, componentStart + 800)); 
    }

    // 2. Dump fetchMatchData (larger slice)
    const fetchStart = content.indexOf('const fetchMatchData =');
    if (fetchStart !== -1) {
        console.log('\n--- fetchMatchData Logic ---');
        // Slice 4000 chars to likely cover the whole function
        console.log(content.slice(fetchStart, fetchStart + 4000));
    }

} catch (err) {
    console.error('Error:', err);
}
