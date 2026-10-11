import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TeamDetails from '../TeamDetails';

// LOT ROLES3 (28/09) — DECISION D ADEL « 2- oui » : L ENTRAINEUR QUI JOUE EST
// UN JOUEUR DE SON EQUIPE.
//
// 📸 LE CONSTAT (recette emulateur du 28/09, defaut 4) : le dirigeant entraine
// SILENCE-Test-U15 et a dit « Je joue en SILENCE-Test-U15 ». La page d equipe
// affiche pourtant « Joueur·se : Personne pour l'instant » — `filteredPlayers`
// retirait des joueurs TOUT entraineur de l equipe.
//
// 🎯 Il est desormais dans les joueurs. Il reste dans « Entraîneur·e·s » : cette
// rubrique de la page d equipe dit qui a quel ROLE, et l en retirer afficherait
// « Aucun entraîneur pour le moment » alors qu il l est (et cacherait la
// corbeille qui le retire de l encadrement). Le « pas de double affichage » de
// la decision vaut pour l ENCADREMENT DES PRESENCES du match
// (`eventParticipantSections.test.js`, bloc ROLES3).
//
// Le harnais (doublures) est celui de `TeamDetails.menuTroisPoints.test.js`,
// recopie tel quel : ce fichier d ecran n a pas de harnais partage.

const CLUB = { documentId: 'club-1', name: 'FC Test' };

const DIRIGEANT_QUI_JOUE = {
  documentId: 'moi',
  firstname: 'Ada',
  lastname: 'L',
  role: { name: 'Dirigeant' },
};
const ENTRAINEUR_QUI_NE_JOUE_PAS = {
  documentId: 'coach-2',
  firstname: 'Coach',
  lastname: 'Simple',
  role: { name: 'Entraineur' },
};
const JOUEUSE = { documentId: 'joueuse-1', firstname: 'Bo', lastname: 'M' };

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

describe('ROLES3 — page d equipe : l entraineur qui joue est chez les joueurs', () => {
  test('le cas de la recette : seul joueur ET seul entraineur, il est dans « Joueur·se·s »', () => {
    const racine = monterLaPage(equipe({
      players: [DIRIGEANT_QUI_JOUE],
      trainers: [DIRIGEANT_QUI_JOUE],
    }));

    const joueurs = rubrique(racine, 'teamDetails.sections.players');
    expect(joueurs).toContain('Ada L');
    expect(joueurs).not.toContain("Personne pour l'instant");
    // Son role d entraineur reste dit : il EST l entraineur de l equipe.
    expect(rubrique(racine, 'teamDetails.sections.trainers')).toContain('Ada L');
  });

  test('le simple entraineur qui ne joue pas : INCHANGE, jamais chez les joueurs', () => {
    const racine = monterLaPage(equipe({
      players: [DIRIGEANT_QUI_JOUE, JOUEUSE],
      trainers: [ENTRAINEUR_QUI_NE_JOUE_PAS, DIRIGEANT_QUI_JOUE],
    }));

    const joueurs = rubrique(racine, 'teamDetails.sections.players');
    expect(joueurs).toEqual(expect.arrayContaining(['Ada L', 'Bo M']));
    expect(joueurs).not.toContain('Coach Simple');
    expect(rubrique(racine, 'teamDetails.sections.trainers')).toContain('Coach Simple');
  });
});

// PAR-006 : la fiche enfant acceptee vient de declaredChildren, pas de players.
// Le serveur ne lui cree aucun compte. Elle doit etre visible sans recevoir
// les actions d'un compte utilisateur (profil public, chat ou suppression joueur).
const ENFANT_ACCEPTE = {
  avatar: null,
  documentId: 'enfant-1',
  firstname: 'Lea',
  id: 'enfant-1',
  isManual: true,
  lastname: 'Test',
  number: null,
  participantSource: 'declared_child',
  position: null,
};

describe('PAR006 - enfant accepte visible dans effectif encadrant', () => {
  beforeEach(() => jest.clearAllMocks());

  test('seul enfant accepte : son nom apparait et equipe plus vide', () => {
    const racine = monterLaPage({
      ...equipe({ players: [], trainers: [ENTRAINEUR_QUI_NE_JOUE_PAS] }),
      declaredChildren: [ENFANT_ACCEPTE],
    });
    expect(rubrique(racine, 'teamDetails.sections.players')).toContain('Lea Test');
    expect(textesDansLOrdre(racine)).not.toContain("Personne pour l'instant");
  });

  test('enfant et comptes joueurs restent visibles ensemble', () => {
    const racine = monterLaPage({
      ...equipe({ players: [JOUEUSE], trainers: [] }),
      declaredChildren: [ENFANT_ACCEPTE],
    });
    expect(rubrique(racine, 'teamDetails.sections.players')).toEqual(
      expect.arrayContaining(['Lea Test', 'Bo M']),
    );
  });

  test('fiche enfant : pas de profil utilisateur ni de retrait comme compte joueur', () => {
    const racine = monterLaPage({
      ...equipe({ players: [], trainers: [] }),
      declaredChildren: [ENFANT_ACCEPTE],
    });
    expect(rubrique(racine, 'teamDetails.sections.players')).toContain('Lea Test');
    const [nom] = racine.findAll(
      (node) => node.type === Text && node.props.children === 'Lea Test',
    );
    let { parent } = nom;
    while (parent) {
      expect(parent.props?.onPress).toBeUndefined();
      parent = parent.parent;
    }
    expect(racine.findAllByProps({ testID: 'button-trash' })).toHaveLength(0);
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  test('sans liste enfant, les comptes joueurs restent inchanges', () => {
    const racine = monterLaPage(equipe({ players: [JOUEUSE], trainers: [] }));
    expect(rubrique(racine, 'teamDetails.sections.players')).toContain('Bo M');
    expect(textesDansLOrdre(racine)).not.toContain('Lea Test');
  });

  test('effectif masque : aucune identite enfant meme si donnees presentes', () => {
    const racine = monterLaPage({
      ...equipe({ players: [], trainers: [] }),
      declaredChildren: [ENFANT_ACCEPTE],
      membersAreHidden: true,
      playersCount: 1,
    });
    expect(textesDansLOrdre(racine)).not.toContain('Lea Test');
  });
});
