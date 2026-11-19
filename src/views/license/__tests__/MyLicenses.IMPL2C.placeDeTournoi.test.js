/* eslint-disable max-len -- les témoins se lisent en entier. */
import '@/theme/strings';

import renderer, { act } from 'react-test-renderer';

import MyLicenses from '../MyLicenses';

// IMPL-2C (19/11/2026, écart 5 de la recette 48, compte 444) — « Voir mon reçu » (page d'équipe) ouvre
// « Mes paiements » : la place du tournoi (20 €) n'y était PAS, seule la cotisation du club (1 €).
// Cause : `/licenses/me` rend bien la place (une `license-assignment` de campagne `tournament`), mais sa
// campagne porte `seasonLabel: '2026'` (l'année du tournoi, tournament-payment.js `ensureCampaign`), et
// `splitSeasons` comparait les saisons en texte : « 2026 » < « 2026-2027 » ⇒ rangée dans « Saisons passées ».
// Et à l'inverse, une place « 2026 » faisait passer la licence « 2025-2026 » pour archivée.
// Une place de tournoi ne se range dans le passé que si sa campagne est fermée ou archivée.

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

const Colors = jest.requireActual('@/theme/colors').default();

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
// La couleur d'un texte de l'écran, retrouvé par son contenu exact (espaces insécables lues comme des espaces).
const couleursDe = (/** @type {string} */ contenu) => arbre.root.findAll((/** @type {any} */ n) => n.type === 'Text'
  && [].concat(n.props.children).join('').replace(/\s/g, ' ') === contenu)
  .map((/** @type {any} */ n) => [].concat(n.props.style).flat(9).map((s) => s?.color).filter(Boolean)
    .pop());

describe('IMPL-2C — la place du tournoi dans « Mes paiements »', () => {
  test('cas du compte 444 : licence 2026-2027 (1 €) + place 2026 (20 €) : les deux dans la liste, rien d’archivé', () => {
    const rendu = monter([LICENCE_1_EURO, PLACE_20_EUROS]);
    // PAIEMENTS-10E (19/11) : le titre d'une place est le tournoi, sans « Inscription - ».
    expect(rendu).toContain('Tournoi FoundClub x AR Soccer');
    expect(rendu).toContain('AR Soccer');
    expect(rendu).toContain('FC Recette');
    expect(rendu).not.toContain('archivée');
  });

  test('une place « 2026 » ne fait pas passer la licence « 2025-2026 » pour archivée', () => {
    const rendu = monter([
      affectation({
        campagne: 'Cotisation 2025-2026', club: 'FC Recette', documentId: 'lic', montant: 100, saison: '2025-2026',
      }),
      PLACE_20_EUROS,
    ]);
    expect(rendu).toContain('Cotisation 2025-2026');
    expect(rendu).not.toContain('archivée');
  });

  test('caractérisant (inchangé) : deux saisons de club, la plus ancienne se replie en « 1 saison archivée »', () => {
    const rendu = monter([
      LICENCE_1_EURO,
      affectation({
        campagne: 'Cotisation 2025-2026', club: 'FC Recette', documentId: 'old', montant: 100, saison: '2025-2026',
      }),
    ]);
    expect(rendu).toContain('1 saison archivée');
    expect(rendu).not.toContain('Cotisation 2025-2026');
  });

  test('une place de tournoi dont la campagne est fermée part dans les saisons passées', () => {
    const rendu = monter([LICENCE_1_EURO, { ...PLACE_20_EUROS, campaign: { ...PLACE_20_EUROS.campaign, status: 'closed' } }]);
    expect(rendu).not.toContain('Tournoi FoundClub x AR Soccer');
    expect(rendu).toContain('1 saison archivée');
  });

  test('plus de vert sur ce que MyLicenses.js dessine (Adel : « tout ce qui est vert, en bleu ») : total réglé, montants réglés, « à jour »', () => {
    // La pastille « Payé » (`getMemberStatusTone`) et la barre (`MemberProgressBar`) sont passées au
    // bleu à leur tour (PAIEMENTS-10E) : témoin MyLicenses.PAIEMENTS10E.placeDeTournoi.
    monter([LICENCE_1_EURO, PLACE_20_EUROS]);
    expect(couleursDe('0,00 €')).toEqual([Colors.primary500]);
    expect(couleursDe('1,00 €')).toEqual([Colors.primary500]);
    expect(couleursDe('20,00 €')).toEqual([Colors.primary500]);
    expect(couleursDe('à jour')).toEqual([Colors.primary500, Colors.primary500]);
  });
});
