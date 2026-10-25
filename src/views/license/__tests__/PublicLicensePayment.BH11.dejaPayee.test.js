/* eslint-disable max-len */
import '@/theme/strings';

import renderer, { act } from 'react-test-renderer';

import PublicLicensePayment from '../PublicLicensePayment';

// BH11 (BUGHUNT 24/10) P5-05 — la page de paiement publique ne propose plus de
// payer en ligne une cotisation deja payee, exemptee ou sans reste a payer.

/** @type {any[]} */
const mockBoutons = [];
/** @type {any} */
let mockPaiement;
const mockMutation = { isPending: false, mutate: jest.fn() };

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => mockMutation,
  useQuery: () => ({
    data: mockPaiement, isError: false, isLoading: false, refetch: jest.fn(),
  }),
}));
jest.mock('@/services/license/licenseService', () => ({
  createPublicLicenseCheckout: jest.fn(),
  declarePublicExternalLicensePayment: jest.fn(),
  getPublicLicensePayment: jest.fn(),
}));
jest.mock('@/platform/links', () => ({ __esModule: true, default: { openUrl: jest.fn() } }));
jest.mock('@/components/atoms/button/Button', () => function ButtonMock(/** @type {any} */ props) {
  mockBoutons.push(props);
  return null;
});
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

const titres = () => mockBoutons.map((props) => props.title);

describe('BH11 P5-05 — paiement public', () => {
  /** @type {any} */
  let arbre;
  const monter = (extra) => {
    mockBoutons.length = 0;
    mockPaiement = {
      amountDueCents: 12000,
      campaignStatus: 'active',
      currency: 'EUR',
      paymentModes: { external_link: true, helloasso: true },
      remainingCents: 12000,
      status: 'pending',
      ...extra,
    };
    act(() => {
      arbre = renderer.create(<PublicLicensePayment route={{ params: { token: 'tok' } }} />);
    });
  };
  afterEach(() => act(() => arbre.unmount()));

  test('une cotisation à payer propose HelloAsso (non-régression)', () => {
    monter({});
    expect(titres()).toContain('Payer avec HelloAsso');
  });

  test.each([
    [{ remainingCents: 0, status: 'paid' }],
    [{ remainingCents: 12000, status: 'waived' }],
    [{ remainingCents: 0, status: 'pending' }],
  ])('aucun paiement en ligne pour %j', (extra) => {
    monter(extra);
    expect(titres()).not.toContain('Payer avec HelloAsso');
    expect(titres()).not.toContain('Ouvrir le lien externe du club');
  });
});
