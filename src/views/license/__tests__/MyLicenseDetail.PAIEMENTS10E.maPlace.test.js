/* eslint-disable max-len -- données de témoin sur une ligne */
import '@/theme/strings';

import renderer, { act } from 'react-test-renderer';

import MyLicenseDetail from '../MyLicenseDetail';

// PAIEMENTS-10E (19/11, liste de fidélité d'Adel, écran 10e, « Le détail (site) ») : le détail d'une
// PLACE de tournoi dit « Ma place » et « PLACE RÉGLÉE » (plus « Ma cotisation » / « COTISATION RÉGLÉE »),
// porte le nom du tournoi, et n'a plus de vert (montant, barre, pastille). Le bouton « Télécharger le
// reçu » reste. Une cotisation de club garde ses mots (témoin de contrôle).

/** @type {any} */
let mockMesCotisations;
const mockMutationFigee = { isPending: false, mutate: jest.fn(), mutateAsync: jest.fn() };

jest.mock('@/services/license/licenseQueries', () => ({
  createLicenseCheckout: jest.fn(),
  declareExternalLicensePayment: jest.fn(),
  generateLicenseReceipt: jest.fn(),
  submitLicenseDocument: jest.fn(),
  useLicenseMutation: () => mockMutationFigee,
  useMyLicenseAssignment: () => ({
    data: null, isError: false, isLoading: false, refetch: jest.fn(),
  }),
  useMyLicenses: () => mockMesCotisations,
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    bottom: 0, left: 0, right: 0, top: 0,
  }),
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
jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: { config: jest.fn(), fs: { dirs: { CacheDir: '/cache' }, stat: jest.fn() } },
}));
jest.mock('@/platform/links', () => ({ __esModule: true, default: { openUrl: jest.fn(), openUrlHere: jest.fn() } }));
jest.mock('@/platform/media', () => ({ __esModule: true, default: { pickDocument: jest.fn() } }));
jest.mock('@/platform/media/downloadRemoteFile', () => ({
  __esModule: true,
  downloadRemoteFile: jest.fn(),
}));
jest.mock('@/platform/share', () => ({ __esModule: true, default: { share: jest.fn() } }));
jest.mock('@/utils/mediaUrl', () => ({
  resolveMediaUrl: (/** @type {any} */ url) => (url ? `https://api.test${url}` : ''),
}));

const Colors = jest.requireActual('@/theme/colors').default();

const affectation = (/** @type {string} */ type, /** @type {string} */ nom) => ({
  amountDueCents: 2000,
  amountPaidCents: 2000,
  amountRemainingCents: 0,
  campaign: {
    club: { name: 'SIMU — club porteur de test' }, documentId: 'camp', documentRequests: [], name: nom, paymentModes: { stripe: true }, seasonLabel: '2026', status: 'active', type,
  },
  club: { name: 'SIMU — club porteur de test' },
  currency: 'EUR',
  documentId: 'assign-1',
  documentSubmissions: [],
  installments: [],
  payments: [{
    amountCents: 2000, currency: 'EUR', documentId: 'pay-1', method: 'stripe', paidAt: '2026-11-17T10:00:00.000Z', receipt: { pdfFile: { url: '/uploads/recu.pdf' }, receiptNumber: 'FC-2026-87981-000424' }, status: 'confirmed',
  }],
  receipts: [],
  status: 'paid',
});

/** @type {any} */
let arbre = null;
afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});
const monter = (/** @type {any} */ a) => {
  mockMesCotisations = {
    data: [a], isError: false, isLoading: false, refetch: jest.fn(),
  };
  act(() => {
    arbre = renderer.create(
      <MyLicenseDetail
        navigation={{ canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() }}
        route={{ params: { assignmentId: 'assign-1' } }}
      />,
    );
  });
  return arbre.root.findAll((/** @type {any} */ n) => n.type === 'Text')
    .map((/** @type {any} */ n) => [].concat(n.props.children).flat(9).join('').replace(/\s/g, ' '));
};

describe('PAIEMENTS-10E — le détail d’une place dit « Ma place »', () => {
  test('place payée : « Ma place », le nom du tournoi, « PLACE RÉGLÉE », le reçu, plus de vert', () => {
    const textes = monter(affectation('tournament', 'Inscription - Tournoi - 05/12/2026'));
    expect(textes).toEqual(expect.arrayContaining(['Ma place', 'Tournoi - 05/12/2026', 'PLACE RÉGLÉE']));
    expect(textes.slice(0, 2)).toEqual(['Ma place', 'Tournoi - 05/12/2026']);
    // « LA CAMPAGNE » (tableau du bas) garde le vrai nom de campagne : rien ne disparaît.
    expect(textes.join(' | ')).not.toMatch(/Ma cotisation|COTISATION RÉGLÉE/);
    expect(JSON.stringify(arbre.toJSON())).toContain('Télécharger le reçu');
    expect(JSON.stringify(arbre.toJSON())).not.toContain(Colors.success500);
  });

  test('contrôle : une cotisation garde « Ma cotisation » et « COTISATION RÉGLÉE »', () => {
    const textes = monter(affectation('license', 'Cotisation 2026-2027'));
    expect(textes).toEqual(expect.arrayContaining(['Ma cotisation', 'Cotisation 2026-2027', 'COTISATION RÉGLÉE']));
    expect(JSON.stringify(arbre.toJSON())).not.toContain(Colors.success500);
  });
});
