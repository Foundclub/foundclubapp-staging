import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

import i18n from '@/theme/strings';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

// 🎨 COLL-FIX-PLANNING (02/10/2026), defaut de la tournee T9 (capture T9_C37_3) : la fiche d un
// club cote mairie affichait « Depuis le 01&#x2F;10&#x2F;2026. » (CollectiviteClubDetails,
// `collectiviteClubs.detail.offerSince`). i18next echappe les valeurs interpolees (voir
// `sansEchappement.js`) : chaque « / » d une date devient `&#x2F;`. Deja paye le 26/08 (D8,
// « Depuis le 26&#x2F;08… » dans les stats d equipe) et le 29/09 pour les NOMS (FINITIONS3).
//
// Le temoin des noms (`nomsSansEntiteFINITIONS3.test.js`) ne voit pas les DATES : une cle `date`
// dont la valeur s appelle `depuis` n a rien d un nom. Ce temoin est son jumeau pour les dates et
// les heures : CHAQUE appel de l app qui interpole une date, rendu par le VRAI i18next avec une
// date a barres obliques et les options EXACTES de l appel, ne doit sortir aucune entite HTML.
// ROUGE avant : la cle de la capture et ses semblables (liste dans le message du commit).

const traverse = traverseModule.default || traverseModule;
const RACINE_SRC = join(__dirname, '..', '..', '..');
const DATE_PIEGE = '01/10/2026';
const ENTITE = /&(#39|#x27|amp|quot|#x2F|lt|gt);/;

// Options d i18next, pas des valeurs affichees.
const RESERVEES = new Set(['context', 'count', 'defaultValue', 'defaultValue_one',
  'defaultValue_other', 'interpolation', 'lng', 'ns', 'returnObjects']);
// La CLE dit une date ou une heure (« start » oui, « starters » non)...
const CLE_DATE = /(date|depuis|since|jour$|day$|debut|start$|^fin$|end$|until|jusqu|heure|hour|time$|horaire|deadline|echeance|expir|naissance|birth|quand|when)/i;
// ... ou la VALEUR en est une (un formateur de date, `format(` de date-fns, une variable date).
const SOURCE_DATE = /(format\w*Date\w*\(|format\(|toLocale\w*String\(|[dD]ate\b|[dD]ateLabel|[sS]ince\b|depuis|[hH]eure\b|[tT]ime\b|[tT]imeLabel)/;
// Ce qui est un NOMBRE (un compte, une duree, un montant) ou un code ne porte jamais de « / ».
const CLE_NOMBRE = /(count|nombre|total|amount|montant|paid|expected|price|prix|code|minutes|hours?Count|days?Count|^jours$|^days$|^weeks$|^semaines$|^mois$|^months$|max|min$|index|limit|step|points|score|number|numero)/i;
const SOURCE_NOMBRE = /(\.length\b|Count\b|\bcount\b|Math\.|Number\(|parseInt|toFixed)/;

/**
 * Tous les fichiers .js de l app, hors temoins.
 * @param {string} dossier
 * @returns {string[]}
 */
const sources = (dossier) => readdirSync(dossier).flatMap((nom) => {
  const chemin = join(dossier, nom);
  if (statSync(chemin).isDirectory()) {
    return nom === '__tests__' ? [] : sources(chemin);
  }
  return /\.js$/.test(nom) && !/\.test\.js$/.test(nom) ? [chemin] : [];
});

/**
 * Les appels `t()` de l app qui interpolent une DATE (ou une heure), avec ce qu ils passent.
 * @returns {{ cle: string | null, count: boolean, fichier: string, ligne: number,
 *   repli: string | undefined, sansEchappement: boolean, variables: string[] }[]}
 */
const appelsQuiInterpolentUneDate = () => sources(RACINE_SRC).flatMap((chemin) => {
  const code = readFileSync(chemin, 'utf8');
  if (!/\bt\(/.test(code)) return [];
  const ast = parse(code, { plugins: ['jsx'], sourceType: 'module' });
  /** @type {any[]} */
  const appels = [];
  traverse(ast, {
    CallExpression(/** @type {any} */ p) {
      const { arguments: args, callee } = p.node;
      const estT = (callee.type === 'Identifier' && callee.name === 't')
        || (callee.type === 'MemberExpression' && callee.property.name === 't');
      const options = estT && args.slice(1).find((a) => a.type === 'ObjectExpression');
      if (!options) return;
      const source = (/** @type {any} */ n) => code.slice(n.start, n.end);
      const valeurs = options.properties
        .filter((/** @type {any} */ pr) => pr.type === 'ObjectProperty')
        .map((/** @type {any} */ pr) => ({
          cle: pr.key.name || pr.key.value, src: source(pr.value),
        }));
      const dates = valeurs.filter(({ cle, src }) => !RESERVEES.has(cle)
        && (CLE_DATE.test(cle) || SOURCE_DATE.test(src))
        && !CLE_NOMBRE.test(cle) && !SOURCE_NOMBRE.test(src));
      if (dates.length === 0) return;
      const repliEnOption = options.properties.find((/** @type {any} */ pr) => (
        pr.key?.name === 'defaultValue' && pr.value.type === 'StringLiteral'));
      let repli;
      if (args[1]?.type === 'StringLiteral') repli = args[1].value;
      else if (repliEnOption) repli = repliEnOption.value.value;
      appels.push({
        cle: args[0]?.type === 'StringLiteral' ? args[0].value : null,
        count: valeurs.some(({ cle }) => cle === 'count'),
        dates: dates.map(({ cle }) => cle),
        fichier: relative(RACINE_SRC, chemin).replace(/\\/g, '/'),
        ligne: p.node.loc.start.line,
        repli,
        sansEchappement: options.properties.some((/** @type {any} */ pr) => (
          /SANS_ECHAPPEMENT/.test(source(pr)) || pr.key?.name === 'interpolation')),
        variables: valeurs.map(({ cle }) => cle).filter((cle) => !RESERVEES.has(cle)),
      });
    },
  });
  return appels;
});

describe('COLL-FIX-PLANNING 4 — une date s affiche telle quelle, sans &#x2F;', () => {
  /** @type {ReturnType<typeof appelsQuiInterpolentUneDate>} */
  let appels = [];

  beforeAll(async () => {
    await i18n.changeLanguage('fr');
    appels = appelsQuiInterpolentUneDate();
  });

  test('la fiche du club cote mairie : « Depuis le 01/10/2026. »', () => {
    const appel = appels.find(({ cle }) => cle === 'collectiviteClubs.detail.offerSince');
    expect(appel).toBeDefined();
    expect(appel?.sansEchappement).toBe(true);
    expect(i18n.t('collectiviteClubs.detail.offerSince', { date: DATE_PIEGE, ...SANS_ECHAPPEMENT }))
      .toBe('Depuis le 01/10/2026.');
  });

  test('le temoin voit bien les appels (il ne passe pas au vert faute d en trouver)', () => {
    expect(appels.length).toBeGreaterThan(30);
    expect(appels.map(({ cle }) => cle)).toContain('teamStatsPanel.since');
  });

  test('chaque cle qui interpole une date la rend sans entite HTML, en fr et en en', () => {
    const avecCle = appels.filter(({ cle }) => cle);
    const fautifs = avecCle.flatMap((appel) => ['fr', 'en'].filter((lng) => {
      // Les dates recoivent la date piege ; les autres valeurs, un mot sans signe a echapper.
      const options = Object.fromEntries(appel.variables.map((v) => [
        v, appel.dates.includes(v) ? DATE_PIEGE : 'Valeur',
      ]));
      const rendu = i18n.t(/** @type {string} */ (appel.cle), {
        ...options,
        ...(appel.count ? { count: 2 } : {}),
        ...(appel.repli === undefined ? {} : { defaultValue: appel.repli }),
        lng,
        ...(appel.sansEchappement ? SANS_ECHAPPEMENT : {}),
      });
      return ENTITE.test(String(rendu));
    }).map((lng) => `${appel.fichier}:${appel.ligne} ${appel.cle} (${lng})`));

    expect(fautifs).toEqual([]);
  });

  test('les cles calculees (gabarit) qui interpolent une date portent l option', () => {
    const fautifs = appels.filter(({ cle, sansEchappement }) => !cle && !sansEchappement)
      .map(({ fichier, ligne }) => `${fichier}:${ligne}`);

    expect(fautifs).toEqual([]);
  });
});
