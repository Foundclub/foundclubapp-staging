import renderer, { act } from 'react-test-renderer';

import { emitGuidanceRouteVisit, resetGuidanceRuntimeForTests } from '@/domains/guidance/guidanceRuntime';
import { COACH_GUIDE } from '@/domains/tour/coachGuide';
import { registerTourTarget, resetTourTargetsForTests } from '@/domains/tour/tourTargetRegistry';

import TourGuideLayer from '../TourGuideLayer';
import TourResumePill from '../TourResumePill';

// TUTOE-CALIBRAGE (27/10) — tournée émulateur du 27/10 : la découpe tombait
// ~142 px (la barre d'état) AU-DESSUS de la cible, et toucher dans la découpe
// ne déclenchait rien. Deux causes, une correction chacune, pour TOUTES les
// étapes :
// 1. repère : sur Android, `measureInWindow` retire la barre d'état alors que
//    la couche, plein écran (edge-to-edge), commence à 0. La couche se mesure
//    elle-même avec la même fonction et retranche sa propre origine ;
// 2. toucher : les bloqueurs recevaient `x`/`y` en style (ignorés) au lieu de
//    `left`/`top` : tous empilés en haut à gauche, ils couvraient la découpe.

let mockTour;
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
    Fonts: new Proxy({}, { get: () => ({}) }),
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

/**
 * Cadres des découpes : bordure 2, rayon 16, en position absolue.
 * @param {any} tree - Rendu.
 * @returns {any[]} Cadres.
 */
const framesOf = (tree) => tree.root.findAll((node) => typeof node.type === 'string'
  && styleOf(node).borderRadius === 16 && styleOf(node).borderWidth === 2
  && styleOf(node).position === 'absolute');

/**
 * Bloqueurs de touches : Pressable invisibles hors des découpes.
 * @param {any} tree - Rendu.
 * @returns {any[]} Bloqueurs.
 */
const blockersOf = (tree) => tree.root.findAll((node) => typeof node.type !== 'string'
  && node.props.accessible === false && typeof node.props.onPress === 'function');

const covers = (style, x, y) => typeof style.left === 'number' && typeof style.top === 'number'
  && x >= style.left && x < style.left + style.width
  && y >= style.top && y < style.top + style.height;

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

describe('TourGuideLayer — repère commun cible / voile', () => {
  it('la découpe encadre la cible à 6 près, barre d’état comprise', async () => {
    mountTarget('teams.newTeam', {
      height: 120, width: 358, x: 16, y: 400,
    });
    mockTour = activeTour({ id: 'm1-new', targets: ['teams.newTeam'], text: 'Touche' });
    const tree = await renderLayer();
    const [frame] = framesOf(tree);
    expect(frame).toBeDefined();
    // Cible réelle dans la couche : y = 400 + 54 ; découpe = cible ± 6.
    expect(styleOf(frame)).toMatchObject({
      height: 132, left: 10, top: 400 + STATUS_BAR - 6, width: 370,
    });
  });
});

describe('TourGuideLayer — le toucher passe dans la découpe', () => {
  it('aucun bloqueur ne couvre la cible ; tout le reste est bloqué', async () => {
    mountTarget('teams.newTeam', {
      height: 120, width: 358, x: 16, y: 400,
    });
    mockTour = activeTour({ id: 'm1-new', targets: ['teams.newTeam'], text: 'Touche' });
    const tree = await renderLayer();
    const blockers = blockersOf(tree).map(styleOf);
    expect(blockers.length).toBeGreaterThan(0);
    // Centre de la cible, dans le repère de la couche.
    expect(blockers.some((style) => covers(style, 195, 454 + 60))).toBe(false);
    // Hors cible : au-dessus, en dessous, à gauche.
    [[195, 200], [195, 800], [5, 514]].forEach(([x, y]) => {
      expect(blockers.some((style) => covers(style, x, y))).toBe(true);
    });
  });
});

// Émulateur, M4 : la carte « Rechercher » était SOUS le bas de l'écran (y 1 449
// pour 923) : découpe de hauteur négative, bulle hors écran, écran voilé sans
// issue. Une cible hors écran ne compte pas : bulle en haut, écran libre pour
// faire défiler ; la re-mesure la découpe dès qu'elle entre à l'écran.
describe('TourGuideLayer — cible hors de l’écran', () => {
  it('ni voile ni découpe tant que la cible est sous le bas de l’écran', async () => {
    mountTarget('home.card.search-profiles', {
      height: 148, width: 176, x: 24, y: 1449 - STATUS_BAR,
    });
    mockTour = activeTour({ id: 'm4-card', targets: ['home.card.search-profiles'], text: 'x' });
    const tree = await renderLayer();
    expect(framesOf(tree)).toHaveLength(0);
    expect(blockersOf(tree)).toHaveLength(0);
  });
});

describe('TourGuideLayer — hors du mode connecté', () => {
  it('« Ajouter un compte » (écran de connexion) : ni voile ni bulle', async () => {
    mockIsAddingAccount = true;
    mountTarget('teams.newTeam', {
      height: 120, width: 358, x: 16, y: 400,
    });
    mockTour = activeTour({ id: 'm1-new', targets: ['teams.newTeam'], text: 'Touche' });
    const tree = await renderLayer();
    expect(tree.toJSON()).toBeNull();
  });
});

describe('TourGuideLayer — « équipe déjà là » vue de l’accueil', () => {
  it('sans la carte d’équipe à l’écran, la découpe montre l’onglet Équipes', async () => {
    mountTarget('dock.teams', {
      height: 60, width: 80, x: 160, y: 760,
    });
    mockTour = activeTour(COACH_GUIDE.steps.find((step) => step.id === 'm1-find'));
    const tree = await renderLayer();
    const [frame] = framesOf(tree);
    expect(frame).toBeDefined();
    expect(styleOf(frame)).toMatchObject({ left: 154, top: 760 + STATUS_BAR - 6 });
  });

  it('la carte d’équipe à l’écran garde la priorité', async () => {
    mountTarget('dock.teams', {
      height: 60, width: 80, x: 160, y: 760,
    });
    mountTarget('teams.trained.0', {
      height: 200, width: 358, x: 16, y: 300,
    });
    mockTour = activeTour(COACH_GUIDE.steps.find((step) => step.id === 'm1-find'));
    const tree = await renderLayer();
    expect(styleOf(framesOf(tree)[0])).toMatchObject({ top: 300 + STATUS_BAR - 6 });
  });
});

describe('Pastille « Reprendre le tour »', () => {
  const pausedTour = () => ({ ...activeTour(null), tourStatus: 'paused' });
  const texts = (tree) => tree.root.findAll((node) => typeof node.type === 'string'
    && typeof node.props.children === 'string').map((node) => node.props.children);

  it('n’est plus posée par-dessus l’écran par la couche (feuilles, Déconnexion)', async () => {
    mockTour = pausedTour();
    const tree = await renderLayer();
    expect(tree.toJSON()).toBeNull();
  });

  it('se rend dans le flux de l’accueil quand le guide est en pause', () => {
    mockTour = pausedTour();
    let tree;
    act(() => { tree = renderer.create(<TourResumePill />); });
    expect(texts(tree)).toContain('Reprendre le tour');
    const reprendre = tree.root.findAll((node) => node.props.accessibilityRole === 'button'
      && typeof node.props.onPress === 'function')[0];
    act(() => { reprendre.props.onPress(); });
    expect(mockTour.resumeTour).toHaveBeenCalledTimes(1);
  });

  it('ne se rend pas pendant une étape, ni hors guide', () => {
    mockTour = activeTour({ id: 'm1-new', targets: [], text: 'x' });
    let tree;
    act(() => { tree = renderer.create(<TourResumePill />); });
    expect(tree.toJSON()).toBeNull();
    mockTour = { ...pausedTour(), isGuide: false };
    act(() => { tree = renderer.create(<TourResumePill />); });
    expect(tree.toJSON()).toBeNull();
  });
});

// TUTOE-CALIBRAGE-2 (27/10, décisions du chef 3 et 6).
describe('Tunnel : hors de la route de l’étape, le voile tombe (décision 3)', () => {
  const recap = () => ({
    ...activeTour(COACH_GUIDE.steps.find((step) => step.id === 'm3-create')),
    stepRoute: 'EventWizardRecap',
  });
  const nextButton = () => mountTarget('teamWizard.next', {
    height: 56, width: 358, x: 16, y: 700,
  });

  it('sur l’écran de l’étape (« Crée ! ») : voile et bloqueurs', async () => {
    nextButton();
    mockTour = recap();
    const tree = await renderLayer();
    act(() => { emitGuidanceRouteVisit('EventWizardRecap'); });
    await flush();
    expect(blockersOf(tree).length).toBeGreaterThan(0);
  });

  it('retour en arrière dans le tunnel : plus aucun bloqueur, on peut corriger', async () => {
    nextButton();
    mockTour = recap();
    const tree = await renderLayer();
    act(() => { emitGuidanceRouteVisit('EventWizardDescription'); });
    await flush();
    expect(blockersOf(tree)).toHaveLength(0);
  });
});

describe('B1 « Ouvre ta séance » : découpe sur la carte du planning (décision 6)', () => {
  it('la carte de la séance créée en M3 est encadrée', async () => {
    mountTarget('planning.event.ev-42', {
      height: 140, width: 358, x: 16, y: 320,
    });
    mockTour = {
      ...activeTour(COACH_GUIDE.steps.find((step) => step.id === 'b1-card')),
      created: { 'event.created': { documentId: 'ev-42' } },
    };
    const tree = await renderLayer();
    const [frame] = framesOf(tree);
    expect(frame).toBeDefined();
    expect(styleOf(frame)).toMatchObject({ top: 320 + STATUS_BAR - 6 });
  });
});

// TUTOE-CALIBRAGE-2 (compte sans club, émulateur) : « Tape le nom de ton club »
// alors que le champ de recherche était sous le voile (seul le 1er club ouvert).
describe('Club à retrouver : le champ de recherche reste utilisable', () => {
  it('le 1er club est encadré, rien n’est bloqué', async () => {
    mountTarget('search.result.0', {
      height: 200, width: 358, x: 16, y: 440,
    });
    mockTour = activeTour(COACH_GUIDE.steps.find((step) => step.id === 'm1-csearch'));
    const tree = await renderLayer();
    expect(framesOf(tree)).toHaveLength(1);
    expect(blockersOf(tree)).toHaveLength(0);
  });
});
