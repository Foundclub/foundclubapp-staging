import renderer, { act } from 'react-test-renderer';
// SUPADM (recette iPhone d'Adel du 23/10, point 3, capture 03) — « Changer de compte » avec 7
// comptes : la feuille montait presque en haut, la liste s'arrêtait à 70 % de l'écran, une bande
// vide dessous et « Ajouter un compte » coupé. La feuille règle sa hauteur sur le contenu, plafonné
// à l'écran moins sa marge du haut (`insets.top + 20`, BottomModal) ; la zone qui défile, elle,
// restait à 70 %. Ce que le témoin tient : la zone qui défile reçoit LE MÊME plafond que la feuille.
// Doublures : celles de `Profile.FINITIONS8.listeDesComptes.test.js`.

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
// R17-SIGNALER-1 : « Mes signalements » lit ses signalements (doublure, pas de reseau).
jest.mock('@/services/facilityReport/facilityReportQueries', () => ({
  useMyFacilityReports: () => ({ data: null }),
}));
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
// SUPADM — la doublure GARDE ce que la feuille reçoit (le plafond de la zone qui défile).
/** @type {any} */
let mockFeuille = null;
jest.mock('@/components/molecules/bottomModal/BottomModal', () => ({
  __esModule: true,
  default: (/** @type {any} */ props) => {
    mockFeuille = props;
    return props.isVisible ? props.children : null;
  },
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
const mockVillesGerees = { data: [] };
// RESA-L6B-1 — le nombre de « Mes réservations » (rangée cachée par COMPLEXES_JOUEUR) lit le
// serveur des complexes : doublé ici comme les autres services de « Mon compte ».
jest.mock('@/views/reserverTerrain/components/NombreAVenir', () => () => null);
jest.mock('@/services/collectivite/collectiviteQueries', () => {
  const aucune = { data: [] };
  // COLL-ACCUEIL (01/10) : la pastille de la rangee de la Ville lit les demandes en attente.
  return { useCollectiviteRequests: () => aucune, useMyManagerRequests: () => ({ data: [] }), useMyCollectivites: () => mockVillesGerees };
});
jest.mock('@/config/legalUrls', () => ({ SUPPORT_CONTACT_MAILTO: 'mailto:contact@exemple.test' }));

const Profile = require('../Profile').default;

const authSuperAdmin = {
  accountSubscriptionAccessLevel: 'FREE',
  addAccount: jest.fn(),
  authSessions: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => ({
    user: {
      documentId: id, firstname: id, lastname: 'Test', role: { name: 'Joueur', type: 'Joueur' },
    },
  })),
  canEditClub: () => false,
  canManageTeam: false,
  clubVerificationSummary: null,
  entitlementsSummary: null,
  freeUsageSummary: null,
  logoutMutation: { isPending: false, mutate: jest.fn() },
  refetchUserData: jest.fn(),
  subscriptionAccessLevel: 'FREE',
  switchAccount: jest.fn(),
  userData: {
    documentId: 'a',
    firstname: 'a',
    id: 7,
    lastname: 'Test',
    multisportClubs: [],
    role: { name: 'SuperAdmin', type: 'SuperAdmin' },
  },
  userDataError: null,
  userDataLoading: false,
};

describe('SUPADM — la liste « Changer de compte » remplit sa feuille', () => {
  it('la zone qui défile a le plafond de la feuille : l écran moins sa marge du haut', () => {
    mockAuth = authSuperAdmin;
    const { SafeAreaInsetsContext } = jest.requireActual('react-native-safe-area-context');
    const { Dimensions } = jest.requireActual('react-native');
    const { height: hauteur } = Dimensions.get('window');
    const ecran = Dimensions.get('screen').height;
    /** @type {any} */
    let arbre;
    act(() => {
      arbre = renderer.create(
        <SafeAreaInsetsContext.Provider value={{
          bottom: 34, left: 0, right: 0, top: 59,
        }}
        >
          <Profile navigation={{ navigate: jest.fn(), setParams: jest.fn() }} route={{ params: {} }} />
        </SafeAreaInsetsContext.Provider>,
      );
    });
    expect(mockFeuille).not.toBeNull();
    const plafond = mockFeuille.maxContentHeightRatio;
    expect(typeof plafond).toBe('number');
    // La feuille va jusqu'à `insets.top + 20` du haut : la zone qui défile aussi, au pixel près.
    expect(Math.round(plafond * ecran)).toBe(Math.round(hauteur - 59 - 20));
    act(() => { arbre.unmount(); });
  });
});
