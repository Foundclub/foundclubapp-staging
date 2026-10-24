import {
  Alert as NativeAlert, ScrollView, Text, View,
} from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { leaveTeam } from '@/services/team/teamService';

import TeamDetails from '../TeamDetails';

// AC01 (E6) — LES ACTIONS D'EQUIPE QUITTENT LE BAS DE L'ECRAN.
//
// Constat d'Adel, 2026-08-20 : « le bouton "actions d'équipe" est complètement
// bugué, et en plus son padding est trop gros. Enlève-le en bas et remplace-le
// par trois petits points en haut à droite. »
//
// ⚠️ CE FILET REMPLACE `TeamDetails.menuActionsDefile.test.js` (lot AA06). Ce
// dernier mesurait le DEFILEMENT du panneau depliant pose en bas de page —
// exactement le dessin qu'Adel retire ici. Son temoin de fond (« ce qui depasse
// doit rester atteignable ») n'est pas perdu : il est desormais porte par la
// feuille maison `BottomModal`, et prouve chez elle par
// `bottomModal/__tests__/BottomModal.debordement.test.js` (lot D19).
//
// 🚨 LE PIEGE QUE CE FILET GARDE : le bouton « C'est mon équipe » est L'ENTREE
// DU TUNNEL D'INSCRIPTION. L'ancien panneau s'ouvrait TOUT SEUL pour le
// visiteur, justement pour la lui montrer. Le ranger derriere les trois points
// la rendrait introuvable : deux tests ci-dessous verrouillent le fait qu'elle
// reste visible SANS ouvrir le menu.
//
// ⚠️ CE QUE CE FILET NE PROUVE PAS : Jest n'a pas de moteur de mise en page, il
// ne mesure AUCUN pixel. Il lit les CONTRAINTES posees sur l'arbre rendu et la
// PARENTE des noeuds. Le rendu reel se constate a la recette.

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

// 🧭 L'ENTRAINEUR DU CLUB QUI REGARDE UNE EQUIPE VOISINE. Ce cas existe parce
// que « Contacter l'entraîneur·e » exige `role === coach && isMyClub &&
// !isMyTeam` : il est donc MUTUELLEMENT EXCLUSIF du cas dirigeant ci-dessus.
// Aucun ecran ne montre les 11 actions a la fois — l'inventaire se compte donc
// sur DEUX scenes, pas une.
const AUTH_ENTRAINEUR_DU_CLUB = Object.freeze({
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
  userData: {
    club: CLUB,
    documentId: 'entraineur-voisin',
    myTeams: [],
    role: { name: 'Entraineur' },
    teamMembershipRequests: [],
    trainedTeams: [],
  },
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

// FINITIONS14 — la doublure GARDE les options de chaque mutation et expose
// `setQueryData` : le temoin du point 3 rejoue la reussite d'un retrait de joueur.
const mockOptionsMutations = [];
const mockSetQueryData = jest.fn();
const mockInvalidateQueries = jest.fn().mockResolvedValue(undefined);
const mockMutate = jest.fn();
jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => {
    mockOptionsMutations.push(options);
    return { isPending: false, mutate: mockMutate };
  },
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries, setQueryData: mockSetQueryData,
  }),
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
  // ABOPARCLUB : le VRAI juge. Les decors d'avant portent un niveau 'none' : il
  // rend faux, comme la doublure qu'il remplace ; les temoins du lot, eux, en ont besoin.
  hasActiveClubOffer: jest.requireActual('@/domains/subscription/subscriptionDecision').hasActiveClubOffer,
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

const ID_BOUTON_TROIS_POINTS = 'team-actions-menu-button';
const ID_FEUILLE = 'feuille-actions-equipe';
const LIBELLE_ENTETE_MENU = "Actions d'équipe";
const LIBELLE_PORTE_VISITEUR = "C'est mon équipe";

// 📋 L'INVENTAIRE D'AVANT, RELEVE SUR LE PANNEAU DU BAS : 10 rangees et
// 2 en-tetes de groupe (11 depuis le lot INVIT, voir plus bas).
// C'est lui qui prouve « aucune action retiree ».
//
// ⚠️ IL SE COMPTE SUR DEUX SCENES, et ce n'est pas un contournement : les
// conditions d'affichage du code le rendent IMPOSSIBLE a compter sur une seule.
// « Contacter l'entraîneur·e » exige `!isMyTeam` ; les 10 autres exigent
// `isMyTeam` ou `canManageTeam`. Un inventaire pris sur la seule scene du
// dirigeant afficherait 10, et ferait croire a une action perdue.
// 🔁 REVU PAR LE LOT INVIT (2026-09-05). « Inviter des joueur·se·s » a ete
// SCINDEE en deux rangees, elle n'a pas ete retiree — et c'est precisement ce
// que ce filet doit continuer de garantir. L'ancienne rangee promettait une
// invitation et ouvrait en realite le partage SMS : elle garde son geste sous
// son vrai nom (« Partager un lien d'invitation ») pendant que la vraie
// invitation serveur prend le sien (« Inviter un membre du club »).
// ⇒ L'inventaire passe donc de 9 a 10 rangees sur la scene du dirigeant.
const ACTIONS_DU_DIRIGEANT = [
  "Modifier l'équipe",
  'Inviter un membre du club',
  "Partager un lien d'invitation",
  "Discussion d'équipe",
  'Composition type',
  'Convocations',
  "Cotisation de l'équipe",
  'Installations',
  'Sponsors & partenaires',
  "Quitter l'équipe",
];

const ACTION_DE_L_ENTRAINEUR_VOISIN = "Contacter l'entraîneur·e";

const ENTETES_DE_GROUPE_ATTENDUES = ["Avec l'offre Équipe", "Avec l'offre Club"];

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
 * Aplatit un style React Native (tableau, valeurs nulles) en un seul objet.
 * @param {any} style Le style tel qu'il est passe au composant.
 * @returns {Record<string, any>} Le style resolu.
 */
const styleAplati = (style) => (Array.isArray(style)
  ? style.filter(Boolean).reduce((acc, part) => ({ ...acc, ...styleAplati(part) }), {})
  : (style || {}));

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
 * Rend le premier noeud portant ce `testID`, ou `null`.
 * @param {any} racine La racine de l'arbre.
 * @param {string} id Le `testID` cherche.
 * @returns {any} Le noeud trouve, ou `null`.
 */
const noeudParId = (racine, id) => racine.findAll(
  (/** @type {any} */ noeud) => noeud.props?.testID === id,
  { deep: true },
)[0] || null;

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

/**
 * Dit si ce libelle est rendu A L'INTERIEUR de la feuille.
 * @param {any} racine La racine de l'arbre.
 * @param {string} libelle Le texte cherche.
 * @returns {boolean} Vrai si un `Text` portant ce libelle vit dans la feuille.
 */
const estDansLaFeuille = (racine, libelle) => textesPortant(racine, libelle).some(
  (/** @type {any} */ noeud) => ancetreQui(
    noeud,
    (/** @type {any} */ candidat) => candidat.props?.testID === ID_FEUILLE,
  ) !== null,
);

/**
 * Appuie sur les trois points.
 * @param {any} racine La racine de l'arbre.
 * @returns {void}
 */
const ouvrirLeMenu = (racine) => {
  const bouton = noeudParId(racine, ID_BOUTON_TROIS_POINTS);

  act(() => {
    bouton.props.onPress();
  });
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

describe("AC01 — les actions d'équipe passent en trois points, en haut à droite", () => {
  // 🥇 LE TEMOIN D'ADEL.
  test('un bouton trois points existe en HAUT À DROITE, et sa cible fait 44 pt', () => {
    const racine = monterLaFiche();
    const bouton = noeudParId(racine, ID_BOUTON_TROIS_POINTS);

    expect(bouton).not.toBeNull();

    const style = styleAplati(bouton.props.style);

    expect(style.position).toBe('absolute');
    expect(style.top).toBe(0);
    expect(style.right).toBe(0);
    expect(style.height).toBeGreaterThanOrEqual(44);
    expect(style.width).toBeGreaterThanOrEqual(44);

    // « TROIS petits points » : trois pastilles, pas une de plus.
    const pastilles = bouton.findAll(
      (/** @type {any} */ noeud) => noeud.type === View
        && styleAplati(noeud.props?.style).borderRadius === 999,
      { deep: true },
    );

    expect(pastilles).toHaveLength(3);
  });

  test('il ouvre une feuille qui porte les actions', () => {
    const racine = monterLaFiche();

    expect(noeudParId(racine, ID_FEUILLE)).toBeNull();

    ouvrirLeMenu(racine);

    expect(noeudParId(racine, ID_FEUILLE)).not.toBeNull();
    expect(estDansLaFeuille(racine, LIBELLE_ENTETE_MENU)).toBe(true);
    expect(estDansLaFeuille(racine, "Quitter l'équipe")).toBe(true);
  });

  // 🔒 AUCUNE ACTION PERDUE — 9 sur la scène du dirigeant...
  test('aucune action du dirigeant n’a disparu : 10 rangées et 2 en-têtes', () => {
    const racine = monterLaFiche();
    ouvrirLeMenu(racine);

    const manquantes = ACTIONS_DU_DIRIGEANT.filter(
      (libelle) => !estDansLaFeuille(racine, libelle),
    );
    const entetesManquantes = ENTETES_DE_GROUPE_ATTENDUES.filter(
      (libelle) => !estDansLaFeuille(racine, libelle),
    );

    expect(manquantes).toEqual([]);
    expect(entetesManquantes).toEqual([]);
    expect(ACTIONS_DU_DIRIGEANT).toHaveLength(10);
  });

  // ... et la 11ᵉ sur celle de l'entraîneur voisin, la seule qui la montre.
  test('la 11ᵉ action, « Contacter l’entraîneur·e », est là elle aussi', () => {
    mockAuthCourant = AUTH_ENTRAINEUR_DU_CLUB;
    mockEstMonEquipe = false;

    const racine = monterLaFiche();
    ouvrirLeMenu(racine);

    expect(estDansLaFeuille(racine, ACTION_DE_L_ENTRAINEUR_VOISIN)).toBe(true);
    // Et sa porte d'entree a lui reste DEHORS du menu, comme celle du visiteur.
    expect(estDansLaFeuille(racine, "Demander à rejoindre l'équipe")).toBe(false);
    expect(textesPortant(racine, "Demander à rejoindre l'équipe")).toHaveLength(1);
  });

  // 🔒 LE TUNNEL D'INSCRIPTION — le garde-fou le plus important de ce lot.
  test("« C'est mon équipe » reste visible SANS ouvrir le menu", () => {
    mockAuthCourant = AUTH_VISITEUR;
    mockEstMonEquipe = false;

    const racine = monterLaFiche();

    // La feuille est FERMEE...
    expect(noeudParId(racine, ID_FEUILLE)).toBeNull();
    // ... et la porte d'entree est pourtant deja a l'ecran.
    expect(textesPortant(racine, LIBELLE_PORTE_VISITEUR)).toHaveLength(1);
  });

  // 🔒 ET ELLE N'EST PAS DANS LE MENU, meme une fois le menu ouvert.
  test('un visiteur non connecté voit toujours sa porte d’entrée, hors du menu', () => {
    mockAuthCourant = AUTH_VISITEUR;
    mockEstMonEquipe = false;

    const racine = monterLaFiche();
    const porte = textesPortant(racine, LIBELLE_PORTE_VISITEUR)[0];

    expect(porte).toBeDefined();
    expect(estDansLaFeuille(racine, LIBELLE_PORTE_VISITEUR)).toBe(false);
    // Elle reste DEHORS de la zone defilante de la page : sans cela, elle
    // passerait sous la ligne de flottaison — c'est la raison d'etre de
    // l'ancienne ouverture automatique du panneau.
    expect(ancetreQui(porte, (/** @type {any} */ candidat) => candidat.type === ScrollView))
      .toBeNull();
  });

  // Le panneau depliant du bas n'existe plus : son entete-bascule a disparu de
  // l'ecran, et l'ecran ne porte plus qu'UNE zone defilante — celle de la page.
  test("le panneau du bas n'existe plus", () => {
    const racine = monterLaFiche();

    expect(textesPortant(racine, LIBELLE_ENTETE_MENU)).toHaveLength(0);
    expect(textesPortant(racine, 'Ouvrir')).toHaveLength(0);

    const zones = racine.findAll(
      (/** @type {any} */ noeud) => noeud.type === ScrollView,
      { deep: true },
    );

    expect(zones).toHaveLength(1);
    expect(zones[0].props.refreshControl).toBeTruthy();
  });

  // 🧨 FEUILLES-COUPEES (15/09) — sans `snapPoints`, BottomModal taille la
  // feuille sur son CONTENU seul : un `headerComponent` n'y est pas compté, et
  // la feuille est plus courte que ce qu'elle affiche de la hauteur du titre.
  // Le commentaire d'AC01 (« en-tete sans pied : le dimensionnement dynamique
  // suffit ») était faux — même défaut que la feuille d'invitation (INVIT2).
  test('🔴 FEUILLES — le titre et « Quitter l’équipe » sont dans le contenu mesuré', () => {
    const racine = monterLaFiche();
    ouvrirLeMenu(racine);

    const feuille = racine.findAll(
      (/** @type {any} */ noeud) => noeud.type?.name === 'BottomModalMock'
        && noeud.props?.isVisible === true,
    )[0];

    expect(feuille.props.snapPoints).toBeUndefined();
    expect(feuille.props.headerComponent).toBeUndefined();
    expect(feuille.props.footerComponent).toBeUndefined();

    const textes = feuille.findAll(
      (/** @type {any} */ noeud) => noeud.type === Text
        && typeof noeud.props?.children === 'string',
    ).map((/** @type {any} */ noeud) => noeud.props.children);

    expect(textes[0]).toBe(LIBELLE_ENTETE_MENU);
    expect(textes).toContain("Quitter l'équipe");
  });
});

// ABOPARCLUB (2026-09-29) — l'offre Club se juge au club de CETTE equipe
// (`getSubscriptionAccessLevelForClub`), pas au club affiche. Decor : le club de
// l'equipe (`club-1`) est couvert par une offre Club, le club affiche ne l'est pas.
describe('ABOPARCLUB — les verrous violets suivent le club de l equipe', () => {
  const LIBELLE_VOIR_L_OFFRE_CLUB = "Voir l'offre";

  test('equipe d un club couvert, vue depuis un club qui ne l est pas : aucun verrou Club', () => {
    mockAuthCourant = {
      ...AUTH_DIRIGEANT,
      getSubscriptionAccessLevelForClub: (/** @type {string} */ clubId) => (
        clubId === CLUB.documentId ? 'CLUB_UNVERIFIED' : 'FREE'
      ),
      subscriptionAccessLevel: 'FREE',
    };
    const racine = monterLaFiche();
    ouvrirLeMenu(racine);

    expect(estDansLaFeuille(racine, "Avec l'offre Club")).toBe(true);
    expect(estDansLaFeuille(racine, LIBELLE_VOIR_L_OFFRE_CLUB)).toBe(false);
  });

  test('equipe d un club NON couvert, vue depuis le club couvert : le verrou Club est la', () => {
    mockAuthCourant = {
      ...AUTH_DIRIGEANT,
      getSubscriptionAccessLevelForClub: () => 'FREE',
      subscriptionAccessLevel: 'CLUB_UNVERIFIED',
    };
    const racine = monterLaFiche();
    ouvrirLeMenu(racine);

    expect(estDansLaFeuille(racine, LIBELLE_VOIR_L_OFFRE_CLUB)).toBe(true);
  });
});

// FINITIONS14 · point 2 (T13-bis, défaut 2) — « Actions d'équipe › Modifier » laissait la
// feuille ouverte PAR-DESSUS « Modifier l'équipe » (photos D1b, D1c) : `handleEditTeam`
// navigue sans la fermer, et la feuille (`BottomSheetModal`, rendue à la racine) reste au
// premier plan de l'écran suivant. Même défaut pour TOUTES les rangées qui quittent la
// feuille (navigation, onglet, fenêtre système) : seules l'invitation, le partage et la
// remise à zéro la fermaient à la main.
describe('FINITIONS14 · une rangée qui quitte la feuille la ferme', () => {
  /**
   * Appuie sur la rangée (ou l'action d'en-tête) qui porte ce libellé.
   * @param {any} racine La racine de l'arbre.
   * @param {string} libelle Le libellé de la rangée.
   * @returns {void}
   */
  const appuyerSurLaRangee = (racine, libelle) => {
    const cible = racine.findAll(
      (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function'
        && textesPortant(noeud, libelle).length > 0,
    ).pop();
    if (!cible) throw new Error(`Aucune rangée « ${libelle} »`);
    act(() => {
      cible.props.onPress();
    });
  };

  /** @type {any} */
  let espionAlerte;
  beforeEach(() => {
    navigation.navigate.mockClear();
    const { Alert } = jest.requireActual('react-native');
    espionAlerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });
  afterEach(() => {
    espionAlerte.mockRestore();
  });

  test('🚨 « Modifier l’équipe » ouvre le formulaire ET ferme la feuille', () => {
    const racine = monterLaFiche();
    ouvrirLeMenu(racine);

    appuyerSurLaRangee(racine, "Modifier l'équipe");

    expect(navigation.navigate).toHaveBeenCalledWith(
      'TeamStack',
      expect.objectContaining({ screen: 'TeamEdit' }),
    );
    expect(noeudParId(racine, ID_FEUILLE) !== null).toBe(false);
  });

  test.each([
    ['Installations'],
    ['Sponsors & partenaires'],
    ["Voir l'offre"],
    ["Quitter l'équipe"],
  ])('🚨 « %s » (navigation ou fenêtre) ferme la feuille', (libelle) => {
    const racine = monterLaFiche();
    ouvrirLeMenu(racine);

    appuyerSurLaRangee(racine, libelle);

    expect(noeudParId(racine, ID_FEUILLE) !== null).toBe(false);
  });

  test('🚨 offre Équipe active : « Convocations » et « Cotisation » ferment la feuille', () => {
    mockAuthCourant = {
      ...AUTH_DIRIGEANT,
      entitlementsSummary: [{ scopeTeamDocumentId: EQUIPE.documentId, status: 'active' }],
    };
    const racine = monterLaFiche();

    ouvrirLeMenu(racine);
    appuyerSurLaRangee(racine, 'Convocations');
    expect(noeudParId(racine, ID_FEUILLE) !== null).toBe(false);

    ouvrirLeMenu(racine);
    appuyerSurLaRangee(racine, "Cotisation de l'équipe");
    expect(noeudParId(racine, ID_FEUILLE) !== null).toBe(false);
    // BH12 P12-06 : les cotisations du club DE L'EQUIPE, pas du club actif.
    expect(navigation.navigate).toHaveBeenCalledWith('ClubLicenses', { clubId: CLUB.documentId });
  });

  test('🔒 une rangée verrouillée « offre Équipe » ouvre l’offre PAR-DESSUS la feuille', () => {
    const racine = monterLaFiche();
    ouvrirLeMenu(racine);

    appuyerSurLaRangee(racine, 'Composition type');

    // La feuille d'offre s'empile sur celle des actions (pile des `BottomSheetModal`) :
    // fermer l'une pendant que l'autre se presente fait disparaitre la seconde (D19).
    expect(noeudParId(racine, ID_FEUILLE) !== null).toBe(true);
  });
});

// FINITIONS14 · point 6 (decision d'Adel « externe staff », tranchee « carte A » par le chef,
// 05/10 ~17h45) — la carte « Source externe » (FFF/FFBB : fournisseur, dernier envoi, qui l'a
// configuree) ne s'affiche plus qu'au STAFF de l'equipe : son entraineur, le dirigeant du club.
// Un joueur la voyait. Le classement et le calendrier, eux, ne changent pas.
describe('FINITIONS14 · point 6 — la carte « Source externe » est reservee au staff', () => {
  const EQUIPE_RELIEE = {
    ...EQUIPE,
    externalCompetitionName: 'Regionale 2',
    externalStandingUrl: 'https://exemple.test/classement',
    externalTeamName: 'SENIORS A',
  };
  /** @type {any} */
  let donneesDAvant;
  beforeEach(() => {
    donneesDAvant = mockReponseEquipe.data;
    mockReponseEquipe.data = EQUIPE_RELIEE;
  });
  afterEach(() => {
    mockReponseEquipe.data = donneesDAvant;
  });

  /**
   * Ouvre l'onglet « Calendrier » (la carte y est posee, sous la liste des matchs).
   * @param {any} racine La racine de l'arbre.
   * @returns {void}
   */
  const ouvrirLeCalendrier = (racine) => {
    const onglet = racine.findAll(
      (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function'
        && textesPortant(noeud, 'Calendrier').length > 0,
    ).pop();
    if (!onglet) throw new Error('Aucun onglet « Calendrier »');
    act(() => {
      onglet.props.onPress();
    });
  };

  const JOUEUR_DE_L_EQUIPE = Object.freeze({
    ...AUTH_VISITEUR,
    userData: {
      club: CLUB,
      documentId: 'joueuse-1',
      myTeams: [{ documentId: 'equipe-1' }],
      role: { name: 'Joueur' },
      teamMembershipRequests: [],
      trainedTeams: [],
    },
  });

  test('🚨 un JOUEUR de l equipe ne voit pas la carte', () => {
    mockAuthCourant = JOUEUR_DE_L_EQUIPE;
    const racine = monterLaFiche();
    ouvrirLeCalendrier(racine);

    expect(textesPortant(racine, 'Source externe')).toHaveLength(0);
  });

  test('🔒 l ENTRAINEUR de l equipe la voit toujours', () => {
    mockAuthCourant = {
      ...JOUEUR_DE_L_EQUIPE,
      userData: { ...JOUEUR_DE_L_EQUIPE.userData, trainedTeams: [{ documentId: 'equipe-1' }] },
    };
    const racine = monterLaFiche();
    ouvrirLeCalendrier(racine);

    expect(textesPortant(racine, 'Source externe').length).toBeGreaterThan(0);
  });

  test('🔒 le DIRIGEANT du club la voit toujours', () => {
    const racine = monterLaFiche();
    ouvrirLeCalendrier(racine);

    expect(textesPortant(racine, 'Source externe').length).toBeGreaterThan(0);
  });
});

// FINITIONS14 · point 3 (T13-bis, defaut 3) — « Retirer ce joueur » : le serveur l'a retire
// (PUT 13:48:22), la fiche le liste encore jusqu'a sa relecture (13:48:30, journal du
// relais). La reussite ne faisait que relancer la lecture : la liste attendait un
// aller-retour complet. Elle retire maintenant le joueur de la fiche EN CACHE des la
// reponse du serveur, puis relit comme avant.
describe('FINITIONS14 · un joueur retire quitte la fiche des la reponse du serveur', () => {
  test('🚨 la fiche en cache perd le joueur, et la relecture part quand meme', () => {
    mockOptionsMutations.length = 0;
    mockSetQueryData.mockClear();
    mockReponseEquipe.refetch.mockClear();
    monterLaFiche();

    // La mutation du retrait : celle dont la fonction appelle `removePlayerFromTeam`.
    const options = [...mockOptionsMutations].reverse().find(
      (/** @type {any} */ entree) => String(entree?.mutationFn).includes('removePlayerFromTeam'),
    );
    expect(options).toBeDefined();

    act(() => {
      options.onSuccess({}, { playerId: 'joueuse-1', teamId: 'equipe-1' });
    });

    const ecriture = mockSetQueryData.mock.calls.find(
      ([cle]) => JSON.stringify(cle) === JSON.stringify(['team', 'equipe-1']),
    );
    expect(ecriture).toBeDefined();
    const ficheApres = ecriture[1](EQUIPE);
    expect(ficheApres.players.map((/** @type {any} */ joueur) => joueur.documentId)).toEqual([]);
    expect(ficheApres.trainers).toBe(EQUIPE.trainers);
    expect(ecriture[1](undefined)).toBeUndefined();
    expect(mockReponseEquipe.refetch).toHaveBeenCalled();
  });
});

describe('IPH09-SORTIE — le depart rafraichit les liens reels', () => {
  const depart = () => mockOptionsMutations.find(
    (/** @type {any} */ options) => options.mutationFn === leaveTeam,
  );
  beforeEach(() => {
    jest.useFakeTimers();
    mockOptionsMutations.length = 0;
    mockInvalidateQueries.mockClear();
    AUTH_DIRIGEANT.refetchUserData.mockClear();
    mockMutate.mockClear();
  });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

  test('une reussite relit club/chats et le profil au dela des 5 s inter-repliques', async () => {
    monterLaFiche();
    await act(async () => { await depart().onSuccess({ leftClubDocumentId: 'club-1' }); });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['club'] });
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['chats'] });
    expect(AUTH_DIRIGEANT.refetchUserData).toHaveBeenCalledTimes(1);
    act(() => { jest.advanceTimersByTime(6000); });
    const lecturesProfil = mockInvalidateQueries.mock.calls.filter(
      ([args]) => args.queryKey[0] === 'get-me',
    );
    expect(lecturesProfil).toHaveLength(2);
  });

  test('une erreur affiche le refus sans relire le profil ni annoncer un depart', () => {
    monterLaFiche();
    const alerte = jest.spyOn(NativeAlert, 'alert').mockImplementation(() => {});
    act(() => { depart().onError(new Error('depart refuse')); });
    expect(alerte).toHaveBeenCalled();
    expect(AUTH_DIRIGEANT.refetchUserData).not.toHaveBeenCalled();
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
    alerte.mockRestore();
  });

  test('deux confirmations lancent un seul depart ; un echec permet de reessayer', () => {
    const racine = monterLaFiche();
    const alerte = jest.spyOn(NativeAlert, 'alert').mockImplementation(() => {});
    ouvrirLeMenu(racine);
    const rangee = racine.findAll(
      (/** @type {any} */ noeud) => typeof noeud.props?.onPress === 'function'
        && textesPortant(noeud, "Quitter l'équipe").length > 0,
    ).pop();
    act(() => { rangee.props.onPress(); });
    const confirmer = alerte.mock.calls[0][2][1].onPress;
    act(() => { confirmer(); confirmer(); });
    expect(mockMutate).toHaveBeenCalledTimes(1);
    act(() => { depart().onSettled(); confirmer(); });
    expect(mockMutate).toHaveBeenCalledTimes(2);
    alerte.mockRestore();
  });
});
