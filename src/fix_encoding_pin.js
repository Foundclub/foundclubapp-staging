const fs = require('fs');

const filePath = 'd:\\App\\fc\\app\\src\\views\\league\\match\\MatchCenterScreen.js';

try {
  const buffer = fs.readFileSync(filePath);

  // Pin 📍 (F0 9F 93 CD)
  // Mojibake: ð (C3 B0) Ÿ (C5 B8) “ (E2 80 9C) [Control] (C2 8D)
  // Hex from dump: ... e2 80 9c c2 8d ...

  const search = Buffer.from('c3b0c5b8e2809cc28d', 'hex');
  const replace = Buffer.from('f09f93cd', 'hex');

  let newBuffer = buffer;

  const index = newBuffer.indexOf(search);
  if (index !== -1) {
    console.log('Found match for Pin mojibake, replacing...');
    const before = newBuffer.slice(0, index);
    const after = newBuffer.slice(index + search.length);
    newBuffer = Buffer.concat([before, replace, after]);
    fs.writeFileSync(filePath, newBuffer);
    console.log('Succèssfully fixed Pin encoding.');
  } else {
    console.log('Pin mojibake not found.');
  }
} catch (err) {
  console.error('Error:', err);
}
