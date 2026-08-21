import { ScrollView, Text, View } from 'react-native';
import renderer, { act } from 'react-test-renderer';

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
// Aucun ecran ne montre les 10 actions a la fois — l'inventaire se compte donc
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
// 2 en-tetes de groupe. C'est lui qui prouve « aucune action retiree ».
//
// ⚠️ IL SE COMPTE SUR DEUX SCENES, et ce n'est pas un contournement : les
// conditions d'affichage du code le rendent IMPOSSIBLE a compter sur une seule.
// « Contacter l'entraîneur·e » exige `!isMyTeam` ; les 9 autres exigent
// `isMyTeam` ou `canManageTeam`. Un inventaire pris sur la seule scene du
// dirigeant afficherait 9, et ferait croire a une action perdue.
const ACTIONS_DU_DIRIGEANT = [
  "Modifier l'équipe",
  'Inviter des joueur·se·s',
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
  test('aucune action du dirigeant n’a disparu : 9 rangées et 2 en-têtes', () => {
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
    expect(ACTIONS_DU_DIRIGEANT).toHaveLength(9);
  });

  // ... et la 10ᵉ sur celle de l'entraîneur voisin, la seule qui la montre.
  test('la 10ᵉ action, « Contacter l’entraîneur·e », est là elle aussi', () => {
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
});
