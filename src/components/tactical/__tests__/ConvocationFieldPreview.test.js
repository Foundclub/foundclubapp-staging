import { Image, Text, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ConvocationFieldPreview from '../ConvocationFieldPreview';

/**
 * ⚽ S5-D (vague S) — LE TERRAIN D UNE CONVOCATION PUBLIEE.
 *
 * 🗣️ Adel, recette du 26/08 : « une fois la composition publiee, ca doit
 * afficher LE TERRAIN avec les joueurs places directement dans l onglet ».
 *
 * 🧨 COMPOLECT-2 (27/08) — DEUX TEMOINS CHANGENT DE MESURE, PAS DE PROMESSE.
 * Capture d Adel a l appui : ce composant dessinait une PASTILLE DE 28 pt
 * portant des INITIALES, la ou l ecran de creation dessine un AVATAR PHOTO +
 * PRENOM. Les deux temoins touches mesuraient le DESSIN d avant (« un seul
 * Text », « la moitie de 28 ») ; ils mesurent maintenant la meme promesse sur
 * le jeton de la creation — un jeton par joueur place, centre sur sa position.
 *
 * ♻️ `RenderedTacticalField` est DOUBLE ici : ses traces SVG ont leur propre
 * filet. Ce qu on mesure, c est ce que ce composant-la ajoute — les jetons.
 * ⛔ `TacticalPlayerToken` n est PAS double : c est LUI qui porte la photo, le
 * prenom et le repli en initiales. Le doubler reviendrait a tester le double.
 *
 * ⚠️ CE QUE CE FILET NE PROUVE PAS : Jest ne met rien en page. Qu un jeton
 * tombe au bon endroit du terrain se voit a la recette, pas ici. Ce qui est
 * mesure, c est la POSITION DEMANDEE et le fait qu elle soit centree.
 */

/** La taille du jeton de terrain de `TacticalPlayerToken`, en points. */
const JETON_TERRAIN = { hauteur: 72, largeur: 58 };

jest.mock('../RenderedTacticalField', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, sport, style }) => react.createElement(
      rn.View,
      { sport, style, testID: 'terrain' },
      children,
    ),
  };
});

jest.mock('@/theme/themeContext', () => {
  const colors = jest.requireActual('@/theme/colors').default;
  return {
    __esModule: true,
    default: () => ({
      Colors: colors(),
      Fonts: jest.requireActual('@/theme/fonts').default(colors()),
    }),
  };
});

// 🗝️ Le VRAI dictionnaire : c est ce qui prouve que le banc de l apercu emploie
// les MEMES cles que le plateau de creation, et non des mots recopies.
jest.mock('react-i18next', () => {
  const traductions = jest.requireActual('@/theme/strings/translations/fr').default;
  return {
    initReactI18next: { init: () => {}, type: '3rdParty' },
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ options) => {
        const lire = (/** @type {string} */ chemin) => chemin.split('.').reduce(
          (/** @type {any} */ noeud, /** @type {string} */ segment) => (
            noeud && typeof noeud === 'object' ? noeud[segment] : undefined
          ),
          traductions,
        );
        const compte = options?.count;
        let valeur = lire(cle);
        if (typeof valeur !== 'string' && compte !== undefined) {
          valeur = lire(`${cle}${compte === 1 ? '_one' : '_other'}`);
        }
        if (typeof valeur !== 'string') return cle;
        return valeur.replace(/{{(\w+)}}/g, (_correspondance, nom) => (
          options && options[nom] !== undefined ? String(options[nom]) : ''
        ));
      },
    }),
  };
});

const KARIM = { documentId: 'joueur-1', firstname: 'Karim', lastname: 'Sylla' };
const LEO = { documentId: 'joueur-2', firstname: 'Leo', lastname: 'Diarra' };
const AVEC_PHOTO = {
  avatar: '/uploads/karim.jpg',
  documentId: 'joueur-3',
  firstname: 'Malik',
  lastname: 'Cisse',
};

const monter = (/** @type {any} */ {
  benchPlayers, placements, snapshotPlayers, sportContext,
}) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <ConvocationFieldPreview
        benchPlayers={benchPlayers}
        placements={placements}
        snapshotPlayers={snapshotPlayers}
        sportContext={sportContext}
      />,
    );
  });
  return arbre;
};

/**
 * Les enveloppes POSITIONNEES : une par joueur pose sur le terrain.
 * ⚠️ On les reconnait a leur `left` en pourcentage — c est la signature d un
 * placement, et elle ne depend pas du dessin du jeton qu elles portent.
 * @param {any} arbre
 * @returns {any[]}
 */
const jetons = (arbre) => arbre.root
  .findAllByType(View)
  .filter((/** @type {any} */ noeud) => {
    const style = Object.assign({}, ...[noeud.props?.style].flat(2).filter(Boolean));
    return typeof style.left === 'string' && style.left.endsWith('%');
  });

const texteVisible = (/** @type {any} */ arbre) => arbre.root
  .findAllByType(Text)
  .map((/** @type {any} */ noeud) => String(noeud.props.children ?? ''))
  .join(' | ');

describe('ConvocationFieldPreview — S5-D', () => {
  test('🥇 un jeton par joueur PLACE, avec ses initiales', () => {
    const arbre = monter({
      placements: [
        { playerId: 'joueur-1', positionX: 50, positionY: 90 },
        { playerId: 'joueur-2', positionX: 30, positionY: 40 },
      ],
      snapshotPlayers: [KARIM, LEO],
      sportContext: 'football',
    });

    expect(texteVisible(arbre)).toContain('KS');
    expect(texteVisible(arbre)).toContain('LD');
  });

  test('🔒 un placement dont la personne est INCONNUE n ecrit pas de jeton vide', () => {
    // ⛔ Mieux vaut un jeton de moins qu une pastille anonyme sur le terrain :
    // un lecteur y verrait un joueur qu il n arrive pas a identifier.
    // (`buildConvocationFieldTokens` filtre deja a la source — on le fige ici.)
    // 🔄 COMPOLECT-2 : on compte les JETONS, plus les `Text`. Le jeton de la
    // creation en porte plusieurs (initiales + prenom) — compter les `Text`
    // mesurait le dessin d avant, pas la promesse.
    const arbre = monter({
      placements: [
        { playerId: 'joueur-1', positionX: 50, positionY: 90 },
        { playerId: 'fantome', positionX: 10, positionY: 10 },
      ],
      snapshotPlayers: [KARIM],
      sportContext: 'football',
    });

    expect(jetons(arbre)).toHaveLength(1);
    expect(texteVisible(arbre)).not.toContain('?');
  });

  test('🔒 SANS aucun placement, le composant se TAIT entierement', () => {
    // 🎯 LE GARDE-FOU DU LOT. Une convocation publiee sans composition (S5-c)
    // est un cas NORMAL : l onglet y montre sa liste « Convoqués ». Un terrain
    // vide donnerait a croire que la compo a ete perdue.
    const arbre = monter({ placements: [], snapshotPlayers: [KARIM], sportContext: 'football' });

    expect(arbre.toJSON()).toBeNull();
  });

  test('🔒 le jeton est CENTRE sur sa position, pas accroche par son coin', () => {
    // Sans les deux marges negatives, toute la compo glisse d un demi-jeton
    // vers le bas a droite — et un joueur pose sur la ligne parait hors du
    // terrain. C est invisible en revue de code, et flagrant a l ecran.
    // 🔄 COMPOLECT-2 : la moitie se prend sur le jeton de la CREATION (58 x 72),
    // plus sur l ancienne pastille de 28.
    const arbre = monter({
      placements: [{ playerId: 'joueur-1', positionX: 50, positionY: 90 }],
      snapshotPlayers: [KARIM],
      sportContext: 'football',
    });

    const [jeton] = jetons(arbre);
    const style = Object.assign({}, ...[jeton.props.style].flat(2).filter(Boolean));

    expect(style.left).toBe('50%');
    expect(style.top).toBe('90%');
    expect(style.marginLeft).toBe(-(JETON_TERRAIN.largeur / 2));
    expect(style.marginTop).toBe(-(JETON_TERRAIN.hauteur / 2));
  });

  test('le sport voyage jusqu au terrain : les traces suivent la discipline', () => {
    const arbre = monter({
      placements: [{ playerId: 'joueur-1', positionX: 50, positionY: 90 }],
      snapshotPlayers: [KARIM],
      sportContext: 'handball',
    });

    const [terrain] = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'terrain');

    expect(terrain.props.sport).toBe('handball');
  });
});

// ==========================================================================
// COMPOLECT-2 — « LES CARTES DES JOUEURS DOIVENT ETRE LES MEMES QU A LA CREATION »
//
// 🗣️ Adel, 27/08, capture a l appui : « on ne voit pas le banc et surtout les
// cartes des joueurs ne sont pas les bonnes : ca doit etre les memes que quand
// on cree la compo, avec la photo quand il y en a une. »
//
// 🧨 Ce que la capture montrait : une pastille bleue de 28 pt avec « JM », et
// AUCUN banc. Ce lot pose le jeton de la creation et fait descendre le banc.
// ==========================================================================
describe('COMPOLECT-2 · le jeton et le banc de la CREATION', () => {
  test('🥇 le jeton porte le PRENOM, comme a la creation', () => {
    const arbre = monter({
      placements: [{ playerId: 'joueur-1', positionX: 50, positionY: 90 }],
      snapshotPlayers: [KARIM],
      sportContext: 'football',
    });

    expect(texteVisible(arbre)).toContain('Karim');
  });

  test('🥇 avec une photo, c est la PHOTO qui s affiche — plus les initiales', () => {
    const arbre = monter({
      placements: [{ playerId: 'joueur-3', positionX: 50, positionY: 90 }],
      snapshotPlayers: [AVEC_PHOTO],
      sportContext: 'football',
    });

    const images = arbre.root.findAllByType(Image);

    expect(images.length).toBeGreaterThan(0);
    expect(String(images[0].props.source?.uri)).toContain('/uploads/karim.jpg');
    expect(texteVisible(arbre)).not.toContain('MC');
  });

  test('🥇 le BANC est la, avec ses jetons', () => {
    const arbre = monter({
      benchPlayers: [LEO],
      placements: [{ playerId: 'joueur-1', positionX: 50, positionY: 90 }],
      snapshotPlayers: [KARIM],
      sportContext: 'football',
    });

    expect(texteVisible(arbre)).toContain('REMPLAÇANTS · 1');
    expect(texteVisible(arbre)).toContain('Leo');
    expect(texteVisible(arbre)).toContain('Diarra');
  });

  test('🧨 le bandeau des remplacants reste la MEME quand le banc est VIDE', () => {
    // Un bandeau qui disparait a zero donne exactement la sensation « ce n est
    // pas le meme ecran que la creation ». Le plateau de creation, lui, le
    // garde — et ecrit la meme phrase.
    const arbre = monter({
      benchPlayers: [],
      placements: [{ playerId: 'joueur-1', positionX: 50, positionY: 90 }],
      snapshotPlayers: [KARIM],
      sportContext: 'football',
    });

    expect(texteVisible(arbre)).toContain('REMPLAÇANTS · 0');
    expect(texteVisible(arbre)).toContain('Tout le monde est sur le terrain.');
  });
});
