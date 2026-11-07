import renderer, { act } from 'react-test-renderer';

import { PRESIDENT_GUIDE } from '@/domains/tour/presidentGuide';
import { registerTourTarget, resetTourTargetsForTests } from '@/domains/tour/tourTargetRegistry';

import { measureTourSheet, TOUR_SHEET_TARGET } from '@/components/molecules/tour/tourSheetContext';

import TourGuideLayer from '../TourGuideLayer';

// GUIDE-D-CORR TG-01 / TG-02 (tournée du 07/11, g05-g09, g24-g26) : la feuille « Prendre une
// photo / Choisir depuis la galerie » s'ouvrait SOUS la couche du guide : grisée et intouchable
// sous le voile (logo du club), ou cachée par la bulle (logo du partenaire, vu par Adel). Une
// feuille ouverte (BottomModal) le dit au guide, qui se retire le temps du choix ; il reste si sa
// cible est dans la feuille (« Inviter » de M2).

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
const holes = (tree) => tree.root.findAll((node) => typeof node.type === 'string'
  && String(node.props.testID || '').startsWith('tour.hole.'));

const layerOf = (tree) => tree.root.findAll((node) => node.props.testID === 'tour.layer'
  && typeof node.type === 'string')[0];
const isHidden = (tree) => {
  const layer = layerOf(tree);
  const style = Object.assign({}, ...[layer.props.style].flat(5).filter(Boolean));
  return layer.props.pointerEvents === 'none' && style.opacity === 0;
};
const openSheet = () => registerTourTarget(TOUR_SHEET_TARGET, measureTourSheet);

beforeEach(() => {
  jest.useFakeTimers();
  resetTourTargetsForTests();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('TG-01 / TG-02 : une feuille ouverte passe devant le guide', () => {
  it('TG-01 m1-logo : feuille photo ouverte, le voile et la bulle se retirent', async () => {
    mockTour = activeTour(step('m1-logo'));
    registerTourTarget('clubEdit.logo', (done) => done(CARD));
    openSheet();
    const tree = await renderLayer();
    expect(isHidden(tree)).toBe(true);
  });

  it('TG-02 m1-pform : feuille photo du partenaire, la bulle ne la couvre plus', async () => {
    mockTour = activeTour(step('m1-pform'));
    registerTourTarget('sponsor.fields', (done) => done(CARD));
    openSheet();
    const tree = await renderLayer();
    expect(isHidden(tree)).toBe(true);
  });

  it('témoin : la feuille refermée, le guide revient sur le logo', async () => {
    mockTour = activeTour(step('m1-logo'));
    registerTourTarget('clubEdit.logo', (done) => done(CARD));
    const close = openSheet();
    const tree = await renderLayer();
    expect(isHidden(tree)).toBe(true);
    close();
    await act(async () => { jest.advanceTimersByTime(400); });
    await flush();
    expect(isHidden(tree)).toBe(false);
    expect(holes(tree).length).toBe(1);
  });

  it('témoin : cible DANS la feuille (« Inviter » de M2), le guide reste', async () => {
    mockTour = activeTour(step('m2-invite'));
    registerTourTarget('ok-sheet', (done) => done(CARD), { inSheet: true });
    openSheet();
    const tree = await renderLayer();
    expect(isHidden(tree)).toBe(false);
    expect(holes(tree).length).toBe(1);
  });
});
