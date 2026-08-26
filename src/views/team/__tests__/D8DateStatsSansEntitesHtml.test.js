import { readFileSync } from 'fs';
import { join } from 'path';

import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import i18n from '@/theme/strings';

import { formatDateTimeWithDayPrefix } from '@/utils/date';

// D8 (26/08) — « Depuis le 26&#x2F;08&#x2F;2026 19:28:52 ».
//
// 📸 CE QU ADEL A VU, onglet Stats > Vie d equipe, derniere ligne :
// « Apres "Depuis" il y a ecrit n importe quoi ». Chaque `/` de la date
// ressortait en `&#x2F;`, et les secondes trainaient derriere.
//
// 🔤 LA CAUSE : i18next ECHAPPE les valeurs interpolees (`& ' < > " /`). La
// date passait par le 3e argument de `t()` — donc par l interpolation — au
// lieu du motif maison `.replace('{{date}}', …)` que les 5 autres endroits du
// depot utilisent deja.
//
// ⛔ CE QUI N EST PAS LA CORRECTION : `escapeValue: false`. Ce serait ouvrir la
// porte pour TOUTES les interpolations, dont certaines portent des noms saisis
// par des humains (« N'Diaye » deviendrait « N&#39;Diaye »). C est ecrit noir
// sur blanc dans `AppUpdateRequiredScreen.js:26-33`, ou le meme defaut a ete
// paye le 26/08 au matin.
//
// 🧪 POURQUOI CE FILET NE MONTE PAS L ECRAN : `TeamDetails.js` fait 4 300
// lignes et n a AUCUN test de rendu — le depot a deja tranche ce compromis une
// fois (`statsLabelAbbreviation.test.js`, meme fichier, meme raison). On tient
// donc les deux bouts qui comptent vraiment :
//   1. le COMPORTEMENT, sur le VRAI i18next et un VRAI rendu : le motif fautif
//      produit des entites, le motif maison n en produit aucune ;
//   2. la LIGNE de `TeamDetails.js` : elle utilise bien le motif maison.
// ⚠️ Ce qui reste non couvert, et qui est dit plutot que tu : l ecran lui-meme
// n est pas monte.

const RACINE_SRC = join(__dirname, '..', '..', '..');
const CHEMIN_ECRAN = join(RACINE_SRC, 'views', 'team', 'TeamDetails.js');
const SOURCE_ECRAN = readFileSync(CHEMIN_ECRAN, 'utf8');

const CLEF = 'teamDetails.stats.baselineLabel';
const GABARIT = 'Depuis le {{date}}';

// Les entites que l echappement d i18next fabrique. `&#x2F;` est celle de la
// capture ; les autres viennent avec les noms propres et les esperluettes.
const ENTITES = ['&#x2F;', '&#39;', '&amp;', '&quot;', '&lt;', '&gt;'];

/**
 * Rend une phrase dans un vrai `Text` et rend l arbre serialise.
 * @param {string} phrase - Le texte a rendre.
 * @returns {string} - L arbre rendu, en JSON.
 */
const rendre = (phrase) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<Text>{phrase}</Text>);
  });
  return JSON.stringify(arbre.toJSON());
};

describe('D8 · temoin 1 — aucune entite HTML n atterrit a l ecran', () => {
  test('le motif FAUTIF (3e argument de t) fabrique bien les entites', () => {
    // 🔬 Ce temoin ne protege rien : il PROUVE la cause. Sans lui, la
    // correction ressemblerait a une preference de style.
    const phrase = i18n.t(CLEF, GABARIT, { date: '26/08/2026 19:28:52' });

    expect(rendre(phrase)).toContain('&#x2F;');
  });

  test('le motif MAISON (.replace) n en fabrique aucune', () => {
    const phrase = i18n.t(CLEF, GABARIT).replace('{{date}}', '26/08/2026 19:28:52');
    const rendu = rendre(phrase);

    ENTITES.forEach((entite) => expect(rendu).not.toContain(entite));
    expect(rendu).toContain('Depuis le 26/08/2026');
  });

  test('meme avec une apostrophe et une esperluette, le motif maison tient', () => {
    // Le jour ou cette ligne portera autre chose qu une date — un nom de club
    // saisi par un humain, par exemple.
    const phrase = i18n.t(CLEF, GABARIT).replace('{{date}}', "l'Étoile & Cie");
    const rendu = rendre(phrase);

    ENTITES.forEach((entite) => expect(rendu).not.toContain(entite));
    expect(rendu).toContain("l'Étoile & Cie");
  });
});

describe('D8 · temoin 2 — la ligne « Depuis le … » de TeamDetails', () => {
  test('elle ne passe plus AUCUNE valeur a travers i18next', () => {
    // La ligne fautive, telle qu elle etait : une valeur en 3e argument.
    expect(SOURCE_ECRAN).not.toContain('{ date: statsBaselineLabel }');

    // Et le motif maison, celui des 5 voisines du depot.
    expect(SOURCE_ECRAN).toContain(".replace('{{date}}', statsBaselineLabel)");
  });

  test('la date affichee est bien celle de baselineAt, et sans les secondes', () => {
    // 🕐 D8c : `toLocaleString('fr-FR')` rendait « 26/08/2026 19:28:52 ». Les
    // secondes d une date de REFERENCE ne servent a personne. Le depot a deja
    // son formateur, et c est lui qu on branche.
    // ⚠️ On lit LE bloc, pas tout le fichier : `toLocaleString('fr-FR')` vit
    // encore a deux autres endroits de `TeamDetails.js` (une date de match
    // ligne ~477 et « Derniere reponse le … » ligne ~4441). Ils ne passent pas
    // par `t()`, ne fabriquent donc aucune entite, et n appartiennent pas a ce
    // lot — mais ils sont NOMMES ici plutot qu oublies.
    const blocBaseline = SOURCE_ECRAN.slice(
      SOURCE_ECRAN.indexOf('const statsBaselineLabel'),
      SOURCE_ECRAN.indexOf('const teamPerformancePlayers'),
    );
    expect(blocBaseline).toContain('formatDateTimeWithDayPrefix');
    expect(blocBaseline).not.toContain("toLocaleString('fr-FR')");

    // La preuve du rendu, sur le vrai formateur : la date de reference sort
    // lisible, et la seconde a disparu.
    const baselineAt = new Date(2026, 7, 26, 19, 28, 52).toISOString();
    const affichee = formatDateTimeWithDayPrefix(baselineAt);

    expect(affichee).toContain('26/08/2026');
    expect(affichee).toContain('19h28');
    expect(affichee).not.toContain('52');
    expect(rendre(`Depuis le ${affichee}`)).not.toContain('&#x2F;');
  });
});
