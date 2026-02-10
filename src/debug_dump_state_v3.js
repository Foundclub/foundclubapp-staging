const fs = require('fs');

const filePath = 'd:\\App\\fc\\app\\src\\views\\league\\match\\MatchCenterScreen.js';

try {
    const buffer = fs.readFileSync(filePath);
    const content = buffer.toString('utf8');

    // Search for "if (activeReq.state === 'matched')"
    const matchBlock = content.indexOf("if (activeReq.state === 'matched')");
    
    if (matchBlock !== -1) {
        console.log('\n--- Data Handling Logic ---');
        // Print usage around this block
        console.log(content.slice(matchBlock, matchBlock + 1000));
    } else {
        console.log("Matched block not found via string search");
    }
    
    // Also look for setMatchRequest usage
    const setReq = content.indexOf("setMatchRequest(activeReq.request);");
    if (setReq !== -1) {
         console.log('\n--- Request Setting ---');
         console.log(content.slice(setReq, setReq + 500));
    }

} catch (err) {
    console.error('Error:', err);
}
