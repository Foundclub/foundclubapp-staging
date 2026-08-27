import { Alert, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubLogoMark from '@/components/molecules/clubLogoMark/ClubLogoMark';

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
  useQuery: () => ({ data: [], isLoading: false, refetch: jest.fn() }),
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
    // `canEditClub` suit l'acces au club, comme dans le vrai `useAuth` : sans
    // ca, un joueur de passage passerait pour un dirigeant.
    canEditClub: (/** @type {string} */ id) => mockHasClubAccess(id),
    canJoinClub: () => false,
    clubs: [{ documentId: 'club-1' }],
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
