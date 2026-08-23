/**
 * P10 (D10) — LA BANNIERE OU LE JOUEUR DIT OUI OU NON.
 *
 * 🎯 CE QUE CE FILET PROUVE : l invitation ne se subit pas. Quand une ligne
 * `direction: invite` en attente porte sur cette equipe, la fiche affiche une
 * banniere avec DEUX boutons — « Accepter » et « Refuser » — et chacun appelle
 * SA route (`accept-invite` / `refuse-invite`), jamais celles du staff.
 *
 * 🔒 LES DEUX SENS NE SE CONFONDENT PAS. `pendingRequest` (une demande QUE J AI
 * ENVOYEE) fait passer le bouton « C est mon equipe » a « Demande en attente ».
 * `pendingInvitation` (une invitation QUE JE RECOIS) ouvre la banniere. Avant
 * P10 une seule variable portait les deux, et une invitation grisait donc le
 * bouton d adhesion en affichant « Demande en attente » — un mensonge.
 *
 * ⚠️ `direction` absente = ligne d avant le lot = une DEMANDE. Un temoin le
 * verrouille : c est le cas de TOUTES les lignes de production au moment du
 * deploiement.
 *
 * ⚠️ CE QUE CE FILET NE PROUVE PAS : Jest n a pas de moteur de mise en page, il
 * ne mesure AUCUN pixel. Le rendu reel se constate a la recette.
 */

import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TeamDetails from '../TeamDetails';

const mockAccepter = jest.fn();
const mockRefuser = jest.fn();

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

// 🔒 Le visiteur NON CONNECTE : `userData` vaut `null`, donc `isAuthenticated`
// est faux, donc `showJoinAction` est vrai. C'est LUI que l'ancien panneau
// ouvrait d'office.
const AUTH_VISITEUR = Object.freeze({
  canEditClub: () => false,
  canJoinTeam: () => false,
  canManageTeam: false,
  entitlementsSummary: [],
  getNextOnboardingRoute: () => null,
  getPostOnboardingHomeRoute: () => null,
  inviteTeamPlayers: jest.fn(),
  refetchUserData: jest.fn(),
  subscriptionAccessLevel: 'none',
  USER_ROLES: { admin: 'Dirigeant', coach: 'Entraineur', player: 'Joueur' },
  userData: null,
});

let mockAuthCourant = AUTH_DIRIGEANT;
let mockEstMonEquipe = true;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => options?.mutationFn?.(variables),
  }),
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
  acceptTeamInvitation: (/** @type {any} */ id) => mockAccepter(id),
  createTeamMembershipRequest: jest.fn(),
  refuseTeamInvitation: (/** @type {any} */ id) => mockRefuser(id),
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
 * Rend tous les noeuds `Text` qui portent exactement ce libelle.
 * @param {any} racine La racine de l'arbre.
 * @param {string} libelle Le texte cherche.
 * @returns {any[]} Les noeuds trouves.
 */
const textesPortant = (racine, libelle) => racine.findAll(
  (/** @type {any} */ noeud) => noeud.type === Text && noeud.props?.children === libelle,
  { deep: true },
);

/**
 * Remonte les ancetres d'un noeud jusqu'au premier qui satisfait le predicat.
 * @param {any} noeud Le noeud de depart.
 * @param {(candidat: any) => boolean} predicat Le test applique a chaque ancetre.
 * @returns {any} L'ancetre trouve, ou `null`.
 */
const ancetreQui = (noeud, predicat) => {
  let courant = noeud?.parent;
  while (courant) {
    if (predicat(courant)) return courant;
    courant = courant.parent;
  }
  return null;
};

afterEach(() => {
  // Un arbre laisse monte fait tomber le processus Jest ENTIER apres le test :
  // les minuteries armees par React Native tirent apres le demontage de
  // l'environnement (piege paye au lot D34).
  if (arbre) {
    act(() => arbre.unmount());
  }
  arbre = null;
  mockAuthCourant = AUTH_DIRIGEANT;
  mockEstMonEquipe = true;
});

const invitationEnAttente = (/** @type {string} */ documentId) => ({
  direction: 'invite',
  documentId,
  state: 'pending',
  team: { documentId: 'equipe-1' },
});

const authAvecLignes = (/** @type {any[]} */ lignes) => ({
  ...AUTH_VISITEUR,
  userData: {
    club: CLUB,
    documentId: 'joueuse-invitee',
    myTeams: [],
    role: { name: 'Joueur' },
    teamMembershipRequests: lignes,
    trainedTeams: [],
  },
});

describe('P10 — accepter ou refuser une invitation, depuis la fiche de l equipe', () => {
  beforeEach(() => {
    mockAccepter.mockClear();
    mockRefuser.mockClear();
    mockEstMonEquipe = false;
  });

  test('🔴 temoin 1 — une invitation ouvre la banniere et ses DEUX reponses', () => {
    mockAuthCourant = authAvecLignes([invitationEnAttente('tmr-1')]);

    const racine = monterLaFiche();

    expect(textesPortant(racine, 'Invitation').length).toBeGreaterThan(0);
    expect(textesPortant(racine, 'Accepter')).toHaveLength(1);
    expect(textesPortant(racine, 'Refuser')).toHaveLength(1);
  });

  test('temoin 2 — « Accepter » appelle la route du JOUEUR, sur SON invitation', () => {
    mockAuthCourant = authAvecLignes([invitationEnAttente('tmr-2')]);

    const racine = monterLaFiche();
    const accepter = textesPortant(racine, 'Accepter')[0];
    const bouton = ancetreQui(
      accepter,
      (/** @type {any} */ n) => typeof n.props?.onPress === 'function',
    );

    act(() => {
      bouton.props.onPress();
    });

    expect(mockAccepter).toHaveBeenCalledWith('tmr-2');
    expect(mockRefuser).not.toHaveBeenCalled();
  });

  test('temoin 3 — « Refuser » appelle l autre route, et personne ne rejoint', () => {
    mockAuthCourant = authAvecLignes([invitationEnAttente('tmr-3')]);

    const racine = monterLaFiche();
    const refuser = textesPortant(racine, 'Refuser')[0];
    const bouton = ancetreQui(
      refuser,
      (/** @type {any} */ n) => typeof n.props?.onPress === 'function',
    );

    act(() => {
      bouton.props.onPress();
    });

    expect(mockRefuser).toHaveBeenCalledWith('tmr-3');
    expect(mockAccepter).not.toHaveBeenCalled();
  });

  test('🔒 temoin 4 — une DEMANDE que j ai envoyee n ouvre AUCUNE banniere', () => {
    mockAuthCourant = authAvecLignes([{
      direction: 'request',
      documentId: 'tmr-4',
      state: 'pending',
      team: { documentId: 'equipe-1' },
    }]);

    const racine = monterLaFiche();

    expect(textesPortant(racine, 'Accepter')).toHaveLength(0);
    expect(textesPortant(racine, 'Refuser')).toHaveLength(0);
  });

  test('🔒 temoin 5 — une ligne HERITEE (`direction` absente) reste une demande', () => {
    // Le cas de TOUTES les lignes de production au moment du deploiement.
    mockAuthCourant = authAvecLignes([{
      documentId: 'tmr-5',
      state: 'pending',
      team: { documentId: 'equipe-1' },
    }]);

    const racine = monterLaFiche();

    expect(textesPortant(racine, 'Accepter')).toHaveLength(0);
    expect(textesPortant(racine, 'Refuser')).toHaveLength(0);
  });

  test('temoin 6 — sans aucune ligne en attente, la fiche ne parle pas d invitation', () => {
    mockAuthCourant = authAvecLignes([]);

    const racine = monterLaFiche();

    expect(textesPortant(racine, 'Accepter')).toHaveLength(0);
  });
});
