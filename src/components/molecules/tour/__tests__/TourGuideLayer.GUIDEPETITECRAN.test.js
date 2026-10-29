import renderer, { act } from 'react-test-renderer';

import { resetGuidanceRuntimeForTests } from '@/domains/guidance/guidanceRuntime';
import { COACH_GUIDE } from '@/domains/tour/coachGuide';
import { registerTourTarget, resetTourTargetsForTests } from '@/domains/tour/tourTargetRegistry';

import { placeBubble } from '../tourGuideGeometry';
import TourGuideLayer from '../TourGuideLayer';

// GUIDE-PETIT-ECRAN (rejeu 3 du guide Entraîneur, 29/10, Pixel 720×1280 px,
// densité 2,625 ⇒ 274×488 pt, texte 1,3) : la bulle dépassait la place qu'on
// lui donnait. Décision A du chef : hauteur bornée à la place, contenu qui
// défile dans la bulle, la liste visée garde au moins une ligne visible.

jest.setTimeout(30000);

let mockTour;
// Réglage « taille du texte » du téléphone, lu par la couche.
let mockFontScale = 1.3;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    fontScale: mockFontScale, height: 488, scale: 2.625, width: 274,
  }),
}));
let mockIsAddingAccount;
jest.mock('@/context/useTour', () => ({ useTour: () => mockTour }));
jest.mock('@/store/appContext', () => ({
  useAppContext: () => [{ auth: { token: 'jeton' }, isAddingAccount: mockIsAddingAccount }],
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 18, left: 0, right: 0, top: 24,
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

const SCREEN = { height: 488, width: 274 };
// Origine de la couche plein écran mesurée par Android : sous la barre d'état.
const STATUS_BAR = 24;

const activeTour = (step) => ({
  completeCurrentStep: jest.fn(),
  currentMission: { locked: false, title: 'Convoquer pour un match' },
  currentStep: step,
  exitTour: jest.fn(),
  gauge: 100,
  isGuide: true,
  isLockedStep: false,
  isTourActive: true,
  missionPosition: { index: 2, isBonus: true, total: 2 },
  pauseTour: jest.fn(),
  resumeTour: jest.fn(),
  reward: null,
  skipMission: jest.fn(),
  tourStatus: 'active',
});

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
const step = (id) => COACH_GUIDE.steps.find((candidate) => candidate.id === id);
const bubbleOf = (tree) => tree.root.findAll((node) => node.props.testID === 'tour.bubble'
  && typeof node.type !== 'string')[0];
const hostBubbleOf = (tree) => tree.root.findAll((node) => node.props.testID === 'tour.bubble'
  && typeof node.type === 'string')[0];

/**
 * La bulle se mesure (Android) : hauteur de son contenu entier.
 * @param {any} tree - Rendu.
 * @param {number} height - Hauteur mesurée.
 * @returns {Promise<void>}
 */
const measureBubble = async (tree, height) => {
  await act(async () => {
    bubbleOf(tree).props.onLayout({
      nativeEvent: {
        layout: {
          height, width: 246, x: 0, y: 0,
        },
      },
    });
  });
  await flush();
};

/**
 * Rectangle réellement occupé par la bulle (hauteur bornée par `maxHeight`).
 * @param {any} tree - Rendu.
 * @param {number} wanted - Hauteur du contenu.
 * @returns {{ bottom: number; top: number }} Haut et bas, repère de la couche.
 */
const bubbleBox = (tree, wanted) => {
  const style = styleOf(hostBubbleOf(tree));
  const height = Math.min(wanted, style.maxHeight ?? Infinity);
  return { bottom: style.top + height, top: style.top };
};

beforeEach(() => {
  jest.useFakeTimers();
  resetTourTargetsForTests();
  resetGuidanceRuntimeForTests();
  mockIsAddingAccount = false;
  mockFontScale = 1.3;
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

// Mesures du rejeu 3 ramenées en points (px / 2,625), repère sans barre d'état.
const HEADER = {
  height: 98, width: 274, x: 0, y: 0,
};
const DOCK_IDS = ['dock.home', 'dock.planning', 'dock.teams'];
const mountDock = (y) => DOCK_IDS.forEach((id, index) => mountTarget(id, {
  height: 60, width: 60, x: 20 + (index * 87), y,
}));

describe('point 1 — b2-list (Convoqués), 720×1280, texte 1,3', () => {
  it('la bulle se pose dans la place gardée au-dessus de la liste, sans la dépasser', async () => {
    mockTour = activeTour(step('b2-list'));
    mountTarget('screen.header', HEADER);
    // Place réservée par l'écran (TourBubbleSlot), sous la barre 1/2.
    const slot = {
      height: 112, width: 274, x: 0, y: 108,
    };
    mountTarget('tour.bubbleSlot', slot);
    const tree = await renderLayer();
    // Bulle de R3-21 : 490 px à 1,3 ⇒ 187 pt.
    await measureBubble(tree, 187);
    const box = bubbleBox(tree, 187);
    expect(box.top).toBe(slot.y + STATUS_BAR);
    // Onglets, recherche et lignes de joueurs, sous la place, restent visibles.
    expect(box.bottom).toBeLessThanOrEqual(slot.y + slot.height + STATUS_BAR);
  });
});

describe('point 1 — b2-where (sans cible) : la bulle ne dépasse jamais l’écran', () => {
  it('bulle plus haute que l’écran : bornée au-dessus de la barre d’onglets', async () => {
    mockTour = activeTour(step('b2-where'));
    mountTarget('screen.header', HEADER);
    mountDock(402);
    const tree = await renderLayer();
    await measureBubble(tree, 560);
    const box = bubbleBox(tree, 560);
    expect(box.bottom).toBeLessThanOrEqual(402 + STATUS_BAR);
  });

  it('sans barre d’onglets : bornée au bas sûr de l’écran', async () => {
    mockTour = activeTour(step('b2-where'));
    const tree = await renderLayer();
    await measureBubble(tree, 560);
    const box = bubbleBox(tree, 560);
    expect(box.bottom).toBeLessThanOrEqual(SCREEN.height - 18);
  });

  it('le contenu défile DANS la bulle (rien n’est perdu)', async () => {
    mockTour = activeTour(step('b2-where'));
    const tree = await renderLayer();
    const scroll = tree.root.findAll((node) => node.props.testID === 'tour.bubble.scroll'
      && typeof node.type !== 'string');
    expect(scroll.length).toBeGreaterThan(0);
  });
});

describe('point 2 — b2-start, 720×1280, texte 1,0', () => {
  it('bulle de 140 pt pour une place de 112 : elle s’arrête au bas de la place', async () => {
    mockFontScale = 1;
    mockTour = activeTour(step('b2-start'));
    mountTarget('screen.header', HEADER);
    // R3-16 : place 332→626 px ⇒ 112 pt de haut ; bulle 332→701 px ⇒ 140 pt.
    const slot = {
      height: 112, width: 274, x: 0, y: 102,
    };
    mountTarget('tour.bubbleSlot', slot);
    const tree = await renderLayer();
    await measureBubble(tree, 140);
    const box = bubbleBox(tree, 140);
    expect(box.bottom).toBeLessThanOrEqual(slot.y + slot.height + STATUS_BAR);
  });
});

describe('point 4 — b1-card : la couche encadre la séance quand elle est visible', () => {
  it('carte de la prochaine séance à l’écran, au-dessus des onglets : un cadre', async () => {
    mockFontScale = 1;
    mockTour = activeTour(step('b1-card'));
    mountDock(402);
    mountTarget('planning.event.next', {
      height: 120, width: 240, x: 17, y: 240,
    });
    const tree = await renderLayer();
    const holes = tree.root.findAll((node) => node.props.testID === 'tour.hole.0'
      && typeof node.type === 'string');
    expect(holes).toHaveLength(1);
  });
});

describe('point 5 — rv-m3 : le titre de mission n’est jamais coupé', () => {
  it('« MISSION 3/4 · PROGRAMMER L’ENTRAÎNEMENT DE LA SEMAINE » sans limite', async () => {
    mockFontScale = 1;
    mockTour = {
      ...activeTour(step('rv-m3')),
      currentMission: { title: 'Programmer l’entraînement de la semaine' },
      missionPosition: { index: 3, isBonus: false, total: 4 },
    };
    const tree = await renderLayer();
    const kicker = tree.root.findAll((node) => typeof node.type === 'string'
      && String(node.props.children).startsWith('Mission 3/4'))[0];
    expect(kicker).toBeTruthy();
    expect(kicker.props.numberOfLines).toBeUndefined();
  });
});

describe('point 6 — rv-m1 : la bulle va sous « Nouvelle équipe » quand elle y tient', () => {
  it('écran 411×923 pt (R3-05) : la carte EN ATTENTE, au-dessus, reste libre', () => {
    // R3-05, en points : « Nouvelle équipe » 985→1170 px affichés (×1,21 / 2,625),
    // carte EN ATTENTE juste au-dessus, barre d'onglets à 1760 px affichés.
    const primary = {
      height: 85, width: 375, x: 18, y: 454,
    };
    const position = placeBubble({
      bottomLimit: 811,
      bubbleHeight: 136,
      height: 923,
      insetTop: 24,
      primary,
      top: false,
      width: 411,
    });
    expect(position.arrow).toBe('up');
    expect(position.top).toBeGreaterThanOrEqual(primary.y + primary.height);
  });

  it('témoin : une cible basse garde sa bulle au-dessus', () => {
    const primary = {
      height: 85, width: 375, x: 18, y: 700,
    };
    const position = placeBubble({
      bottomLimit: 811,
      bubbleHeight: 136,
      height: 923,
      insetTop: 24,
      primary,
      top: false,
      width: 411,
    });
    expect(position.arrow).toBe('down');
    expect(position.top + 136).toBeLessThanOrEqual(primary.y);
  });
});

// PETITSBUGS-3, point 6 (rejeu 4, R4-17, vu sur 08779ba1) : sur une bulle
// ÉTROITE (304 pt, flèche vers l'onglet), « MISSION 3/4 · PROGRAMMER L'ENTR… ».
describe('PETITSBUGS-3 — titre de mission entier sur une bulle étroite (m3-dock)', () => {
  it('bulle à flèche, 304 pt de large : aucune limite de lignes sur le titre', async () => {
    mockFontScale = 1;
    mockTour = {
      ...activeTour(step('m3-dock')),
      currentMission: { title: 'Programmer l’entraînement de la semaine' },
      missionPosition: { index: 3, isBonus: false, total: 4 },
    };
    mountDock(402);
    const tree = await renderLayer();
    expect(styleOf(hostBubbleOf(tree)).width).toBeLessThan(SCREEN.width - 28 + 1);
    const kicker = tree.root.findAll((node) => typeof node.type === 'string'
      && String(node.props.children).startsWith('Mission 3/4'))[0];
    expect(kicker).toBeTruthy();
    expect(kicker.props.numberOfLines).toBeUndefined();
  });
});
