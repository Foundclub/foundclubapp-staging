import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';
import ClubResultsBoard from '@/views/multisportClub/components/ClubResultsBoard';
import WeekendResultsCard from '@/views/multisportClub/components/WeekendResultsCard';

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
// ST-VUES3-ORDI — l'ecran 18 a une planche ORDINATEUR : le hub la montre quand la
// fenetre est large. Faux par defaut : les autres temoins restent sur le telephone.
let mockIsDesktop = false;
// ECRAN18-ENTETE — les droits du compte : l'encart « Offert par la Ville » ne s'affiche que si
// une Ville offre CE club. Vide par defaut : les autres temoins n'ont pas d'encart.
/** @type {any[]} */
let mockEntitlementsSummary = [];
// ST-VUES3-ORDI — la planche ordinateur du hub (`ClubResultsBoard`) lit le bilan de chaque
// équipe : ces deux services importent le client HTTP, qui refuse de se charger sans `API_URL`.
jest.mock('@/services/matchStats/matchStatsService', () => ({
  getTeamPerformanceStats: jest.fn(),
}));
jest.mock('@/services/stats/statsService', () => ({ getTeamStats: jest.fn() }));

jest.mock('@/responsive', () => ({
  ...jest.requireActual('@/responsive'),
  useIsDesktop: () => mockIsDesktop,
}));
/** @type {jest.Mock<any, any[]>} */
const mockWeekendQuery = jest.fn(() => ({
  data: undefined, error: null, isLoading: false, refetch: jest.fn(),
}));
const mockGetClubWeekendResults = jest.fn();
const mockRemindClubWeekendScore = jest.fn(() => Promise.resolve({
  alreadyRemindedCount: 0, remindedCount: 1, trainerCount: 1,
}));
const mockStartClubChat = jest.fn();

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
  // ST-VUES3-ORDI : « Les équipes » (planche ordinateur) lit le bilan de chaque equipe.
  useQueries: (/** @type {any} */ options) => (options?.queries || []).map(() => ({
    data: undefined, error: null, isLoading: false,
  })),
  // STATS-FIX2 · point 2 : la carte « Résultats du week-end » a sa propre lecture,
  // observee par `mockWeekendQuery` ; toutes les autres gardent la reponse vide.
  useQuery: (/** @type {any} */ options) => (
    options?.queryKey?.[0] === 'club-weekend-results'
      ? mockWeekendQuery(options)
      : { data: [], isLoading: false, refetch: jest.fn() }
  ),
  // LOT INSTANT (2026-08-27) — l'ecran demande desormais le cache pour
  // rafraichir « Demandes », « Accueil » et « Mes equipes » apres une demande
  // d'adhesion (`joinClub`). Sans cette doublure, le rendu jette.
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
}));

// Quelques cles sont appelees SANS repli : sans cette table, la doublure rendrait
// la cle brute et le libelle n'existerait pas a l'ecran. On ne recopie ici que
// celles-la, avec leur valeur reelle de `fr.js`.
const TRADUCTIONS_SANS_REPLI = {
  // D62 : sans cette ligne, `contactTrainers` rendait sa cle brute — et les
  // temoins qui figent sa DISPARITION du hub passaient a vide.
  'clubDetails.actions.contactTrainers': 'Contacter les entraîneur·e·s',
  'clubDetails.actions.editInfo': 'Modifier',
  'clubDetails.titles.activities': 'Sports',
  'clubDetails.titles.coachs': 'Entraîneurs',
  'clubDetails.titles.owners': 'Dirigeants',
  'clubDetails.titles.sponsors': 'Partenaires',
  'clubDetails.titles.teams': 'Équipes',
};

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
      const gabarit = (() => {
        if (typeof repli === 'string') return repli;
        if (repli && typeof repli.defaultValue === 'string') return repli.defaultValue;
        return TRADUCTIONS_SANS_REPLI[cle] || cle;
      })();

      // i18next remplace `{{x}}` par `options.x` : la doublure doit le faire
      // aussi, sinon les etiquettes d'accessibilite restent des gabarits.
      // ECRAN18-ENTETE : les options arrivent aussi en 3e argument, apres un repli
      // texte (`t(cle, 'Offert par {{who}}', { who })`), comme le permet i18next.
      const valeurs = repli && typeof repli === 'object' ? repli : options;
      if (!valeurs || typeof valeurs !== 'object') return gabarit;
      return gabarit.replace(
        /\{\{(\w+)\}\}/g,
        (/** @type {string} */ entier, /** @type {string} */ nom) => (
          valeurs[nom] === undefined ? entier : String(valeurs[nom])
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
    // `canEditClub` suit l'acces au club, comme dans le vrai `useAuth` : sans
    // ca, un joueur de passage passerait pour un dirigeant.
    canEditClub: (/** @type {string} */ id) => mockHasClubAccess(id),
    canJoinClub: () => false,
    clubs: [{ documentId: 'club-1' }],
    entitlementsSummary: mockEntitlementsSummary,
    getNextOnboardingRoute: () => null,
    getPostOnboardingHomeRoute: () => null,
    hasClubAccess: mockHasClubAccess,
    inviteTrainer: jest.fn(),
    // C3 : `isClubMember` repond vrai partout ou `hasClubAccess` repond vrai,
    // PLUS les clubs atteints par une equipe. Aucun profil de ce fichier n'a
    // d'equipe : les deux rendent donc exactement la meme chose ici, et la
    // doublure le dit plutot que de le supposer.
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

// D62 : la doublure rendait un `jest.fn()` NEUF a chaque appel — donc jamais
// observable. Elle porte desormais une fonction stable : c'est elle qui prouve
// que « Contacter les entraineur·e·s » ouvre toujours la conversation du club
// depuis son nouvel emplacement.
jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ startClubChat: mockStartClubChat }),
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
  getClubWeekendResults: (/** @type {any[]} */ ...args) => mockGetClubWeekendResults(...args),
  remindClubWeekendScore: (/** @type {any[]} */ ...args) => mockRemindClubWeekendScore(...args),
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

// VILLE-T18C (07/10) — les installations du contexte, reglables par temoin (club, Ville).
let mockInstallations = [];
jest.mock('@/services/facility/facilityQueries', () => ({
  useClubFacilityContext: () => ({
    data: { allFacilities: mockInstallations, cmId: null }, isLoading: false,
  }),
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

// R07 — la doublure RETIENT desormais les proprietes recues, en plus de ne rien
// rendre. Le defaut du clavier (point 3) est une question de PROPRIETE passee a
// la feuille, pas de texte affiche : sans cette collecte, il serait invisible.
// Elle n'change rien pour les tests deja en place — la doublure rend toujours
// `null`.
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
/**
 * Monte l'ecran du club.
 *
 * Sans argument : le HUB du dirigeant (D50). Avec un nom de sous-page : cette
 * sous-page. C'est le MEME ecran dans les deux cas — une sous-page s'atteint par
 * le parametre de route `section`, l'idiome que D34 avait deja pose ici pour le
 * planning plutot que d'ajouter une route.
 * @param {string} [section] - La sous-page a ouvrir ; absent = le hub.
 * @returns {any} L'arbre monte.
 */
const monter = (section) => {
  const route = section
    ? { ...mockRoute, params: { ...mockRoute.params, section } }
    : mockRoute;

  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <ClubDetails
        navigation={/** @type {any} */ (mockNavigation)}
        route={/** @type {any} */ (route)}
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
  mockInstallations = [];

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
    // D50 : les sous-pages du hub s'EMPILENT (`push`). C'est ce qui fait que le
    // retour ramene au hub au lieu de quitter le club.
    push: jest.fn(),
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
  // D50 : le nom reste sur la carte du hub ; les partenaires ont suivi leur
  // section dans la sous-page « Partenaires ». Les DEUX assertions d'origine
  // sont conservees, chacune la ou son contenu vit desormais.
  it('montre le nom du club et ses deux partenaires', () => {
    expect(texteDe(monter().root)).toContain('Stade Marseillais Université Club');

    const textes = texteDe(monter('partners').root);

    expect(textes).toContain('Elseve');
    expect(textes).toContain('Mr le bricolage');
  });

  it('montre chaque equipe avec sa meta REELLE, pas une meta recopiee', () => {
    const textes = texteDe(monter('teams').root);

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
    const arbre = monter('teams');

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
    const arbre = monter('partners');

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
    const arbre = monter('partners');

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

// Ce bloc-ci decrit ce que D34 AJOUTE : il ne passe donc pas sur la source
// d'origine, contrairement au bloc ci-dessus. Il est ici parce qu'un point
// d'entree de navigation casse en silence — rien d'autre ne le surveille.
describe('ClubDetails — ce que D34 ajoute a l espace du dirigeant', () => {
  it('ouvre le tunnel de creation d equipe depuis la section Equipes', () => {
    const arbre = monter('teams');

    act(() => {
      pressableAvecTexte(arbre, 'Créer une équipe').props.onPress();
    });

    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      'TeamStack',
      { params: { clubId: 'club-1' }, screen: 'TeamWizardName' },
    );
  });

  it('propose quand meme de creer une equipe a un club qui n en a aucune', () => {
    mockClubQuery.data = { ...CLUB, teams: [] };

    expect(pressableAvecTexte(monter('teams'), 'Créer une équipe')).toBeDefined();
  });

  it('ne propose PAS de creer une equipe a qui ne dirige pas le club', () => {
    mockHasClubAccess.mockReturnValue(false);
    mockUserData = { documentId: 'u-9', role: { name: 'player' }, trainedTeams: [] };

    expect(pressableAvecTexte(monter(), 'Créer une équipe')).toBeUndefined();
  });
});

// D50 : la page-fleuve du dirigeant devient un hub a rangees. Ce bloc-ci
// surveille ce que le hub AJOUTE ; le bloc du dessus continue de surveiller que
// rien ne s'est perdu en chemin — les comportements ont demenage, aucun n'a
// disparu.
describe('ClubDetails — D50 : « Mon club » est un hub, plus une page-fleuve', () => {
  it('montre les 5 rangees a gerer, chacune avec son VRAI compteur', () => {
    const arbre = monter();

    // Les compteurs se lisent sur la fixture, jamais sur une valeur ecrite en
    // dur : 0 installation, 1 sport, 2 partenaires, 2 equipes. Le staff se
    // compte sur `club.members` filtre par role — que cette fixture n'a pas —,
    // et non sur `club.owner` : il annonce donc zero des deux cotes.
    expect(pressableAvecTexte(arbre, 'Installations, 0')).toBeDefined();
    expect(pressableAvecTexte(arbre, 'Sports, 1')).toBeDefined();
    expect(pressableAvecTexte(arbre, 'Partenaires, 2')).toBeDefined();
    expect(pressableAvecTexte(arbre, 'Équipes, 2')).toBeDefined();
    expect(pressableAvecTexte(arbre, 'Staff, 0 dirigeant · 0 entraîneur')).toBeDefined();
  });

  it('suit le club quand il change : les compteurs ne sont pas ecrits en dur', () => {
    mockClubQuery.data = {
      ...CLUB,
      activites: [],
      members: [
        { documentId: 'u-1', role: { name: 'president' } },
        { documentId: 'u-2', role: { name: 'coach' } },
        { documentId: 'u-3', role: { name: 'coach' } },
      ],
      sponsor: [],
      teams: [CLUB.teams[0]],
    };

    const arbre = monter();

    expect(pressableAvecTexte(arbre, 'Sports, 0')).toBeDefined();
    expect(pressableAvecTexte(arbre, 'Partenaires, 0')).toBeDefined();
    expect(pressableAvecTexte(arbre, 'Équipes, 1')).toBeDefined();
    expect(pressableAvecTexte(arbre, 'Staff, 1 dirigeant · 2 entraîneurs')).toBeDefined();
  });

  it('chaque rangee ouvre SA sous-page, EMPILEE pour que le retour ramene au hub', () => {
    const arbre = monter();
    const ouvrir = (/** @type {string} */ libelle) => {
      act(() => {
        pressableAvecTexte(arbre, libelle).props.onPress();
      });
    };

    ouvrir('Sports, 1');
    ouvrir('Partenaires, 2');
    ouvrir('Équipes, 2');
    ouvrir('Staff, 0 dirigeant · 0 entraîneur');

    expect(/** @type {any} */ (mockNavigation.push).mock.calls.map(
      (/** @type {any} */ appel) => appel[1].section,
    )).toEqual(['sports', 'partners', 'teams', 'staff']);
  });

  it('et la sous-page ouverte ne montre QUE sa section', () => {
    const textes = texteDe(monter('teams').root);

    expect(textes).toContain('U15 Filles');
    expect(textes).not.toContain('Elseve');
  });

  // Une sous-page est UNE rubrique du club, pas le club : elle ne rejoue ni sa
  // carte d'identite, ni son affiche, ni la sortie du club.
  it('une sous-page ne rejoue ni la carte du club, ni l affiche, ni « Quitter le club »', () => {
    const arbre = monter('teams');

    expect(texteDe(arbre.root)).not.toContain('Rejoindre le club');
    expect(pressableAvecTexte(arbre, 'Quitter le club')).toBeUndefined();
    expect(pressableAvecTexte(arbre, 'Modifier')).toBeUndefined();
  });

  // L'ecran de planning du club n'a AUCUNE route a lui : on n'y entrait que par
  // l'onglet que ce lot retire. Cette rangee est donc le chemin qui le garde
  // atteignable — `FacilityList` est le seul endroit d'ou « Voir le planning »
  // sait revenir ici. Si elle casse, le planning devient inatteignable en
  // silence.
  it('la rangee Installations ouvre l ecran deja route, d ou l on rejoint le planning', () => {
    const arbre = monter();

    act(() => {
      pressableAvecTexte(arbre, 'Installations, 0').props.onPress();
    });

    expect(mockNavigation.navigate).toHaveBeenCalledWith(
      'FacilityList',
      expect.objectContaining({ clubId: 'club-1' }),
    );
  });

  it('la rangee Adhesions montre le reglage REEL du club', () => {
    mockClubQuery.data = { ...CLUB, membershipRequestManagementMode: 'CLUB_OWNER_ONLY' };

    expect(pressableAvecTexte(monter(), "Demandes d'adhésion, Dirigeant")).toBeDefined();
  });

  it('et retombe sur la delegation quand le club n a rien enregistre, comme le formulaire', () => {
    expect(pressableAvecTexte(monter(), "Demandes d'adhésion, Délégation")).toBeDefined();
  });

  it('le hub ne deroule plus les sections sous la carte du club', () => {
    const textes = texteDe(monter().root);

    expect(textes).not.toContain('U15 Filles');
    expect(textes).not.toContain('Elseve');
    expect(textes).not.toContain('Handball');
  });

  it('« Quitter le club » reste tout en bas du hub, avec sa confirmation', () => {
    const arbre = monter();

    expect(pressableAvecTexte(arbre, 'Quitter le club')).toBeDefined();

    act(() => {
      pressableAvecTexte(arbre, 'Quitter le club').props.onPress();
    });

    expect(Alert.alert).toHaveBeenCalled();
    expect(leaveClub).not.toHaveBeenCalled();
  });

  // Le pack ne decrit QUE l'espace du dirigeant. La page publique d'un club
  // n'est pas un hub de gestion : elle doit continuer de tout derouler.
  it('un visiteur garde la page complete du club', () => {
    mockHasClubAccess.mockReturnValue(false);
    mockUserData = { documentId: 'u-9', role: { name: 'player' }, trainedTeams: [] };

    const textes = texteDe(monter().root);

    expect(textes).toContain('U15 Filles');
    expect(textes).toContain('Elseve');
  });
});

// ---------------------------------------------------------------------------
// D62 — les deux retours de recette d'Adel du 2026-08-09, sur l'emulateur.
// ---------------------------------------------------------------------------

describe('ClubDetails — D62 : « Contacter les entraineur·e·s » quitte le pied du hub', () => {
  // Le bouton etait rendu HORS de la ScrollView, colle en bas et pleine largeur :
  // sur la capture d'Adel, il recouvrait la 5e rangee « Staff ». Il ne disparait
  // pas pour autant — `startClubChat` n'a AUCUN autre appelant dans l'app, donc
  // le supprimer rendrait la conversation du club impossible a ouvrir.
  const AVEC_ENTRAINEURS = {
    ...CLUB,
    members: [
      {
        documentId: 'u-1', firstname: 'Philippe', lastname: 'Courtoi', role: { name: 'president' },
      },
      {
        documentId: 'u-7', firstname: 'Nadia', lastname: 'Berger', role: { name: 'coach' },
      },
    ],
  };

  it('ne le colle plus au bas du hub, meme quand le club a des entraineur·e·s', () => {
    mockClubQuery.data = AVEC_ENTRAINEURS;

    expect(pressableAvecTexte(monter(), 'Contacter les entraîneur·e·s')).toBeUndefined();
  });

  it('mais l offre dans la sous-page Staff, avec les entraineur·e·s qu il contacte', () => {
    mockClubQuery.data = AVEC_ENTRAINEURS;

    const arbre = monter('staff');

    expect(texteDe(arbre.root)).toContain('Nadia');
    expect(pressableAvecTexte(arbre, 'Contacter les entraîneur·e·s')).toBeDefined();
  });

  it('et depuis la, il ouvre toujours la conversation du club', async () => {
    mockClubQuery.data = AVEC_ENTRAINEURS;
    mockStartClubChat.mockResolvedValue({ documentId: 'chat-42' });

    const arbre = monter('staff');

    await act(async () => {
      await pressableAvecTexte(arbre, 'Contacter les entraîneur·e·s').props.onPress();
    });

    expect(mockStartClubChat).toHaveBeenCalledWith('club-1');
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Conversation', { chatId: 'chat-42' });
  });

  it('ne l offre nulle part a un club sans entraineur·e', () => {
    expect(pressableAvecTexte(monter(), 'Contacter les entraîneur·e·s')).toBeUndefined();
    expect(pressableAvecTexte(monter('staff'), 'Contacter les entraîneur·e·s')).toBeUndefined();
  });
});

describe('ClubDetails — D62 : les equipes portent le meme ecusson que partout ailleurs', () => {
  // Adel : « manque de coherence avec l'affichage du logo des equipes avec le
  // reste de l'app ». Mesure : la liste « Mes equipes » (TeamListContent) rend
  // ses equipes par `ClubLogoMark` — le VRAI logo quand le club en a un, l'ecusson
  // a initiales sinon — pendant que les rangees d'equipe de cet ecran rendaient
  // `TeamShield` en direct, donc des initiales grises MEME quand un logo existe.
  // Ce temoin fige le composant partage, pas un dessin.
  const ecussons = (/** @type {any} */ arbre) => arbre.root.findAllByType(ClubLogoMark);

  it('la sous-page Equipes rend un ecusson partage par equipe, jamais un dessin a la main', () => {
    const rendus = ecussons(monter('teams'));

    expect(rendus).toHaveLength(CLUB.teams.length);
  });

  it('et cet ecusson recoit le club, donc il affiche son logo quand il y en a un', () => {
    mockClubQuery.data = { ...CLUB, logo: { url: '/uploads/smuc.png' } };

    const [premier] = ecussons(monter('teams'));

    expect(premier.props.club?.logo?.url).toBe('/uploads/smuc.png');
    expect(premier.props.name).toBe('Stade Marseillais Université Club');
  });
});

// R07 point 3 — LE CLAVIER NE DOIT PLUS CACHER CE QU'ON ECRIT.
//
// Constat d'Adel du 2026-08-13, sur la feuille « Ce club n'a pas encore
// d'equipe » : « le clavier passe devant l'ecran, on ne voit pas ce qu'on
// ecrit ». Ses deux champs « coach » sont en BAS du contenu — ce sont eux que
// le clavier recouvre.
//
// La cause est connue et deja documentee par D31 (`SelfProfileUnified.js`) :
// `@gorhom/bottom-sheet` refuse de deplacer la feuille quand la plateforme est
// Android ET le mode `adjustResize`, et `adjustResize` n'agit plus depuis
// qu'Android 15 impose le bord-a-bord. Le correctif est UNE propriete.
//
// ⚠️ Comme en D19/D86 : Jest ne mesure aucun pixel et ne simule aucun clavier.
// Ce filet lit la PROPRIETE passee a la feuille — c'est-a-dire exactement la
// chose qui manquait. Le rendu, lui, se constate sur un telephone Android.
describe('R07 — la feuille du club sans equipe remonte au-dessus du clavier', () => {
  /**
   * Le texte porte par un element React non rendu (ici `headerComponent`).
   * @param {any} element L'element.
   * @returns {string} Son texte.
   */
  const texteDeLElement = (element) => {
    if (element === null || element === undefined || typeof element === 'boolean') return '';
    if (typeof element === 'string' || typeof element === 'number') return String(element);
    if (Array.isArray(element)) return element.map(texteDeLElement).join(' ');
    return texteDeLElement(element.props?.children);
  };

  /**
   * La feuille dont l'entete parle du club sans equipe.
   * @returns {any} Ses proprietes.
   */
  const feuilleDuClubSansEquipe = () => {
    mockFeuillesRendues.length = 0;
    monter();
    return mockFeuillesRendues.find(
      (props) => texteDeLElement(props?.headerComponent).includes('pas encore d’équipe'),
    );
  };

  it('LE TEMOIN : elle demande `adjustPan`, le seul mode qui la remonte sur Android', () => {
    const feuille = feuilleDuClubSansEquipe();

    expect(feuille).toBeDefined();
    // `adjustResize` est le defaut de `BottomModal`, et c'est LUI qui laissait
    // le clavier passer devant : la bibliotheque ne bouge pas la feuille dans
    // ce mode, et Android 15 ne redimensionne plus la fenetre a sa place.
    expect(feuille.androidKeyboardInputMode).toBe('adjustPan');
  });

  it('le bouton d envoi reste atteignable : il defile avec le contenu', () => {
    const feuille = feuilleDuClubSansEquipe();

    // Il n'est PAS dans un pied colle : il vit dans le contenu defilant, donc
    // un doigt peut toujours aller le chercher clavier ouvert. `BottomModal`
    // pose `keyboardShouldPersistTaps="handled"` sur cette zone, si bien que
    // l'appui n'est pas avale par la fermeture du clavier.
    expect(feuille.footerComponent).toBeUndefined();
    expect(feuille.scrollable).toBe(true);
  });

  it('elle garde sa hauteur fixe : la remontee ne doit pas la faire deborder', () => {
    const feuille = feuilleDuClubSansEquipe();

    // Acquis D19/D86 : sans `snapPoints`, la zone defilante est plafonnee a
    // 70 % de l'ECRAN et ce qui vient en dernier sort par le bas.
    expect(Array.isArray(feuille.snapPoints)).toBe(true);
    expect(feuille.snapPoints.length).toBeGreaterThan(0);
  });
});

// LOT RÔLES (2026-09-28) — la porte de l'écran « Membres et rôles ». Sans
// elle, l'écran existe et personne n'y arrive (famille 🚪 de §2 quinquies).
describe('ClubDetails — RÔLES : la rangée « Membres et rôles » du hub', () => {
  it('le hub du dirigeant ouvre l écran des rôles de CE club', () => {
    const arbre = monter();
    const rangee = pressableAvecTexte(arbre, 'Membres et rôles, Attribuer');

    expect(rangee).toBeDefined();
    act(() => {
      rangee.props.onPress();
    });
    expect(mockNavigation.navigate).toHaveBeenCalledWith('ClubMemberRoles', { clubId: 'club-1' });
  });
});

// ROLES2 (recette émulateur du 2026-09-28) — « Staff : 1 dirigeant · 0 entraîneur »
// alors qu'il entraîne les DEUX équipes du club. Le compteur ne comptait comme
// entraîneurs que les comptes dont le rôle global est Entraîneur. Il compte
// désormais ceux qui entraînent une équipe du club (sans doublon, sans compte
// supprimé), plus les comptes Entraîneur.
describe('ClubDetails — ROLES2 — « Staff » compte ceux qui entraînent vraiment', () => {
  it('un dirigeant qui entraîne les deux équipes compte comme 1 dirigeant ET 1 entraîneur', () => {
    mockClubQuery.data = {
      ...CLUB,
      members: [{ documentId: 'u-1', role: { name: 'president' } }],
      teams: CLUB.teams.map((equipe) => ({ ...equipe, trainers: [{ documentId: 'u-1' }] })),
    };

    expect(pressableAvecTexte(monter(), 'Staff, 1 dirigeant · 1 entraîneur')).toBeDefined();
  });

  it('un Entraîneur qui entraîne compte une fois ; un compte supprimé jamais', () => {
    mockClubQuery.data = {
      ...CLUB,
      members: [
        { documentId: 'u-1', role: { name: 'president' } },
        { documentId: 'u-2', role: { name: 'coach' } },
      ],
      teams: [
        { ...CLUB.teams[0], trainers: [{ documentId: 'u-2' }] },
        {
          ...CLUB.teams[1],
          trainers: [
            { documentId: 'u-3' },
            {
              blocked: true, documentId: 'u-4', email: 'x@deleted.com', username: 'deleted_user_4',
            },
          ],
        },
      ],
    };

    expect(pressableAvecTexte(monter(), 'Staff, 1 dirigeant · 2 entraîneurs')).toBeDefined();
  });
});

// STATS-FIX2 · POINT 2 (tournee T10, ecran 18) — « RESULTATS DU WEEK-END » POUR UN CLUB SIMPLE.
// La carte n existait que dans `CMDashboard` (club omnisport) : le dirigeant d un club simple
// comme AS Montrivage (celui de la planche 18) n y avait aucune porte. Elle entre dans son hub
// « Gérer mon club », lue par la route du club simple (admin STATS-FIX2 :
// GET /clubs/:id/weekend-results, policy is-club-manager, droit du seul Dirigeant).
describe('STATS-FIX2 · point 2 — « Résultats du week-end » dans le hub d un club simple', () => {
  const WEEKEND = {
    nextMatch: null,
    rows: [
      {
        canRemind: false,
        date: '2026-09-05T17:00:00.000Z',
        eventId: 'e1',
        opponentName: 'Test-COMPO',
        result: 'win',
        scoreAgainst: 1,
        scoreFor: 2,
        sport: 'Football',
        status: 'scored',
        teamId: 't-1',
        teamName: 'U15 Filles',
        trainers: [{ documentId: 'u-1', firstname: 'Philippe' }],
        viewerIsTrainer: true,
      },
      {
        canRemind: true,
        date: '2026-09-05T19:00:00.000Z',
        eventId: 'e2',
        opponentName: null,
        result: null,
        scoreAgainst: null,
        scoreFor: null,
        sport: 'Football',
        status: 'missing',
        teamId: 't-2',
        teamName: 'Seniors A',
        trainers: [{ documentId: 'u-3', firstname: 'Karim' }],
        viewerIsTrainer: false,
      },
    ],
    teamCount: 2,
    teamsWithoutMatchScores: [],
    weekend: {
      endAt: '2026-09-06T22:00:00.000Z',
      saturday: '2026-09-05',
      startAt: '2026-09-04T22:00:00.000Z',
      sunday: '2026-09-06',
    },
  };

  beforeEach(() => {
    mockWeekendQuery.mockImplementation(() => ({
      data: WEEKEND, error: null, isLoading: false, refetch: jest.fn(),
    }));
  });

  it('🔴 le hub du dirigeant porte la carte, lue par la route DU club', () => {
    const arbre = monter();

    expect(texteDe(arbre.root)).toContain('Résultats du week-end');
    expect(texteDe(arbre.root)).toContain('2 - 1');
    const [options] = mockWeekendQuery.mock.calls[mockWeekendQuery.mock.calls.length - 1];
    expect(options.queryKey).toEqual(['club-weekend-results', 'club-1']);
    expect(options.enabled).toBe(true);
    options.queryFn();
    expect(mockGetClubWeekendResults).toHaveBeenCalledWith('club-1');
  });

  it('🔴 « Relancer » demande le score par la route du club, et la ligne le dit', async () => {
    const arbre = monter();

    await act(async () => {
      pressableAvecTexte(arbre, 'Relancer').props.onPress();
    });
    expect(mockRemindClubWeekendScore)
      .toHaveBeenCalledWith('club-1', { eventId: 'e2', teamId: 't-2' });
    expect(texteDe(arbre.root)).toContain('Relancé');
  });

  it('🔴 un match de la carte s ouvre', () => {
    const arbre = monter();
    const ligne = pressableAvecTexte(arbre, 'U15 Filles — Test-COMPO');

    act(() => {
      ligne.props.onPress();
    });
    expect(mockNavigation.navigate).toHaveBeenCalledWith('EventStack', {
      params: { eventId: 'e1' },
      screen: 'EventDetails',
    });
  });

  it('🔒 un joueur de passage : ni carte, ni lecture', () => {
    mockHasClubAccess.mockReturnValue(false);
    mockUserData = { documentId: 'u-9', role: { name: 'player' }, trainedTeams: [] };
    const arbre = monter();

    expect(texteDe(arbre.root)).not.toContain('Résultats du week-end');
    expect(mockWeekendQuery.mock.calls.every(([options]) => options.enabled === false)).toBe(true);
  });

  it('🔒 une sous-page du hub : pas de carte (elle vit sur le hub seul)', () => {
    expect(texteDe(monter('teams').root)).not.toContain('Résultats du week-end');
  });
});

// ST-VUES3-ORDI (03/10) — ÉCRAN 18 SUR ORDINATEUR : la planche « Le club du dirigeant —
// ordinateur » (P5-club-ordi) met « Résultats du week-end » en TABLEAU à gauche, et à
// droite les trois chiffres qui se touchent, puis « Les équipes » et le lien vers leurs
// stats. Avant ce lot, le site ne montrait que la carte du téléphone, seule.
describe('ST-VUES3-ORDI · écran 18 — la planche ordinateur du hub d un club simple', () => {
  const WEEKEND = {
    nextMatch: null,
    rows: [],
    teamCount: 2,
    teamsWithoutMatchScores: [],
    weekend: { saturday: '2026-09-05', sunday: '2026-09-06' },
  };
  const planche = (/** @type {any} */ arbre) => arbre.root.findAllByType(ClubResultsBoard);

  beforeEach(() => {
    mockWeekendQuery.mockImplementation(() => ({
      data: WEEKEND, error: null, isLoading: false, refetch: jest.fn(),
    }));
  });
  afterEach(() => {
    mockIsDesktop = false;
  });

  it('🔴 sur ordinateur, le hub porte la planche : le tableau, les chiffres, les équipes', () => {
    mockIsDesktop = true;
    mockClubQuery.data = {
      ...CLUB,
      membersCount: 9,
      teams: CLUB.teams.map((team, index) => ({
        ...team,
        activities: [{ name: index === 0 ? 'Football' : 'Arts martiaux' }],
      })),
    };
    const arbre = monter();

    const [board] = planche(arbre);
    expect(board).toBeDefined();
    expect(board.props.weekendCard.data).toBe(WEEKEND);
    expect(arbre.root.findAllByType(WeekendResultsCard)).toHaveLength(1);
    expect(arbre.root.findByType(WeekendResultsCard).props.variant).toBe('table');
    // FINITIONS16 22 (T15, écran 18) : « Sections · Équipes · Membres », comme la planche P5. La
    // doublure de traduction de ce témoin rendait « Équipes » pour `clubDetails.titles.teams`,
    // dont la vraie valeur est « Nos équipes » : le défaut passait inaperçu ici.
    expect(board.props.statsItems.map((/** @type {any} */ item) => [item.label, item.value]))
      .toEqual([['Sections', 1], ['Équipes', 2], ['Membres', 9]]);
    // Dans l'ordre des équipes du club (la catégorie d'âge, de la plus âgée à la plus jeune).
    expect(board.props.teams.map((/** @type {any} */ team) => [team.name, team.sport]))
      .toEqual([['Seniors A', 'Arts martiaux'], ['U15 Filles', 'Football']]);
  });

  it('🔴 les chiffres et les équipes mènent quelque part', () => {
    mockIsDesktop = true;
    const [board] = planche(monter());

    act(() => board.props.statsItems[1].onPress());
    expect(mockNavigation.push)
      .toHaveBeenCalledWith('Club', { clubId: 'club-1', section: 'teams' });
    act(() => board.props.statsItems[2].onPress());
    expect(mockNavigation.navigate).toHaveBeenCalledWith('ClubMemberRoles', { clubId: 'club-1' });
    act(() => board.props.onOpenTeamStats(board.props.teams[0]));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('TeamStack', {
      params: { initialTab: 'stats', teamId: 't-2' },
      screen: 'TeamDetails',
    });
  });

  it('📱 sur téléphone, rien ne change : la carte empilée, pas de planche', () => {
    const arbre = monter();

    expect(planche(arbre)).toHaveLength(0);
    expect(arbre.root.findByType(WeekendResultsCard).props.variant).toBeUndefined();
  });

  it('🔒 sur ordinateur aussi, un joueur de passage n a ni planche ni carte', () => {
    mockIsDesktop = true;
    mockHasClubAccess.mockReturnValue(false);
    mockUserData = { documentId: 'u-9', role: { name: 'player' }, trainedTeams: [] };
    const arbre = monter();

    expect(planche(arbre)).toHaveLength(0);
    expect(arbre.root.findAllByType(WeekendResultsCard)).toHaveLength(0);
  });
});

// ECRAN18-ENTETE (06/10) — décision d'Adel `entete compact`. Sur le site, à 1 280 px, le corps
// du hub suivait déjà la planche P5-club-ordi (2 colonnes), mais l'en-tête restait la grande
// carte du téléphone (écusson centré, nom en capitales, certification, adresse, encart de la
// Ville) suivie du grand bouton de l'affiche : près de la moitié de l'écran avant les résultats.
// La planche veut UNE ligne : l'écusson, « Gestion du club », le nom, les sports. Même bascule
// que les 2 colonnes (le hub du dirigeant + `useIsDesktop`) ; le téléphone garde sa carte.
// Rien n'est perdu : « Modifier », l'encart de la Ville et l'affiche restent dans l'en-tête.
describe('ECRAN18-ENTETE · l en-tête compact de « Gérer mon club » sur ordinateur', () => {
  // Le droit Club qu'une Ville offre au club (même forme que le témoin COLL-C2C du bandeau).
  const DROIT_OFFERT = {
    capability: '*',
    offeredBy: { documentId: 'ville-montrivage', name: 'Ville de Montrivage' },
    paidBy: null,
    scopeClubDocumentId: 'club-1',
    scopeClubName: 'Stade Marseillais Université Club',
    scopeType: 'CLUB',
    status: 'active',
    subscriptionCurrentPeriodEnd: null,
    subscriptionPlanCode: 'fc_collectivite_club',
  };
  const enTete = (/** @type {any} */ arbre) => arbre.root
    .findAll((/** @type {any} */ noeud) => noeud.props?.testID === 'club-entete-compact');
  const tailles = (/** @type {any} */ noeud) => noeud.findAllByType(ClubLogoMark)
    .map((/** @type {any} */ ecusson) => ecusson.props.size);

  beforeEach(() => {
    mockEntitlementsSummary = [DROIT_OFFERT];
    mockClubQuery.data = {
      ...CLUB,
      activites: [
        { documentId: 'act-1', name: 'Football' },
        { documentId: 'act-2', name: 'Arts martiaux' },
      ],
    };
  });
  afterEach(() => {
    mockIsDesktop = false;
    mockEntitlementsSummary = [];
  });

  it('🔴 sur ordinateur, le hub porte la ligne de la planche : écusson, surtitre, nom', () => {
    mockIsDesktop = true;
    const arbre = monter();

    const [tete] = enTete(arbre);
    expect(tete).toBeDefined();
    const lus = texteDe(tete);
    expect(lus).toContain('Gestion du club');
    expect(lus).toContain('Stade Marseillais Université Club');
    expect(lus).toContain('Football · Arts martiaux');
    expect(tailles(tete)).toEqual([60]);
    // La grande carte du téléphone n'est plus là : plus d'écusson de 80, une seule ligne.
    expect(tailles(arbre.root).filter((taille) => taille === 80)).toHaveLength(0);
  });

  it('🔴 rien n est perdu : « Modifier », l encart de la Ville et l affiche y sont', () => {
    mockIsDesktop = true;
    const arbre = monter();
    const [tete] = enTete(arbre);
    expect(tete).toBeDefined();
    const dansLEnTete = { root: tete };

    act(() => pressableAvecTexte(dansLEnTete, 'Modifier').props.onPress());
    expect(mockNavigation.navigate).toHaveBeenCalledWith('ClubEditPage', { clubId: 'club-1' });

    act(() => pressableAvecTexte(dansLEnTete, 'Affiche — Rejoindre le club').props.onPress());
    expect(mockNavigation.navigate).toHaveBeenCalledWith('VisualShowcase', expect.objectContaining({
      subjectId: 'club-1', subjectType: 'club', template: 'affiche-club',
    }));

    const encart = pressableAvecTexte(dansLEnTete, 'Offert par la Ville de Montrivage');
    expect(encart.props.accessibilityLabel)
      .toBe('Offert par la Ville de Montrivage : voir ses installations');
    act(() => encart.props.onPress());
    expect(mockNavigation.navigate)
      .toHaveBeenCalledWith('FacilityList', expect.objectContaining({ clubId: 'club-1' }));

    // L'affiche ne se répète pas en grand bouton sous l'en-tête.
    expect(texteDe(arbre.root).split('Affiche — Rejoindre le club')).toHaveLength(2);
  });

  it('📱 au téléphone, rien ne change : la grande carte, la Ville, l affiche en grand', () => {
    const arbre = monter();

    expect(enTete(arbre)).toHaveLength(0);
    expect(tailles(arbre.root)).toEqual([80]);
    const lus = texteDe(arbre.root);
    expect(lus).not.toContain('Gestion du club');
    expect(lus).toContain('Voir les installations de la Ville');
    expect(lus).toContain('Affiche — Rejoindre le club');
    expect(pressableAvecTexte(arbre, 'Modifier')).toBeDefined();
  });

  it('🔒 sur ordinateur, la fiche d un club qu on ne dirige pas garde sa grande carte', () => {
    mockIsDesktop = true;
    mockHasClubAccess.mockReturnValue(false);
    mockUserData = { documentId: 'u-9', role: { name: 'player' }, trainedTeams: [] };
    const arbre = monter();

    expect(enTete(arbre)).toHaveLength(0);
    // La grande carte reste (les autres écussons sont ceux des équipes de la fiche).
    expect(tailles(arbre.root)).toContain(80);
  });

  it('🔒 sur ordinateur, une sous-page du hub n a ni la carte ni la ligne', () => {
    mockIsDesktop = true;
    const arbre = monter('teams');

    expect(enTete(arbre)).toHaveLength(0);
    expect(texteDe(arbre.root)).not.toContain('Gestion du club');
  });
});

// 🏟️ VILLE-T18C (07/10) — point 5, tournée T18 (D01a) : la rangée « Installations » disait « 5 »
// pour 1 installation du club et 4 de la Ville (planche 40, état 1 : « 1 + 3 de la Ville », lu
// « Installations : 1 au club et 3 de la Ville »). Les deux nombres se disent séparément, comme la
// liste des installations (TEXTES-COLLECTIVITES). Sans installation de la Ville : un seul nombre.
// ROUGE avant le lot.
describe('VILLE-T18C point 5 — « Installations » : celles du club, puis celles de la Ville', () => {
  const installation = (/** @type {string} */ id, /** @type {string} */ ownerType) => ({
    documentId: id,
    name: id,
    ownerName: ownerType === 'collectivite' ? 'Ville de Montrivage' : '',
    ownerType,
  });

  it('1 au club et 4 de la Ville : « 1 + 4 de la Ville », dit en entier au lecteur d’écran', () => {
    mockInstallations = [
      installation('salle-annexe', 'club'),
      installation('gymnase', 'collectivite'),
      installation('dojo', 'collectivite'),
      installation('stade', 'collectivite'),
      installation('t18', 'collectivite'),
    ];
    const rangee = pressableAvecTexte(monter(), 'Installations');
    expect(texteDe(rangee)).toContain('1 + 4 de la Ville');
    expect(rangee.props.accessibilityLabel).toBe('Installations, 1 au club et 4 de la Ville');
  });

  it('sans installation de la Ville : un seul nombre, comme avant', () => {
    mockInstallations = [installation('salle-annexe', 'club'), installation('terrain', 'club')];
    expect(pressableAvecTexte(monter(), 'Installations, 2')).toBeDefined();
  });
});
