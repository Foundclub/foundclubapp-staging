import { ScrollView, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import TeamDetails from '../TeamDetails';

// AA06 (E6) — LE MENU « ACTIONS D'EQUIPE » NE DEFILE PAS.
//
// Constat d'Adel, 2026-08-20 (point 13, repris en P3) : « sur la page details
// d'une equipe, le menu deroulant ne peut pas se faire defiler — donc ce qui
// depasse est inatteignable ».
//
// `TeamDetails.js` fait 5 486 lignes et n'avait AUCUN test.
//
// CE QUE LA CARTE A MONTRE : le menu n'est pas une fenetre flottante. C'est un
// panneau depliant pose APRES la fermeture de la zone defilante de la page — un
// FRERE, pas un enfant. Son contenu tenait dans un `<View>` nu : ni defilement,
// ni `maxHeight`, ni `flex`. Et l'arithmetique de Yoga explique le symptome
// exactement : la zone defilante de la page a `flex: 1` (donc `flexBasis: 0`,
// donc un poids de retrecissement NUL) et le panneau n'avait pas de
// `flexShrink` (dont la valeur par defaut vaut 0 sur React Native, et non 1
// comme sur le web). Poids total nul ⇒ PERSONNE ne retrecit ⇒ le panneau
// deborde par le bas, et comme il est hors de la zone defilante, rien ne peut
// aller le chercher.
//
// LA REGLE APPLIQUEE EST DEJA ECRITE ET DEJA PROUVEE dans ce depot, par
// `bottomModal/__tests__/BottomModal.debordement.test.js` (lot D19) : une zone
// defilante plafonnee a une fraction de l'ECRAN laisse deborder ce qui vient en
// dernier ; la bonne mise en page est celle qui « prend exactement la place
// LAISSEE » — `flex: 1`, sans `maxHeight`.
//
// ⚠️ CE QUE CE FILET NE PROUVE PAS, et il faut le dire : Jest n'a pas de moteur
// de mise en page, il ne mesure AUCUN pixel. Il lit les CONTRAINTES posees sur
// l'arbre rendu. C'est suffisant ici parce que le defaut EST une contrainte
// manquante. Le defilement reel se constate sur un telephone, a la recette.

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

const mockEtatAuth = Object.freeze({
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

// Le vrai theme, pas un Proxy : ce filet LIT des valeurs de style (`flex`,
// `maxHeight`), donc il lui faut les vraies rampes. Seul `Images` est stube,
// pour ne pas dependre de la resolution des assets.
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
  default: () => mockEtatAuth,
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

// `isMyTeam` est le juge partage : on le fige a « oui », c'est le cas qui
// affiche le menu le plus long, donc celui qui deborde.
jest.mock('@/domains/team/teamMembership', () => ({
  isMyTeam: () => true,
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
// PARENTE des noeuds (le panneau est-il dedans ou dehors ?), pas le decor.
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
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function BottomModalMock() {
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

const LIBELLE_DERNIERE_ACTION = "Quitter l'équipe";
const LIBELLE_ENTETE_MENU = "Actions d'équipe";

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
 * Ouvre le menu d'actions. ⚠️ IDEMPOTENT : appuyer deux fois sur une bascule la
 * REFERME, et l'inventaire reviendrait vide — ce qui se lirait comme une
 * regression du code alors que c'est le filet qui se serait trompe.
 * @param {any} racine La racine de l'arbre.
 * @returns {void}
 */
const ouvrirLeMenu = (racine) => {
  if (textesPortant(racine, LIBELLE_DERNIERE_ACTION).length > 0) return;

  const entete = textesPortant(racine, LIBELLE_ENTETE_MENU)[0];
  let pressable = entete.parent;
  while (pressable && typeof pressable.props?.onPress !== 'function') {
    pressable = pressable.parent;
  }

  act(() => {
    pressable.props.onPress();
  });
};

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
 * Rend la zone defilante qui contient la derniere action du menu.
 * @param {any} racine La racine de l'arbre.
 * @returns {any} Le noeud `ScrollView`, ou `null` s'il n'y en a aucun.
 */
const zoneDefilanteDuMenu = (racine) => {
  const derniereAction = textesPortant(racine, LIBELLE_DERNIERE_ACTION)[0];

  return ancetreQui(derniereAction, (candidat) => candidat.type === ScrollView);
};

/**
 * Rend la zone defilante de la PAGE — celle qui porte le `refreshControl`.
 * @param {any} racine La racine de l'arbre.
 * @returns {any} Le noeud `ScrollView` de la page.
 */
const zoneDefilanteDeLaPage = (racine) => racine.findAll(
  (/** @type {any} */ noeud) => noeud.type === ScrollView && Boolean(noeud.props?.refreshControl),
  { deep: true },
)[0];

afterEach(() => {
  // Un arbre laisse monte fait tomber le processus Jest ENTIER apres le test :
  // les minuteries armees par React Native tirent apres le demontage de
  // l'environnement (piege paye au lot D34).
  if (arbre) {
    act(() => arbre.unmount());
  }
  arbre = null;
});

describe("AA06 — le menu « actions d'équipe » de la fiche d'équipe", () => {
  test("l'entête du menu est là, et il s'ouvre", () => {
    const racine = monterLaFiche();

    expect(textesPortant(racine, LIBELLE_ENTETE_MENU)).toHaveLength(1);
    expect(textesPortant(racine, LIBELLE_DERNIERE_ACTION)).toHaveLength(0);

    ouvrirLeMenu(racine);

    expect(textesPortant(racine, LIBELLE_DERNIERE_ACTION)).toHaveLength(1);
  });

  // 🥇 LE TEMOIN D'ADEL : ce qui dépasse doit pouvoir être atteint.
  test('ouvert, ses actions vivent dans une zone qui DÉFILE', () => {
    const racine = monterLaFiche();
    ouvrirLeMenu(racine);

    expect(zoneDefilanteDuMenu(racine)).not.toBeNull();
  });

  // La règle de la maison, déjà prouvée par le lot D19 : la zone défilante doit
  // être bornée par la place LAISSÉE, jamais par une fraction de l'écran.
  test('et cette zone prend la place LAISSÉE, sans plafond en dur', () => {
    const racine = monterLaFiche();
    ouvrirLeMenu(racine);

    const style = styleAplati(zoneDefilanteDuMenu(racine).props.style);

    expect(style.flex).toBe(1);
    expect(style.maxHeight).toBeUndefined();
  });

  // 🔒 LE GARDE-FOU QUI PROTÈGE LE TUNNEL D'INSCRIPTION : le panneau s'ouvre
  // tout seul pour le visiteur qui peut rejoindre l'équipe, et son bouton
  // « C'est mon équipe » doit rester visible SANS défiler. Le déménager dans la
  // zone défilante de la page le passerait sous la ligne de flottaison.
  test('le panneau reste DEHORS de la zone défilante de la page', () => {
    const racine = monterLaFiche();
    ouvrirLeMenu(racine);

    const derniereAction = textesPortant(racine, LIBELLE_DERNIERE_ACTION)[0];
    const pageDefilante = zoneDefilanteDeLaPage(racine);

    expect(pageDefilante).toBeDefined();
    expect(ancetreQui(derniereAction, (candidat) => candidat === pageDefilante)).toBeNull();
  });

  // Le panneau FERMÉ ne doit rien gagner : pas de zone défilante, donc aucune
  // chance d'avoir changé la hauteur de la page dans l'état le plus courant.
  test('fermé, il ne crée aucune zone défilante de plus', () => {
    const racine = monterLaFiche();

    const zonesFermees = racine.findAll(
      (/** @type {any} */ noeud) => noeud.type === ScrollView,
      { deep: true },
    );

    expect(zonesFermees).toHaveLength(1);
    expect(zonesFermees[0].props.refreshControl).toBeTruthy();
  });
});
