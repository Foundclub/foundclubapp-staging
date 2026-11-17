/* eslint-disable max-len -- comme PublicLicensePayment.T-PARENT.test.js */
import '@/theme/strings';

import renderer, { act } from 'react-test-renderer';

import { createPublicLicenseCheckout } from '@/services/license/licenseService';

import PublicLicensePayment from '../PublicLicensePayment';

// T-TAILLE (16/11, Adel ; chef du tournoi par délégation) — sur la page publique `/licenses/pay/:token` d'une
// place de tournoi qui fournit les maillots (`tournament.jerseySizeRequired`, drapeau du tournoi) :
// - six tailles XS à XXL, AVANT le bouton, avec la phrase « taille du joueur » (le payeur peut être un autre) ;
// - nom (12 lettres) et numéro (1 à 99) facultatifs ; phrase « au cas où, pas promis » ; phrase « assistance » ;
// - bouton « Payer ma place » inactif tant qu'aucune taille n'est choisie (ou nom / numéro invalides), message visible ;
// - le maillot part avec le paiement (`jersey`) ; un maillot déjà gardé est présélectionné ;
// - sans drapeau (autre tournoi, licence) : aucun sélecteur, rien de plus envoyé.

/** @type {any[]} */
const mockBoutons = [];
/** @type {any} */
let mockPaiement;
const mockMutation = { isPending: false, mutate: jest.fn() };
/** @type {any[]} */
const mockOptions = [];

jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => {
    mockOptions.push(options);
    return mockMutation;
  },
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

const place = (extra = {}) => ({
  campaignStatus: 'active',
  campaignType: 'tournament',
  clubName: 'FoundClub x AR Soccer',
  currency: 'EUR',
  description: 'Description de campagne',
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
const maillot = (extra = {}) => place({
  tournament: {
    ...place().tournament, jersey: null, jerseySizeRequired: true, ...extra,
  },
});

describe('T-TAILLE — maillot sur la page de paiement d une place', () => {
  /** @type {any} */
  let arbre;
  const monter = (/** @type {any} */ paiement) => {
    mockBoutons.length = 0;
    mockPaiement = paiement;
    act(() => {
      arbre = renderer.create(<PublicLicensePayment navigation={{ navigate: jest.fn() }} route={{ params: { token: 'tok' } }} />);
    });
  };
  const texte = () => JSON.stringify(arbre.toJSON());
  const checkout = () => mockOptions.at(-2);
  const payer = () => mockBoutons.filter((props) => props.title === 'Payer 20 € par carte').at(-1);
  const taille = (/** @type {string} */ valeur) => arbre.root.find((/** @type {any} */ node) => node.props.testID === `jersey-size-${valeur}` && node.props.onPress);
  const tailles = () => arbre.root.findAll((/** @type {any} */ node) => typeof node.props.testID === 'string' && /^jersey-size-[A-Z]+$/.test(node.props.testID) && node.props.onPress);
  const saisir = (/** @type {string} */ id, /** @type {string} */ valeur) => act(() => arbre.root.find((/** @type {any} */ node) => node.props.testID === id && node.props.onChangeText).props.onChangeText(valeur));
  afterEach(() => {
    act(() => arbre.unmount());
    mockOptions.length = 0;
    /** @type {any} */ (createPublicLicenseCheckout).mockClear();
  });

  test('🔴 drapeau : six tailles XS à XXL, AVANT le bouton, phrases « taille du joueur », « pas promis », « assistance » ; groupe lu par le lecteur d écran', () => {
    monter(maillot());
    const contenu = texte();
    expect(contenu).toContain('Taille du maillot');
    expect(contenu).toContain('Choisis la taille du joueur inscrit');
    expect(contenu).toContain('Il n’est pas promis et ne fait pas partie du prix.');
    expect(contenu).toContain('« Assistance FoundClub »');
    expect(contenu).not.toContain('compris dans la place');
    expect([...new Set(tailles().map((node) => node.props.testID))]).toEqual(['XS', 'S', 'M', 'L', 'XL', 'XXL'].map((v) => `jersey-size-${v}`));
    expect(contenu.indexOf('Taille du maillot')).toBeLessThan(contenu.indexOf('[Payer 20 € par carte]'));
    const groupe = arbre.root.find((/** @type {any} */ node) => node.props.accessibilityRole === 'radiogroup' && node.props.accessibilityLabel === 'Taille du maillot');
    expect(groupe).toBeTruthy();
    expect(taille('M').props.accessibilityRole).toBe('radio');
  });

  test('🔴 drapeau : bouton inactif et message visible sans taille ; une taille choisie : actif, message parti', () => {
    monter(maillot());
    expect(payer().disabled).toBe(true);
    expect(texte()).toContain('Choisis une taille pour pouvoir payer.');
    act(() => taille('L').props.onPress());
    expect(payer().disabled).toBe(false);
    expect(taille('L').props.accessibilityState).toEqual({ selected: true });
    expect(texte()).not.toContain('Choisis une taille pour pouvoir payer.');
  });

  test('🔴 drapeau : taille seule => `jersey: { size }` part avec le paiement', async () => {
    monter(maillot());
    act(() => taille('XL').props.onPress());
    await checkout().mutationFn('stripe');
    expect(createPublicLicenseCheckout).toHaveBeenCalledWith('tok', { jersey: { size: 'XL' }, provider: 'stripe' });
  });

  test('🔴 drapeau : nom et numéro remplis partent avec la taille', async () => {
    monter(maillot());
    act(() => taille('M').props.onPress());
    saisir('jersey-name', '  Jean-Éloi ');
    saisir('jersey-number', '7');
    expect(payer().disabled).toBe(false);
    await checkout().mutationFn('stripe');
    expect(createPublicLicenseCheckout).toHaveBeenCalledWith('tok', { jersey: { name: 'Jean-Éloi', number: 7, size: 'M' }, provider: 'stripe' });
  });

  test('🔴 drapeau : nom ou numéro invalides => bouton inactif, message visible', () => {
    monter(maillot());
    act(() => taille('M').props.onPress());
    saisir('jersey-name', 'Zizou10');
    expect(payer().disabled).toBe(true);
    expect(texte()).toContain('Nom : 12 lettres au plus');
    saisir('jersey-name', 'Zizou');
    saisir('jersey-number', '0');
    expect(payer().disabled).toBe(true);
    expect(texte()).toContain('Numéro : un nombre de 1 à 99.');
    saisir('jersey-number', '99');
    expect(payer().disabled).toBe(false);
  });

  test('drapeau : un maillot déjà gardé est présélectionné, bouton actif, renvoyé tel quel', async () => {
    monter(maillot({ jersey: { name: 'Zizou', number: 10, size: 'S' } }));
    expect(taille('S').props.accessibilityState).toEqual({ selected: true });
    expect(payer().disabled).toBe(false);
    await checkout().mutationFn('stripe');
    expect(createPublicLicenseCheckout).toHaveBeenCalledWith('tok', { jersey: { name: 'Zizou', number: 10, size: 'S' }, provider: 'stripe' });
  });

  test('sans drapeau : aucun sélecteur, bouton actif, rien de plus envoyé', async () => {
    monter(place());
    expect(texte()).not.toContain('Taille du maillot');
    expect(tailles()).toHaveLength(0);
    expect(payer().disabled).toBeFalsy();
    await checkout().mutationFn('stripe');
    expect(createPublicLicenseCheckout).toHaveBeenCalledWith('tok', { provider: 'stripe' });
  });

  test('drapeau + ado : le bouton attend les DEUX (autorisation et taille)', () => {
    monter(maillot({ parentalConsentRequired: true }));
    act(() => taille('M').props.onPress());
    expect(payer().disabled).toBe(true);
  });
});
