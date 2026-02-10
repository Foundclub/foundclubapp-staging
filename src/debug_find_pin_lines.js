const fs = require('fs');

const filePath = 'd:\\App\\fc\\app\\src\\views\\league\\match\\MatchCenterScreen.js';

try {
    const buffer = fs.readFileSync(filePath);
    const content = buffer.toString('utf8');
    const lines = content.split('\n');

    let count = 0;
    lines.forEach((line, index) => {
        if (line.includes('LocationIcon')) {
            count++;
            if (count > 1) { // Skip import
                console.log(`\n--- Usage Found at Line ${index + 1} ---`);
                console.log(`${index + 1}: ${line.trim()}`);
                // Print next 20 lines
                for (let i = 1; i <= 20; i++) {
                    if (index + i < lines.length) {
                        console.log(`${index + 1 + i}: ${lines[index + i].trim()}`);
                    }
                }
            }
        }
    });

} catch (err) {
    console.error('Error:', err);
}
