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
const NOE_SANS_AGE = {
  age: null, documentId: 'c-noe', firstname: 'Noé', lastname: 'Dubelloy', team: null,
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
//
// Ce bloc a tourne VERT sur le code de staging (commit b9d91164 de ce lot, 10/10). Huit de
// ses temoins decrivaient exactement ce que la recette PAR-009 / PAR-005 reprochait ; ils
// sont devenus les temoins des points 2 a 4 ci-dessous, et leur « avant » reste ecrit ici :
//   1. deux enfants : porte « Demander à rejoindre pour mes enfants », un bouton-prenom
//      par enfant (→ point 2 : « Demander une place pour un enfant », 3 etapes) ;
//   2. enfant puis equipe : confirmation par ALERTE systeme (→ recapitulatif dans la feuille) ;
//   3. un seul enfant admissible : SON prenom sur la porte, l'autre ABSENT de la feuille
//      (→ porte anonyme, tous les enfants visibles, le seul admissible coche et DIT) ;
//   4. chaque enfant avec une demande ici : la porte DISPARAIT (→ elle reste, ci-dessous) ;
//   5. tous les moins de 13 ans en equipe : ni porte ni phrase (→ la porte reste et explique) ;
//   6. venu de la fiche de Martin : `childDocumentId` IGNORE (→ point 3) ;
//   7. refus « deja en attente » : « Intérêt déjà envoyé. », libelle adulte (→ point 4) ;
//   8. refus « deja dans une equipe » : « Ton enfant a déjà une équipe. » (→ point 4).
// Restent ici les comportements qui ne bougent PAS.
// ───────────────────────────────────────────────────────────────────────────
describe('PAR-L4 caracterisation — ce qui ne bouge pas', () => {
  it('(4, apres) chaque enfant a deja une demande ici : la porte RESTE', () => {
    mockDemandes = [
      demandeEnAttente('t-filles', 'c-anissa'),
      demandeEnAttente('t-garcons', 'c-martin'),
    ];
    const arbre = monter();

    // AVANT : `toBeUndefined()` — la porte s'effacait sans un mot.
    expect(porteEnfant(arbre)).toBeDefined();
  });

  it('seulement un ado : pas de porte, une phrase (E17)', () => {
    mockEnfants = [LINA_ADO];
    const arbre = monter();

    expect(porteEnfant(arbre)).toBeUndefined();
    expect(texteDe(arbre.root)).toContain(
      'À partir de 13 ans, ton enfant fait sa demande lui-même depuis son propre compte.',
    );
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

// ───────────────────────────────────────────────────────────────────────────
// LES TEMOINS DU LOT (design parent E10 a E13, planche 5).
// ───────────────────────────────────────────────────────────────────────────

/**
 * Le pressable qui porte cette etiquette de test, ou undefined.
 * @param {any} racine - Le noeud de depart.
 * @param {string} testID - L'etiquette.
 * @returns {any} Le noeud.
 */
const parEtiquette = (racine, testID) => (racine
  ? racine
    .findAll((/** @type {any} */ noeud) => noeud.props?.testID === testID
      && typeof noeud.props?.onPress === 'function')
    // Le plus PROFOND : le pressable rendu (il porte `accessibilityState`), pas l'element appelant.
    .pop()
  : undefined);

/**
 * La rangee d'un enfant dans la feuille.
 * @param {any} arbre - L'arbre rendu.
 * @param {string} id - L'enfant.
 * @returns {any} Le noeud.
 */
const rangeeEnfant = (arbre, id) => parEtiquette(feuille(arbre), `demande-enfant-choix-${id}`);

/**
 * La rangee d'une equipe dans la feuille.
 * @param {any} arbre - L'arbre rendu.
 * @param {string} id - L'equipe.
 * @returns {any} Le noeud.
 */
const rangeeEquipe = (arbre, id) => parEtiquette(feuille(arbre), `demande-enfant-equipe-${id}`);

/**
 * Ouvre la feuille par la porte du parent.
 * @param {any} arbre - L'arbre rendu.
 * @returns {Promise<void>}
 */
const ouvrir = async (arbre) => {
  await appuyer(porteEnfant(arbre));
};

/**
 * Le bouton « suivant » de l'etape affichee.
 * @param {any} arbre - L'arbre rendu.
 * @returns {any} Le noeud.
 */
const suivant = (arbre) => pressableSous(feuille(arbre), 'Choisir l’équipe')
  || pressableSous(feuille(arbre), 'Continuer');

/**
 * Le bouton « Envoyer la demande » du recapitulatif.
 * @param {any} arbre - L'arbre rendu.
 * @returns {any} Le noeud.
 */
const envoyer = (arbre) => pressableSous(feuille(arbre), 'Envoyer la demande');

/**
 * Ouvre la feuille, choisit l'enfant, l'equipe, et arrive au recapitulatif.
 * @param {any} arbre - L'arbre rendu.
 * @param {string} enfant - L'enfant.
 * @param {string} equipe - L'equipe.
 * @returns {Promise<void>}
 */
const jusquAuRecapitulatif = async (arbre, enfant, equipe) => {
  await ouvrir(arbre);
  await appuyer(rangeeEnfant(arbre, enfant));
  await appuyer(suivant(arbre));
  await appuyer(rangeeEquipe(arbre, equipe));
  await appuyer(suivant(arbre));
};

describe('PAR-L4 point 2 — une feuille en 3 etapes : l enfant, l equipe, l envoi', () => {
  it('la porte dit « pour un enfant », la feuille demande « Pour quel enfant ? »', async () => {
    const arbre = monter();

    expect(texteDe(porteEnfant(arbre))).toBe('Demander une place pour un enfant');

    await ouvrir(arbre);
    const texte = texteDe(feuille(arbre));
    expect(texte).toContain('Demander une place');
    expect(texte).toContain('Étape 1/3');
    expect(texte).toContain('Pour quel enfant ?');
    expect(texteDe(rangeeEnfant(arbre, 'c-anissa'))).toContain('Anissa · 11 ans');
    expect(texteDe(rangeeEnfant(arbre, 'c-anissa'))).toContain('Pas encore d’équipe');
    expect(texteDe(rangeeEnfant(arbre, 'c-martin'))).toContain('Martin · 9 ans');
    // Rien n'est choisi : on ne passe pas a l'equipe.
    expect(suivant(arbre).props.disabled).toBe(true);
    // Aucune equipe n'est montree avant d'avoir choisi l'enfant.
    expect(rangeeEquipe(arbre, 't-filles')).toBeUndefined();
  });

  it('enfant, equipe, recapitulatif : la demande part sans alerte de confirmation', async () => {
    const arbre = monter();
    await ouvrir(arbre);
    await appuyer(rangeeEnfant(arbre, 'c-anissa'));
    expect(rangeeEnfant(arbre, 'c-anissa').props.accessibilityState).toMatchObject({
      checked: true,
    });
    await appuyer(suivant(arbre));

    // Etape 2 : l'enfant reste visible, et on peut le changer.
    let texte = texteDe(feuille(arbre));
    expect(texte).toContain('Étape 2/3');
    expect(texte).toContain('Pour Anissa (11 ans)');
    expect(parEtiquette(feuille(arbre), 'demande-enfant-changer')).toBeDefined();
    // Le nom de l'equipe en entier, et sa ligne de details.
    expect(texteDe(rangeeEquipe(arbre, 't-filles'))).toContain('U11 Filles');
    expect(texteDe(rangeeEquipe(arbre, 't-filles'))).toContain('Départemental');
    expect(suivant(arbre).props.disabled).toBe(true);

    await appuyer(rangeeEquipe(arbre, 't-filles'));
    await appuyer(suivant(arbre));

    // Etape 3 : le recapitulatif.
    texte = texteDe(feuille(arbre));
    expect(texte).toContain('Étape 3/3');
    expect(texte).toContain('Anissa Dubelloy, 11 ans');
    expect(texte).toContain('U11 Filles');
    expect(texte).toContain('FoundClub');
    expect(createClubInterestRequest).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();

    await appuyer(envoyer(arbre));

    expect(createClubInterestRequest).toHaveBeenCalledTimes(1);
    expect(createClubInterestRequest).toHaveBeenCalledWith({
      declaredChild: 'c-anissa',
      team: 't-filles',
    });
  });

  it('le resultat se dit avec l enfant et l equipe, et mene a SA fiche', async () => {
    const arbre = monter();
    await jusquAuRecapitulatif(arbre, 'c-anissa', 't-filles');
    await appuyer(envoyer(arbre));

    expect(feuille(arbre)).toBeUndefined();
    const [titre, message, boutons] = derniereAlerte();
    expect(titre).toBe('Demande envoyée');
    expect(message).toContain('Anissa');
    expect(message).toContain('U11 Filles');
    const voirSaFiche = boutons.find((/** @type {any} */ b) => b.text === 'Voir sa fiche');
    expect(voirSaFiche).toBeDefined();

    voirSaFiche.onPress();
    expect(mockNavigation.navigate).toHaveBeenCalledWith('ProfileStack', {
      params: { childDocumentId: 'c-anissa' },
      screen: 'MyChildren',
    });
  });

  it('« Retour » et « Changer » reviennent en arriere en gardant les choix', async () => {
    const arbre = monter();
    await jusquAuRecapitulatif(arbre, 'c-anissa', 't-filles');

    await appuyer(pressableSous(feuille(arbre), 'Retour'));
    expect(texteDe(feuille(arbre))).toContain('Étape 2/3');
    expect(rangeeEquipe(arbre, 't-filles').props.accessibilityState).toMatchObject({
      checked: true,
    });

    await appuyer(parEtiquette(feuille(arbre), 'demande-enfant-changer'));
    expect(texteDe(feuille(arbre))).toContain('Étape 1/3');
    expect(rangeeEnfant(arbre, 'c-anissa').props.accessibilityState).toMatchObject({
      checked: true,
    });
  });

  it('les enfants NON admissibles restent visibles, grises, avec leur raison', async () => {
    mockEnfants = [ANISSA, MARTIN_PLACE, LINA_ADO, NOE_SANS_AGE];
    const arbre = monter();
    await ouvrir(arbre);

    expect(texteDe(rangeeEnfant(arbre, 'c-martin'))).toContain('Déjà dans U11 Garçons');
    expect(rangeeEnfant(arbre, 'c-martin').props.disabled).toBe(true);
    expect(texteDe(rangeeEnfant(arbre, 'c-lina'))).toContain(
      'À partir de 13 ans, Lina fait sa demande depuis son propre compte.',
    );
    expect(rangeeEnfant(arbre, 'c-lina').props.disabled).toBe(true);
    expect(texteDe(rangeeEnfant(arbre, 'c-noe'))).toContain(
      'Âge inconnu : complète sa date de naissance',
    );
    expect(rangeeEnfant(arbre, 'c-noe').props.disabled).toBe(true);
    expect(rangeeEnfant(arbre, 'c-anissa').props.disabled).toBe(false);
  });

  it('un seul enfant admissible : il est choisi, et la feuille le DIT', async () => {
    mockEnfants = [ANISSA, MARTIN_PLACE];
    const arbre = monter();
    await ouvrir(arbre);

    expect(rangeeEnfant(arbre, 'c-anissa').props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(texteDe(feuille(arbre))).toContain(
      'Choix fait pour toi : Anissa, seul enfant qui peut demander une place ici.',
    );
    expect(suivant(arbre).props.disabled).toBeFalsy();
  });

  it('aucun enfant admissible : la porte RESTE, et la feuille explique', async () => {
    mockEnfants = [MARTIN_PLACE];
    const arbre = monter();

    expect(porteEnfant(arbre)).toBeDefined();
    await ouvrir(arbre);
    expect(texteDe(feuille(arbre))).toContain(
      'Aucun de tes enfants ne peut demander une place ici pour le moment.',
    );
    expect(texteDe(rangeeEnfant(arbre, 'c-martin'))).toContain('Déjà dans U11 Garçons');
    expect(suivant(arbre).props.disabled).toBe(true);
  });

  it('une demande en attente ici : l enfant reste choisissable, la PAIRE bloque', async () => {
    mockDemandes = [demandeEnAttente('t-filles', 'c-anissa')];
    const arbre = monter();

    // La porte ne s'efface plus : Anissa peut encore demander une autre equipe.
    expect(porteEnfant(arbre)).toBeDefined();
    await ouvrir(arbre);
    expect(texteDe(rangeeEnfant(arbre, 'c-anissa'))).toContain('1 demande en attente ici');
    expect(rangeeEnfant(arbre, 'c-anissa').props.disabled).toBe(false);

    await appuyer(rangeeEnfant(arbre, 'c-anissa'));
    await appuyer(suivant(arbre));
    expect(texteDe(rangeeEquipe(arbre, 't-filles'))).toContain(
      'Demande déjà envoyée pour Anissa',
    );
    expect(rangeeEquipe(arbre, 't-filles').props.disabled).toBe(true);
    expect(rangeeEquipe(arbre, 't-garcons').props.disabled).toBe(false);
  });

  it('jamais une demande partagee entre freres : celle d Anissa ne bloque pas Martin', async () => {
    mockDemandes = [demandeEnAttente('t-filles', 'c-anissa')];
    const arbre = monter();
    await ouvrir(arbre);
    await appuyer(rangeeEnfant(arbre, 'c-martin'));
    await appuyer(suivant(arbre));

    expect(rangeeEquipe(arbre, 't-filles').props.disabled).toBe(false);
    await appuyer(rangeeEquipe(arbre, 't-filles'));
    await appuyer(suivant(arbre));
    await appuyer(envoyer(arbre));

    expect(createClubInterestRequest).toHaveBeenCalledWith({
      declaredChild: 'c-martin',
      team: 't-filles',
    });
  });
});

describe('PAR-L4 point 3 — l enfant transmis depuis SA fiche', () => {
  it('venu de la fiche de Martin : la porte le nomme, la feuille l a deja coche', async () => {
    mockRoute = { params: { childDocumentId: 'c-martin', clubId: 'club-1' } };
    const arbre = monter();

    expect(texteDe(porteEnfant(arbre))).toBe('Demander une place pour Martin');
    await ouvrir(arbre);
    expect(rangeeEnfant(arbre, 'c-martin').props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(texteDe(feuille(arbre))).toContain(
      'Tu viens de la fiche de Martin : son nom est déjà coché.',
    );
    // Modifiable : on peut choisir Anissa a la place.
    await appuyer(rangeeEnfant(arbre, 'c-anissa'));
    expect(rangeeEnfant(arbre, 'c-anissa').props.accessibilityState).toMatchObject({
      checked: true,
    });
    expect(rangeeEnfant(arbre, 'c-martin').props.accessibilityState).toMatchObject({
      checked: false,
    });
  });

  it('un identifiant qui n est pas un de MES enfants est ignore', async () => {
    mockRoute = { params: { childDocumentId: 'c-inconnu', clubId: 'club-1' } };
    const arbre = monter();

    expect(texteDe(porteEnfant(arbre))).toBe('Demander une place pour un enfant');
    await ouvrir(arbre);
    expect(texteDe(feuille(arbre))).not.toContain('Tu viens de la fiche');
  });
});

describe('PAR-L4 point 4 — les erreurs nomment l enfant, dans la feuille', () => {
  /**
   * Envoie la demande d'Anissa pour U11 Filles, refusee avec ce message.
   * @param {string} message - Le message du serveur.
   * @returns {Promise<any>} L'arbre.
   */
  const envoyerRefuse = async (message) => {
    /** @type {any} */ (createClubInterestRequest).mockRejectedValue({
      response: { data: { error: { message } }, status: 400 },
    });
    const arbre = monter();
    await jusquAuRecapitulatif(arbre, 'c-anissa', 't-filles');
    await appuyer(envoyer(arbre));
    return arbre;
  };

  /**
   * Le texte de l'erreur affichee dans la feuille.
   * @param {any} arbre - L'arbre rendu.
   * @returns {string} Le texte.
   */
  const erreurDeLaFeuille = (arbre) => texteDe(
    feuille(arbre)
      .findAll((/** @type {any} */ n) => n.props?.testID === 'demande-enfant-erreur')[0],
  );

  it('doublon : « Une demande pour Anissa est deja en attente dans U11 Filles. »', async () => {
    const arbre = await envoyerRefuse('A request is already pending');

    expect(Alert.alert).not.toHaveBeenCalled();
    expect(feuille(arbre)).toBeDefined();
    expect(texteDe(feuille(arbre))).toContain('Étape 3/3');
    expect(erreurDeLaFeuille(arbre)).toBe(
      'Une demande pour Anissa est déjà en attente dans U11 Filles.',
    );
  });

  it('deja placee : « Anissa a deja une equipe. »', async () => {
    const arbre = await envoyerRefuse('This child already belongs to a team');
    expect(erreurDeLaFeuille(arbre)).toBe('Anissa a déjà une équipe.');
  });

  it('trop grande : la regle des 13 ans, avec son prenom', async () => {
    const arbre = await envoyerRefuse('Team places are reserved to children under 13');
    expect(erreurDeLaFeuille(arbre)).toBe(
      'À partir de 13 ans, Anissa fait sa demande depuis son propre compte.',
    );
  });

  it('erreur inconnue : le prenom reste dans la phrase', async () => {
    const arbre = await envoyerRefuse('boom');
    expect(erreurDeLaFeuille(arbre)).toBe(
      'Impossible d’envoyer la demande pour Anissa pour le moment.',
    );
  });
});

// ───────────────────────────────────────────────────────────────────────────
// PARENT-FINITIONS 2 (14/10) — LA LIGNE D'AIDE DU DESIGN E10, laissee PARTIELLE par PAR-L4.
// Sous la porte de la place (« Demander une place pour un enfant »), la porte de l'ADULTE
// (« Intéressé par le club ») porte une ligne p3 : « Pour toi : une prise de contact avec le
// club. » — deux portes cote a cote, et le parent doit savoir laquelle est pour lui.
// Sans enfant, il n'y a qu'une porte : rien a distinguer, la ligne n'a pas lieu d'etre.
// ───────────────────────────────────────────────────────────────────────────
describe('PARENT-FINITIONS 2 — la ligne d aide sous « Intéressé par le club » (E10)', () => {
  const AIDE = 'Pour toi : une prise de contact avec le club.';

  it('un parent : la ligne d aide est la, SOUS la porte de l adulte', () => {
    const arbre = monter();
    const texte = texteDe(arbre.root);

    expect(porteEnfant(arbre)).toBeDefined();
    expect(texte).toContain(AIDE);
    expect(texte.indexOf(AIDE)).toBeGreaterThan(texte.indexOf('Intéressé par le club'));
    expect(texte.indexOf('Intéressé par le club'))
      .toBeGreaterThan(texte.indexOf('Demander une place pour un enfant'));
  });

  it('sans enfant : une seule porte, pas de ligne d aide', () => {
    mockEnfants = [];
    const arbre = monter();
    const texte = texteDe(arbre.root);

    expect(porteEnfant(arbre)).toBeUndefined();
    expect(texte).toContain('Intéressé par le club');
    expect(texte).not.toContain(AIDE);
  });
});
