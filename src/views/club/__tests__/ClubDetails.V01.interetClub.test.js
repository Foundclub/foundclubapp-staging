import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  createClubInterestRequest,
} from '@/services/clubInterestRequest/clubInterestRequestService';

import ClubDetails from '../ClubDetails';

// V01 - « je dois voir DEUX boutons » (Adel, 2026-08-18).
//
// S02 avait donne ses deux portes au club SANS equipe. Il manquait l'autre
// moitie : le club QUI A des equipes. La, le joueur de passage n'avait qu'un
// seul geste, et il affirmait une appartenance - « Je fais partie de ce club ».
// Celui qui n'y est PAS ENCORE ne pouvait rien dire, alors que c'est justement
// lui que le club cherche.
//
// Les deux intentions, mot pour mot :
//   · « Je fais partie de ce club » = j'y suis deja, faites-moi entrer ;
//   · « Interesse par le club »     = je n'y suis pas, je me signale.
//
// Ce filet observe ce que l'ecran FAIT - quel bouton existe, ce qu'il ouvre, et
// ce qui part vraiment sur le reseau - jamais ce qu'il dessine.

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
  name: 'AS Sans Equipe',
  sponsor: [],
  teams: [],
  trainers: [],
};

const CLUB_AVEC_EQUIPE = {
  ...CLUB_SANS_EQUIPE,
  members: [{ documentId: 'u-9', role: { name: 'president' } }],
  name: 'AS Avec Equipe',
  teams: [
    {
      category: 'Sénior',
      documentId: 't-1',
      level: 'National',
      name: 'Seniors A',
      section: 'Masculine',
    },
    {
      category: 'U17',
      documentId: 't-2',
      level: 'Régional',
      name: 'U17',
      section: 'Masculine',
    },
  ],
};

const LIBELLE_JE_FAIS_PARTIE = 'Je fais partie de ce club';
const LIBELLE_INTERESSE = 'Intéressé par le club';
const LIBELLE_CLUB_EN_GENERAL = 'Le club en général';

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

/**
 * Le texte porte par un element NON MONTE, `title` des boutons compris.
 * La doublure `Button` rend son titre ; l'element, lui, ne porte qu'une prop.
 * @param {any} element - L'element.
 * @returns {string} Son texte.
 */
const texteBrutDeLElement = (element) => {
  if (element === null || element === undefined || typeof element === 'boolean') return '';
  if (typeof element === 'string' || typeof element === 'number') return String(element);
  if (Array.isArray(element)) return element.map(texteBrutDeLElement).join(' ');
  const titre = typeof element.props?.title === 'string' ? element.props.title : '';
  // 🪤 Un nom qui DEFILE ne porte pas son texte dans `children` mais dans la
  // prop `text` (MarqueeText, 27/08). Sans cette lecture, la rangee « Seniors A »
  // de la feuille devient introuvable : le temoin rend `undefined`, pas « pas
  // le bon libelle ».
  const texteDefilant = typeof element.props?.text === 'string' ? element.props.text : '';
  return `${titre} ${texteDefilant} ${texteBrutDeLElement(element.props?.children)}`;
};

/**
 * Tous les elements pressables d'un arbre d'elements non monte.
 * @param {any} element - L'element racine.
 * @param {any[]} [accumulateur] - L'accumulateur.
 * @returns {any[]} Les elements portant un `onPress`.
 */
const pressablesDeLElement = (element, accumulateur = []) => {
  if (element === null || element === undefined || typeof element !== 'object') {
    return accumulateur;
  }
  if (Array.isArray(element)) {
    element.forEach((enfant) => pressablesDeLElement(enfant, accumulateur));
    return accumulateur;
  }
  if (typeof element.props?.onPress === 'function') accumulateur.push(element);
  pressablesDeLElement(element.props?.children, accumulateur);
  return accumulateur;
};

/**
 * Le pressable de la feuille d'interet qui porte ce libelle.
 * @param {string} libelle - Le libelle visible.
 * @returns {any} L'element, ou undefined.
 */
const pressableDeLaFeuilleDInteret = (libelle) => pressablesDeLElement(
  derniereFeuilleDInteret()?.children,
).filter((element) => texteBrutDeLElement(element).includes(libelle)).pop();

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
 * La feuille « Qu'est-ce qui t'interesse ? », telle qu'elle vient d'etre rendue.
 * @returns {any} Ses dernieres proprietes.
 */
const derniereFeuilleDInteret = () => [...mockFeuillesRendues]
  .reverse()
  .find((props) => texteDeLElement(props?.headerComponent).includes('t’intéresse'));

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
    data: CLUB_AVEC_EQUIPE,
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

describe("V01 - la fiche d'un club AVEC equipes offre DEUX portes", () => {
  // LE TEMOIN PRINCIPAL. Il contredit deliberement la regle d'avant : jusqu'ici
  // `hasPrimaryAffiliationAction` eteignait l'interet des que « Je fais partie
  // de ce club » s'allumait.
  it('LE TEMOIN : les deux boutons sont la, et ils ne disent pas la meme chose', () => {
    const arbre = monter();

    expect(pressableAvecTexte(arbre, LIBELLE_JE_FAIS_PARTIE)).toBeDefined();
    expect(pressableAvecTexte(arbre, LIBELLE_INTERESSE)).toBeDefined();
  });

  it("« Interesse par le club » ouvre la liste, il n'envoie rien tout seul", () => {
    const arbre = monter();

    expect(derniereFeuilleDInteret()?.isVisible).toBe(false);

    act(() => {
      pressableAvecTexte(arbre, LIBELLE_INTERESSE).props.onPress();
    });

    expect(derniereFeuilleDInteret()?.isVisible).toBe(true);
    // Ouvrir une liste n'est pas envoyer un interet.
    expect(createClubInterestRequest).not.toHaveBeenCalled();
  });

  it('la liste montre les equipes du club, une par une', () => {
    const arbre = monter();

    act(() => {
      pressableAvecTexte(arbre, LIBELLE_INTERESSE).props.onPress();
    });

    expect(pressableDeLaFeuilleDInteret('Seniors A')).toBeDefined();
    expect(pressableDeLaFeuilleDInteret('U17')).toBeDefined();
  });

  // 🎯 CE QU'ADEL DEMANDE MOT POUR MOT : « avec un bouton interesse par le club
  // en general - pour les dirigeants ». Sans cette ligne, celui qui ne vise
  // aucune equipe precise n'a nulle part ou se signaler.
  it('LE TEMOIN 2 : la liste porte « le club en general », et il part au CLUB', () => {
    const arbre = monter();

    act(() => {
      pressableAvecTexte(arbre, LIBELLE_INTERESSE).props.onPress();
    });

    const choixGeneral = pressableDeLaFeuilleDInteret(LIBELLE_CLUB_EN_GENERAL);
    expect(choixGeneral).toBeDefined();

    act(() => {
      choixGeneral.props.onPress();
    });

    // AUCUNE equipe : c'est l'absence de `team` qui dit « le club en general »,
    // cote serveur comme ici.
    expect(createClubInterestRequest).toHaveBeenCalledTimes(1);
    expect(createClubInterestRequest).toHaveBeenCalledWith({ club: 'club-1' });
  });

  it("choisir une EQUIPE precise demande confirmation avant d'envoyer", () => {
    const arbre = monter();

    act(() => {
      pressableAvecTexte(arbre, LIBELLE_INTERESSE).props.onPress();
    });
    act(() => {
      pressableDeLaFeuilleDInteret('Seniors A').props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalled();
    expect(createClubInterestRequest).not.toHaveBeenCalled();
  });
});

// 🔒 LES NON-REGRESSIONS.
describe('V01 - ce qui ne doit PAS bouger', () => {
  it('un joueur DEJA dans ce club ne voit aucune des deux portes', () => {
    mockUserData = {
      ...mockUserData,
      myTeams: [{ club: { documentId: 'club-1' }, documentId: 't-1' }],
    };

    const arbre = monter();

    expect(pressableAvecTexte(arbre, LIBELLE_JE_FAIS_PARTIE)).toBeUndefined();
    expect(pressableAvecTexte(arbre, LIBELLE_INTERESSE)).toBeUndefined();
  });

  it("un dirigeant de CE club ne voit pas la porte d'interet", () => {
    mockHasClubAccess.mockReturnValue(true);
    mockUserData = { ...mockUserData, role: { name: 'president' } };

    const arbre = monter();

    expect(pressableAvecTexte(arbre, LIBELLE_INTERESSE)).toBeUndefined();
  });

  it('un visiteur NON CONNECTE ne peut rien envoyer depuis cette fiche', () => {
    mockUserData = null;

    const arbre = monter();

    expect(pressableAvecTexte(arbre, LIBELLE_INTERESSE)).toBeUndefined();
    expect(createClubInterestRequest).not.toHaveBeenCalled();
  });
});
