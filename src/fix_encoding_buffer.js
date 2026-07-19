const fs = require('fs');

const filePath = 'd:\\App\\fc\\app\\src\\views\\league\\match\\MatchCenterScreen.js';

try {
  const buffer = fs.readFileSync(filePath);

  // Hex sequences for replacements
  const replacements = [
    // Warning ⚠️ (E2 9A A0 EF B8 8F)
    // Mojibake: â (C3 A2) š (C5 A1) [NBSP] (C2 A0) ï (C3 AF) ¸ (C2 B8) [Control] (C2 8F)
    {
      replace: Buffer.from('e29aa0efb88f', 'hex'),
      search: Buffer.from('c3a2c5a1c2a0c3afc2b8c28f', 'hex'),
    },
    // Fallback for Warning without control char if handled differently
    {
      replace: Buffer.from('e29aa0efb8', 'hex'), // Slightly dangerous if 8F matches next, but 8F is selector
      search: Buffer.from('c3a2c5a1c2a0c3afc2b8', 'hex'),
    },

    // Swords ⚔️ (E2 9A 94 EF B8 8F)
    // Mojibake: â (C3 A2) š (C5 A1) ” (E2 80 9D) ï (C3 AF) ¸ (C2 B8) [Control] (C2 8F)
    {
      replace: Buffer.from('e29a94efb88f', 'hex'),
      search: Buffer.from('c3a2c5a1e2809dc3afc2b8c28f', 'hex'),
    },

    // Pin 📍 (F0 9F 93 CD)
    // Mojibake: ð (C3 B0) Ÿ (C5 B8) “ (E2 80 9C) Í (C3 8D)
    {
      replace: Buffer.from('f09f93cd', 'hex'),
      search: Buffer.from('c3b0c5b8e2809cc38d', 'hex'),
    },

    // Info ℹ️ (E2 84 B9 EF B8 8F)
    // Mojibake: â (C3 A2) „ (E2 80 9E) ¹ (C2 B9) ï (C3 AF) ¸ (C2 B8) [Control] (C2 8F)
    {
      replace: Buffer.from('e284b9efb88f', 'hex'),
      search: Buffer.from('c3a2e2809ec2b9c3afc2b8c28f', 'hex'),
    },

    // Radar 📡 (F0 9F 93 A1)
    // Mojibake: ð (C3 B0) Ÿ (C5 B8) “ (E2 80 9C) ¡ (C2 A1)
    // Check if this one is needed (I thought I fixed it? but grep didn't show it corrupted)
    // Let's verify: grep didn't find "Radar" corrupted, so likely fixed.

    // Down Arrow ▼ (E2 96 BC)
    // Mojibake: â (C3 A2) – (E2 80 93) ¼ (C2 BC)
    {
      replace: Buffer.from('e296bc', 'hex'),
      search: Buffer.from('c3a2e28093c2bc', 'hex'),
    },
  ];

  let newBuffer = buffer;

  // Naive buffer replacement (not efficient but fine for 80KB)
  for (const { replace, search } of replacements) {
    let index = newBuffer.indexOf(search);
    while (index !== -1) {
      console.log(`Found match for ${search.toString('hex')}, replacing...`);
      const before = newBuffer.slice(0, index);
      const after = newBuffer.slice(index + search.length);
      newBuffer = Buffer.concat([before, replace, after]);
      index = newBuffer.indexOf(search, index + replace.length); // Continue searching
    }
  }

  fs.writeFileSync(filePath, newBuffer);
  console.log('Succèssfully formatted binary encoding issues.');
} catch (err) {
  console.error('Error:', err);
}
