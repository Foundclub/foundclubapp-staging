/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubDetails from '../ClubDetails';

// 🏛️ R17-INVITER (19/10/2026, REC17-009) — « dès qu'on trouve le club on clique sur un bouton pour
// dire « ce club fait partie de ma collectivité » » (Adel, Test 17/10). Réglage du chef : le même
// bouton sur la fiche du club (ClubDetails) quand c'est un gestionnaire de Ville qui l'ouvre — la
// recherche de la Ville (« Ajouter un club ») l'ouvre avec `collectiviteId`.
//
// Ce que ce témoin exige (ROUGE avant le lot : la fiche ne connaissait pas la Ville) :
//   F1 — ouverte par la Ville (`collectiviteId`), la fiche porte le bouton de la Ville pour CE club ;
//   F2 — ouverte autrement (joueur, dirigeant, recherche ordinaire) : aucun bouton de la Ville ;
//   F3 — « Inviter par le lien » mène au lien de CETTE Ville.
// Le bouton lui-même (ses états, sa garde « gestionnaire de cette Ville ») a son témoin :
// views/collectivite/__tests__/R17INVIT.inviterUnClub.test.js.
//
// Harnais repris de ClubDetails.COLL-C2C.bandeauVille.test.js (mêmes doublures).

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
/** @type {any[]} */
let mockVillesGerees = [];

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
  // R17-INVITER : « mes Villes » (clé ['collectivites', 'mine']) rend les Villes que le compte gère.
  useQuery: (/** @type {any} */ options) => ({
    data: String(options?.queryKey) === 'collectivites,mine' ? mockVillesGerees : [],
    isLoading: false,
    refetch: jest.fn(),
  }),
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

// Le bouton de la Ville, doublé : il retient ce que la fiche lui donne.
/** @type {any[]} */
const mockBoutonsDeLaVille = [];
jest.mock('@/views/collectivite/components/AjouterUnClub', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return function AjouterUnClubMock(/** @type {any} */ props) {
    mockBoutonsDeLaVille.push(props);
    const { club, collectiviteId } = props;
    return <TexteRN testID="bouton-de-la-ville">{`bouton-ville:${club?.documentId}:${collectiviteId}`}</TexteRN>;
  };
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

describe('R17-INVITER — la fiche du club ouverte par la Ville', () => {
  beforeEach(() => {
    mockBoutonsDeLaVille.length = 0;
    // Un compte « Ville seule » : aucun rôle sportif, aucun club.
    mockUserData = {
      documentId: 'u-mairie', firstname: 'Agent', myTeams: [], role: { name: 'Authenticated', type: 'authenticated' }, trainedTeams: [],
    };
  });

  it('F1 ouverte par la Ville : le bouton de la Ville pour CE club', () => {
    mockRoute = { params: { clubId: 'club-1', collectiviteId: 'ville-de-recette' } };
    const arbre = monter();
    expect(texteDe(arbre.root)).toContain('bouton-ville:club-1:ville-de-recette');
    expect(mockBoutonsDeLaVille.at(-1)).toEqual(expect.objectContaining({
      club: expect.objectContaining({ documentId: 'club-1', name: 'AS Ville A' }),
      collectiviteId: 'ville-de-recette',
    }));
  });

  it('F2 ouverte autrement : aucun bouton de la Ville', () => {
    mockRoute = { params: { clubId: 'club-1' } };
    const arbre = monter();
    expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'bouton-de-la-ville')).toHaveLength(0);
    expect(mockBoutonsDeLaVille).toHaveLength(0);
  });

  it('F3 « Inviter par le lien » mène au lien de CETTE Ville', () => {
    mockRoute = { params: { clubId: 'club-1', collectiviteId: 'ville-de-recette' } };
    monter();
    act(() => { mockBoutonsDeLaVille.at(-1).onInviterParLien(); });
    expect(mockNavigation.navigate).toHaveBeenCalledWith('CollectiviteInviteClub', {
      collectiviteId: 'ville-de-recette',
      onglet: 'lien',
    });
  });
});

// 🏛️ R17-INVITER — corrections du chef (2ᵉ passe de design, 19/10) sur la fiche ouverte par la
// Ville : « Je dirige ce club » ne s'adresse pas à elle (F4), alors que le compte NEUF le garde
// (F5) ; « Aucune donnée disponible » deux fois (Installations, Sports) devient UN état vide, avec
// une phrase utile (F6), sans toucher au cas où une seule des deux est vide (F7).
describe('R17-INVITER — la fiche vue par la Ville : ses portes et son état vide', () => {
  const VILLE = { documentId: 'ville-de-recette', name: 'Ville de Recette' };
  const UN_SEUL_ETAT_VIDE = 'Ce club n’a encore renseigné ni ses installations ni ses sports.';

  beforeEach(() => {
    mockBoutonsDeLaVille.length = 0;
    mockVillesGerees = [];
    mockUserData = {
      documentId: 'u-mairie', firstname: 'Agent', myTeams: [], role: { name: 'Authenticated', type: 'authenticated' }, trainedTeams: [],
    };
    mockRoute = { params: { clubId: 'club-1', collectiviteId: VILLE.documentId } };
  });

  it('F4 la Ville seule ne voit pas « Je dirige ce club »', () => {
    mockVillesGerees = [VILLE];
    expect(texteDe(monter().root)).not.toContain('Je dirige ce club');
  });

  it('F5 le compte NEUF (aucune Ville gérée) garde « Je dirige ce club »', () => {
    mockRoute = { params: { clubId: 'club-1' } };
    expect(texteDe(monter().root)).toContain('Je dirige ce club');
  });

  it('F6 ni installations ni sports : UN état vide, une phrase utile', () => {
    mockVillesGerees = [VILLE];
    mockFacilities = [];
    const lus = texteDe(monter().root);
    expect(lus).not.toContain('Aucune donnée disponible');
    expect(lus.split(UN_SEUL_ETAT_VIDE)).toHaveLength(2);
  });

  it('F7 une seule des deux vide : sa section garde son propre mot', () => {
    mockFacilities = [];
    mockClubQuery = { ...mockClubQuery, data: { ...CLUB_A, activites: [{ documentId: 'judo', name: 'Judo' }] } };
    const lus = texteDe(monter().root);
    expect(lus).toContain('Judo');
    expect(lus).toContain('Aucune donnée disponible');
    expect(lus).not.toContain(UN_SEUL_ETAT_VIDE);
  });
});
