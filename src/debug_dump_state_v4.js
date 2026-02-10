const fs = require('fs');

const filePath = 'd:\\App\\fc\\app\\src\\views\\league\\match\\MatchCenterScreen.js';

try {
    const buffer = fs.readFileSync(filePath);
    const content = buffer.toString('utf8');

    // Search for "if (activeReq.state === 'matched')"
    const matchBlock = content.indexOf("if (activeReq.state === 'matched')");
    
    if (matchBlock !== -1) {
        console.log('\n--- Data Handling Logic ---');
        // Print usage around this block - WIDER range
        console.log(content.slice(matchBlock, matchBlock + 2000));
    } else {
        console.log("Matched block not found via string search");
    }

} catch (err) {
    console.error('Error:', err);
}
