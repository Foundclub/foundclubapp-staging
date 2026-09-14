/* eslint-disable no-console */
// 🔤 I18N-0 — LE CLIQUET DU FRANÇAIS EN DUR.
//
// Chaque texte français écrit directement dans un écran (et pas dans fr.js via
// `t()`) restera en français sur un téléphone anglais. Ce script les compte PAR
// FICHIER, et refuse qu'un fichier en ajoute. Même idiome que
// `scripts/lint-no-regression.js` : une baseline datée, une porte qui ne regarde
// que la hausse.
//
// Usage :
//   node scripts/i18n/francais-en-dur.js              → la porte (code 1 si hausse)
//   node scripts/i18n/francais-en-dur.js --baseline   → réécrit la baseline
//   node scripts/i18n/francais-en-dur.js --rapport x.json → détail par fichier
//
// 🧮 L'HEURISTIQUE, et ses limites (elle compte des LIGNES, pas des phrases) :
// - on lit chaque fichier de production sous src/ (tests, doublures et
//   dictionnaires exclus) avec Babel ;
// - on examine les textes : littéraux '…' "…", morceaux de gabarit `…`, et
//   texte JSX ;
// - on IGNORE les arguments de `t()` / `i18n.t()` / `i18next.t()` (le repli est
//   déjà traduisible), de `console.*`, de `require()`, les sources d'import et
//   les noms de propriétés ;
// - un texte est « français » s'il porte une lettre accentuée française, OU s'il
//   contient une espace et un mot-outil français (le, la, des, pour, avec, ton…)
//   ou une élision (l'équipe, d'un, qu'il) ;
// - une LIGNE compte une fois, même si elle porte trois textes.
// ⚠️ Faux positifs connus : un nom propre accentué (« Évian »), un format de
// date « d MMMM » accompagné d'une phrase. Faux négatifs : une phrase française
// sans accent ni mot-outil (« Valider », « Match amical »). C'est un compteur de
// tendance, pas un inventaire exact.
//
// 🔒 CE QUE LA PORTE REFUSE : un fichier dont le compte DÉPASSE sa baseline (un
// fichier absent de la baseline vaut 0). Baisser est toujours permis ; relancer
// `--baseline` après une baisse resserre le cliquet. ⛔ Relancer `--baseline`
// pour absorber une HAUSSE, c'est remonter un plafond : GO Adel daté (R6).
// ponytail: un fichier RENOMMÉ repart de 0 et fait rougir la porte ; sortie :
// relancer `--baseline` en le disant dans le message de commit.
const fs = require('fs');
const path = require('path');

const { parse } = require('@babel/parser');

const RACINE = path.resolve(__dirname, '..', '..');
const SRC = path.join(RACINE, 'src');
const BASELINE = path.join(RACINE, '.ci', 'i18n-francais-en-dur-baseline.json');
const DOSSIERS_EXCLUS = ['__mocks__', '__tests__', 'node_modules'];
const DICTIONNAIRES = path.join(SRC, 'theme', 'strings', 'translations');

const ACCENT = /[àâäçéèêëîïôöûùüÿœæ]/i;
const MOT_OUTIL = new RegExp(
  '(^|[^\\p{L}])(le|la|les|des|du|une|un|pour|avec|dans|sur|pas|ton|ta|tes|votre|vos|est'
  + '|sont|aucun|aucune|et|ou|de|au|aux|ce|cette|ces|ne|tu|te|nous|vous|il|elle|ils|elles'
  + '|qui|que|mon|ma|mes|son|sa|ses|leur|leurs|par|plus|tout|tous|toute|toutes)(?=$|[^\\p{L}])',
  'iu',
);
const ELISION = /(^|[^\p{L}])(d|l|n|s|c|j|m|t|qu)['’]\p{L}/iu;

const estFrancais = (texte) => {
  const propre = String(texte).trim();
  if (!/\p{L}{2}/u.test(propre)) return false;
  if (ACCENT.test(propre)) return true;
  return /\s/.test(propre) && (MOT_OUTIL.test(propre) || ELISION.test(propre));
};

const fichiersDeProduction = (dossier, acc = []) => {
  fs.readdirSync(dossier, { withFileTypes: true }).forEach((entree) => {
    const complet = path.join(dossier, entree.name);
    if (entree.isDirectory()) {
      if (!DOSSIERS_EXCLUS.includes(entree.name) && complet !== DICTIONNAIRES) {
        fichiersDeProduction(complet, acc);
      }
      return;
    }
    if (/\.(js|jsx|ts|tsx)$/.test(entree.name) && !/\.(test|spec)\./.test(entree.name)) {
      acc.push(complet);
    }
  });
  return acc;
};

const nomAppele = (appel) => {
  const { callee } = appel;
  if (callee.type === 'Identifier') return callee.name;
  if (callee.type === 'MemberExpression' && !callee.computed
    && callee.object.type === 'Identifier') {
    return `${callee.object.name}.${callee.property.name}`;
  }
  return '';
};

const APPELS_IGNORES = /^(t|i18n\.t|i18next\.t|require|console\.\w+)$/;
const CHAMPS_IGNORES = ['innerComments', 'leadingComments', 'loc', 'trailingComments'];

// Les numéros de ligne qui portent au moins un texte français hors `t()`.
const lignesFrancaises = (fichier) => {
  const source = fs.readFileSync(fichier, 'utf8');
  const ast = parse(source, {
    errorRecovery: true,
    plugins: /\.tsx?$/.test(fichier) ? ['jsx', 'typescript'] : ['jsx'],
    sourceType: 'module',
  });
  const lignes = new Set();
  const noter = (noeud, texte) => {
    if (estFrancais(texte)) lignes.add(noeud.loc.start.line);
  };
  const visiter = (noeud) => {
    if (!noeud || typeof noeud.type !== 'string') return;
    switch (noeud.type) {
      case 'CallExpression':
        if (APPELS_IGNORES.test(nomAppele(noeud))) return;
        break;
      case 'ClassProperty':
      case 'ObjectMethod':
      case 'ObjectProperty':
        if (!noeud.computed) {
          visiter(noeud.value);
          visiter(noeud.body);
          return;
        }
        break;
      case 'ExportAllDeclaration':
      case 'ImportDeclaration':
        return;
      case 'JSXText':
        noter(noeud, noeud.value);
        return;
      case 'StringLiteral':
        noter(noeud, noeud.value);
        return;
      case 'TemplateElement':
        noter(noeud, noeud.value.cooked);
        return;
      default:
        break;
    }
    Object.keys(noeud).forEach((champ) => {
      if (CHAMPS_IGNORES.includes(champ)) return;
      const valeur = noeud[champ];
      if (Array.isArray(valeur)) valeur.forEach(visiter);
      else if (valeur && typeof valeur.type === 'string') visiter(valeur);
    });
  };
  visiter(ast.program);
  return [...lignes].sort((a, b) => a - b);
};

const mesurer = () => {
  const parFichier = {};
  fichiersDeProduction(SRC).forEach((fichier) => {
    const lignes = lignesFrancaises(fichier);
    if (lignes.length > 0) {
      parFichier[path.relative(RACINE, fichier).split(path.sep).join('/')] = lignes;
    }
  });
  return parFichier;
};

const total = (comptes) => Object.values(comptes).reduce((somme, n) => somme + n, 0);

const run = () => {
  const mesure = mesurer();
  const comptes = Object.fromEntries(Object.entries(mesure).map(([f, l]) => [f, l.length]));
  const rapport = process.argv[process.argv.indexOf('--rapport') + 1];
  if (process.argv.includes('--rapport') && rapport) {
    fs.writeFileSync(rapport, `${JSON.stringify(mesure, null, 1)}\n`, 'utf8');
  }

  if (process.argv.includes('--baseline')) {
    const baseline = {
      fichiers: Object.fromEntries(Object.keys(comptes).sort().map((f) => [f, comptes[f]])),
      note: 'Compte des LIGNES de production portant du francais hors t() (heuristique :'
        + ' voir scripts/i18n/francais-en-dur.js). Le cliquet ne tourne que dans un sens :'
        + " une hausse absorbee par --baseline exige un GO d'Adel date (R6).",
      source: 'node scripts/i18n/francais-en-dur.js --baseline',
      totalFichiers: Object.keys(comptes).length,
      totalLignes: total(comptes),
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    fs.writeFileSync(BASELINE, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8');
    console.log(`francais-en-dur: baseline ecrite lignes=${baseline.totalLignes}`
      + ` fichiers=${baseline.totalFichiers}`);
    return;
  }

  if (!fs.existsSync(BASELINE)) {
    throw new Error(`Baseline absente : ${path.relative(RACINE, BASELINE)}`);
  }
  const { fichiers: plafonds, totalLignes } = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const hausses = Object.entries(comptes)
    .filter(([f, n]) => n > (plafonds[f] || 0))
    .map(([f, n]) => `${f} : ${plafonds[f] || 0} -> ${n} (lignes ${mesure[f].join(', ')})`);
  const baisses = Object.entries(plafonds).filter(([f, n]) => (comptes[f] || 0) < n).length;

  console.log(`francais-en-dur: baselineLignes=${totalLignes} currentLignes=${total(comptes)}`
    + ` delta=${total(comptes) - totalLignes}`);
  console.log(`francais-en-dur: fichiersEnHausse=${hausses.length} fichiersEnBaisse=${baisses}`);
  if (hausses.length > 0) {
    console.error('Du francais en dur a ete AJOUTE hors t() :');
    hausses.forEach((ligne) => console.error(`  ${ligne}`));
    process.exit(1);
  }
};

run();
