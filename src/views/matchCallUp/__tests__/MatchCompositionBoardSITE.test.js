import { Platform, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { getEventConvocation } from '@/services/event/eventService';

import MatchCompositionBoard from '../MatchCompositionBoard';

// ==========================================================================
// COMPOMSG (suite, point 2) — SUR LE SITE, LE PLEIN ÉCRAN N'AVAIT PAS DE TERRAIN.
//
// Mesuré au banc react-native-web avec le VRAI gabarit du site (23/09) :
// enveloppe du terrain 390 × 0, dessin 0 × 0 — AVANT comme APRÈS le premier lot.
// Deux causes, mesurées une à une :
//   1. le gabarit du site n'étire pas son cadre de contenu : `flex: 1` y vaut 0 ;
//   2. la surface du terrain (centrée, un ratio, ni largeur ni hauteur) vaut 0
//      dans un navigateur, même quand son parent a de la place. Sur l'iPhone,
//      Yoga la dimensionne : c'est pour ça que personne ne l'avait vu.
//
// Ce fichier tient trois promesses :
//   1. le plateau DEMANDE toute la hauteur (`fillHeight`) ;
//   2. sur le site, le terrain reçoit une taille calculée, aux proportions du sport ;
//   3. sur l'iPhone, RIEN ne change (pas de taille imposée).
// ==========================================================================

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
/** @type {any} */
let mockRouteParams = {};

const mockNavigation = { goBack: mockGoBack, navigate: mockNavigate };

const mockFetchQuery = jest.fn(({ queryFn }) => queryFn());
const mockClientRequeteFige = { fetchQuery: mockFetchQuery, invalidateQueries: jest.fn() };

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mockClientRequeteFige,
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('react-native-gesture-handler', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  const fabriquerGeste = () => {
    /** @type {any} */
    const geste = {};
    ['activateAfterLongPress', 'minDistance', 'onStart', 'onUpdate', 'onEnd', 'onFinalize']
      .forEach((nom) => { geste[nom] = () => geste; });
    return geste;
  };
  return {
    Gesture: { Pan: fabriquerGeste },
    GestureDetector: (/** @type {any} */ { children }) => <VueRN>{children}</VueRN>,
    GestureHandlerRootView: VueRN,
  };
});

jest.mock('react-native-reanimated', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: { View: VueRN },
    runOnJS: (/** @type {any} */ fn) => fn,
    useAnimatedStyle: () => ({}),
    useSharedValue: (/** @type {any} */ valeur) => ({ value: valeur }),
    withSpring: (/** @type {any} */ valeur) => valeur,
    withTiming: (/** @type {any} */ valeur) => valeur,
  };
});

jest.mock('@/services/event/eventService', () => ({
  getEventConvocation: jest.fn(),
  publishEventConvocation: jest.fn(),
  saveEventCompositionDraft: jest.fn(),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ startTeamChat: jest.fn().mockResolvedValue(null) }),
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();

  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: { arrowLeft: 1, chevronLeft: 1 },
      Spaces: espaces,
    }),
  };
});

// Le gabarit dit s'il a reçu `fillHeight` : c'est la demande de hauteur pleine.
jest.mock('@/components/templates/ScreenContainer', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children, fillHeight }) => (
      <VueRN testID={fillHeight ? 'ECRAN-HAUTEUR-PLEINE' : 'ECRAN'}>{children}</VueRN>
    ),
  };
});

jest.mock('@/components/atoms/headerBackButton/HeaderBackButton', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return { __esModule: true, default: () => <TexteRN>RETOUR</TexteRN> };
});

jest.mock('@/components/tactical/RenderedTacticalField', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <VueRN>{children}</VueRN>,
  };
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/tactical/DraggableToken', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { player }) => <TexteRN>{`JETON:${player?.lastname}`}</TexteRN>,
    GHOST_TOKEN_SIZE: jest.requireActual('@/components/tactical/DraggableToken').GHOST_TOKEN_SIZE,
  };
});

jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onPress, title }) => (
      <TouchableOpacity onPress={onPress}>
        <TexteRN>{title}</TexteRN>
      </TouchableOpacity>
    ),
  };
});

const joueur = (id, firstname, lastname) => ({ documentId: id, firstname, lastname });
const HUIT = Array.from({ length: 8 }, (_, i) => joueur(`p${i}`, `Prenom${i}`, `Nom${i}`));
const BANC = [joueur('b1', 'Paul', 'Veuillet')];
const NOUVEAU = joueur('j9', 'Jules', 'Nouveau');

const placer = (/** @type {any[]} */ joueurs) => joueurs.map((player, index) => ({
  playerId: player.documentId,
  positionX: 20 + index * 5,
  positionY: 10 + index * 8,
}));

// Ce que la CARTE du fil emporte : la version 1, 8 joueurs placés.
const PARAMETRES_DE_LA_CARTE = {
  canEdit: false,
  eventId: 'evt_1',
  existingComposition: { teams: [{ id: 'team_1', placements: placer(HUIT) }] },
  messageVersion: 1,
  readOnly: true,
  refreshFromServer: true,
  selectedPlayers: [...HUIT, ...BANC],
  sport: 'football',
  startPlacements: placer(HUIT),
  teamId: 'team_1',
  teamName: 'Aix-Perd en Buvette',
};

// Ce que le SERVEUR sait : la version 2, republiée avec un 9e joueur placé.
const convocationServeur = (/** @type {number} */ version) => ({
  branches: [{
    published: {
      reservePlayerIds: ['b1'],
      reserveSnapshotPlayers: BANC,
      snapshotPlayers: [...HUIT, NOUVEAU, ...BANC],
      sportContext: 'football',
      teams: [{ id: 'team_1', placements: placer([...HUIT, NOUVEAU]) }],
      version,
    },
    team: { documentId: 'team_1', name: 'Aix-Perd en Buvette' },
  }],
});

/** @type {any[]} */
const montes = [];

const rendre = async (/** @type {any} */ parametres) => {
  mockRouteParams = parametres;
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(<MatchCompositionBoard />);
  });
  // La relecture est une promesse : on laisse passer son `then`.
  await act(async () => { await Promise.resolve(); });
  montes.push(arbre);
  return arbre;
};

/** @type {any} */
let mesureOrigine;

beforeEach(() => {
  jest.clearAllMocks();
  getEventConvocation.mockReset().mockResolvedValue(convocationServeur(2));
  mesureOrigine = View.prototype.measureInWindow;
  View.prototype.measureInWindow = function mesurerTerrain(/** @type {any} */ rappel) {
    rappel(0, 0, 300, 450);
  };
});

afterEach(async () => {
  await act(async () => {
    montes.splice(0).forEach((arbre) => arbre.unmount());
  });
  View.prototype.measureInWindow = mesureOrigine;
});

/**
 * La surface du terrain (la seule vue « non repliable » du plateau) et son enveloppe.
 * @param {any} arbre
 * @returns {{ enveloppe: any, surface: any }}
 */
const terrain = (arbre) => {
  const surface = arbre.root.findAll(
    (/** @type {any} */ n) => n.type === View && n.props.collapsable === false,
  )[0];
  return { enveloppe: surface.parent, surface };
};

const aplatir = (/** @type {any} */ style) => [style].flat(Infinity)
  .reduce((/** @type {any} */ acc, /** @type {any} */ s) => ({ ...acc, ...(s || {}) }), {});

const LECTURE = { ...PARAMETRES_DE_LA_CARTE, refreshFromServer: false };

describe('COMPOMSG · point 2 — le plein écran a un terrain SUR LE SITE', () => {
  const osOrigine = Platform.OS;
  afterEach(() => { Platform.OS = osOrigine; });

  test('🥇 le plateau demande toute la hauteur de l’écran', async () => {
    const arbre = await rendre(LECTURE);

    expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'ECRAN-HAUTEUR-PLEINE'))
      .not.toHaveLength(0);
  });

  test('🥇 sur le site, le terrain reçoit sa taille, aux proportions du football', async () => {
    Platform.OS = 'web';
    const arbre = await rendre(LECTURE);
    const { enveloppe } = terrain(arbre);

    await act(async () => {
      enveloppe.props.onLayout({ nativeEvent: { layout: { height: 900, width: 390 } } });
    });

    const style = aplatir(terrain(arbre).surface.props.style);
    expect(style.width).toBe(362);
    expect(style.height).toBe(543);
  });

  test('🔒 sur l’iPhone, aucune taille n’est imposée : Yoga garde la main', async () => {
    Platform.OS = 'ios';
    const arbre = await rendre(LECTURE);
    const { enveloppe } = terrain(arbre);

    await act(async () => {
      enveloppe.props.onLayout?.({ nativeEvent: { layout: { height: 900, width: 390 } } });
    });

    const style = aplatir(terrain(arbre).surface.props.style);
    expect(style.width).toBeUndefined();
    expect(style.height).toBeUndefined();
  });
});
