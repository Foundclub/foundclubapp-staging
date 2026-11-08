import renderer, { act } from 'react-test-renderer';

import { PRESIDENT_GUIDE } from '@/domains/tour/presidentGuide';
import {
  registerTourScroller,
  registerTourTarget,
  resetTourTargetsForTests,
} from '@/domains/tour/tourTargetRegistry';

import TourGuideLayer from '../TourGuideLayer';

// GUIDE-D-CORR-2 (retours d'Adel sur iPhone, 08/11) :
// 1. la cible d'une étape plus bas dans l'écran : le dirigeant devait défiler lui-même, trop ou
//    pas assez, et le voile bloquait l'écran. Le guide fait défiler tout seul jusqu'à la cible ;
//    sans zone branchée, l'écran reste libre et la bulle dit quoi faire.
// 2. « Ajouter un partenaire » : la bulle couvrait le bouton « Ajouter le partenaire ». Une bulle
//    ne croise jamais une cible de l'étape.

jest.setTimeout(30000);

const SCREEN = { height: 640, width: 360 };

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
const holes = (tree) => tree.root.findAll((node) => typeof node.type === 'string'
  && String(node.props.testID || '').startsWith('tour.hole.'));
const texts = (tree) => tree.root.findAll((node) => typeof node.type === 'string'
  && typeof node.props.children === 'string').map((node) => node.props.children);
const bubbleBox = (tree) => {
  const bubble = tree.root.findAll((node) => node.props.testID === 'tour.bubble'
    && typeof node.type !== 'string')[0];
  if (!bubble) return null;
  const style = Object.assign({}, ...[bubble.props.style].flat(5).filter(Boolean));
  return { bottom: style.top + Math.min(110, style.maxHeight), top: style.top };
};
const overlaps = (box, rect) => box.top < rect.y + rect.height && box.bottom > rect.y;
const tick = async () => {
  await act(async () => { jest.advanceTimersByTime(500); });
  await flush();
};

beforeEach(() => {
  jest.useFakeTimers();
  resetTourTargetsForTests();
  mockKeyboard = null;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('1. le guide fait défiler l’écran jusqu’à la cible', () => {
  it('« Qui accepte les joueur·se·s » hors écran : défilement, puis voile et bulle', async () => {
    let target = {
      height: 120, width: 330, x: 15, y: 700,
    };
    const scrollBy = jest.fn((dy) => {
      target = { ...target, y: target.y - dy };
    });
    registerTourScroller({
      measure: (done) => done({
        height: 580, width: 360, x: 0, y: 60,
      }),
      scrollBy,
    });
    mockTour = activeTour(step('m1-deleg'));
    registerTourTarget('clubEdit.delegation', (done) => done(target));
    const tree = await renderLayer();
    await tick();
    expect(scrollBy).toHaveBeenCalledTimes(1);
    // Cible au milieu de la zone qui défile : 60 + (580 − 120) / 2 = 290.
    expect(target.y).toBe(290);
    await tick();
    await tick();
    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(texts(tree).join(' ')).not.toMatch(/Fais défiler/);
    expect(holes(tree).length).toBe(1);
    expect(blockers(tree).length).toBeGreaterThan(0);
  });

  it('cible à moitié cachée en bas (planning) : elle est ramenée entière', async () => {
    let target = {
      height: 300, width: 360, x: 0, y: 500,
    };
    const scrollBy = jest.fn((dy) => {
      target = { ...target, y: target.y - dy };
    });
    registerTourScroller({
      measure: (done) => done({
        height: 640, width: 360, x: 0, y: 0,
      }),
      scrollBy,
    });
    mockTour = activeTour(step('m1-pdemo'));
    registerTourTarget('planning.grid', (done) => done(target));
    await renderLayer();
    await tick();
    expect(scrollBy).toHaveBeenCalled();
    expect(target.y + target.height).toBeLessThanOrEqual(640);
    expect(target.y).toBeGreaterThanOrEqual(24);
  });

  it('témoin : sans zone branchée, l’écran reste libre et la bulle dit de défiler', async () => {
    mockTour = activeTour(step('m1-deleg'));
    registerTourTarget('clubEdit.delegation', (done) => done({
      height: 120, width: 330, x: 15, y: 600,
    }));
    const tree = await renderLayer();
    expect(blockers(tree).length).toBe(0);
    expect(texts(tree).join(' ')).toMatch(/Fais défiler vers le bas/);
  });
});

describe('2. la bulle ne couvre jamais une cible ni le bouton à toucher', () => {
  const FIELDS = {
    height: 380, width: 330, x: 15, y: 60,
  };
  const SAVE = {
    height: 50, width: 330, x: 15, y: 520,
  };

  it('« Ajouter un partenaire » : ni les champs, ni « Ajouter le partenaire »', async () => {
    mockTour = activeTour(step('m1-pform'));
    registerTourTarget('sponsor.fields', (done) => done(FIELDS));
    registerTourTarget('sponsor.save', (done) => done(SAVE));
    const tree = await renderLayer();
    const box = bubbleBox(tree);
    expect(box).not.toBeNull();
    expect(overlaps(box, FIELDS)).toBe(false);
    expect(overlaps(box, SAVE)).toBe(false);
  });

  it('clavier ouvert, aucun trou libre : la bulle attend au lieu de couvrir le champ', async () => {
    mockKeyboard = { height: 300, screenY: 340 };
    mockTour = activeTour(step('m1-pform'));
    registerTourTarget('sponsor.fields', (done) => done({
      height: 300, width: 330, x: 15, y: 40,
    }));
    const tree = await renderLayer();
    expect(bubbleBox(tree)).toBeNull();
  });

  it.each([
    ['m1-logo', 'clubEdit.logo'],
    ['m1-deleg', 'clubEdit.delegation'],
    ['m1-save', 'clubEdit.save'],
    ['m1-padd', 'club.partners.add'],
    ['m1-pchips', 'planning.chips'],
    ['m2-add', 'staff-add-coach'],
  ])('%s : la bulle laisse sa cible libre, où qu’elle soit à l’écran', async (id, target) => {
    await [40, 200, 330, 520].reduce(async (previous, y) => {
      await previous;
      resetTourTargetsForTests();
      const rect = {
        height: 70, width: 330, x: 15, y,
      };
      mockTour = activeTour(step(id));
      registerTourTarget(target, (done) => done(rect));
      const tree = await renderLayer();
      const box = bubbleBox(tree);
      expect(box).not.toBeNull();
      expect(overlaps(box, rect)).toBe(false);
      act(() => tree.unmount());
    }, Promise.resolve());
  });
});

describe('TG-18 : la croix de pause ne se colle pas à la croix de l’affiche', () => {
  const pauses = (tree) => tree.root.findAll((node) => node.props.testID === 'tour.pause'
    && typeof node.type !== 'string');

  it('m1-pclose : pas de croix de pause dans la bulle', async () => {
    mockTour = activeTour(step('m1-pclose'));
    registerTourTarget('poster.close', (done) => done({
      height: 44, width: 44, x: 300, y: 40,
    }));
    const tree = await renderLayer();
    expect(pauses(tree)).toHaveLength(0);
  });

  it('témoin : les autres étapes gardent leur croix de pause', async () => {
    mockTour = activeTour(step('m1-pmodel'));
    registerTourTarget('poster.model', (done) => done({
      height: 60, width: 330, x: 15, y: 200,
    }));
    const tree = await renderLayer();
    expect(pauses(tree).length).toBeGreaterThan(0);
  });
});
