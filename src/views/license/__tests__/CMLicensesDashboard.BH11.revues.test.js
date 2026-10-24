/* eslint-disable max-len */
import '@/theme/strings';

import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import CMLicensesDashboard from '../CMLicensesDashboard';

// BH11 (BUGHUNT 24/10) P5-10 — tableau multisport, paiements a valider :
//   · « Rejeter » demande une confirmation avant de partir ;
//   · un double appui sur « Valider » n envoie qu une requete.

/** @type {any[]} */
const mockBoutons = [];
const mockApprouver = { isPending: false, mutate: jest.fn() };
const mockRejeter = { isPending: false, mutate: jest.fn() };
const mockAutre = { isPending: false, mutate: jest.fn() };
let mockAppelMutation = 0;
const mockRevues = {
  data: {
    data: [{
      documentId: 'a1',
      payments: [{ amountCents: 5000, id: 'p1', status: 'manual_review' }],
      user: { firstname: 'Ana', lastname: 'Diaz' },
    }],
  },
  isError: false,
  isLoading: false,
};

jest.mock('@/services/license/licenseQueries', () => ({
  approveExternalLicensePayment: jest.fn(),
  bulkCreateCMLicenseCampaigns: jest.fn(),
  bulkGenerateCMLicenseAssignments: jest.fn(),
  rejectExternalLicensePayment: jest.fn(),
  useCMLicenseDashboard: () => ({ data: { sections: [], totals: {} }, isError: false, isLoading: false }),
  useCMLicensePaymentReviews: () => mockRevues,
  // Ordre d appel dans l ecran : creation, generation, validation, rejet.
  useLicenseMutation: () => {
    mockAppelMutation += 1;
    return [mockAutre, mockAutre, mockApprouver, mockRejeter][(mockAppelMutation - 1) % 4];
  },
}));
jest.mock('@/components/atoms/button/Button', () => function ButtonMock(/** @type {any} */ props) {
  mockBoutons.push(props);
  return null;
});
jest.mock('@/components/atoms/marqueeText/MarqueeText', () => function MarqueeMock() { return null; });
jest.mock('@/components/templates/ScreenContainer', () => function ScreenMock({ children }) { return children; });
jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonLoaderMock() { return null; },
);
jest.mock('react-native-linear-gradient', () => function GradientMock() { return null; });
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

/**
 * Le dernier bouton rendu portant ce titre.
 * @param {string} titre - Le titre exact.
 * @returns {any} Ses props.
 */
const dernier = (titre) => [...mockBoutons].reverse().find((props) => props.title === titre);

/** @type {any} */
let arbre = null;
beforeEach(() => {
  mockBoutons.length = 0;
  mockAppelMutation = 0;
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  act(() => {
    arbre = renderer.create(
      <CMLicensesDashboard navigation={{ navigate: jest.fn() }} route={{ params: { cmId: 'cm1' } }} />,
    );
  });
});
afterEach(() => {
  Alert.alert.mockRestore();
  act(() => arbre.unmount());
});

test('BH11 P5-10 — « Rejeter » demande confirmation avant de partir', () => {
  act(() => { dernier('Rejeter').onPress(); });
  expect(mockRejeter.mutate).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledTimes(1);
});

test('BH11 P5-10 — double appui sur « Valider » : une seule requête', () => {
  const valider = dernier('Valider');
  act(() => { valider.onPress(); valider.onPress(); });
  expect(mockApprouver.mutate).toHaveBeenCalledTimes(1);
});
