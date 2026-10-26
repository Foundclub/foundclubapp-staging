import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubLicenseMemberDetail from '../ClubLicenseMemberDetail';

/**
 * RECUPDF (26/10, T3) — LE CLUB TELECHARGE LE RECU D UN MEMBRE.
 *
 * Avant : la section « Reçus » de la fiche n offrait AUCUN geste ; le club ne
 * pouvait pas tirer le recu qu il avait emis. Le serveur fabrique maintenant le
 * PDF ; le club le telecharge. Un recu PASSE sans fichier est fabrique a la
 * demande. L entraineur, lui, ne voit pas ce bouton (le serveur lui retire le
 * fichier, temoin admin RECUPDF D4).
 */

/** @type {any[]} */
const mockBoutons = [];
/** @type {any} */
let mockCotisationRequete;
const mockRequeteVide = { data: null, isError: false, isLoading: false };
const mockTelecharger = jest.fn(() => Promise.resolve({ opened: true, outcome: 'downloads' }));
const mockFabriquer = jest.fn();
const mockMutation = {
  isPending: false,
  mutate: jest.fn(),
  mutateAsync: (/** @type {any} */ ...args) => mockFabriquer(...args),
};

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

jest.mock('@/services/license/licenseQueries', () => ({
  addManualLicensePayment: jest.fn(),
  approveExternalLicensePayment: jest.fn(),
  generateLicenseReceipt: jest.fn(),
  refundLicensePayment: jest.fn(),
  rejectExternalLicensePayment: jest.fn(),
  reviewLicenseDocument: jest.fn(),
  sendLicenseReminder: jest.fn(),
  unwaiveLicenseAssignment: jest.fn(),
  updateLicenseAssignmentAmount: jest.fn(),
  uploadOfficialLicenseDocument: jest.fn(),
  useLicenseAssignment: () => mockCotisationRequete,
  useLicenseDashboard: () => mockRequeteVide,
  useLicenseMutation: () => mockMutation,
  waiveLicenseAssignment: jest.fn(),
}));

jest.mock('@/platform/links', () => ({ __esModule: true, default: { openUrl: jest.fn() } }));
jest.mock('@/platform/media', () => ({ __esModule: true, default: { pickDocument: jest.fn() } }));
jest.mock('@/platform/media/downloadRemoteFile', () => ({
  __esModule: true,
  downloadRemoteFile: (/** @type {any} */ ...args) => mockTelecharger(...args),
}));
jest.mock('@/utils/mediaUrl', () => ({ resolveMediaUrl: (/** @type {string} */ url) => url }));

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

jest.mock('@/components/atoms/button/Button', () => function ButtonMock(/** @type {any} */ props) {
  mockBoutons.push(props);
  return null;
});

const FICHIER = { url: '/uploads/recu_ab12.pdf' };

/**
 * Une cotisation soldee : un paiement en especes et son recu.
 * @param {any} recu le recu de la cotisation, tel que le serveur le rend
 * @returns {any} la cotisation
 */
const cotisation = (recu) => ({
  amountDueCents: 6000,
  amountPaidCents: 6000,
  amountRemainingCents: 0,
  campaign: {
    documentId: 'camp-R',
    documentRequests: [],
    name: 'Cotisation seniors',
    paymentModes: { cash: true },
  },
  currency: 'EUR',
  documentId: 'assign-R',
  documentSubmissions: [],
  installments: [],
  payments: [{
    amountCents: 6000,
    documentId: 'pay-R',
    method: 'cash',
    paidAt: '2026-10-02T10:00:00.000Z',
    receipt: { documentId: 'rcpt-R', id: 80 },
    status: 'confirmed',
  }],
  receipts: [{
    amountCents: 6000,
    documentId: 'rcpt-R',
    id: 80,
    issuedAt: '2026-10-02T10:00:00.000Z',
    receiptNumber: 'FC-2026-30-000070',
    ...recu,
  }],
  status: 'paid',
  user: { firstname: 'Ana', lastname: 'Diaz' },
});

/** @type {any} */
let arbre = null;

afterEach(() => {
  if (arbre) {
    act(() => arbre.unmount());
    arbre = null;
  }
  jest.clearAllMocks();
});

/**
 * Monte la fiche, en dirigeant ou en entraineur.
 * @param {any} donnees la cotisation affichee
 * @param {string} [scope] la portee du lecteur
 * @returns {void}
 */
const monter = (donnees, scope = 'manager') => {
  mockBoutons.length = 0;
  mockCotisationRequete = {
    data: donnees, isError: false, isLoading: false, refetch: jest.fn(),
  };
  act(() => {
    arbre = renderer.create(
      <ClubLicenseMemberDetail
        navigation={{ goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() }}
        route={{
          params: {
            assignmentId: 'assign-R',
            campaignId: 'camp-R',
            canManageLicenses: scope !== 'coach',
            scope,
          },
        }}
      />,
    );
  });
};

const boutonRecu = () => mockBoutons
  .filter((item) => item?.title === 'Télécharger le reçu')
  .pop();

describe('RECUPDF T3 — le club telecharge le recu', () => {
  it('un recu qui a son fichier se telecharge directement', async () => {
    monter(cotisation({ pdfFile: FICHIER }));
    const bouton = boutonRecu();
    expect(bouton).toBeTruthy();

    await act(async () => { await bouton.onPress(); });
    expect(mockFabriquer).not.toHaveBeenCalled();
    expect(mockTelecharger).toHaveBeenCalledWith(expect.objectContaining({
      fileName: 'recu-FC-2026-30-000070', url: '/uploads/recu_ab12.pdf',
    }));
  });

  it('un recu PASSE sans fichier est fabrique par son paiement, puis telecharge', async () => {
    mockFabriquer.mockResolvedValue({ pdfFile: FICHIER, receiptNumber: 'FC-2026-30-000070' });
    monter(cotisation({ pdfFile: null }));

    await act(async () => { await boutonRecu().onPress(); });
    expect(mockFabriquer).toHaveBeenCalledWith('pay-R');
    expect(mockTelecharger).toHaveBeenCalledWith(
      expect.objectContaining({ url: '/uploads/recu_ab12.pdf' }),
    );
  });

  it('sans fichier au bout : « Document indisponible », rien n est telecharge', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockFabriquer.mockRejectedValue(new Error('Network Error'));
    monter(cotisation({ pdfFile: null }));

    await act(async () => { await boutonRecu().onPress(); });
    expect(mockTelecharger).not.toHaveBeenCalled();
    expect(alerte).toHaveBeenCalledWith('Document indisponible', expect.any(String));
    alerte.mockRestore();
  });

  it('l entraineur ne voit PAS le bouton', () => {
    monter(cotisation({ pdfFile: null }), 'coach');
    expect(boutonRecu()).toBeFalsy();
  });
});
