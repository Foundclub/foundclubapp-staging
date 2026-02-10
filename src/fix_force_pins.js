const fs = require('fs');

const filePath = 'd:\\App\\fc\\app\\src\\views\\league\\match\\MatchCenterScreen.js';

try {
    const buffer = fs.readFileSync(filePath);
    const content = buffer.toString('utf8');
    const searchStr = '<Text style={{ fontSize: 20, marginBottom: 4 }}>';
    const closeTag = '</Text>';
    
    let newBuffer = Buffer.concat([buffer]); // clone
    
    // We need to work with the text logic to find indexes, but do replacements on buffer?
    // Mixed encoding makes string indexes unreliable if length differs.
    // BUT the search string is ASCII.
    
    // Let's rely on buffer.indexOf which is binary safe.
    const searchBytes = Buffer.from(searchStr, 'utf8');
    const closeBytes = Buffer.from(closeTag, 'utf8');
    
    let index = newBuffer.indexOf(searchBytes);
    let count = 0;
    
    while (index !== -1) {
        count++;
        // Find closing tag after this Header
        const closeIndex = newBuffer.indexOf(closeBytes, index + searchBytes.length);
        
        if (closeIndex !== -1) {
            console.log(`Match ${count} at ${index}. Closing at ${closeIndex}`);
            
            // Content between header and close
            // We want to replace EVERYTHING between them with the correct emoji
            const emoji = count === 1 ? Buffer.from('f09f93cd', 'hex') : // Pin 📍
                          count === 2 ? Buffer.from('f09f9592', 'hex') : // Clock 🕒
                          Buffer.from('3f', 'hex'); // ?
            
            const before = newBuffer.slice(0, index + searchBytes.length);
            const after = newBuffer.slice(closeIndex);
            
            // Reconstruct
            newBuffer = Buffer.concat([before, emoji, after]);
            
            console.log(`Replaced content for match ${count}`);
            
            // Adjust search for next loop (start searching after the newly inserted emoji)
            // Note: newBuffer changed size, so we can't use old indexes.
            // But since we process creating a NEW buffer each time, we need to be careful.
            // Actually, recursion or re-search is safer.
            
            index = newBuffer.indexOf(searchBytes, index + searchBytes.length + emoji.length);
            continue;
        } else {
            console.log('Closing tag not found for match ' + count);
            break;
        }
        
        index = newBuffer.indexOf(searchBytes, index + 1);
    }
    
    fs.writeFileSync(filePath, newBuffer);
    console.log('Force fixed pins/clocks.');

} catch (err) {
    console.error('Error:', err);
}
