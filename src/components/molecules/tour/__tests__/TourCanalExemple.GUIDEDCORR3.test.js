import { createElement } from 'react';
import renderer, { act } from 'react-test-renderer';

import TourCanalExemple from '../TourCanalExemple';

// GUIDE-D-CORR-3, M1082 : le canal d'exemple du bonus 2. Comme les autres écrans d'exemple du guide
// (TourExemplesFinBonus.test.js), il n'importe aucun service : rien ne part, rien n'est créé.

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ valeurs) => (
      String(typeof repli === 'string' ? repli : cle).replace(
        /\{\{(\w+)\}\}/g,
        (_, nom) => String(valeurs?.[nom] ?? ''),
      )
    ),
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const couleurs = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: {},
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => () => null);
jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => {
  const { createElement: creer } = jest.requireActual('react');
  const { TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ onPress }) => creer(TouchableOpacity, { onPress, testID: 'retour' }),
  };
});
jest.mock('@/components/molecules/tour/TourTarget', () => {
  const { createElement: creer } = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children, id }) => creer(View, { testID: `ancre-${id}` }, children),
  };
});

const textes = (/** @type {any} */ arbre) => arbre.root
  .findAll((/** @type {any} */ n) => typeof n.props?.children === 'string')
  .map((/** @type {any} */ n) => n.props.children);

describe('TourCanalExemple', () => {
  it('le canal du club, dit « Exemple », avec ses deux ancres et la flèche', () => {
    const goBack = jest.fn();
    /** @type {any} */
    let arbre;
    act(() => {
      arbre = renderer.create(createElement(TourCanalExemple, {
        clubName: 'AS Test',
        navigation: { goBack },
      }));
    });
    ['ancre-ch-info', 'ancre-ch-input'].forEach((testID) => {
      expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === testID).length)
        .toBeGreaterThan(0);
    });
    expect(textes(arbre).join(' ')).toMatch(/AS Test/);
    expect(textes(arbre).join(' ')).toMatch(/Exemple/);
    act(() => {
      arbre.root.find((/** @type {any} */ n) => n.props?.testID === 'retour').props.onPress();
    });
    expect(goBack).toHaveBeenCalled();
  });
});
