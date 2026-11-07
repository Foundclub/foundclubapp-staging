import renderer, { act } from 'react-test-renderer';

import {
  emitGuidanceRefusal,
  emitGuidanceRouteVisit,
  resetGuidanceRuntimeForTests,
} from '@/domains/guidance/guidanceRuntime';
import { COACH_GUIDE } from '@/domains/tour/coachGuide';
import { registerTourTarget, resetTourTargetsForTests } from '@/domains/tour/tourTargetRegistry';

import { RouteNames } from '@/navigation/routeNames';

import TourGuideLayer from '../TourGuideLayer';

// G93 (recette du coach neuf sur la 2.6.92, captures s53-s57) : un glissement parti de l'onglet
// entouré fait monter la page, l'onglet passe sous l'en-tête fixe, cadre et voile restent sur le
// titre et plus rien ne répond. Sortie par la flèche : le guide s'efface sans un mot.

jest.setTimeout(30000);

const SCREEN = { height: 852, width: 393 };

let mockTour;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({
    fontScale: 1, height: 852, scale: 3, width: 393,
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
jest.mock('@/theme/colors', () => ({ withAlpha: (color) => color }));
jest.mock('@/hooks/useReduceMotion', () => ({ __esModule: true, default: () => true }));
jest.mock('@/theme/themeContext', () => ({
  __esModule: true,
  default: () => ({
    Colors: new Proxy({}, { get: () => 'couleur' }),
    Fonts: new Proxy({}, { get: () => ({ fontSize: 16, lineHeight: 20 }) }),
  }),
}));

// GUIDE-E-CORR (TG-15) : la mission 4 ne passe plus par les profils ni par les onglets de
// Rechercher. Leur forme reste le gabarit de ces témoins de la couche (géométrie des bulles).
const ANCIENNES_ETAPES_M4 = {
  'm4-read': {
    bubblePlacement: 'top', id: 'm4-read', missionId: 'coach_m4', nextLabel: 'Compris',
    targets: ['search.filters', 'search.result.0'], text: 'Fais défiler pour voir les profils.',
    veil: false,
  },
  'm4-tab-club': {
    advanceOn: { key: 'search.tab.clubs', type: 'interaction' }, bubblePlacement: 'top',
    id: 'm4-tab-club', missionId: 'coach_m4', resumeFrom: 'm4-back',
    targets: ['search.tab.clubs'], text: 'Les événements. Ouvre maintenant « Club ».',
  },
  'm4-tab-ev': {
    advanceOn: { key: 'search.tab.events', type: 'interaction' }, bubblePlacement: 'top',
    id: 'm4-tab-ev', missionId: 'coach_m4', resumeFrom: 'm4-back', scrollListToTop: true,
    targets: ['search.tab.events'], text: 'Ouvre l’onglet Événement (le calendrier).',
  },
};
const step = (id) => COACH_GUIDE.steps.find((candidate) => candidate.id === id)
  || ANCIENNES_ETAPES_M4[id];
const activeTour = (currentStep) => ({
  completeCurrentStep: jest.fn(),
  created: {},
  currentMission: { locked: true, title: 'Proposer un match amical' },
  currentStep,
  exitTour: jest.fn(),
  gauge: 75,
  isGuide: true,
  isLockedStep: true,
  isTourActive: true,
  missionPosition: { index: 4, isBonus: false, total: 4 },
  pauseTour: jest.fn(),
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
const tick = async (ms = 400) => {
  await act(async () => { jest.advanceTimersByTime(ms); });
  await flush();
};
const visitRoute = async (name) => {
  await act(async () => { emitGuidanceRouteVisit(name); });
  await tick();
};
const renderLayer = async () => {
  let tree;
  await act(async () => { tree = renderer.create(<TourGuideLayer />); });
  const root = tree.root.findAll((node) => node.props.testID === 'tour.layer'
    && typeof node.type !== 'string')[0];
  if (root) {
    root.instance.measureInWindow = (cb) => cb(0, 0, SCREEN.width, SCREEN.height);
    await act(async () => {
      root.props.onLayout({ nativeEvent: { layout: { ...SCREEN, x: 0, y: 0 } } });
    });
    await tick();
  }
  await flush();
  return tree;
};

const layerOf = (tree) => tree.root.findAll((node) => node.props.testID === 'tour.layer'
  && typeof node.type === 'string')[0];
const isShown = (tree) => Object.assign(
  {},
  ...[layerOf(tree).props.style].flat(5).filter(Boolean),
).opacity !== 0;
const textsOf = (tree) => tree.root.findAll((node) => typeof node.type === 'string'
  && typeof node.props.children === 'string').map((node) => node.props.children);
const blockers = (tree) => tree.root.findAll((node) => node.props.testID === 'tour.blocker');

const TAB_HOME = {
  height: 44, width: 90, x: 150, y: 150,
};
// Rect de l'onglet, modifiable pour simuler le défilement.
let tabRect;
const mountSearch = (id) => {
  registerTourTarget('header.back', (done) => done({
    height: 40, width: 40, x: 16, y: 60,
  }));
  return registerTourTarget(id, (done) => done(tabRect));
};

beforeEach(() => {
  jest.useFakeTimers();
  resetGuidanceRuntimeForTests();
  resetTourTargetsForTests();
  tabRect = TAB_HOME;
});

afterEach(() => {
  jest.useRealTimers();
});

describe('n° 1 — la cible passe sous l en-tête fixe', () => {
  it.each(['m4-tab-ev', 'm4-tab-club'])('%s, sous le titre : sans voile', async (id) => {
    const current = step(id);
    mountSearch(current.targets[0]);
    tabRect = { ...TAB_HOME, y: 66 };
    mockTour = activeTour(current);
    const tree = await renderLayer();
    expect(blockers(tree)).toHaveLength(0);
    expect(textsOf(tree).join(' ')).toContain('Fais défiler vers le haut');
  });

  it('à moitié sous le titre : pareil, le trou ne reste pas sur l en-tête', async () => {
    mountSearch('search.tab.events');
    tabRect = { ...TAB_HOME, y: 80 };
    mockTour = activeTour(step('m4-tab-ev'));
    const tree = await renderLayer();
    expect(blockers(tree)).toHaveLength(0);
    expect(textsOf(tree).join(' ')).toContain('Fais défiler vers le haut');
  });

  it('la page redescend : le voile revient seul', async () => {
    mountSearch('search.tab.events');
    tabRect = { ...TAB_HOME, y: 66 };
    mockTour = activeTour(step('m4-tab-ev'));
    const tree = await renderLayer();
    expect(blockers(tree)).toHaveLength(0);
    tabRect = TAB_HOME;
    await tick();
    expect(blockers(tree).length).toBeGreaterThan(0);
    expect(textsOf(tree).join(' ')).not.toContain('Fais défiler');
  });

  it('témoin : la cible juste sous l en-tête garde son voile', async () => {
    mountSearch('search.tab.events');
    tabRect = { ...TAB_HOME, y: 100 };
    mockTour = activeTour(step('m4-tab-ev'));
    const tree = await renderLayer();
    expect(blockers(tree).length).toBeGreaterThan(0);
  });

  it('témoin : le ⋮ de la fiche d équipe vit dans l en-tête, il garde son voile', async () => {
    registerTourTarget('header.back', (done) => done({
      height: 40, width: 40, x: 16, y: 60,
    }));
    registerTourTarget('team.more', (done) => done({
      height: 24, width: 16, x: 360, y: 66,
    }));
    mockTour = activeTour(COACH_GUIDE.steps.find((candidate) => (
      candidate.targets?.includes('team.more')
    )));
    const tree = await renderLayer();
    expect(blockers(tree).length).toBeGreaterThan(0);
    expect(textsOf(tree).join(' ')).not.toContain('Fais défiler');
  });
});

describe('n° 2 — sortie par la flèche : le guide ne s efface plus sans un mot', () => {
  const leave = async () => {
    const unmount = mountSearch('search.tab.events');
    mockTour = activeTour(step('m4-tab-ev'));
    const tree = await renderLayer();
    await visitRoute(RouteNames.SearchHub);
    await tick();
    unmount();
    await visitRoute(RouteNames.SearchHome);
    return tree;
  };

  it('témoin : pendant le passage d un écran à l autre, rien ne s affiche', async () => {
    const tree = await leave();
    expect(isShown(tree)).toBe(false);
  });

  it('écran quitté pour de bon : la bulle le dit et propose de reprendre', async () => {
    const tree = await leave();
    await tick(1600);
    expect(isShown(tree)).toBe(true);
    expect(textsOf(tree).join(' ')).toContain('Tu as quitté le guide');
    expect(blockers(tree)).toHaveLength(0);
    const resume = tree.root.findAll((node) => node.props.accessibilityRole === 'button'
      && typeof node.props.onPress === 'function'
      && node.props.onPress === mockTour.returnToGuide);
    expect(resume.length).toBeGreaterThan(0);
  });

  it('la cible revient : la bulle de l étape aussi', async () => {
    const tree = await leave();
    await tick(1600);
    registerTourTarget('search.tab.events', (done) => done(TAB_HOME));
    await visitRoute(RouteNames.SearchHub);
    await tick();
    expect(textsOf(tree).join(' ')).not.toContain('Tu as quitté le guide');
    expect(textsOf(tree).join(' ')).toContain('Ouvre l’onglet Événement');
  });
});

describe('sous-guide d installation (recette r3, e4 à e11)', () => {
  const FORM = {
    height: 120, width: 361, x: 16, y: 120,
  };
  let nameRect;
  const mountForm = () => {
    nameRect = FORM;
    registerTourTarget('facility.name', (done) => done(nameRect));
    registerTourTarget('facility.address', (done) => done({ ...FORM, y: 260 }));
    registerTourTarget('facility.create', (done) => done({ ...FORM, height: 56, y: 700 }));
  };
  const pressNext = async (tree) => {
    const next = tree.root.findAll((node) => node.props.testID === 'tour.next'
      && typeof node.props.onPress === 'function')[0];
    await act(async () => { next.props.onPress(); });
    await tick();
  };

  it('le premier champ sort par le haut : la bulle en cours reste, rien ne repart', async () => {
    mountForm();
    mockTour = activeTour(step('m3-place'));
    const tree = await renderLayer();
    await pressNext(tree);
    await pressNext(tree);
    expect(textsOf(tree).join(' ')).toContain('Adresse obligatoire');
    nameRect = { ...FORM, y: -400 };
    await tick();
    expect(textsOf(tree).join(' ')).toContain('Adresse obligatoire');
    expect(textsOf(tree).join(' ')).not.toContain('Choisis ton lieu');
    nameRect = FORM;
    await tick();
    expect(textsOf(tree).join(' ')).toContain('Adresse obligatoire');
  });

  it('la 1re bulle dit l obstacle avant de faire remplir', async () => {
    mountForm();
    mockTour = activeTour(step('m3-place'));
    const tree = await renderLayer();
    expect(textsOf(tree).join(' ')).toContain('offre Club');
  });

  it('achat refusé : la bulle donne la sortie, sur l offre et après « Plus tard »', async () => {
    mountForm();
    mockTour = activeTour(step('m3-place'));
    const tree = await renderLayer();
    await act(async () => { emitGuidanceRefusal('paywall.facility-manage-required'); });
    await tick();
    const texts = textsOf(tree).join(' ');
    expect(texts).toContain('Annuler');
    expect(texts).toContain('Extérieur');
    expect(texts).not.toContain('Tout est bon');
    expect(tree.root.findAll((node) => node.props.testID === 'tour.next')).toHaveLength(0);
    await tick(2000);
    expect(textsOf(tree).join(' ')).toContain('Annuler');
  });

  it('témoin : un autre refus ne change pas la bulle', async () => {
    mountForm();
    mockTour = activeTour(step('m3-place'));
    const tree = await renderLayer();
    await act(async () => { emitGuidanceRefusal('paywall.event-limit'); });
    await tick();
    expect(textsOf(tree).join(' ')).toContain('offre Club');
    expect(textsOf(tree).join(' ')).not.toContain('Annuler');
  });
});

describe('n° 3 — après Annuler, le sens du défilement', () => {
  const mountField = (y) => {
    registerTourTarget('header.back', (done) => done({
      height: 40, width: 40, x: 16, y: 60,
    }));
    registerTourTarget('teamWizard.field', (done) => done({
      height: 900, width: 360, x: 16, y,
    }));
  };

  it('tête du champ sous la bulle (« Extérieur » caché) : vers le haut', async () => {
    mountField(150);
    mockTour = activeTour(step('m3-place'));
    const tree = await renderLayer();
    const texts = textsOf(tree).join(' ');
    expect(texts).toContain('Fais défiler vers le haut');
    expect(texts).not.toContain('Fais défiler vers le bas');
  });

  it('témoin : tête dégagée, seul le bas dépasse : vers le bas', async () => {
    mountField(300);
    mockTour = activeTour(step('m3-place'));
    const tree = await renderLayer();
    expect(textsOf(tree).join(' ')).toContain('Fais défiler vers le bas');
  });
});

describe('n° 3 — la 1re bulle du sous-guide', () => {
  it('tient dans la place du 360×640 et garde la sortie « Extérieur »', () => {
    const text = step('m3-place').subGuides[0].bubbles[0][1]();
    expect(text.length).toBeLessThanOrEqual(54);
    expect(text).toContain('Extérieur');
    expect(text).toContain('offre Club');
  });
});
