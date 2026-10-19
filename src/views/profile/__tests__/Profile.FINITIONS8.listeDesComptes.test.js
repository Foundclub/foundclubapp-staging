import renderer, { act } from 'react-test-renderer';

// FINITIONS8 · POINT 9 (tournee 9) — « ENTRAINEUR » DANS LA LISTE DES COMPTES.
//
// La fenetre « Changer de compte » ecrivait sous chaque compte le NOM du role en base
// (`role.name` : « Entraineur », « SuperAdmin ») au lieu de son libelle. Les libelles existent :
// `profile.identity.roles.*` (« Entraîneur », « Administrateur »), deja lus par la carte
// d'identite de ce meme ecran.
// Banc : les doublures de Profile.monCompte.test.js (fabrique).

/** @type {any} */
let mockAuth = null;

// PAR-L7 (13/10) — « Mon compte » d'un parent compte ses enfants (`useMesEnfantsEnBref`, qui lit
// trois services) : doublure commune, « aucun enfant ».
jest.mock('@/views/profile/parent/useMesEnfantsEnBref');

jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));

jest.mock('@tanstack/react-query', () => {
  const mutationFigee = { isPending: false, mutate: jest.fn() };
  return { useMutation: () => mutationFigee };
});

jest.mock('react-i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').reactI18next
));
jest.mock('i18next', () => (
  jest.requireActual('@/theme/strings/__mocks__/doublureTraduction').i18next
));

jest.mock('react-native-gesture-handler', () => ({
  ScrollView: jest.requireActual('react-native').ScrollView,
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuth,
}));

jest.mock('@/domains/requests/requestNavigation', () => ({ navigateToRequestsHub: jest.fn() }));

// Le juge d'abonnement est doublé : ses règles ont leurs propres témoins, et la
// carte n'est pas le sujet ici — seulement sa présence.
jest.mock('@/domains/subscription/subscriptionDecision', () => ({
  endSentenceAfterName: (/** @type {string} */ texte) => texte,
  formatCollectiviteOfferedBy: (/** @type {string} */ nom) => nom,
  getActiveClubNotCovered: () => null,
  getActiveClubOfferPayer: () => null,
  getCollectiviteOffer: () => null,
  getSubscriptionBadgeLevel: () => 'FREE',
  getSubscriptionQuotaItems: () => [],
}));

jest.mock('@/store/appContext', () => {
  const etatFige = [{ fcmToken: '' }];
  return { useAppContext: () => etatFige };
});

jest.mock('@/theme/strings/langue', () => ({
  anglaisDisponible: () => false,
  enregistrerChoixDeLangue: jest.fn(),
  langueEffective: () => 'fr',
  lireChoixDeLangue: () => null,
}));

// Le VRAI thème, sans le contexte React qui le porte ; seules les images sont
// des marqueurs (on ne dépend pas de la résolution des fichiers).
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyleApp = jest.requireActual('@/theme/applicationStyle').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = genererCouleurs();
  const Images = {};
  [
    'arrowRight', 'bell', 'check', 'clock', 'edit', 'envelope',
    'euroCircle', 'flag', 'shield', 'share2', 'trophy', 'users',
  ].forEach((nom) => { Images[nom] = { testUri: nom }; });
  const theme = {
    Alignments,
    ApplicationStyle: genererStyleApp(Colors),
    Colors,
    Fonts: genererPolices(Colors),
    Images,
    Spaces,
  };
  return { __esModule: true, default: () => theme };
});

/**
 * Une brique d'affichage doublée : elle rend ses enfants, rien d'autre.
 * @returns {any} Le module doublé.
 */
function mockPassePlat() {
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => children || null,
  };
}

jest.mock('@/components/atoms/button/Button', () => {
  const { Text, TouchableOpacity } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onPress, title }) => (
      <TouchableOpacity accessibilityRole="button" onPress={onPress}>
        <Text>{title}</Text>
      </TouchableOpacity>
    ),
  };
});
jest.mock('@/components/atoms/marqueeText/MarqueeText', () => {
  const { Text } = jest.requireActual('react-native');
  return { __esModule: true, default: (/** @type {any} */ { text }) => <Text>{text}</Text> };
});
jest.mock('@/components/molecules/bottomModal/BottomModal', () => ({
  __esModule: true,
  default: (/** @type {any} */ { children, isVisible }) => (isVisible ? children : null),
}));
jest.mock('@/components/molecules/clubLogoMark/ClubLogoMark', () => ({
  __esModule: true, default: () => null,
}));
jest.mock('@/components/molecules/onboardingWrapper/OnboardingWrapper', () => mockPassePlat());
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => ({
  __esModule: true, default: () => null,
}));
jest.mock('@/components/molecules/tutorial/TutorialFlowBoundary', () => mockPassePlat());
jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => mockPassePlat());
jest.mock('@/components/templates/ScreenContainer', () => mockPassePlat());

jest.mock('@/services/auth/authService', () => ({ deleteAccount: jest.fn() }));
// VILLE-T18B (07/10) : les Villes que gère le compte MONTÉ (`/collectivites/mine`) ; aucune par
// défaut. Un objet stable par témoin (un objet neuf à chaque appel ferait boucler les mémos).
/** @type {any} */
let mockVillesGerees = { data: [] };
// RESA-L6B-1 — le nombre de « Mes réservations » (rangée cachée par COMPLEXES_JOUEUR) lit le
// serveur des complexes : doublé ici comme les autres services de « Mon compte ».
jest.mock('@/views/reserverTerrain/components/NombreAVenir', () => () => null);
jest.mock('@/services/collectivite/collectiviteQueries', () => {
  const aucune = { data: [] };
  // COLL-ACCUEIL (01/10) : la pastille de la rangee de la Ville lit les demandes en attente.
  return { useCollectiviteRequests: () => aucune, useMyCollectivites: () => mockVillesGerees };
});
jest.mock('@/config/legalUrls', () => ({ SUPPORT_CONTACT_MAILTO: 'mailto:contact@exemple.test' }));

const Profile = require('../Profile').default;

const NOMS_DE_ROLE = {
  coach: 'Entraineur',
  parent: 'Parent',
  player: 'Joueur',
  president: 'Dirigeant',
  superAdmin: 'SuperAdmin',
};

/**
 * Ce que `useAuth` rend pour un rôle. Construit UNE fois par rôle : une
 * doublure qui rend un objet neuf à chaque appel fait boucler les mémos.
 * @param {keyof typeof NOMS_DE_ROLE} role
 * @returns {any}
 */
const authDe = (role) => ({
  accountSubscriptionAccessLevel: 'FREE',
  addAccount: jest.fn(),
  authSessions: [],
  canEditClub: () => false,
  canManageTeam: role === 'coach' || role === 'president',
  clubVerificationSummary: null,
  entitlementsSummary: null,
  freeUsageSummary: null,
  logoutMutation: { isPending: false, mutate: jest.fn() },
  refetchUserData: jest.fn(),
  subscriptionAccessLevel: 'FREE',
  switchAccount: jest.fn(),
  userData: {
    documentId: `moi-${role}`,
    firstname: 'Hugo',
    id: 7,
    lastname: 'Lemaire',
    multisportClubs: [],
    role: { name: NOMS_DE_ROLE[role], type: NOMS_DE_ROLE[role] },
  },
  userDataError: null,
  userDataLoading: false,
});

const AUTH_PAR_ROLE = {
  coach: authDe('coach'),
  parent: authDe('parent'),
  player: authDe('player'),
  president: authDe('president'),
  superAdmin: authDe('superAdmin'),
};

/** @type {renderer.ReactTestRenderer[]} */
const arbres = [];
afterEach(() => {
  arbres.splice(0).forEach((arbre) => act(() => { arbre.unmount(); }));
});

/**
 * Le texte d'un nœud rendu, descendu par `.children` (la racine comprise).
 * @param {any} noeud
 * @returns {string}
 */
const texteDe = (noeud) => {
  if (typeof noeud === 'string') return noeud;
  return (noeud?.children || []).map(texteDe).join('');
};

/**
 * Monte « Mon compte » pour un rôle.
 * @param {keyof typeof NOMS_DE_ROLE} role
 * @returns {{ arbre: renderer.ReactTestRenderer, navigation: any }}
 */
const monter = (role) => {
  mockAuth = AUTH_PAR_ROLE[role];
  const navigation = { navigate: jest.fn(), setParams: jest.fn() };
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<Profile navigation={navigation} route={{ params: {} }} />);
  });
  arbres.push(arbre);
  return { arbre, navigation };
};

/**
 * Appuie sur la rangée qui porte ce libellé.
 * @param {renderer.ReactTestRenderer} arbre
 * @param {string} libelle
 * @returns {void}
 */
const appuyerSur = (arbre, libelle) => {
  const cible = arbre.root.find((n) => typeof n.type === 'string'
    && n.props.accessibilityRole === 'button'
    && texteDe(n) === libelle);
  act(() => { cible.props.onClick?.(); cible.props.onPress?.(); });
};

/**
 * Un compte enregistre sur le telephone (une « session »).
 * @param {string} documentId
 * @param {string} prenom
 * @param {string} nomDuRole - Le nom du role en base.
 * @returns {any}
 */
const session = (documentId, prenom, nomDuRole) => ({
  user: {
    documentId, firstname: prenom, lastname: 'Test', role: { name: nomDuRole, type: nomDuRole },
  },
});

/**
 * Les lignes de texte de la liste des comptes (sous chaque nom).
 * @param {renderer.ReactTestRenderer} arbre
 * @returns {string[]}
 */
const textes = (arbre) => arbre.root
  .findAll((n) => typeof n.type === 'string' && n.type === 'Text')
  .map(texteDe);

describe('FINITIONS8 · point 9 — la liste des comptes dit le role en francais', () => {
  it('🚨 « Coach / Prof » et « Administrateur », jamais « Entraineur » ni « SuperAdmin »', () => {
    AUTH_PAR_ROLE.player.authSessions = [
      session('moi-player', 'Hugo', 'Joueur'),
      session('karim', 'Karim', 'Entraineur'),
      session('admin', 'Claude', 'SuperAdmin'),
    ];
    const { arbre } = monter('player');

    appuyerSur(arbre, 'Changer de compte');
    const lus = textes(arbre);

    expect(lus).toContain('Karim Test');
    expect(lus).toContain('Coach / Prof');
    expect(lus).toContain('Administrateur');
    expect(lus).not.toContain('Entraineur');
    expect(lus).not.toContain('SuperAdmin');
  });

  // FINITIONS14 · point 5 (T13-bis) — « Recette Mairie, Dirigeant » alors que son profil dit
  // « Membre » : le compte n'a AUCUN rôle sportif (rôle Strapi « Authenticated »), et une règle
  // de janvier le traduisait « Dirigeant ». Le dirigeant a son propre rôle (« Dirigeant »).
  it('🚨 un compte sans rôle sportif (« Authenticated ») est « Membre », comme sur sa carte', () => {
    AUTH_PAR_ROLE.player.authSessions = [
      session('moi-player', 'Hugo', 'Joueur'),
      session('mairie', 'Recette', 'Authenticated'),
    ];
    const { arbre } = monter('player');

    appuyerSur(arbre, 'Changer de compte');
    const lus = textes(arbre);

    expect(lus).toContain('Recette Test');
    expect(lus).toContain('Membre');
    expect(lus).not.toContain('Dirigeant');
  });

  it('🔒 jumeau : un vrai « Dirigeant » reste « Dirigeant »', () => {
    AUTH_PAR_ROLE.player.authSessions = [
      session('moi-player', 'Hugo', 'Joueur'),
      session('karim-d', 'Karim', 'Dirigeant'),
    ];
    const { arbre } = monter('player');

    appuyerSur(arbre, 'Changer de compte');
    expect(textes(arbre)).toContain('Dirigeant');
  });
});

// VILLE-T18B · point 4 (T18, G12b) — Hugo actif, la feuille écrit « Recette Mairie · Membre »,
// alors que « Mon compte » de Recette Mairie dit « Gestionnaire · Ville de Montrivage »
// (COLL-ACCUEIL, 01/10). Depuis FINITIONS14, la feuille suit la carte d'identité ; la carte d'un
// compte « Ville seule » a changé, la feuille non. Et la feuille ne sait d'un compte NON actif
// que ce que sa session a gardé (son rôle « Authenticated ») : la Ville qu'il gère ne se lit
// qu'en étant ce compte. ROUGE avant le lot.
describe('VILLE-T18B · point 4 — un compte « Ville seule » est « Gestionnaire »', () => {
  const { clearScoped } = jest.requireActual('@/platform/storage');
  const MONTRIVAGE = { data: [{ documentId: 'ville-montrivage', name: 'Ville de Montrivage' }] };
  const AUTH_MAIRIE = {
    ...authDe('player'),
    userData: {
      documentId: 'recette-mairie',
      firstname: 'Recette',
      id: 9,
      lastname: 'Mairie',
      multisportClubs: [],
      role: { name: 'Authenticated', type: 'authenticated' },
    },
  };
  const SESSIONS = [
    session('moi-player', 'Hugo', 'Joueur'),
    {
      user: {
        documentId: 'recette-mairie',
        firstname: 'Recette',
        lastname: 'Mairie',
        role: { name: 'Authenticated', type: 'authenticated' },
      },
    },
  ];

  /**
   * Monte « Mon compte » du compte de la mairie (il lit la Ville qu'il gère).
   * @param {any} villes - Ce que `/collectivites/mine` rend pour lui.
   * @returns {renderer.ReactTestRenderer}
   */
  const ouvrirMonCompteDeLaMairie = (villes) => {
    mockVillesGerees = villes;
    mockAuth = { ...AUTH_MAIRIE, authSessions: SESSIONS };
    /** @type {any} */
    let arbre;
    const navigation = { navigate: jest.fn(), setParams: jest.fn() };
    act(() => {
      arbre = renderer.create(<Profile navigation={navigation} route={{ params: {} }} />);
    });
    arbres.push(arbre);
    return arbre;
  };

  /**
   * La mairie ouvre « Mon compte », puis le quitte (vers un autre compte). Deux `act` : démonter
   * dans le même `act` que le montage couperait ses effets avant qu'ils ne tournent.
   * @param {any} villes - Ce que `/collectivites/mine` rend pour elle.
   * @returns {void}
   */
  const passerParMonCompteDeLaMairie = (villes) => {
    const arbre = ouvrirMonCompteDeLaMairie(villes);
    act(() => { arbre.unmount(); });
    arbres.pop();
  };

  beforeEach(() => {
    clearScoped('coll-compte:');
    mockVillesGerees = { data: [] };
  });

  it('mairie ACTIVE : la feuille dit ce que dit son en-tête, jamais « Membre »', () => {
    const arbre = ouvrirMonCompteDeLaMairie(MONTRIVAGE);

    appuyerSur(arbre, 'Changer de compte');
    const lus = textes(arbre);

    // L'en-tête de « Mon compte » ET la ligne du compte actif dans la feuille.
    expect(lus.filter((texte) => texte === 'Gestionnaire · Ville de Montrivage')).toHaveLength(2);
    expect(lus).not.toContain('Membre');
  });

  it('G12b : Hugo actif, Recette Mairie est « Gestionnaire · Ville de Montrivage »', () => {
    passerParMonCompteDeLaMairie(MONTRIVAGE);
    mockVillesGerees = { data: [] };
    AUTH_PAR_ROLE.player.authSessions = SESSIONS;
    const { arbre } = monter('player');

    appuyerSur(arbre, 'Changer de compte');
    const lus = textes(arbre);

    expect(lus).toContain('Recette Mairie');
    expect(lus).toContain('Gestionnaire · Ville de Montrivage');
    expect(lus).not.toContain('Membre');
  });

  it('🔒 jumeau : un compte qui ne gère plus de Ville redevient « Membre »', () => {
    passerParMonCompteDeLaMairie(MONTRIVAGE);
    passerParMonCompteDeLaMairie({ data: [] });
    mockVillesGerees = { data: [] };
    AUTH_PAR_ROLE.player.authSessions = SESSIONS;
    const { arbre } = monter('player');

    appuyerSur(arbre, 'Changer de compte');
    const lus = textes(arbre);

    expect(lus).toContain('Membre');
    expect(lus).not.toContain('Gestionnaire · Ville de Montrivage');
  });
});
