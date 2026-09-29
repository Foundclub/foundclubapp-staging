import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';

import i18n from '@/theme/strings';
import SANS_ECHAPPEMENT from '@/theme/strings/sansEchappement';

// ✂️ FINITIONS3 (29/09, tournee 5, defaut 3) — l en-tete de « Mon compte » affichait
// « Dirigeant · &#39;AIKI-ADVENTURE&#39;. » : i18next echappe les valeurs interpolees
// (voir `sansEchappement.js`), et le nom du club porte des apostrophes. Present depuis la
// tournee 1. Tout nom de club, d equipe ou de personne passe a `t()` sans l option
// `SANS_ECHAPPEMENT` a le meme defaut (« Club d'Aix », « Chloé & Léa »...).
//
// Ce temoin tient les trois bouts :
//   1. la phrase de l en-tete, rendue par le VRAI i18next de l app ;
//   2. CHAQUE appel de l app qui interpole un nom, rendu avec un nom piege et les
//      options EXACTES que l appel passe : aucune entite HTML ne doit sortir ;
//   3. les cles calculees (gabarit) qu on ne peut pas rendre ici : elles portent l option.
// ROUGE avant : 75 cles (en francais COMME en anglais) + 3 cles calculees, dont
// `profile.identity.roleWithClub` (Profile.js:363). Vert apres : l option sur 84 appels.

const traverse = traverseModule.default || traverseModule;
const RACINE_SRC = join(__dirname, '..', '..', '..');
const NOM_PIEGE = 'l\'Aix & "Co" 90/90';
const ENTITE = /&(#39|#x27|amp|quot|#x2F|lt|gt);/;

// Options d i18next, pas des valeurs affichees.
const RESERVEES = new Set(['context', 'count', 'defaultValue', 'defaultValue_one',
  'defaultValue_other', 'interpolation', 'lng', 'ns', 'returnObjects']);
// Une valeur qui DESIGNE un nom : par le nom de la variable ou par l expression source.
const CLE_NOM = /(name|nom|club|team|equipe|player|joueur|coach|user|first|last|author|sender|member|membre|parent|child|enfant|opponent|adversaire|organizer|host|creator|recipient|person|who|display|captain|capitaine|manager|president|collectivite|facility|installation|venue|lieu|structure|league|group|title|titre|program)/i;
const SOURCE_NOM = /(\.name\b|name\b|Name\b|firstname|lastname|firstName|lastName|displayName|fullName|username|\.title\b|clubName|teamName)/;
// ... sauf un NOMBRE : un compteur ne porte jamais d apostrophe.
const CLE_NOMBRE = /(Count$|^count$|^nombre$|^perTeam$|^requiredPlayers$)/;
const SOURCE_NOMBRE = /(\.length\b|\bnombre\(|Count\b|\bcount\b|perTeam|requiredPlayers|nbEnAttente)/;

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
 * Les appels `t()` de l app qui interpolent un NOM, avec ce qu ils passent.
 * @returns {{ cle: string | null, count: boolean, fichier: string, ligne: number,
 *   repli: string | undefined, sansEchappement: boolean, variables: string[] }[]}
 */
const appelsQuiInterpolentUnNom = () => sources(RACINE_SRC).flatMap((chemin) => {
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
      const noms = valeurs.filter(({ cle, src }) => !RESERVEES.has(cle)
        && (CLE_NOM.test(cle) || SOURCE_NOM.test(src))
        && !CLE_NOMBRE.test(cle) && !SOURCE_NOMBRE.test(src));
      if (noms.length === 0) return;
      // Le texte de secours ECRIT a cote de l appel s affiche si la cle manque : il compte aussi.
      const repliEnOption = options.properties.find((/** @type {any} */ pr) => (
        pr.key?.name === 'defaultValue' && pr.value.type === 'StringLiteral'));
      let repli;
      if (args[1].type === 'StringLiteral') repli = args[1].value;
      else if (repliEnOption) repli = repliEnOption.value.value;
      appels.push({
        cle: args[0].type === 'StringLiteral' ? args[0].value : null,
        count: valeurs.some(({ cle }) => cle === 'count'),
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

describe('FINITIONS3 3 — un nom avec une apostrophe s affiche tel quel', () => {
  /** @type {ReturnType<typeof appelsQuiInterpolentUnNom>} */
  let appels = [];

  beforeAll(async () => {
    await i18n.changeLanguage('fr');
    appels = appelsQuiInterpolentUnNom();
  });

  test('« Mon compte » : « Dirigeant · \'AIKI-ADVENTURE\' », sans &#39;', () => {
    const options = { club: '\'AIKI-ADVENTURE\'', role: 'Dirigeant', ...SANS_ECHAPPEMENT };
    expect(i18n.t('profile.identity.roleWithClub', options))
      .toBe('Dirigeant · \'AIKI-ADVENTURE\'');
  });

  test('le temoin voit bien les appels (il ne passe pas au vert faute d en trouver)', () => {
    expect(appels.length).toBeGreaterThan(50);
    expect(appels.map(({ cle }) => cle)).toContain('profile.identity.roleWithClub');
  });

  test('chaque cle qui interpole un nom le rend sans entite HTML, en fr et en en', () => {
    const avecCle = appels.filter(({ cle }) => cle);
    const fautifs = avecCle.flatMap((appel) => ['fr', 'en'].filter((lng) => {
      const options = Object.fromEntries(appel.variables.map((v) => [v, NOM_PIEGE]));
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

  test('les cles calculees (gabarit) qui interpolent un nom portent l option', () => {
    const fautifs = appels.filter(({ cle, sansEchappement }) => !cle && !sansEchappement)
      .map(({ fichier, ligne }) => `${fichier}:${ligne}`);

    expect(fautifs).toEqual([]);
  });
});
