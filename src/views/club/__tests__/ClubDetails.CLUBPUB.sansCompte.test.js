import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubDetails from '../ClubDetails';
// CLUBPUB — LA FICHE D UN CLUB DOIT ETRE VISIBLE SANS COMPTE, ET SANS FUITE.
//
// DECISION D ADEL DU 2026-09-07 : « oui, une fiche club doit etre visible sans
// compte ». La solution evidente — accorder la lecture d une fiche au role
// visiteur — etait un PIEGE, et ce filet existe pour qu on ne le retende jamais.
//
// LA MESURE QUI A ARRETE LE GESTE (base de production, 2026-09-07) :
//   . 37 705 clubs portent un numero de telephone
//   . dont 30 771 commencent par 06 ou 07 — des MOBILES PERSONNELS
//   . 42 069 clubs portent une adresse e-mail
// Or ClubDetails.js affichait ces deux champs SANS AUCUNE condition de
// connexion (lignes 2363 et 2380), en boutons « appeler » et « ecrire », plus
// la liste des membres. Ouvrir l ecran tel quel publiait ~31 000 numeros
// personnels dans une app que n importe qui telecharge. C est le mode de panne
// deja paye le 2026-08-20 : des dates de naissance et des telephones sortis sur
// des pages publiques.
//
// 🔒 LE TEMOIN NON NEGOCIABLE EST T2. Il monte l ecran SANS session avec une
// donnee qui PORTE un telephone, un e-mail et des membres, et exige qu aucun des
// trois ne soit rendu. Il ne teste pas la source de donnees — il teste le
// GARDE-FOU, pour qu il survive au jour ou la source changera.
//
// ⚠️ CE QUE CE FILET NE MESURE PAS : quelle porte HTTP est appelee. C est
// l affaire de clubQueries, et son propre temoin.
//
// ✅ NON-REGRESSION : T4 exige que l utilisateur CONNECTE continue de voir le
// telephone. Decision d Adel du 2026-09-07, textuellement : « on laisse, c est
// fait expres ». Ce lot ne retire RIEN a ceux qui ont un compte.

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
  getFacilitySections: () => [],
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

/** Se faire passer pour un entraineur : `canJoinClub` vaut `coach`. */
const devenirEntraineur = () => {
  mockCanJoinClub = true;
  mockUserData = { ...mockUserData, role: { name: 'coach' } };
};

/** Se faire passer pour un dirigeant : `canContactAdmin` vaut `president`. */
const devenirDirigeant = () => {
  mockCanContactAdmin = true;
  mockUserData = { ...mockUserData, role: { name: 'president' } };
};

/**
 * Un club qui PORTE des donnees de contact et des membres. C est volontaire :
 * le garde-fou doit tenir meme quand la donnee est la, sinon il ne prouve rien.
 */
const CLUB_AVEC_CONTACT = {
  ...CLUB_SANS_EQUIPE,
  email: 'president.dupont@gmail.com',
  members: [
    {
      documentId: 'm-1', firstname: 'Killian', lastname: 'Mercier', role: { name: 'coach' },
    },
  ],
  phoneNumber: '0612345678',
};

/** Se faire passer pour un VISITEUR : aucun compte, donc aucun documentId. */
const devenirVisiteur = () => {
  mockUserData = null;
  mockCanJoinClub = false;
  mockCanContactAdmin = false;
};

// ---------------------------------------------------------------------------
// T1 — CARACTERISATION : ce que le visiteur DOIT voir
// ---------------------------------------------------------------------------

describe('CLUBPUB · T1 — sans compte, la fiche reste une fiche', () => {
  it('le nom du club est affiche', () => {
    devenirVisiteur();
    mockClubQuery.data = CLUB_AVEC_CONTACT;

    expect(texteDe(monter().root)).toContain('BASKET CLUB DE LETOILE');
  });
});

// ---------------------------------------------------------------------------
// 🔒 T2 — LE TEMOIN NON NEGOCIABLE
//
// La donnee PORTE un telephone et un e-mail. L ecran ne doit rendre ni l un ni
// l autre a quelqu un qui n a pas de compte. 8 numeros sur 10 en base sont des
// mobiles personnels : ce n est pas un detail d affichage, c est une fuite.
// ---------------------------------------------------------------------------

describe('CLUBPUB · T2 — sans compte, aucun contact ne sort', () => {
  it('le telephone du club n est PAS affiche', () => {
    devenirVisiteur();
    mockClubQuery.data = CLUB_AVEC_CONTACT;

    expect(texteDe(monter().root)).not.toContain('0612345678');
  });

  it('l e-mail du club n est PAS affiche', () => {
    devenirVisiteur();
    mockClubQuery.data = CLUB_AVEC_CONTACT;

    expect(texteDe(monter().root)).not.toContain('president.dupont@gmail.com');
  });
});

// ---------------------------------------------------------------------------
// 🔒 T3 — LES MEMBRES NON PLUS
// ---------------------------------------------------------------------------

describe('CLUBPUB · T3 — sans compte, aucun membre n est nomme', () => {
  it('le nom d un membre du club n apparait nulle part', () => {
    devenirVisiteur();
    mockClubQuery.data = CLUB_AVEC_CONTACT;

    const texte = texteDe(monter().root);
    expect(texte).not.toContain('Killian');
    expect(texte).not.toContain('Mercier');
  });
});

// ---------------------------------------------------------------------------
// ✅ T4 — NON-REGRESSION : on ne retire RIEN a ceux qui ont un compte
//
// Decision d Adel du 2026-09-07, textuellement : « on laisse, c est fait
// expres ». Le telephone reste visible pour un utilisateur connecte.
// ---------------------------------------------------------------------------

describe('CLUBPUB · T4 — avec un compte, le contact reste visible', () => {
  it('un joueur connecte voit toujours le telephone du club', () => {
    mockClubQuery.data = CLUB_AVEC_CONTACT;

    expect(texteDe(monter().root)).toContain('0612345678');
  });

  it('un dirigeant connecte voit toujours le telephone du club', () => {
    devenirDirigeant();
    mockClubQuery.data = CLUB_AVEC_CONTACT;

    expect(texteDe(monter().root)).toContain('0612345678');
  });

  it('un entraineur connecte voit toujours l e-mail du club', () => {
    devenirEntraineur();
    mockClubQuery.data = CLUB_AVEC_CONTACT;

    expect(texteDe(monter().root)).toContain('president.dupont@gmail.com');
  });
});
