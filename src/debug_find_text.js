const fs = require('fs');

const filePath = 'd:\\App\\fc\\app\\src\\views\\league\\match\\MatchCenterScreen.js';

try {
    const buffer = fs.readFileSync(filePath);
    const content = buffer.toString('utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
        if (line.toLowerCase().includes('inconnue') || line.toLowerCase().includes('standard')) {
            console.log(`Line ${index + 1}: ${line.trim()}`);
        }
    });

} catch (err) {
    console.error('Error:', err);
}
