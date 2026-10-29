import { Alert } from 'react-native';
import { act, create } from 'react-test-renderer';

import { createWebNavigationAdapter } from '@/navigation/webNavigationAdapter';

import ClubWizardRecap from '../ClubWizardRecap';

// RECETTE-WEB-DIRIGEANT (29/10) — SUR LE SITE, CRÉER SON CLUB PENDANT L'INSCRIPTION MÈNE À LA
// SUITE DU TUNNEL, PLUS À « TROUVER MON CLUB ».
//
// Constaté sur la recette (compte neuf « Dina Recette », +33777777777) : après « Créer mon
// club » (201), le dirigeant arrivait sur la liste générale des clubs au lieu du sas d'arrivée
// (offres, Bienvenue). Au téléphone, l'écran va à l'étape suivante PUIS vide la sous-pile du club
// (filet T10) : deux piles. Sur le site il n'y a qu'une adresse, et l'adaptateur de navigation est
// son propre parent : le second geste remplaçait l'adresse que le premier venait d'ouvrir.
// Doublures reprises du filet T10 (clubWizardOnboardingAtterrissage.test.js).

/** @type {any[]} */
const mockProprietesEtape = [];
const mockClubCree = { club: { documentId: 'club-neuf' } };
const mockCreerClub = jest.fn(async () => mockClubCree);
const mockActivites = { data: [] };
const mockEquipesDemandees = jest.fn();
const mockRequeteEquipes = jest.fn();

// Le rafraichissement du profil, pilote a la main : c'est le seul moyen de
// prouver qu'on l'ATTEND. `resoudre()` le laisse aboutir.
const mockRafraichissement = {
  /** @type {(() => void) | null} */ resoudre: null,
};
const rafraichirProfil = jest.fn(() => new Promise((resolve) => {
  mockRafraichissement.resoudre = () => resolve({ data: mockAuthentification.userData });
}));
// AA04 — la doublure du cache apprend `setQueriesData` : c'est par la que le
// club fraichement cree entre dans le profil de l'app (le serveur, lui, sert
// `/firebase-auth/me` depuis un cache de 60 s a 4 min qu'il n'invalide pas).
const mockClientRequete = {
  invalidateQueries: jest.fn(async () => undefined),
  setQueriesData: jest.fn(),
};

// Objet FIGE : un contexte neuf a chaque rendu relance les effets qui en
// dependent et fait tourner Jest en boucle infinie, sans message.
const mockEtatTunnel = Object.freeze({
  activityDocumentIds: [],
  addressOption: {
    label: '12 rue du Stade, Lyon', lat: 45.75, lng: 4.85,
  },
  email: 'contact@club.test',
  name: 'Club de la Duchere',
  phoneNumber: '0400000000',
});

// L'ENTRAINEUR D'ADEL, AU MOMENT DU POP-UP : aucun club a lui, et une demande
// d'adhesion `pending` sur le club qu'il a consulte en cherchant.
const mockAuthentification = {
  getNextOnboardingRoute: () => 'Welcome',
  getPostOnboardingHomeRoute: () => 'HomeTab',
  refetchUserData: rafraichirProfil,
  userData: /** @type {any} */ (null),
  userDataError: null,
  userDataLoading: false,
};

jest.mock('@tanstack/react-query', () => ({
  // `mutate` appelle vraiment `mutationFn` puis `onSuccess` : sans ca, rien ne
  // prouverait l'envoi des demandes d'equipe.
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => Promise.resolve(options.mutationFn(variables))
      .then((data) => options.onSuccess?.(data))
      .catch((error) => options.onError?.(error)),
  }),
  useQueryClient: () => mockClientRequete,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 34, left: 0, right: 0, top: 59,
  }),
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuthentification,
}));

jest.mock('@/domains/auth/authUseCases', () => ({
  // FINITIONS-VILLE (« créateur C ») : le récapitulatif lit le rôle (« Qui dirige ce club ? »).
  getUserRoleKey: jest.requireActual('@/domains/auth/authUseCases').getUserRoleKey,
  // Le rattachement est mesure ailleurs (`parcoursNouveauDirigeant`) : ici on
  // garde la VRAIE fonction, pour ne pas rendre ce filet aveugle a une
  // regression de sa signature.
  attachCreatedClubToProfile: jest.requireActual('@/domains/auth/authUseCases')
    .attachCreatedClubToProfile,
  markOnboardingComplete: jest.fn(),
}));

// Le VRAI theme, sans le contexte React qui le porte. Un mock en Proxy rend les
// echecs Jest illisibles (constat du lot paywall, 2026-08-02).
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
      Images: {},
      Spaces: espaces,
    }),
  };
});

// ⛔ Jamais `requireActual` sur un service : le client HTTP refuse de se charger
// sans `API_URL` et fait tomber la suite AVANT le premier rendu.
jest.mock('@/services/club/clubService', () => ({
  createSelfOnboardClub: (/** @type {any} */ ...arguments_) => mockCreerClub(...arguments_),
}));

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => mockActivites,
}));

jest.mock('../ClubWizardContext', () => ({
  useClubWizard: () => ({ dispatch: jest.fn(), state: mockEtatTunnel }),
}));

// Les equipes rendues DEPENDENT du club demande : c'est ce qui rend le mauvais
// club visible a l'ecran plutot que cache dans un appel.
jest.mock('@/services/team/teamQueries', () => ({
  useGetTeams: (/** @type {any} */ parametres, /** @type {any} */ options) => (
    mockRequeteEquipes(parametres, options)
  ),
}));

jest.mock('@/services/teamMembershipRequest/teamMembershipRequestService', () => ({
  createTeamMembershipRequest: (/** @type {any} */ charge) => (
    mockEquipesDemandees(charge)
  ),
}));

jest.mock('@/components/molecules/wizardOptionCard/WizardOptionCard', () => function CarteMock() {
  return null;
});

// La doublure capture les props et rend `null` : on pilote le tunnel par ses
// boutons (`onNext`, `onBack`), pas par la forme de son arbre.
jest.mock(
  '@/components/molecules/wizardStepLayout/WizardStepLayout',
  () => function EtapeMock(/** @type {any} */ props) {
    mockProprietesEtape.push(props);
    return null;
  },
);

// Doublures d'affichage de l'etape « equipes entrainees » : un pressable qui
// PORTE son titre, et des conteneurs qui rendent leurs enfants.
jest.mock('@/components/atoms/button/Button', () => {
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  const { createElement: creer } = jest.requireActual('react');
  return {
    __esModule: true,
    default: (/** @type {any} */ { disabled, onPress, title }) => creer(
      PressableRN,
      { accessibilityRole: 'button', disabled, onPress },
      creer(TexteRN, null, title),
    ),
  };
});

jest.mock('@/components/templates/FormScreenContainer', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  const { createElement: creer } = jest.requireActual('react');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => creer(VueRN, null, children),
  };
});

jest.mock('@/views/onboarding/components/OnboardingStickyFooter', () => {
  const { View: VueRN } = jest.requireActual('react-native');
  const { createElement: creer } = jest.requireActual('react');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => creer(VueRN, null, children),
  };
});

jest.mock('@/views/onboarding/components/OnboardingStateView', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  const { createElement: creer } = jest.requireActual('react');
  return {
    __esModule: true,
    default: (/** @type {any} */ { title }) => creer(TexteRN, null, title),
  };
});

jest.mock('@/views/onboarding/components/OnboardingSkipLink', () => {
  const { Text: TexteRN, TouchableOpacity: PressableRN } = jest.requireActual('react-native');
  const { createElement: creer } = jest.requireActual('react');
  return {
    __esModule: true,
    default: (/** @type {any} */ { onPress }) => creer(
      PressableRN,
      { accessibilityRole: 'button', onPress },
      creer(TexteRN, null, 'Passer'),
    ),
  };
});

const fabriquerNavigationDuSite = () => {
  const push = jest.fn();
  const replace = jest.fn();
  const navigation = createWebNavigationAdapter({
    currentPath: '/clubs/onboarding/recap?entry=onboarding',
    currentRouteName: 'ClubWizardRecap',
    goBack: jest.fn(),
    params: { entry: 'onboarding' },
    push,
    replace,
    setSearchParams: jest.fn(),
  });
  return { navigation, push, replace };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockProprietesEtape.length = 0;
  mockCreerClub.mockImplementation(async () => mockClubCree);
  mockAuthentification.userData = { clubMembershipRequests: [], documentId: 'dirigeant-1' };
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

it('🔴 sur le site, après « Créer mon club », l étape suivante, pas la liste', async () => {
  const { navigation, push, replace } = fabriquerNavigationDuSite();
  await act(async () => {
    create(
      <ClubWizardRecap
        navigation={/** @type {any} */ (navigation)}
        route={/** @type {any} */ ({ params: { entry: 'onboarding' } })}
      />,
    );
  });

  await act(async () => {
    mockProprietesEtape[mockProprietesEtape.length - 1].onNext();
  });
  await act(async () => {
    mockRafraichissement.resoudre?.();
    await Promise.resolve();
  });

  expect(push).toHaveBeenCalledWith('/onboarding/welcome?clubId=club-neuf', undefined);
  expect(replace).not.toHaveBeenCalledWith('/clubs', undefined);
});
