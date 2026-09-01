import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubLicenses from '../ClubLicenses';

/**
 * PERF2 — « Cotisations club » PENDANT ses trois attentes : des formes,
 * jamais une phrase.
 *
 * 🧨 Le defaut (rapport capacite du 01/09, ecran n5) : deux vagues de requetes
 * l une apres l autre, et pour tout ecran d attente TROIS phrases nues :
 * « Chargement des cotisations » (plein ecran), « Chargement des membres... »
 * (onglet membres), « Chargement des validations... » (onglet paiements).
 *
 * ⚖️ LA GARANTIE : chaque zone montre la FORME de ce qui arrive (des blocs qui
 * balayent, via WithDataWrapper), sans texte sous le squelette.
 *
 * ⚠️ Les SIX requetes de l ecran sont PILOTABLES — un mock a forme fixe
 * rendrait ce temoin vert par construction (le piege des 4 lots EVEDIT).
 * ⛔ Ce temoin ne reecrit PAS l expression `isLoading` de ClubLicenses.js:1354
 * (4 requetes en ||, relue par le choix de mode :2971) : il la traverse.
 */

/** @type {any} */
let mockAuthContexte;
/** @type {any} */
let mockDonneesAuth;
/** @type {any} */
let mockCampagneCourante;
/** @type {any} */
let mockCampagnes;
/** @type {any} */
let mockCampagneChoisie;
/** @type {any} */
let mockTableauDeBord;
/** @type {any} */
let mockAffectations;
/** @type {any} */
let mockValidations;
const mockMutationFigee = {
  isPending: false,
  mutate: jest.fn(),
  mutateAsync: jest.fn(),
};

// `QueryClientContext` : le VRAI WithDataWrapper (pas mocke ici, c est lui
// qu on observe) le lit avec un contexte nu — absent, il rend `undefined` et
// aucun bouton de relance, exactement le contrat du composant.
jest.mock('@tanstack/react-query', () => ({
  QueryClientContext: jest.requireActual('react').createContext(undefined),
  useMutation: () => mockMutationFigee,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('@/store/appContext', () => ({
  useAppContext: () => mockAuthContexte,
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockDonneesAuth,
}));

jest.mock('@/domains/auth/authUseCases', () => ({
  getUserRoleKey: (/** @type {string} */ nomDeRole) => (
    String(nomDeRole || '').toLowerCase().includes('dirigeant') ? 'president' : 'new'
  ),
}));

jest.mock('@/theme/themeContext', () => {
  const couleurs = jest.requireActual('@/theme/colors').default();
  return {
    __esModule: true,
    default: () => ({
      Alignments: jest.requireActual('@/theme/alignements').default,
      ApplicationStyle: jest.requireActual('@/theme/applicationStyle').default(couleurs),
      Colors: couleurs,
      Fonts: jest.requireActual('@/theme/fonts').default(couleurs),
      Images: {},
      Spaces: jest.requireActual('@/theme/spaces').default,
    }),
  };
});

jest.mock('@/services/license/licenseQueries', () => ({
  deleteDraftLicenseCampaign: jest.fn(),
  duplicateLicenseCampaign: jest.fn(),
  sendBulkLicenseReminder: jest.fn(),
  sendLicenseReminder: jest.fn(),
  transitionLicenseCampaign: jest.fn(),
  useCurrentLicenseCampaign: () => mockCampagneCourante,
  useLicenseAssignments: () => mockAffectations,
  useLicenseCampaign: () => mockCampagneChoisie,
  useLicenseCampaigns: () => mockCampagnes,
  useLicenseDashboard: () => mockTableauDeBord,
  useLicenseMutation: () => mockMutationFigee,
  useLicensePaymentReviews: () => mockValidations,
}));

jest.mock('@/services/auth/authService', () => ({ switchManagedClub: jest.fn() }));
jest.mock('@/services/license/licenseService', () => ({
  connectLicenseHelloAsso: jest.fn(),
}));

// SkeletonLoader tire MaskedView / LinearGradient / Reanimated : hors sujet
// ici. Le mock rend les enfants et capture ses props — la preuve que le
// squelette est ENGAGE.
/** @type {any[]} */
const mockSkeletonProps = [];
jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonLoaderMock(/** @type {any} */ props) {
    mockSkeletonProps.push(props);
    return props.children;
  },
);

jest.mock('@/components/templates/ScreenContainer', () => function ScreenMock(
  /** @type {any} */ { children },
) {
  return children;
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => function ModalMock(
  /** @type {any} */ { children },
) {
  return children;
});

jest.mock('@/components/molecules/clubSelector/ClubSelector', () => function ClubSelectorMock() {
  return null;
});
jest.mock('@/components/molecules/profileAvatar/ProfileAvatar', () => function AvatarMock() {
  return null;
});
jest.mock('@/components/molecules/segmentedControl/SegmentedControl', () => function SegMock() {
  return null;
});
jest.mock('../MyLicenses', () => function MyLicensesMock() { return null; });
jest.mock('@/components/atoms/button/Button', () => function ButtonMock() { return null; });

const CAMPAGNE = {
  currency: 'EUR',
  defaultAmountCents: 12000,
  documentId: 'camp-PERF2',
  name: 'Cotisation seniors',
  seasonLabel: '2026-2027',
  status: 'active',
  totals: {
    expectedCents: 0,
    manualReviewCount: 0,
    overdueCount: 0,
    paidCents: 0,
    paidCount: 0,
    partialCount: 0,
    remainingCents: 0,
    total: 1,
  },
};

const requeteVide = () => ({ data: null, isError: false, isLoading: false });

/** @type {any} */
let arbre = null;

afterEach(() => {
  if (arbre) {
    act(() => arbre.unmount());
    arbre = null;
  }
  mockSkeletonProps.length = 0;
  jest.clearAllMocks();
});

/**
 * Monte l ecran avec les etats de requete donnes.
 * @param {object} options
 * @param {any} [options.etats] surcharges par hook (cle = nom du mock)
 * @param {any} [options.params] params de route
 * @returns {void}
 */
const monter = ({ etats = {}, params = {} }) => {
  mockAuthContexte = [{ auth: { user: { role: { name: 'Dirigeant', type: 'dirigeant' } } } }];
  mockDonneesAuth = {
    activeClubId: 'club-perf2',
    clubs: [{ documentId: 'club-perf2', name: 'FC Test' }],
    refetchUserData: jest.fn(),
  };
  mockCampagneCourante = etats.campagneCourante || requeteVide();
  mockCampagnes = etats.campagnes || { data: { data: [CAMPAGNE] }, isError: false, isLoading: false };
  mockCampagneChoisie = etats.campagneChoisie || { data: CAMPAGNE, isError: false, isLoading: false };
  mockTableauDeBord = etats.tableauDeBord || requeteVide();
  mockAffectations = etats.affectations || requeteVide();
  mockValidations = etats.validations || requeteVide();

  act(() => {
    arbre = renderer.create(
      <ClubLicenses
        navigation={{
          addListener: () => () => {},
          goBack: jest.fn(),
          navigate: jest.fn(),
          setOptions: jest.fn(),
        }}
        route={{ name: 'ClubLicenses', params: { clubId: 'club-perf2', ...params } }}
      />,
    );
  });
};

/**
 * Compte les conteneurs de squelette portant ce testID.
 * @param {string} testID le conteneur cherche
 * @returns {number} le nombre de conteneurs rendus
 */
const squelettes = (testID) => arbre.root.findAllByProps({ testID }).length;

/**
 * L ecran affiche-t-il ce morceau de texte quelque part ?
 * (⛔ pas de JSON.stringify : la FlatList du mode tableau de bord porte des
 * elements React circulaires via ListEmptyComponent.)
 * @param {string} morceau le texte cherche
 * @returns {boolean} present a l ecran ?
 */
const contient = (morceau) => arbre.root.findAll(
  (/** @type {any} */ noeud) => typeof noeud.props?.children === 'string'
    && noeud.props.children.includes(morceau),
).length > 0;

describe('PERF2 — les trois attentes de Cotisations club montrent des formes', () => {
  it('chargement plein ecran : le squelette remplace les deux phrases nues', () => {
    monter({
      etats: { campagneCourante: { data: null, isError: false, isLoading: true } },
    });

    expect(squelettes('club-licenses-skeleton')).toBeGreaterThan(0);
    expect(mockSkeletonProps.length).toBeGreaterThan(0);
    expect(contient('Chargement des cotisations')).toBe(false);

    const [squelette] = arbre.root.findAllByProps({ testID: 'club-licenses-skeleton' });
    expect(squelette.findAllByType(Text).length).toBe(0);
  });

  it('onglet membres : « Chargement des membres... » devient des formes', () => {
    monter({
      etats: { affectations: { data: null, isError: false, isLoading: true } },
      params: { campaignId: 'camp-PERF2' },
    });

    expect(squelettes('club-licenses-members-skeleton')).toBeGreaterThan(0);
    expect(contient('Chargement des membres')).toBe(false);

    const [squelette] = arbre.root.findAllByProps({ testID: 'club-licenses-members-skeleton' });
    expect(squelette.findAllByType(Text).length).toBe(0);
  });

  it('onglet paiements : « Chargement des validations... » devient des formes', () => {
    monter({
      etats: { validations: { data: null, isError: false, isLoading: true } },
      params: { campaignId: 'camp-PERF2', initialDetailTab: 'payments' },
    });

    expect(squelettes('club-licenses-reviews-skeleton')).toBeGreaterThan(0);
    expect(contient('Chargement des validations')).toBe(false);

    const [squelette] = arbre.root.findAllByProps({ testID: 'club-licenses-reviews-skeleton' });
    expect(squelette.findAllByType(Text).length).toBe(0);
  });

  it('tout est charge : plus AUCUN squelette nulle part', () => {
    monter({ params: { campaignId: 'camp-PERF2' } });

    expect(squelettes('club-licenses-skeleton')).toBe(0);
    expect(squelettes('club-licenses-members-skeleton')).toBe(0);
    expect(squelettes('club-licenses-reviews-skeleton')).toBe(0);
  });
});
