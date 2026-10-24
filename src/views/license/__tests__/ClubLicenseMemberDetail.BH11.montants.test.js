import { TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubLicenseMemberDetail from '../ClubLicenseMemberDetail';

// BH11 (BUGHUNT 24/10) — la modale d action de la fiche d un membre :
//   P5-06 : un montant vide, negatif ou non numerique ne part jamais ;
//   P5-07 : un remboursement ne depasse jamais ce qui reste remboursable ;
//   P5-08 : un double appui sur « Valider » n envoie qu une requete.
// Meme banc que ClubLicenseMemberDetail.aPaye.test.js.

/** @type {any[]} */
const mockBoutons = [];
const mockRequeteVide = { data: null, isError: false, isLoading: false };
const mockInsetsFiges = {
  bottom: 0, left: 0, right: 0, top: 0,
};
/** @type {any} */
let mockCotisationRequete;

const mockMutationFigee = {
  isPending: false,
  mutate: jest.fn(),
  mutateAsync: jest.fn(),
};

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsetsFiges,
}));

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
  useLicenseMutation: () => mockMutationFigee,
  waiveLicenseAssignment: jest.fn(),
}));

jest.mock('@/platform/links', () => ({ __esModule: true, default: { openUrl: jest.fn() } }));
jest.mock('@/platform/media', () => ({ __esModule: true, default: { pickDocument: jest.fn() } }));
jest.mock('@/utils/mediaUrl', () => ({ resolveMediaUrl: (/** @type {string} */ url) => url }));

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);

jest.mock(
  '@/components/molecules/bottomModal/BottomModal',
  () => function BottomModalMock({ children }) {
    return children;
  },
);

jest.mock('@/components/atoms/button/Button', () => function ButtonMock(/** @type {any} */ props) {
  mockBoutons.push(props);
  return null;
});

const cotisation = (extra = {}) => ({
  amountDueCents: 12000,
  amountPaidCents: 5000,
  amountRemainingCents: 7000,
  campaign: {
    documentId: 'camp-BH11', documentRequests: [], name: 'Cotisation seniors', paymentModes: { cash: true },
  },
  currency: 'EUR',
  documentId: 'assign-BH11',
  documentSubmissions: [],
  installments: [],
  payments: [{
    amountCents: 5000, documentId: 'pay-1', method: 'cash', refundedAmountCents: 4000, status: 'partially_refunded',
  }],
  receipts: [],
  status: 'partial',
  user: { firstname: 'Ana', lastname: 'Diaz' },
  ...extra,
});

/** @type {any} */
let arbre = null;

const monter = () => {
  mockCotisationRequete = {
    data: cotisation(), isError: false, isLoading: false, refetch: jest.fn(),
  };
  act(() => {
    arbre = renderer.create(
      <ClubLicenseMemberDetail
        navigation={{ goBack: jest.fn(), navigate: jest.fn(), setOptions: jest.fn() }}
        route={{ params: { assignmentId: 'assign-BH11', campaignId: 'camp-BH11', canManageLicenses: true, scope: 'manager' } }}
      />,
    );
  });
};

/** @param {string} titre */
const dernierBouton = (titre) => [...mockBoutons].reverse().find((props) => props.title === titre);
/** @param {string} titre */
const appuyer = (titre) => act(() => { dernierBouton(titre).onPress(); });
/** @param {string} valeur */
const saisirMontant = (valeur) => act(() => {
  arbre.root.findAll((n) => n.type === TextInput && n.props.keyboardType === 'decimal-pad')[0]
    .props.onChangeText(valeur);
});

describe('BH11 — la modale d action de la fiche membre', () => {
  beforeEach(() => {
    mockBoutons.length = 0;
    mockMutationFigee.mutate.mockClear();
  });

  afterEach(() => {
    if (arbre) act(() => arbre.unmount());
    arbre = null;
  });

  test.each(['', '-20', 'abc'])('P5-06 — paiement manuel « %s » refusé', (saisie) => {
    monter();
    appuyer('A payé');
    saisirMontant(saisie);
    appuyer('Valider');
    expect(mockMutationFigee.mutate).not.toHaveBeenCalled();
  });

  test('P5-07 — remboursement de 100 € sur 10 € remboursables refusé', () => {
    monter();
    appuyer('Rembourser');
    saisirMontant('100');
    act(() => {
      arbre.root.findAll((n) => n.type === TextInput && n.props.keyboardType !== 'decimal-pad')[0]
        .props.onChangeText('erreur de caisse');
    });
    appuyer('Valider');
    expect(mockMutationFigee.mutate).not.toHaveBeenCalled();
  });

  test('P5-08 — double appui sur « Valider » : une seule requête', () => {
    monter();
    appuyer('A payé');
    saisirMontant('10');
    const valider = dernierBouton('Valider');
    act(() => { valider.onPress(); valider.onPress(); });
    expect(mockMutationFigee.mutate).toHaveBeenCalledTimes(1);
  });
});
