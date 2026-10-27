import fs from 'fs';
import path from 'path';
import vm from 'vm';

import { parseSync, traverse } from '@babel/core';
import { createElement } from 'react';
import {
  Keyboard, Platform, Text, TextInput,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import BottomModal from '../BottomModal';
import BottomModalWeb from '../BottomModal.web';

// ⌨️ CLAVPOP (27/10) — constat d'Adel (iPhone, TestFlight 2.6.81/2.6.82, 23:22) : création d'un
// club, étape 2/5, feuille « Adresse du club » (champ « Rechercher… », snap 86 %). Il touche le
// champ : le clavier s'ouvre, la feuille monte presque en haut de l'écran… puis se REFERME.
//
// LA CAUSE, dans `@gorhom/bottom-sheet` 5.2.4, ouverte par CLAVREGLE (a78d73d3) : la feuille
// déclare le champ (`animatedKeyboardState.target`), la bibliothèque suit donc le clavier en
// `interactive`. Elle place la feuille à `max(0, cran - clavier)` puis cherche son index par
// `detents.indexOf(position + clavier)` (BottomSheet animateToPosition). Deux cas où la position
// n'est PAS un cran ⇒ index -1 ⇒ fin d'animation `onClose` ⇒ le modal se démonte :
//   1. une feuille qui ne tient pas au-dessus du clavier (cran < clavier) est bornée à 0 ;
//   2. un cran qui change clavier ouvert (contenu dynamique : résultats, erreur) n'ajoute pas le
//      clavier à la recherche (source SNAP_POINT_CHANGE).
// Avant CLAVREGLE, sur iPhone, aucun champ n'était déclaré : ce chemin ne tournait jamais.
//
// Ce témoin exécute les fonctions INSTALLÉES de la bibliothèque (extraites de lib/commonjs, sans
// les recopier) : l'annonce du clavier (useAnimatedKeyboard), la position, l'animation, sa fin
// et la fermeture du modal. Seuls le moteur d'animation et la réaction au clavier (calcul de la
// part du clavier dans le conteneur, BottomSheet OnKeyboardStateChange) sont doublés. Aucun rendu
// physique n'est revendiqué : l'iPhone se vérifie sur l'appareil.

let mockSheetProps;
/** @type {any} */
let mockInterne = null;
jest.mock('react-native-reanimated', () => ({ Easing: { exp: () => {}, out: (fn) => fn } }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 47,
  }),
}));
jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({ t: (/** @type {string} */ cle) => cle }),
}));
jest.mock('react-dom', () => ({
  createPortal: (/** @type {any} */ enfant) => enfant,
}), { virtual: true });
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
      mockSheetProps = props;
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
      Fonts: jest.requireActual('@/theme/fonts').default(Colors),
      Images: { close: 1 },
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

const LIBRARY = path.join(
  path.dirname(require.resolve('@gorhom/bottom-sheet/package.json')),
  'lib/commonjs',
);
const constants = jest.requireActual('@gorhom/bottom-sheet/lib/commonjs/constants');
const { normalizeSnapPoint } = jest.requireActual(
  '@gorhom/bottom-sheet/lib/commonjs/utilities/normalizeSnapPoint',
);
const { ANIMATION_SOURCE, KEYBOARD_STATUS } = constants;

/**
 * Fonctions nommées d'un fichier installé, et l'annonce du clavier de useAnimatedKeyboard.
 * @param {string} relativeFile Fichier installé.
 * @returns {Record<string, string>} Sources extraites sans modification.
 */
const functionsFrom = (relativeFile) => {
  const source = fs.readFileSync(path.join(LIBRARY, relativeFile), 'utf8');
  /** @type {Record<string, string>} */
  const functions = {};
  traverse(parseSync(source, { babelrc: false, configFile: false, sourceType: 'script' }), {
    ArrowFunctionExpression: (/** @type {any} */ { node }) => {
      const noms = node.params.map((/** @type {any} */ p) => p.name).join();
      if (noms === 'status,height,duration,easing,bottomOffset') {
        functions.handleKeyboardEvent = source.slice(node.start, node.end);
      }
    },
    FunctionExpression: (/** @type {any} */ { node }) => {
      if (node.id) functions[node.id.name] = source.slice(node.start, node.end);
    },
  });
  return functions;
};
const sheetFunctions = functionsFrom('components/bottomSheet/BottomSheet.js');
const modalFunctions = functionsFrom('components/bottomSheetModal/BottomSheetModal.js');
const keyboardFunctions = functionsFrom('hooks/useAnimatedKeyboard.js');

/**
 * Valeur partagée synchrone, sans moteur Reanimated.
 * @param {any} initial État initial.
 * @returns {any} Valeur partagée minimale.
 */
const shared = (initial) => {
  let value = initial;
  return {
    get: () => value,
    set: (/** @type {any} */ update) => {
      value = typeof update === 'function' ? update(value) : update;
    },
    get value() { return value; },
    set value(next) { value = next; },
  };
};

// iPhone 15 : 844 pt, encoche 47 + topInset de la feuille 20 ⇒ conteneur 777 ; clavier 336.
const ECRAN = 844;
const CONTENEUR = ECRAN - 47 - 20;
const CLAVIER = 336;
const BARRE_DE_GESTES = 34;

/**
 * Monte une feuille FoundClub, branche son état clavier sur les fonctions installées.
 * @param {object} props Réglages de la feuille.
 * @param {number} hauteurFeuille Hauteur de la feuille sans clavier (crans dynamiques).
 * @returns {any} Pilote : toucher le champ, fermer le clavier, changer le contenu.
 */
const monter = (props, hauteurFeuille = 0) => {
  const close = jest.fn();
  /** @type {any} */
  let arbre;
  const animatedKeyboardState = shared({
    duration: 500,
    easing: 'keyboard',
    height: 0,
    heightWithinContainer: 0,
    status: KEYBOARD_STATUS.UNDETERMINED,
  });
  mockInterne = { animatedKeyboardState };
  act(() => {
    arbre = renderer.create(createElement(
      BottomModal,
      { close, isVisible: true, ...props },
      createElement(Text, null, 'Adresse du club'),
      createElement(TextInput, { testID: 'recherche' }),
    ));
  });
  const cran = mockSheetProps.snapPoints
    ? normalizeSnapPoint(mockSheetProps.snapPoints[0], CONTENEUR)
    : CONTENEUR - hauteurFeuille;
  let pendingAnimation;
  /** @type {any} */
  const context = {
    __DEV__: false,
    _constants: constants,
    _providedAnimationConfigs: undefined,
    _providedIndex: 0,
    _providedOverrideReduceMotion: undefined,
    _reactNative: { Platform },
    _reactNativeGestureHandler: { State: { ACTIVE: 4 } },
    _reactNativeReanimated: { runOnJS: (/** @type {any} */ fn) => fn },
    _utilities: {
      animate: (/** @type {any} */ { onComplete, point }) => {
        pendingAnimation = onComplete;
        return point;
      },
    },
    android_keyboardInputMode: mockSheetProps.android_keyboardInputMode,
    animatedAnimationState: shared({ source: ANIMATION_SOURCE.NONE }),
    animatedContainerHeightDidChange: shared(false),
    animatedContentGestureState: shared(0),
    animatedCurrentIndex: shared(0),
    animatedDetentsState: shared({
      closedDetentPosition: CONTENEUR, detents: [cran], highestDetentPosition: cran,
    }),
    animatedHandleGestureState: shared(0),
    animatedKeyboardState,
    animatedPosition: shared(cran),
    enableDismissOnClose: true,
    handleOnAnimate: jest.fn(),
    handleOnChange: jest.fn(),
    isAnimatedOnMount: shared(true),
    isInTemporaryPosition: shared(false),
    keyboardBehavior: mockSheetProps.keyboardBehavior,
    keyboardBlurBehavior: mockSheetProps.keyboardBlurBehavior,
    minimized: { current: false },
    state: animatedKeyboardState,
    stopAnimation: jest.fn(),
    temporaryCachedState: shared(null),
    unmount: () => mockSheetProps.onDismiss(),
  };
  const load = (/** @type {string} */ source) => vm.runInNewContext(`(${source})`, context);
  context.handleOnClose = load(modalFunctions.handleBottomSheetOnClose);
  context.animateToPositionCompleted = load(sheetFunctions.animateToPositionCompleted);
  const evaluate = load(sheetFunctions.getEvaluatedPosition);
  const animate = load(sheetFunctions.animateToPosition);
  const annoncer = load(keyboardFunctions.handleKeyboardEvent);
  const bouger = (/** @type {number} */ source) => {
    animate(evaluate(source), source);
    if (pendingAnimation) {
      const complete = pendingAnimation;
      pendingAnimation = undefined;
      complete(true);
    }
  };
  // Doublure de OnKeyboardStateChange : ne tourne que si l'état annoncé a changé.
  const reagir = () => {
    const { height, status } = animatedKeyboardState.get();
    if (status === KEYBOARD_STATUS.UNDETERMINED) return;
    const heightWithinContainer = height === 0
      ? 0
      : Math.abs(height - Math.abs(mockSheetProps.bottomInset));
    animatedKeyboardState.set((/** @type {any} */ etat) => ({ ...etat, heightWithinContainer }));
    bouger(ANIMATION_SOURCE.KEYBOARD);
  };
  const clavier = (/** @type {'Show' | 'Hide'} */ sens, /** @type {number} */ hauteur) => {
    const empreinte = () => animatedKeyboardState.get().status + animatedKeyboardState.get().height;
    const avant = empreinte();
    const statut = sens === 'Show' ? KEYBOARD_STATUS.SHOWN : KEYBOARD_STATUS.HIDDEN;
    const evenement = {
      duration: 250, endCoordinates: { height: hauteur, screenY: ECRAN - hauteur },
    };
    act(() => {
      annoncer(statut, hauteur, 250, 'keyboard', 0);
      listeners[`keyboardWill${sens}`]?.(evenement);
      listeners[`keyboardDid${sens}`]?.(evenement);
    });
    if (empreinte() !== avant) act(reagir);
  };
  return {
    arbre,
    close,
    context,
    cran,
    /**
     * Le contenu grandit clavier ouvert (résultats d'adresse) : nouveau cran dynamique.
     * @param {number} deCombien Hauteur gagnée par le contenu.
     */
    contenuQuiGrandit: (deCombien) => {
      const nouveau = context.animatedDetentsState.get().highestDetentPosition - deCombien;
      context.animatedDetentsState.set({
        closedDetentPosition: CONTENEUR, detents: [nouveau], highestDetentPosition: nouveau,
      });
      act(() => bouger(ANIMATION_SOURCE.SNAP_POINT_CHANGE));
    },
    fermerLeClavier: () => clavier('Hide', CLAVIER),
    /**
     * Combien la feuille est montée : par la bibliothèque (position) ou par son bas (bottomInset).
     * @returns {number} Remontée en points.
     */
    remontee: () => {
      const { highestDetentPosition } = context.animatedDetentsState.get();
      return (highestDetentPosition - context.animatedPosition.get())
        + (mockSheetProps.bottomInset || 0);
    },
    // Le doigt d'Adel sur « Rechercher… » : focus (remonte l'arbre), puis le clavier d'iOS.
    toucherLeChamp: () => {
      const champ = arbre.root.findByProps({ testID: 'recherche' });
      const ancetres = [];
      for (let noeud = champ.parent; noeud; noeud = noeud.parent) ancetres.unshift(noeud);
      const focus = { nativeEvent: { target: 101 } };
      act(() => ancetres.forEach((noeud) => noeud.props?.onFocusCapture?.(focus)));
      clavier('Show', CLAVIER);
    },
  };
};

const originalOS = Platform.OS;
/** @type {Record<string, Function>} */
let listeners;
beforeEach(() => {
  Platform.OS = 'ios';
  listeners = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation((
    /** @type {any} */ event,
    /** @type {any} */ callback,
  ) => {
    listeners[event] = callback;
    return /** @type {any} */ ({ remove: () => { delete listeners[event]; } });
  });
});
afterEach(() => {
  Platform.OS = originalOS;
  jest.restoreAllMocks();
});

describe('CLAVPOP — iPhone : toucher un champ ne referme plus la feuille', () => {
  it('« Adresse du club » (snap 86 %) : clavier ouvert, la feuille reste ouverte au-dessus', () => {
    const feuille = monter({ snapPoints: ['86%'] });
    feuille.toucherLeChamp();
    expect(feuille.close).not.toHaveBeenCalled();
    expect(feuille.context.animatedCurrentIndex.get()).toBe(0);
    expect(feuille.remontee()).toBeGreaterThanOrEqual(CLAVIER - BARRE_DE_GESTES);
    feuille.fermerLeClavier();
    expect(feuille.close).not.toHaveBeenCalled();
    expect(feuille.remontee()).toBe(0);
    act(() => feuille.arbre.unmount());
  });

  it('grande feuille à hauteur automatique (700 pt) : reste ouverte', () => {
    const feuille = monter({}, 700);
    feuille.toucherLeChamp();
    expect(feuille.close).not.toHaveBeenCalled();
    expect(feuille.context.animatedCurrentIndex.get()).toBe(0);
    act(() => feuille.arbre.unmount());
  });

  it('petite feuille : le contenu grandit clavier ouvert (résultats) ⇒ reste ouverte', () => {
    const feuille = monter({}, 260);
    feuille.toucherLeChamp();
    feuille.contenuQuiGrandit(120);
    expect(feuille.close).not.toHaveBeenCalled();
    expect(feuille.context.animatedCurrentIndex.get()).toBe(0);
    act(() => feuille.arbre.unmount());
  });

  // Ce que CLAVREGLE a gagné, vert avant comme après : une feuille qui tient monte au-dessus
  // du clavier, puis redescend.
  it('petite feuille (260 pt) : monte au-dessus du clavier, redescend à sa fermeture', () => {
    const feuille = monter({}, 260);
    feuille.toucherLeChamp();
    expect(feuille.close).not.toHaveBeenCalled();
    expect(feuille.remontee()).toBeGreaterThanOrEqual(CLAVIER - BARRE_DE_GESTES);
    feuille.fermerLeClavier();
    expect(feuille.remontee()).toBe(0);
    act(() => feuille.arbre.unmount());
  });

  it('une vraie fermeture (glissement, fond) ferme toujours', () => {
    const feuille = monter({ snapPoints: ['86%'] });
    act(() => mockSheetProps.onDismiss());
    expect(feuille.close).toHaveBeenCalledTimes(1);
  });
});

describe('CLAVPOP — site : la feuille ne se ferme pas au clavier', () => {
  it('« Adresse du club » (86 %) : zone visible réduite de 336, feuille toujours là', () => {
    const avant = { innerHeight: window.innerHeight, visualViewport: window.visualViewport };
    /** @type {Record<string, Function>} */
    const ecouteurs = {};
    const zone = {
      addEventListener: (/** @type {string} */ nom, /** @type {Function} */ rappel) => {
        ecouteurs[nom] = rappel;
      },
      height: ECRAN,
      offsetTop: 0,
      removeEventListener: (/** @type {string} */ nom) => { delete ecouteurs[nom]; },
      scale: 1,
    };
    Object.assign(/** @type {any} */ (window), { innerHeight: ECRAN, visualViewport: zone });
    const close = jest.fn();
    /** @type {any} */
    let arbre;
    act(() => {
      arbre = renderer.create(createElement(
        BottomModalWeb,
        { close, isVisible: true, snapPoints: ['86%'] },
        createElement(TextInput, { testID: 'recherche' }),
      ));
    });
    act(() => {
      zone.height = ECRAN - CLAVIER;
      ecouteurs.resize?.();
    });
    expect(close).not.toHaveBeenCalled();
    expect(arbre.root.findAllByProps({ testID: 'recherche' }).length).toBeGreaterThan(0);
    act(() => arbre.unmount());
    Object.assign(/** @type {any} */ (window), avant);
  });
});
