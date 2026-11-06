import renderer, { act } from 'react-test-renderer';

import { PRESIDENT_GUIDE } from '@/domains/tour/presidentGuide';
import { registerTourTarget, resetTourTargetsForTests } from '@/domains/tour/tourTargetRegistry';

import TourGuideLayer from '../TourGuideLayer';

// L10 (05/11, m1-info) : la bulle demande de lire la carte, le doigt part de la carte, la liste
// monte, la carte sort du cadre et le voile tombe. Une étape à lire ne laisse aucun toucher à sa
// cible ; une étape où il faut toucher ou remplir la cible garde son trou.

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
// Le milieu de la carte est-il sous un bloqueur du voile ?
const isCardCovered = (tree) => {
  const x = CARD.x + (CARD.width / 2);
  const y = CARD.y + (CARD.height / 2);
  return blockers(tree).some((node) => {
    const style = Object.assign({}, ...[node.props.style].flat(5).filter(Boolean));
    return x >= style.left && x < style.left + style.width
      && y >= style.top && y < style.top + style.height;
  });
};
const holes = (tree) => tree.root.findAll((node) => typeof node.type === 'string'
  && String(node.props.testID || '').startsWith('tour.hole.'));

beforeEach(() => {
  jest.useFakeTimers();
  resetTourTargetsForTests();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('une étape à lire ne laisse aucun toucher à sa cible', () => {
  it('m1-info : la carte reste montrée, le doigt qui en part ne fait rien', async () => {
    mockTour = activeTour(step('m1-info'));
    registerTourTarget('club.card', (done) => done(CARD));
    const tree = await renderLayer();
    expect(holes(tree).length).toBe(1);
    expect(isCardCovered(tree)).toBe(true);
  });

  it('témoin : m1-card, où il faut toucher la cible, garde son trou', async () => {
    mockTour = activeTour(step('m1-card'));
    registerTourTarget('home.card.manage-club', (done) => done(CARD));
    const tree = await renderLayer();
    expect(holes(tree).length).toBe(1);
    expect(blockers(tree).length).toBeGreaterThan(0);
    expect(isCardCovered(tree)).toBe(false);
  });

  it('témoin : m1-name, un champ avec « Suivant », reste saisissable', async () => {
    mockTour = activeTour(step('m1-name'));
    registerTourTarget('clubEdit.name', (done) => done(CARD));
    const tree = await renderLayer();
    expect(isCardCovered(tree)).toBe(false);
  });

  it.each([
    'm1-info', 'm1-partners-taken', 'm1-fac-taken', 'm2-visit-add', 'm4-card2', 'b1-sum', 'b2-info',
  ])('%s est marquée à lire', (id) => {
    expect(step(id).lookOnly).toBe(true);
  });
});
