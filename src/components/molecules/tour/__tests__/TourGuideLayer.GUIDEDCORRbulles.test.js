import renderer, { act } from 'react-test-renderer';

import { PRESIDENT_GUIDE } from '@/domains/tour/presidentGuide';
import { registerTourTarget, resetTourTargetsForTests } from '@/domains/tour/tourTargetRegistry';

import TourGuideLayer from '../TourGuideLayer';

// GUIDE-D-CORR (tournée du 07/11) :
// TG-07 (r62-r65) : revenu de la messagerie sur la fiche du club, la bulle disait « sur Staff ».
// TG-10 (r25) : la bulle « Conflit / Capacité / Couleur » couvrait la capacité et les couleurs.
// TG-16 (g13, g36, r37) : clavier ouvert, ou étape de retour, le voile tombait et tout redevenait
// touchable (Enregistrer, la poubelle du partenaire, « + Ajouter une installation »).

jest.setTimeout(30000);

const SCREEN = { height: 640, width: 360 };
const CARD = {
  height: 260, width: 330, x: 15, y: 110,
};

let mockTour;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    fontScale: 1, height: 640, scale: 3, width: 360,
  }),
}));
jest.mock('@/context/useTour', () => ({ useTour: () => mockTour }));
jest.mock('@/store/appContext', () => ({
  useAppContext: () => [{ auth: { token: 'jeton' }, isAddingAccount: false }],
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 24,
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
let mockKeyboard = null;
jest.mock('@/hooks/useKeyboardFrame', () => ({ __esModule: true, default: () => mockKeyboard }));
jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({
    Colors: new Proxy({}, { get: () => 'couleur' }),
    Fonts: new Proxy({}, { get: () => ({ fontSize: 16, lineHeight: 20 }) }),
  }),
}));

const step = (id) => PRESIDENT_GUIDE.steps.find((candidate) => candidate.id === id);
const activeTour = (currentStep) => ({
  completeCurrentStep: jest.fn(),
  created: {},
  currentMission: { locked: true, title: 'Gérer ton club' },
  currentStep,
  exitTour: jest.fn(),
  gauge: 0,
  isGuide: true,
  isLockedStep: true,
  isTourActive: true,
  missionPosition: { index: 1, isBonus: false, total: 4 },
  pauseTour: jest.fn(),
  profileKey: 'president',
  resumeTour: jest.fn(),
  returnToGuide: jest.fn(),
  reward: null,
  skipMission: jest.fn(),
  tourStatus: 'active',
});

const flush = async () => {
  for (let i = 0; i < 5; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await Promise.resolve(); });
  }
};
const renderLayer = async () => {
  let tree;
  await act(async () => { tree = renderer.create(<TourGuideLayer />); });
  const root = tree.root.findAll((node) => node.props.testID === 'tour.layer'
    && typeof node.type !== 'string')[0];
  root.instance.measureInWindow = (cb) => cb(0, 0, SCREEN.width, SCREEN.height);
  await act(async () => {
    root.props.onLayout({ nativeEvent: { layout: { ...SCREEN, x: 0, y: 0 } } });
  });
  await act(async () => { jest.advanceTimersByTime(400); });
  await flush();
  return tree;
};
const blockers = (tree) => tree.root.findAll((node) => node.props.testID === 'tour.blocker'
  && typeof node.type === 'string');

const texts = (tree) => tree.root.findAll((node) => typeof node.type === 'string'
  && typeof node.props.children === 'string').map((node) => node.props.children);
const bubbleBox = (tree) => {
  const bubble = tree.root.findAll((node) => node.props.testID === 'tour.bubble'
    && typeof node.type !== 'string')[0];
  const style = Object.assign({}, ...[bubble.props.style].flat(5).filter(Boolean));
  return { bottom: style.top + Math.min(110, style.maxHeight), top: style.top };
};
const overlaps = (box, rect) => box.top < rect.y + rect.height && box.bottom > rect.y;
const isPointBlocked = (tree, x, y) => blockers(tree).some((node) => {
  const style = Object.assign({}, ...[node.props.style].flat(5).filter(Boolean));
  return x >= style.left && x < style.left + style.width
    && y >= style.top && y < style.top + style.height;
});

beforeEach(() => {
  jest.useFakeTimers();
  resetTourTargetsForTests();
  mockKeyboard = null;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('TG-07 : la bulle dit l’écran où l’on est', () => {
  it('retour de messagerie sur la fiche : « Nos équipes », pas « sur Staff »', async () => {
    mockTour = activeTour(step('m2-back'));
    registerTourTarget('header.back', (done) => done({
      height: 44, width: 44, x: 8, y: 30,
    }));
    registerTourTarget('club.m.teams', (done) => done(CARD));
    const tree = await renderLayer();
    const shown = texts(tree).join(' ');
    expect(shown).not.toMatch(/sur Staff/);
    expect(shown).toMatch(/Nos équipes/);
  });

  it('témoin : vraiment sur Staff, la bulle montre le retour', async () => {
    mockTour = activeTour(step('m2-back'));
    registerTourTarget('header.back', (done) => done({
      height: 44, width: 44, x: 8, y: 30,
    }));
    const tree = await renderLayer();
    expect(texts(tree).join(' ')).toMatch(/Staff/);
  });
});

describe('TG-10 : la bulle ne couvre pas ce dont elle parle', () => {
  const CONFLICT = {
    height: 60, width: 330, x: 15, y: 200,
  };
  const CAPACITY = {
    height: 60, width: 330, x: 15, y: 270,
  };
  const COLOR = {
    height: 80, width: 330, x: 15, y: 340,
  };
  const register = () => {
    registerTourTarget('facility.conflict', (done) => done(CONFLICT));
    registerTourTarget('facility.capacity', (done) => done(CAPACITY));
    registerTourTarget('facility.color', (done) => done(COLOR));
  };

  it.each([
    ['m1-ff2', CONFLICT],
    ['m1-ff2-cap', CAPACITY],
    ['m1-ff2-color', COLOR],
  ])('%s : la bulle laisse sa cible visible', async (id, rect) => {
    mockTour = activeTour(step(id));
    register();
    const tree = await renderLayer();
    expect(overlaps(bubbleBox(tree), rect)).toBe(false);
  });
});

describe('TG-16 : le voile reste en plein guide', () => {
  it('clavier ouvert sur le téléphone du club : le reste reste sous le voile', async () => {
    mockKeyboard = { height: 260, screenY: 380 };
    mockTour = activeTour(step('m1-phone'));
    // Le champ, remonté au-dessus du clavier, dépasse un peu de sa zone visible.
    registerTourTarget('clubEdit.phone', (done) => done({
      height: 120, width: 330, x: 15, y: 560,
    }));
    const tree = await renderLayer();
    expect(blockers(tree).length).toBeGreaterThan(0);
  });

  it.each(['m1-pback', 'm1-pb1', 'm1-fback'])(
    '%s : retour par la flèche ; la poubelle, le « + » restent sous le voile',
    async (id) => {
      mockTour = activeTour(step(id));
      registerTourTarget('header.back', (done) => done({
        height: 44, width: 44, x: 8, y: 30,
      }));
      const tree = await renderLayer();
      expect(isPointBlocked(tree, 300, 400)).toBe(true);
      // La flèche, et le bord gauche (geste du retour de l'iPhone), restent libres.
      expect(isPointBlocked(tree, 30, 52)).toBe(false);
      expect(isPointBlocked(tree, 4, 400)).toBe(false);
    },
  );
});

describe('TG-17 : la bulle du planning d’exemple dit de faire défiler', () => {
  it('m1-pdemo : grille sous le bas de l’écran ⇒ « Fais défiler vers le bas »', async () => {
    mockTour = activeTour(step('m1-pdemo'));
    registerTourTarget('planning.grid', (done) => done({
      height: 400, width: 360, x: 0, y: 520,
    }));
    const tree = await renderLayer();
    expect(texts(tree).join(' ')).toMatch(/Fais défiler vers le bas/);
  });
});
