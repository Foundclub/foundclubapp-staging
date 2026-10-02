import renderer, { act } from 'react-test-renderer';

import TeamDetails from '../TeamDetails';

// FINITIONS2 (recette emulateur, relais du 28/09 17:05:45) —
// `GET /api/teams/:id/performance-stats -> 400`, sur la fiche d'une equipe.
//
// 🔎 Le serveur (admin, `team.getPerformanceStats` -> `getTeamPerformanceStats`)
// repond 400 « Unsupported team sport for performance stats » a toute equipe
// dont la PREMIERE activite n'est ni du foot ni du basket (handball, volley,
// futsal…) : il n'a pas de statistiques de match pour ce sport. La reponse est
// donc connue d'avance, et l'app la demandait quand meme.
//
// 🧨 Meme famille que `my-match-response` (lot FINITIONS, 28/09) : la requete
// etait fermee aux non-membres (`enabled`), mais le RETOUR sur la fiche
// (`useFocusEffect`) appelait `refetch()` a la main — et `refetch` passe outre
// `enabled`. Un non-membre recoltait donc des 403 (presences ET performances),
// un membre d'une equipe de handball un 400.
//
// Ce que ce temoin fige : une seule porte par requete, lue par la requete ET
// par le retour sur l'ecran. Le harnais est celui de VA1 (memes doublures).

const CLUB = { documentId: 'club-1', name: 'FC Test' };

const ENTRAINEUR = { documentId: 'moi', firstname: 'Ada', lastname: 'L' };

const EQUIPE_FOOT = {
  activities: [{ documentId: 'sport-1', name: 'Football' }],
  category: { documentId: 'categorie-1', name: 'U15' },
  club: CLUB,
  documentId: 'equipe-1',
  name: 'Seniors A',
  players: [{ documentId: 'joueuse-1', firstname: 'Bo', lastname: 'M' }],
  trainers: [ENTRAINEUR],
};

const EQUIPE_HAND = {
  ...EQUIPE_FOOT,
  activities: [{ documentId: 'sport-2', name: 'Handball' }],
};

const UTILISATEUR = {
  club: CLUB,
  documentId: 'moi',
  myTeams: [{ documentId: 'equipe-1' }],
  role: { name: 'Dirigeant' },
  teamMembershipRequests: [],
  trainedTeams: [],
};

// ⚠️ Chaque doublure de requete rend TOUJOURS LE MEME OBJET (piege VA1 / R03).
const enveloppe = (/** @type {any} */ donnees, /** @type {any} */ refetch = jest.fn()) => ({
  data: donnees,
  error: null,
  isFetching: false,
  isLoading: false,
  refetch,
});

const mockRefetchPresences = jest.fn();
const mockRefetchPerformances = jest.fn();
const mockReponseFoot = enveloppe(EQUIPE_FOOT);
const mockReponseHand = enveloppe(EQUIPE_HAND);
const mockReponseClub = enveloppe(CLUB);
const mockReponseStats = enveloppe(null, mockRefetchPresences);
const mockReponsePerf = enveloppe(null, mockRefetchPerformances);

let mockReponseEquipeCourante = mockReponseFoot;
/** @type {any[]} */
const mockOptionsPresences = [];
/** @type {any[]} */
const mockOptionsPerformances = [];
// Tous les rappels que la fiche confie a useFocusEffect (elle en pose plusieurs).
/** @type {Set<Function>} */
const mockRetoursSurLaFiche = new Set();

// STATS-ENQUETE (defaut 3) — dirigeant du club de l'equipe, ou pas : le serveur ouvre les stats
// d'equipe au dirigeant de son club depuis le 21/09 (decision d'Adel « go a », SENTRY-1).
let mockDirigeantDuClub = true;

const AUTH_DIRIGEANT = Object.freeze({
  canEditClub: () => mockDirigeantDuClub,
  canJoinTeam: () => false,
  canManageTeam: true,
  entitlementsSummary: [],
  getNextOnboardingRoute: () => null,
  getPostOnboardingHomeRoute: () => null,
  inviteTeamPlayers: jest.fn(),
  refetchUserData: jest.fn(),
  subscriptionAccessLevel: 'none',
  USER_ROLES: { admin: 'Dirigeant', coach: 'Entraineur', player: 'Joueur' },
  userData: UTILISATEUR,
});

const mockAuth = AUTH_DIRIGEANT;
let mockEstMonEquipe = true;

// INVIT2 — la feuille d'invitation (views/team/invite/TeamInviteSheet.js) lit et
// ecrit par ces trois modules, qui atteignent le client HTTP (`.env` absent des
// worktrees). Doublures ecrites EN ENTIER, sans requireActual.
jest.mock('@/services/teamInvite/teamInviteQueries', () => ({
  useSentTeamInvites: () => ({ data: [], refetch: jest.fn() }),
  useTeamInviteSuggestions: () => ({ data: undefined, refetch: jest.fn() }),
}));
jest.mock('@/services/teamInvite/teamInviteService', () => ({
  cancelTeamInvite: jest.fn(),
  createTeamInviteLink: jest.fn(),
  createTeamPhoneInvite: jest.fn(),
}));
jest.mock('react-native-qrcode-svg', () => function QRCodeMock() {
  return null;
});
jest.mock('@/services/teamInvite/teamInviteShare', () => ({
  buildTeamInviteMessage: () => '',
  buildTeamInviteUrl: () => '',
  openInviteSms: jest.fn(),
  shareExistingTeamInvite: jest.fn(),
}));

// Le RETOUR sur la fiche : on garde les rappels pour les declencher a la main.
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (/** @type {Function} */ rappel) => {
    mockRetoursSurLaFiche.add(rappel);
  },
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn() }),
}));

// La doublure de `t` rend le repli quand il existe : sans lui, les libelles
// resteraient des CLEFS et aucune recherche par texte ne les trouverait.
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ clef, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : clef
    ),
  }),
}));

// Le vrai theme, pas un Proxy : ce filet LIT des valeurs de style (`position`,
// `width`, `height`), donc il lui faut les vraies rampes. Seul `Images` est
// stube, pour ne pas dependre de la resolution des assets.
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
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: espaces,
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuth,
}));

jest.mock('@/domains/auth/authUseCases', () => ({
  markOnboardingComplete: jest.fn(),
  resolveAffiliationOriginRoute: () => null,
  USER_ROLES: { admin: 'Dirigeant', coach: 'Entraineur', player: 'Joueur' },
}));

jest.mock('@/domains/club/useClub', () => ({
  __esModule: true,
  default: () => ({ getClubInitials: () => 'FC' }),
}));

jest.mock('@/domains/messaging/useMessaging', () => ({
  __esModule: true,
  default: () => ({ startTeamChat: jest.fn(), startWhisperChat: jest.fn() }),
}));

jest.mock('@/domains/subscription/subscriptionDecision', () => ({
  extractSubscriptionDecisionFromError: () => null,
  hasActiveClubOffer: () => false,
}));

jest.mock('@/domains/team/teamMembership', () => ({
  isMyTeam: () => mockEstMonEquipe,
}));

jest.mock('@/services/team/teamQueries', () => ({
  useGetTeam: () => mockReponseEquipeCourante,
}));
jest.mock('@/services/club/clubQueries', () => ({
  useGetClub: () => mockReponseClub,
}));
jest.mock('@/services/stats/statsQueries', () => ({
  useGetTeamStats: (/** @type {any} */ _id, /** @type {any} */ options) => {
    mockOptionsPresences.push(options);
    return mockReponseStats;
  },
}));
jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetTeamPerformanceStats: (/** @type {any} */ _id, /** @type {any} */ options) => {
    mockOptionsPerformances.push(options);
    return mockReponsePerf;
  },
}));

jest.mock('@/services/team/teamService', () => ({
  connectExternalCompetition: jest.fn(),
  createFFBBErrorReport: jest.fn(),
  leaveTeam: jest.fn(),
  previewExternalCompetition: jest.fn(),
  refreshExternalCompetition: jest.fn(),
  removePlayerFromTeam: jest.fn(),
  updateTeam: jest.fn(),
}));
jest.mock('@/services/auth/authService', () => ({ removeTrainerFromClub: jest.fn() }));
jest.mock('@/services/stats/statsService', () => ({ resetTeamStats: jest.fn() }));
jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  createTeamMembershipRequest: jest.fn(),
}));

jest.mock('@/navigation/public/publicAuthNavigation', () => ({ openPublicAuthFlow: jest.fn() }));
jest.mock('@/views/league/match/utils/leagueNavigation', () => ({
  navigateToLeagueMatchDetails: jest.fn(),
}));
jest.mock('@/views/team/composition/teamCompoTemplateUtils', () => ({
  buildCompoTemplateDestination: () => ({ params: {}, screen: 'x' }),
}));

jest.mock('@/utils/clubCertification', () => ({ isVerifiedClub: () => false }));
jest.mock('@/utils/errors/displayError', () => ({ getErrorMessage: () => 'erreur' }));
jest.mock('@/utils/imageUrl', () => ({ getImageUrl: () => null }));

// Le conteneur d'ecran rend ses enfants tels quels : ce filet observe la
// PARENTE des noeuds (l'action est-elle dans la feuille ou dehors ?), pas le
// decor.
jest.mock('@/components/templates/ScreenContainer', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  const reactActuel = jest.requireActual('react');

  return function ScreenContainerMock(/** @type {any} */ props) {
    return reactActuel.createElement(VueRN, null, props.children);
  };
});

// `WithDataWrapper` doit rendre ses enfants, sinon la page est vide et le filet
// mesurerait un arbre qui n'existe pas.
jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  const reactActuel = jest.requireActual('react');

  return function WithDataWrapperMock(/** @type {any} */ props) {
    return reactActuel.createElement(VueRN, null, props.children);
  };
});

// 🔑 LA COUTURE DE CE LOT. La vraie feuille maison ne rend RIEN tant qu'elle
// n'a jamais ete demandee ; sa doublure fait pareil, et n'expose son contenu
// que lorsqu'on la dit visible. C'est ce qui permet de distinguer « visible
// SANS ouvrir le menu » de « visible DANS le menu ».
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  const reactActuel = jest.requireActual('react');

  return function BottomModalMock(/** @type {any} */ props) {
    if (!props.isVisible) return null;

    return reactActuel.createElement(
      VueRN,
      { testID: 'feuille-actions-equipe' },
      props.headerComponent,
      props.children,
    );
  };
});

// La doublure de `Button` rend un vrai texte portant son `title` : c'est la
// couture qui laisse chercher « ce qui porte le libelle X » plutot qu'une forme
// d'arbre, et qui survit donc a une refonte de mise en page.
jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  const reactActuel = jest.requireActual('react');

  return function ButtonMock(/** @type {any} */ props) {
    return reactActuel.createElement(TexteRN, null, props.title);
  };
});

jest.mock('@/components/atoms/checkable/Checkable', () => function CheckableMock() {
  return null;
});
jest.mock('@/components/atoms/loader/Loader', () => function LoaderMock() {
  return null;
});
jest.mock(
  '@/components/atoms/sponsorLogoTile/SponsorLogoTile',
  () => function SponsorLogoTileMock() {
    return null;
  },
);
jest.mock('@/components/atoms/SvgIcon/SvgIcon', () => function SvgIconMock() {
  return null;
});
jest.mock('@/components/atoms/teamShield/TeamShield', () => function TeamShieldMock() {
  return null;
});
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => function ClubLogoMarkMock() {
  return null;
});
jest.mock('@/components/molecules/input/Input', () => function InputMock() {
  return null;
});
jest.mock('@/components/molecules/memberAvatar/MemberAvatar', () => function MemberAvatarMock() {
  return null;
});
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => function ProfileAvatarMock() {
  return null;
});
jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => function SubscriptionPaywallSheetMock() {
    return null;
  },
);
jest.mock('@/components/molecules/teamSlotList/TeamSlotList', () => function TeamSlotListMock() {
  return null;
});
jest.mock(
  '@/components/organisms/createTrainerModal/CreateTrainerModal',
  () => function CreateTrainerModalMock() {
    return null;
  },
);
jest.mock(
  '@/components/organisms/eventListContent/EventListContent',
  () => function EventListContentMock() {
    return null;
  },
);

/** @type {any} */
let arbre;

const navigation = {
  addListener: () => () => {},
  getParent: () => null,
  getState: () => ({ routeNames: [] }),
  goBack: jest.fn(),
  navigate: jest.fn(),
  setOptions: jest.fn(),
};

/**
 * Monte la fiche d'equipe, puis simule le RETOUR sur l'ecran (ce que
 * `useFocusEffect` declenche a chaque fois que la fiche redevient visible).
 * @returns {void}
 */
const monterPuisRevenirSurLaFiche = () => {
  act(() => {
    arbre = renderer.create(
      <TeamDetails
        navigation={/** @type {any} */ (navigation)}
        route={/** @type {any} */ ({ params: { teamId: 'equipe-1' } })}
      />,
    );
  });
  if (mockRetoursSurLaFiche.size === 0) {
    throw new Error('La fiche n a pose aucun retour sur l ecran (useFocusEffect)');
  }
  act(() => {
    mockRetoursSurLaFiche.forEach((rappel) => rappel());
  });
};

/**
 * Les options du DERNIER rendu de la requete des performances.
 * @returns {any}
 */
const optionsPerformances = () => mockOptionsPerformances[mockOptionsPerformances.length - 1];

/**
 * Les options du DERNIER rendu de la requete des presences.
 * @returns {any}
 */
const optionsPresences = () => mockOptionsPresences[mockOptionsPresences.length - 1];

afterEach(() => {
  if (arbre) {
    act(() => arbre.unmount());
  }
  arbre = null;
  mockEstMonEquipe = true;
  mockDirigeantDuClub = true;
  mockReponseEquipeCourante = mockReponseFoot;
  mockRetoursSurLaFiche.clear();
  mockOptionsPerformances.splice(0);
  mockOptionsPresences.splice(0);
  mockRefetchPerformances.mockClear();
  mockRefetchPresences.mockClear();
});

describe('FINITIONS2 6 — aucune requete dont la reponse est un refus connu d avance', () => {
  test('equipe de HANDBALL : les performances ne sont ni demandees ni rafraichies (400)', () => {
    mockReponseEquipeCourante = mockReponseHand;
    monterPuisRevenirSurLaFiche();

    expect(optionsPerformances()?.enabled).toBe(false);
    expect(mockRefetchPerformances).not.toHaveBeenCalled();
  });

  test('pas MON equipe, ni dirigeant de son club : ni presences ni performances au retour sur la fiche (403)', () => {
    mockEstMonEquipe = false;
    mockDirigeantDuClub = false;
    monterPuisRevenirSurLaFiche();

    expect(optionsPerformances()?.enabled).toBe(false);
    expect(optionsPresences()?.enabled).toBe(false);
    expect(mockRefetchPerformances).not.toHaveBeenCalled();
    expect(mockRefetchPresences).not.toHaveBeenCalled();
  });

  test('🔒 mon equipe de FOOT : les deux se chargent et se rafraichissent comme avant', () => {
    monterPuisRevenirSurLaFiche();

    expect(optionsPerformances()?.enabled).toBe(true);
    expect(optionsPresences()?.enabled).toBe(true);
    expect(mockRefetchPerformances).toHaveBeenCalledTimes(1);
    expect(mockRefetchPresences).toHaveBeenCalledTimes(1);
  });
});

/**
 * Les onglets « Stats » rendus par la fiche.
 * @returns {any[]}
 */
const ongletsStats = () => arbre.root.findAll(
  (/** @type {any} */ noeud) => noeud.props?.accessibilityRole === 'tab' && noeud.props?.accessibilityLabel === 'Stats',
);

// STATS-ENQUETE (01/10, defaut 3 de la tournee ECRANS-STATS) — LE DIRIGEANT N'AVAIT PAS L'ONGLET STATS.
// Decision d'Adel du 21/09 (« go a », RELAIS.md) : le dirigeant voit les statistiques de toutes les
// equipes de son club. Le serveur l'applique depuis SENTRY-1 (`can-view-team-stats`, admin) ; l'app
// ne laissait passer que les membres (`canLoadTeamStats = teamId && isMyTeam`) : ni requete, ni onglet.
describe('STATS-ENQUETE 3 — le dirigeant du club voit l onglet Stats de ses equipes', () => {
  test('🚨 dirigeant du club, pas membre de l equipe : presences et performances se chargent', () => {
    mockEstMonEquipe = false;
    monterPuisRevenirSurLaFiche();

    expect(optionsPresences()?.enabled).toBe(true);
    expect(optionsPerformances()?.enabled).toBe(true);
    expect(mockRefetchPresences).toHaveBeenCalledTimes(1);
    expect(mockRefetchPerformances).toHaveBeenCalledTimes(1);
  });

  test('🚨 dirigeant du club, pas membre de l equipe : l onglet Stats est la', () => {
    mockEstMonEquipe = false;
    monterPuisRevenirSurLaFiche();

    expect(ongletsStats().length).toBeGreaterThan(0);
  });

  test('🔒 ni membre ni dirigeant : pas d onglet Stats', () => {
    mockEstMonEquipe = false;
    mockDirigeantDuClub = false;
    monterPuisRevenirSurLaFiche();

    expect(ongletsStats()).toHaveLength(0);
  });

  test('🔒 dirigeant, equipe de HANDBALL : les presences oui, les performances toujours pas (400)', () => {
    mockEstMonEquipe = false;
    mockReponseEquipeCourante = mockReponseHand;
    monterPuisRevenirSurLaFiche();

    expect(optionsPresences()?.enabled).toBe(true);
    expect(optionsPerformances()?.enabled).toBe(false);
    expect(mockRefetchPerformances).not.toHaveBeenCalled();
  });
});
