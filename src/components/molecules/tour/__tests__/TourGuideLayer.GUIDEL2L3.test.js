import * as ReactNative from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { resetGuidanceRuntimeForTests } from '@/domains/guidance/guidanceRuntime';
import { COACH_GUIDE } from '@/domains/tour/coachGuide';
import { registerTourTarget, resetTourTargetsForTests } from '@/domains/tour/tourTargetRegistry';

import TourGuideLayer from '../TourGuideLayer';

// GUIDE-ENTETE-TEXTES (28/10) — audit du guide Entraîneur (lots L2 et L3) :
// la bulle « en haut » recouvrait l'en-tête de presque chaque écran (flèche
// Retour, avatar, « Exemple · contre… », captures 54, 89, 91, 96) ; la croix
// et le bouton de la bulle faisaient 35 et 36 pt ; la bulle ignorait le texte
// agrandi (FINITIONS-GUIDE). Décisions d'Adel : 4- A (bulle sous l'en-tête,
// flèche encadrée et geste du bord), 3- B (agrandissement plafonné à 1,3).

let mockTour;
// Réglage « taille du texte » du téléphone, lu par la couche.
let mockFontScale = 1;
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

const step = (id) => COACH_GUIDE.steps.find((candidate) => candidate.id === id);
const bubbleOf = (tree) => tree.root.findAll((node) => node.props.testID === 'tour.bubble'
  && typeof node.type === 'string')[0];
const textsOf = (tree) => tree.root.findAll((node) => node.props.testID === 'tour.bubble')[0]
  .findAll((node) => node.type === ReactNative.Text);

describe('L2 — la bulle « en haut » se pose sous l’en-tête', () => {
  it('tunnel : sous la rangée Retour / Fermer, pas sur elle', async () => {
    // Rangée Retour / Fermer du tunnel, mesurée sous la barre d'état.
    mountTarget('screen.header', {
      height: 44, width: 358, x: 16, y: 16,
    });
    mountTarget('teamWizard.field', {
      height: 400, width: 358, x: 16, y: 300,
    });
    mockTour = activeTour(step('m4-am1'));
    const tree = await renderLayer();
    const bubbleTop = styleOf(bubbleOf(tree)).top;
    // Bas de la rangée dans la couche : 16 + 44 + 54 = 114.
    expect(bubbleTop).toBeGreaterThanOrEqual(114);
    // Retour (à gauche) et Fermer (à droite) restent touchables sous le voile.
    const blockers = blockersOf(tree).map(styleOf);
    expect(blockers.length).toBeGreaterThan(0);
    [[30, 92], [360, 92]].forEach(([x, y]) => {
      expect(blockers.some((style) => x >= style.left && x < style.left + style.width
        && y >= style.top && y < style.top + style.height)).toBe(false);
    });
  });

  it('m1-back : flèche Retour encadrée, rien de bloqué, bulle dessous', async () => {
    mountTarget('header.back', {
      height: 32, width: 32, x: 12, y: 12,
    });
    mockTour = activeTour(step('m1-back'));
    const tree = await renderLayer();
    expect(framesOf(tree)).toHaveLength(1);
    expect(blockersOf(tree)).toHaveLength(0);
    // Bas de la flèche dans la couche : 12 + 32 + 54 = 98.
    expect(styleOf(bubbleOf(tree)).top).toBeGreaterThanOrEqual(98);
  });
});

describe('L2 — la bulle « en haut » ne se pose jamais sur sa cible', () => {
  it('m2-share, menu refermé : ⋮ encadré, bulle dessous (émulateur 28/10)', async () => {
    mountTarget('header.back', {
      height: 32, width: 32, x: 12, y: 12,
    });
    // Bouton ⋮ de la fiche d'équipe, juste sous l'en-tête.
    mountTarget('team.more', {
      height: 44, width: 44, x: 334, y: 70,
    });
    mockTour = activeTour(step('m2-share'));
    const tree = await renderLayer();
    const [frame] = framesOf(tree);
    const hole = styleOf(frame);
    const bubble = styleOf(bubbleOf(tree));
    // La bulle (hauteur retenue 110 au départ) ne chevauche pas la découpe.
    expect(bubble.top >= hole.top + hole.height || bubble.top + 110 <= hole.top).toBe(true);
  });
});

describe('L2 — trop haute pour tenir entre l’en-tête et la cible', () => {
  it('m4-tab-ev : la bulle passe sous les onglets, la flèche Retour reste visible', async () => {
    mountTarget('header.back', {
      height: 34, width: 46, x: 0, y: 15,
    });
    mountTarget('search.tab.events', {
      height: 46, width: 46, x: 24, y: 138,
    });
    mockTour = activeTour(step('m4-tab-ev'));
    const tree = await renderLayer();
    // Hauteur retenue de la bulle (texte agrandi) : 105 pt.
    await act(async () => {
      bubbleOf(tree).props.onLayout({ nativeEvent: { layout: { height: 105 } } });
    });
    await flush();
    // Bas de la flèche : 15 + 34 + 54 = 103 ; bas de l'onglet : 138 + 46 + 54 = 238.
    expect(styleOf(bubbleOf(tree)).top).toBeGreaterThanOrEqual(238);
  });
});

describe('L2 — cibles d’au moins 44 pt', () => {
  it('la croix « pause » et le bouton de la bulle font 44 pt', async () => {
    mockTour = activeTour({
      id: 'm4-read', nextLabel: 'Compris', targets: [], text: 'x',
    });
    const tree = await renderLayer();
    const [pause] = tree.root.findAll((node) => node.props.testID === 'tour.pause'
      && typeof node.props.onPress === 'function');
    const [next] = tree.root.findAll((node) => node.props.testID === 'tour.next'
      && typeof node.props.onPress === 'function');
    expect(styleOf(pause).height).toBeGreaterThanOrEqual(44);
    expect(styleOf(pause).width).toBeGreaterThanOrEqual(44);
    expect(styleOf(next).minHeight).toBeGreaterThanOrEqual(44);
  });
});

describe('Accessibilité 3- B — la bulle grandit avec le texte, plafonnée à 1,3', () => {
  const fontSizeAt = async (fontScale) => {
    mockFontScale = fontScale;
    mockTour = activeTour({ id: 'm1-new', targets: [], text: 'Touche' });
    const tree = await renderLayer();
    const consigne = textsOf(tree).find((node) => node.props.children === 'Touche');
    return styleOf(consigne).fontSize;
  };

  afterEach(() => { mockFontScale = 1; });

  it('bulle « en haut » trop grande pour tenir : elle rapetisse, pas sous 1', async () => {
    mockFontScale = 1.3;
    mountTarget('teamWizard.field', {
      height: 600, width: 358, x: 16, y: 200,
    });
    mockTour = activeTour({
      bubblePlacement: 'top', id: 'm3-place', targets: ['teamWizard.field'], text: 'Touche',
    });
    const tree = await renderLayer();
    // Place au-dessus du champ : 200 + 54 - 6 (marge du trou) - 6 - (54 + 4) = 188.
    await act(async () => {
      bubbleOf(tree).props.onLayout({ nativeEvent: { layout: { height: 240 } } });
    });
    await flush();
    const consigne = textsOf(tree).find((node) => node.props.children === 'Touche');
    expect(styleOf(consigne).fontSize).toBeLessThan(16 * 1.3);
    expect(styleOf(consigne).fontSize).toBeGreaterThanOrEqual(16);
  });

  it('1,0 → taille normale ; 1,3 → ×1,3 ; 2,0 → plafonnée à ×1,3', async () => {
    const normal = await fontSizeAt(1);
    expect(typeof normal).toBe('number');
    expect(await fontSizeAt(1.3)).toBeCloseTo(normal * 1.3, 5);
    expect(await fontSizeAt(2)).toBeCloseTo(normal * 1.3, 5);
  });
});

describe('L3 — textes réécrits (audit, captures 07, 13, 27, 29, 30, 89)', () => {
  it('m1-mine nomme le bouton affiché, selon que le club a un dirigeant', () => {
    expect(step('m1-mine').text).toContain('« C’est mon club ! »');
    expect(step('m1-mine').variants[0].targets).toEqual(['club.askToJoin']);
    expect(step('m1-mine').variants[0].text).toContain('un dirigeant validera');
  });

  it('m1-back dit la flèche ET le geste du bord gauche', () => {
    expect(step('m1-back').text).toMatch(/flèche.*bord gauche/);
  });

  it('les 5 bulles de la mission 4 ne contredisent plus l’écran', () => {
    expect(step('m4-tab-ev').text).toContain('calendrier');
    expect(step('m4-am1').text).not.toContain('Suivant');
    expect(step('m4-am4').text).toContain('terrain');
    expect(step('m4-am5').text).not.toContain('Rien de coché');
    expect(step('m4-am5').text).toContain('Peu importe, je prends tout');
    expect(step('m4-am6').text).toContain('arbitre');
    expect(step('m4-am6').text).not.toContain('niveau');
  });
});

// Arbitrage du chef (28/10) : jauge DANS la bulle (toujours visible) ; bulles de
// m3-place assez courtes pour tenir entre l'en-tête et le champ (~100 pt à 1,0).
describe('Jauge dans la bulle (3- A du chef)', () => {
  it('la bulle porte la barre et le pourcentage, même bulle « en haut »', async () => {
    mockTour = { ...activeTour({ id: 'm1-new', targets: [], text: 'Touche' }), gauge: 50 };
    const tree = await renderLayer();
    const bubble = tree.root.findAll((node) => node.props.testID === 'tour.bubble')[0];
    const [gaugeRow] = bubble.findAll((node) => node.props.testID === 'tour.gauge');
    expect(gaugeRow).toBeDefined();
    expect(gaugeRow.findAll((node) => node.type === ReactNative.Text)
      .some((node) => node.props.children === '50 %')).toBe(true);
  });
});

describe('m3-place : consignes courtes (arbitrage du chef, 28/10)', () => {
  it('chacune des 3 premières tient en 70 signes', () => {
    step('m3-place').bubbles.slice(0, 3)
      .forEach((bubble) => expect(bubble().length).toBeLessThanOrEqual(70));
  });
});

describe('Texte agrandi sous un en-tête ancré (émulateur 28/10, m3-place à 1,3)', () => {
  it('place comptée SOUS l’en-tête : la police rapetisse, Retour reste libre', async () => {
    mockFontScale = 1.3;
    mountTarget('screen.header', {
      height: 56, width: 358, x: 16, y: 16,
    });
    mountTarget('teamWizard.field', {
      height: 600, width: 358, x: 16, y: 230,
    });
    mockTour = activeTour({
      bubblePlacement: 'top', id: 'm3-place', targets: ['teamWizard.field'], text: 'Touche',
    });
    const tree = await renderLayer();
    // Sous l'encoche il y aurait 230 + 54 - 6 - 6 - 58 = 214 pt, sous l'en-tête 132 :
    // une bulle de 180 pt ne tient que dans le premier cas.
    await act(async () => {
      bubbleOf(tree).props.onLayout({ nativeEvent: { layout: { height: 180 } } });
    });
    await flush();
    const consigne = textsOf(tree).find((node) => node.props.children === 'Touche');
    expect(styleOf(consigne).fontSize).toBeLessThan(16 * 1.3);
  });
});
