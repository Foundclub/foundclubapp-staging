/* eslint-disable max-len */
import '@/theme/strings';

import renderer, { act } from 'react-test-renderer';

import PublicLicensePayment from '../PublicLicensePayment';

// T-PARCOURS-1 (17/11/2026, R8, Adel D206) — « Payer ma place » parle de TOURNOI, et Stripe s'ouvre dans le MÊME
// onglet. Tournée de la recette 41 (lignes 17 et 18) : la page disait « Choisis le moyen proposé par le club »
// (les mots d'une cotisation) et le bouton ouvrait Stripe en fenêtre surgissante, que le navigateur bloque
// après l'appel au serveur : le joueur ne voyait rien se passer.
// E6 : une COTISATION de club ne doit RIEN changer : son titre, son texte, son ouverture (`openUrl`).

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
jest.mock('@/platform/links', () => ({ __esModule: true, default: { openUrl: jest.fn(), openUrlHere: jest.fn() } }));
/** @type {{ openUrl: jest.Mock, openUrlHere: jest.Mock }} */
const mockLiens = jest.requireMock('@/platform/links').default;
jest.mock('@/components/atoms/button/Button', () => {
  const react = jest.requireActual('react');
  const rn = jest.requireActual('react-native');
  return function ButtonMock(/** @type {any} */ props) {
    mockBoutons.push(props);
    return react.createElement(rn.Text, { testID: `bouton:${props.title}` }, `[${props.title}]`);
  };
});
jest.mock('@/components/molecules/bottomModal/BottomModal', () => function ModalMock({ children }) { return children; });
jest.mock('@/components/templates/ScreenContainer', () => function ScreenMock({ children }) { return children; });
jest.mock('@/components/atoms/skeletonLoader/SkeletonLoader', () => function SkeletonLoaderMock() { return null; });
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

const placeDeTournoi = (extra = {}) => ({
  campaignStatus: 'active',
  campaignType: 'tournament',
  clubName: 'FoundClub x AR Soccer',
  currency: 'EUR',
  memberName: 'Joueur Deux',
  paymentModes: {
    bank_transfer: false, cash: false, check: false, stripe: true,
  },
  remainingCents: 2000,
  status: 'pending',
  totalDueCents: 2000,
  totalPaidCents: 0,
  tournament: { eventDocumentId: 'tournoi-1912', eventName: 'Tournoi FoundClub x AR Soccer', teamName: 'Les Rapides' },
  ...extra,
});
const cotisation = () => ({
  ...placeDeTournoi(),
  campaignType: 'license',
  clubName: 'AS Les Bruyères',
  paymentModes: { helloasso: true, stripe: false },
  tournament: undefined,
});

describe('T-PARCOURS-1 — R8, la page de paiement d une place de tournoi', () => {
  /** @type {any} */
  let arbre;
  const monter = (paiement) => {
    mockBoutons.length = 0;
    mockPaiement = paiement;
    act(() => {
      arbre = renderer.create(<PublicLicensePayment navigation={{ navigate: jest.fn() }} route={{ params: { token: 'tok' } }} />);
    });
  };
  const titres = () => mockBoutons.map((props) => props.title);
  const texte = () => JSON.stringify(arbre.toJSON());
  const payerAvec = (titre) => {
    const bouton = mockBoutons.find((props) => props.title === titre);
    expect(bouton).toBeTruthy();
    act(() => bouton.onPress());
    const [, options] = mockMutation.mutate.mock.calls[0];
    return act(() => options.onSuccess({ checkoutUrl: 'https://checkout.stripe.com/c/pay/cs_test_banc' }));
  };
  afterEach(() => {
    act(() => arbre.unmount());
    mockMutation.mutate.mockClear();
    mockLiens.openUrl.mockClear();
    mockLiens.openUrlHere.mockClear();
  });

  test('🔒 cotisation de club (E6, inchangée) : son titre, « Choisis le moyen proposé par le club. », et openUrl', async () => {
    monter(cotisation());
    expect(texte()).toContain('Paiement cotisation');
    expect(texte()).toContain('Choisis le moyen proposé par le club.');
    await payerAvec('Payer avec HelloAsso');
    expect(mockLiens.openUrl).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_banc');
    expect(mockLiens.openUrlHere).not.toHaveBeenCalled();
  });

  test('🔴 place de tournoi : « Ta place au tournoi », sans « moyen proposé par le club »', () => {
    monter(placeDeTournoi());
    expect(texte()).toContain('Ta place au tournoi');
    expect(texte()).not.toContain('Inscription au tournoi');
    expect(texte()).not.toContain('moyen proposé par le club');
  });

  test('🔴 place de tournoi : le bouton dit le prix et le moyen, « Payer 20 € par carte »', () => {
    monter(placeDeTournoi());
    expect(titres()).toContain('Payer 20 € par carte');
    expect(titres()).not.toContain('Payer ma place');
  });

  test('🔴 place de tournoi : Stripe s ouvre dans le même onglet (openUrlHere), jamais en fenêtre surgissante', async () => {
    monter(placeDeTournoi());
    await payerAvec('Payer 20 € par carte');
    expect(mockMutation.mutate).toHaveBeenCalledWith('stripe', expect.anything());
    expect(mockLiens.openUrlHere).toHaveBeenCalledWith('https://checkout.stripe.com/c/pay/cs_test_banc');
    expect(mockLiens.openUrl).not.toHaveBeenCalled();
  });
});
