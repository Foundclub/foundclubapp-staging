import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TeamDetails from '../TeamDetails';

// VA1 — UN REFUS DU SERVEUR (403) DEVIENT VISIBLE.
//
// Sentry REACT-NATIVE-2 (build publique 2.6.43+1301, 13/09 17:15) : Search ->
// Club -> TeamDetails, puis `GET /api/teams/:id/performance-stats` -> 403, et
// deux autres GET d'equipe -> 403. L'ecran, lui, affichait « Aucune statistique
// disponible pour le moment. » : un refus deguise en liste vide.
//
// Le banc reprend les doublures de `TeamDetails.menuTroisPoints.test.js`
// (meme ecran, memes pieges : doublures de requete a identite STABLE, arbre
// demonte apres chaque test). Seules les trois requetes deviennent reglables.
//
// ⚠️ Jest ne calcule aucune mise en page : ce filet lit les TEXTES rendus.

const CLUB = { documentId: 'club-1', name: 'FC Test' };

const ENTRAINEUR = { documentId: 'moi', firstname: 'Ada', lastname: 'L' };

const EQUIPE = {
  activities: [{ documentId: 'sport-1', name: 'Football' }],
  category: { documentId: 'categorie-1', name: 'U15' },
  club: CLUB,
  documentId: 'equipe-1',
  name: 'Seniors A',
  players: [{ documentId: 'joueuse-1', firstname: 'Bo', lastname: 'M' }],
  trainers: [ENTRAINEUR],
};

const UTILISATEUR = {
  club: CLUB,
  documentId: 'moi',
  myTeams: [{ documentId: 'equipe-1' }],
  role: { name: 'Dirigeant' },
  teamMembershipRequests: [],
  trainedTeams: [],
};

// ⚠️ Chaque doublure de requete rend TOUJOURS LE MEME OBJET. Une doublure qui
// reconstruit son enveloppe a chaque appel change l'identite de `team`/`club`,
// relance les effets qui en dependent, et Jest tourne en boucle sans jamais
// rendre la main (piege paye au lot R03 sur l'ecran voisin `TeamEdit.js`).
const enveloppe = (/** @type {any} */ donnees) => ({
  data: donnees,
  error: null,
  isFetching: false,
  isLoading: false,
  refetch: jest.fn(),
});

const mockReponseEquipe = enveloppe(EQUIPE);
const mockReponseClub = enveloppe(CLUB);
const mockReponseVide = enveloppe(null);

// VA1 — la forme EXACTE vue par Sentry sur la build publique 1301 (REACT-NATIVE-2) :
// la charge Strapi deballee par l'intercepteur, sans code.
const REFUS_403 = Object.freeze({
  details: {},
  message: 'Forbidden',
  name: 'ForbiddenError',
  status: 403,
});
const mockRefusee = Object.freeze({ ...enveloppe(null), error: REFUS_403 });

// Une panne serveur deguisee en 403 par le catch d'une politique : ce n'est PAS un refus.
const mockPanneDeguisee = Object.freeze({
  ...enveloppe(null),
  error: { details: { code: 'INTERNAL_SERVER_ERROR' }, message: 'Error in policy', status: 403 },
});

let mockReponseEquipeCourante = mockReponseEquipe;
let mockReponseStats = mockReponseVide;
let mockReponsePerf = mockReponseVide;

// Le dirigeant du club : c'est le cas qui affiche TOUTES les actions, donc
// celui sur lequel se compte « aucune action n'a disparu ».
const AUTH_DIRIGEANT = Object.freeze({
  canEditClub: () => true,
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

let mockAuthCourant = AUTH_DIRIGEANT;
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

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
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
  default: () => mockAuthCourant,
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
  useGetTeamStats: () => mockReponseStats,
}));
jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetTeamPerformanceStats: () => mockReponsePerf,
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

const LIBELLE_REFUS = "Tu n'as pas accès à cette partie : elle est réservée aux membres.";
const LIBELLE_VIDE_PRESENCES = 'Aucune statistique disponible pour le moment.';
const LIBELLE_VIDE_PERF = 'Aucune performance de match disponible pour le moment.';

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
 * Monte la fiche d'equipe.
 * @returns {any} La racine de l'arbre monte.
 */
const monterLaFiche = () => {
  act(() => {
    arbre = renderer.create(
      <TeamDetails
        navigation={/** @type {any} */ (navigation)}
        route={/** @type {any} */ ({ params: { teamId: 'equipe-1' } })}
      />,
    );
  });

  return arbre.root;
};

/**
 * Tous les textes rendus, a plat.
 * @param {any} racine La racine de l'arbre.
 * @returns {string[]} Les chaines trouvees dans les noeuds `Text`.
 */
const textes = (racine) => racine
  .findAll((/** @type {any} */ noeud) => noeud.type === Text, { deep: true })
  .flatMap((/** @type {any} */ noeud) => [].concat(noeud.props.children))
  .filter((/** @type {any} */ enfant) => typeof enfant === 'string');

/**
 * Appuie sur l'onglet qui porte ce libelle d'accessibilite.
 * @param {any} racine La racine de l'arbre.
 * @param {string} libelle Le libelle de l'onglet.
 * @returns {void}
 */
const ouvrirOnglet = (racine, libelle) => {
  const onglet = racine.findAll(
    (/** @type {any} */ noeud) => noeud.props?.accessibilityRole === 'tab'
      && noeud.props?.accessibilityLabel === libelle
      && typeof noeud.props?.onPress === 'function',
    { deep: true },
  )[0];
  act(() => {
    onglet.props.onPress();
  });
};

/**
 * Appuie sur le premier element pressable qui contient ce texte.
 * @param {any} racine La racine de l'arbre.
 * @param {string} libelle Le texte cherche.
 * @returns {void}
 */
const appuyerSur = (racine, libelle) => {
  const cible = racine.findAll(
    (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function'
      && noeud.findAll(
        (/** @type {any} */ enfant) => enfant.type === Text && enfant.props.children === libelle,
        { deep: true },
      ).length > 0,
    { deep: true },
  ).pop();
  act(() => {
    cible.props.onPress();
  });
};

afterEach(() => {
  if (arbre) {
    act(() => arbre.unmount());
  }
  arbre = null;
  mockAuthCourant = AUTH_DIRIGEANT;
  mockEstMonEquipe = true;
  mockReponseEquipeCourante = mockReponseEquipe;
  mockReponseStats = mockReponseVide;
  mockReponsePerf = mockReponseVide;
});

describe('VA1 — onglet Stats : un refus 403 se dit, il ne se deguise pas en liste vide', () => {
  test('CAS DE PRODUCTION : presences refusees -> « acces reserve », pas « aucune stat »', () => {
    mockReponseStats = mockRefusee;
    const racine = monterLaFiche();
    ouvrirOnglet(racine, 'Stats');

    expect(textes(racine)).toContain(LIBELLE_REFUS);
    expect(textes(racine)).not.toContain(LIBELLE_VIDE_PRESENCES);
  });

  test('performances refusees -> « acces reserve », pas « aucune performance »', () => {
    mockReponsePerf = mockRefusee;
    const racine = monterLaFiche();
    ouvrirOnglet(racine, 'Stats');
    appuyerSur(racine, 'Performance');

    expect(textes(racine)).toContain(LIBELLE_REFUS);
    expect(textes(racine)).not.toContain(LIBELLE_VIDE_PERF);
  });

  test('GARDE-FOU : une liste vraiment vide dit toujours « aucune statistique »', () => {
    const racine = monterLaFiche();
    ouvrirOnglet(racine, 'Stats');

    expect(textes(racine)).toContain(LIBELLE_VIDE_PRESENCES);
    expect(textes(racine)).not.toContain(LIBELLE_REFUS);
  });

  test('GARDE-FOU : une panne deguisee en 403 n est PAS annoncee comme un refus', () => {
    mockReponseStats = mockPanneDeguisee;
    const racine = monterLaFiche();
    ouvrirOnglet(racine, 'Stats');

    expect(textes(racine)).not.toContain(LIBELLE_REFUS);
  });
});

describe('VA1 — l equipe elle-meme refusee : « Acces reserve », sans « Reessayer »', () => {
  test('un 403 sur la fiche equipe dit « Accès réservé » et ne propose pas de réessayer', () => {
    mockReponseEquipeCourante = mockRefusee;
    const racine = monterLaFiche();

    expect(textes(racine)).toContain('Accès réservé');
    expect(textes(racine)).toContain(LIBELLE_REFUS);
    expect(textes(racine)).not.toContain("Impossible de charger l'équipe");
    expect(textes(racine)).not.toContain('Réessayer');
    expect(textes(racine)).toContain('Retour aux équipes');
  });

  test('GARDE-FOU : une vraie panne garde « Impossible de charger » et « Réessayer »', () => {
    mockReponseEquipeCourante = mockPanneDeguisee;
    const racine = monterLaFiche();

    expect(textes(racine)).toContain("Impossible de charger l'équipe");
    expect(textes(racine)).toContain('Réessayer');
  });
});
