import renderer, { act } from 'react-test-renderer';

import HomeActionCard from '@/components/molecules/homeActionCard/HomeActionCard';
import HomeHub from '@/views/home/HomeHub';
import useMesEnfantsEnBref from '@/views/profile/parent/useMesEnfantsEnBref';

import { RouteNames } from '@/navigation/routeNames';

// REC17-001 (décision d'Adel du 17/10/2026, recette iPhone) — UNE SEULE ENTRÉE « MES ENFANTS ».
//
// La carte « Mes enfants » de l'accueil listait chaque enfant (« Romain · Demande en attente »,
// « Greg · Pas encore d'équipe »), chacun avec SA flèche, en plus de la flèche de la carte.
// Adel : choisir l'enfant depuis l'accueil n'est pas intuitif ⇒ la carte ouvre « Mes enfants »,
// et c'est LÀ qu'on choisit l'enfant. Cette décision remplace « une ligne d'enfant → sa fiche »
// du design E01 (PAR-L7 + L12).
//
// 🔬 Ce témoin MONTE le vrai `HomeHub` (ses voisins lisent sa source comme du texte) : il lit
// ce que l'écran rend, avec 0, 1 puis 3 enfants, pour le parent, pour un sportif qui a des
// enfants (la carte en fin de « Rechercher ») et pour ce sportif en mode parent. Les contextes
// et les services sont doublés ; la carte, elle, est la vraie (`HomeActionCard`).

/** @type {any} */
let mockAuth;

jest.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: () => 0,
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
  useIsFocused: () => true,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('react-i18next', () => {
  const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;

  return {
    useTranslation: () => ({
      t: (/** @type {string} */ cle, /** @type {any} */ repli) => {
        const valeur = String(cle || '')
          .split('.')
          .reduce((noeud, segment) => (noeud == null ? undefined : noeud[segment]), catalogue);
        if (typeof valeur === 'string') return valeur;
        return typeof repli === 'string' ? repli : cle;
      },
    }),
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuth,
}));

// Chaque image du thème rend SON nom : une flèche se reconnaît (`arrowRight`), et chaque
// carte reçoit son illustration (`homeIllustrations.<icône>`).
jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyles = jest.requireActual('@/theme/applicationStyle').default;
  const alignements = jest.requireActual('@/theme/alignements').default;
  const espaces = jest.requireActual('@/theme/spaces').default;
  const couleurs = genererCouleurs();
  const illustrations = new Proxy({}, {
    get: (_cible, cle) => ({ uri: `illustration:${String(cle)}` }),
  });
  const images = new Proxy({}, {
    get: (_cible, cle) => (cle === 'homeIllustrations' ? illustrations : { uri: String(cle) }),
  });

  return {
    __esModule: true,
    default: () => ({
      Alignments: alignements,
      ApplicationStyle: genererStyles(couleurs),
      Colors: couleurs,
      Fonts: genererPolices(couleurs),
      Images: images,
      Spaces: espaces,
    }),
  };
});

jest.mock('@/context/AppModeContext', () => ({
  useAppMode: () => ({ isGold: false, toggleMode: () => {} }),
}));
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: () => {} }),
}));
jest.mock('@/context/BlockingOverlayContext', () => ({
  useBlockingOverlayLifecycle: () => {},
}));
jest.mock('@/context/ClubScopeContext', () => ({
  useClubScope: () => ({}),
}));
jest.mock('@/context/OnboardingContext', () => ({
  useOnboarding: () => ({
    currentStep: null,
    currentStepIndex: -1,
    getStepById: () => null,
    isActive: false,
    refreshCurrentStep: () => {},
    startOnboarding: () => {},
  }),
}));
jest.mock('@/context/PopupManagerContext', () => ({
  usePopupEligibility: () => ({ descriptor: { id: 'home-hub-entry-gate' }, isEligible: false }),
}));
jest.mock('@/context/StartupPhaseContext', () => ({
  useStartupPhase: () => ({
    canShowLocalScreenPrompt: false,
    hasRecentStartupPrompt: false,
    isStartupStable: true,
  }),
}));
jest.mock('@/context/TourContext', () => ({
  useTour: () => ({ currentStep: null }),
}));
jest.mock('@/domains/tutorial/useFeatureTutorial', () => ({
  __esModule: true,
  default: () => ({
    entryGateChoice: 'done',
    markSeen: () => {},
    resetAllTutorials: () => {},
    resetTutorial: () => {},
    setAutoEnabled: () => {},
    setEntryChoice: () => {},
    shouldForceStart: false,
    skipAllAuto: () => {},
  }),
}));
jest.mock('@/hooks/useTraining', () => ({
  useMyTraining: () => ({ enrollment: null, nextSession: null }),
}));
jest.mock('@/services/home/homeSummaryQueries', () => ({
  useHomeSummary: () => ({ data: undefined }),
}));
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useAdminCollectivitesATraiter: () => ({ demandesGestionnaire: 0, mairiesAActiver: 0 }),
}));
jest.mock('@/views/home/useHomeEventAnswer', () => ({
  useHomeEventAnswer: () => ({
    answer: null, canAnswer: false, isAnswering: false, sentAnswer: null, submit: () => {},
  }),
}));

// Les enfants : la doublure commune (`parent/__mocks__/useMesEnfantsEnBref.js`).
jest.mock('@/views/profile/parent/useMesEnfantsEnBref');

// Le décor de l'écran : rien, ou ses enfants seulement.
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock(
  '@/components/molecules/tutorial/TutorialFlowBoundary',
  () => function TutorialFlowBoundaryMock({ children }) { return children; },
);
jest.mock(
  '@/components/molecules/onboardingWrapper/OnboardingWrapper',
  () => function OnboardingWrapperMock({ children }) { return children; },
);
jest.mock('@/components/molecules/bottomModal/BottomModal', () => () => null);
jest.mock('@/components/molecules/header/LeagueHeaderSwitch', () => () => null);
jest.mock('@/components/molecules/homeHeadBanner/HomeHeadBanner', () => () => null);
jest.mock('@/components/molecules/notificationBadge/NotificationBadge', () => () => null);
jest.mock('@/components/molecules/playerModeBanner/PlayerModeBanner', () => () => null);
jest.mock('@/components/molecules/profileButton/ProfileButton', () => () => null);
jest.mock(
  '@/components/molecules/subscriptionPaywallSheet/SubscriptionPaywallSheet',
  () => () => null,
);
jest.mock(
  '@/components/organisms/externalCompetitionPromptGate/ExternalCompetitionPromptGate',
  () => () => null,
);
jest.mock('@/components/organisms/popup/GlobalPromptModal', () => () => null);
jest.mock('@/views/collectivite/components/BandeauActualiteVille', () => ({
  BandeauActualiteMembre: () => null,
}));
jest.mock('@/views/collectivite/components/CollectivitePorteRow', () => () => null);
jest.mock('@/views/home/FeuillePratiqueAussi', () => () => null);

const TITRE = 'Mes enfants';

/** Les enfants tels que le crochet les rend : prénom et où il en est. */
const ENFANTS = [
  { cle: 'fiche-romain', etat: 'Demande en attente', prenom: 'Romain' },
  { cle: 'fiche-greg', etat: 'Pas encore d’équipe', prenom: 'Greg' },
  { cle: 'compte-lina', etat: 'Elle a son compte', prenom: 'Lina' },
];

/**
 * Régler la doublure sur N enfants.
 * @param {number} combien - 0, 1 ou 3.
 * @returns {void}
 */
const avecEnfants = (combien) => {
  /** @type {any} */ (useMesEnfantsEnBref).regler({
    lignes: ENFANTS.slice(0, combien),
    reste: 0,
    total: combien,
  });
};

/**
 * Le compte connecté.
 * @param {string} role - Le nom du rôle serveur (« Parent », « Joueur »).
 * @param {{ modeParent?: boolean }} [options] - Le sportif a choisi le mode parent.
 * @returns {any} - Ce que rend `useAuth`.
 */
const compte = (role, { modeParent = false } = {}) => ({
  canUseParentMode: true,
  canUsePlayerMode: false,
  freeUsageSummary: null,
  isParentMode: modeParent,
  isPlayerMode: false,
  setDisplayMode: () => {},
  subscriptionAccessLevel: 'free',
  userData: {
    documentId: 'compte-yb',
    firstname: 'Yanis',
    role: { name: role },
  },
  userDataError: null,
  userDataLoading: false,
});

/**
 * Monter l'accueil.
 * @returns {{ arbre: any, navigate: jest.Mock }} - L'arbre rendu et la navigation espionnée.
 */
const monterLAccueil = () => {
  const navigate = jest.fn();
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <HomeHub
        navigation={{
          addListener: () => () => {},
          getParent: () => null,
          navigate,
          setParams: () => {},
        }}
        route={{ params: {} }}
      />,
    );
  });
  return { arbre, navigate };
};

/**
 * Un élément natif (pas un composant) qui vérifie une condition.
 * @param {(props: any) => boolean} condition - La condition sur ses propriétés.
 * @returns {(noeud: any) => boolean} - Le filtre.
 */
const natif = (condition) => (noeud) => typeof noeud.type === 'string' && condition(noeud.props);

/**
 * Tous les textes rendus sous un nœud, à plat.
 * @param {any} noeud - Un nœud de `react-test-renderer`.
 * @returns {string} - Les textes, joints par « | ».
 */
const textesSous = (noeud) => noeud
  .findAll(natif(() => true))
  .flatMap((/** @type {any} */ n) => [].concat(n.props.children))
  .filter((/** @type {any} */ morceau) => typeof morceau === 'string')
  .join(' | ');

/**
 * Les cartes « Mes enfants » rendues sur l'accueil.
 * @param {any} arbre - L'accueil monté.
 * @returns {any[]} - Les cartes.
 */
const cartesMesEnfants = (arbre) => arbre.root.findAll(
  (/** @type {any} */ n) => n.type === HomeActionCard && n.props.title === TITRE,
);

/**
 * Ce que doit montrer la carte, quel que soit le nombre d'enfants.
 * @param {any} arbre - L'accueil monté.
 * @param {jest.Mock} navigate - La navigation espionnée.
 * @returns {void}
 */
const uneSeuleEntree = (arbre, navigate) => {
  const cartes = cartesMesEnfants(arbre);
  expect(cartes).toHaveLength(1);
  const [carte] = cartes;
  // UNE zone touchable, nommée « Mes enfants » pour le lecteur d'écran.
  const boutons = carte.findAll(natif((props) => props.accessibilityRole === 'button'));
  expect(boutons.map((/** @type {any} */ b) => b.props.accessibilityLabel)).toEqual([TITRE]);
  const appuis = new Set(carte
    .findAll(natif((props) => typeof props.onClick === 'function'
      || typeof props.onResponderRelease === 'function'))
    .map((/** @type {any} */ n) => n.props.onClick || n.props.onResponderRelease));
  expect(appuis.size).toBe(1);
  // UNE flèche (celle de la carte), aucune flèche par enfant.
  expect(carte.findAll(natif((props) => props.source?.uri === 'arrowRight'))).toHaveLength(1);
  // Le titre, et aucun prénom ni statut d'enfant.
  const textes = textesSous(carte);
  expect(textes).toContain(TITRE);
  ENFANTS.forEach(({ etat, prenom }) => {
    expect(textes).not.toContain(prenom);
    expect(textes).not.toContain(etat);
  });
  expect(carte.findAll(natif((props) => String(props.testID || '').startsWith('home-card-line-'))))
    .toHaveLength(0);
  // L'illustration de la carte est là.
  expect(carte.findAll(natif((props) => props.source?.uri === 'illustration:users')))
    .toHaveLength(1);
  // Un appui ouvre « Mes enfants ».
  act(() => {
    carte.props.onPress();
  });
  expect(navigate).toHaveBeenCalledWith(RouteNames.ProfileStack, { screen: RouteNames.MyChildren });
};

describe('REC17-001 — l accueil n a qu UNE entrée « Mes enfants »', () => {
  afterEach(() => {
    /** @type {any} */ (useMesEnfantsEnBref).regler();
  });

  it.each([0, 1, 3])('le parent avec %i enfant(s) : une carte, un appui, aucun prénom', (n) => {
    mockAuth = compte('Parent');
    avecEnfants(n);
    const { arbre, navigate } = monterLAccueil();
    uneSeuleEntree(arbre, navigate);
    act(() => arbre.unmount());
  });

  // Sa PLACE (en fin de « Rechercher ») est gardée par `accueilParRole.test.js`.
  it('un sportif qui a des enfants : la même carte', () => {
    mockAuth = compte('Joueur');
    avecEnfants(3);
    const { arbre, navigate } = monterLAccueil();
    uneSeuleEntree(arbre, navigate);
    act(() => arbre.unmount());
  });

  it('le même sportif en mode parent : la même carte', () => {
    mockAuth = compte('Joueur', { modeParent: true });
    avecEnfants(3);
    const { arbre, navigate } = monterLAccueil();
    uneSeuleEntree(arbre, navigate);
    act(() => arbre.unmount());
  });

  it('un sportif sans enfant n a pas la carte (inchangé)', () => {
    mockAuth = compte('Joueur');
    avecEnfants(0);
    const { arbre } = monterLAccueil();
    expect(cartesMesEnfants(arbre)).toHaveLength(0);
    act(() => arbre.unmount());
  });
});
