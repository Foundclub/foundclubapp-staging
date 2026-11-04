import { Keyboard, Platform, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import BottomModal from '../BottomModal';

// T3-CLAVIER-FEUILLES (04/11) : Android 15+, feuille sans cran, clavier ouvert. Mesuré à
// l'émulateur : la bibliothèque place la feuille d'une seule écriture, sans animation
// (setToPosition), et cette écriture peut ne jamais atteindre l'écran. La position lue vaut 226,
// la feuille reste affichée à 515, derrière le clavier : 7 ouvertures sur 8 à 3 boutons.
// Ce témoin décrit la relance, pas le rendu : le rendu se juge à l'émulateur.

/** @type {any} */
let mockInterne = null;
jest.mock('react-native-reanimated', () => ({ Easing: { exp: () => {}, out: (fn) => fn } }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 48, left: 0, right: 0, top: 52,
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (/** @type {string} */ cle) => cle }),
}));
jest.mock('@sbaiahmed1/react-native-blur', () => ({ BlurView: () => null }));
jest.mock('@/context/StartupPhaseContext', () => ({
  STARTUP_PHASES: { STEADY_STATE: 'steady' },
  useStartupPhase: () => ({ phase: 'steady' }),
}));
jest.mock('@gorhom/bottom-sheet', () => {
  const React = jest.requireActual('react');
  const { View: NativeView } = jest.requireActual('react-native');
  return {
    BottomSheetBackdrop: () => null,
    BottomSheetModal: React.forwardRef((/** @type {any} */ props, /** @type {any} */ ref) => {
      React.useImperativeHandle(ref, () => ({ dismiss: () => {}, present: () => {} }));
      return React.createElement(NativeView, null, props.children);
    }),
    BottomSheetScrollView: NativeView,
    BottomSheetView: NativeView,
    useBottomSheetInternal: () => mockInterne,
  };
});
jest.mock('@/theme/themeContext', () => {
  const Colors = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(Colors),
      Colors,
      Images: { close: 1 },
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

const POSITION = 226;
const LE_TEMPS_DE_LA_RELANCE = 1000;

/**
 * Valeur partagée réduite à ce que la feuille écrit.
 * @param {any} initial
 * @returns {any} La valeur et le nombre d'écritures.
 */
const valeur = (initial) => {
  const sv = {
    ecritures: 0,
    modify: (/** @type {(v: any) => any} */ f) => {
      sv.value = f(sv.value);
      sv.ecritures += 1;
    },
    value: initial,
  };
  return sv;
};

describe('T3-CLAVIER-FEUILLES : la position est réécrite après la réduction du conteneur', () => {
  /** @type {Record<string, (event?: any) => void>} */
  let ecoutes;
  /** @type {any} */
  let arbre;
  const plateforme = { OS: Platform.OS, Version: Platform.Version };

  /**
   * Monte une feuille sans cran sur la plateforme demandée.
   * @param {string} os
   * @param {number} version
   */
  const monter = (os, version) => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
    Object.defineProperty(Platform, 'Version', { configurable: true, value: version });
    act(() => {
      arbre = renderer.create(
        <BottomModal close={() => {}} isVisible>
          <Text>Contenu</Text>
        </BottomModal>,
      );
    });
  };

  /**
   * Annonce un mouvement du clavier.
   * @param {string} nom
   */
  const annoncer = (nom) => {
    act(() => {
      ecoutes[nom]?.({ endCoordinates: { height: 288 } });
    });
  };

  beforeEach(() => {
    jest.useFakeTimers();
    ecoutes = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation((
      /** @type {any} */ nom,
      /** @type {any} */ ecoute,
    ) => {
      ecoutes[nom] = ecoute;
      return /** @type {any} */ ({ remove: () => {} });
    });
    mockInterne = {
      animatedKeyboardState: valeur({}),
      animatedLayoutState: valeur({ containerHeight: 849 }),
      animatedPosition: valeur(POSITION),
    };
  });

  afterEach(() => {
    act(() => { arbre?.unmount(); });
    jest.useRealTimers();
    jest.restoreAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: plateforme.OS });
    Object.defineProperty(Platform, 'Version', { configurable: true, value: plateforme.Version });
  });

  test('Android 15+ : clavier ouvert, une écriture de plus, et la position revient exacte', () => {
    monter('android', 35);
    annoncer('keyboardDidShow');
    expect(mockInterne.animatedLayoutState.value.containerHeight).toBeLessThan(849);
    expect(mockInterne.animatedPosition.ecritures).toBe(0);

    act(() => { jest.advanceTimersByTime(LE_TEMPS_DE_LA_RELANCE); });

    expect(mockInterne.animatedPosition.ecritures).toBe(2);
    expect(mockInterne.animatedPosition.value).toBe(POSITION);
  });

  test('Android 15+ : clavier refermé, pareil', () => {
    monter('android', 35);
    annoncer('keyboardDidShow');
    act(() => { jest.advanceTimersByTime(LE_TEMPS_DE_LA_RELANCE); });
    annoncer('keyboardDidHide');
    act(() => { jest.advanceTimersByTime(LE_TEMPS_DE_LA_RELANCE); });

    expect(mockInterne.animatedPosition.ecritures).toBe(4);
    expect(mockInterne.animatedPosition.value).toBe(POSITION);
  });

  test('sans changement de conteneur, rien n\'est écrit', () => {
    monter('android', 35);
    act(() => { jest.advanceTimersByTime(LE_TEMPS_DE_LA_RELANCE); });
    expect(mockInterne.animatedPosition.ecritures).toBe(0);
  });

  test('feuille refermée avant la relance : plus aucune écriture', () => {
    monter('android', 35);
    annoncer('keyboardDidShow');
    act(() => { arbre.unmount(); });
    arbre = null;
    act(() => { jest.advanceTimersByTime(LE_TEMPS_DE_LA_RELANCE); });
    expect(mockInterne.animatedPosition.ecritures).toBe(0);
  });

  test('iPhone : pas de relance, le défaut n\'y a pas été vu', () => {
    monter('ios', 18);
    annoncer('keyboardWillShow');
    act(() => { jest.advanceTimersByTime(LE_TEMPS_DE_LA_RELANCE); });
    expect(mockInterne.animatedLayoutState.value.containerHeight).toBeLessThan(849);
    expect(mockInterne.animatedPosition.ecritures).toBe(0);
  });
});
