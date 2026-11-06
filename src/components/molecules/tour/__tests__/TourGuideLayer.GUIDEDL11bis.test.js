import renderer, { act } from 'react-test-renderer';

import { resetGuidanceRuntimeForTests } from '@/domains/guidance/guidanceRuntime';
import { PRESIDENT_GUIDE } from '@/domains/tour/presidentGuide';
import { registerTourTarget, resetTourTargetsForTests } from '@/domains/tour/tourTargetRegistry';

import TourGuideLayer from '../TourGuideLayer';

// Recette L11 du guide Dirigeant (06/11), vue de la couche :
// - l11-b1e3 : en B1 1/6, le titre de mission sur deux lignes faisait déborder la bulle de sa place
//   réservée (112 pt) ; « Passer ce bonus » restait coupé au bas, à faire défiler dans la bulle ;
// - l11-m1-reprise : sur l'Accueil, la bulle 3/5 n'avait plus sa consigne « ouvre ».

jest.setTimeout(30000);

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

const step = (id) => PRESIDENT_GUIDE.steps.find((candidate) => candidate.id === id);
const bubbleOf = (tree) => tree.root.findAll((node) => node.props.testID === 'tour.bubble'
  && typeof node.type === 'string')[0];
const scrollOf = (tree) => tree.root.findAll((node) => node.props.testID === 'tour.bubble.scroll'
  && typeof node.props.onContentSizeChange === 'function')[0];
const textOf = (tree) => tree.root.findAll((node) => typeof node.type === 'string'
  && typeof node.props.children === 'string').map((node) => node.props.children).join(' ');
const HEADER = {
  height: 56, width: 390, x: 0, y: 0,
};
const SLOT = {
  height: 112, width: 390, x: 0, y: 150,
};
const contentOf = async (tree, height) => {
  await act(async () => { scrollOf(tree).props.onContentSizeChange(358, height); });
  await flush();
};

describe('l11-b1e3 — la bulle plus haute que sa place remonte, son pied reste visible', () => {
  const mountC1 = async () => {
    mockTour = activeTour(step('c1'));
    mountTarget('screen.header', HEADER);
    mountTarget('tour.bubbleSlot', SLOT);
    mountTarget('teamWizard.field', {
      height: 400, width: 358, x: 16, y: 270,
    });
    return renderLayer();
  };

  it('contenu de 170 : bas de la bulle au bas de la place, rien à faire défiler', async () => {
    const tree = await mountC1();
    await contentOf(tree, 170);
    const style = styleOf(bubbleOf(tree));
    expect(style.top).toBe(SLOT.y + SLOT.height - 170 + STATUS_BAR);
    expect(style.maxHeight).toBeGreaterThanOrEqual(170);
  });

  it('trop haute pour tenir sous l’en-tête : elle reste dans sa place et défile', async () => {
    const tree = await mountC1();
    await contentOf(tree, 260);
    const style = styleOf(bubbleOf(tree));
    expect(style.top).toBe(SLOT.y + STATUS_BAR);
    expect(style.maxHeight).toBe(SLOT.height);
  });

  it('témoin : une bulle qui tient reste dans sa place', async () => {
    const tree = await mountC1();
    await contentOf(tree, 100);
    const style = styleOf(bubbleOf(tree));
    expect(style.top).toBe(SLOT.y + STATUS_BAR);
    expect(style.maxHeight).toBe(SLOT.height);
  });
});

describe('l11-m1-reprise — sur l’Accueil, la bulle dit d’ouvrir « Gérer mon club »', () => {
  const CARD = {
    height: 180, width: 170, x: 16, y: 300,
  };

  it.each(['m1-partners', 'm1-fac'])('%s : carte entourée, consigne « ouvre »', async (id) => {
    mockTour = activeTour({ ...step(id), when: undefined });
    mountTarget('home.card.manage-club', CARD);
    const tree = await renderLayer();
    expect(textOf(tree)).toMatch(/Ouvre « Gérer mon club »/);
    expect(tree.root.findAll((node) => typeof node.type === 'string'
      && node.props.testID === 'tour.hole.0').length).toBe(1);
  });

  it('témoin : sur la fiche, la bulle de l’étape', async () => {
    mockTour = activeTour(step('m1-fac'));
    mountTarget('home.card.manage-club', CARD);
    mountTarget('club.m.facilities', CARD);
    const tree = await renderLayer();
    expect(textOf(tree)).toMatch(/Tes installations/);
    expect(textOf(tree)).not.toMatch(/Gérer mon club/);
  });
});
