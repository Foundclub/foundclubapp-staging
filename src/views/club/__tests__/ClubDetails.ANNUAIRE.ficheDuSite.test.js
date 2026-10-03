import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubDetails from '../ClubDetails';
// ANNUAIRE-E1 (29/09) — LA FICHE CLUB DE L'APP, MONTÉE SUR L'ANNUAIRE DU SITE.
//
// Maquette validée par Adel le 29/09 (« ok maquette »), partie B : un clic sur une carte de
// l'annuaire ouvre LA fiche de l'app (ClubDetails), à l'adresse publique
// /annuaire/clubs/<id>/<slug>/,
// pour tout le monde. Ce que ce filet garde :
//   1. « À propos » (décision d'Adel du 29/09 : A) — le texte officiel de l'association, SOUS la
//      carte d'identité, avec sa source ; dans l'app ET sur le site ;
//   2. les installations du club se lisent aussi pour un visiteur (la porte publique les porte) ;
//   3. le nom du club est LE titre de la page, les rubriques sont des titres de rang 2 ;
//   4. sur l'annuaire (`annuaire`), pas de cadre d'écran ni de défilement interne, et les deux
//      boutons « Je joue » / « Je dirige » : fixés en bas au téléphone, en colonne à droite sur
//      ordinateur ;
//   5. les garde-fous CLUBPUB tiennent (aucun contact, aucun membre nommé pour un visiteur).
//
// Même banc de doublures que ClubDetails.CLUBPUB.sansCompte.test.js.

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
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      const gabarit = (() => {
        if (typeof repli === 'string') return repli;
        if (repli && typeof repli.defaultValue === 'string') return repli.defaultValue;
        return cle;
      })();

      if (!repli || typeof repli !== 'object') return gabarit;
      return gabarit.replace(
        /\{\{(\w+)\}\}/g,
        (/** @type {string} */ entier, /** @type {string} */ nom) => (
          repli[nom] === undefined ? entier : String(repli[nom])
        ),
      );
    },
  }),
}));

const mockDimensions = { height: 812, width: 375 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockDimensions,
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
    canEditClub: (/** @type {string} */ id) => mockHasClubAccess(id),
    canJoinClub: mockCanJoinClub,
    clubs: [],
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

jest.mock('@/services/facility/facilityQueries', () => ({
  useClubFacilityContext: () => ({ data: { allFacilities: [], cmId: null }, isLoading: false }),
}));

jest.mock('@/services/facility/facilityService', () => ({
  getFacilitySections: (/** @type {any[]} */ installations) => (
    installations.length ? [{ data: installations, title: 'Installations du club' }] : []
  ),
}));

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

/** Le club du cas NORMAL : il existe, et personne n'y a cree d'equipe. */
const CLUB_SANS_EQUIPE = {
  activites: [],
  clubMembersPublicVisibility: true,
  documentId: 'club-1',
  members: [],
  name: 'BASKET CLUB DE LETOILE',
  sponsor: [],
  teams: [],
  trainers: [],
};

/** @type {any[]} */
const arbresMontes = [];

/**
 * Monte la fiche club.
 * @returns {any} L'arbre monte.
 */
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

/**
 * Le texte visible sous un noeud.
 * @param {any} noeud - Le noeud observe.
 * @returns {string} Son texte.
 */
const texteDe = (noeud) => {
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
  mockFeuillesRendues.length = 0;
  mockHasClubAccess.mockReturnValue(false);
  mockCanContactAdmin = false;
  mockCanJoinClub = false;
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});

  mockUserData = {
    documentId: 'u-1',
    firstname: 'Ada',
    myTeams: [],
    role: { name: 'player' },
    trainedTeams: [],
  };
  mockClubQuery = {
    data: CLUB_SANS_EQUIPE,
    error: null,
    isLoading: false,
    refetch: jest.fn(),
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

/** Se faire passer pour un VISITEUR : aucun compte, donc aucun documentId. */
const devenirVisiteur = () => {
  mockUserData = null;
  mockCanJoinClub = false;
  mockCanContactAdmin = false;
};

const { Platform, ScrollView } = jest.requireActual('react-native');

const ASSOCIATION = {
  createdYear: 1923,
  dissolved: false,
  formerNames: [],
  objectText: 'Organiser et promouvoir la pratique de la compétition et des activités sportives.',
  sourceNote: "Objet déclaré au Journal officiel — source : RNA, ministère de l'Intérieur",
  websiteUrl: null,
};

const osDOrigine = Platform.OS;
afterEach(() => {
  Platform.OS = osDOrigine;
  mockDimensions.width = 375;
});

/**
 * Les textes rendus en titre, avec leur rang, dans l'ordre de l'écran.
 * @param {any} arbre L'arbre monté.
 * @returns {Array<{ niveau: number | null, texte: string }>} Les titres.
 */
const titres = (arbre) => arbre.root.findAllByType(Text)
  .filter((/** @type {any} */ noeud) => noeud.props.accessibilityRole === 'header'
    || noeud.props.role === 'heading')
  .map((/** @type {any} */ noeud) => ({
    niveau: noeud.props['aria-level'] || null,
    texte: [noeud.props.children].flat(Infinity)
      .filter((x) => typeof x === 'string').join('').trim(),
  }));

describe('ANNUAIRE-E1 · « À propos » (décision d Adel du 29/09 : A)', () => {
  it('✅ visiteur : le texte de l association, sa date de création et sa source', () => {
    devenirVisiteur();
    mockClubQuery.data = { ...CLUB_SANS_EQUIPE, association: ASSOCIATION };

    const texte = texteDe(monter().root);
    expect(texte).toContain('À propos');
    expect(texte).toContain(ASSOCIATION.objectText);
    expect(texte).toContain('1923');
    expect(texte).toContain('source : RNA');
  });

  it('✅ connecté : le même bloc (la fiche privée le reçoit aussi)', () => {
    mockClubQuery.data = { ...CLUB_SANS_EQUIPE, association: ASSOCIATION };

    expect(texteDe(monter().root)).toContain(ASSOCIATION.objectText);
  });

  it('✅ une association dissoute le dit (décision d Adel du 25/09)', () => {
    devenirVisiteur();
    mockClubQuery.data = { ...CLUB_SANS_EQUIPE, association: { ...ASSOCIATION, dissolved: true } };

    expect(texteDe(monter().root)).toContain('Association dissoute (RNA)');
  });

  it('📌 sans texte du répertoire : pas de bloc « À propos »', () => {
    devenirVisiteur();
    mockClubQuery.data = { ...CLUB_SANS_EQUIPE, association: null };

    expect(texteDe(monter().root)).not.toContain('À propos');
  });

  it('✅ « À propos » vient juste après la carte d identité, avant « Installations »', () => {
    devenirVisiteur();
    mockClubQuery.data = { ...CLUB_SANS_EQUIPE, association: ASSOCIATION };

    const ordre = titres(monter()).map((titre) => titre.texte);
    expect(ordre.indexOf('À propos')).toBeGreaterThan(ordre.indexOf('BASKET CLUB DE LETOILE'));
    expect(ordre.indexOf('À propos')).toBeLessThan(ordre.indexOf('Installations'));
  });
});

describe('ANNUAIRE-E1 · les installations se lisent aussi pour un visiteur', () => {
  it('✅ visiteur : les installations de la porte publique s affichent', () => {
    devenirVisiteur();
    mockClubQuery.data = {
      ...CLUB_SANS_EQUIPE,
      publicFacilities: [{
        address: '15 avenue du Parc, 13008 Marseille',
        documentId: 'inst-1',
        isShared: false,
        maxSlots: 2,
        name: 'Stade Jean Bouin',
        ownerType: 'club',
        type: 'Terrain',
      }],
    };

    expect(texteDe(monter().root)).toContain('Stade Jean Bouin');
  });
});

describe('ANNUAIRE-E1 · le nom du club est LE titre ; les rubriques, de rang 2', () => {
  // La doublure de traduction rend la CLÉ quand l'appel n'a pas de repli (titres de fr.js).
  const RUBRIQUES = [
    'Installations',
    'clubDetails.titles.activities',
    'clubDetails.titles.sponsors',
    'clubDetails.titles.teams',
  ];
  const CLUB_COMPLET = {
    ...CLUB_SANS_EQUIPE,
    activites: [{ documentId: 'a-1', name: 'Football' }],
    sponsor: [{ documentId: 's-1', title: 'Mama' }],
    teams: [{ documentId: 't-1', name: 'U13 A' }],
  };

  it('✅ téléphone : nom et rubriques annoncés comme titres (lecteur d écran)', () => {
    devenirVisiteur();
    mockClubQuery.data = CLUB_COMPLET;
    const lus = titres(monter()).map((titre) => titre.texte);
    ['BASKET CLUB DE LETOILE', ...RUBRIQUES].forEach((attendu) => {
      expect(lus).toContain(attendu);
    });
  });

  it('✅ site : le nom en rang 1, les rubriques en rang 2, dans l ordre de l app', () => {
    Platform.OS = 'web';
    devenirVisiteur();
    mockClubQuery.data = CLUB_COMPLET;
    const lus = titres(monter());
    const principaux = lus.filter((titre) => titre.niveau === 1).map((titre) => titre.texte);
    expect(principaux).toEqual(['BASKET CLUB DE LETOILE']);
    const rubriques = lus.filter((titre) => titre.niveau === 2).map((titre) => titre.texte);
    const rangs = RUBRIQUES.map((titre) => rubriques.indexOf(titre));
    expect(rangs.every((rang) => rang >= 0)).toBe(true);
    expect([...rangs].sort((a, b) => a - b)).toEqual(rangs);
  });
});

describe('ANNUAIRE-E1 · sur l annuaire du site (`annuaire`)', () => {
  const pied = (/** @type {any} */ arbre) => arbre.root.findAll(
    (/** @type {any} */ noeud) => noeud.props?.testID === 'club-details-actions-footer'
      && typeof noeud.type === 'string',
  )[0];
  const style = (/** @type {any} */ noeud) => Object.assign(
    {},
    ...[noeud.props.style].flat(Infinity).filter(Boolean),
  );

  it('✅ pas de défilement interne : la page du site défile', () => {
    Platform.OS = 'web';
    devenirVisiteur();
    mockRoute = { params: { annuaire: true, clubId: 'club-1' } };

    expect(monter().root.findAllByType(ScrollView)).toHaveLength(0);
  });

  it('📌 sans le drapeau (le téléphone), la fiche garde son défilement', () => {
    devenirVisiteur();

    expect(monter().root.findAllByType(ScrollView).length).toBeGreaterThan(0);
  });

  it('✅ téléphone : « Je joue » et « Je dirige » fixés en bas de l écran', () => {
    Platform.OS = 'web';
    devenirVisiteur();
    mockRoute = { params: { annuaire: true, clubId: 'club-1' } };

    const arbre = monter();
    expect(texteDe(pied(arbre))).toContain('Je joue dans ce club');
    expect(texteDe(pied(arbre))).toContain('Je dirige ce club');
    expect(style(pied(arbre))).toEqual(expect.objectContaining({ bottom: 0, position: 'fixed' }));
  });

  it('✅ ordinateur : les deux boutons en colonne à droite, qui suit la page', () => {
    Platform.OS = 'web';
    mockDimensions.width = 1280;
    devenirVisiteur();
    mockRoute = { params: { annuaire: true, clubId: 'club-1' } };

    const arbre = monter();
    expect(texteDe(pied(arbre))).toContain('Je joue dans ce club');
    expect(style(pied(arbre))).toEqual(expect.objectContaining({ position: 'sticky' }));
  });

  it('🔒 CLUBPUB tient sur l annuaire : ni contact, ni membre nommé', () => {
    Platform.OS = 'web';
    devenirVisiteur();
    mockRoute = { params: { annuaire: true, clubId: 'club-1' } };
    mockClubQuery.data = {
      ...CLUB_SANS_EQUIPE,
      email: 'president.dupont@gmail.com',
      members: [{
        documentId: 'm-1', firstname: 'Killian', lastname: 'Mercier', role: { name: 'coach' },
      }],
      phoneNumber: '0612345678',
    };

    const texte = texteDe(monter().root);
    ['0612345678', 'president.dupont@gmail.com', 'Killian', 'Mercier'].forEach((fuite) => {
      expect(texte).not.toContain(fuite);
    });
  });
});
