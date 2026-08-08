import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { navigateToStackScreenOrScreen } from '@/navigation/navigationAvailability';

import { leaveClub } from '@/services/auth/authService';
import { updateClub } from '@/services/club/clubService';

import ClubDetails from '../ClubDetails';

// D34 (E6) : `ClubDetails.js` fait 3 016 lignes et n'avait AUCUN test. C'est la
// « page-fleuve » que le pack « Gerer mon club » veut transformer en hub, et
// deux de ses defauts sont nommes explicitement par le pack :
//   - la corbeille des partenaires est une pastille ROUGE FLOTTANTE posee sur
//     le logo (rouge = erreur, jamais decoration) ;
//   - « Quitter le club » est un bouton COLLANT rendu hors de la ScrollView.
//
// Ce filet fige ce que l'ecran FAIT, jamais ce qu'il dessine : qui voit quoi,
// quelles confirmations s'ouvrent, et ce qui part vraiment sur le reseau. Il
// doit passer, INCHANGE, avant et apres la refonte.
//
// Le compte observe est un DIRIGEANT de son propre club : c'est le seul role
// pour lequel le pack existe.

/** @type {any} */
let mockUserData;
/** @type {any} */
let mockClubQuery;
/** @type {any} */
let mockNavigation;
/** @type {any} */
let mockRoute;

const mockHasClubAccess = jest.fn(() => true);

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

// `mutate` appelle vraiment la `mutationFn` : c'est ce qui fait du service
// double le point d'observation reseau de ce filet.
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

// Quelques cles sont appelees SANS repli : sans cette table, la doublure rendrait
// la cle brute et le libelle n'existerait pas a l'ecran. On ne recopie ici que
// celles-la, avec leur valeur reelle de `fr.js`.
const TRADUCTIONS_SANS_REPLI = {
  'clubDetails.actions.editInfo': 'Modifier',
  'clubDetails.titles.activities': 'Sports',
  'clubDetails.titles.coachs': 'Entraîneurs',
  'clubDetails.titles.owners': 'Dirigeants',
  'clubDetails.titles.sponsors': 'Partenaires',
  'clubDetails.titles.teams': 'Équipes',
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
      const gabarit = (() => {
        if (typeof repli === 'string') return repli;
        if (repli && typeof repli.defaultValue === 'string') return repli.defaultValue;
        return TRADUCTIONS_SANS_REPLI[cle] || cle;
      })();

      // i18next remplace `{{x}}` par `options.x` : la doublure doit le faire
      // aussi, sinon les etiquettes d'accessibilite restent des gabarits.
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
    canContactAdmin: () => false,
    canEditClub: () => true,
    canJoinClub: () => false,
    clubs: [{ documentId: 'club-1' }],
    getNextOnboardingRoute: () => null,
    getPostOnboardingHomeRoute: () => null,
    hasClubAccess: mockHasClubAccess,
    inviteTrainer: jest.fn(),
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

// Services doubles ENTIEREMENT, fonctions pures comprises : ces modules
// importent le client HTTP, qui refuse de se charger sans `API_URL`.
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
// d'appuyer « sur le texte », que le libelle soit porte par un Button (avant)
// ou par un TouchableOpacity (apres).
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
  () => function SponsorLogoTileMock(/** @type {any} */ props) {
    const reactActuel = jest.requireActual('react');
    const { Text: TexteRN } = jest.requireActual('react-native');
    return reactActuel.createElement(TexteRN, null, props.title);
  },
);

jest.mock('@/components/atoms/teamShield/TeamShield', () => function TeamShieldMock() {
  return null;
});

jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function BottomModalMock() {
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

const CLUB = {
  activites: [{ documentId: 'act-1', name: 'Handball' }],
  clubMembersPublicVisibility: true,
  documentId: 'club-1',
  name: 'Stade Marseillais Université Club',
  owner: [{ documentId: 'u-1', firstname: 'Philippe', lastname: 'Courtoi' }],
  sponsor: [
    { link: 'https://elseve.fr', logo: { url: '/uploads/elseve.png' }, title: 'Elseve' },
    { link: 'https://bricolage.fr', logo: { url: '/uploads/mb.png' }, title: 'Mr le bricolage' },
  ],
  teams: [
    {
      category: 'U15', documentId: 't-1', level: 'Départemental 1', name: 'U15 Filles', section: 'Féminine',
    },
    {
      category: 'Sénior', documentId: 't-2', level: 'National', name: 'Seniors A', section: 'Masculine',
    },
  ],
  trainers: [],
};

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

/** @type {any[]} */
const arbresMontes = [];

/**
 * Monte l'ecran.
 * @returns {any} L'arbre rendu.
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
 * @param {string} libelle - Le libelle visible ou l'etiquette d'accessibilite.
 * @returns {any} Le noeud, ou undefined.
 */
const pressableAvecTexte = (arbre, libelle) => {
  const candidats = arbre.root
    .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function')
    .filter((/** @type {any} */ noeud) => (
      texteDe(noeud).includes(libelle)
      || String(noeud.props?.accessibilityLabel || '').includes(libelle)
    ));

  if (candidats.length === 0) return undefined;

  return candidats.find((/** @type {any} */ noeud) => texteDe(noeud).trim() === libelle)
    || candidats[candidats.length - 1];
};

/**
 * Rend le bouton de confirmation d'une alerte ouverte.
 * @param {number} index - L'index de l'appel a Alert.alert.
 * @returns {any} Le bouton destructeur ou de confirmation.
 */
const boutonDeConfirmation = (index = 0) => {
  const boutons = /** @type {any} */ (Alert.alert).mock.calls[index][2];
  return boutons.find((/** @type {any} */ bouton) => bouton.style === 'destructive')
    || boutons[boutons.length - 1];
};

beforeEach(() => {
  jest.clearAllMocks();
  mockHasClubAccess.mockReturnValue(true);

  mockUserData = {
    documentId: 'u-1',
    firstname: 'Philippe',
    role: { name: 'president' },
    trainedTeams: [],
  };
  mockClubQuery = {
    data: CLUB,
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
    setOptions: jest.fn(),
  };
  mockRoute = { params: { clubId: 'club-1' } };

  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => {
  act(() => {
    arbresMontes.splice(0).forEach((arbre) => arbre.unmount());
  });
  jest.restoreAllMocks();
});

describe('ClubDetails — l espace club du dirigeant (fige avant la refonte D34)', () => {
  it('montre le nom du club et ses deux partenaires', () => {
    const textes = texteDe(monter().root);

    expect(textes).toContain('Stade Marseillais Université Club');
    expect(textes).toContain('Elseve');
    expect(textes).toContain('Mr le bricolage');
  });

  it('montre chaque equipe avec sa meta REELLE, pas une meta recopiee', () => {
    const textes = texteDe(monter().root);

    expect(textes).toContain('U15 Filles');
    expect(textes).toContain('Seniors A');
    // Le coeur du grief de l'ecran 11 : chaque equipe porte SA section, SA
    // categorie et SON niveau.
    expect(textes).toContain('Féminine');
    expect(textes).toContain('U15');
    expect(textes).toContain('Départemental 1');
    expect(textes).toContain('Masculine');
    expect(textes).toContain('National');
  });

  it('ouvre la fiche de l equipe au tap', () => {
    const arbre = monter();

    act(() => {
      pressableAvecTexte(arbre, 'U15 Filles').props.onPress();
    });

    // La fiche equipe vit dans un AUTRE stack : l'ecran passe donc par
    // `navigateToStackScreenOrScreen`, pas par `navigation.navigate`.
    expect(navigateToStackScreenOrScreen).toHaveBeenCalledWith(
      mockNavigation,
      expect.objectContaining({ params: { teamId: 't-1' } }),
    );
  });

  it('offre « Quitter le club » a un dirigeant du club', () => {
    expect(pressableAvecTexte(monter(), 'Quitter le club')).toBeDefined();
  });

  it('ne l offre PAS a quelqu un qui n est pas rattache au club', () => {
    mockHasClubAccess.mockReturnValue(false);
    mockUserData = { documentId: 'u-9', role: { name: 'player' }, trainedTeams: [] };

    expect(pressableAvecTexte(monter(), 'Quitter le club')).toBeUndefined();
  });

  it('demande confirmation avant de quitter, et ne part sur le reseau qu apres', () => {
    const arbre = monter();

    act(() => {
      pressableAvecTexte(arbre, 'Quitter le club').props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalled();
    expect(leaveClub).not.toHaveBeenCalled();

    act(() => {
      boutonDeConfirmation().onPress();
    });

    expect(leaveClub).toHaveBeenCalled();
  });

  it('demande confirmation avant de retirer un partenaire, et ne l envoie qu apres', () => {
    const arbre = monter();

    act(() => {
      pressableAvecTexte(arbre, 'Supprimer le sponsor Elseve').props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalled();
    expect(updateClub).not.toHaveBeenCalled();

    act(() => {
      boutonDeConfirmation().onPress();
    });

    expect(updateClub).toHaveBeenCalled();
  });

  it('ne retire QUE le partenaire vise, et garde l autre', () => {
    const arbre = monter();

    act(() => {
      pressableAvecTexte(arbre, 'Supprimer le sponsor Elseve').props.onPress();
    });
    act(() => {
      boutonDeConfirmation().onPress();
    });

    const charge = /** @type {any} */ (updateClub).mock.calls[0];
    const restants = JSON.stringify(charge);
    expect(restants).toContain('Mr le bricolage');
    expect(restants).not.toContain('Elseve');
  });

  it('offre l affiche « Rejoindre le club » au dirigeant', () => {
    expect(texteDe(monter().root)).toContain('Rejoindre le club');
  });

  it('offre « Modifier » sur la carte du club', () => {
    const arbre = monter();

    act(() => {
      pressableAvecTexte(arbre, 'Modifier').props.onPress();
    });

    expect(mockNavigation.navigate).toHaveBeenCalled();
  });
});
