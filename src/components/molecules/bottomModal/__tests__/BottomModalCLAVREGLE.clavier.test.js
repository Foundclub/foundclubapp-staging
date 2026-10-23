import fs from 'fs';
import path from 'path';

import { createElement } from 'react';
import { Text, TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import BottomModal from '../BottomModal';

// ⌨️ CLAVREGLE (23/10) — « Quand on touche un champ, il se place toujours au-dessus du clavier »,
// dans TOUTE feuille. Constat d'Adel (iPhone, TestFlight 2.6.80, capture
// `.local/bancs/RECETTE-ADEL-20261023/05-clavier-nommer-adversaire.png`) : « Nommer l'adversaire »
// reste basse, le clavier sur le champ — malgré CLAVADV (clavier donné après l'animation).
//
// LA CAUSE se lit dans `@gorhom/bottom-sheet` 5.2.4 (hooks/useAnimatedKeyboard) : un clavier
// annoncé alors qu'aucun champ n'est déclaré (`animatedKeyboardState.target` vide) est MIS DE
// CÔTÉ, jamais appliqué. Seul `BottomSheetTextInput` déclare son champ, à son focus. Nos feuilles
// portent des `TextInput` simples (le champ commun ne prend celui de la bibliothèque qu'avec
// `useBottomSheetInput`, et sur Android seulement) : sur iPhone, aucune feuille ne remonte.
//
// LA RÈGLE : la feuille déclare elle-même TOUT champ qu'elle contient (en-tête, contenu, pied),
// en écoutant le focus qui remonte l'arbre (`onFocusCapture`). Ce témoin simule cette remontée
// (phase de capture : chaque ancêtre du champ) et exige que la feuille ait déclaré le champ.
// Jest ne fait tourner ni Reanimated ni le clavier : le rendu se constate sur l'appareil.

const mockEtatClavier = { target: /** @type {number | undefined} */ (undefined) };

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
  STARTUP_PHASES: { SCREEN_LOCAL_PROMPTS: 'SCREEN_LOCAL_PROMPTS', STEADY_STATE: 'STEADY_STATE' },
  useStartupPhase: () => ({ phase: 'STEADY_STATE' }),
}));

jest.mock('@gorhom/bottom-sheet', () => {
  const reactActuel = jest.requireActual('react');
  const { View: VueRN } = jest.requireActual('react-native');
  const Vue = (/** @type {any} */ props) => reactActuel.createElement(VueRN, null, props.children);
  // Le contexte interne de la feuille : son état du clavier, lu et écrit comme une valeur
  // partagée de Reanimated (`get`, `set(valeur | (état) => état)`).
  const interne = {
    animatedKeyboardState: {
      get: () => mockEtatClavier,
      set: (/** @type {any} */ suite) => {
        Object.assign(mockEtatClavier, typeof suite === 'function' ? suite(mockEtatClavier) : suite);
      },
    },
  };
  return {
    BottomSheetBackdrop: () => null,
    BottomSheetModal: reactActuel.forwardRef((/** @type {any} */ props, /** @type {any} */ ref) => {
      reactActuel.useImperativeHandle(ref, () => ({ dismiss: () => {}, present: () => {} }));
      return reactActuel.createElement(VueRN, null, props.children);
    }),
    BottomSheetScrollView: Vue,
    BottomSheetView: Vue,
    useBottomSheetInternal: () => interne,
  };
});

jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
      Colors: couleurs,
      Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
      Images: { close: 1 },
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

const BIBLIOTHEQUE = path.dirname(require.resolve('@gorhom/bottom-sheet/package.json'));
const lire = (/** @type {string[]} */ ...morceaux) => fs.readFileSync(
  path.join(BIBLIOTHEQUE, 'lib', 'commonjs', ...morceaux),
  'utf8',
);

/**
 * Le chemin du focus dans React Native : phase de capture, de la racine vers le champ.
 * @param {any} champ instance de test du TextInput
 * @param {'onFocusCapture' | 'onBlurCapture'} nom
 * @param {number} target
 */
const remonter = (champ, nom, target) => {
  const ancetres = [];
  for (let noeud = champ.parent; noeud; noeud = noeud.parent) ancetres.unshift(noeud);
  ancetres.forEach((noeud) => {
    if (typeof noeud.props?.[nom] === 'function') noeud.props[nom]({ nativeEvent: { target } });
  });
};

describe('CLAVREGLE — la règle de @gorhom/bottom-sheet 5.2.4', () => {
  // Témoin de la BIBLIOTHÈQUE, vert avant comme après. S'il rougit (montée de version), revoir si
  // la feuille suit toujours le clavier sans champ déclaré.
  it('un clavier annoncé SANS champ déclaré est mis de côté ; seul BottomSheetTextInput déclare', () => {
    expect(JSON.parse(fs.readFileSync(path.join(BIBLIOTHEQUE, 'package.json'), 'utf8')).version)
      .toBe('5.2.4');
    expect(lire('hooks', 'useAnimatedKeyboard.js'))
      .toMatch(/status === _constants\.KEYBOARD_STATUS\.SHOWN && !currentState\.target\) \{\s+temporaryCachedState\.set/);
    expect(lire('components', 'bottomSheetTextInput', 'BottomSheetTextInput.js'))
      .toMatch(/target: args\.nativeEvent\.target/);
  });
});

describe('CLAVREGLE — toute feuille déclare le champ touché', () => {
  beforeEach(() => {
    mockEtatClavier.target = undefined;
  });

  const monter = () => {
    /** @type {any} */
    let arbre;
    act(() => {
      arbre = renderer.create(createElement(
        BottomModal,
        {
          close: () => {},
          footerComponent: createElement(TextInput, { testID: 'pied' }),
          headerComponent: createElement(TextInput, { testID: 'entete' }),
          isVisible: true,
          snapPoints: ['52%'],
        },
        createElement(Text, null, 'Nommer l\'adversaire'),
        createElement(TextInput, { testID: 'contenu' }),
      ));
    });
    return arbre;
  };

  it.each([
    ['contenu', 101],
    ['entete', 102],
    ['pied', 103],
  ])('un TextInput simple (%s) : la feuille le déclare au focus, l\'oublie au blur', (testID, target) => {
    const arbre = monter();
    const champ = arbre.root.findByProps({ testID });
    act(() => remonter(champ, 'onFocusCapture', target));
    expect(mockEtatClavier.target).toBe(target);
    act(() => remonter(champ, 'onBlurCapture', target));
    expect(mockEtatClavier.target).toBeUndefined();
    act(() => arbre.unmount());
  });

  it('le blur d\'un AUTRE champ ne retire pas le champ déclaré (passage d\'un champ à l\'autre)', () => {
    const arbre = monter();
    const contenu = arbre.root.findByProps({ testID: 'contenu' });
    const pied = arbre.root.findByProps({ testID: 'pied' });
    act(() => remonter(contenu, 'onFocusCapture', 101));
    act(() => remonter(pied, 'onFocusCapture', 103));
    act(() => remonter(contenu, 'onBlurCapture', 101));
    expect(mockEtatClavier.target).toBe(103);
    act(() => arbre.unmount());
  });
});

describe('CLAVREGLE — aucune feuille ne contourne BottomModal', () => {
  // La règle vit dans BottomModal : une feuille montée directement sur la bibliothèque
  // échapperait au suivi du clavier.
  const SRC = path.resolve(__dirname, '..', '..', '..', '..');
  const fichiers = (/** @type {string} */ dossier) => fs.readdirSync(dossier, { withFileTypes: true })
    .flatMap((entree) => {
      const chemin = path.join(dossier, entree.name);
      if (entree.isDirectory()) return entree.name === '__tests__' ? [] : fichiers(chemin);
      return /\.(js|jsx|ts|tsx)$/.test(entree.name) ? [chemin] : [];
    });

  it('seul BottomModal importe une feuille de @gorhom/bottom-sheet', () => {
    const fautifs = fichiers(SRC)
      .filter((fichier) => !/molecules[\\/]bottomModal[\\/]BottomModal\.js$/.test(fichier))
      .filter((fichier) => /import\s*\{[^}]*\bBottomSheet(Modal)?\b[^}]*\}\s*from\s*'@gorhom\/bottom-sheet'/
        .test(fs.readFileSync(fichier, 'utf8')))
      .map((fichier) => path.relative(SRC, fichier));
    expect(fautifs).toEqual([]);
  });
});
