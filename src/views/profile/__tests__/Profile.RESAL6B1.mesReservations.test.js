// RESA-L6B-1 (19/10/2026) — L'ENTRÉE « MES RÉSERVATIONS » DANS « MON COMPTE » (E-P10).
// Planche EP10 état 5 (toile BLG79NHv2, choix du design S-19 validé avec les planches le 13/10) :
// « Mes réservations » en TÊTE de « Mon compte » pour tout pratiquant, avec le nombre de
// réservations à venir ; « Mes complexes favoris » (E-P11) attend le serveur L4 (RESA-L6B-2).
// Interrupteur `COMPLEXES_JOUEUR` éteint : la rangée n'existe pas (comme staging).
// Banc repris de Profile.monCompte.test.js (mêmes doublures).

import renderer, { act } from 'react-test-renderer';

import { RouteNames } from '@/navigation/routeNames';

// 📌 L'INVENTAIRE DES RANGÉES de `Profile.js` — l'écran « Mon compte » ouvert
// par l'avatar. Posé par le lot ACCUEIL (audit V1, 30/09), AVANT que A17/A21 n'y
// rangent les cases que l'accueil abandonne.
// 🩹 Corrigé le jour même : l'écran avait DÉJÀ six suites (`Profile.menuProfil`,
// `.roleParent`, `.langue`, `.deleteAccount`, `.maCollectivite`,
// `.abonnementClubCouvert`) — une recherche par chemin absolu les avait ratées
// (elles importent `../Profile`). Aucune ne dressait la liste COMPLÈTE des
// rangées rôle par rôle : c'est ce que celle-ci ajoute.
//
// 🎯 CE QUI EST MESURÉ : les RANGÉES du menu, rôle par rôle, dans l'ordre de
// l'écran, et OÙ chacune mène. C'est la seule chose qui compte pour A17 : une
// case retirée de l'accueil doit garder son chemin d'ici.
// ⛔ Ce qui n'est PAS mesuré : la carte d'identité, la carte d'abonnement (hors
// sa présence), la fenêtre de changement de compte. Les briques d'affichage
// sont doublées ; la couture est le TEXTE visible et la route appelée.

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
// PAR-L7 (13/10) — « Mon compte » d'un parent compte ses enfants : doublure commune.
jest.mock('@/views/profile/parent/useMesEnfantsEnBref');
jest.mock('@/services/collectivite/collectiviteQueries', () => {
  const aucune = { data: [] };
  // COLL-ACCUEIL (01/10) : la pastille de la rangee de la Ville lit les demandes en attente.
  return { useCollectiviteRequests: () => aucune, useMyCollectivites: () => aucune };
});
jest.mock('@/config/legalUrls', () => ({ SUPPORT_CONTACT_MAILTO: 'mailto:contact@exemple.test' }));

// RESA-L6B-1 — l'interrupteur, lu à l'appel (une liaison vivante : chaque test le pose).
let mockJoueur = true;
jest.mock('@/config/fonctionsMasquees', () => {
  // ⚠️ Pas de `get` dans un objet étalé (`...`) : l'étalement l'évalue UNE fois, à la création.
  const doublure = { ...jest.requireActual('@/config/fonctionsMasquees') };
  Object.defineProperty(doublure, 'COMPLEXES_JOUEUR', { get: () => mockJoueur });
  return doublure;
});
/** @type {any[]} */
let mockAVenir = [];
const mockPeriodes = jest.fn();
jest.mock('@/services/complexe/complexeJoueurQueries', () => ({
  useMesReservations: (/** @type {string} */ periode) => {
    mockPeriodes(periode);
    return { data: mockAVenir };
  },
}));

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
 * Les rangées-boutons de l'écran, DANS L'ORDRE, par leur texte (nœuds hôtes seuls :
 * un `TouchableOpacity` en expose deux).
 * @param {renderer.ReactTestRenderer} arbre
 * @returns {string[]}
 */
const rangees = (arbre) => arbre.root
  .findAll((n) => typeof n.type === 'string' && n.props.accessibilityRole === 'button')
  .map(texteDe)
  .filter(Boolean);

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

// E6 — la liste des rangées d'AVANT le lot (posée et verte sur `62e47c34`, commit
// `0f8d4357`) est remplacée par celle d'A17, plus bas : seule la ligne des rôles
// change (deux rangées en plus). Reste ici ce qui ne bouge pas.

/**
 * Le texte des rangées d'activité, dans l'ordre.
 * @param {renderer.ReactTestRenderer} arbre
 * @returns {string[]}
 */
const lignes = (arbre) => rangees(arbre);

beforeEach(() => {
  mockJoueur = true;
  mockAVenir = [];
  mockPeriodes.mockClear();
});

describe('RESA-L6B-1 — « Mes réservations » dans « Mon compte »', () => {
  it('en tête de la rubrique, avant « Ma carte de collection » ; elle ouvre E-P10', () => {
    const { arbre, navigation } = monter('player');
    const ordre = lignes(arbre);
    const rang = ordre.findIndex((texte) => texte.startsWith('Mes réservations'));
    expect(rang).toBeGreaterThanOrEqual(0);
    expect(rang).toBeLessThan(ordre.indexOf('Ma carte de collection'));
    appuyerSur(arbre, 'Mes réservations');
    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.ReserverMesReservations);
  });

  it('le nombre de réservations à venir, s’il y en a (« 0 » ne s’écrit pas)', () => {
    mockAVenir = [{ documentId: 'r-1' }, { documentId: 'r-2' }, { documentId: 'r-3' }];
    const avec = monter('coach').arbre;
    expect(lignes(avec)).toContain('Mes réservations3');
    expect(mockPeriodes).toHaveBeenCalledWith('a-venir');
    mockAVenir = [];
    const sans = monter('coach').arbre;
    expect(lignes(sans)).toContain('Mes réservations');
  });

  it('un parent : après sa famille (« Mes enfants » d’abord, PAR-L7)', () => {
    const ordre = lignes(monter('parent').arbre);
    expect(ordre.indexOf('Mes réservations')).toBeGreaterThan(ordre.indexOf('Mes enfants'));
  });

  it('interrupteur éteint : aucune rangée de plus, rien n’est lu (comme staging)', () => {
    mockJoueur = false;
    const ordre = lignes(monter('player').arbre);
    expect(ordre.some((texte) => texte.startsWith('Mes réservations'))).toBe(false);
    expect(mockPeriodes).not.toHaveBeenCalled();
  });
});
