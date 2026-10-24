/* eslint-disable max-len */
import '@/theme/strings';

import { TextInput } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import ClubLicensePayments from '../ClubLicensePayments';

// BH11 (BUGHUNT 24/10) P5-21 — le motif de rejet est « obligatoire » :
// la modale ne laisse pas rejeter tant qu il est vide.

/** @type {any[]} */
const mockBoutons = [];
const mockMutation = { isPending: false, mutate: jest.fn() };
const mockRevues = {
  data: {
    data: [{
      currency: 'EUR',
      documentId: 'a1',
      payments: [{ amountCents: 5000, documentId: 'p1', status: 'manual_review' }],
      status: 'pending',
      user: { firstname: 'Ana', lastname: 'Diaz' },
    }],
  },
  isError: false,
  isLoading: false,
  isRefetching: false,
  refetch: jest.fn(),
};
const mockVide = {
  data: null, isError: false, isLoading: false, refetch: jest.fn(),
};

jest.mock('@/services/license/licenseQueries', () => ({
  approveExternalLicensePayment: jest.fn(),
  rejectExternalLicensePayment: jest.fn(),
  useCurrentLicenseCampaign: () => mockVide,
  useLicenseDashboard: () => mockVide,
  useLicenseMutation: () => mockMutation,
  useLicensePaymentReviews: () => mockRevues,
}));
jest.mock('@/components/atoms/button/Button', () => function ButtonMock(/** @type {any} */ props) {
  mockBoutons.push(props);
  return null;
});
jest.mock('@/components/atoms/marqueeText/MarqueeText', () => function MarqueeMock() { return null; });
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function ModalMock({ children }) { return children; });
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

test('BH11 P5-21 — « Rejeter » reste inactif tant que le motif est vide', () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(
      <ClubLicensePayments
        navigation={{ goBack: jest.fn(), navigate: jest.fn() }}
        route={{ params: { campaignId: 'c1', canManageLicenses: true, scope: 'manager' } }}
      />,
    );
  });
  act(() => { dernier('Rejeter').onPress(); });
  expect(arbre.root.findAllByType(TextInput)).toHaveLength(1);
  expect(dernier('Rejeter').disabled).toBe(true);

  act(() => { arbre.root.findByType(TextInput).props.onChangeText('Virement introuvable'); });
  expect(dernier('Rejeter').disabled).toBe(false);
  act(() => arbre.unmount());
});
