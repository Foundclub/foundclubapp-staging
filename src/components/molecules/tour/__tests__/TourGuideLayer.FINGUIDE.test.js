import { Keyboard } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { resetGuidanceRuntimeForTests } from '@/domains/guidance/guidanceRuntime';
import { COACH_GUIDE } from '@/domains/tour/coachGuide';
import { registerTourTarget, resetTourTargetsForTests } from '@/domains/tour/tourTargetRegistry';

import TourGuideLayer from '../TourGuideLayer';

// FIN-GUIDE, points 3 et 4 (recette d'Adel sur iPhone, 02/11) : étape 1/8, clavier ouvert, la
// bulle dans sa place réservée ne laissait qu'une fente au champ (capture 3) ; M2, la bulle
// couvrait le titre et les onglets de la fiche d'équipe (capture 4).

jest.setTimeout(30000);

// iPhone 15 : 393×852, clavier français 336 pt.
const SCREEN = { height: 852, width: 393 };
const KEYBOARD_TOP = 516;

let mockTour;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    fontScale: 1.3, height: 852, scale: 3, width: 393,
  }),
}));
jest.mock('@/context/useTour', () => ({ useTour: () => mockTour }));
jest.mock('@/store/appContext', () => ({
  useAppContext: () => [{ auth: { token: 'jeton' }, isAddingAccount: false }],
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 59,
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
jest.mock('@/components/molecules/tour/TourTeamChoice', () => ({
  __esModule: true, default: () => 'QUESTION',
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

const step = (id) => COACH_GUIDE.steps.find((candidate) => candidate.id === id);
const activeTour = (currentStep) => ({
  completeCurrentStep: jest.fn(),
  created: {},
  currentMission: { locked: true, title: 'Créer ton équipe' },
  currentStep,
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
    root.instance.measureInWindow = (cb) => cb(0, 0, SCREEN.width, SCREEN.height);
    await act(async () => {
      root.props.onLayout({ nativeEvent: { layout: { ...SCREEN, x: 0, y: 0 } } });
      jest.advanceTimersByTime(400);
    });
  }
  await flush();
  return tree;
};

const styleOf = (node) => Object.assign({}, ...[node.props.style].flat(5).filter(Boolean));
const hostBubbleOf = (tree) => tree.root.findAll((node) => node.props.testID === 'tour.bubble'
  && typeof node.type === 'string')[0];
const textsOf = (tree) => tree.root.findAll((node) => typeof node.type === 'string'
  && typeof node.props.children === 'string').map((node) => node.props.children);

const SLOT = {
  height: 112, width: 361, x: 16, y: 300,
};
const WIZARD_RECTS = () => {
  mountTarget('screen.header', {
    height: 44, width: 361, x: 16, y: 65,
  });
  mountTarget('tour.bubbleSlot', SLOT);
  mountTarget('teamWizard.field', {
    height: 120, width: 361, x: 16, y: 300,
  });
  mountTarget('teamWizard.next', {
    height: 56, width: 361, x: 16, y: 440,
  });
};

let listeners;
let addListener;
const openKeyboard = (screenY = KEYBOARD_TOP) => act(async () => {
  listeners.keyboardWillShow?.({
    endCoordinates: {
      height: SCREEN.height - screenY, screenX: 0, screenY, width: SCREEN.width,
    },
  });
  listeners.keyboardDidShow?.({
    endCoordinates: {
      height: SCREEN.height - screenY, screenX: 0, screenY, width: SCREEN.width,
    },
  });
  jest.advanceTimersByTime(400);
});

beforeEach(() => {
  jest.useFakeTimers();
  resetGuidanceRuntimeForTests();
  resetTourTargetsForTests();
  listeners = {};
  addListener = jest.spyOn(Keyboard, 'addListener').mockImplementation((name, handler) => {
    listeners[name] = handler;
    return { remove: () => { delete listeners[name]; } };
  });
});

afterEach(() => {
  addListener.mockRestore();
  jest.useRealTimers();
});

describe('point 3 — clavier ouvert dans le tunnel équipe', () => {
  it('témoin : clavier fermé, la bulle garde sa place réservée et son titre', async () => {
    WIZARD_RECTS();
    mockTour = activeTour(step('tw1'));
    const tree = await renderLayer();
    expect(styleOf(hostBubbleOf(tree)).top).toBe(SLOT.y);
    expect(textsOf(tree).join(' ')).toMatch(/Mission 1\/4/);
  });

  it('clavier ouvert : bulle compacte sous l’en-tête, hors de la place réservée', async () => {
    WIZARD_RECTS();
    mockTour = activeTour(step('tw1'));
    const tree = await renderLayer();
    await openKeyboard();
    await flush();
    const style = styleOf(hostBubbleOf(tree));
    expect(style.top).toBe(65 + 44 + 6);
    expect(textsOf(tree).join(' ')).not.toMatch(/Mission 1\/4/);
    expect(textsOf(tree).join(' ')).toMatch(/Donne un nom/);
  });

  it('clavier ouvert : la bulle ne descend jamais sous le haut du clavier', async () => {
    WIZARD_RECTS();
    mockTour = activeTour(step('tw1'));
    const tree = await renderLayer();
    await openKeyboard();
    await flush();
    const style = styleOf(hostBubbleOf(tree));
    expect(style.top + style.maxHeight).toBeLessThanOrEqual(KEYBOARD_TOP);
  });

  it('iPhone 8 (407 pt visibles) : la bulle réduite tient au-dessus du clavier', async () => {
    WIZARD_RECTS();
    mockTour = activeTour(step('tw1'));
    const tree = await renderLayer();
    await openKeyboard(407);
    await flush();
    const style = styleOf(hostBubbleOf(tree));
    expect(style.top + style.maxHeight).toBeLessThanOrEqual(407);
  });

  it('plus petit (352 pt visibles) : le champ passe d’abord, la bulle attend le clavier fermé', async () => {
    WIZARD_RECTS();
    mockTour = activeTour(step('tw1'));
    const tree = await renderLayer();
    await openKeyboard(352);
    await flush();
    expect(hostBubbleOf(tree)).toBeUndefined();
  });

  it('étape hors tunnel avec une cible en bas : le bas utile s’arrête au clavier', async () => {
    mountTarget('teams.fab', {
      height: 60, width: 60, x: 300, y: 440,
    });
    mockTour = activeTour({ ...step('m1-new'), variants: [] });
    const tree = await renderLayer();
    await openKeyboard();
    await flush();
    const style = styleOf(hostBubbleOf(tree));
    expect(style.top).toBeLessThan(440);
  });
});

describe('point 3 — la liste du tunnel reste à portée du doigt', () => {
  const blockersOf = (tree) => tree.root.findAll((node) => node.props.testID === 'tour.blocker'
    && typeof node.type !== 'string');

  it('aucun bloqueur sur la liste, même si le champ est sous son bord', async () => {
    mountTarget('screen.header', {
      height: 44, width: 361, x: 16, y: 65,
    });
    mountTarget('teamWizard.viewport', {
      height: 300, width: 361, x: 16, y: 120,
    });
    mountTarget('teamWizard.next', {
      height: 56, width: 361, x: 16, y: 440,
    });
    mockTour = activeTour(step('tw2'));
    const tree = await renderLayer();
    const blockers = blockersOf(tree).map((node) => styleOf(node));
    expect(blockers.length).toBeGreaterThan(0);
    // Le point au milieu de la liste ne tombe sur aucun bloqueur.
    const covers = (b) => b.left <= 200 && b.left + b.width >= 200
      && b.top <= 270 && b.top + b.height >= 270;
    expect(blockers.some(covers)).toBe(false);
  });
});

describe('point 4 — la bulle de M2 sous les onglets', () => {
  it('sans cible : elle se pose sous « team.tabs », pas sur les onglets', async () => {
    mountTarget('header.back', {
      height: 40, width: 40, x: 16, y: 60,
    });
    mountTarget('team.tabs', {
      height: 50, width: 361, x: 16, y: 190,
    });
    mockTour = activeTour(step('m2-pick'));
    const tree = await renderLayer();
    expect(styleOf(hostBubbleOf(tree)).top).toBe(190 + 50 + 6);
  });

  it('le bouton de sortie est là, quoi que réponde le système', async () => {
    mockTour = activeTour(step('m2-pick'));
    const tree = await renderLayer();
    expect(textsOf(tree)).toContain('C’est envoyé');
  });
});

// GUIDE-STORES : lieu du match amical, la bulle dans sa place réservée recouvrait la recherche et
// la croix de la feuille d'adresse : ni taper, ni fermer. Et la couche reste montée, sinon elle ne
// se mesure plus et la bulle ne revient jamais (constaté à l'émulateur).
// GUIDE-STORES (recette RECETTE-GUIDE-AZ) : « Fais défiler pour voir les profils », puis l'onglet
// visé est sorti de la liste : ni cadre, ni voile, ni bouton, et aucune indication de sens.
describe('la cible a été sortie de sa liste par un défilement', () => {
  const VIEWPORT = {
    height: 700, width: 361, x: 16, y: 100,
  };
  const tabAt = (y) => {
    mountTarget('search.viewport', VIEWPORT);
    registerTourTarget('search.tab.events', (done) => done({
      height: 44, width: 44, x: 16, y,
    }), { clipTo: 'search.viewport' });
    mockTour = activeTour(step('m4-tab-ev'));
  };

  it('au-dessus de la liste, même sans passer le haut de l écran : vers le haut', async () => {
    tabAt(40);
    const tree = await renderLayer();
    expect(textsOf(tree)).toContain('Fais défiler vers le haut.');
  });

  it('à peine dépassant du haut de la liste : jamais « vers le bas »', async () => {
    tabAt(90);
    const tree = await renderLayer();
    expect(textsOf(tree)).not.toContain('Fais défiler vers le bas.');
  });

  it('sous la liste : vers le bas', async () => {
    tabAt(900);
    const tree = await renderLayer();
    expect(textsOf(tree)).toContain('Fais défiler vers le bas.');
  });

  it('témoin : dans la liste, elle est cadrée, sans indication', async () => {
    tabAt(300);
    const tree = await renderLayer();
    expect(textsOf(tree).join(' ')).not.toMatch(/Fais défiler/);
  });
});

// GUIDE-STORES : « Vérifie le récap » sur un récap voilé, qui ne défilait pas.
// GUIDE-STORES : sous le voile, l'écran ne défilait que si le doigt partait de la cible. Une cible
// coupée doit pouvoir être amenée d'où qu'on pose le doigt, et la bulle le dit.
describe('une cible coupée se fait défiler depuis tout l écran', () => {
  const dockAt = (y) => ['dock.home', 'dock.planning', 'dock.teams'].forEach((id, index) => {
    mountTarget(id, {
      height: 60, width: 60, x: 20 + (index * 90), y,
    });
  });
  const blockers = (tree) => tree.root.findAll((node) => node.props.testID === 'tour.blocker');

  it('rognée par la barre du bas : pas de bloqueur, et la bulle dit de défiler', async () => {
    dockAt(760);
    mountTarget('teams.trained.0', {
      height: 200, width: 361, x: 16, y: 700,
    });
    mockTour = activeTour(step('m2-card'));
    const tree = await renderLayer();
    expect(blockers(tree)).toHaveLength(0);
    expect(textsOf(tree)).toContain('Fais défiler vers le bas.');
  });

  it('étape déjà sans voile : rien à lever, la bulle ne s allonge pas', async () => {
    dockAt(760);
    mountTarget('teamWizard.next', {
      height: 200, width: 361, x: 16, y: 700,
    });
    mockTour = activeTour(step('m3-when'));
    const tree = await renderLayer();
    expect(textsOf(tree).join(' ')).not.toMatch(/Fais défiler/);
  });

  it('témoin : entière, le voile et ses bloqueurs restent', async () => {
    dockAt(760);
    mountTarget('teams.trained.0', {
      height: 200, width: 361, x: 16, y: 300,
    });
    mockTour = activeTour(step('m2-card'));
    const tree = await renderLayer();
    expect(blockers(tree).length).toBeGreaterThan(0);
    expect(textsOf(tree).join(' ')).not.toMatch(/Fais défiler/);
  });
});

describe('un récap à vérifier se lit en entier', () => {
  const blockersOf = (tree) => tree.root.findAll((node) => node.props.testID === 'tour.blocker'
    && typeof node.type === 'string');

  it.each(['m3-create', 'm4-am7'])('%s : la liste se touche sous le voile', async (id) => {
    mountTarget('teamWizard.viewport', {
      height: 300, width: 361, x: 16, y: 120,
    });
    mountTarget('teamWizard.next', {
      height: 56, width: 361, x: 16, y: 440,
    });
    mockTour = activeTour(step(id));
    const tree = await renderLayer();
    const blockers = blockersOf(tree).map((node) => styleOf(node));
    expect(blockers.length).toBeGreaterThan(0);
    const covers = (b) => b.left <= 200 && b.left + b.width >= 200
      && b.top <= 270 && b.top + b.height >= 270;
    expect(blockers.some(covers)).toBe(false);
  });
});

describe('une liste de choix ouverte par-dessus l écran', () => {
  const layerOf = (tree) => tree.root.findAll((node) => node.props.testID === 'tour.layer'
    && typeof node.type === 'string')[0];
  const openSheet = () => registerTourTarget('select.sheet', (done) => done({
    height: 1, width: 1, x: 0, y: 0,
  }));

  it('la bulle se retire tant que la feuille est ouverte, et ne bloque aucun toucher', async () => {
    WIZARD_RECTS();
    openSheet();
    mockTour = activeTour(step('m4-am4'));
    const tree = await renderLayer();
    expect(styleOf(layerOf(tree)).opacity).toBe(0);
    expect(layerOf(tree).props.pointerEvents).toBe('none');
  });

  it('la feuille refermée, la bulle revient', async () => {
    WIZARD_RECTS();
    const close = openSheet();
    mockTour = activeTour(step('m4-am4'));
    const tree = await renderLayer();
    await act(async () => { close(); });
    await flush();
    expect(styleOf(layerOf(tree)).opacity).toBe(1);
    expect(hostBubbleOf(tree)).toBeDefined();
  });
});

describe('point 1 — la question plein écran', () => {
  it('étape « teamChoice » : la question, sans bulle', async () => {
    mockTour = activeTour(step('m1-choice'));
    let tree;
    await act(async () => { tree = renderer.create(<TourGuideLayer />); });
    expect(tree.toJSON()).toBe('QUESTION');
  });
});
