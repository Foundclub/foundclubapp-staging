import { Text, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ConvocationFieldPreview from '../ConvocationFieldPreview';

/**
 * ⚽ S5-D (vague S) — LE TERRAIN D UNE CONVOCATION PUBLIEE.
 *
 * 🗣️ Adel, recette du 26/08 : « une fois la composition publiee, ca doit
 * afficher LE TERRAIN avec les joueurs places directement dans l onglet ».
 *
 * 🧨 CE FICHIER EXISTE PARCE QUE LE COMPOSANT EST NEUF, et il est neuf parce
 * que les jetons etaient reecrits chez CHAQUE appelant — trois fois au 26/08
 * (carte du tchat, ecran du joueur convoque, tableaux de detection). Un
 * quatrieme rendu dans `EventDetails` aurait fige un quatrieme endroit a
 * corriger le jour ou la forme d un placement change.
 *
 * ♻️ `RenderedTacticalField` est DOUBLE ici : ses traces SVG ont leur propre
 * filet. Ce qu on mesure, c est ce que ce composant-la ajoute — les jetons.
 *
 * ⚠️ CE QUE CE FILET NE PROUVE PAS : Jest ne met rien en page. Qu un jeton
 * tombe au bon endroit du terrain se voit a la recette, pas ici. Ce qui est
 * mesure, c est la POSITION DEMANDEE et le fait qu elle soit centree.
 */

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

const KARIM = { documentId: 'joueur-1', firstname: 'Karim', lastname: 'Sylla' };
const LEO = { documentId: 'joueur-2', firstname: 'Leo', lastname: 'Diarra' };

const monter = (/** @type {any} */ { placements, snapshotPlayers, sportContext }) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <ConvocationFieldPreview
        placements={placements}
        snapshotPlayers={snapshotPlayers}
        sportContext={sportContext}
      />,
    );
  });
  return arbre;
};

const jetons = (/** @type {any} */ arbre) => arbre.root
  .findAllByType(View)
  .filter((/** @type {any} */ noeud) => noeud.props?.style
    && JSON.stringify(noeud.props.style).includes('position'));

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

    const initiales = arbre.root.findAllByType(Text)
      .map((/** @type {any} */ noeud) => noeud.props.children);

    expect(initiales).toEqual(expect.arrayContaining(['KS', 'LD']));
  });

  test('🔒 un placement dont la personne est INCONNUE n ecrit pas de jeton vide', () => {
    // ⛔ Mieux vaut un jeton de moins qu une pastille anonyme sur le terrain :
    // un lecteur y verrait un joueur qu il n arrive pas a identifier.
    // (`buildConvocationFieldTokens` filtre deja a la source — on le fige ici.)
    const arbre = monter({
      placements: [
        { playerId: 'joueur-1', positionX: 50, positionY: 90 },
        { playerId: 'fantome', positionX: 10, positionY: 10 },
      ],
      snapshotPlayers: [KARIM],
      sportContext: 'football',
    });

    expect(arbre.root.findAllByType(Text)).toHaveLength(1);
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
    const arbre = monter({
      placements: [{ playerId: 'joueur-1', positionX: 50, positionY: 90 }],
      snapshotPlayers: [KARIM],
      sportContext: 'football',
    });

    const [jeton] = jetons(arbre);
    const style = Object.assign({}, ...[jeton.props.style].flat(2).filter(Boolean));

    expect(style.left).toBe('50%');
    expect(style.top).toBe('90%');
    expect(style.marginLeft).toBe(-(style.width / 2));
    expect(style.marginTop).toBe(-(style.height / 2));
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
