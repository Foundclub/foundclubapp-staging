import {
  KeyboardAvoidingView, ScrollView, TextInput,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  basDuDefilement,
  ECRAN,
  HAUT_DU_CLAVIER,
  ouvrirLeClavier,
  refermerLeClavier,
  telephone,
  telephoneDOrigine,
} from '../../../testSupport/clavierAndroid15';
import ClubDetails from '../ClubDetails';

// 🤖 ANDROIDBAR-3BIS — « Gérer mon club › Ma collectivité » : sur Android 15 et 16 (bord à bord
// imposé, `adjustResize` mort), le champ « Ta commune » restait SOUS le clavier.
//
// Le champ vit dans `MaCollectivite`, rendu DANS la ScrollView de la fiche club, elle-même dans
// le `ScreenContainer` de toute la fiche — que rien n'allumait. Sans évitement, la zone qui
// défile ne rétrécit pas : Android n'a aucune raison d'y remonter le champ.
//
// Ce que ces témoins figent, avec la géométrie MESURÉE par ANDROIDBAR-3 (`testSupport/
// clavierAndroid15`) et la VRAIE ScrollView, le VRAI ScreenContainer :
//   1. sous-page « Ma collectivité », API 35 et 36, clavier ouvert : le bas de la zone qui
//      défile est au-dessus du clavier (ROUGE avant : 244 dp dessous) ; refermé, plus rien ;
//   2. le pied d'actions flottant n'existe pas sur cette sous-page, clavier ouvert ou non :
//      c'était la crainte d'ANDROIDBAR-3 (« il monterait par-dessus le champ ») ;
//   3. le hub et la fiche publique, où vit le pied, ne bougent PAS quand le clavier s'ouvre ;
//   4. iPhone : le hub reste sans évitement ; la sous-page reçoit l'évitement `padding` de
//      ScreenContainer (CHANGEMENT assumé, comme les 18 écrans d'ANDROIDBAR-3).

/** @type {any} */
let mockUserData;
/** @type {any} */
let mockClubQuery;
/** @type {any} */
let mockNavigation;

const mockHasClubAccess = jest.fn(() => true);
/** @type {jest.Mock<any, any[]>} */
const mockMaCollectiviteQuery = jest.fn(() => ({
  data: { attached: null, commune: null, lead: null }, error: null, isLoading: false,
}));

jest.mock('@/services/matchStats/matchStatsService', () => ({
  getTeamPerformanceStats: jest.fn(),
}));
jest.mock('@/services/stats/statsService', () => ({ getTeamStats: jest.fn() }));

jest.mock('@/responsive', () => ({
  ...jest.requireActual('@/responsive'),
  useIsDesktop: () => false,
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

// CORR-TEXTES (point 26) : le bandeau du site, hors de ce filet.
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));

// L'en-tête de pile est transparent : `ScreenContainer` le lit pour sa marge HAUTE seulement.
jest.mock('@react-navigation/elements', () => ({
  // eslint-disable-next-line global-require
  HeaderHeightContext: require('react').createContext(96),
}));

jest.mock('react-native-linear-gradient', () => 'LinearGradient');

// Le module des options de pile charge le vrai navigateur (gestes natifs) : seul le mode
// `tab-scene` de ScreenContainer le lit, et la fiche ne s'en sert pas.
jest.mock('@/navigation/commonOptions', () => ({
  getFloatingTabBarScenePaddingBottom: () => 134,
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn() }),
  useQueries: (/** @type {any} */ options) => (options?.queries || []).map(() => ({
    data: undefined, error: null, isLoading: false,
  })),
  useQuery: (/** @type {any} */ options) => {
    if (options?.queryKey?.[2] === 'ma-collectivite') return mockMaCollectiviteQuery(options);
    return { data: [], isLoading: false, refetch: jest.fn() };
  },
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      if (typeof repli === 'string') return repli;
      if (repli && typeof repli.defaultValue === 'string') return repli.defaultValue;
      return cle;
    },
  }),
}));

// Les retraits MESURÉS (Pixel 9, Android 16, 3 boutons) : barre de navigation 48 dp, barre
// d'état 142 px.
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 48, left: 0, right: 0, top: 142 / 2.625,
  }),
}));

jest.mock('@/domains/auth/authUseCases', () => ({
  markOnboardingComplete: jest.fn(),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    activeClubId: 'club-1',
    canContactAdmin: () => false,
    canEditClub: (/** @type {string} */ id) => mockHasClubAccess(id),
    canJoinClub: () => false,
    clubs: [{ documentId: 'club-1' }],
    entitlementsSummary: [],
    getNextOnboardingRoute: () => null,
    getPostOnboardingHomeRoute: () => null,
    hasClubAccess: mockHasClubAccess,
    inviteTrainer: jest.fn(),
    isClubMember: (/** @type {string} */ id) => mockHasClubAccess(id),
    refetchUserData: jest.fn(),
    USER_ROLES: { coach: 'coach', player: 'player', president: 'president' },
    userData: mockUserData,
  }),
}));

jest.mock('@/domains/club/useClub', () => ({
  __esModule: true,
  default: () => ({
    getClubInitials: (/** @type {string} */ nom) => String(nom || '').slice(0, 2),
  }),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ startClubChat: jest.fn() }),
}));

// Le VRAI thème : ce sont ses marges (`Spaces`, `Alignments`) que la géométrie additionne.
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
      Images: {},
      Spaces: espaces,
    }),
  };
});

jest.mock('@/navigation/navigationAvailability', () => ({
  navigateToStackScreenOrScreen: jest.fn(),
}));

jest.mock('@/navigation/public/publicAuthNavigation', () => ({
  openPublicAuthFlow: jest.fn(),
}));

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: [] }),
}));

// Services doublés ENTIÈREMENT : ils importent le client HTTP, qui refuse de se charger sans
// `API_URL` (`.env` est absent des copies de travail).
jest.mock('@/services/auth/authService', () => ({
  contactClubAdmin: jest.fn(),
  deleteManagerFromClub: jest.fn(),
  deleteTrainerFromClub: jest.fn(),
  leaveClub: jest.fn(),
}));

jest.mock('@/services/category/categoryService', () => ({
  getCategorySortKey: () => ({ group: 0, rank: 0 }),
}));

jest.mock('@/services/club/clubQueries', () => ({
  useGetClub: () => mockClubQuery,
}));

jest.mock('@/services/club/clubService', () => ({
  claimClub: jest.fn(),
  getClubWeekendResults: jest.fn(),
  remindClubWeekendScore: jest.fn(),
  updateClub: jest.fn(),
}));

jest.mock('@/services/declaredChild/declaredChildQueries', () => ({
  useGetMyDeclaredChildren: () => ({ data: [], error: undefined, isLoading: false }),
}));

jest.mock('@/services/clubInterestRequest/clubInterestRequestQueries', () => ({
  useGetMyClubInterestRequests: () => ({ data: [] }),
}));

jest.mock('@/services/clubInterestRequest/clubInterestRequestService', () => ({
  createClubInterestRequest: jest.fn(),
}));

jest.mock('@/services/clubMembershipRequest/clubMembershipRequestService', () => ({
  createClubMembershipRequest: jest.fn(),
}));

jest.mock('@/services/clubRequest/clubRequestService', () => ({
  createClubRequest: jest.fn(),
  getPendingClubCreationRequests: jest.fn(() => Promise.resolve([])),
}));

jest.mock('@/services/facility/facilityQueries', () => ({
  useClubFacilityContext: () => ({
    data: { allFacilities: [], cmId: null }, isLoading: false,
  }),
}));

jest.mock('@/services/facility/facilityService', () => ({
  getFacilitySections: () => [],
}));

jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  createTeamMembershipRequest: jest.fn(),
}));

jest.mock('@/utils/shareLinks', () => ({
  buildPublicWebUrl: ({ path }) => `https://foundclub.app${path}`,
}));

jest.mock(
  '@/components/molecules/withDataWrapper/WithDataWrapper',
  () => function WithDataWrapperMock({ children }) {
    return children;
  },
);

jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() {
  return null;
});

jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      { disabled: props.disabled || props.isLoading, onPress: props.onPress },
      reactActuel.createElement(TexteRN, null, props.title || props.icon || ''),
    );
  };
});

// Le champ : un VRAI TextInput qui garde son `testID`, pour savoir dans quelle zone il vit.
jest.mock('@/components/molecules/input/Input', () => {
  const reactActuel = jest.requireActual('react');
  const { TextInput: ChampRN } = jest.requireActual('react-native');

  return function InputMock(/** @type {any} */ props) {
    return reactActuel.createElement(ChampRN, { testID: props.testID, value: props.value });
  };
});

jest.mock('@/components/atoms/checkable/Checkable', () => function CheckableMock() {
  return null;
});

jest.mock('@/components/atoms/teamShield/TeamShield', () => function TeamShieldMock() {
  return null;
});

// Les feuilles sont des PORTAILS (`BottomSheetModal`) : elles ne vivent pas dans la fiche.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock() {
  return null;
});

jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => function ClubLogoMarkMock() {
  return null;
});

jest.mock('@/components/molecules/clubSelector/ClubSelector', () => function ClubSelectorMock() {
  return null;
});

jest.mock('@/components/molecules/header/ClubScopeToggle', () => function ClubScopeToggleMock() {
  return null;
});

jest.mock(
  '@/components/molecules/profileAvatar/ProfileAvatar',
  () => function ProfileAvatarMock() {
    return null;
  },
);

jest.mock(
  '@/components/molecules/segmentedControl/SegmentedControl',
  () => function SegmentedControlMock() {
    return null;
  },
);

jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function SubscriptionPaywallSheetMock() {
    return null;
  },
);

jest.mock('../ClubPlanningScreen', () => function ClubPlanningMock() {
  return null;
});

const CLUB = {
  activites: [{ documentId: 'act-1', name: 'Handball' }],
  clubMembersPublicVisibility: true,
  documentId: 'club-1',
  name: 'Stade Marseillais Université Club',
  owner: [{ documentId: 'u-1', firstname: 'Philippe', lastname: 'Courtoi' }],
  sponsor: [],
  teams: [{
    category: 'U15', documentId: 't-1', level: 'Départemental 1', name: 'U15 Filles',
  }],
  trainers: [],
};

const PIED = 'club-details-actions-footer';
const CHAMP = 'ma-collectivite-commune';

/** @type {any[]} */
const arbresMontes = [];

/**
 * Monte la fiche du club : le hub (sans section) ou une de ses sous-pages.
 * @param {string} [section] La sous-page (`collectivite`) ; absente = le hub.
 * @returns {any} L'arbre monté.
 */
const monter = (section) => {
  const params = section ? { clubId: 'club-1', section } : { clubId: 'club-1' };
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <ClubDetails
        navigation={/** @type {any} */ (mockNavigation)}
        route={/** @type {any} */ ({ params })}
      />,
    );
  });
  arbresMontes.push(arbre);
  return arbre;
};

/**
 * La zone qui défile de la fiche (la seule ScrollView de l'écran).
 * @param {any} arbre L'arbre monté.
 * @returns {any} Son nœud de test.
 */
const defilementDe = (arbre) => {
  const defilements = arbre.root.findAllByType(ScrollView);
  expect(defilements).toHaveLength(1);
  return defilements[0];
};

/**
 * Le pied d'actions flottant est-il dessiné ?
 * @param {any} arbre L'arbre monté.
 * @returns {boolean} Vrai s'il est là.
 */
const piedDessine = (arbre) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props?.testID === PIED).length > 0;

beforeEach(() => {
  jest.clearAllMocks();
  mockHasClubAccess.mockReturnValue(true);
  // Le DIRIGEANT de son club : le seul compte qui ouvre « Gérer mon club ».
  mockUserData = {
    documentId: 'u-1',
    firstname: 'Philippe',
    role: { name: 'president' },
    trainedTeams: [],
  };
  mockClubQuery = {
    data: CLUB, error: null, isLoading: false, refetch: jest.fn(),
  };
  mockNavigation = {
    addListener: jest.fn(() => jest.fn()),
    getParent: jest.fn(() => null),
    getState: jest.fn(() => ({ routeNames: [] })),
    goBack: jest.fn(),
    navigate: jest.fn(),
    push: jest.fn(),
    setOptions: jest.fn(),
  };
});

afterEach(async () => {
  // Le clavier de React Native retient son dernier état : on le referme entre deux témoins.
  await refermerLeClavier();
  act(() => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
  telephoneDOrigine();
});

describe('ANDROIDBAR-3BIS — Ma collectivité : « Ta commune » au-dessus du clavier', () => {
  it.each([35, 36])('API %s : clavier ouvert, la zone qui défile s arrête au clavier', async (
    api,
  ) => {
    telephone('android', api);
    const arbre = monter('collectivite');
    const defilement = defilementDe(arbre);

    // Le champ vit bien dans CETTE zone : c'est elle qu'Android doit faire défiler.
    expect(defilement.findAll((/** @type {any} */ noeud) => noeud.props?.testID === CHAMP
      && noeud.type === TextInput)).toHaveLength(1);

    await ouvrirLeClavier();

    // ROUGE avant : 851,4 dp, soit 220 dp SOUS le haut du clavier (631,2 dp).
    expect(basDuDefilement(defilement)).toBeLessThanOrEqual(HAUT_DU_CLAVIER + 0.01);
  });

  it('API 35 : clavier refermé, la zone retrouve sa hauteur (aucun vide)', async () => {
    telephone('android', 35);
    const arbre = monter('collectivite');
    const defilement = defilementDe(arbre);
    const avant = basDuDefilement(defilement);

    await ouvrirLeClavier();
    await refermerLeClavier();

    expect(basDuDefilement(defilement)).toBeCloseTo(avant, 5);
  });

  it('API 35 : pas de pied d actions sur la sous-page, clavier ouvert ou pas', async () => {
    telephone('android', 35);
    const arbre = monter('collectivite');

    expect(piedDessine(arbre)).toBe(false);
    await ouvrirLeClavier();
    expect(piedDessine(arbre)).toBe(false);
  });
});

describe('ANDROIDBAR-3BIS — caractérisation : ce qui ne bouge pas', () => {
  it('API 35, hub du dirigeant : le clavier ne déplace rien', async () => {
    telephone('android', 35);
    const arbre = monter();
    const defilement = defilementDe(arbre);
    const avant = basDuDefilement(defilement);

    await ouvrirLeClavier();

    expect(basDuDefilement(defilement)).toBe(avant);
    expect(arbre.root.findAllByType(KeyboardAvoidingView)).toHaveLength(0);
  });

  it('API 35, fiche publique : le pied reste en bas, le clavier ne le soulève pas', async () => {
    telephone('android', 35);
    mockHasClubAccess.mockReturnValue(false);
    mockUserData = null;
    const arbre = monter();
    const defilement = defilementDe(arbre);
    const avant = basDuDefilement(defilement);

    expect(piedDessine(arbre)).toBe(true);
    await ouvrirLeClavier();

    expect(piedDessine(arbre)).toBe(true);
    expect(basDuDefilement(defilement)).toBe(avant);
    // Rien entre l'écran et la fiche n'a pris de marge : le bas reste celui d'hier.
    expect(avant).toBeCloseTo(ECRAN - 48 - 24, 5);
  });

  it('iPhone, hub du dirigeant : aucun évitement du clavier', () => {
    telephone('ios', '18.0');
    const arbre = monter();

    expect(arbre.root.findAllByType(KeyboardAvoidingView)).toHaveLength(0);
  });

  it('iPhone, sous-page « Ma collectivité » : l évitement `padding` de ScreenContainer', () => {
    telephone('ios', '18.0');
    const arbre = monter('collectivite');
    const evitements = arbre.root.findAllByType(KeyboardAvoidingView);

    expect(evitements).toHaveLength(1);
    expect(evitements[0].props.behavior).toBe('padding');
    expect(evitements[0].props.keyboardVerticalOffset).toBe(0);
    expect(arbre.root.findAll((/** @type {any} */ noeud) => noeud.props?.testID === CHAMP
      && noeud.type === TextInput)).toHaveLength(1);
  });
});
