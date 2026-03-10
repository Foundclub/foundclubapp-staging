/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const tmpDir = path.join(projectRoot, '.tmp');
const baselinePath = path.join(projectRoot, '.ci', 'lint-baseline.json');
const lintCommand = ['npx', 'eslint', '.', '-f', 'json'];

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

  const rawBaseline = fs.readFileSync(baselinePath, 'utf8').replace(/^\uFEFF/, '');
  const baseline = JSON.parse(rawBaseline);
  const maxErrors = Number.parseInt(baseline.maxErrors, 10);
  const maxWarnings = Number.parseInt(baseline.maxWarnings, 10);

  if (!Number.isFinite(maxErrors) || maxErrors < 0) {
    throw new Error('Invalid baseline: "maxErrors" must be a non-negative integer');
  }
  if (!Number.isFinite(maxWarnings) || maxWarnings < 0) {
    throw new Error('Invalid baseline: "maxWarnings" must be a non-negative integer');
  }

  return { ...baseline, maxErrors, maxWarnings };
};

const parseEslintJson = (output) => {
  const start = output.indexOf('[');
  const end = output.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Unable to parse ESLint JSON output');
  }
  const jsonSlice = output.slice(start, end + 1);
  return JSON.parse(jsonSlice);
};

const runLint = () => {
  const result = spawnSync(lintCommand[0], lintCommand.slice(1), {
    cwd: projectRoot,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    maxBuffer: 1024 * 1024 * 50,
  });

  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  const output = `${stdout}${stderr}`;

  const report = parseEslintJson(stdout || output);
  const counts = report.reduce(
    (acc, fileResult) => {
      acc.errorCount += fileResult.errorCount || 0;
      acc.warningCount += fileResult.warningCount || 0;
      return acc;
    },
    { errorCount: 0, warningCount: 0 }
  );

  return {
    exitCode: typeof result.status === 'number' ? result.status : 1,
    output,
    ...counts,
  };
};

const run = () => {
  ensureDir(tmpDir);

  const baseline = readBaseline();
  const lint = runLint();

  const errorDelta = lint.errorCount - baseline.maxErrors;
  const warningDelta = lint.warningCount - baseline.maxWarnings;
  const isRegression = errorDelta > 0 || warningDelta > 0;

  const result = {
    baselineMaxErrors: baseline.maxErrors,
    baselineMaxWarnings: baseline.maxWarnings,
    command: lintCommand.join(' '),
    createdAt: new Date().toISOString(),
    currentErrors: lint.errorCount,
    currentWarnings: lint.warningCount,
    errorDelta,
    warningDelta,
    isRegression,
    lintExitCode: lint.exitCode,
  };

  const resultPath = path.join(tmpDir, 'lint-no-regression.json');
  const logPath = path.join(tmpDir, 'lint.log');
  writeUtf8(resultPath, `${JSON.stringify(result, null, 2)}\n`);
  writeUtf8(logPath, lint.output);

  console.log(`lint-no-regression: baselineErrors=${baseline.maxErrors} currentErrors=${lint.errorCount} deltaErrors=${errorDelta}`);
  console.log(`lint-no-regression: baselineWarnings=${baseline.maxWarnings} currentWarnings=${lint.warningCount} deltaWarnings=${warningDelta}`);
  console.log(`lint-no-regression: result=${path.relative(projectRoot, resultPath).replace(/\\/g, '/')}`);

  if (isRegression) {
    console.error('ESLint counts increased above baseline.');
    process.exit(1);
  }
};

run();
