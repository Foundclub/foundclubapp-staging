/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { Alert, Text, TouchableOpacity } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubDetails from '../ClubDetails';

// 🏟️ COLL-C2C (02/10) — LE BANDEAU « OFFERT PAR LA VILLE DE … », RESTYLÉ (planche P8-club-tel,
// écran 15 ; « Gérer mon club » ne bouge pas, décision du 01/10).
//
// Ce que ce témoin exige (ROUGE avant le lot : une pastille sous la certification, rien d autre) :
//   - un vrai bandeau en carte : l écusson de la Ville (son initiale, faute de logo), « Offert par
//     la Ville de Recette », « Voir les installations de la Ville » ;
//   - le bandeau mène aux installations (« Tes installations » du club, où la Ville a son groupe) ;
//   - toujours absent sans offre de la Ville sur CE club (le joueur n a pas ce droit : pas de
//     bandeau ; la fiche lui montre les installations de la Ville, planche Installations).
//
// Harnais repris de ClubDetails.COLL1D.offreEtHoraires.test.js (mêmes doublures).

/** @type {boolean} */
let mockCanJoinClub;
/** @type {boolean} */
let mockCanContactAdmin;
/** @type {any} */
let mockUserData;
/** @type {any} */
let mockClubQuery;
/** @type {any} */
let mockNavigation;
/** @type {any} */
let mockRoute;

/** @type {any[] | undefined} */
let mockEntitlementsSummary;

const mockHasClubAccess = jest.fn(() => false);

// ST-VUES3-ORDI — la planche ordinateur du hub (`ClubResultsBoard`) lit le bilan de chaque
// équipe : ces deux services importent le client HTTP, qui refuse de se charger sans `API_URL`.
jest.mock('@/services/matchStats/matchStatsService', () => ({
  getTeamPerformanceStats: jest.fn(),
}));
jest.mock('@/services/stats/statsService', () => ({ getTeamStats: jest.fn() }));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

// CORR-TEXTES (point 26) : le bandeau du site, hors de ce filet.
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: jest.fn() }),
}));

// `mutate` appelle vraiment la `mutationFn` : c'est ce qui fait des services
// doubles le point d'observation reseau de ce filet.
jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => {
      const resultat = options?.mutationFn?.(variables);
      Promise.resolve(resultat)
        .then((donnees) => options?.onSuccess?.(donnees, variables))
        .catch((erreur) => options?.onError?.(erreur, variables));
    },
  }),
  useQuery: () => ({ data: [], isLoading: false, refetch: jest.fn() }),
  // LOT INSTANT (2026-08-27) — l'ecran demande desormais le cache pour
  // rafraichir « Demandes », « Accueil » et « Mes equipes » apres une demande
  // d'adhesion (`joinClub`). Sans cette doublure, le rendu jette.
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    // COLL1D : la doublure lit AUSSI les valeurs passees en 3e argument (t(cle, repli, valeurs)).
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ valeurs) => {
      const gabarit = (() => {
        if (typeof repli === 'string') return repli;
        if (repli && typeof repli.defaultValue === 'string') return repli.defaultValue;
        return cle;
      })();
      const variables = repli && typeof repli === 'object' ? repli : valeurs;

      if (!variables || typeof variables !== 'object') return gabarit;
      return gabarit.replace(
        /\{\{(\w+)\}\}/g,
        (/** @type {string} */ entier, /** @type {string} */ nom) => (
          variables[nom] === undefined ? entier : String(variables[nom])
        ),
      );
    },
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('@/domains/auth/authUseCases', () => ({
  markOnboardingComplete: jest.fn(),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    activeClubId: 'club-1',
    canContactAdmin: mockCanContactAdmin,
    // COLL1B : un JOUEUR membre ne gere pas la fiche (sinon la page devient le hub du dirigeant).
    canEditClub: () => false,
    canJoinClub: mockCanJoinClub,
    clubs: [],
    entitlementsSummary: mockEntitlementsSummary,
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

// Le VRAI theme, jamais un Proxy : un Proxy rend les echecs Jest illisibles.
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
      Images: {
        edit: 1, phone: 2, pin: 3, plus: 4, trash: 5,
      },
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

// Services doubles ENTIEREMENT : ces modules importent le client HTTP, qui
// refuse de se charger sans `API_URL`.
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
  updateClub: jest.fn(),
}));

// PARENT P2 — la doublure OBLIGATOIRE, et sa raison est structurelle :
// `declaredChildQueries` tire le service, qui tire `services/client`, qui
// appelle `assertRuntimeEndpointsReady()` AU CHARGEMENT. `.env` etant
// gitignore donc absent de tout worktree, sans cette doublure la SUITE
// ENTIERE meurt avant le premier temoin — et le compteur `Tests:` reste
// VERT pendant ce temps, seul `Test Suites:` le dit. Meme motif que les
// doublures de services juste au-dessus.
jest.mock('@/domains/team/useParentTeams', () => () => ({ teamIds: [] }));
jest.mock('@/services/declaredChild/declaredChildQueries', () => ({
  useGetMyDeclaredChildren: () => ({ data: [], error: undefined, isLoading: false }),
}));

jest.mock('@/services/clubInterestRequest/clubInterestRequestQueries', () => ({
  useGetMyClubInterestRequests: () => ({ data: { data: [] }, refetch: jest.fn() }),
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

// La doublure RETIENT ce que l ecran demande (l option includeCollectivite) et rend
// les installations posees par le temoin.
/** @type {any[]} */
const mockFacilityContextCalls = [];
/** @type {any[]} */
let mockFacilities = [];
jest.mock('@/services/facility/facilityQueries', () => ({
  useClubFacilityContext: (/** @type {any} */ contexte, /** @type {any} */ options) => {
    mockFacilityContextCalls.push({ contexte, options });
    return { data: { allFacilities: mockFacilities, cmId: null }, isLoading: false };
  },
}));

jest.mock('@/services/facility/facilityService', () => ({
  getFacilitySections: (/** @type {any[]} */ installations) => (
    installations.length ? [{ data: installations, title: 'Installations' }] : []
  ),
}));

jest.mock('@/components/atoms/marqueeText/MarqueeText', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN } = jest.requireActual('react-native');
  return function MarqueeTextMock(/** @type {any} */ props) {
    return reactActuel.createElement(TexteRN, null, props.text);
  };
});

jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  createTeamMembershipRequest: jest.fn(),
}));

jest.mock('@/utils/shareLinks', () => ({
  buildPublicWebUrl: () => 'https://foundclub.app/clubs/club-1',
}));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);

jest.mock(
  '@/components/molecules/withDataWrapper/WithDataWrapper',
  () => function WithDataWrapperMock({ children }) {
    return children;
  },
);

jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() {
  return null;
});

// Le bouton est un VRAI pressable portant son libelle : c'est ce qui permet
// d'appuyer « sur le texte ».
jest.mock('@/components/atoms/button/Button', () => {
  const reactActuel = jest.requireActual('react');
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');

  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(
      PressableRN,
      {
        accessibilityLabel: props.accessibilityLabel,
        disabled: props.disabled || props.isLoading,
        onPress: props.onPress,
      },
      reactActuel.createElement(TexteRN, null, props.title || props.icon || ''),
    );
  };
});

jest.mock('@/components/atoms/checkable/Checkable', () => function CheckableMock() {
  return null;
});

jest.mock(
  '@/components/atoms/sponsorLogoTile/SponsorLogoTile',
  () => function SponsorLogoTileMock() {
    return null;
  },
);

jest.mock('@/components/atoms/teamShield/TeamShield', () => function TeamShieldMock() {
  return null;
});

// La doublure RETIENT les proprietes recues : l'ouverture d'une feuille est une
// question de PROPRIETE (`isVisible`), pas de texte affiche.
/** @type {any[]} */
const mockFeuillesRendues = [];

jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function BottomModalMock(/** @type {any} */ props) {
    mockFeuillesRendues.push(props);
    return null;
  },
);

jest.mock(
  '@/components/molecules/clubLogoMark/ClubLogoMark',
  () => function ClubLogoMarkMock() {
    return null;
  },
);

jest.mock('@/components/molecules/clubSelector/ClubSelector', () => function ClubSelectorMock() {
  return null;
});

jest.mock('@/components/molecules/header/ClubScopeToggle', () => function ClubScopeToggleMock() {
  return null;
});

jest.mock('@/components/molecules/input/Input', () => function InputMock() {
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

/** Le club A, rattache a la Ville de Demo. */
const CLUB_A = {
  activites: [],
  clubMembersPublicVisibility: true,
  documentId: 'club-1',
  members: [],
  name: 'AS Ville A',
  sponsor: [],
  teams: [],
  trainers: [],
};

// Ce que `getClubFacilityContext` rend pour un membre : le terrain du club, le gymnase
// de la Ville.
const TERRAIN_DU_CLUB = {
  documentId: 'terrain-A',
  isReadOnly: false,
  isShared: false,
  maxSlots: 1,
  name: 'Terrain du club A',
  ownerType: 'club',
  type: 'Terrain',
};
const GYMNASE_DE_LA_VILLE = {
  collectivite: { documentId: 'ville-demo', name: 'Ville de Demo' },
  documentId: 'gym-ville',
  isReadOnly: true,
  isShared: true,
  maxSlots: 2,
  name: 'Gymnase de la Ville',
  ownerName: 'Ville de Demo',
  ownerType: 'collectivite',
  type: 'Gymnase',
};

/** @type {any[]} */
const arbresMontes = [];

const monter = () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <ClubDetails
        navigation={/** @type {any} */ (mockNavigation)}
        route={/** @type {any} */ (mockRoute)}
      />,
    );
  });
  arbresMontes.push(arbre);
  return arbre;
};

const texteDe = (/** @type {any} */ noeud) => {
  const aplatir = (/** @type {any} */ enfants) => {
    if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
    if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
    if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
    return String(enfants);
  };
  return noeud.findAllByType(Text)
    .map((/** @type {any} */ texte) => aplatir(texte.props.children))
    .join(' ');
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFacilityContextCalls.length = 0;
  mockFacilities = [TERRAIN_DU_CLUB, GYMNASE_DE_LA_VILLE];
  mockHasClubAccess.mockImplementation(() => false);
  mockCanContactAdmin = false;
  mockCanJoinClub = false;
  mockEntitlementsSummary = [];
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockUserData = {
    club: { documentId: 'club-1' },
    documentId: 'u-1',
    firstname: 'Ada',
    myTeams: [],
    role: { name: 'player' },
    trainedTeams: [],
  };
  mockClubQuery = {
    data: CLUB_A, error: null, isLoading: false, refetch: jest.fn(),
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
  mockRoute = { params: { clubId: 'club-1' } };
});

afterEach(() => {
  arbresMontes.forEach((arbre) => act(() => arbre.unmount()));
  arbresMontes.length = 0;
  /** @type {any} */ (Alert.alert).mockRestore?.();
});

/** Un JOUEUR membre du club : membre, mais pas gestionnaire de la fiche. */
const devenirJoueurMembre = () => {
  mockHasClubAccess.mockImplementation((/** @type {string} */ id) => id === 'club-1');
};

// Le droit Club que la Ville de Recette offre au club A (bootstrap d un dirigeant ou d un
// entraineur).
const DROIT_OFFERT_A = {
  capability: '*',
  offeredBy: { documentId: 'ville-recette', name: 'Ville de Recette' },
  paidBy: null,
  scopeClubDocumentId: 'club-1',
  scopeClubName: 'AS Ville A',
  scopeType: 'CLUB',
  status: 'active',
  subscriptionCurrentPeriodEnd: null,
  subscriptionPlanCode: 'fc_collectivite_club',
};

const bandeauDe = (/** @type {any} */ arbre) => arbre.root.findAllByType(TouchableOpacity)
  .find((/** @type {any} */ n) => String(n.props.accessibilityLabel || '').startsWith('Offert par la Ville de Recette'));

describe('COLL-C2C — le bandeau de la Ville, en carte', () => {
  it('l écusson, « Offert par la Ville de Recette » et « Voir les installations de la Ville »', () => {
    devenirJoueurMembre();
    mockEntitlementsSummary = [DROIT_OFFERT_A];
    const arbre = monter();
    const bandeau = bandeauDe(arbre);
    expect(bandeau).toBeTruthy();
    const lus = texteDe(bandeau);
    expect(lus).toContain('R');
    expect(lus).toContain('Offert par la Ville de Recette');
    expect(lus).toContain('Voir les installations de la Ville');
    expect(bandeau.props.accessibilityLabel).toBe('Offert par la Ville de Recette : voir ses installations');
  });

  it('le bandeau mène aux installations du club (où la Ville a son groupe)', () => {
    devenirJoueurMembre();
    mockEntitlementsSummary = [DROIT_OFFERT_A];
    const arbre = monter();
    act(() => { bandeauDe(arbre).props.onPress(); });
    expect(mockNavigation.navigate).toHaveBeenCalledWith('FacilityList', expect.objectContaining({ clubId: 'club-1' }));
  });

  it('sans offre de la Ville sur CE club : pas de bandeau', () => {
    devenirJoueurMembre();
    mockEntitlementsSummary = [{ ...DROIT_OFFERT_A, scopeClubDocumentId: 'club-autre' }];
    expect(bandeauDe(monter())).toBeUndefined();
    mockEntitlementsSummary = [];
    expect(texteDe(monter().root)).not.toContain('Offert par');
  });
});
