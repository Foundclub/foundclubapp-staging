import * as ReactNative from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ScreenContainerNatif from '../ScreenContainer';
import ScreenContainerSite from '../ScreenContainer.web';

// ==========================================================================
// DESIGN-DENSITE (20/11/2026, GO d'Adel d1 + d2) — la marge de page de la règle de densité :
// 16 px sur téléphone, 24 sur tablette, 40 sur ordinateur, posée UNE fois par le conteneur.
// OPT-IN (`densePadding`) en vague 0 : seuls les écrans du tournoi la demandent ; les autres
// écrans gardent 24 (ou 20 / 28 / 40 / 48 / 56 avec `responsivePadding`) jusqu'à la vague 1.
// Mesuré sur la recette 51 b : page d'équipe 24 + 24 = 48 px avant la première carte.
// ==========================================================================

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));
jest.mock('@/context/TourContext', () => ({ useTour: () => ({ tourBannerReservedSpace: 0 }) }));
jest.mock('@react-navigation/elements', () => ({
  // eslint-disable-next-line global-require
  HeaderHeightContext: require('react').createContext(0),
}));
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('@/navigation/commonOptions', () => ({ getFloatingTabBarScenePaddingBottom: () => 0 }));
jest.mock('@/theme/themeContext', () => {
  const colors = jest.requireActual('@/theme/colors').default;
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      Colors: colors(),
      Images: {},
    }),
  };
});

/** @type {any[]} */
const montes = [];
afterEach(() => {
  act(() => { montes.splice(0).forEach((arbre) => arbre.unmount()); });
  jest.restoreAllMocks();
});

/**
 * La plus grande marge latérale posée par le conteneur, à une largeur d'écran donnée.
 * @param {any} Conteneur
 * @param {number} largeur
 * @param {Record<string, any>} props
 * @returns {number}
 */
const margeA = (Conteneur, largeur, props) => {
  jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
    fontScale: 1, height: 800, scale: 2, width: largeur,
  });
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      // eslint-disable-next-line react/jsx-props-no-spreading
      <Conteneur {...props}><ReactNative.Text>CONTENU</ReactNative.Text></Conteneur>,
    );
  });
  montes.push(arbre);
  const marges = arbre.root.findAll((/** @type {any} */ n) => n.props?.style)
    .map((/** @type {any} */ n) => ReactNative.StyleSheet.flatten(n.props.style)?.paddingHorizontal)
    .filter((/** @type {any} */ v) => typeof v === 'number');
  return Math.max(0, ...marges);
};

describe('DESIGN-DENSITE · marge dense du conteneur du SITE', () => {
  test.each([[375, 16], [800, 24], [1280, 40], [1440, 40]])('🔴 à %i px : %i', (largeur, attendu) => {
    expect(margeA(ScreenContainerSite, largeur, { densePadding: true })).toBe(attendu);
  });

  test('🔒 sans la demande, rien ne bouge (24 par défaut, 48 en responsive à 1 280)', () => {
    expect(margeA(ScreenContainerSite, 375, {})).toBe(24);
    expect(margeA(ScreenContainerSite, 1280, { responsivePadding: true })).toBe(48);
  });
});

describe('DESIGN-DENSITE · marge dense du conteneur de l APP', () => {
  test.each([[375, 16], [390, 16], [430, 16], [800, 24]])('🔴 à %i px : %i', (largeur, attendu) => {
    expect(margeA(ScreenContainerNatif, largeur, { densePadding: true })).toBe(attendu);
  });

  test('🔒 sans la demande, rien ne bouge (24 à 390 px)', () => {
    expect(margeA(ScreenContainerNatif, 390, {})).toBe(24);
  });
});
