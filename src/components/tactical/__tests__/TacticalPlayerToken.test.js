import { Image, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TacticalPlayerToken from '../TacticalPlayerToken';

// ==========================================================================
// E6 — TÉMOIN CARACTÉRISANT, écrit AVANT de toucher ce fichier (il n'avait
// aucun test). Il décrit ce que le jeton fait AUJOURD'HUI, pour que le lot
// COMPOMSG ne change que ce qu'il annonce.
//
// Puis le témoin du lot : sur la capture d'Adel du 23/09 (plein écran de la
// composition), « Anthony » et « Baptiste » se lisaient « Antho… » et
// « Bapti… ». La pastille du prénom fait 65 pt au plus, et l'iPhone agrandit
// le texte selon la taille choisie dans ses réglages : le prénom est coupé
// au lieu de rétrécir.
// ==========================================================================

jest.mock('@/theme/themeContext', () => {
  const colors = jest.requireActual('@/theme/colors').default;
  return {
    __esModule: true,
    default: () => ({ Colors: colors() }),
  };
});

/** @type {any[]} */
const montes = [];

const rendre = (/** @type {any} */ player, /** @type {boolean} */ isOnField) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<TacticalPlayerToken isOnField={isOnField} player={player} />);
  });
  montes.push(arbre);
  return arbre;
};

const textes = (/** @type {any} */ arbre) => arbre.root.findAllByType(Text)
  .map((/** @type {any} */ n) => String(n.props.children ?? ''));

afterEach(() => {
  act(() => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

describe('E6 · TacticalPlayerToken — ce qu’il fait aujourd’hui', () => {
  test('sur le terrain : la photo, le prénom, le numéro', () => {
    const arbre = rendre({
      avatar: '/uploads/a.jpg', firstname: 'Anthony', lastname: 'Casula', number: 7,
    }, true);

    expect(String(arbre.root.findByType(Image).props.source.uri)).toContain('/uploads/a.jpg');
    expect(textes(arbre)).toEqual(expect.arrayContaining(['Anthony', '7']));
  });

  test('sur le terrain sans photo : les initiales', () => {
    const arbre = rendre({ firstname: 'Baptiste', lastname: 'Honold' }, true);

    expect(arbre.root.findAllByType(Image)).toHaveLength(0);
    expect(textes(arbre)).toEqual(expect.arrayContaining(['BH', 'Baptiste']));
  });

  test('au banc : le prénom ET le nom', () => {
    const arbre = rendre({ firstname: 'Yanis', lastname: 'Ben Bairouk' }, false);

    expect(textes(arbre)).toEqual(expect.arrayContaining(['Yanis', 'Ben Bairouk']));
  });
});

describe('COMPOMSG · le prénom du terrain RÉTRÉCIT au lieu d’être coupé', () => {
  test('🥇 la pastille du prénom ajuste sa taille à la place disponible', () => {
    const arbre = rendre({ firstname: 'Anthony', lastname: 'Casula' }, true);
    const prenom = arbre.root.findAllByType(Text)
      .find((/** @type {any} */ n) => n.props.children === 'Anthony');

    expect(prenom.props.numberOfLines).toBe(1);
    expect(prenom.props.adjustsFontSizeToFit).toBe(true);
    expect(prenom.props.minimumFontScale).toBeLessThanOrEqual(0.7);
  });
});
