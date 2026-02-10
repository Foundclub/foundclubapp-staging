const fs = require('fs');

const filePath = 'd:\\App\\fc\\app\\src\\views\\league\\match\\MatchCenterScreen.js';

try {
    const buffer = fs.readFileSync(filePath);
    const content = buffer.toString('utf8');

    // 1. STATE DEFINITIONS
    // Look for where generic state is defined
    const useStateBlock = content.indexOf("const [viewState, setViewState]");
    if (useStateBlock !== -1) {
         console.log('\n--- State Definitions ---');
         console.log(content.slice(useStateBlock, useStateBlock + 1000));
    } else {
        console.log("State definition block not found.");
    }

    // 2. DATA HANDLING
    // Look for where we set the match request
    const setReqBlock = content.indexOf("setMatchRequest(activeReq.request)");
    if (setReqBlock !== -1) {
        console.log('\n--- Data Handling (setMatchRequest) ---');
        console.log(content.slice(setReqBlock, setReqBlock + 1000));
    } else {
        console.log("setMatchRequest not found.");
    }
    
    // 3. Look for explicit usage of opponentDetails
    const detailsUsage = content.indexOf("opponentDetails");
    if (detailsUsage !== -1) {
         console.log('\n--- opponentDetails usage ---');
         console.log(content.slice(detailsUsage - 100, detailsUsage + 500));
    } else {
        console.log("opponentDetails string not found in file.");
    }

} catch (err) {
    console.error('Error:', err);
}
