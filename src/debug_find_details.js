const fs = require('fs');

const filePath = 'd:\\App\\fc\\app\\src\\views\\league\\match\\MatchCenterScreen.js';

try {
    const buffer = fs.readFileSync(filePath);
    const content = buffer.toString('utf8');
    
    // Look for "const opponentDetails =" or "let opponentDetails ="
    const regex = /(const|let)\s+opponentDetails\s*=/g;
    
    let match;
    while ((match = regex.exec(content)) !== null) {
        console.log(`Found definition at index ${match.index}`);
        const start = Math.max(0, match.index - 50);
        const end = Math.min(content.length, match.index + 300);
        console.log('--- Context ---');
        console.log(content.slice(start, end));
    }

} catch (err) {
    console.error('Error:', err);
}
