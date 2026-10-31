import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import Button from '@/components/atoms/button/Button';

import ClubDetails from '../ClubDetails';

// COLL1D (29/09) — lot 1d du chantier Collectivites (SPEC §3, D4, D13 ; restes du lot 1b).
// « Dirigeant et entraineur : un bandeau « Offert par la Ville de X » valorise la mairie. »
// Ce temoin monte la VRAIE fiche club et fige :
//   - le bandeau est sur la carte du club, quand le serveur dit que la collectivite offre
//     l'offre Club de CE club (`entitlementsSummary[].offeredBy`) ; absent sinon ;
//   - la carte d'une installation affiche ses horaires d'ouverture (recus depuis le lot 1b,
//     jamais affiches : SPEC §7, ligne 1b).
// ROUGE avant le lot : ni bandeau, ni horaires.
//
// Harnais repris de ClubDetails.COLL1B.installationsCollectivite.test.js (memes doublures),
// plus `entitlementsSummary` dans le contexte d'authentification.

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

/**
 * La carte d une installation : le plus petit noeud qui porte son nom ET ses boutons.
 * @param {any} arbre - L arbre rendu.
 * @param {string} nom - Le nom de l installation.
 * @returns {any} Le noeud de la carte.
 */
const carteDe = (arbre, nom) => {
  const candidats = arbre.root.findAll((/** @type {any} */ noeud) => (
    typeof noeud.type !== 'string'
    && texteDe(noeud).includes(nom)
    && noeud.findAllByType(Button).length > 0
  ));
  return candidats[candidats.length - 1];
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

describe('COLL1D — fiche d un club rattache : « Offert par la Ville de X » et horaires', () => {
  it('le bandeau « Offert par la Ville de Recette » est sur la carte du club', () => {
    devenirJoueurMembre();
    mockEntitlementsSummary = [DROIT_OFFERT_A];
    const texte = texteDe(monter().root);

    expect(texte).toContain('Offert par la Ville de Recette');
  });

  it('absent quand l offre Club du compte couvre un AUTRE club', () => {
    devenirJoueurMembre();
    mockEntitlementsSummary = [{ ...DROIT_OFFERT_A, scopeClubDocumentId: 'club-autre' }];
    expect(texteDe(monter().root)).not.toContain('Offert par');
  });

  it('absent quand l offre Club est PAYEE (aucune collectivite ne l offre), et sans resume', () => {
    devenirJoueurMembre();
    mockEntitlementsSummary = [{
      ...DROIT_OFFERT_A,
      offeredBy: null,
      paidBy: { documentId: 'u-2', firstname: 'Paul' },
    }];
    expect(texteDe(monter().root)).not.toContain('Offert par');
    mockEntitlementsSummary = undefined;
    expect(texteDe(monter().root)).not.toContain('Offert par');
  });

  // Recus du serveur depuis le lot 1b, jamais affiches jusqu ici.
  it('la carte d une installation affiche ses HORAIRES d ouverture', () => {
    devenirJoueurMembre();
    mockFacilities = [
      TERRAIN_DU_CLUB,
      { ...GYMNASE_DE_LA_VILLE, closingTime: '22:00:00.000', openingTime: '08:00:00.000' },
    ];
    const arbre = monter();

    expect(texteDe(carteDe(arbre, 'Gymnase de la Ville'))).toContain('08:00 – 22:00');
    // Sans horaires, rien d invente.
    expect(texteDe(carteDe(arbre, 'Terrain du club A'))).not.toMatch(/\d{2}:\d{2} – /);
  });
});
