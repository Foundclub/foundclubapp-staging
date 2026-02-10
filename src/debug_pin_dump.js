const fs = require('fs');

const filePath = 'd:\\App\\fc\\app\\src\\views\\league\\match\\MatchCenterScreen.js';

try {
    const buffer = fs.readFileSync(filePath);
    const content = buffer.toString('utf8'); 
    
    const searchStr = '<Text style={{ fontSize: 20, marginBottom: 4 }}>';
    let index = content.indexOf(searchStr);
    
    if (index !== -1) {
        console.log(`Found first match at ${index}`);
        const start = Math.max(0, index - 50);
        const end = Math.min(buffer.length, index + searchStr.length + 50);
        
        const slice = buffer.slice(start, end);
        console.log('--- Context ---');
        console.log(slice.toString('utf8'));
        console.log('--- Hex ---');
        console.log(slice.toString('hex'));
    } else {
        console.log('String not found.');
    }

} catch (err) {
    console.error('Error:', err);
}
