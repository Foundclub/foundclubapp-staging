import renderer, { act } from 'react-test-renderer';

import { resetGuidanceRuntimeForTests } from '@/domains/guidance/guidanceRuntime';
import { COACH_GUIDE } from '@/domains/tour/coachGuide';
import { registerTourTarget, resetTourTargetsForTests } from '@/domains/tour/tourTargetRegistry';

import TourGuideLayer from '../TourGuideLayer';

// GUIDE-FINITIONS-3 (rejeu 2 du guide Entraîneur, 29/10) :
// - R2-2 : la bulle du haut cachait le titre et la consigne de chaque écran du
//   tunnel équipe (A04-A10, « Sélectionne au moins un·e entraîneur·e » en A09) ;
// - R2-4 : « Terrain vide », cité par la bulle de b2-start, restait dessous (A20).
// L'écran réserve une place (`tour.bubbleSlot`) sous son titre ; la bulle s'y pose.

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
const HEADER = {
  height: 56, width: 390, x: 0, y: 0,
};
const SLOT = {
  height: 120, width: 390, x: 0, y: 150,
};
const topOf = (tree) => styleOf(bubbleOf(tree)).top;

describe('R2-2 / R2-4 — la bulle se pose dans la place réservée sous le titre', () => {
  ['tw2', 'tw4', 'tw7', 'tw8', 'b2-start'].forEach((id) => {
    it(`${id} : la bulle commence dans la place, pas sur le titre`, async () => {
      mockTour = activeTour(step(id));
      mountTarget('screen.header', HEADER);
      mountTarget('tour.bubbleSlot', SLOT);
      mountTarget('teamWizard.field', {
        height: 400, width: 358, x: 16, y: 280,
      });
      mountTarget('teamWizard.next', {
        height: 56, width: 358, x: 16, y: 700,
      });
      const tree = await renderLayer();
      expect(topOf(tree)).toBe(SLOT.y + STATUS_BAR);
    });
  });

  it('écran sans place réservée : sous l’en-tête, comme avant (témoin)', async () => {
    mockTour = activeTour(step('tw4'));
    mountTarget('screen.header', HEADER);
    mountTarget('teamWizard.field', {
      height: 400, width: 358, x: 16, y: 280,
    });
    const tree = await renderLayer();
    expect(topOf(tree)).toBe(HEADER.y + HEADER.height + STATUS_BAR + 6);
  });
});
