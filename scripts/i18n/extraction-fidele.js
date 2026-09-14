/* eslint-disable no-console */
// 🔤 I18N — L'EXTRACTION EST-ELLE FIDÈLE ?
//
// Un lot I18N-1..4 transforme `'Chargement du profil'` en
// `t('userName.loading', 'Chargement du profil')`. Le français affiché ne doit
// PAS changer : c'est la seule promesse qui permet de toucher ~400 fichiers
// sans écrire un témoin de caractérisation par fichier (règle E6).
//
// Ce contrôle la vérifie mécaniquement : pour chaque fichier de production
// modifié depuis une référence, chaque texte français qui existait AVANT doit
// encore exister APRÈS — soit tel quel, soit comme repli d'un `t()`. Les
// interpolations sont comparées par leur place (`${prenom}` ≡ `{{prenom}}`).
//
// Usage : node scripts/i18n/extraction-fidele.js [--depuis origin/staging]
// Code 1 = des textes ont DISPARU. Chacun est soit une erreur (à corriger), soit
// un changement voulu (un pluriel réécrit, un texte JSX coupé par une variable)
// à justifier UN PAR UN dans le compte rendu du lot.
// ⚠️ Faux positifs connus : `<Text>Il reste {n} actions</Text>` (le JSX coupe la
// phrase en deux morceaux) et tout pluriel fabriqué à la main.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const { releverDansLaSource } = require('./clefs');
const { normaliser, textesFrancais } = require('./francais-en-dur');

const RACINE = path.resolve(__dirname, '..', '..');

/**
 * Les textes français d'AVANT qui n'existent plus APRÈS, ni tels quels ni en repli.
 * @param {string} fichier - Le chemin relatif (sert au choix du parseur).
 * @param {string} avant - La source d'avant.
 * @param {string} apres - La source d'après.
 * @returns {Array<{ ligne: number, texte: string }>} Les textes disparus.
 */
const textesDisparus = (fichier, avant, apres) => {
  const replis = [...releverDansLaSource(new Map(), fichier, apres).values()]
    .flat()
    .flatMap((usage) => (usage.repli && usage.repli.textes
      ? Object.values(usage.repli.textes)
      : []))
    .map(normaliser);
  const presents = new Set([...replis, ...textesFrancais(fichier, apres).map((t) => t.texte)]);
  return textesFrancais(fichier, avant).filter(({ texte }) => !presents.has(texte));
};

const run = () => {
  const index = process.argv.indexOf('--depuis');
  const reference = index === -1 ? 'origin/staging' : process.argv[index + 1];
  const git = (args) => execFileSync('git', args, {
    cwd: RACINE,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 64,
  });
  const fichiers = git(['diff', '--name-only', '--diff-filter=M', reference, '--', 'src'])
    .split('\n')
    .filter((f) => /\.(js|jsx|ts|tsx)$/.test(f))
    .filter((f) => !/\.(test|spec)\./.test(f) && !/__(tests|mocks)__/.test(f))
    .filter((f) => !f.startsWith('src/theme/strings/translations/'));
  const disparus = fichiers.flatMap((fichier) => textesDisparus(
    fichier,
    git(['show', `${reference}:${fichier}`]),
    fs.readFileSync(path.join(RACINE, fichier), 'utf8'),
  ).map(({ ligne, texte }) => `${fichier}:${ligne} (avant) « ${texte} »`));

  console.log(`extraction-fidele: reference=${reference} fichiers=${fichiers.length}`
    + ` textesDisparus=${disparus.length}`);
  disparus.forEach((ligne) => console.log(`  ${ligne}`));
  if (disparus.length > 0) process.exit(1);
};

if (require.main === module) run();

module.exports = { textesDisparus };
