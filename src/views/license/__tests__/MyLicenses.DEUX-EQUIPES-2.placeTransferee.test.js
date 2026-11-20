/* eslint-disable max-len -- les témoins se lisent en entier. */
import '@/theme/strings';

import renderer, { act } from 'react-test-renderer';

import MyLicenses from '../MyLicenses';

// DEUX-EQUIPES-2 (19/11/2026, D282 « A ») — la place payée suit le joueur ; /licenses/me rend
// `tournamentTransfer` ({ at, fromTeamName, toTeamName }) et la carte le dit en une ligne.
// Doublures copiées de MyLicenses.IMPL2C.placeDeTournoi.test.js.

/** @type {any} */
let mockMesCotisations;

jest.mock('@/services/license/licenseQueries', () => ({
  useMyLicenses: () => mockMesCotisations,
}));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ accountRoleKey: 'player' }),
}));
jest.mock('@/services/parentLink/parentLinkQueries', () => ({}));
jest.mock('@/services/declaredChild/declaredChildQueries', () => ({}));
const mockNavigationContexte = { goBack: jest.fn(), navigate: jest.fn() };
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigationContexte,
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
jest.mock(
  '@/components/atoms/skeletonLoader/SkeletonLoader',
  () => function SkeletonLoaderMock() { return null; },
);

const affectation = (/** @type {any} */ {
  campagne, club, documentId, etatCampagne = 'active', montant, saison, statut = 'paid', type = 'license',
}) => ({
  amountDueCents: montant,
  amountPaidCents: statut === 'paid' ? montant : 0,
  amountRemainingCents: statut === 'paid' ? 0 : montant,
  campaign: {
    club: { name: club }, documentId: `camp-${documentId}`, name: campagne, paymentModes: {}, seasonLabel: saison, status: etatCampagne, type,
  },
  club: { documentId: `club-${club}`, name: club },
  currency: 'EUR',
  documentId,
  installments: [],
  payments: [],
  receipts: [],
  status: statut,
});

const LICENCE_1_EURO = affectation({
  campagne: 'Cotisation 2026-2027', club: 'FC Recette', documentId: 'lic', montant: 100, saison: '2026-2027',
});
const PLACE_20_EUROS = affectation({
  campagne: 'Inscription - Tournoi FoundClub x AR Soccer', club: 'AR Soccer', documentId: 'place', montant: 2000, saison: '2026', type: 'tournament',
});

/** @type {any} */
let arbre = null;
afterEach(() => {
  if (arbre) act(() => arbre.unmount());
  arbre = null;
});
const monter = (/** @type {any[]} */ liste) => {
  mockMesCotisations = {
    data: liste, isError: false, isLoading: false, refetch: jest.fn(),
  };
  act(() => {
    arbre = renderer.create(
      <MyLicenses navigation={{ canGoBack: () => true, goBack: jest.fn(), navigate: jest.fn() }} route={{ params: {} }} />,
    );
  });
  return JSON.stringify(arbre.toJSON());
};

describe('DEUX-EQUIPES-2 (D282) — « Mes paiements » dit que la place a suivi le joueur', () => {
  test('🔴 place transférée : « Place transférée de EMU Test 002 vers Recette Site 333 le 19 novembre 2026 »', () => {
    const rendu = monter([{
      ...PLACE_20_EUROS,
      tournamentTransfer: { at: '2026-11-19T17:40:00.000Z', fromTeamName: 'EMU Test 002', toTeamName: 'Recette Site 333' },
    }]);
    expect(rendu).toContain('Place transférée de EMU Test 002 vers Recette Site 333 le 19 novembre 2026');
  });

  test('sans transfert (place, licence) : aucune ligne de transfert', () => {
    monter([LICENCE_1_EURO, PLACE_20_EUROS]);
    expect(arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'my-licenses-place-transferred')).toHaveLength(0);
  });
});
