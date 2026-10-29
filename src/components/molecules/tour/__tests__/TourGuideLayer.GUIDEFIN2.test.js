import * as ReactNative from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  emitGuidanceRouteVisit,
  resetGuidanceRuntimeForTests,
} from '@/domains/guidance/guidanceRuntime';
import { COACH_GUIDE } from '@/domains/tour/coachGuide';
import { registerTourTarget, resetTourTargetsForTests } from '@/domains/tour/tourTargetRegistry';

import { RouteNames } from '@/navigation/routeNames';

import TourGuideLayer from '../TourGuideLayer';

// GUIDE-FINITIONS-2 (rejeu du guide Entraîneur, 28/10 au soir) :
// - N9 : sur une fiche club, la bulle de m1-mine disait d'abord « Touche C'est mon
//   club ! » alors que le bouton affiché était « Demander à rejoindre » (capture 92) ;
// - N12 : le titre de mission était coupé (« MISSION 1/4 · CRÉER TO… », capture 02) ;
// - n° 25 (touchers perdus) : une étape sans voile ne pose AUCUN bloqueur ; les
//   touchers en retard de 20-40 s viennent de l'émulateur (témoin, vert des deux côtés).

let mockTour;
// Réglage « taille du texte » du téléphone, lu par la couche.
const mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    fontScale: mockFontScale, height: 844, scale: 2.625, width: 390,
  }),
}));
let mockIsAddingAccount;
jest.mock('@/context/useTour', () => ({ useTour: () => mockTour }));
jest.mock('@/store/appContext', () => ({
  useAppContext: () => [{ auth: { token: 'jeton' }, isAddingAccount: mockIsAddingAccount }],
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 24, left: 0, right: 0, top: 54,
  }),
}));
jest.mock('react-native-svg', () => {
  const { View } = jest.requireActual('react-native');
  /**
   * Doublure SVG : une simple vue.
   * @param {{ children?: any }} props - Enfants.
   * @returns {any} Vue.
   */
  function Box({ children }) { return <View>{children}</View>; }
  return {
    __esModule: true, default: Box, Defs: Box, Mask: Box, Rect: Box,
  };
});
jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => ({ SvgIcon: () => null }));
jest.mock('@/components/molecules/tour/TourFullScreen', () => ({
  __esModule: true, default: () => null,
}));
jest.mock('@/theme/colors', () => ({ withAlpha: (color) => color }));
jest.mock('@/hooks/useReduceMotion', () => ({ __esModule: true, default: () => true }));
jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({
    Colors: new Proxy({}, { get: () => 'couleur' }),
    // Police du thème : taille et interligne, pour mesurer l'agrandissement.
    Fonts: new Proxy({}, { get: () => ({ fontSize: 16, lineHeight: 20 }) }),
  }),
}));

const SCREEN = { height: 844, width: 390 };
// Ce que `measureInWindow` d'Android rend pour la couche plein écran : son
// origine est « au-dessus » du repère, de la hauteur de la barre d'état.
const STATUS_BAR = 54;

const activeTour = (step) => ({
  completeCurrentStep: jest.fn(),
  currentMission: { locked: true, title: 'Créer ton équipe' },
  currentStep: step,
  exitTour: jest.fn(),
  gauge: 0,
  isGuide: true,
  isLockedStep: true,
  isTourActive: true,
  missionPosition: { index: 1, isBonus: false, total: 4 },
  pauseTour: jest.fn(),
  resumeTour: jest.fn(),
  reward: null,
  skipMission: jest.fn(),
  tourStatus: 'active',
});

/**
 * Cible mesurée comme Android la mesure (repère sans barre d'état).
 * @param {string} id - Ancre.
 * @param {{ height: number; width: number; x: number; y: number }} rect - Mesure.
 * @returns {void}
 */
const mountTarget = (id, rect) => {
  registerTourTarget(id, (done) => done(rect));
};

const flush = async () => {
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await Promise.resolve(); });
  }
};

const renderLayer = async () => {
  let tree;
  await act(async () => {
    tree = renderer.create(<TourGuideLayer />);
  });
  // La doublure jest de `View` est une classe : la référence de la couche est
  // son instance ; on lui donne la mesure d'Android (origine sous la barre).
  const root = tree.root.findAll((node) => node.props.testID === 'tour.layer'
    && typeof node.type !== 'string')[0];
  if (root) {
    root.instance.measureInWindow = (cb) => cb(0, -STATUS_BAR, SCREEN.width, SCREEN.height);
    await act(async () => {
      root.props.onLayout({ nativeEvent: { layout: { ...SCREEN, x: 0, y: 0 } } });
      jest.advanceTimersByTime(400);
    });
  }
  await flush();
  return tree;
};

const styleOf = (node) => Object.assign({}, ...[node.props.style].flat(5).filter(Boolean));

beforeEach(() => {
  jest.useFakeTimers();
  resetTourTargetsForTests();
  resetGuidanceRuntimeForTests();
  mockIsAddingAccount = false;
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

const step = (id) => COACH_GUIDE.steps.find((candidate) => candidate.id === id);
const bubbleOf = (tree) => tree.root.findAll((node) => node.props.testID === 'tour.bubble'
  && typeof node.type === 'string')[0];
const bubbleText = (tree) => bubbleOf(tree)
  .findAll((node) => node.type === ReactNative.Text)
  .map((node) => [node.props.children].flat().join(''))
  .join(' ');
// Bulle montrée : présente, et couche ni transparente ni traversée.
const isShown = (tree) => {
  const layer = tree.root.findAll((node) => node.props.testID === 'tour.layer'
    && typeof node.type === 'string')[0];
  return Boolean(bubbleOf(tree)) && styleOf(layer).opacity !== 0
    && layer.props.pointerEvents !== 'none';
};
const visitRoute = async (name) => {
  await act(async () => {
    emitGuidanceRouteVisit(name);
    jest.advanceTimersByTime(400);
  });
  await flush();
};
const kickerOf = (tree) => bubbleOf(tree).findAll((node) => node.type === ReactNative.Text
  && /MISSION|Mission/.test([node.props.children].flat().join('')))[0];
const blockersOf = (tree) => tree.root.findAll((node) => node.props.testID === 'tour.blocker'
  && typeof node.type !== 'string');

describe('N9 — m1-mine attend de savoir quel bouton est affiché', () => {
  it('rien de mesuré : pas de bulle ; « Demander à rejoindre » arrive : sa variante', async () => {
    mockTour = activeTour(step('m1-mine'));
    const tree = await renderLayer();
    await visitRoute(RouteNames.Club);
    expect(isShown(tree)).toBe(false);

    mountTarget('club.askToJoin', {
      height: 56, width: 358, x: 16, y: 700,
    });
    await visitRoute(RouteNames.Club);
    expect(isShown(tree)).toBe(true);
    expect(bubbleText(tree)).toContain('Demande à le rejoindre');
    expect(bubbleText(tree)).not.toContain('C’est mon club !');
  });

  it('aucun bouton après l’attente : la bulle revient (jamais de guide muet)', async () => {
    mockTour = activeTour(step('m1-mine'));
    const tree = await renderLayer();
    await act(async () => { jest.advanceTimersByTime(2500); });
    await flush();
    expect(isShown(tree)).toBe(true);
  });
});

describe('N12 — le titre de mission tient dans la bulle', () => {
  it('le titre passe à la ligne au lieu d’être coupé', async () => {
    mockTour = activeTour(step('m1-dock'));
    mountTarget('dock.teams', {
      height: 60, width: 78, x: 156, y: 770,
    });
    const tree = await renderLayer();
    // GUIDE-PETIT-ECRAN (R3-07) : 2 lignes coupaient encore « PROGRAMMER L'ENTRA… » ;
    // plus aucune limite (la bulle bornée défile). Jamais 1 ligne.
    const lines = kickerOf(tree).props.numberOfLines;
    expect(lines === undefined || lines >= 2).toBe(true);
  });
});

describe('n° 25 — une étape sans voile ne bloque aucun toucher (témoin)', () => {
  it.each(['m1-csearch', 'b2-start'])('%s : aucun bloqueur posé sur l’écran', async (id) => {
    mockTour = activeTour(step(id));
    mountTarget('search.result.0', {
      height: 96, width: 358, x: 16, y: 300,
    });
    const tree = await renderLayer();
    expect(isShown(tree)).toBe(true);
    expect(blockersOf(tree)).toHaveLength(0);
  });
});
