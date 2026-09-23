import { Text } from 'react-native';
import Svg from 'react-native-svg';
import renderer, { act } from 'react-test-renderer';

import RenderedTacticalField from '../RenderedTacticalField';

// ==========================================================================
// E6 — TÉMOIN CARACTÉRISANT, écrit AVANT de toucher ce fichier (aucun test ne
// le montait : ses 11 appelants le remplacent tous par une doublure).
//
// Puis le témoin du lot COMPOMSG, trouvé au banc de photos du 23/09 : sur le
// SITE, le dessin du terrain restait CARRÉ dans un cadre en portrait (mesuré :
// cadre 131 × 196, dessin 131 × 131 ; cadre 200 × 300, dessin 200 × 200). Un
// <svg> posé en absolu sans largeur ni hauteur prend le format de son viewBox ;
// les jetons, eux, se placent sur tout le cadre — ceux du bas tombaient SOUS
// le terrain dessiné. Sur l'iPhone, react-native-svg remplit déjà le cadre.
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

const rendre = (/** @type {any} */ enfants) => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <RenderedTacticalField sport="football" style={{ height: 196, width: 131 }}>
        {enfants}
      </RenderedTacticalField>,
    );
  });
  montes.push(arbre);
  return arbre;
};

afterEach(() => {
  act(() => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
});

describe('E6 · RenderedTacticalField — ce qu’il fait aujourd’hui', () => {
  test('un dessin étiré sur tout le cadre (viewBox 100 × 100, sans garder le ratio)', () => {
    const dessin = rendre(null).root.findByType(Svg);

    expect(dessin.props.viewBox).toBe('0 0 100 100');
    expect(dessin.props.preserveAspectRatio).toBe('none');
  });

  test('les jetons passent par-dessus le dessin', () => {
    const arbre = rendre(<Text>JETON</Text>);

    expect(arbre.root.findByType(Text).props.children).toBe('JETON');
  });
});

describe('COMPOMSG · le dessin REMPLIT son cadre, sur le site aussi', () => {
  test('🥇 le <svg> occupe 100 % de la largeur ET de la hauteur du cadre', () => {
    const dessin = rendre(null).root.findByType(Svg);

    expect(dessin.props.width).toBe('100%');
    expect(dessin.props.height).toBe('100%');
  });
});
