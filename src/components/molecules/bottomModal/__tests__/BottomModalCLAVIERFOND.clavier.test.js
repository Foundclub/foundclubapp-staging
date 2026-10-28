import fs from 'fs';
import path from 'path';
import vm from 'vm';

import { parseSync, traverse } from '@babel/core';
import {
  createElement, forwardRef, useEffect, useImperativeHandle, useState,
} from 'react';
import {
  Dimensions, Keyboard, Platform, Text, TextInput, View,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import BottomModal from '../BottomModal';

// ⌨️ CLAVIER-FOND (28/10) — constat d'Adel (iPhone, TestFlight 2.6.84, 21:42) : fiche d'un match,
// « Nommer l'adversaire » (snap 52 %). Le clavier s'ouvre, la feuille NE BOUGE PAS : son bord haut
// reste à mi-écran, le clavier recouvre le champ.
//
// LA CAUSE, dans `@gorhom/bottom-sheet` 5.2.4 : CLAVPOP pose la feuille sur le clavier par
// `bottomInset`, en comptant sur la bibliothèque pour « réduire le conteneur et recalculer ses
// crans ». Elle ne le fait pas. La hauteur du conteneur (`animatedLayoutState.containerHeight`)
// n'est recalculée que par une réaction à la hauteur MESURÉE (hooks/useAnimatedLayout), qui sort
// tout de suite si cette mesure n'a pas changé (`result === previous`). Un `bottomInset` neuf
// relance la réaction (dépendance `verticalInset`), mais Reanimated garde `previous` d'un
// enregistrement à l'autre (hook/useAnimatedReaction) : même mesure ⇒ sortie, conteneur et crans
// inchangés ⇒ aucune animation. Seul le cadre du conteneur raccourcit (style `bottom`) : le haut
// de la feuille reste où il était.
//
// Ce témoin exécute le code INSTALLÉ : `useAnimatedLayout` et `useAnimatedDetents` de la
// bibliothèque (lib/commonjs), et `useAnimatedReaction` de Reanimated (extrait de lib/module,
// sans le recopier). Seul le moteur des valeurs partagées est doublé (synchrone : chaque écriture
// relance les réactions). La position de la feuille est celle que la bibliothèque prend à
// l'index 0, hors
// suivi du clavier (BottomSheet getEvaluatedPosition : `detents[currentIndex]`). Aucun rendu
// physique n'est revendiqué : l'iPhone se vérifie au simulateur (.maestro/clavier-iphone).

/** @type {Set<Function>} */
const mockMappers = new Set();
let mockFlushing = false;
let mockDirty = false;
const mockFlush = () => {
  mockDirty = true;
  if (mockFlushing) return;
  mockFlushing = true;
  for (let tour = 0; mockDirty && tour < 20; tour += 1) {
    mockDirty = false;
    [...mockMappers].forEach((mapper) => mapper());
  }
  mockFlushing = false;
};
/**
 * Valeur partagée synchrone : toute écriture relance les réactions enregistrées.
 * @param {any} initial État initial.
 * @returns {any} Valeur partagée minimale.
 */
const mockShared = (initial) => {
  let value = initial;
  const sv = {
    get: () => value,
    modify: (/** @type {Function} */ modifier) => {
      value = modifier(value);
      mockFlush();
    },
    set: (/** @type {any} */ next) => {
      value = typeof next === 'function' ? next(value) : next;
      mockFlush();
    },
    get value() { return value; },
    set value(next) {
      value = next;
      mockFlush();
    },
  };
  return sv;
};

/** @type {any} */
let mockUseAnimatedReaction;
jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual('react');
  return {
    Easing: { exp: () => {}, out: (/** @type {any} */ fn) => fn },
    makeMutable: (/** @type {any} */ v) => mockShared(v),
    useAnimatedReaction: (...args) => mockUseAnimatedReaction(...args),
    // Valeur dérivée : recalculée à chaque lecture (jamais périmée, comme sur le fil UI).
    useDerivedValue: (/** @type {Function} */ fn) => ({ get: fn, get value() { return fn(); } }),
    useSharedValue: (/** @type {any} */ v) => React.useState(() => mockShared(v))[0],
    withSpring: jest.fn(),
    withTiming: jest.fn(),
  };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 47,
  }),
}));
jest.mock('react-i18next', () => ({
  initReactI18next: { init: () => {}, type: '3rdParty' },
  useTranslation: () => ({ t: (/** @type {string} */ cle) => cle }),
}));
jest.mock('@sbaiahmed1/react-native-blur', () => ({ BlurView: () => null }));
jest.mock('@/context/StartupPhaseContext', () => ({
  STARTUP_PHASES: { STEADY_STATE: 'steady' },
  useStartupPhase: () => ({ phase: 'steady' }),
}));
/** @type {any} */
let mockInterne = null;
jest.mock('@gorhom/bottom-sheet', () => {
  const React = jest.requireActual('react');
  const { View: NativeView } = jest.requireActual('react-native');
  const HOOKS = '@gorhom/bottom-sheet/lib/commonjs/hooks';
  const { useAnimatedLayout } = jest.requireActual(`${HOOKS}/useAnimatedLayout`);
  const { useAnimatedDetents } = jest.requireActual(`${HOOKS}/useAnimatedDetents`);
  // BottomSheetModal 5.2.4 : couches de mise en page de la bibliothèque, réglages de la feuille.
  const Feuille = React.forwardRef((/** @type {any} */ props, /** @type {any} */ ref) => {
    const [fournisseur] = React.useState(() => mockShared({
      height: 844,
      offset: {
        bottom: 0, left: 0, right: 0, top: 0,
      },
    }));
    const layout = useAnimatedLayout(
      fournisseur,
      props.topInset ?? 0,
      props.bottomInset ?? 0,
      true,
      props.handleComponent === null,
    );
    const detents = useAnimatedDetents(
      props.snapPoints,
      layout,
      props.enableDynamicSizing,
      undefined,
      false,
      true,
      props.bottomInset ?? 0,
    );
    React.useImperativeHandle(ref, () => ({ dismiss: () => {}, present: () => {} }));
    mockInterne = {
      animatedDetentsState: detents,
      animatedKeyboardState: mockInterne?.animatedKeyboardState ?? mockShared({ status: 0 }),
      animatedLayoutState: layout,
    };
    return React.createElement(NativeView, null, props.children);
  });
  return {
    BottomSheetBackdrop: () => null,
    BottomSheetModal: Feuille,
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

// `useAnimatedReaction` INSTALLÉ (Reanimated 3.19.5) : `previous` survit à un nouvel
// enregistrement.
const REANIMATED = path.dirname(require.resolve('react-native-reanimated/package.json'));
const sourceReaction = fs.readFileSync(
  path.join(REANIMATED, 'lib/module/hook/useAnimatedReaction.js'),
  'utf8',
);
let texteReaction = '';
traverse(parseSync(sourceReaction, {
  babelrc: false, configFile: false, sourceType: 'module',
}), {
  FunctionDeclaration: (/** @type {any} */ { node }) => {
    if (node.id?.name !== 'useAnimatedReaction') return;
    texteReaction = sourceReaction.slice(node.start, node.end);
  },
});
mockUseAnimatedReaction = vm.runInNewContext(`(${texteReaction})`, {
  Object,
  shouldBeUseWeb: () => false,
  startMapper: (/** @type {Function} */ mapper) => {
    mockMappers.add(mapper);
    mapper();
    return mapper;
  },
  stopMapper: (/** @type {Function} */ mapper) => { mockMappers.delete(mapper); },
  useEffect,
  useSharedValue: (/** @type {any} */ v) => useState(() => mockShared(v))[0],
});

// iPhone 15 : 844 pt, encoche 47 + 20 de marge haute ⇒ conteneur 777 ; clavier 336 (barre de
// gestes 34 comprise).
const ECRAN = 844;
const HAUT = 47 + 20;
const CLAVIER = 336;
const BARRE_DE_GESTES = 34;
const HAUT_DU_CLAVIER = ECRAN - CLAVIER;

// Contenu mesuré par la bibliothèque (hauteur automatique) : posé une fois la feuille montée.
const Contenu = forwardRef((/** @type {any} */ { hauteur }, /** @type {any} */ ref) => {
  useImperativeHandle(ref, () => ({}));
  useEffect(() => {
    if (!hauteur) return;
    mockInterne.animatedLayoutState.modify((/** @type {any} */ etat) => ({
      ...etat, contentHeight: hauteur,
    }));
  }, [hauteur]);
  return createElement(View, null, createElement(TextInput, { testID: 'champ' }));
});

/** @type {Record<string, Function>} */
let listeners;
/**
 * Monte une feuille FoundClub (iPhone) ; la bibliothèque calcule sa géométrie à l'écran.
 * @param {object} props Réglages de la feuille.
 * @param {number} [hauteurContenu] Hauteur mesurée du contenu (hauteur automatique).
 * @returns {any} Pilote.
 */
const monter = (props, hauteurContenu = 0) => {
  const close = jest.fn();
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(createElement(
      BottomModal,
      { close, isVisible: true, ...props },
      createElement(Text, null, 'Nommer l\'adversaire'),
      createElement(Contenu, { hauteur: hauteurContenu }),
    ));
  });
  const geometrie = () => {
    const { containerHeight } = mockInterne.animatedLayoutState.get();
    const { detents } = mockInterne.animatedDetentsState.get();
    const position = detents[0];
    return {
      bas: HAUT + containerHeight,
      hauteur: containerHeight - position,
      index: detents.indexOf(position),
      // Haut de la feuille, à l'écran (le conteneur commence sous `topInset`).
      haut: HAUT + position,
    };
  };
  const clavier = (/** @type {'Show' | 'Hide'} */ sens) => {
    const evenement = {
      duration: 250, endCoordinates: { height: CLAVIER, screenY: HAUT_DU_CLAVIER },
    };
    act(() => {
      listeners[`keyboardWill${sens}`]?.(evenement);
      listeners[`keyboardDid${sens}`]?.(evenement);
    });
  };
  return {
    arbre,
    close,
    fermerLeClavier: () => clavier('Hide'),
    geometrie,
    ouvrirLeClavier: () => clavier('Show'),
  };
};

const originalOS = Platform.OS;
beforeEach(() => {
  Platform.OS = 'ios';
  listeners = {};
  mockInterne = null;
  mockMappers.clear();
  jest.spyOn(Dimensions, 'get').mockReturnValue({
    fontScale: 1, height: ECRAN, scale: 3, width: 390,
  });
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

describe('CLAVIER-FOND — iPhone : la feuille monte sur le clavier (bibliothèque installée)', () => {
  it("« Nommer l'adversaire » (52 %) : posée sur le clavier, même hauteur", () => {
    const feuille = monter({ onOpened: jest.fn(), snapPoints: ['52%'] });
    const avant = feuille.geometrie();
    expect(avant.bas).toBe(ECRAN);
    expect(avant.hauteur).toBeCloseTo(0.52 * (ECRAN - HAUT), 0);

    feuille.ouvrirLeClavier();
    const apres = feuille.geometrie();
    // Le bas de la feuille au haut du clavier ; la barre de gestes reste dans la marge du contenu.
    expect(apres.bas).toBe(HAUT_DU_CLAVIER + BARRE_DE_GESTES);
    expect(apres.haut).toBeLessThan(avant.haut - (CLAVIER - BARRE_DE_GESTES) + 2);
    expect(apres.hauteur).toBeCloseTo(avant.hauteur, 0);
    expect(apres.index).toBe(0);
    expect(feuille.close).not.toHaveBeenCalled();

    feuille.fermerLeClavier();
    expect(feuille.geometrie()).toEqual(avant);
    act(() => feuille.arbre.unmount());
  });

  it('hauteur automatique (contenu 300 pt) : monte de toute la hauteur du clavier', () => {
    const feuille = monter({}, 300);
    const avant = feuille.geometrie();
    expect(avant.hauteur).toBe(300);
    feuille.ouvrirLeClavier();
    const apres = feuille.geometrie();
    expect(apres.bas).toBe(HAUT_DU_CLAVIER + BARRE_DE_GESTES);
    expect(apres.hauteur).toBe(300);
    expect(apres.index).toBe(0);
    feuille.fermerLeClavier();
    expect(feuille.geometrie()).toEqual(avant);
    act(() => feuille.arbre.unmount());
  });

  it("« Adresse du club » (86 %) : bornée sous l'encoche, reste ouverte", () => {
    const feuille = monter({ snapPoints: ['86%'] });
    feuille.ouvrirLeClavier();
    const apres = feuille.geometrie();
    expect(apres.haut).toBe(HAUT);
    expect(apres.bas).toBe(HAUT_DU_CLAVIER + BARRE_DE_GESTES);
    expect(apres.index).toBe(0);
    expect(feuille.close).not.toHaveBeenCalled();
    act(() => feuille.arbre.unmount());
  });
});
