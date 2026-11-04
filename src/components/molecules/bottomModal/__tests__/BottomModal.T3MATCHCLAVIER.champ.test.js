import { createElement } from 'react';
import {
  Dimensions, Keyboard, Platform, StyleSheet, Text,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import BottomModal from '../BottomModal';

// T3-MATCH-CLAVIER (04/11) : Android 15+, longue feuille, « Commentaire privé » de la feuille de
// match. Android ne fait défiler le champ touché qu'à son focus, quand le clavier n'est pas encore
// là : mesuré à l'émulateur, champ à 1703 px, clavier à 1538 px, plus rien ne le ramenait. Et la
// zone qui défile gardait sa hauteur d'avant le clavier : le bas du contenu restait inaccessible.
// Les mesures du témoin sont celles relevées à l'émulateur : measureInWindow voit la feuille 54
// points trop haut (zone à 114, affichée à 168). Un calcul qui s'y fie laisse le champ dessous.
// Ce témoin décrit le calcul, pas le rendu : le rendu se juge à l'émulateur.

const mockDefiler = jest.fn();
/** @type {any} */
let mockInterne = null;
/** @type {Record<string, { h: number, y: number }>} */
let mockMesures = {};
/**
 * Un noeud qui répond à measureInWindow.
 * @param {string} nom
 * @returns {{ measureInWindow: (rappel: Function) => void }} Le noeud.
 */
const mockNoeud = (nom) => ({
  measureInWindow: (/** @type {Function} */ rappel) => {
    rappel(0, mockMesures[nom].y, 300, mockMesures[nom].h);
  },
});

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
    BottomSheetScrollView: React.forwardRef((
      /** @type {any} */ props,
      /** @type {any} */ ref,
    ) => {
      React.useImperativeHandle(ref, () => ({ ...mockNoeud('zone'), scrollTo: mockDefiler }));
      return React.createElement(NativeView, { ...props, testID: 'zone-qui-defile' });
    }),
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

// Pixel 9, Android 16, 3 boutons : écran de 923 points, clavier annoncé à 288 (barre déduite).
const ECRAN = 923;
const CLAVIER_ANNONCE = 288;
// Haut réel du clavier : 923 - 288 - 48 de barre de navigation.
const HAUT_DU_CLAVIER = 587;
const MARGE = 12;
const HAUT_DU_CONTENEUR = 72;
const POSITION_DE_LA_FEUILLE = 96;
const HAUT_VU_PAR_LA_MESURE = 114;
const CHAMP_SOUS_LE_CLAVIER = { h: 72, y: 594 };
const LE_TEMPS_DU_CLAVIER = 1000;

describe('T3-MATCH-CLAVIER : le champ touché défile au-dessus du clavier', () => {
  /** @type {Record<string, (event?: any) => void>} */
  let ecoutes;
  /** @type {any} */
  let arbre;
  const plateforme = { OS: Platform.OS, Version: Platform.Version };

  /**
   * Monte une feuille et lui donne le focus d'un champ.
   * @param {object} [options]
   * @param {string} [options.os]
   * @param {number} [options.version]
   * @param {object} [options.props]
   */
  const monter = ({ os = 'android', props = {}, version = 35 } = {}) => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
    Object.defineProperty(Platform, 'Version', { configurable: true, value: version });
    act(() => {
      arbre = renderer.create(
        createElement(BottomModal, {
          close: () => {},
          isVisible: true,
          ...props,
        }, createElement(Text, null, 'Contenu')),
        { createNodeMock: () => mockNoeud('repere') },
      );
    });
  };

  /** Le champ prend le focus, comme à l'écran. */
  const toucherLeChamp = () => {
    // La doublure jest de View ne répond jamais à measureInWindow.
    arbre.root.findAll((/** @type {any} */ n) => n.props?.pointerEvents === 'none' && n.instance)
      .forEach((/** @type {any} */ n) => {
        // eslint-disable-next-line no-param-reassign
        n.instance.measureInWindow = mockNoeud('repere').measureInWindow;
      });
    arbre.root.findAll((/** @type {any} */ n) => n.props?.onFocusCapture && n.instance)
      .forEach((/** @type {any} */ n) => {
        // eslint-disable-next-line no-param-reassign
        n.instance.measureInWindow = mockNoeud('enveloppe').measureInWindow;
      });
    const enveloppe = arbre.root.findAll((/** @type {any} */ n) => n.props?.onFocusCapture)[0];
    act(() => {
      enveloppe.props.onFocusCapture({ nativeEvent: { target: 7 }, target: mockNoeud('champ') });
    });
  };

  /**
   * Annonce le clavier puis laisse passer le temps de la feuille.
   * @param {string} [nom]
   */
  const ouvrirLeClavier = async (nom = 'keyboardDidShow') => {
    act(() => { ecoutes[nom]?.({ endCoordinates: { height: CLAVIER_ANNONCE } }); });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(LE_TEMPS_DU_CLAVIER);
    });
  };

  beforeEach(() => {
    jest.useFakeTimers();
    mockDefiler.mockClear();
    mockMesures = {
      champ: CHAMP_SOUS_LE_CLAVIER,
      enveloppe: { h: 561, y: HAUT_VU_PAR_LA_MESURE },
      repere: { h: 0, y: HAUT_VU_PAR_LA_MESURE },
      zone: { h: 561, y: HAUT_VU_PAR_LA_MESURE },
    };
    mockInterne = {
      animatedKeyboardState: { get: () => ({}), set: () => {} },
      animatedLayoutState: { modify: () => {} },
      animatedPosition: { get: () => POSITION_DE_LA_FEUILLE, modify: () => {} },
    };
    ecoutes = {};
    jest.spyOn(Keyboard, 'addListener').mockImplementation((
      /** @type {any} */ nom,
      /** @type {any} */ ecoute,
    ) => {
      ecoutes[nom] = ecoute;
      return /** @type {any} */ ({ remove: () => {} });
    });
    const get = Dimensions.get.bind(Dimensions);
    jest.spyOn(Dimensions, 'get').mockImplementation((/** @type {any} */ quoi) => ({
      ...get(quoi), height: ECRAN,
    }));
  });

  afterEach(() => {
    act(() => { arbre?.unmount(); });
    jest.useRealTimers();
    jest.restoreAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: plateforme.OS });
    Object.defineProperty(Platform, 'Version', { configurable: true, value: plateforme.Version });
  });

  test('champ sous le clavier : il remonte juste au-dessus, avec une marge', async () => {
    monter();
    toucherLeChamp();
    await ouvrirLeClavier();
    expect(mockDefiler).toHaveBeenCalledTimes(1);
    const haut = HAUT_DU_CONTENEUR + POSITION_DE_LA_FEUILLE;
    const bas = haut + (CHAMP_SOUS_LE_CLAVIER.y - HAUT_VU_PAR_LA_MESURE) + CHAMP_SOUS_LE_CLAVIER.h;
    expect(mockDefiler.mock.calls[0][0]).toEqual({
      animated: true,
      y: bas + MARGE - HAUT_DU_CLAVIER,
    });
  });

  test('zone déjà défilée : le calcul part de sa position', async () => {
    mockMesures.repere = { h: 0, y: HAUT_VU_PAR_LA_MESURE - 68 };
    monter();
    toucherLeChamp();
    await ouvrirLeClavier();
    expect(mockDefiler.mock.calls[0][0].y).toBe(68 + 145);
  });

  test('champ déjà au-dessus du clavier : rien ne bouge', async () => {
    mockMesures.champ = { h: 72, y: 250 };
    monter();
    toucherLeChamp();
    await ouvrirLeClavier();
    expect(mockDefiler).not.toHaveBeenCalled();
  });

  test('clavier ouvert sans champ de la feuille : rien ne bouge', async () => {
    monter();
    await ouvrirLeClavier();
    expect(mockDefiler).not.toHaveBeenCalled();
  });

  test('clavier ouvert, la zone qui défile ne dépasse plus la place restante', async () => {
    monter({ props: { maxContentHeightRatio: 0.85 } });
    const hauteur = () => StyleSheet.flatten(
      arbre.root.findByProps({ testID: 'zone-qui-defile' }).props.style,
    ).maxHeight;
    expect(hauteur()).toBeCloseTo(ECRAN * 0.85);
    toucherLeChamp();
    await ouvrirLeClavier();
    // 923 - barre d'état 52 - 20 - clavier posé 288.
    expect(hauteur()).toBe(563);
  });

  test('iPhone : pas de défilement ajouté, ce lot n\'y a rien mesuré', async () => {
    monter({ os: 'ios', version: 18 });
    toucherLeChamp();
    await ouvrirLeClavier('keyboardWillShow');
    expect(mockDefiler).not.toHaveBeenCalled();
  });

  test('Android 14 : la fenêtre rétrécit, rien de neuf', async () => {
    monter({ version: 34 });
    toucherLeChamp();
    await ouvrirLeClavier();
    expect(mockDefiler).not.toHaveBeenCalled();
  });

  test('feuille en extend : la bibliothèque s\'en charge, rien de neuf', async () => {
    monter({ props: { androidKeyboardBehavior: 'extend' } });
    toucherLeChamp();
    await ouvrirLeClavier();
    expect(mockDefiler).not.toHaveBeenCalled();
  });

  test('feuille sans zone qui défile : rien de neuf', async () => {
    monter({ props: { scrollable: false } });
    toucherLeChamp();
    await ouvrirLeClavier();
    expect(mockDefiler).not.toHaveBeenCalled();
  });
});
