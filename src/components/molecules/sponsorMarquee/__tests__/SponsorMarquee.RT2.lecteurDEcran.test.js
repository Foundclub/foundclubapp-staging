import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import SponsorMarquee from '../SponsorMarquee';

// RETOURS-TESTEUR-2 (06/11/2026, défaut 6 de CR-TRAIN5) — « CR-T5 Partenaire 1 » apparaissait
// 8 fois dans le texte de la carte d'équipe : le ruban répète la liste (au moins 4 éléments,
// en 2 copies) pour boucler sans trou. C'est voulu à l'œil ; un lecteur d'écran, lui, lisait les
// 8. Chaque partenaire n'est plus lu qu'une fois.

jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('@/utils/imageUrl', () => ({ getImageUrl: (/** @type {string} */ url) => url }));
jest.mock('@/theme/themeContext', () => {
  const vide = {};
  const rampe = () => new Proxy({}, { get: () => vide });
  return {
    __esModule: true,
    default: () => ({
      Alignments: rampe(),
      ApplicationStyle: new Proxy({}, { get: () => rampe() }),
      Colors: new Proxy({}, { get: (_c, cle) => `couleur-${String(cle)}` }),
      Fonts: rampe(),
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: new Proxy({}, { get: () => rampe() }),
    }),
  };
});

// Un nœud est-il caché du lecteur d'écran, lui ou un parent ?
const cache = (/** @type {any} */ noeud) => {
  for (let n = noeud; n; n = n.parent) {
    if (n.props?.accessibilityElementsHidden
      || n.props?.importantForAccessibility === 'no-hide-descendants') {
      return true;
    }
  }
  return false;
};

const nomsLus = (/** @type {any[]} */ sponsors) => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(<SponsorMarquee sponsors={sponsors} />); });
  // Les noms seulement (le logo sans image affiche une initiale).
  const noms = arbre.root.findAllByType(Text).filter((n) => String(n.props.children).length > 1);
  const lus = noms.filter((n) => !cache(n)).map((n) => n.props.children);
  const tous = noms.map((n) => n.props.children);
  act(() => arbre.unmount());
  return { lus, tous };
};

describe('Ruban des partenaires : chacun lu une seule fois', () => {
  it('un partenaire : 8 à l œil pour boucler, 1 seul lu', () => {
    const { lus, tous } = nomsLus([{ documentId: 'sp-1', logo: {}, title: 'CR-T5 Partenaire 1' }]);
    expect(tous).toHaveLength(8);
    expect(lus).toEqual(['CR-T5 Partenaire 1']);
  });

  it('deux partenaires : chacun lu une fois, dans l ordre', () => {
    const { lus } = nomsLus([
      { documentId: 'sp-1', logo: {}, title: 'Boulangerie Paul' },
      { documentId: 'sp-2', logo: {}, title: 'Garage Central' },
    ]);
    expect(lus).toEqual(['Boulangerie Paul', 'Garage Central']);
  });
});
