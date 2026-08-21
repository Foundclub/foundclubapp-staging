import fs from 'fs';
import path from 'path';

import fr from '@/theme/strings/translations/fr';

// AD10 — le filet qui empêche qu'un écran affiche un NOM DE CLEF au lieu d'une
// phrase.
//
// Mesure du 2026-08-21, avant ce lot : 34 clefs distinctes / 55 endroits de
// production appelaient `t('...')` sur une clef ABSENTE de `fr.js` et SANS
// texte de repli. i18next rend alors la clef telle quelle : l'utilisateur
// voyait « common.success » dans le titre de son pop-up, en production.
//
// ⚠️ Ce témoin distingue trois situations, et une seule est un défaut :
//   · `t('a.b')`             → clef absente : l'écran affiche « a.b »  → DÉFAUT
//   · `t('a.b', 'Du texte')` → i18next affiche « Du texte »            → correct
//   · `t('a.b', { count })`  → i18next lit `a.b_one` / `a.b_other`     → correct
//
// Les deux derniers cas sont la raison d'être du détail de ce fichier : un
// balayage naïf comptait 886 clefs « manquantes », dont 7 écrans de détection
// qui vivent en `_one`/`_other` et marchent très bien.

const SRC = path.resolve(__dirname, '..', '..', '..');

// i18next résout `t('a.b', { count })` sur les formes `a.b_one` / `a.b_other`.
// Une clef de base absente n'est donc PAS forcément manquante.
const SUFFIXES_DE_PLURIEL = ['', '_zero', '_one', '_two', '_few', '_many', '_other'];

/**
 * Rend le contenu des parenthèses de l'appel qui commence à `ouvrante`.
 *
 * Écrit à la main plutôt qu'avec une expression régulière : un argument peut
 * contenir des parenthèses, des accolades et des apostrophes françaises.
 * @param {string} source - Le fichier entier.
 * @param {number} ouvrante - L'index de la parenthèse ouvrante de l'appel.
 * @returns {string} - Le texte des arguments, parenthèses exclues.
 */
function argumentsDeLAppel(source, ouvrante) {
  let profondeur = 0;
  let guillemet = null;
  for (let i = ouvrante; i < source.length; i += 1) {
    const c = source[i];
    if (guillemet) {
      if (c === '\\') {
        i += 1;
      } else if (c === guillemet) {
        guillemet = null;
      }
    } else if (c === "'" || c === '"' || c === '`') {
      guillemet = c;
    } else if (c === '(' || c === '[' || c === '{') {
      profondeur += 1;
    } else if (c === ')' || c === ']' || c === '}') {
      profondeur -= 1;
      if (profondeur === 0) {
        return source.slice(ouvrante + 1, i);
      }
    }
  }
  return '';
}

/**
 * Tous les fichiers de production sous `src/`, tests et doublures exclus.
 * @param {string} dossier - Le dossier à parcourir.
 * @param {string[]} [acc] - L'accumulateur.
 * @returns {string[]} - Les chemins absolus.
 */
function fichiersDeProduction(dossier, acc = []) {
  fs.readdirSync(dossier, { withFileTypes: true }).forEach((entree) => {
    const complet = path.join(dossier, entree.name);
    if (entree.isDirectory()) {
      if (['__mocks__', '__tests__', 'node_modules'].includes(entree.name)) {
        return;
      }
      fichiersDeProduction(complet, acc);
      return;
    }
    if (/\.(js|jsx|ts|tsx)$/.test(entree.name) && !/\.(test|spec)\./.test(entree.name)) {
      acc.push(complet);
    }
  });
  return acc;
}

/**
 * Lit une clef pointée dans le dictionnaire, sans suffixe de pluriel.
 * @param {string} clef - La clef pointée, par exemple `common.success`.
 * @returns {any} - La valeur trouvée, ou `undefined`.
 */
function lireBrut(clef) {
  return clef.split('.').reduce((noeud, part) => {
    if (noeud === null || noeud === undefined) {
      return undefined;
    }
    return noeud[part];
  }, fr);
}

/**
 * Lit une clef, en acceptant ses formes plurielles.
 * @param {string} clef - La clef pointée.
 * @returns {string | undefined} - La première valeur textuelle trouvée.
 */
function lire(clef) {
  return SUFFIXES_DE_PLURIEL
    .map((suffixe) => lireBrut(clef + suffixe))
    .find((valeur) => typeof valeur === 'string');
}

/**
 * L'appel porte-t-il de quoi afficher autre chose que sa clef ?
 * @param {string} source - Le fichier entier.
 * @param {number} indexAppel - L'index du début de l'appel.
 * @param {number} decalage - La longueur du caractère qui précède le `t(`.
 * @param {string} clef - La clef appelée.
 * @returns {string | null} - Le texte de repli, ou `null` s'il n'y en a pas.
 */
function texteDeRepli(source, indexAppel, decalage, clef) {
  const ouvrante = source.indexOf('(', indexAppel + decalage);
  const args = argumentsDeLAppel(source, ouvrante);
  const apres = args.slice(args.indexOf(clef) + clef.length + 1).replace(/^\s*,/, '').trim();
  if (apres.length === 0) {
    return null;
  }
  const simple = apres.match(/^'((?:[^'\\]|\\.)*)'/);
  const double = apres.match(/^"((?:[^"\\]|\\.)*)"/);
  if (simple) return simple[1];
  if (double) return double[1];
  // ⚠️ `defaultValue` s'écrit AUSSI en gabarit, et 4 écrans le font
  // (`SquadDetailsScreen` x2, `SelfProfilePlayerCoach`, `TeamEdit`). Ne lire
  // que la forme entre apostrophes les faisait passer pour des clefs nues.
  const defaut = apres.match(/defaultValue\s*:\s*['"`]/);
  if (defaut) return '';
  // Un gabarit ou une concaténation en 2e argument : on ne sait pas lire le
  // texte, mais on sait qu'il y en a un. L'écran n'affiche donc pas la clef.
  return /^[`(]/.test(apres) ? '' : null;
}

/**
 * Relève tous les `t('clef.pointee')` littéraux de la production.
 * @returns {Map<string, object[]>} - Les appels, groupés par clef.
 */
function releverLesAppels() {
  const appels = new Map();
  fichiersDeProduction(SRC).forEach((fichier) => {
    const source = fs.readFileSync(fichier, 'utf8');
    const relatif = path.relative(SRC, fichier).split(path.sep).join('/');
    const motif = /(^|[^A-Za-z0-9_$.])t\(\s*(['"])([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)\2/g;
    let trouve = motif.exec(source);
    while (trouve !== null) {
      const clef = trouve[3];
      const ligne = source.slice(0, trouve.index).split('\n').length;
      if (!appels.has(clef)) {
        appels.set(clef, []);
      }
      appels.get(clef).push({
        endroit: `${relatif}:${ligne}`,
        repli: texteDeRepli(source, trouve.index, trouve[1].length, clef),
      });
      trouve = motif.exec(source);
    }
  });
  return appels;
}

const APPELS = releverLesAppels();

/**
 * Les clefs absentes de `fr.js` que la production affiche TELLES QUELLES.
 * @returns {string[]} - Une ligne `clef (endroits)` par clef, triées.
 */
const clefsNues = () => [...APPELS.entries()]
  .filter(([clef]) => typeof lire(clef) !== 'string')
  .map(([clef, usages]) => [clef, usages.filter((usage) => usage.repli === null)])
  .filter(([, nus]) => nus.length > 0)
  .map(([clef, nus]) => `${clef}  (${nus.map((usage) => usage.endroit).join(', ')})`)
  .sort();

// 🧨 Inventaire figé le 2026-08-21 : les clefs absentes de `fr.js` que la
// production appelle avec PLUSIEURS textes de repli DIFFÉRENTS. Les définir
// réécrirait silencieusement des libellés (voir le témoin plus bas).
// ✅ En retirer une — en séparant les appels en clefs distinctes — est un
// progrès et laisse le témoin vert. ⛔ En ajouter une, non.
const MINES_CONNUES = [
  'common.cancel',
  'common.confirm',
  'common.noResults',
  'common.retry',
  'common.save',
  'common.success',
  'common.team',
  'eventWizard.steps.detectionSlots.title',
  'facilityList.title',
  'messaging.newConversation',
  'messaging.pin',
  'messaging.pinError',
  'messaging.unpin',
  'messaging.unpinError',
  'requests.title',
  'searchAlerts.create.placeholder',
  'squadDetails.actions.leaveTeam',
  'teamDetails.external.requestedSource',
];

// ⛔ Ce lot répare TOUT ce qui était nu. Cette liste doit rester VIDE : toute
// clef qui y réapparaît est un écran qui affiche à nouveau un nom de clef.
const RESTANTES_ACCEPTEES = [];

describe('AD10 — aucun écran n’affiche un nom de clef à la place d’une phrase', () => {
  it('relève bien les appels à t() dans la production', () => {
    // Garde-fou du témoin lui-même : s'il ne trouve plus rien, c'est le
    // balayage qui est cassé, pas le code qui est devenu parfait.
    expect(APPELS.size).toBeGreaterThan(2000);
  });

  it('n’appelle aucune clef absente de fr.js sans texte de repli', () => {
    const nues = clefsNues().map((ligne) => ligne.split('  (')[0]);
    expect(nues).toEqual(RESTANTES_ACCEPTEES.slice().sort());
  });

  it('n’affiche aucun nom de clef common.* à l’écran', () => {
    const nues = clefsNues()
      .map((ligne) => ligne.split('  (')[0])
      .filter((clef) => clef.startsWith('common.'));
    expect(nues).toEqual([]);
  });

  it('rend toutes les clefs de la feuille d’export', () => {
    const absentes = [...APPELS.keys()]
      .filter((clef) => clef.startsWith('eventDetails.export'))
      .filter((clef) => typeof lire(clef) !== 'string')
      .sort();
    expect(absentes).toEqual([]);
  });

  // 🧨 LE PIÈGE QUE CE TÉMOIN GARDE OUVERT, ET POURQUOI ON NE LE « RÉPARE » PAS.
  //
  // 41 clefs `common.*` de plus sont appelées sans exister dans `fr.js` — mais
  // toutes avec un texte de repli, donc l'écran est correct. Les définir NE
  // corrigerait rien et CASSERAIT des écrans : dès que la clef existe, i18next
  // ignore le repli, et TOUS les appels reçoivent le même mot.
  //
  // Mesuré le 2026-08-21, le cas le plus grave :
  //   FeaturedRequestsScreen.js:134  t('common.confirm', 'Accepter')
  //   FeaturedRequestsScreen.js:153  t('common.confirm', 'Refuser')   <- 🚨
  // Définir `common.confirm: 'Confirmer'` transforme le bouton REFUSER en
  // bouton CONFIRMER. Personne ne le verrait passer : aucune porte ne lit les
  // libellés, et le compteur de clefs monterait, ce qui a l'air d'un progrès.
  //
  // Ce témoin ne demande donc pas de les définir. Il interdit que la liste
  // S'ALLONGE : une clef partagée de plus, appelée avec deux mots différents,
  // est une mine posée pour le prochain lot.
  it('n’ajoute aucune clef partagée appelée avec deux textes de repli différents', () => {
    const minees = [...APPELS.entries()]
      .filter(([clef]) => typeof lire(clef) !== 'string')
      .filter(([, usages]) => new Set(
        usages.map((usage) => usage.repli).filter(Boolean),
      ).size > 1)
      .map(([clef]) => clef)
      .sort();

    expect(minees.filter((clef) => !MINES_CONNUES.includes(clef))).toEqual([]);
  });
});
