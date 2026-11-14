import { createElement } from 'react';
import {
  Dimensions, Keyboard, Platform, View,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import BottomModal from '../BottomModal';

// BOTTOMMODAL-PLAFOND (D41, 13/11) — LA BANDE VIDE EN BAS DES LONGUES FEUILLES.
//
// Sans `snapPoints`, `@gorhom/bottom-sheet` 5.2.4 donne à la feuille la hauteur de TOUT le contenu
// de sa zone qui défile (createBottomSheetScrollableComponent : `onContentSizeChange` →
// `setContentSize`), bornée à son conteneur moins `topInset` et `bottomInset`
// (useAnimatedDetents, useAnimatedLayout). La zone qui défile, elle, s'arrêtait à 70 % de l'ÉCRAN :
// tout le reste de la feuille était une bande vide, la dernière rangée coupée.
// Vu trois fois, réparé trois fois écran par écran : SUPADM (« Changer de compte », 23/10),
// INVIT2 (« Inviter dans l'équipe », 85 % de la fenêtre, 15/09), GUIDE-E-CORR-2 (« Actions
// d'équipe », 10/11). Ici, le défaut lui-même.
//
// ⚠️ Jest n'a pas de moteur de mise en page : il lit la CONTRAINTE posée sur la zone qui défile.
// Le rendu se constate sur un téléphone.

const INSET_HAUT = 47;
const INSET_BAS = 34;
const CLAVIER = 336;

jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({ t: (/** @type {string} */ cle) => cle }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 47,
  }),
}));

jest.mock('@sbaiahmed1/react-native-blur', () => ({ BlurView: () => null }));

jest.mock('@/context/StartupPhaseContext', () => ({
  STARTUP_PHASES: { SCREEN_LOCAL_PROMPTS: 'SCREEN_LOCAL_PROMPTS', STEADY_STATE: 'STEADY_STATE' },
  useStartupPhase: () => ({ phase: 'STEADY_STATE' }),
}));

jest.mock('@gorhom/bottom-sheet', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');

  return {
    BottomSheetBackdrop: () => null,
    BottomSheetModal: reactActuel.forwardRef(
      (/** @type {any} */ props, /** @type {any} */ ref) => {
        reactActuel.useImperativeHandle(ref, () => ({ dismiss: () => {}, present: () => {} }));
        return reactActuel.createElement(VueRN, { testID: 'feuille', ...props }, props.children);
      },
    ),
    BottomSheetScrollView: (/** @type {any} */ props) => reactActuel.createElement(
      VueRN,
      { ...props, testID: 'zone-defilante' },
      props.children,
    ),
    BottomSheetView: (/** @type {any} */ props) => reactActuel.createElement(
      VueRN,
      { ...props, testID: 'zone-fixe' },
      props.children,
    ),
    useBottomSheetInternal: () => null,
  };
});

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: { close: 1 },
      Spaces: espaces,
    }),
  };
});

/**
 * Aplatit un style RN (tableau, valeurs nulles) en un seul objet.
 * @param {any} style Style tel que passé au composant.
 * @returns {Record<string, any>} Le style résolu.
 */
const styleAplati = (style) => (Array.isArray(style)
  ? style.filter(Boolean).reduce((acc, part) => ({ ...acc, ...styleAplati(part) }), {})
  : (style || {}));

/** @type {any} */
let arbre;
/** @type {Record<string, Function>} */
let ecouteurs;
const systemeDOrigine = Platform.OS;

beforeEach(() => {
  ecouteurs = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation((
    /** @type {any} */ evenement,
    /** @type {any} */ rappel,
  ) => {
    ecouteurs[evenement] = rappel;
    return /** @type {any} */ ({ remove: () => { delete ecouteurs[evenement]; } });
  });
});

afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
  Platform.OS = systemeDOrigine;
  jest.restoreAllMocks();
});

/**
 * Monte une LONGUE feuille : contenu deux fois plus haut que l'écran.
 * @param {any} [props] Propriétés de la feuille.
 * @returns {{ feuille: any, zone: any }} La feuille et sa zone qui défile.
 */
const monter = (props = {}) => {
  act(() => {
    arbre = renderer.create(createElement(
      BottomModal,
      { close: () => {}, isVisible: true, ...props },
      createElement(View, { style: { height: Dimensions.get('screen').height * 2 } }),
    ));
  });
  const trouver = (/** @type {string} */ id) => arbre.root.findAll(
    (/** @type {any} */ noeud) => noeud.props?.testID === id,
  ).pop();
  return { feuille: trouver('feuille'), zone: trouver('zone-defilante') };
};

/**
 * Le plus haut que la bibliothèque laisse monter la feuille : fenêtre moins `topInset` et
 * `bottomInset` (conteneur de useAnimatedLayout).
 * @param {any} feuille La feuille montée.
 * @returns {number} En points.
 */
const plafondDeLaFeuille = (feuille) => Dimensions.get('window').height
  - feuille.props.topInset - feuille.props.bottomInset;

// Les trois feuilles du constat, avec leurs réglages SANS leur rustine de plafond.
const LES_TROIS_CAS = [
  ['SUPADM « Changer de compte »', {
    contentContainerStyle: { paddingBottom: 8 }, useSafeAreaBottomInset: false,
  }],
  ['INVIT2 « Inviter dans l équipe »', {}],
  ['GUIDE-E-CORR-2 « Actions d équipe »', { contentBottomPaddingOverride: INSET_BAS + 12 }],
];

describe('D41 — une longue feuille sans hauteur donnée remplit sa feuille, sans bande vide', () => {
  test.each(LES_TROIS_CAS)('%s : la zone qui défile a le plafond de la feuille', (_nom, props) => {
    const { feuille, zone } = monter(props);

    expect(feuille.props.topInset).toBe(INSET_HAUT + 20);
    expect(styleAplati(zone.props.style).maxHeight).toBe(plafondDeLaFeuille(feuille));
  });

  test('iPhone, clavier ouvert : la zone tient dans la feuille posée sur le clavier', () => {
    Platform.OS = 'ios';
    const { zone: avant } = monter({});
    expect(styleAplati(avant.props.style).maxHeight)
      .toBe(Dimensions.get('window').height - (INSET_HAUT + 20));

    act(() => ecouteurs.keyboardWillShow({ endCoordinates: { height: CLAVIER } }));
    const zone = arbre.root.findAll(
      (/** @type {any} */ noeud) => noeud.props?.testID === 'zone-defilante',
    ).pop();
    const feuille = arbre.root.findAll(
      (/** @type {any} */ noeud) => noeud.props?.testID === 'feuille',
    ).pop();

    expect(feuille.props.bottomInset).toBe(CLAVIER - INSET_BAS);
    expect(styleAplati(zone.props.style).maxHeight).toBe(plafondDeLaFeuille(feuille));
  });

  test('Android 14, clavier ouvert (`adjustResize`) : l ancien plafond, au point près', () => {
    Platform.OS = 'android';
    const versionDOrigine = Platform.Version;
    Object.defineProperty(Platform, 'Version', { configurable: true, get: () => 34 });
    try {
      const { zone: ferme } = monter({});
      expect(styleAplati(ferme.props.style).maxHeight)
        .toBe(Dimensions.get('window').height - (INSET_HAUT + 20));

      act(() => ecouteurs.keyboardDidShow({ endCoordinates: { height: CLAVIER } }));
      const zone = arbre.root.findAll(
        (/** @type {any} */ noeud) => noeud.props?.testID === 'zone-defilante',
      ).pop();

      expect(styleAplati(zone.props.style).maxHeight).toBe(Dimensions.get('screen').height * 0.7);
    } finally {
      Object.defineProperty(Platform, 'Version', {
        configurable: true, get: () => versionDOrigine,
      });
    }
  });

  // Les appelants qui DONNENT leur plafond le gardent, au point près.
  test('un plafond donné par l appelant est gardé tel quel', () => {
    const { zone } = monter({ maxContentHeightRatio: 0.85 });

    expect(styleAplati(zone.props.style).maxHeight).toBe(Dimensions.get('screen').height * 0.85);
  });

  test('une feuille à `snapPoints` reste en flex, sans plafond', () => {
    const { zone } = monter({ snapPoints: ['90%'] });
    const style = styleAplati(zone.props.style);

    expect(style.flex).toBe(1);
    expect(style.maxHeight).toBeUndefined();
  });

  test('une feuille courte n est pas agrandie : le plafond est un maximum, pas une hauteur', () => {
    const { zone } = monter({});
    const style = styleAplati(zone.props.style);

    expect(style.height).toBeUndefined();
    expect(style.minHeight).toBeUndefined();
  });
});
