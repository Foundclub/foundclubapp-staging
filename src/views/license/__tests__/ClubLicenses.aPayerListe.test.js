import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubLicenses from '../ClubLicenses';

/**
 * U06 — « À PAYER » SUR LA LISTE DES JOUEURS, LA OU VIT « RELANCER ».
 *
 * 🗣️ Adel, 17/08 puis 18/08 (signale DEUX fois) : « sur les fiches joueurs, où
 * tu vois "relancer", il faut aussi le bouton pour dire "à payer" » — puis
 * « "À payer" toujours pas là ».
 *
 * 🔬 MESURE AVANT DE REFAIRE : le lot T03 A BIEN livre ce bouton, mais sur la
 * FICHE d'un joueur (`ClubLicenseMemberDetail.js:723`), et uniquement sur une
 * cotisation EXEMPTEE. Or « Relancer » vit AUSSI — et surtout — sur chaque
 * carte de la LISTE des joueurs (`ClubLicenses.js`), ou rien ne l'accompagnait.
 * C'est cette liste-la qu'Adel regarde quand il dit « les fiches joueurs ».
 *
 * ⛔ AUCUN BOUTON INERTE : « À payer » est le miroir d'« Exempter ». Sur une
 * cotisation deja en attente il n'aurait rien a faire, et le serveur refuserait.
 * Il n'apparait donc que sur une cotisation EXEMPTEE.
 */

/** @type {any} */
let mockAuthContexte;
/** @type {any} */
let mockDonneesAuth;
/** @type {any} */
let mockAffectations;
/** @type {any[]} */
const mockBoutons = [];
/** @type {any[]} */
const mockEnvois = [];
const mockRequeteVide = { data: null, isError: false, isLoading: false };
const mockMutationFigee = {
  isPending: false,
  mutate: jest.fn((variables, options) => { mockEnvois.push({ options, variables }); }),
  mutateAsync: jest.fn(),
};

// PERF2 - l ecran importe desormais WithDataWrapper -> SkeletonLoader, qui
// tire MaskedView / LinearGradient / Reanimated : hors sujet dans cette
// suite. Meme mock que les suites EventPublishedShowcase.
jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonLoaderMock() { return null; },
);

jest.mock('@tanstack/react-query', () => ({ useMutation: () => mockMutationFigee }));

// ⚠️ `FlatList` planifie un `Batchinator` qui reveille `InteractionManager` APRES
// la fin du test : en suite complete, ça tue le worker (« environment has been
// torn down »). On rend donc les elements directement — c'est la CARTE qu'on
// observe, pas la virtualisation.
jest.mock('react-native/Libraries/Lists/FlatList', () => {
  const mockModule = function FlatListMock(
    /** @type {any} */ { data, ListEmptyComponent, renderItem },
  ) {
    const { View } = jest.requireActual('react-native');
    const elements = data || [];
    if (!elements.length) return ListEmptyComponent || null;
    return (
      <View>
        {elements.map((/** @type {any} */ item, /** @type {number} */ index) => (
          renderItem({ index, item })
        ))}
      </View>
    );
  };
  // RN 0.79 lit `require(module).default` la ou 0.78 lisait le module entier :
  // le mock sert les DEUX formes, pour survivre aux deux versions.
  return Object.assign(mockModule, { default: mockModule });
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
}));

jest.mock('@/store/appContext', () => ({ useAppContext: () => mockAuthContexte }));

jest.mock('@/domains/auth/useAuth', () => ({ __esModule: true, default: () => mockDonneesAuth }));

jest.mock('@/domains/auth/authUseCases', () => ({
  getUserRoleKey: (/** @type {string} */ nom) => (
    String(nom || '').toLowerCase().includes('dirigeant') ? 'president' : 'new'
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

const mockUnwaive = jest.fn();

jest.mock('@/services/license/licenseQueries', () => ({
  deleteDraftLicenseCampaign: jest.fn(),
  duplicateLicenseCampaign: jest.fn(),
  sendBulkLicenseReminder: jest.fn(),
  sendLicenseReminder: jest.fn(),
  transitionLicenseCampaign: jest.fn(),
  unwaiveLicenseAssignment: (/** @type {any} */ ...args) => mockUnwaive(...args),
  useCurrentLicenseCampaign: () => mockRequeteVide,
  useLicenseAssignments: () => mockAffectations,
  useLicenseCampaign: () => ({ data: CAMPAGNE, isError: false, isLoading: false }),
  useLicenseCampaigns: () => ({ data: { data: [CAMPAGNE] }, isError: false, isLoading: false }),
  useLicenseDashboard: () => mockRequeteVide,
  useLicenseMutation: () => mockMutationFigee,
  useLicensePaymentReviews: () => mockRequeteVide,
}));

jest.mock('@/services/auth/authService', () => ({ switchManagedClub: jest.fn() }));
jest.mock('@/services/license/licenseService', () => ({
  connectLicenseHelloAsso: jest.fn(),
}));

jest.mock('@/components/templates/ScreenContainer', () => function ScreenMock({ children }) {
  return children;
});

jest.mock('@/components/molecules/bottomModal/BottomModal', () => function ModalMock({ children }) {
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

jest.mock('@/components/atoms/button/Button', () => function ButtonMock(/** @type {any} */ props) {
  mockBoutons.push(props);
  return null;
});

const CAMPAGNE = {
  currency: 'EUR',
  defaultAmountCents: 12000,
  documentId: 'camp-U06',
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

const affectation = (status) => ({
  amountDueCents: 12000,
  amountRemainingCents: status === 'paid' ? 0 : 12000,
  currency: 'EUR',
  documentId: `assign-${status}`,
  status,
  user: { documentId: 'u1', firstname: 'Leo', lastname: 'Martin' },
});

/** @type {any} */
let arbreCourant = null;

afterEach(() => {
  if (arbreCourant) {
    act(() => arbreCourant.unmount());
    arbreCourant = null;
  }
});

const monterLaListe = (status) => {
  mockBoutons.length = 0;
  mockEnvois.length = 0;
  mockAuthContexte = [{ auth: { user: { role: { name: 'Dirigeant', type: 'dirigeant' } } } }];
  mockDonneesAuth = {
    activeClubId: 'club-u06',
    clubs: [{ documentId: 'club-u06', name: 'FC Test' }],
    refetchUserData: jest.fn(),
  };
  mockAffectations = {
    data: { data: [affectation(status)] },
    isError: false,
    isLoading: false,
  };

  act(() => {
    arbreCourant = renderer.create(
      <ClubLicenses
        navigation={{
          addListener: () => () => {},
          goBack: jest.fn(),
          navigate: jest.fn(),
          setOptions: jest.fn(),
        }}
        route={{ name: 'ClubLicenses', params: { campaignId: 'camp-U06', clubId: 'club-u06' } }}
      />,
    );
  });
  return mockBoutons.map((props) => props.title);
};

describe('U06 — « À payer » a cote de « Relancer », sur la liste des joueurs', () => {
  it('une cotisation EXEMPTEE propose « À payer » dans la liste', () => {
    expect(monterLaListe('waived')).toContain('À payer');
  });

  it('⛔ une cotisation EN ATTENTE ne le propose pas — il n aurait rien a faire', () => {
    expect(monterLaListe('pending')).not.toContain('À payer');
  });

  it('⛔ une cotisation PAYEE ne le propose pas non plus', () => {
    expect(monterLaListe('paid')).not.toContain('À payer');
  });

  it('le bouton DEMANDE d abord : remettre a payer engage de l argent', () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    monterLaListe('waived');

    act(() => { mockBoutons.find((props) => props.title === 'À payer').onPress(); });

    expect(alerte).toHaveBeenCalled();
    expect(alerte.mock.calls[0][0]).toBe('Remettre à payer');
    expect(mockEnvois).toHaveLength(0);
    alerte.mockRestore();
  });

  it('le bouton n est pas inerte : confirme, il appelle bien le serveur', async () => {
    /** @type {any[]} */
    let actions = [];
    const alerte = jest.spyOn(Alert, 'alert')
      .mockImplementation((
        /** @type {any} */ _titre,
        /** @type {any} */ _texte,
        /** @type {any} */ boutons,
      ) => {
        actions = boutons || [];
      });
    monterLaListe('waived');

    act(() => { mockBoutons.find((props) => props.title === 'À payer').onPress(); });
    await act(async () => { actions.find((action) => action.text === 'À payer').onPress(); });

    expect(mockEnvois).toHaveLength(1);
    expect(mockEnvois[0].variables).toMatchObject({ assignmentId: 'assign-waived' });
    alerte.mockRestore();
  });
});
