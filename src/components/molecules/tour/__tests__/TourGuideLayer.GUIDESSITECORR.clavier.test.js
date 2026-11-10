import renderer, { act } from 'react-test-renderer';

import { PRESIDENT_GUIDE } from '@/domains/tour/presidentGuide';
import {
  registerTourTarget,
  resetTourTargetsForTests,
} from '@/domains/tour/tourTargetRegistry';

import TourGuideLayer from '../TourGuideLayer';

// GUIDES-SITE-CORR : banc du calque du guide (même harnais que GUIDE-D-CORR-2), clavier ouvert.

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

beforeEach(() => {
  jest.useFakeTimers();
  resetTourTargetsForTests();
  mockKeyboard = null;
});
afterEach(() => {
  jest.useRealTimers();
});

// FINITIONS-T8, point 2 (repris par GUIDES-SITE-CORR) : guide Dirigeant, « Ajouter un coach »,
// clavier ouvert sur le téléphone : la bulle passait sous le clavier, 9 px de « Suivant »
// dépassaient, et il fallait fermer le clavier pour avancer. Elle doit rester visible et
// touchable au-dessus du clavier.
describe('« Ajouter un coach », clavier ouvert', () => {
  const bulle = (/** @type {any} */ tree) => {
    const node = tree.root.findAll((/** @type {any} */ n) => n.props.testID === 'tour.bubble'
      && typeof n.type !== 'string')[0];
    return node ? Object.assign({}, ...[node.props.style].flat(5).filter(Boolean)) : null;
  };
  const poser = () => {
    registerTourTarget('header.back', (done) => done({
      height: 44, width: 44, x: 8, y: 30,
    }));
    // L'écran évite le clavier : la zone des champs s'arrête au-dessus de « Envoyer ».
    registerTourTarget('cf-zone', (done) => done({
      height: 316, width: 360, x: 0, y: 80,
    }));
  };

  it('la bulle tient au-dessus du clavier, sous l en-tête, avec la place de son bouton', async () => {
    mockKeyboard = { height: 180, screenY: 460 };
    mockTour = activeTour(step('m2-fields'));
    poser();
    const style = bulle(await renderLayer());
    expect(style).not.toBeNull();
    expect(style.top).toBeLessThan(120);
    // Toute la hauteur jusqu'au clavier : sa consigne et « Suivant » y tiennent (plus 58 px).
    expect(style.top + style.maxHeight).toBeLessThanOrEqual(460);
    expect(style.maxHeight).toBeGreaterThanOrEqual(110);
  });

  it('clavier fermé : la bulle d avant, rien ne change', async () => {
    mockTour = activeTour(step('m2-fields'));
    poser();
    const style = bulle(await renderLayer());
    expect(style).not.toBeNull();
  });
});
