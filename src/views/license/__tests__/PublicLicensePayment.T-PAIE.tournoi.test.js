/* eslint-disable max-len */
import '@/theme/strings';

import renderer, { act } from 'react-test-renderer';

import PublicLicensePayment from '../PublicLicensePayment';

// T-PAIE (15/11) — la page publique `/licenses/pay/:token` d'une place de tournoi :
// - le bouton Stripe s'ouvre pour une campagne `tournament`, jamais pour une licence (inchangé) ;
// - la mention « pas de droit de rétractation » (L221-28 12°, information due AVANT de payer, L221-5) est
//   écrite avant le bouton, avec un lien vers les conditions d'inscription ;
// - au retour de Stripe (`?status=success`), un payeur, même sans compte, lit « Place payée », le nom de
//   l'équipe et un lien vers la fiche du tournoi.

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

const MENTION = 'pas de droit de rétractation (art. L221-28 12° du Code de la consommation)';
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

describe('T-PAIE — page publique d une place de tournoi', () => {
  /** @type {any} */
  let arbre;
  const navigation = { navigate: jest.fn() };
  const monter = (paiement, params = {}) => {
    mockBoutons.length = 0;
    mockPaiement = paiement;
    act(() => {
      arbre = renderer.create(<PublicLicensePayment navigation={navigation} route={{ params: { token: 'tok', ...params } }} />);
    });
  };
  const titres = () => mockBoutons.map((props) => props.title);
  const texte = () => JSON.stringify(arbre.toJSON());
  afterEach(() => {
    act(() => arbre.unmount());
    navigation.navigate.mockClear();
    mockMutation.mutate.mockClear();
  });

  test('🔴 campagne `tournament` : le bouton Stripe est là et lance Stripe', () => {
    monter(placeDeTournoi());
    expect(titres()).toContain('Payer ma place');
    const bouton = mockBoutons.find((props) => props.title === 'Payer ma place');
    act(() => bouton.onPress());
    expect(mockMutation.mutate).toHaveBeenCalledWith('stripe', expect.anything());
  });

  test('🔴 la mention légale est écrite AVANT le bouton, avec le lien vers les conditions', () => {
    monter(placeDeTournoi());
    const contenu = texte();
    expect(contenu).toContain(MENTION);
    expect(contenu.indexOf(MENTION)).toBeLessThan(contenu.indexOf('[Payer ma place]'));
    expect(titres()).toContain("Conditions d'inscription");
  });

  test('licence (inchangée) : même avec `stripe: true`, aucun bouton Stripe ni mention de tournoi', () => {
    monter({
      ...placeDeTournoi(), campaignType: 'license', paymentModes: { external_link: true, stripe: true }, tournament: undefined,
    });
    expect(titres()).not.toContain('Payer ma place');
    expect(texte()).not.toContain(MENTION);
    expect(titres()).toContain('Ouvrir le lien externe du club');
  });

  test('🔴 retour de Stripe, place payée, sans compte : « Place payée », l équipe, et le lien de la fiche du tournoi', () => {
    monter(placeDeTournoi({
      remainingCents: 0, status: 'paid', totalPaidCents: 2000,
    }), { status: 'success' });
    const contenu = texte();
    expect(contenu).toContain('Place payée');
    expect(contenu).toContain('Les Rapides');
    expect(titres()).not.toContain('Payer ma place');
    const fiche = mockBoutons.find((props) => props.title === 'Voir la fiche du tournoi');
    expect(fiche).toBeTruthy();
    act(() => fiche.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith('EventDetails', { eventId: 'tournoi-1912' });
  });

  test('🔴 retour de Stripe avant l avis du paiement : « en cours de confirmation », pas « payée »', () => {
    monter(placeDeTournoi(), { status: 'success' });
    const contenu = texte();
    expect(contenu).toContain('Paiement en cours de confirmation');
    expect(contenu).not.toContain('Place payée');
  });
});
