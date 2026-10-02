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
jest.mock('@/services/collectivite/collectiviteQueries', () => {
  const aucune = { data: [] };
  // COLL-ACCUEIL (01/10) : la pastille de la rangee de la Ville lit les demandes en attente.
  return { useCollectiviteRequests: () => aucune, useMyCollectivites: () => aucune };
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
  it('🚨 « Entraîneur » et « Administrateur », jamais « Entraineur » ni « SuperAdmin »', () => {
    AUTH_PAR_ROLE.player.authSessions = [
      session('moi-player', 'Hugo', 'Joueur'),
      session('karim', 'Karim', 'Entraineur'),
      session('admin', 'Claude', 'SuperAdmin'),
    ];
    const { arbre } = monter('player');

    appuyerSur(arbre, 'Changer de compte');
    const lus = textes(arbre);

    expect(lus).toContain('Karim Test');
    expect(lus).toContain('Entraîneur');
    expect(lus).toContain('Administrateur');
    expect(lus).not.toContain('Entraineur');
    expect(lus).not.toContain('SuperAdmin');
  });
});
