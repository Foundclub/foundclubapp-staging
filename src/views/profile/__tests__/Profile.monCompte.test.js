/* eslint-disable max-len -- donnees de test : les fixtures se lisent mieux sur une ligne */
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

// R17-SIGNALER-1 : « Mes signalements » lit ses signalements (doublure, pas de reseau).
/** @type {any} */
let mockMesSignalements = { data: null };
jest.mock('@/services/facilityReport/facilityReportQueries', () => ({
  useMyFacilityReports: () => mockMesSignalements,
}));
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
// RESA-L6B-1 — le nombre de « Mes réservations » (rangée cachée par COMPLEXES_JOUEUR) lit le
// serveur des complexes : doublé ici comme les autres services de « Mon compte ».
jest.mock('@/views/reserverTerrain/components/NombreAVenir', () => () => null);
jest.mock('@/services/collectivite/collectiviteQueries', () => {
  const aucune = { data: [] };
  // COLL-ACCUEIL (01/10) : la pastille de la rangee de la Ville lit les demandes en attente.
  return { useCollectiviteRequests: () => aucune, useMyCollectivites: () => aucune, useMyManagerRequests: () => ({ data: [] }) };
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
  mockMesSignalements = { data: null };
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
describe('E6 — « Mon compte » : ce qui ne bouge pas', () => {
  it('« Voir mon profil » ouvre la page profil, « Gérer mes alertes » les alertes', () => {
    const { arbre, navigation } = monter('player');

    appuyerSur(arbre, 'Voir mon profil');
    appuyerSur(arbre, 'Gérer mes alertes');

    expect(navigation.navigate.mock.calls).toEqual([
      // RW-PARENT (29/10) — avec SON identifiant : sans lui, le site ouvrait /users/:userId.
      [RouteNames.UserDetails, { userId: 'moi-player' }],
      [RouteNames.SearchAlerts],
    ]);
  });
});

// A17 + A21 (décision d'Adel du 30/09, option A) : les rubriques « Mon profil » et
// « Compte » quittent l'accueil pour « Mon compte ». Celui-ci gagne les deux
// lignes qui lui manquaient — « Historique sportif » et « Mes cotisations » —,
// avec les MÊMES règles de rôle qu'à l'accueil : pas d'historique ni de
// cotisation pour le parent (P0), pas de cotisation pour le super admin (D72).
describe('A17 + A21 — « Mon compte » reçoit les cases que l accueil abandonne', () => {
  // CARTECODE Q1 C : « Confidentialité » (compte privé) suit « Personnes bloquées ».
  const COMPTE = ['Changer de compte', 'Personnes bloquées', 'Confidentialité', 'Nous contacter'];

  it.each([
    ['player', [
      'Ma carte de collection', 'Voir mon profil', 'Historique sportif', 'Mes cotisations',
      'Mes enfants', 'Gérer mes alertes', ...COMPTE, 'Déconnexion',
    ]],
    // TUTOE (27/10) : le guide Entraîneur se relance d'ici (règle 7 du pack).
    ['coach', [
      'Voir le détail des offres',
      'Ma carte de collection', 'Voir mon profil', 'Historique sportif', 'Mes cotisations',
      'Mes enfants', 'Gérer mes alertes', 'Gérer mes demandes',
      'Changer de compte', 'Personnes bloquées', 'Confidentialité', 'Guide entraîneur·e',
      'Nous contacter', 'Déconnexion',
    ]],
    ['president', [
      'Voir le détail des offres',
      'Ma carte de collection', 'Voir mon profil', 'Historique sportif', 'Mes cotisations',
      'Mes enfants', 'Gérer mes alertes', 'Gérer mes demandes', ...COMPTE, 'Déconnexion',
    ]],
    ['superAdmin', [
      'Voir le détail des offres',
      'Ma carte de collection', 'Voir mon profil', 'Modifier mon profil', 'Historique sportif',
      'Mes enfants', 'Gérer mes alertes', ...COMPTE,
      'Dashboard admin classique', 'Dashboard League', 'Déconnexion',
    ]],
    // Le parent n'avait ni l'une ni l'autre sur l'accueil (P0) : rien ne change pour lui.
    // PAR-L7 (13/10, design parent E02, D1 A) — SA FAMILLE D'ABORD : « Mes enfants » ouvre la
    // section, puis son profil, ses alertes, et sa carte de collection en dernier (planche 1).
    ['parent', [
      'Mes enfants', 'Voir mon profil', 'Modifier mon profil', 'Gérer mes alertes',
      'Ma carte de collection', ...COMPTE, 'Déconnexion',
    ]],
  ])('%s', (role, attendu) => {
    const { arbre } = monter(/** @type {any} */ (role));

    expect(rangees(arbre)).toEqual(attendu);
  });

  it('« Historique sportif » ouvre l ajout d une expérience, et referme sur « Mon compte »', () => {
    // Sans `returnRoute`, l'assistant fait `goBack()` en fin de saisie
    // (`HistoryWizardSingle.js`, handleSuccess) : on retrouve « Mon compte ».
    const { arbre, navigation } = monter('player');

    appuyerSur(arbre, 'Historique sportif');

    expect(navigation.navigate.mock.calls).toEqual([
      [RouteNames.HistoryWizardCategory, { resetContext: true }],
    ]);
  });

  it('« Mes cotisations » ouvre la liste des cotisations', () => {
    const { arbre, navigation } = monter('player');

    appuyerSur(arbre, 'Mes cotisations');

    expect(navigation.navigate.mock.calls).toEqual([[RouteNames.MyLicenses]]);
  });
});

// 🧾 LE TABLEAU AVANT / APRÈS — une ligne par case que l'accueil a perdue. Chaque
// ligne dit : la case de l'accueil, les rôles qui l'avaient (`accueilParRole
// .test.js`, version d'avant le lot), et le geste qui y mène depuis « Mon compte ».
// FINI QUAND : 0 destination perdue.
describe('A17 + A21 — aucune destination de l accueil n est perdue', () => {
  const TOUS = ['player', 'coach', 'president', 'superAdmin', 'parent'];

  /**
   * La vérification « ce geste a ouvert cette route ».
   * @param {...any} appel - Les arguments attendus de `navigate`.
   * @returns {(contexte: { navigation: any }) => void}
   */
  // RW-PARENT (29/10) — « Voir mon profil » porte l'identifiant du compte (`moi-<rôle>`).
  const MON_IDENTIFIANT = expect.objectContaining({ userId: expect.stringMatching(/^moi-/) });
  const ouvre = (...appel) => (/** @type {any} */ { navigation }) => {
    expect(navigation.navigate).toHaveBeenCalledWith(...appel);
  };

  it.each([
    ['Voir mon profil', TOUS, 'Voir mon profil', ouvre(RouteNames.UserDetails, MON_IDENTIFIANT)],
    // D41 (arbitrage d'Adel du 08/08) : la page profil du staff ÉDITE — sa porte
    // vers le formulaire est le crayon de la carte d'identité (dirigeant) ou
    // l'édition sur place (entraîneur, D39). Le super admin garde la rangée.
    ['Modifier mon profil', ['superAdmin'], 'Modifier mon profil', ouvre(RouteNames.ProfileEdit)],
    ['Modifier mon profil', ['coach', 'president'], 'Voir mon profil',
      ouvre(RouteNames.UserDetails, MON_IDENTIFIANT)],
    ['Historique sportif', ['player', 'coach', 'president', 'superAdmin'], 'Historique sportif',
      ouvre(RouteNames.HistoryWizardCategory, { resetContext: true })],
    ['Gérer mes alertes', TOUS, 'Gérer mes alertes', ouvre(RouteNames.SearchAlerts)],
    ['Mes cotisations', ['player', 'coach', 'president'], 'Mes cotisations',
      ouvre(RouteNames.MyLicenses)],
    ['Changer de compte', TOUS, 'Changer de compte', ({ arbre }) => {
      expect(rangees(arbre)).toContain('Ajouter un compte');
    }],
    ['Déconnexion', TOUS, 'Déconnexion', ({ role }) => {
      expect(AUTH_PAR_ROLE[role].logoutMutation.mutate).toHaveBeenCalledTimes(1);
    }],
  ])('« %s » (%j) : %s', (_caseDeLAccueil, roles, rangee, verifier) => {
    roles.forEach((role) => {
      AUTH_PAR_ROLE[role].logoutMutation.mutate.mockClear();
      const { arbre, navigation } = monter(/** @type {any} */ (role));

      appuyerSur(arbre, rangee);

      verifier({ arbre, navigation, role });
    });
  });
});

// 🧮 VILLE-T18B point 3 (07/10) — tournée T18, capture G12 (« Mon compte » de Recette Mairie) : la
// rangée « Changer de compte » montrait un CARRÉ BLEU PLEIN. Son image était `share2.png`, une
// TUILE opaque (fond bleu, glyphe noir), que la rangée teinte en entier (`tintColor`). La planche
// P1-porte-tel dessine l'icône « personnes » (`i-personnes`). La rangée est commune à tous les
// comptes. ROUGE avant le lot.
describe('VILLE-T18B point 3 — « Changer de compte » porte une icône, pas une tuile pleine', () => {
  /**
   * L'image teintée d'une rangée, par le nom que la doublure du thème lui donne.
   * @param {renderer.ReactTestRenderer} arbre
   * @param {string} libelle
   * @returns {string | undefined}
   */
  const iconeDe = (arbre, libelle) => {
    const rangee = arbre.root.find((n) => typeof n.type === 'string'
      && n.props.accessibilityRole === 'button'
      && texteDe(n) === libelle);
    const [image] = rangee.findAll((n) => typeof n.type === 'string' && n.props.source);
    return image?.props.source?.testUri;
  };

  it.each(['player', 'coach', 'president', 'superAdmin', 'parent'])(
    '%s : l’icône « personnes » de la planche, jamais la tuile share2',
    (role) => {
      const { arbre } = monter(/** @type {any} */ (role));
      expect(iconeDe(arbre, 'Changer de compte')).toBe('users');
    },
  );
});

// R17-SIGNALER-1 (19/10/2026, REC17-011 ; planche P11-securite-ou-ca-vit 6, validée par Adel) —
// « Mes signalements » n apparaît dans « Mon compte » que si l on en a envoyé AU MOINS UN ;
// « n en cours » tant que la Ville ne les a pas clos. Elle ouvre la liste.
describe('R17-SIGNALER-1 — « Mon compte » : la rangée « Mes signalements »', () => {
  const ENVOYE = { documentId: 'sig-1', status: 'envoye' };
  const RESOLU = { documentId: 'sig-0', status: 'resolu' };

  it('2 envoyés, 1 en cours : « Mes signalements · 1 en cours », elle ouvre la liste', () => {
    mockMesSignalements = { data: { data: [ENVOYE, RESOLU], meta: { openCount: 1 } } };
    const { arbre, navigation } = monter('player');
    expect(rangees(arbre)).toContain('Mes signalements · 1 en cours');
    appuyerSur(arbre, 'Mes signalements · 1 en cours');
    expect(navigation.navigate).toHaveBeenCalledWith(RouteNames.MyFacilityReports);
  });

  it('tous clos : « Mes signalements », sans compteur', () => {
    mockMesSignalements = { data: { data: [RESOLU], meta: { openCount: 0 } } };
    expect(rangees(monter('player').arbre)).toContain('Mes signalements');
  });

  it('aucun envoyé (ou liste pas encore lue) : la rangée est ABSENTE', () => {
    mockMesSignalements = { data: { data: [], meta: { openCount: 0 } } };
    const signalements = (/** @type {string} */ role) => rangees(
      monter(/** @type {any} */ (role)).arbre,
    ).filter((rangee) => rangee.startsWith('Mes signalements'));
    expect(signalements('player')).toEqual([]);
    mockMesSignalements = { data: null };
    expect(signalements('coach')).toEqual([]);
  });
});
