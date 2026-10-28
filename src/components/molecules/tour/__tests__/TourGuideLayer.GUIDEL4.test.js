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

// GUIDE-RECUL (28/10, lot L4 de l'audit du guide Entraîneur) :
// - bulle périmée : sa cible partie avec son écran (autre onglet, autre pile),
//   la bulle restait, posée en haut d'un écran qui n'a rien à voir ;
// - reprise sur une cible deux écrans plus bas (capture 02) : « les profils
//   sont ici », sans cadre, sans voile, sans « fais défiler ».

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

/**
 * Cadres des découpes : bordure 2, rayon 16, en position absolue.
 * @param {any} tree - Rendu.
 * @returns {any[]} Cadres.
 */
const framesOf = (tree) => tree.root.findAll((node) => typeof node.type === 'string'
  && styleOf(node).borderRadius === 16 && styleOf(node).borderWidth === 2
  && styleOf(node).position === 'absolute');

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

const CARD = 'home.card.search-profiles';

describe('L4 — bulle périmée', () => {
  it('sa cible partie avec son écran : la bulle disparaît, et revient avec l’écran', async () => {
    const unmount = registerTourTarget(CARD, (done) => done({
      height: 120, width: 358, x: 16, y: 400,
    }));
    mockTour = activeTour(step('m4-card'));
    const tree = await renderLayer();
    await visitRoute(RouteNames.SearchHome);
    expect(isShown(tree)).toBe(true);
    expect(framesOf(tree)).toHaveLength(1);

    // Onglet Planning : la carte de l'accueil n'est plus là.
    unmount();
    await visitRoute(RouteNames.MyEventList);
    expect(isShown(tree)).toBe(false);

    // Retour à l'accueil : la carte et la bulle reviennent.
    registerTourTarget(CARD, (done) => done({
      height: 120, width: 358, x: 16, y: 400,
    }));
    await visitRoute(RouteNames.SearchHome);
    expect(isShown(tree)).toBe(true);
    expect(framesOf(tree)).toHaveLength(1);
  });

  it('une étape sans cible garde sa bulle quel que soit l’écran', async () => {
    mockTour = activeTour(step('m3-page'));
    const tree = await renderLayer();
    await visitRoute(RouteNames.SearchHome);
    await visitRoute(RouteNames.MyEventList);
    expect(isShown(tree)).toBe(true);
  });

  it('une cible jamais vue (écran pas encore ancré) : repli en haut, comme avant', async () => {
    mockTour = activeTour(step('m4-card'));
    const tree = await renderLayer();
    await visitRoute(RouteNames.MyEventList);
    expect(isShown(tree)).toBe(true);
  });
});

describe('L4 — reprise sur une cible hors écran', () => {
  it('carte deux écrans plus bas : la bulle dit de faire défiler vers le bas', async () => {
    mountTarget(CARD, {
      height: 120, width: 358, x: 16, y: 1700,
    });
    mockTour = activeTour(step('m4-card'));
    const tree = await renderLayer();
    expect(framesOf(tree)).toHaveLength(0);
    expect(bubbleText(tree)).toContain('Fais défiler vers le bas');
  });

  it('carte sous la barre d’onglets : vers le bas aussi', async () => {
    mountTarget('dock.home', {
      height: 60, width: 80, x: 20, y: 720,
    });
    mountTarget(CARD, {
      height: 120, width: 358, x: 16, y: 690,
    });
    mockTour = activeTour(step('m4-card'));
    const tree = await renderLayer();
    expect(bubbleText(tree)).toContain('Fais défiler vers le bas');
  });

  it('cible remontée au-dessus de l’écran : vers le haut', async () => {
    mountTarget(CARD, {
      height: 120, width: 358, x: 16, y: -600,
    });
    mockTour = activeTour(step('m4-card'));
    const tree = await renderLayer();
    expect(bubbleText(tree)).toContain('Fais défiler vers le haut');
  });

  it('cible à l’écran : cadre, et pas de « fais défiler »', async () => {
    mountTarget(CARD, {
      height: 120, width: 358, x: 16, y: 400,
    });
    mockTour = activeTour(step('m4-card'));
    const tree = await renderLayer();
    expect(framesOf(tree)).toHaveLength(1);
    expect(bubbleText(tree)).not.toContain('Fais défiler');
  });
});
