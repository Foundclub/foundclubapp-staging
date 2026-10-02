import { readFileSync } from 'fs';
import { join } from 'path';

import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

import i18n from '@/theme/strings';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

// COLL-C4A (02/10) — une Ville s'appelle « L'Isle-d'Abeau », une date s'écrit « 2/10 » :
// i18next échappe les valeurs interpolées (voir `sansEchappement.js`), et l'écran lirait
// « L&#39;Isle-d&#39;Abeau ». Le témoin FINITIONS3 l'a vu sur 7 appels du lot ; il ne voit
// pas `{{ville}}` ni `{{date}}` quand la valeur vient d'une variable au nom neutre (nomVille,
// date). Celui-ci tient TOUS les appels des écrans du lot : une valeur interpolée qui n'est
// pas un nombre passe avec SANS_ECHAPPEMENT.

const traverse = traverseModule.default || traverseModule;
const RACINE = join(__dirname, '..');
const FICHIERS = [
  'CollectiviteActualiteForm.js',
  'CollectiviteActualites.js',
  'CollectiviteActualitesCanal.js',
  'components/ActualiteCarte.js',
  'components/ActualitesDeLaVille.js',
  'components/BandeauActualiteVille.js',
  'components/BlocDeLaVille.js',
  'components/CanauxDeLaVille.js',
];
// Des nombres : un compteur ne porte jamais d'apostrophe ni de barre oblique.
const NOMBRES = new Set(['count', 'nombre']);

/**
 * Les appels `t()` du lot qui interpolent un texte sans SANS_ECHAPPEMENT.
 * @returns {string[]}
 */
const appelsSansOption = () => FICHIERS.flatMap((fichier) => {
  const code = readFileSync(join(RACINE, fichier), 'utf8');
  const ast = parse(code, { plugins: ['jsx'], sourceType: 'module' });
  /** @type {string[]} */
  const fautifs = [];
  traverse(ast, {
    CallExpression(/** @type {any} */ p) {
      const { arguments: args, callee } = p.node;
      if (callee.type !== 'Identifier' || callee.name !== 't') return;
      const options = args.slice(1).find((/** @type {any} */ a) => a.type === 'ObjectExpression');
      if (!options) return;
      const textes = options.properties.filter((/** @type {any} */ pr) => (
        pr.type === 'ObjectProperty' && !NOMBRES.has(pr.key.name)));
      const protege = options.properties.some((/** @type {any} */ pr) => (
        pr.type === 'SpreadElement' && pr.argument.name === 'SANS_ECHAPPEMENT'));
      if (textes.length > 0 && !protege) fautifs.push(`${fichier}:${p.node.loc.start.line}`);
    },
  });
  return fautifs;
});

describe('COLL-C4A — un nom de Ville, un titre ou une date s’affichent tels quels', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('fr');
  });

  it('le défaut existe : sans l’option, « L’Isle-d’Abeau » sort en entités', () => {
    const options = { date: '2/10', ville: 'Ville de L\'Isle-d\'Abeau' };
    expect(i18n.t('collectiviteActualites.bandeau.precision', options)).toMatch(/&#39;|&#x2F;/);
    expect(i18n.t('collectiviteActualites.bandeau.precision', { ...options, ...SANS_ECHAPPEMENT }))
      .toBe('Ville de L\'Isle-d\'Abeau · 2/10');
  });

  it('chaque appel des écrans du lot qui interpole un texte porte SANS_ECHAPPEMENT', () => {
    expect(appelsSansOption()).toEqual([]);
  });
});
