import renderer, { act } from 'react-test-renderer';

import { PRESIDENT_GUIDE } from '@/domains/tour/presidentGuide';
import { registerTourTarget, resetTourTargetsForTests } from '@/domains/tour/tourTargetRegistry';

import TourGuideLayer from '../TourGuideLayer';

// GUIDE-D-CORR-4 (retours du testeur sur la TestFlight 2.6.98, 10/11) :
// M1098, mission 2 « Ajouter un coach », iPhone : « le pop up de la mission cache le bouton et il
// est coupé ». La zone du formulaire (cible de m2-fields) remplit l'écran jusqu'aux boutons du bas ;
// la bulle n'avait que le trou sous elle (111 pt), s'y posait sur « Envoyer l'invitation » et
// « Annuler », et son texte y était coupé.
// M1100, bonus 3 « Créer un groupe » : deux cadres à la fois (nom, autorisations).

jest.setTimeout(30000);

// iPhone 13 / 14 : 390 × 844, encoche 47, bas sûr 34.
const SCREEN = { height: 844, width: 390 };
const INSETS = { bottom: 34, top: 47 };

let mockTour;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    fontScale: 1, height: 844, scale: 3, width: 390,
  }),
}));
jest.mock('@/context/useTour', () => ({ useTour: () => mockTour }));
jest.mock('@/store/appContext', () => ({
  useAppContext: () => [{ auth: { token: 'jeton' }, isAddingAccount: false }],
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 47,
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
  currentMission: { locked: true, title: 'Inviter tes coachs' },
  currentStep,
  exitTour: jest.fn(),
  gauge: 25,
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
const styleOf = (node) => Object.assign({}, ...[node.props.style].flat(5).filter(Boolean));
const hostBubble = (tree) => tree.root.findAll((node) => node.props.testID === 'tour.bubble'
  && typeof node.type === 'string')[0];

/**
 * La bulle se mesure : contenu entier de `wanted` points (titre de mission sur deux lignes, texte
 * sur cinq, « Suivant »), comme sur la capture du testeur.
 * @param {any} tree - Rendu.
 * @param {number} wanted - Hauteur du contenu.
 * @returns {Promise<void>}
 */
const measureBubble = async (tree, wanted) => {
  const bubble = tree.root.findAll((node) => node.props.testID === 'tour.bubble'
    && typeof node.type !== 'string')[0];
  await act(async () => {
    bubble.props.onLayout({
      nativeEvent: {
        layout: {
          height: wanted, width: 362, x: 0, y: 0,
        },
      },
    });
  });
  const inner = bubble.findAll((node) => typeof node.props.onContentSizeChange === 'function');
  await act(async () => {
    inner.forEach((node) => node.props.onContentSizeChange(362, wanted));
  });
  await act(async () => { jest.advanceTimersByTime(400); });
  await flush();
};
const bubbleBox = (tree, wanted) => {
  const style = styleOf(hostBubble(tree));
  return {
    bottom: style.top + Math.min(wanted, style.maxHeight ?? Infinity),
    maxHeight: style.maxHeight ?? Infinity,
    top: style.top,
  };
};
const overlaps = (box, rect) => box.top < rect.y + rect.height && box.bottom > rect.y;

// Écran « Ajouter un·e entraîneur·e » à 390 × 844, mesuré sur la capture du testeur (÷ 3) :
// en-tête jusqu'à 96, zone du formulaire de 104 à 699, puis « Envoyer l'invitation » (52) et
// « Annuler » (48) jusqu'au bas sûr. Pendant une étape `bubbleSlot`, l'écran garde sous la zone la
// place de la bulle (112), et la zone rétrécit d'autant : c'est ce que fait `AddCoach`.
const SLOT_HEIGHT = 112;
const FOOTER = {
  height: 104, width: 358, x: 16, y: 706,
};
const registerAddCoach = (currentStep) => {
  const slot = Boolean(currentStep.bubbleSlot);
  const zoneBottom = FOOTER.y - 7 - (slot ? SLOT_HEIGHT : 0);
  registerTourTarget('header.back', (done) => done({
    height: 52, width: 52, x: 16, y: 44,
  }));
  registerTourTarget('cf-zone', (done) => done({
    height: zoneBottom - 104, width: 358, x: 16, y: 104,
  }));
  if (slot) {
    registerTourTarget('tour.bubbleSlot', (done) => done({
      height: SLOT_HEIGHT, width: 358, x: 16, y: zoneBottom,
    }));
  }
  registerTourTarget('cf-send', (done) => done({
    height: 52, width: 358, x: 16, y: FOOTER.y,
  }));
};

beforeEach(() => {
  jest.useFakeTimers();
  resetTourTargetsForTests();
  mockKeyboard = null;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('GUIDE-D-CORR-4 M1098 : la bulle de « Ajouter un coach » à 390 × 844', () => {
  it('m2-fields : la bulle laisse « Envoyer l’invitation » et « Annuler » libres', async () => {
    const currentStep = step('m2-fields');
    mockTour = activeTour(currentStep);
    registerAddCoach(currentStep);
    const tree = await renderLayer();
    await measureBubble(tree, 170);
    expect(overlaps(bubbleBox(tree, 170), FOOTER)).toBe(false);
  });

  it('m2-fields : la bulle tient entière dans l’écran (rien de coupé)', async () => {
    const currentStep = step('m2-fields');
    mockTour = activeTour(currentStep);
    registerAddCoach(currentStep);
    const tree = await renderLayer();
    await measureBubble(tree, 170);
    const box = bubbleBox(tree, 170);
    expect(box.maxHeight).toBeGreaterThanOrEqual(170);
    expect(box.top).toBeGreaterThanOrEqual(INSETS.top);
    expect(box.bottom).toBeLessThanOrEqual(SCREEN.height - INSETS.bottom);
  });

  it('témoin : m2-send, la bulle laisse le bouton désigné libre', async () => {
    const currentStep = step('m2-send');
    mockTour = activeTour(currentStep);
    registerAddCoach(currentStep);
    const tree = await renderLayer();
    await measureBubble(tree, 130);
    expect(overlaps(bubbleBox(tree, 130), {
      height: 52, width: 358, x: 16, y: FOOTER.y,
    })).toBe(false);
  });
});

describe('GUIDE-D-CORR-4 M1100 : création du groupe, un seul cadre à la fois', () => {
  const holes = (tree) => tree.root.findAll((node) => typeof node.type === 'string'
    && String(node.props.testID || '').startsWith('tour.hole.'));
  // « Nouveau groupe » mesuré sur les captures (÷ 3) : le nom (toute la largeur), les autorisations.
  const NAME = {
    height: 66, width: 225, x: 105, y: 151,
  };
  const PERMS = {
    height: 90, width: 352, x: 19, y: 267,
  };
  const registerGroup = () => {
    registerTourTarget('header.back', (done) => done({
      height: 52, width: 52, x: 40, y: 69,
    }));
    registerTourTarget('grp-name', (done) => done(NAME));
    registerTourTarget('grp-perms', (done) => done(PERMS));
  };

  it.each(['b3-name', 'b3-perms', 'b3-create'])('%s : une seule zone désignée', async (id) => {
    const currentStep = step(id);
    expect(currentStep).toBeDefined();
    mockTour = activeTour(currentStep);
    registerGroup();
    registerTourTarget('grp-create', (done) => done({
      height: 52, width: 358, x: 16, y: 740,
    }));
    const tree = await renderLayer();
    expect(holes(tree).length).toBeLessThanOrEqual(1);
  });

  it('b3-name, clavier ouvert : la bulle ne cache pas le champ du nom', async () => {
    mockKeyboard = { height: 336, screenY: 508 };
    mockTour = activeTour(step('b3-name'));
    registerGroup();
    const tree = await renderLayer();
    await measureBubble(tree, 120);
    expect(hostBubble(tree)).toBeDefined();
    expect(overlaps(bubbleBox(tree, 120), NAME)).toBe(false);
  });

  it('b3-perms, clavier fermé : la bulle ne cache ni le nom ni les autorisations', async () => {
    const currentStep = step('b3-perms');
    expect(currentStep).toBeDefined();
    mockTour = activeTour(currentStep);
    registerGroup();
    const tree = await renderLayer();
    await measureBubble(tree, 150);
    const box = bubbleBox(tree, 150);
    expect(overlaps(box, NAME)).toBe(false);
    expect(overlaps(box, PERMS)).toBe(false);
  });
});
