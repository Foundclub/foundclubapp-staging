import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { createClubInterestRequest } from '@/services/clubInterestRequest/clubInterestRequestService';
import { createClubRequest } from '@/services/clubRequest/clubRequestService';

import ClubDetails from '../ClubDetails';

// S02 — « Moi je veux DEUX BOUTONS » (Adel, 2026-08-16).
//
// Le defaut : sur un club SANS equipe — 222 287 clubs sur 222 294 en production
// au 2026-08-13, donc le cas NORMAL et pas le cas limite — la fiche n'offrait
// qu'UNE porte, et elle disait la meme chose a tout le monde : « j'y suis
// deja ». Celui qui n'y est PAS ENCORE n'avait nulle part ou se declarer.
//
// Les deux portes ne racontent pas la meme histoire, et c'est tout l'enjeu :
//   · « C'est mon club »                    = j'y suis deja, faites-moi entrer ;
//   · « Prevenez-moi quand ce club arrive » = je n'y suis pas encore.
//
// Ce filet observe ce que l'ecran FAIT — quel bouton existe, ce qu'il ouvre, et
// ce qui part vraiment sur le reseau — jamais ce qu'il dessine.

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
    canContactAdmin: false,
    canEditClub: (/** @type {string} */ id) => mockHasClubAccess(id),
    canJoinClub: false,
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
  default: () => ({ getClubInitials: (/** @type {string} */ nom) => String(nom || '').slice(0, 2) }),
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
  name: 'AS Sans Equipe',
  sponsor: [],
  teams: [],
  trainers: [],
};

const CLUB_AVEC_EQUIPE = {
  ...CLUB_SANS_EQUIPE,
  members: [{ documentId: 'u-9', role: { name: 'president' } }],
  name: 'AS Avec Equipe',
  teams: [{
    category: 'Sénior', documentId: 't-1', level: 'National', name: 'Seniors A', section: 'Masculine',
  }],
};

const LIBELLE_MON_CLUB = 'C’est mon club';
const LIBELLE_PREVENEZ_MOI = 'Prévenez-moi quand ce club arrive';

/**
 * Aplatit les enfants d'un noeud en une chaine.
 * @param {any} enfants - Les enfants du noeud.
 * @returns {string} Le texte aplati.
 */
const aplatirTexte = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatirTexte).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatirTexte(enfants?.props?.children);
  return String(enfants);
};

/**
 * Texte visible sous un noeud de l'arbre rendu.
 * @param {any} noeud - Le noeud observe.
 * @returns {string} Le texte visible.
 */
const texteDe = (noeud) => noeud
  .findAllByType(Text)
  .map((/** @type {any} */ texte) => aplatirTexte(texte.props.children))
  .join(' ');

/**
 * Le texte porte par un element React non rendu (ici `headerComponent`).
 * @param {any} element - L'element.
 * @returns {string} Son texte.
 */
const texteDeLElement = (element) => {
  if (element === null || element === undefined || typeof element === 'boolean') return '';
  if (typeof element === 'string' || typeof element === 'number') return String(element);
  if (Array.isArray(element)) return element.map(texteDeLElement).join(' ');
  return texteDeLElement(element.props?.children);
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
 * Trouve le pressable le plus profond qui porte ce libelle, ou undefined.
 * @param {any} arbre - L'arbre rendu.
 * @param {string} libelle - Le libelle visible.
 * @returns {any} Le noeud, ou undefined.
 */
const pressableAvecTexte = (arbre, libelle) => {
  const candidats = arbre.root
    .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function')
    .filter((/** @type {any} */ noeud) => texteDe(noeud).includes(libelle));

  if (candidats.length === 0) return undefined;

  return candidats.find((/** @type {any} */ noeud) => texteDe(noeud).trim() === libelle)
    || candidats[candidats.length - 1];
};

/**
 * La feuille du club sans equipe, telle qu'elle vient d'etre rendue.
 * @returns {any} Ses dernieres proprietes.
 */
const derniereFeuilleDuClubSansEquipe = () => [...mockFeuillesRendues]
  .reverse()
  .find((props) => texteDeLElement(props?.headerComponent).includes('pas encore d’équipe'));

beforeEach(() => {
  jest.clearAllMocks();
  mockFeuillesRendues.length = 0;
  mockHasClubAccess.mockReturnValue(false);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});

  // Un JOUEUR de passage : il n'est ni membre, ni dirigeant de ce club.
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

describe('S02 — la fiche d\'un club SANS equipe offre DEUX portes', () => {
  // LE TEMOIN PRINCIPAL.
  it('LE TEMOIN : les deux boutons sont la, et ils ne disent pas la meme chose', () => {
    const arbre = monter();

    expect(pressableAvecTexte(arbre, LIBELLE_MON_CLUB)).toBeDefined();
    expect(pressableAvecTexte(arbre, LIBELLE_PREVENEZ_MOI)).toBeDefined();
  });

  it('« C’est mon club » ouvre le formulaire, il n\'envoie rien tout seul', () => {
    const arbre = monter();

    // Avant l'appui, la feuille est fermee et rien n'est parti.
    expect(derniereFeuilleDuClubSansEquipe()?.isVisible).toBe(false);

    act(() => {
      pressableAvecTexte(arbre, LIBELLE_MON_CLUB).props.onPress();
    });

    expect(derniereFeuilleDuClubSansEquipe()?.isVisible).toBe(true);
    // ⛔ Ouvrir un formulaire n'est pas envoyer une demande : le reseau est muet
    // tant que la personne n'a pas valide.
    expect(createClubRequest).not.toHaveBeenCalled();
  });

  it('« Prévenez-moi » enregistre un interet SANS pretendre que j\'y suis', () => {
    const arbre = monter();

    act(() => {
      pressableAvecTexte(arbre, LIBELLE_PREVENEZ_MOI).props.onPress();
    });

    // 🎯 Un interet AU CLUB : aucune equipe, donc aucune affirmation d'y jouer.
    expect(createClubInterestRequest).toHaveBeenCalledTimes(1);
    expect(createClubInterestRequest).toHaveBeenCalledWith({ club: 'club-1' });
    // ⛔ Et surtout PAS la demande « faites venir mon club », qui elle affirme
    // un lien avec le club et reclame une verification cote super-admin.
    expect(createClubRequest).not.toHaveBeenCalled();
  });

  it('le clavier ne cache plus la saisie : la feuille demande `adjustPan`', () => {
    monter();

    // `adjustResize` est le defaut de `BottomModal`, et c'est LUI qui laissait le
    // clavier passer devant : la bibliotheque ne remonte pas la feuille dans ce
    // mode, et Android 15 ne redimensionne plus la fenetre a sa place.
    expect(derniereFeuilleDuClubSansEquipe()?.androidKeyboardInputMode).toBe('adjustPan');
  });
});

// 🔒 LA NON-REGRESSION QUI COMPTE — un club QUI A une equipe ne bouge pas.
describe('S02 — un club AVEC equipe garde exactement ses boutons d\'avant', () => {
  beforeEach(() => {
    mockClubQuery.data = CLUB_AVEC_EQUIPE;
  });

  it('la 2e porte reste eteinte : c\'est l\'interet POUR UNE EQUIPE qui joue', () => {
    const arbre = monter();

    expect(pressableAvecTexte(arbre, LIBELLE_PREVENEZ_MOI)).toBeUndefined();
    expect(pressableAvecTexte(arbre, LIBELLE_MON_CLUB)).toBeUndefined();
  });

  it('le joueur y garde « Je fais partie de ce club », inchange', () => {
    const arbre = monter();

    expect(pressableAvecTexte(arbre, 'Je fais partie de ce club')).toBeDefined();
  });
});
