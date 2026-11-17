/* eslint-disable max-len */
import '@/theme/strings';

import renderer, { act } from 'react-test-renderer';

import PublicLicensePayment from '../PublicLicensePayment';

// T-COMPLEXE, étape 2 (15/11, décision d'Adel D13 B) — la page publique `/licenses/pay/:token` d'une
// place de tournoi relié à un complexe dit, AU-DESSUS du bouton « Payer ma place » : « En t'inscrivant,
// tu ajoutes <complexe> à tes favoris sur FoundClub. Tu peux le retirer à tout moment. » Le nom vient
// du serveur (`tournament.complexeName`), jamais écrit en dur. Sans complexe, licence, place payée : rien.
// Doublures reprises de PublicLicensePayment.T-PAIE.tournoi.test.js.

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

const PHRASE = 'En t’inscrivant, tu ajoutes AR Soccer à tes favoris sur FoundClub. Tu peux le retirer à tout moment.';
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

describe('T-COMPLEXE — la phrase du favori sur la page de paiement d une place', () => {
  /** @type {any} */
  let arbre;
  const monter = (paiement) => {
    mockBoutons.length = 0;
    mockPaiement = paiement;
    act(() => {
      arbre = renderer.create(<PublicLicensePayment navigation={{ navigate: jest.fn() }} route={{ params: { token: 'tok' } }} />);
    });
  };
  const texte = () => JSON.stringify(arbre.toJSON());
  afterEach(() => act(() => arbre.unmount()));

  test('🔴 tournoi d un complexe : la phrase, avec le nom lu, au-dessus de « Payer ma place »', () => {
    monter(placeDeTournoi({
      tournament: {
        complexeName: 'AR Soccer', eventDocumentId: 'tournoi-1912', eventName: 'Tournoi', teamName: 'Les Rapides',
      },
    }));
    const contenu = texte();
    expect(contenu).toContain(PHRASE);
    expect(contenu.indexOf(PHRASE)).toBeLessThan(contenu.indexOf('[Payer 20 € par carte]'));
  });

  test('sans complexe (champ absent ou null), licence, place déjà payée : aucune phrase', () => {
    monter(placeDeTournoi());
    expect(texte()).not.toContain('à tes favoris');
    monter(placeDeTournoi({ tournament: { complexeName: null, eventName: 'Tournoi' } }));
    expect(texte()).not.toContain('à tes favoris');
    monter({ ...placeDeTournoi(), campaignType: 'license', tournament: { complexeName: 'AR Soccer' } });
    expect(texte()).not.toContain('à tes favoris');
    monter(placeDeTournoi({
      remainingCents: 0, status: 'paid', totalPaidCents: 2000, tournament: { complexeName: 'AR Soccer' },
    }));
    expect(texte()).not.toContain('à tes favoris');
  });
});
