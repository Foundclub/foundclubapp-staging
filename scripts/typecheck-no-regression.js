/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const tmpDir = path.join(projectRoot, '.tmp');
const baselinePath = path.join(projectRoot, '.ci', 'typecheck-baseline.json');
const typecheckCommand = ['npx', '-p', 'typescript', 'tsc', '--allowJs', '--noEmit', '-p', 'jsconfig.json'];

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const writeUtf8 = (filePath, content) => {
  fs.writeFileSync(filePath, content, { encoding: 'utf8' });
};

const readBaseline = () => {
  if (!fs.existsSync(baselinePath)) {
    throw new Error(`Missing baseline file: ${path.relative(projectRoot, baselinePath)}`);
  }

  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const maxErrors = Number.parseInt(baseline.maxErrors, 10);
  if (!Number.isFinite(maxErrors) || maxErrors < 0) {
    throw new Error('Invalid baseline: "maxErrors" must be a non-negative integer');
  }
  return { ...baseline, maxErrors };
};

const runTypecheck = () => {
  const result = spawnSync(typecheckCommand[0], typecheckCommand.slice(1), {
    cwd: projectRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  const totalErrors = (output.match(/error TS\d+:/g) || []).length;

  return {
    exitCode: typeof result.status === 'number' ? result.status : 1,
    output,
    totalErrors,
  };
};

const run = () => {
  ensureDir(tmpDir);

  const baseline = readBaseline();
  const { exitCode, output, totalErrors } = runTypecheck();
  const delta = totalErrors - baseline.maxErrors;
  const isRegression = delta > 0;

  if (totalErrors === 0 && exitCode !== 0) {
    throw new Error('Typecheck failed without parseable TS errors. Investigate command execution.');
  }

  const result = {
    baselineMaxErrors: baseline.maxErrors,
    command: typecheckCommand.join(' '),
    createdAt: new Date().toISOString(),
    delta,
    isRegression,
    totalErrors,
    typecheckExitCode: exitCode,
  };

  const resultPath = path.join(tmpDir, 'typecheck-no-regression.json');
  const logPath = path.join(tmpDir, 'typecheck.log');
  writeUtf8(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  writeUtf8(logPath, output);

  console.log(`typecheck-no-regression: baseline=${baseline.maxErrors} current=${totalErrors} delta=${delta}`);
  console.log(`typecheck-no-regression: result=${path.relative(projectRoot, resultPath).replace(/\\/g, '/')}`);

  if (isRegression) {
    console.error('TypeScript error count increased above baseline.');
    process.exit(1);
  }
};

run();
