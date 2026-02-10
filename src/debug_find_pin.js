const fs = require('fs');

const filePath = 'd:\\App\\fc\\app\\src\\views\\league\\match\\MatchCenterScreen.js';

try {
    const buffer = fs.readFileSync(filePath);
    const content = buffer.toString('utf8'); // We assume it's UTF8ish enough to search
    
    // Pattern: <Text style={{ fontSize: 20, marginBottom: 4 }}>
    // Hex of that string in ASCII: 3c54657874207374796c653d7b7b20666f6e7453697a653a2032302c206d617267696e426f74746f6d3a2034207d7d3e
    
    const searchStr = '<Text style={{ fontSize: 20, marginBottom: 4 }}>';
    let index = content.indexOf(searchStr);
    
    while (index !== -1) {
        console.log(`Found header at index ${index}`);
        // Print next 20 bytes as hex
        const start = index + searchStr.length;
        const end = start + 20;
        const slice = buffer.slice(start, end);
        console.log('Hex after header:', slice.toString('hex'));
        console.log('Text after header:', slice.toString('utf8')); // Might be garbage
        
        index = content.indexOf(searchStr, index + 1);
    }

} catch (err) {
    console.error('Error:', err);
}
