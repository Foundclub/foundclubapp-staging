import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TeamDetails from '../TeamDetails';

// RECETTEWEB retour 2 (recette d Adel du 26/10, TestFlight 2.6.80, fiche d une equipe › Infos,
// captures .local/bancs/RECETTEWEB-20261026/captures-adel/26.webp et 27.webp) :
//   (a) une personne SANS photo (Pierre Hecquet, Olivier Ferre, Yanis Ben Bairouk) montrait un rond
//       avec un simple point « · » : les lignes Coachs et Joueurs appelaient ProfileAvatar SANS son
//       `name`, donc sans initiales (repli REPLI_SANS_NOM). La convocation, elle, les montrait
//       (« YB ») ;
//   (b) « Adel  FERCHICHI », « Olivier  Ferré » : un prenom ou un nom enregistre avec une espace en
//       trop, colle par `${firstname} ${lastname}`.
// ROUGES avant le correctif.
//
// Harnais (doublures) recopie de `TeamDetails.ROLES3.entraineurQuiJoue.test.js` : ce fichier
// d ecran n a pas de harnais partage.

const CLUB = { documentId: 'club-1', name: 'FC Test' };

/**
 * L equipe de la recette, avec ses deux listes telles que le serveur les rend.
 * @param {{ players: any[]; trainers: any[] }} membres - Joueurs et encadrants.
 * @returns {any} - L equipe.
 */
const equipe = ({ players, trainers }) => ({
  activities: [{ documentId: 'sport-1', name: 'Football' }],
  category: { documentId: 'categorie-1', name: 'U15' },
  club: CLUB,
  documentId: 'equipe-1',
  name: 'SILENCE-Test-U15',
  players,
  trainers,
});

const UTILISATEUR = {
  club: CLUB,
  documentId: 'moi',
  myTeams: [{ documentId: 'equipe-1' }],
  role: { name: 'Dirigeant' },
  teamMembershipRequests: [],
  trainedTeams: [{ documentId: 'equipe-1' }],
};

// ⚠️ Chaque doublure de requete rend TOUJOURS LE MEME OBJET pendant un rendu
// (piege paye au lot R03 : une enveloppe reconstruite relance les effets).
const enveloppe = (/** @type {any} */ donnees) => ({
  data: donnees,
  error: null,
  isFetching: false,
  isLoading: false,
  refetch: jest.fn(),
});

let mockReponseEquipe = enveloppe(equipe({ players: [], trainers: [] }));
const mockReponseClub = enveloppe(CLUB);
const mockReponseVide = enveloppe(null);

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

const mockAuthCourant = AUTH_DIRIGEANT;
const mockEstMonEquipe = true;

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
  useGetTeam: () => mockReponseEquipe,
}));
jest.mock('@/services/club/clubQueries', () => ({
  useGetClub: () => mockReponseClub,
}));
jest.mock('@/services/stats/statsQueries', () => ({
  useGetTeamStats: () => mockReponseVide,
}));
jest.mock('@/services/matchStats/matchStatsQueries', () => ({
  useGetTeamPerformanceStats: () => mockReponseVide,
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
    return reactActuel.createElement(TexteRN, {
      onPress: props.onPress,
      testID: `button-${props.icon || 'title'}`,
    }, props.title);
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
// Le VRAI ProfileAvatar : c est lui qui dessine les initiales. Seule sa visionneuse plein ecran
// est doublee.
jest.mock(
  '@/components/molecules/profilePicturePreviewOverlay/ProfilePicturePreviewOverlay',
  () => function ProfilePicturePreviewOverlayMock() {
    return null;
  },
);
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
 * Monte la page d equipe sur cette equipe.
 * @param {any} donnees - L equipe rendue par le serveur.
 * @returns {any} - La racine de l arbre monte.
 */
const monterLaPage = (donnees) => {
  mockReponseEquipe = enveloppe(donnees);
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
 * Les textes rendus, dans l ordre de l ecran.
 * @param {any} racine - La racine de l arbre.
 * @returns {string[]} - Les textes.
 */
const textesDansLOrdre = (racine) => racine.findAll(
  (/** @type {any} */ noeud) => noeud.type === Text,
  { deep: true },
)
  .map((/** @type {any} */ noeud) => noeud.props?.children)
  .filter((/** @type {any} */ texte) => typeof texte === 'string');

/**
 * Les textes rendus sous un titre de rubrique, jusqu au titre suivant. La
 * doublure de `t` rend la CLEF quand il n y a pas de repli : les titres de
 * rubrique sont donc `teamDetails.sections.*`.
 * @param {any} racine - La racine de l arbre.
 * @param {string} clefDuTitre - La clef du titre de la rubrique.
 * @returns {string[] | null} - Les textes de la rubrique, `null` si absente.
 */
const rubrique = (racine, clefDuTitre) => {
  const textes = textesDansLOrdre(racine);
  const debut = textes.indexOf(clefDuTitre);
  if (debut === -1) return null;
  const suite = textes.slice(debut + 1);
  const fin = suite.findIndex((texte) => texte.startsWith('teamDetails.sections.'));
  return fin === -1 ? suite : suite.slice(0, fin);
};

afterEach(() => {
  // Un arbre laisse monte fait tomber le processus Jest ENTIER (lot D34).
  if (arbre) {
    act(() => arbre.unmount());
  }
  arbre = null;
});

describe('RECETTEWEB retour 2 — fiche d equipe › Infos : initiales et noms propres', () => {
  const PIERRE = {
    avatar: null,
    documentId: 'coach-p',
    firstname: 'Pierre',
    lastname: 'Hecquet',
    role: { name: 'Entraineur' },
  };
  const ADEL = {
    avatar: null,
    documentId: 'coach-a',
    firstname: 'Adel ',
    lastname: 'FERCHICHI',
    role: { name: 'Dirigeant' },
  };
  const OLIVIER = {
    avatar: null,
    documentId: 'coach-o',
    firstname: 'Olivier',
    lastname: ' Ferré',
    role: { name: 'Entraineur' },
  };
  const YANIS = {
    avatar: null, documentId: 'joueur-y', firstname: 'Yanis', lastname: 'Ben Bairouk',
  };

  const monter = () => monterLaPage({
    ...equipe({ players: [YANIS], trainers: [PIERRE, ADEL, OLIVIER] }),
    name: 'Aix-Perd en Buvette',
  });

  test('(a) une personne sans photo montre ses initiales, jamais le point « · »', () => {
    const racine = monter();
    expect(rubrique(racine, 'teamDetails.sections.trainers')).toEqual(
      expect.arrayContaining(['PH', 'AF', 'OF']),
    );
    expect(rubrique(racine, 'teamDetails.sections.players')).toContain('YB');
    expect(textesDansLOrdre(racine)).not.toContain('·');
  });

  test('(b) une espace en trop autour du prénom ou du nom ne double pas l espace affichée', () => {
    const racine = monter();
    expect(rubrique(racine, 'teamDetails.sections.trainers')).toEqual(
      expect.arrayContaining(['Pierre Hecquet', 'Adel FERCHICHI', 'Olivier Ferré']),
    );
    expect(rubrique(racine, 'teamDetails.sections.players')).toContain('Yanis Ben Bairouk');
    expect(textesDansLOrdre(racine).filter((texte) => /\S\s{2,}\S/.test(texte))).toEqual([]);
  });
});
