import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import MyLicenseDetail from '../MyLicenseDetail';

/**
 * RECUPDF (26/10) — « TELECHARGER LE RECU » TELECHARGE LE VRAI FICHIER.
 *
 * Constat C03 (Q4-25) : le serveur creait le recu SANS fichier ; le bouton
 * repondait toujours « Document indisponible ». Adel « 6- B » : on fabrique le
 * recu, et le bouton reste visible en attendant.
 *
 * Le serveur fabrique maintenant le PDF au paiement. Pour un paiement PASSE dont
 * le recu n a pas de fichier, le bouton le fait fabriquer (`generateReceipt`),
 * puis telecharge ce que le serveur rend. Et un paiement rembourse le dit (T2 :
 * le recu est fige a l emission, la ligne porte « remboursé »).
 */

/** @type {any} */
let mockMesCotisations;
const mockTelecharger = jest.fn(() => Promise.resolve({ opened: true, outcome: 'downloads' }));
const mockFabriquer = jest.fn();
const mockMutation = {
  isPending: false,
  mutate: jest.fn(),
  mutateAsync: (/** @type {any} */ ...args) => mockFabriquer(...args),
};

jest.mock('@/services/license/licenseQueries', () => ({
  createLicenseCheckout: jest.fn(),
  declareExternalLicensePayment: jest.fn(),
  generateLicenseReceipt: jest.fn(),
  submitLicenseDocument: jest.fn(),
  useLicenseMutation: () => mockMutation,
  useMyLicenseAssignment: () => ({
    data: null, isError: false, isLoading: false, refetch: jest.fn(),
  }),
  useMyLicenses: () => mockMesCotisations,
}));

const mockNavigationContexte = { goBack: jest.fn(), navigate: jest.fn() };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigationContexte,
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

jest.mock('@/platform/links', () => ({ __esModule: true, default: { openUrl: jest.fn() } }));
jest.mock('@/platform/media', () => ({ __esModule: true, default: { pickDocument: jest.fn() } }));
jest.mock('@/platform/media/downloadRemoteFile', () => ({
  __esModule: true,
  downloadRemoteFile: (/** @type {any} */ ...args) => mockTelecharger(...args),
}));
jest.mock('@/platform/share', () => ({ __esModule: true, default: { share: jest.fn() } }));

jest.mock('@/utils/mediaUrl', () => ({
  resolveMediaUrl: (/** @type {any} */ url) => (url ? `https://api.test${url}` : ''),
}));

const FICHIER = { url: '/uploads/recu_FC_2026_30_000070_ab12.pdf' };

/**
 * Une cotisation SOLDEE, avec ses paiements.
 * @param {any} payments les paiements de la cotisation
 * @returns {any} la cotisation
 */
const cotisationSoldee = (payments) => ({
  amountDueCents: 6000,
  amountPaidCents: 6000,
  amountRemainingCents: 0,
  campaign: {
    club: { name: 'FC Nord' },
    documentId: 'camp-1',
    documentRequests: [],
    name: 'Cotisation 2026',
    paymentModes: {},
    seasonLabel: '2026-2027',
    status: 'active',
  },
  club: { name: 'FC Nord' },
  currency: 'EUR',
  documentId: 'assign-1',
  documentSubmissions: [],
  installments: [],
  officialLicenseDocument: null,
  payments,
  receipts: [],
  status: 'paid',
});

/**
 * Un paiement encaisse, par cheque.
 * @param {any} [extra] champs a surcharger
 * @returns {any} le paiement
 */
const paiement = (extra = {}) => ({
  amountCents: 6000,
  currency: 'EUR',
  documentId: 'pay-1',
  method: 'check',
  paidAt: '2026-10-02T10:00:00.000Z',
  status: 'confirmed',
  ...extra,
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
 * Monte le detail sur une cotisation donnee.
 * @param {any} affectation la cotisation a afficher
 * @returns {void}
 */
const monter = (affectation) => {
  mockMesCotisations = {
    data: [affectation], isError: false, isLoading: false, refetch: jest.fn(),
  };
  act(() => {
    arbre = renderer.create(
      <MyLicenseDetail
        navigation={{ canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() }}
        route={{ params: { assignmentId: 'assign-1' } }}
      />,
    );
  });
};

/**
 * Les gestes dont le libelle contient un morceau de texte.
 * @param {string} morceau texte cherche
 * @returns {any[]} les gestes trouves
 */
const gestes = (morceau) => arbre.root.findAll((/** @type {any} */ noeud) => {
  if (typeof noeud.props?.onPress !== 'function') return false;
  const etiquette = `${noeud.props?.title || ''} ${noeud.props?.accessibilityLabel || ''}`;
  return etiquette.toLowerCase().includes(morceau.toLowerCase());
});

const NUMERO = 'FC-2026-30-000070';
const AVEC_FICHIER = { pdfFile: FICHIER, receiptNumber: NUMERO };
const SANS_FICHIER = { pdfFile: null, receiptNumber: NUMERO };

describe('RECUPDF — le bouton telecharge le vrai fichier', () => {
  it('un recu qui a son fichier se telecharge directement, sans rien refabriquer', async () => {
    monter(cotisationSoldee([paiement({ receipt: AVEC_FICHIER })]));

    const boutons = gestes('Télécharger le reçu');
    expect(boutons.length).toBeGreaterThan(0);
    await act(async () => { await boutons[0].props.onPress(); });

    expect(mockFabriquer).not.toHaveBeenCalled();
    expect(mockTelecharger).toHaveBeenCalledWith(expect.objectContaining({
      fileName: 'recu-FC-2026-30-000070',
      url: 'https://api.test/uploads/recu_FC_2026_30_000070_ab12.pdf',
    }));
  });

  it('un recu PASSE sans fichier : le bouton le fait fabriquer, puis le telecharge', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockFabriquer.mockResolvedValue(AVEC_FICHIER);
    monter(cotisationSoldee([paiement({ receipt: SANS_FICHIER })]));

    // La carte du montant ET la ligne du paiement : les deux disent « Télécharger le reçu ».
    const [carte, ligne] = gestes('Télécharger le reçu');
    expect(gestes('Télécharger le reçu').length).toBe(2);
    await act(async () => { await carte.props.onPress(); });
    await act(async () => { await ligne.props.onPress(); });

    expect(mockFabriquer).toHaveBeenCalledWith('pay-1');
    expect(mockTelecharger).toHaveBeenCalledTimes(2);
    expect(mockTelecharger).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://api.test/uploads/recu_FC_2026_30_000070_ab12.pdf',
    }));
    expect(alerte).not.toHaveBeenCalledWith('Document indisponible', expect.anything());
    alerte.mockRestore();
  });

  it('toujours pas de fichier : « Document indisponible », rien ne part', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockFabriquer.mockResolvedValue(SANS_FICHIER);
    monter(cotisationSoldee([paiement({ receipt: SANS_FICHIER })]));

    await act(async () => { await gestes('Télécharger le reçu')[0].props.onPress(); });

    expect(mockTelecharger).not.toHaveBeenCalled();
    expect(alerte).toHaveBeenCalledWith('Document indisponible', expect.any(String));
    alerte.mockRestore();
  });

  it('si la fabrication echoue (reseau) : le meme message, sans plantage', async () => {
    const alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockFabriquer.mockRejectedValue(new Error('Network Error'));
    monter(cotisationSoldee([paiement({ receipt: SANS_FICHIER })]));

    await act(async () => { await gestes('Télécharger le reçu')[0].props.onPress(); });

    expect(mockTelecharger).not.toHaveBeenCalled();
    expect(alerte).toHaveBeenCalledWith('Document indisponible', expect.any(String));
    alerte.mockRestore();
  });
});

describe('RECUPDF T2 — un recu est fige a l emission ; la ligne dit le remboursement', () => {
  it('rembourse : la ligne porte « remboursé » ; en partie : « remboursé en partie »', () => {
    monter(cotisationSoldee([
      paiement({ documentId: 'pay-1', receipt: AVEC_FICHIER, status: 'refunded' }),
      paiement({ documentId: 'pay-2', receipt: AVEC_FICHIER, status: 'partially_refunded' }),
    ]));
    const rendu = JSON.stringify(arbre.toJSON());

    expect(rendu).toContain('remboursé en partie');
    expect(rendu.match(/remboursé(?! en partie)/g)?.length).toBe(1);
  });
});
