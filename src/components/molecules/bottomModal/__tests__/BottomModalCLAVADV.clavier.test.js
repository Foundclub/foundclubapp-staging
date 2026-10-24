import fs from 'fs';
import path from 'path';

import { createElement } from 'react';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import BottomModal from '../BottomModal';

// ⌨️ CLAV-ADVERSAIRE (23/10) — « Nommer l'adversaire » : le clavier de l'iPhone RECOUVRE le champ
// (VU par Adel, TestFlight 2.6.79, capture
// `docs/recette-2026-10-17-captures/CLAVIER-nommer-adversaire-iphone-adel-20261023.webp` : la
// feuille reste à 52 %, le clavier par-dessus).
//
// LA CAUSE se lit dans `@gorhom/bottom-sheet` 5.2.4 : un clavier qui s'ouvre PENDANT l'animation
// d'ouverture de la feuille (champ en `autoFocus`) relance l'animation vers le cran prévu, sans
// le clavier ; la feuille ne regarde plus le clavier ensuite (elle ne réagit qu'à un CHANGEMENT
// du clavier). Ouvert APRÈS l'animation, le clavier la fait remonter (comportement
// « interactive », celui de toutes les autres feuilles à champ).
//
// D'où `onOpened` : la feuille prévient quand elle est arrivée, l'appelant donne le clavier à ce
// moment. Ce témoin prouve (1) que les deux règles de la bibliothèque sont toujours dans son code,
// (2) le branchement de `onOpened`. Jest ne fait tourner ni la mise en page ni Reanimated : le
// rendu se constate sur iPhone.

/** Les réglages reçus par la bibliothèque, dans l'ordre des rendus. */
const mockRecus = /** @type {any[]} */ ([]);

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
  return {
    BottomSheetBackdrop: () => null,
    BottomSheetModal: reactActuel.forwardRef((/** @type {any} */ props, /** @type {any} */ ref) => {
      mockRecus.push(props);
      reactActuel.useImperativeHandle(ref, () => ({ dismiss: () => {}, present: () => {} }));
      return reactActuel.createElement(VueRN, null, props.children);
    }),
    BottomSheetScrollView: Vue,
    BottomSheetView: Vue,
    useBottomSheetInternal: () => null, // CLAVREGLE : lu par BottomModal
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
const feuilleDeLaBibliotheque = () => fs.readFileSync(
  path.join(BIBLIOTHEQUE, 'lib', 'commonjs', 'components', 'bottomSheet', 'BottomSheet.js'),
  'utf8',
);

describe('CLAV-ADVERSAIRE — les règles de @gorhom/bottom-sheet 5.2.4', () => {
  // Témoin de la BIBLIOTHÈQUE, vert avant comme après. S'il rougit (montée de version), revoir
  // si le clavier ouvert pendant l'animation est toujours perdu.
  it('pendant l\'animation, un nouvel avis (clavier) repart vers le CRAN, sans le clavier', () => {
    expect(JSON.parse(fs.readFileSync(path.join(BIBLIOTHEQUE, 'package.json'), 'utf8')).version)
      .toBe('5.2.4');
    expect(feuilleDeLaBibliotheque()).toMatch(
      /if \(nextPositionIndex !== animatedCurrentIndex\.value\) \{\s+animateToPosition\(detents\[nextPositionIndex\]/,
    );
  });

  it('`onChange` ne part qu\'à la FIN de l\'animation : le bon moment pour le clavier', () => {
    expect(feuilleDeLaBibliotheque()).toMatch(
      /function animateToPositionCompleted\(isFinished\)[\s\S]{0,900}runOnJS\)\(handleOnChange\)/,
    );
  });
});

describe('CLAV-ADVERSAIRE — `onOpened` : la feuille dit quand elle est arrivée', () => {
  const monter = (/** @type {any} */ props) => {
    mockRecus.length = 0;
    /** @type {any} */
    let arbre;
    act(() => {
      arbre = renderer.create(createElement(
        BottomModal,
        { close: () => {}, isVisible: true, ...props },
        createElement(Text, null, 'contenu'),
      ));
    });
    return { arbre, recus: mockRecus[mockRecus.length - 1] };
  };

  it('arrivée sur un cran : `onOpened` une fois ; fermée : rien', () => {
    const onOpened = jest.fn();
    const { arbre, recus } = monter({ onOpened, snapPoints: ['52%'] });
    expect(typeof recus.onChange).toBe('function');
    act(() => recus.onChange(-1));
    expect(onOpened).not.toHaveBeenCalled();
    act(() => recus.onChange(0));
    expect(onOpened).toHaveBeenCalledTimes(1);
    // Un cran rendu apres le clavier (bas, puis retour) ne redonne pas le clavier.
    act(() => recus.onChange(-1));
    act(() => recus.onChange(0));
    expect(onOpened).toHaveBeenCalledTimes(1);
    act(() => arbre.unmount());
  });

  it('sans `onOpened`, la feuille reste ce qu\'elle était (aucun `onChange` donné)', () => {
    const { arbre, recus } = monter({ snapPoints: ['52%'] });
    expect(recus.onChange).toBeUndefined();
    act(() => arbre.unmount());
  });
});
