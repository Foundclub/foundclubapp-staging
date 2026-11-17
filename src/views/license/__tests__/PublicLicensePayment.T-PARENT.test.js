/* eslint-disable max-len, import/order -- comme PublicLicensePayment.js */
import '@/theme/strings';

import renderer, { act } from 'react-test-renderer';

import { createPublicLicenseCheckout } from '@/services/license/licenseService';

import PublicLicensePayment from '../PublicLicensePayment';
import LinksPlatform from '@/platform/links';

// T-PARENT (15/11, Adel D20 A) — sur la page publique `/licenses/pay/:token` d'une place de tournoi :
// - un joueur de 16-17 ans marqué (`tournament.parentalConsentRequired`) : bloc « Autorisation parentale » avant le
//   bouton ; bouton inactif tant que la case obligatoire et les champs du parent manquent ; l'autorisation part avec
//   le paiement (`parentalConsent`, version du texte) ;
// - un adulte, une licence : aucun bloc parental ;
// - une place de tournoi n'affiche plus les rubriques de licence (Campagne, Échéancier, Documents demandés) ;
//   une licence les garde ;
// - « Conditions d'inscription » ouvre la page publique du site `/conditions-tournoi`.

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
const ado = () => place({ tournament: { ...place().tournament, parentalConsentRequired: true } });

describe('T-PARENT — autorisation parentale sur la page de paiement d une place', () => {
  /** @type {any} */
  let arbre;
  const navigation = { navigate: jest.fn() };
  const monter = (/** @type {any} */ paiement) => {
    mockBoutons.length = 0;
    mockPaiement = paiement;
    act(() => {
      arbre = renderer.create(<PublicLicensePayment navigation={navigation} route={{ params: { token: 'tok' } }} />);
    });
  };
  const texte = () => JSON.stringify(arbre.toJSON());
  // Deux mutations par rendu, dans l'ordre de la page : le paiement, puis la déclaration hors app.
  const checkout = () => mockOptions.at(-2);
  const payer = () => mockBoutons.filter((props) => props.title === 'Payer 20 € par carte').at(-1);
  const champ = (/** @type {string} */ id) => arbre.root.find((/** @type {any} */ node) => node.props.testID === id && (node.props.onPress || node.props.onChangeText));
  const saisir = (/** @type {string} */ id, /** @type {string} */ valeur) => act(() => champ(id).props.onChangeText(valeur));
  const toucher = (/** @type {string} */ id) => act(() => champ(id).props.onPress());
  const remplir = () => {
    saisir('parental-consent-name', 'Nadia Exemple');
    toucher('parental-consent-relation-mother');
    saisir('parental-consent-phone', '06 12 34 56 78');
    toucher('parental-consent-return-picked_up');
  };
  afterEach(() => {
    act(() => arbre.unmount());
    mockMutation.mutate.mockClear();
    mockOptions.length = 0;
    navigation.navigate.mockClear();
    /** @type {any} */ (createPublicLicenseCheckout).mockClear();
    /** @type {any} */ (LinksPlatform.openUrl).mockClear();
  });

  test('🔴 ado : le bloc est là, AVANT le bouton, avec le texte de l autorisation et la case image non cochée', () => {
    monter(ado());
    const contenu = texte();
    expect(contenu).toContain('Autorisation parentale');
    expect(contenu).toContain('pas de contre-indication');
    expect(contenu).toContain('appeler les secours');
    expect(contenu.indexOf('Autorisation parentale')).toBeLessThan(contenu.indexOf('[Payer 20 € par carte]'));
    expect(champ('parental-consent-image').props.accessibilityState).toEqual({ checked: false });
  });

  test('🔴 ado : bouton inactif sans la case ; champs remplis sans la case : toujours inactif ; avec : actif', () => {
    monter(ado());
    expect(payer().disabled).toBe(true);
    remplir();
    expect(payer().disabled).toBe(true);
    toucher('parental-consent-accept');
    expect(payer().disabled).toBe(false);
  });

  test('🔴 ado : l autorisation part avec le paiement (version du texte, image non cochée)', async () => {
    monter(ado());
    remplir();
    toucher('parental-consent-accept');
    await checkout().mutationFn('stripe');
    expect(createPublicLicenseCheckout).toHaveBeenCalledWith('tok', {
      parentalConsent: {
        accepted: true,
        imageConsent: false,
        legalVersion: 'tournament-parental-consent-v1-2026-11-15',
        parentName: 'Nadia Exemple',
        parentPhone: '06 12 34 56 78',
        relation: 'mother',
        returnMode: 'picked_up',
      },
      provider: 'stripe',
    });
  });

  test('adulte : aucun bloc parental, bouton actif, rien de plus envoyé', async () => {
    monter(place());
    expect(texte()).not.toContain('Autorisation parentale');
    expect(payer().disabled).toBeFalsy();
    await checkout().mutationFn('stripe');
    expect(createPublicLicenseCheckout).toHaveBeenCalledWith('tok', { provider: 'stripe' });
  });

  test('🔴 place de tournoi : ni Campagne, ni Échéancier, ni Documents demandés', () => {
    monter(place());
    const contenu = texte();
    expect(contenu).not.toContain('Campagne');
    expect(contenu).not.toContain('Échéancier');
    expect(contenu).not.toContain('Documents demandes');
    expect(contenu).not.toContain('Description de campagne');
  });

  test('licence : inchangée (les trois rubriques, aucun bloc parental)', () => {
    monter({
      ...place(), campaignType: 'license', paymentModes: { external_link: true }, tournament: { parentalConsentRequired: true },
    });
    const contenu = texte();
    expect(contenu).toContain('Campagne');
    expect(contenu).toContain('Échéancier');
    expect(contenu).toContain('Documents demandes');
    expect(contenu).not.toContain('Autorisation parentale');
  });

  test('🔴 « Conditions d inscription » ouvre la page publique du site', () => {
    monter(place());
    const lien = mockBoutons.find((props) => props.title === "Conditions d'inscription");
    act(() => lien.onPress());
    expect(LinksPlatform.openUrl).toHaveBeenCalledWith(expect.stringMatching(/\/conditions-tournoi$/));
    expect(navigation.navigate).not.toHaveBeenCalled();
  });
});
