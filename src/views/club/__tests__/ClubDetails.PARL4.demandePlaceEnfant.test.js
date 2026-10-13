import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import {
  createClubInterestRequest,
} from '@/services/clubInterestRequest/clubInterestRequestService';

import ClubDetails from '../ClubDetails';

// PAR-L4 CHOIX-ENFANT-EQUIPE (13/10, recette parent PAR-009 / PAR-005) — LA FEUILLE
// « DEMANDER UNE PLACE POUR UN ENFANT », depuis la fiche d'un club.
//
// Avant ce lot, AUCUN temoin ne rendait cette feuille en mode enfant (0 test,
// recherche du 13/10 : « child-interest », « child-choice », « joinForChild »
// n'apparaissaient dans aucun fichier de test). Ce fichier commence donc par
// DECRIRE L'EXISTANT (bloc « caracterisation », vert sur staging 8f862825), puis
// pose les temoins du lot.
//
// Ce filet observe ce que l'ecran FAIT — quel bouton existe, ce que la feuille
// montre, et ce qui part vraiment sur le reseau —, jamais ce qu'il dessine.

/** @type {any} */
let mockUserData;
/** @type {any} */
let mockClubQuery;
/** @type {any} */
let mockNavigation;
/** @type {any} */
let mockRoute;
/** @type {any[]} */
let mockEnfants;
/** @type {any[]} */
let mockDemandes;

const mockHasClubAccess = jest.fn(() => false);

jest.mock('@/services/matchStats/matchStatsService', () => ({
  getTeamPerformanceStats: jest.fn(),
}));
jest.mock('@/services/stats/statsService', () => ({ getTeamStats: jest.fn() }));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

// `mutate` appelle vraiment la `mutationFn` : les services doubles sont le point
// d'observation reseau de ce filet.
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
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
      const gabarit = (() => {
        if (typeof repli === 'string') return repli;
        if (repli && typeof repli.defaultValue === 'string') return repli.defaultValue;
        return cle;
      })();
      const variables = (repli && typeof repli === 'object') ? repli : options;
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
    USER_ROLES: {
      coach: 'coach', parent: 'parent', player: 'player', president: 'president',
    },
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

// Services doubles ENTIEREMENT : ces modules importent le client HTTP, qui refuse
// de se charger sans `API_URL` (`.env` est absent de toute copie de travail).
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

jest.mock('@/services/declaredChild/declaredChildQueries', () => ({
  useGetMyDeclaredChildren: () => ({ data: mockEnfants, error: undefined, isLoading: false }),
}));

jest.mock('@/services/clubInterestRequest/clubInterestRequestQueries', () => ({
  useGetMyClubInterestRequests: () => ({ data: { data: mockDemandes }, refetch: jest.fn() }),
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

// Le bouton est un VRAI pressable portant son libelle (et son etiquette de test).
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
        testID: props.testID,
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

// La feuille est RENDUE quand elle est ouverte (en-tete puis contenu) : ce que le
// parent voit dedans se lit dans l'arbre monte, comme le reste de l'ecran.
jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => {
    const reactActuel = jest.requireActual('react');
    const { View: VueRN } = jest.requireActual('react-native');
    return function BottomModalMock(/** @type {any} */ props) {
      if (!props.isVisible) return null;
      return reactActuel.createElement(
        VueRN,
        { testID: 'feuille-ouverte' },
        props.headerComponent || null,
        props.children,
      );
    };
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
  activites: [],
  clubMembersPublicVisibility: true,
  documentId: 'club-1',
  members: [{ documentId: 'u-9', role: { name: 'president' } }],
  name: 'FoundClub',
  sponsor: [],
  teams: [
    {
      category: 'U11',
      documentId: 't-filles',
      level: 'Départemental',
      name: 'U11 Filles',
      section: 'Féminine',
    },
    {
      category: 'U11',
      documentId: 't-garcons',
      level: 'Départemental',
      name: 'U11 Garçons',
      section: 'Masculine',
    },
  ],
  trainers: [],
};

const ANISSA = {
  age: 11, documentId: 'c-anissa', firstname: 'Anissa', lastname: 'Dubelloy', team: null,
};
const MARTIN = {
  age: 9, documentId: 'c-martin', firstname: 'Martin', lastname: 'Dubelloy', team: null,
};
const MARTIN_PLACE = {
  ...MARTIN, team: { documentId: 't-garcons', name: 'U11 Garçons' },
};
const LINA_ADO = {
  age: 14, documentId: 'c-lina', firstname: 'Lina', lastname: 'Dubelloy', team: null,
};

/**
 * Une demande de place en attente, pour un enfant et une equipe.
 * @param {string} equipe - L'equipe visee.
 * @param {string} enfant - L'enfant.
 * @returns {any} La demande, telle que « mes demandes » la rend.
 */
const demandeEnAttente = (equipe, enfant) => ({
  declaredChild: { documentId: enfant },
  status: 'pending',
  team: { documentId: equipe },
});

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
 * La feuille ouverte, ou undefined.
 * @param {any} arbre - L'arbre rendu.
 * @returns {any} Le noeud de la feuille.
 */
const feuille = (arbre) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props?.testID === 'feuille-ouverte')
  .shift();

/**
 * Le pressable le plus profond qui porte ce libelle sous `racine`, ou undefined.
 * @param {any} racine - Le noeud de depart.
 * @param {string} libelle - Le libelle visible.
 * @returns {any} Le noeud, ou undefined.
 */
const pressableSous = (racine, libelle) => {
  if (!racine) return undefined;
  const candidats = racine
    .findAll((/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function')
    .filter((/** @type {any} */ noeud) => texteDe(noeud).includes(libelle));
  if (candidats.length === 0) return undefined;
  return candidats.find((/** @type {any} */ noeud) => texteDe(noeud).trim() === libelle)
    || candidats[candidats.length - 1];
};

/**
 * Le pressable de la fiche (hors feuille) qui porte ce libelle.
 * @param {any} arbre - L'arbre rendu.
 * @param {string} libelle - Le libelle visible.
 * @returns {any} Le noeud, ou undefined.
 */
const boutonDeLaFiche = (arbre, libelle) => pressableSous(arbre.root, libelle);

/**
 * Le bouton de la fiche qui ouvre la feuille « pour un enfant ».
 * @param {any} arbre - L'arbre rendu.
 * @returns {any} Le noeud, ou undefined.
 */
const porteEnfant = (arbre) => arbre.root
  .findAll((/** @type {any} */ noeud) => noeud.props?.testID === 'club-details-child-interest'
    && typeof noeud.props?.onPress === 'function')
  .shift();

/**
 * Appuie, puis laisse partir les promesses du faux `useMutation`.
 * @param {any} noeud - Le pressable.
 * @returns {Promise<void>}
 */
const appuyer = async (noeud) => {
  await act(async () => {
    noeud.props.onPress();
    await Promise.resolve();
    await Promise.resolve();
  });
};

/**
 * Le dernier `Alert.alert` : [titre, message, boutons].
 * @returns {any[]} Ses arguments.
 */
const derniereAlerte = () => /** @type {any} */ (Alert.alert).mock.calls.at(-1) || [];

beforeEach(() => {
  jest.clearAllMocks();
  mockHasClubAccess.mockReturnValue(false);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  /** @type {any} */ (createClubInterestRequest).mockResolvedValue({ data: {} });

  // Un PARENT de passage : il n'est ni membre, ni dirigeant de ce club.
  mockUserData = {
    documentId: 'u-parent',
    firstname: 'Sami',
    myTeams: [],
    role: { name: 'parent' },
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
    push: jest.fn(),
    setOptions: jest.fn(),
  };
  mockRoute = { params: { clubId: 'club-1' } };
  mockEnfants = [ANISSA, MARTIN];
  mockDemandes = [];
});

afterEach(() => {
  arbresMontes.forEach((arbre) => act(() => arbre.unmount()));
  arbresMontes.length = 0;
  /** @type {any} */ (Alert.alert).mockRestore?.();
});

// ───────────────────────────────────────────────────────────────────────────
// CARACTERISATION — l'existant au 13/10 (staging 8f862825), AVANT ce lot.
// ───────────────────────────────────────────────────────────────────────────
describe('PAR-L4 caracterisation — la feuille « pour un enfant » telle qu elle est', () => {
  it('deux enfants a placer : la porte est anonyme, la feuille demande « pour qui »', async () => {
    const arbre = monter();

    const porte = porteEnfant(arbre);
    expect(porte).toBeDefined();
    expect(texteDe(porte)).toBe('Demander à rejoindre pour mes enfants');

    await appuyer(porte);

    const ouverte = feuille(arbre);
    expect(ouverte).toBeDefined();
    expect(texteDe(ouverte)).toContain('Une place pour ton enfant');
    // Un bouton par enfant, rien de choisi.
    expect(pressableSous(ouverte, 'Anissa')).toBeDefined();
    expect(pressableSous(ouverte, 'Martin')).toBeDefined();
    // Pas de « club en general » pour un enfant : une place se demande dans une equipe.
    expect(createClubInterestRequest).not.toHaveBeenCalled();
  });

  it('enfant puis equipe : une confirmation, puis la demande PORTE l enfant', async () => {
    const arbre = monter();
    await appuyer(porteEnfant(arbre));
    await appuyer(pressableSous(feuille(arbre), 'Anissa'));

    expect(texteDe(feuille(arbre))).toContain('Une place pour Anissa');

    await appuyer(pressableSous(feuille(arbre), 'U11 Filles'));

    // La confirmation est une alerte systeme.
    const [titre, , boutons] = derniereAlerte();
    expect(titre).toBe('Demander une place pour Anissa ?');
    expect(createClubInterestRequest).not.toHaveBeenCalled();

    await act(async () => {
      boutons.find((/** @type {any} */ b) => b.style !== 'cancel').onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(createClubInterestRequest).toHaveBeenCalledTimes(1);
    expect(createClubInterestRequest).toHaveBeenCalledWith({
      declaredChild: 'c-anissa',
      team: 't-filles',
    });
    const [titreFin, messageFin] = derniereAlerte();
    expect(titreFin).toBe('Demande envoyée');
    expect(messageFin).toContain('U11 Filles');
    expect(messageFin).toContain('Anissa');
  });

  it('un seul enfant a placer (l autre en equipe) : son prenom, l autre ABSENT', async () => {
    mockEnfants = [ANISSA, MARTIN_PLACE];
    const arbre = monter();

    expect(texteDe(porteEnfant(arbre))).toBe('Demander à rejoindre au nom de Anissa');

    await appuyer(porteEnfant(arbre));
    const ouverte = feuille(arbre);
    expect(texteDe(ouverte)).toContain('Une place pour Anissa');
    // L'existant : l'enfant deja en equipe disparait de la feuille, sans un mot.
    expect(texteDe(ouverte)).not.toContain('Martin');
  });

  it('chaque enfant a placer a deja une demande ici : la porte disparait', () => {
    mockDemandes = [
      demandeEnAttente('t-filles', 'c-anissa'),
      demandeEnAttente('t-garcons', 'c-martin'),
    ];
    const arbre = monter();

    expect(porteEnfant(arbre)).toBeUndefined();
  });

  it('tous les enfants de moins de 13 ans sont en equipe : ni porte, ni phrase', () => {
    mockEnfants = [MARTIN_PLACE];
    const arbre = monter();

    expect(porteEnfant(arbre)).toBeUndefined();
    expect(texteDe(arbre.root)).not.toContain('fait sa demande');
  });

  it('seulement un ado : pas de porte, une phrase (E17)', () => {
    mockEnfants = [LINA_ADO];
    const arbre = monter();

    expect(porteEnfant(arbre)).toBeUndefined();
    expect(texteDe(arbre.root)).toContain(
      'À partir de 13 ans, ton enfant fait sa demande lui-même depuis son propre compte.',
    );
  });

  it('venu de la fiche de Martin (childDocumentId) : la feuille l ignore', async () => {
    mockRoute = { params: { childDocumentId: 'c-martin', clubId: 'club-1' } };
    const arbre = monter();

    expect(texteDe(porteEnfant(arbre))).toBe('Demander à rejoindre pour mes enfants');
    await appuyer(porteEnfant(arbre));
    expect(texteDe(feuille(arbre))).toContain('Une place pour ton enfant');
  });

  it('refus « deja en attente » : le libelle ADULTE, sans le prenom', async () => {
    /** @type {any} */ (createClubInterestRequest).mockRejectedValue({
      response: { data: { error: { message: 'A request is already pending' } }, status: 400 },
    });
    const arbre = monter();
    await appuyer(porteEnfant(arbre));
    await appuyer(pressableSous(feuille(arbre), 'Anissa'));
    await appuyer(pressableSous(feuille(arbre), 'U11 Filles'));
    const [, , boutons] = derniereAlerte();
    await act(async () => {
      boutons.find((/** @type {any} */ b) => b.style !== 'cancel').onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    const [titre, message] = derniereAlerte();
    expect(titre).toBe('Erreur');
    expect(message).toBe('Intérêt déjà envoyé.');
  });

  it('refus « deja dans une equipe » : « Ton enfant », jamais son prenom', async () => {
    /** @type {any} */ (createClubInterestRequest).mockRejectedValue({
      response: {
        data: { error: { message: 'This child already belongs to a team' } },
        status: 400,
      },
    });
    const arbre = monter();
    await appuyer(porteEnfant(arbre));
    await appuyer(pressableSous(feuille(arbre), 'Anissa'));
    await appuyer(pressableSous(feuille(arbre), 'U11 Filles'));
    const [, , boutons] = derniereAlerte();
    await act(async () => {
      boutons.find((/** @type {any} */ b) => b.style !== 'cancel').onPress();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(derniereAlerte()[1]).toBe('Ton enfant a déjà une équipe.');
  });

  it('l interet ADULTE (« Intéressé par le club ») ne porte aucun enfant', async () => {
    const arbre = monter();
    await appuyer(boutonDeLaFiche(arbre, 'Intéressé par le club'));
    await appuyer(pressableSous(feuille(arbre), 'U11 Filles'));
    const [titre, , boutons] = derniereAlerte();
    expect(titre).toBe('Envoyer ton intérêt ?');
    await act(async () => {
      boutons.find((/** @type {any} */ b) => b.style !== 'cancel').onPress();
      await Promise.resolve();
    });

    expect(createClubInterestRequest).toHaveBeenCalledWith({ team: 't-filles' });
  });
});
