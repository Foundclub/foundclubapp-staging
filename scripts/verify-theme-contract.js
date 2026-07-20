/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const srcRoot = path.join(projectRoot, 'src');

const colorsFile = path.join(srcRoot, 'theme', 'colors.js');
const fontsFile = path.join(srcRoot, 'theme', 'fonts.js');
const spacesFile = path.join(srcRoot, 'theme', 'spaces.js');
const applicationStyleFile = path.join(srcRoot, 'theme', 'applicationStyle.js');
const alignmentsFile = path.join(srcRoot, 'theme', 'alignements.js');
const buttonStyleFile = path.join(srcRoot, 'theme', 'components', 'buttonStyle.js');
const navigationStyleFile = path.join(srcRoot, 'theme', 'components', 'navigationStyle.js');
const hexAllowlistFile = path.join(projectRoot, 'scripts', 'theme-hex-allowlist.json');
const baselineFile = path.join(projectRoot, '.ci', 'theme-contract-baseline.json');

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

/**
 * Rampe Spaces reellement exposee : un index absent rend `undefined`,
 * et React Native ignore alors le style SANS aucune erreur.
 * @returns {{sizes: Set<string>, types: Set<string>}} - Index et types valides.
 */
const resolveSpacesContract = () => {
  const spacesSource = read(spacesFile);
  return {
    sizes: getObjectKeys(getBlockContent(spacesSource, 'export const sizes =')),
    types: getObjectKeys(getBlockContent(spacesSource, 'export const types =')),
  };
};

/**
 * Table hex -> nom de jeton, pour reconnaitre une couleur du theme
 * ecrite en rgb()/rgba() (qui echappe totalement au controle hexadecimal).
 * @returns {Map<string, string>} - Hex minuscule -> nom du jeton.
 */
const resolveColorLookup = () => {
  const colorsSource = read(colorsFile);
  const block = getBlockContent(colorsSource, 'export const colors =');
  const lookup = new Map();
  const entryRegex = /^\s*([A-Za-z0-9_]+):\s*'(#[0-9A-Fa-f]{6})'/gm;
  let match = entryRegex.exec(block);
  while (match !== null) {
    const [, token, hex] = match;
    const value = hex.toLowerCase();
    if (!lookup.has(value)) lookup.set(value, token);
    match = entryRegex.exec(block);
  }
  return lookup;
};

const rgbToHex = (r, g, b) => `#${[r, g, b]
  .map((part) => Math.round(part).toString(16).padStart(2, '0'))
  .join('')}`;

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

const toRelative = (filePath) => normalizePath(path.relative(projectRoot, filePath));

const findUnknownRefs = (files, knownByType) => {
  const violations = [];
  files.forEach((filePath) => {
    const relPath = toRelative(filePath);
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
              message: `${type}.${token}`,
            });
          }
          match = lineRegex.exec(line);
        }
      });
    });
  });
  return violations;
};

/**
 * Regle (b) : index invalides de la rampe Spaces.
 * `Spaces.paddingVertical[10]` rend `undefined` -> le style est perdu en silence.
 * @param {string[]} files - Fichiers sources a scanner.
 * @param {{sizes: Set<string>, types: Set<string>}} spacesContract - Rampe valide.
 * @returns {{file: string, line: number, message: string}[]} - Constats.
 */
const findSpacesViolations = (files, spacesContract) => {
  const violations = [];
  const spaceRegex = /\bSpaces\.([A-Za-z0-9_]+)\s*\[\s*(\d+)\s*\]/g;
  const ramp = [...spacesContract.sizes].sort((a, b) => Number(a) - Number(b)).join('/');
  const knownTypes = [...spacesContract.types].join(', ');
  files.forEach((filePath) => {
    const relPath = toRelative(filePath);
    const lines = read(filePath).split(/\r?\n/);
    lines.forEach((line, index) => {
      spaceRegex.lastIndex = 0;
      let match = spaceRegex.exec(line);
      while (match !== null) {
        const [, type, size] = match;
        if (!spacesContract.types.has(type)) {
          violations.push({
            file: relPath,
            line: index + 1,
            message: `Spaces.${type} n'existe pas (types: ${knownTypes})`,
          });
        } else if (!spacesContract.sizes.has(size)) {
          violations.push({
            file: relPath,
            line: index + 1,
            message: `Spaces.${type}[${size}] hors rampe -> undefined (rampe: ${ramp})`,
          });
        }
        match = spaceRegex.exec(line);
      }
    });
  });
  return violations;
};

/**
 * Regle (a) : couleurs ecrites en rgb()/rgba().
 * Le controle hexadecimal ne les voit pas, donc `rgba(1, 179, 244, 0.14)`
 * (qui EST primary500) passait sans alerte. Meme politique que l'hex :
 * l'allowlist de fichiers vaut exemption, et `withAlpha()` est l'alternative legitime.
 * @param {string[]} files - Fichiers sources a scanner.
 * @param {Set<string>} allowlist - Fichiers exemptes (dette connue).
 * @param {Map<string, string>} colorLookup - Hex -> jeton, pour nommer la couleur.
 * @returns {{file: string, line: number, message: string}[]} - Constats.
 */
const findRgbViolations = (files, allowlist, colorLookup) => {
  const violations = [];
  const rgbRegex = /\brgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([0-9.]+)\s*)?\)/g;
  files.forEach((filePath) => {
    const relPath = toRelative(filePath);
    if (allowlist.has(relPath)) return;
    const lines = read(filePath).split(/\r?\n/);
    lines.forEach((line, index) => {
      rgbRegex.lastIndex = 0;
      let match = rgbRegex.exec(line);
      while (match !== null) {
        const [literal, r, g, b, alpha] = match;
        const hex = rgbToHex(Number(r), Number(g), Number(b));
        const token = colorLookup.get(hex);
        const hint = token
          ? `= Colors.${token} -> withAlpha(Colors.${token}, ${alpha === undefined ? 1 : alpha})`
          : `${hex} hors jetons -> passer par un jeton + withAlpha()`;
        violations.push({
          file: relPath,
          line: index + 1,
          message: `${literal} ${hint}`,
        });
        match = rgbRegex.exec(line);
      }
    });
  });
  return violations;
};

/**
 * Regle (c) — decision Adel 2026-07-17 : primary900 est la SEULE encre legitime
 * sur un fond primary500. Blanc sur primary500 ~ 2,4:1 (echec WCAG AA).
 * On signale toute encre claire a proximite d'un fond primary500.
 */
const inkOnPrimaryWindow = 4;
const primaryBackgroundRegex = /(backgroundColor\s*:\s*[^,;\n]*primary500|backgroundColor\.primary500|buttonPrimary(?:Option)?\b)/;
const lightInkRegex = /(\bneutral00\b|\bprimary100\b|['"]white['"]|#fff(?:fff)?\b)/i;
// L'encre, c'est le texte et les icones : `color` et `tintColor` uniquement.
// `backgroundColor` / `borderColor` sont volontairement exclus (un liset blanc
// sur primary500 n'est pas un probleme de lisibilite), sinon la regle crie a tort.
const inkAssignmentRegex = /(?:^|[^A-Za-z])(?:tintC|c)olor\s*:\s*([^,;}\n]+)/g;
const inkFontRegex = /Fonts\.(?:neutral00|primary100)\b/;

const getLightInkHit = (line) => {
  if (inkFontRegex.test(line)) return line.trim().slice(0, 80);
  inkAssignmentRegex.lastIndex = 0;
  let match = inkAssignmentRegex.exec(line);
  while (match !== null) {
    if (lightInkRegex.test(match[1])) return match[0].trim().slice(0, 80);
    match = inkAssignmentRegex.exec(line);
  }
  return null;
};

const findInkOnPrimaryViolations = (files) => {
  const violations = [];
  files.forEach((filePath) => {
    const relPath = toRelative(filePath);
    const lines = read(filePath).split(/\r?\n/);
    lines.forEach((line, index) => {
      if (!primaryBackgroundRegex.test(line)) return;
      const from = Math.max(0, index - inkOnPrimaryWindow);
      const to = Math.min(lines.length - 1, index + inkOnPrimaryWindow);
      lines.slice(from, to + 1).forEach((candidate, offset) => {
        const hit = getLightInkHit(candidate);
        if (!hit) return;
        violations.push({
          file: relPath,
          line: from + offset + 1,
          message: `encre claire (${hit}) pres d'un fond primary500 `
            + `ligne ${index + 1} -> primary900 attendu`,
        });
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
          message: line.trim(),
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

/**
 * Entrees d'allowlist qui ne correspondent plus a un fichier existant,
 * ou dont le fichier n'a plus NI hex NI rgb()/rgba() : elles doivent sortir.
 *
 * L'allowlist protege les deux familles de litteraux (hex ET rgb) : un fichier
 * qui n'a plus de hex mais garde des rgba() n'est PAS perime — le retirer
 * ferait regresser le compteur rgbLiterals (constat du 2026-07-20).
 * @param {Set<string>} allowlist - Entrees courantes de l'allowlist.
 * @returns {{file: string, message: string}[]} - Entrees perimees.
 */
const findStaleAllowlistEntries = (allowlist) => {
  const hexRegex = /#[0-9A-Fa-f]{3,8}/;
  const rgbRegex = /rgba?\(/;
  const stale = [];
  allowlist.forEach((relPath) => {
    const absPath = path.join(projectRoot, relPath);
    if (!fs.existsSync(absPath)) {
      stale.push({ file: relPath, message: 'fichier absent' });
      return;
    }
    const contenu = read(absPath);
    if (!hexRegex.test(contenu) && !rgbRegex.test(contenu)) {
      stale.push({ file: relPath, message: 'plus aucun hex ni rgb : entree a retirer' });
    }
  });
  return stale;
};

const findHexFileViolations = (files, allowlist) => {
  const hexRegex = /#[0-9A-Fa-f]{3,8}/;
  return files
    .map((filePath) => toRelative(filePath))
    .filter((relPath) => {
      const source = read(path.join(projectRoot, relPath));
      return hexRegex.test(source) && !allowlist.has(relPath);
    })
    .sort()
    .map((relPath) => ({ file: relPath, message: 'hex hors allowlist' }));
};

const readBaseline = () => {
  if (!fs.existsSync(baselineFile)) return { rules: {} };
  const raw = read(baselineFile).replace(/^\uFEFF/, '');
  const parsed = JSON.parse(raw);
  return { rules: {}, ...parsed };
};

const defaultBaselineNote = [
  'Plafond par regle du contrat de theme.',
  'Cliquet : les compteurs ne doivent JAMAIS monter.',
  'Quand un lot resorbe des constats, relancer avec --update-baseline pour resserrer.',
  'Une porte rouge en permanence ne protege rien.',
].join(' ');

/**
 * Ecrit les plafonds courants dans .ci/theme-contract-baseline.json.
 * @param {Record<string, number>} counts - Nombre de constats par regle.
 * @param {{note?: string}} previous - Baseline precedente (sa note est conservee).
 * @returns {void}
 */
const writeBaseline = (counts, previous) => {
  fs.mkdirSync(path.dirname(baselineFile), { recursive: true });
  const payload = {
    maxByRule: counts,
    // La note posee a la main dans le fichier est preservee : elle porte le contexte
    // du lot qui a fixe les plafonds, et se perdrait a chaque rebase automatique.
    note: previous.note || defaultBaselineNote,
    source: 'npm run verify:theme-contract',
    updatedAt: new Date().toISOString().slice(0, 10),
  };
  fs.writeFileSync(baselineFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const rules = [
  {
    blocking: true,
    id: 'unknownTokens',
    title: 'Jetons de theme inconnus',
  },
  {
    blocking: true,
    id: 'hexOutsideAllowlist',
    title: 'Hex hors allowlist',
  },
  {
    blocking: true,
    id: 'hexInProtectedFiles',
    title: 'Hex dans un fichier protege',
  },
  {
    blocking: true,
    id: 'rgbLiterals',
    title: 'Couleurs en rgb()/rgba() (utiliser withAlpha)',
  },
  {
    blocking: true,
    id: 'spacesOutOfRamp',
    title: 'Index hors rampe Spaces (style perdu en silence)',
  },
  {
    blocking: true,
    id: 'inkOnPrimary500',
    title: 'Encre claire sur fond primary500 (primary900 attendu)',
  },
  {
    // NON bloquant, volontairement : une entree devient perimee quand quelqu'un
    // NETTOIE le hex d'un fichier. Faire echouer la porte la-dessus punirait
    // exactement le comportement qu'on veut encourager. C'est un rappel d'hygiene.
    blocking: false,
    id: 'staleAllowlist',
    title: 'Entrees perimees dans theme-hex-allowlist.json (a retirer, non bloquant)',
  },
];

const run = () => {
  const shouldUpdateBaseline = process.argv.includes('--update-baseline');
  const isVerbose = process.argv.includes('--verbose');
  const isStrict = process.argv.includes('--strict');

  const knownByType = resolveKnownTokens();
  const spacesContract = resolveSpacesContract();
  const colorLookup = resolveColorLookup();
  const sourceFiles = collectSourceFiles(srcRoot);
  const hexAllowlist = loadHexAllowlist();

  const findingsByRule = {
    hexInProtectedFiles: findHexViolations(),
    hexOutsideAllowlist: findHexFileViolations(sourceFiles, hexAllowlist),
    inkOnPrimary500: findInkOnPrimaryViolations(sourceFiles),
    rgbLiterals: findRgbViolations(sourceFiles, hexAllowlist, colorLookup),
    spacesOutOfRamp: findSpacesViolations(sourceFiles, spacesContract),
    staleAllowlist: findStaleAllowlistEntries(hexAllowlist),
    unknownTokens: findUnknownRefs(sourceFiles, knownByType),
  };

  const counts = rules.reduce((acc, rule) => ({
    ...acc,
    [rule.id]: findingsByRule[rule.id].length,
  }), {});

  if (shouldUpdateBaseline) {
    const previous = readBaseline();
    writeBaseline(counts, previous);
    console.log('verify-theme-contract: baseline mise a jour');
    rules.forEach((rule) => {
      console.log(`- ${rule.id}: ${counts[rule.id]}`);
    });
    return;
  }

  const baseline = readBaseline();
  const maxByRule = baseline.maxByRule || {};
  const regressions = [];
  const improvements = [];

  const advisories = [];

  rules.forEach((rule) => {
    const current = counts[rule.id];
    const max = isStrict ? 0 : Number(maxByRule[rule.id] ?? 0);
    if (current > max) {
      if (rule.blocking) regressions.push({ current, max, rule });
      else advisories.push({ current, max, rule });
    } else if (current < max) {
      improvements.push({ current, max, rule });
    }
  });

  // Les constats sous plafond restent visibles (mode verbose ou regression),
  // sinon la dette devient invisible et le cliquet ne se resserre jamais.
  rules.forEach((rule) => {
    const findings = findingsByRule[rule.id];
    if (findings.length === 0) return;
    const isRegressing = regressions.some((item) => item.rule.id === rule.id);
    const isAdvised = advisories.some((item) => item.rule.id === rule.id);
    if (!isRegressing && !isAdvised && !isVerbose) return;
    const log = isRegressing ? console.error : console.log;
    log(`\n${rule.title} (${findings.length})`);
    findings.forEach((finding) => {
      const where = finding.line ? `${finding.file}:${finding.line}` : finding.file;
      log(`- ${where} -> ${finding.message}`);
    });
  });

  console.log('\nverify-theme-contract');
  console.log(`- fichiers scannes: ${sourceFiles.length}`);
  rules.forEach((rule) => {
    const current = counts[rule.id];
    const max = isStrict ? 0 : Number(maxByRule[rule.id] ?? 0);
    const delta = current - max;
    let flag = 'ok';
    if (delta > 0) flag = rule.blocking ? 'REGRESSION' : 'a nettoyer';
    else if (delta < 0) flag = 'ameliore';
    console.log(`- ${rule.id}: ${current} / plafond ${max} (${flag})`);
  });

  if (advisories.length > 0) {
    console.log('\nHygiene (n\'echoue pas la porte) :');
    advisories.forEach(({ current, rule }) => {
      console.log(`- ${rule.id}: ${current} entree(s) a retirer, cf. detail ci-dessus.`);
    });
  }

  if (improvements.length > 0) {
    console.log('\nCes plafonds peuvent etre resserres :');
    improvements.forEach(({ current, max, rule }) => {
      console.log(`- ${rule.id}: ${max} -> ${current}`);
    });
    console.log('Relancer: npm run verify:theme-contract -- --update-baseline');
  }

  if (regressions.length > 0) {
    console.error('\nLe contrat de theme regresse :');
    regressions.forEach(({ current, max, rule }) => {
      console.error(`- ${rule.id}: ${current} > plafond ${max}`);
    });
    console.error('Corriger les constats ci-dessus, ou justifier une hausse de plafond.');
    process.exit(1);
  }

  console.log('\nverify-theme-contract: OK');
};

run();
