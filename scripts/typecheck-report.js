/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const tmpDir = path.join(projectRoot, '.tmp');
const typecheckCommand = ['npx', '-p', 'typescript', 'tsc', '--allowJs', '--noEmit', '-p', 'jsconfig.json'];

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const writeUtf8 = (filePath, content) => {
  fs.writeFileSync(filePath, content, { encoding: 'utf8' });
};

const runTypecheck = () => {
  const result = spawnSync(typecheckCommand[0], typecheckCommand.slice(1), {
    cwd: projectRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  return {
    exitCode: typeof result.status === 'number' ? result.status : 1,
    output,
  };
};

const parseErrors = (output) => {
  const lineRegex = /^(src[\\/].+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/;
  const lines = output.split(/\r?\n/);
  const errors = [];

  lines.forEach((line) => {
    const match = line.match(lineRegex);
    if (!match) return;
    errors.push({
      code: match[4],
      column: Number.parseInt(match[3], 10),
      file: match[1].replace(/\\/g, '/'),
      line: Number.parseInt(match[2], 10),
      message: match[5],
    });
  });

  return errors;
};

const countBy = (items, keyName) => (
  items.reduce((acc, item) => {
    const key = item[keyName];
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {})
);

const toSortedEntries = (record) => (
  Object.entries(record)
    .sort((left, right) => right[1] - left[1])
    .map(([key, count]) => ({ count, key }))
);

const run = () => {
  ensureDir(tmpDir);

  const { exitCode, output } = runTypecheck();
  const errors = parseErrors(output);
  const byCode = countBy(errors, 'code');
  const byFile = countBy(errors, 'file');

  const report = {
    byCode: toSortedEntries(byCode),
    byFile: toSortedEntries(byFile),
    command: typecheckCommand.join(' '),
    createdAt: new Date().toISOString(),
    exitCode,
    totalErrors: errors.length,
  };

  const reportPath = path.join(tmpDir, 'typecheck-report.json');
  const logPath = path.join(tmpDir, 'typecheck.log');

  writeUtf8(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  writeUtf8(logPath, output);

  console.log(`typecheck-report: totalErrors=${report.totalErrors} exitCode=${exitCode}`);
  console.log(`typecheck-report: report=${path.relative(projectRoot, reportPath).replace(/\\/g, '/')}`);
  console.log(`typecheck-report: log=${path.relative(projectRoot, logPath).replace(/\\/g, '/')}`);
};

run();
