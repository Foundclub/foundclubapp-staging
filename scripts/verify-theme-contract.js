/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(projectRoot, 'src');

const colorsFile = path.join(srcRoot, 'theme', 'colors.js');
const fontsFile = path.join(srcRoot, 'theme', 'fonts.js');
const applicationStyleFile = path.join(srcRoot, 'theme', 'applicationStyle.js');
const alignmentsFile = path.join(srcRoot, 'theme', 'alignements.js');
const buttonStyleFile = path.join(srcRoot, 'theme', 'components', 'buttonStyle.js');
const navigationStyleFile = path.join(srcRoot, 'theme', 'components', 'navigationStyle.js');
const hexAllowlistFile = path.join(projectRoot, 'scripts', 'theme-hex-allowlist.json');

const noHexFiles = [
  'src/components/molecules/searchBar/SearchBar.js',
  'src/components/molecules/segmentedControl/SegmentedControl.js',
  'src/components/atoms/league/LeagueCard.js',
  'src/components/organisms/league/CompetitiveHero.js',
  'src/components/organisms/league/SearchCountdown.js',
];

const refRegexByType = {
  Alignments: /\bAlignments\.([A-Za-z0-9_]+)/g,
  ApplicationStyle: /\bApplicationStyle\.([A-Za-z0-9_]+)/g,
  Colors: /\bColors\.([A-Za-z0-9_]+)/g,
  Fonts: /\bFonts\.([A-Za-z0-9_]+)/g,
};

const fileExtRegex = /\.(js|jsx|ts|tsx)$/;
const ignoreDirs = new Set([
  'assets',
  'node_modules',
  'theme',
]);

const read = (filePath) => fs.readFileSync(filePath, 'utf8');
const normalizePath = (value) => value.replace(/\\/g, '/');

const getBlockContent = (source, startToken) => {
  const start = source.indexOf(startToken);
  if (start < 0) return '';
  const fromStart = source.slice(start);
  const firstBrace = fromStart.indexOf('{');
  if (firstBrace < 0) return '';
  let depth = 0;
  let end = -1;
  for (let i = firstBrace; i < fromStart.length; i += 1) {
    const ch = fromStart[i];
    if (ch === '{') depth += 1;
    if (ch === '}') depth -= 1;
    if (depth === 0) {
      end = i;
      break;
    }
  }
  if (end < 0) return '';
  return fromStart.slice(firstBrace + 1, end);
};

const getObjectKeys = (blockContent) => {
  const keys = new Set();
  const keyRegex = /^\s*([A-Za-z0-9_]+):\s*/gm;
  let match = keyRegex.exec(blockContent);
  while (match !== null) {
    keys.add(match[1]);
    match = keyRegex.exec(blockContent);
  }
  return keys;
};

const resolveKnownTokens = () => {
  const colorsSource = read(colorsFile);
  const fontsSource = read(fontsFile);
  const appStyleSource = read(applicationStyleFile);
  const alignmentsSource = read(alignmentsFile);
  const buttonStyleSource = read(buttonStyleFile);
  const navigationStyleSource = read(navigationStyleFile);

  const colorKeys = getObjectKeys(getBlockContent(colorsSource, 'export const colors ='));
  const fontKeys = getObjectKeys(getBlockContent(fontsSource, 'export const staticFontStyle ='));
  colorKeys.forEach((key) => fontKeys.add(key));

  const alignmentKeys = getObjectKeys(getBlockContent(alignmentsSource, 'const alignements ='));

  const appKeys = getObjectKeys(getBlockContent(appStyleSource, 'export const staticStyle ='));
  getObjectKeys(getBlockContent(appStyleSource, 'const componentPrimitives =')).forEach((key) => appKeys.add(key));
  getObjectKeys(getBlockContent(buttonStyleSource, 'const getStyle =')).forEach((key) => appKeys.add(key));
  getObjectKeys(getBlockContent(navigationStyleSource, 'export default (colors) =>')).forEach((key) => appKeys.add(key));
  ['backgroundColor', 'borderColor', 'darkNavigationTheme', 'lightNavigationTheme', 'tintColor'].forEach((key) => appKeys.add(key));

  return {
    Alignments: alignmentKeys,
    ApplicationStyle: appKeys,
    Colors: colorKeys,
    Fonts: fontKeys,
  };
};

const collectSourceFiles = (dir) => {
  const output = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!ignoreDirs.has(entry.name)) {
        output.push(...collectSourceFiles(fullPath));
      }
      return;
    }
    if (entry.isFile() && fileExtRegex.test(entry.name)) {
      output.push(fullPath);
    }
  });
  return output;
};

const findUnknownRefs = (files, knownByType) => {
  const violations = [];
  files.forEach((filePath) => {
    const relPath = path.relative(projectRoot, filePath).replace(/\\/g, '/');
    const lines = read(filePath).split(/\r?\n/);
    lines.forEach((line, index) => {
      Object.entries(refRegexByType).forEach(([type, regex]) => {
        const lineRegex = new RegExp(regex.source, regex.flags);
        let match = lineRegex.exec(line);
        while (match !== null) {
          const token = match[1];
          if (!knownByType[type].has(token)) {
            violations.push({
              file: relPath,
              line: index + 1,
              token,
              type,
            });
          }
          match = lineRegex.exec(line);
        }
      });
    });
  });
  return violations;
};

const findHexViolations = () => {
  const violations = [];
  const hexRegex = /#[0-9A-Fa-f]{3,8}/g;
  noHexFiles.forEach((relPath) => {
    const absPath = path.join(projectRoot, relPath);
    const source = read(absPath);
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      hexRegex.lastIndex = 0;
      if (hexRegex.test(line)) {
        violations.push({
          file: relPath,
          line: index + 1,
          value: line.trim(),
        });
      }
    });
  });
  return violations;
};

const loadHexAllowlist = () => {
  if (!fs.existsSync(hexAllowlistFile)) return new Set();
  const raw = JSON.parse(read(hexAllowlistFile));
  if (!Array.isArray(raw)) return new Set();
  return new Set(raw.map((item) => normalizePath(String(item))));
};

const findHexFileViolations = (files, allowlist) => {
  const hexRegex = /#[0-9A-Fa-f]{3,8}/;
  return files
    .map((filePath) => normalizePath(path.relative(projectRoot, filePath)))
    .filter((relPath) => {
      const source = read(path.join(projectRoot, relPath));
      return hexRegex.test(source) && !allowlist.has(relPath);
    })
    .sort();
};

const logViolations = (title, violations, formatter) => {
  if (violations.length === 0) return;
  console.error(`\n${title} (${violations.length})`);
  violations.forEach((violation) => {
    console.error(formatter(violation));
  });
};

const run = () => {
  const knownByType = resolveKnownTokens();
  const sourceFiles = collectSourceFiles(srcRoot);
  const hexAllowlist = loadHexAllowlist();
  const unknownRefs = findUnknownRefs(sourceFiles, knownByType);
  const hexFileViolations = findHexFileViolations(sourceFiles, hexAllowlist);
  const hexViolations = findHexViolations();

  logViolations(
    'Unknown theme token references',
    unknownRefs,
    (item) => `- ${item.file}:${item.line} -> ${item.type}.${item.token}`,
  );
  logViolations(
    'New hex usage in files outside theme allowlist',
    hexFileViolations,
    (item) => `- ${item}`,
  );
  logViolations(
    'Hex color found in protected files',
    hexViolations,
    (item) => `- ${item.file}:${item.line} -> ${item.value}`,
  );

  if (unknownRefs.length > 0 || hexViolations.length > 0 || hexFileViolations.length > 0) {
    process.exit(1);
  }

  console.log('verify-theme-contract: OK');
  console.log(`- files scanned: ${sourceFiles.length}`);
  console.log(`- colors: ${knownByType.Colors.size}`);
  console.log(`- fonts: ${knownByType.Fonts.size}`);
  console.log(`- application styles: ${knownByType.ApplicationStyle.size}`);
  console.log(`- alignments: ${knownByType.Alignments.size}`);
};

run();
