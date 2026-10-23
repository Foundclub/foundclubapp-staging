import fs from 'fs';
import path from 'path';
import vm from 'vm';

import { parseSync, traverse } from '@babel/core';
import { createElement } from 'react';
import {
  Keyboard, Platform, Text, View,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import BottomModal from '../BottomModal';

// Execute les fonctions INSTALLEES de Gorhom, extraites sans les recopier.
// Le moteur d'animation et les frontieres natives sont doubles : aucun rendu
// physique n'est revendique. La fermeture fautive passe par le vrai onClose
// du BottomSheetModal, puis le vrai onDismiss du composant FoundClub.
let mockSheetProps;
jest.mock('react-native-reanimated', () => ({ Easing: { exp: () => {}, out: (fn) => fn } }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 24, left: 0, right: 0, top: 54,
  }),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key) => key }),
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
    // CLAVREGLE : BottomModal lit le contexte interne de la feuille (absent ici).
    useBottomSheetInternal: () => null,
    BottomSheetBackdrop: () => null,
    BottomSheetModal: React.forwardRef((props, ref) => {
      mockSheetProps = props;
      React.useImperativeHandle(ref, () => ({ dismiss: () => {}, present: () => {} }));
      return React.createElement(NativeView, null, props.children);
    }),
    BottomSheetScrollView: NativeView,
    BottomSheetView: NativeView,
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
      Images: {},
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

/**
 * Extrait des fonctions nommees ou le calcul d'une valeur derivee.
 * @param {string} relativeFile Fichier installe.
 * @returns {Record<string, string>} Fonctions extraites sans modification.
 */
const functionsFrom = (relativeFile) => {
  const source = fs.readFileSync(path.join(LIBRARY, relativeFile), 'utf8');
  /** @type {Record<string, string>} */
  const functions = {};
  traverse(parseSync(source, { babelrc: false, configFile: false, sourceType: 'script' }), {
    FunctionExpression: ({ node }) => {
      if (node.id) functions[node.id.name] = source.slice(node.start, node.end);
    },
    VariableDeclarator: (/** @type {any} */ { node }) => {
      if (node.id.name === 'animatedContentHeightMax') {
        const callback = node.init.arguments[0];
        functions[node.id.name] = source.slice(callback.start, callback.end);
      }
    },
  });
  return functions;
};
const sheetFunctions = functionsFrom('components/bottomSheet/BottomSheet.js');
const modalFunctions = functionsFrom('components/bottomSheetModal/BottomSheetModal.js');
const contentFunctions = functionsFrom('components/bottomSheet/BottomSheetContent.js');

/**
 * Valeur partagee synchrone, sans moteur Reanimated.
 * @param {any} initial Etat initial.
 * @returns {any} Valeur partagee minimale.
 */
const shared = (initial) => {
  let value = initial;
  return {
    get: () => value,
    set: (update) => { value = typeof update === 'function' ? update(value) : update; },
    get value() { return value; },
    set value(next) { value = next; },
  };
};

/**
 * Monte le contrat FoundClub et conserve les callbacks clavier.
 * @param {any} props Reglages de la feuille.
 * @returns {{close: jest.Mock, tree: any}} Pilote du composant.
 */
const mountSheet = (props) => {
  let tree;
  const close = jest.fn();
  act(() => {
    tree = renderer.create(createElement(BottomModal, {
      close,
      isVisible: true,
      ...props,
    }, createElement(Text, null, 'Description')));
  });
  return { close, tree };
};

/**
 * Relie position, animation, fin d'animation et fermeture reels de Gorhom.
 * @param {any} props Reglages effectivement recus par Gorhom.
 * @returns {any} Pilote des fonctions installees.
 */
const keyboardCycle = (props) => {
  const containerHeight = 800;
  const detent = normalizeSnapPoint(props.snapPoints[0], containerHeight);
  let pendingAnimation;
  const onClose = jest.fn(props.onDismiss);
  /** @type {any} */
  const context = {
    __DEV__: false,
    _constants: constants,
    _providedAnimationConfigs: undefined,
    _providedIndex: 0,
    _providedOverrideReduceMotion: undefined,
    _reactNative: { Platform },
    _reactNativeGestureHandler: { State: { ACTIVE: 4 } },
    _reactNativeReanimated: { runOnJS: (fn) => fn },
    _utilities: {
      animate: ({ onComplete, point }) => { pendingAnimation = onComplete; return point; },
    },
    android_keyboardInputMode: props.android_keyboardInputMode,
    animatedAnimationState: shared({ source: constants.ANIMATION_SOURCE.NONE }),
    animatedContainerHeightDidChange: shared(false),
    animatedContentGestureState: shared(0),
    animatedCurrentIndex: shared(0),
    animatedDetentsState: shared({
      closedDetentPosition: containerHeight, detents: [detent], highestDetentPosition: detent,
    }),
    animatedHandleGestureState: shared(0),
    animatedKeyboardState: shared({
      heightWithinContainer: 0, status: constants.KEYBOARD_STATUS.HIDDEN,
    }),
    animatedLayoutState: shared({ containerHeight, handleHeight: 0 }),
    animatedPosition: shared(detent),
    animatedSheetHeight: shared(containerHeight - detent),
    enableDismissOnClose: true,
    handleOnAnimate: jest.fn(),
    handleOnChange: jest.fn(),
    isAnimatedOnMount: shared(true),
    isInTemporaryPosition: shared(false),
    keyboardBehavior: props.keyboardBehavior,
    keyboardBlurBehavior: props.keyboardBlurBehavior,
    minimized: { current: false },
    stopAnimation: jest.fn(),
    unmount: onClose,
  };
  const load = (source) => vm.runInNewContext(`(${source})`, context);
  context.handleOnClose = load(modalFunctions.handleBottomSheetOnClose);
  context.animateToPositionCompleted = load(sheetFunctions.animateToPositionCompleted);
  const evaluate = load(sheetFunctions.getEvaluatedPosition);
  const animate = load(sheetFunctions.animateToPosition);
  const contentHeight = load(contentFunctions.animatedContentHeightMax);
  const changeKeyboard = (status, height) => {
    context.animatedKeyboardState.set({ heightWithinContainer: height, status });
    const position = evaluate(constants.ANIMATION_SOURCE.KEYBOARD);
    animate(position, constants.ANIMATION_SOURCE.KEYBOARD);
    if (pendingAnimation) {
      const complete = pendingAnimation;
      pendingAnimation = undefined;
      complete(true);
    }
    return contentHeight();
  };
  return {
    changeKeyboard, contentHeight, context, detent, onClose,
  };
};

const originalOS = Platform.OS;
const originalVersion = Object.getOwnPropertyDescriptor(Platform, 'Version');
let listeners;
beforeEach(() => {
  Platform.OS = 'android';
  Object.defineProperty(Platform, 'Version', { configurable: true, get: () => 36 });
  listeners = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation((event, callback) => {
    listeners[event] = callback;
    return { remove: () => {} };
  });
});
afterEach(() => {
  Platform.OS = originalOS;
  Object.defineProperty(Platform, 'Version', originalVersion);
  jest.restoreAllMocks();
});

describe('Gorhom 5.2.4 — fermeture au focus d une grande feuille', () => {
  it.each(['78%', '84%', '86%'])('defaut installe en interactive, snap %s', (snap) => {
    const { close } = mountSheet({ snapPoints: [snap] });
    const cycle = keyboardCycle(mockSheetProps);
    act(() => cycle.changeKeyboard(constants.KEYBOARD_STATUS.SHOWN, 300));
    expect(cycle.context.animatedPosition.get()).toBe(0);
    expect(cycle.context.animatedCurrentIndex.get()).toBe(-1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it.each([
    [35, '78%'], [35, '84%'], [35, '86%'],
    [36, '78%'], [36, '84%'], [36, '86%'],
  ])('API %s snap %s : le mode Android choisi ne ferme plus la feuille', (api, snap) => {
    Object.defineProperty(Platform, 'Version', { configurable: true, get: () => api });
    const { close } = mountSheet({ androidKeyboardBehavior: 'extend', snapPoints: [snap] });
    act(() => listeners.keyboardDidShow({ endCoordinates: { height: 300 } }));
    expect(mockSheetProps.bottomInset).toBe(0);
    expect(mockSheetProps.enableDynamicSizing).toBe(false);
    const cycle = keyboardCycle(mockSheetProps);
    const closedContentHeight = cycle.contentHeight();
    for (let index = 0; index < 2; index += 1) {
      let openContentHeight;
      act(() => {
        openContentHeight = cycle.changeKeyboard(constants.KEYBOARD_STATUS.SHOWN, 300);
      });
      expect(close).not.toHaveBeenCalled();
      expect(cycle.context.animatedCurrentIndex.get()).toBe(0);
      expect(openContentHeight).toBe(closedContentHeight - 300);
      act(() => cycle.changeKeyboard(constants.KEYBOARD_STATUS.HIDDEN, 300));
      expect(cycle.context.animatedPosition.get()).toBe(cycle.detent);
      expect(cycle.contentHeight()).toBe(closedContentHeight);
    }
  });

  it.each([
    ['android', 34], ['ios', '18'], ['web', 'web'],
  ])('%s %s conserve interactive et son retrait existant', (os, version) => {
    Platform.OS = /** @type {any} */ (os);
    Object.defineProperty(Platform, 'Version', { configurable: true, get: () => version });
    mountSheet({ androidKeyboardBehavior: 'extend', snapPoints: ['78%'] });
    expect(mockSheetProps.keyboardBehavior).toBe('interactive');
    expect(mockSheetProps.bottomInset).toBe(0);
  });

  it('ne neutralise pas une vraie fermeture de la feuille', () => {
    const { close, tree } = mountSheet({ androidKeyboardBehavior: 'extend', snapPoints: ['78%'] });
    act(() => mockSheetProps.onDismiss());
    expect(close).toHaveBeenCalledTimes(1);
    expect(tree.root.findAllByType(View)).toHaveLength(0);
  });

  it('sans opt-in, une feuille dynamique garde son comportement et son dimensionnement', () => {
    mountSheet({});
    expect(mockSheetProps.keyboardBehavior).toBe('interactive');
    expect(mockSheetProps.enableDynamicSizing).toBe(true);
    expect(mockSheetProps.bottomInset).toBe(0);
  });

  it('respecte un adjustResize explicite meme si le formulaire demande extend', () => {
    mountSheet({ androidKeyboardBehavior: 'extend', androidKeyboardInputMode: 'adjustResize' });
    expect(mockSheetProps.keyboardBehavior).toBe('interactive');
    expect(mockSheetProps.android_keyboardInputMode).toBe('adjustResize');
  });
});
