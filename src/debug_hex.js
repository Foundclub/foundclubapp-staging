const fs = require('fs');
const readline = require('readline');

async function processLineByLine() {
  const fileStream = fs.createReadStream('d:\\App\\fc\\app\\src\\views\\league\\match\\MatchCenterScreen.js');

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  for await (const line of rl) {
    lineCount++;
    if (lineCount === 620) {
      console.log(`Line ${lineCount}: ${line}`);
      const buffer = Buffer.from(line);
      console.log('Hex:', buffer.toString('hex'));
      break;
    }
  }
}

processLineByLine();
