/* eslint-disable max-len -- les témoins se lisent en entier. */
import '@/theme/strings';

import renderer, { act } from 'react-test-renderer';

import { describeTotalsLine, getMemberStatusTone } from '../memberLicenseModel';
import MyLicenses from '../MyLicenses';

// PAIEMENTS-10E (19/11/2026, liste de fidélité d'Adel, écran 10e « Mes paiements », planche e10e.png) :
// 1. le résumé du haut dit « 1 place de tournoi » (plus « 1 cotisation · 1 club · saison 2026 ») ;
// 2. le titre est le tournoi (« Tournoi FoundClub x AR Soccer », plus « Inscription - … ») ;
// 3. la ligne sous le titre : « Place de Prénom Nom · équipe Les Panthères » ;
// 4. l'état en bleu (pastille, barre, montant : plus de vert, décision d'Adel « tout en bleu ») ;
// 5. « Voir le reçu » sur la carte (le bouton du détail reste).
// Une cotisation de club ne change pas (témoin caractérisant, dernier bloc).

/** @type {any} */
let mockMesCotisations;
/** @type {any} */
let mockEvenement;
/** @type {any} */
let mockCompte = { accountRoleKey: 'player', userData: { documentId: 'u-thomas', firstname: 'Thomas', lastname: 'Garnier' } };
const mockTelecharger = jest.fn(async () => undefined);
const mockGenererRecu = jest.fn(async () => ({ pdfFile: { url: '/uploads/recu-neuf.pdf' }, receiptNumber: 'FC-2026-2' }));

jest.mock('@/services/license/licenseQueries', () => ({
  generateLicenseReceipt: (/** @type {any} */ ...args) => mockGenererRecu(...args),
  useChildrenLicenses: () => ({ data: { 'u-enfant': mockMesCotisations?.data?.[0] }, isError: false, isLoading: false }),
  useMyLicenses: () => mockMesCotisations,
}));
// La fiche du tournoi (cle `['event', id]`), lue par `useTournamentTeamName`.
jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQuery: (/** @type {any} */ { queryKey }) => (queryKey?.[0] === 'event' && queryKey?.[1] ? mockEvenement : { data: undefined }),
}));
jest.mock('@/platform/media/downloadRemoteFile', () => ({
  downloadRemoteFile: (/** @type {any} */ ...args) => mockTelecharger(...args),
}));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockCompte,
}));
jest.mock('@/services/parentLink/parentLinkQueries', () => ({
  useParentLinksAsParent: () => ({ data: { children: [{ documentId: 'u-enfant', firstname: 'Léo', lastname: 'Garnier' }] }, isError: false, isLoading: false }),
}));
jest.mock('@/services/declaredChild/declaredChildQueries', () => ({
  useGetMyDeclaredChildren: () => ({ data: [], isError: false, isLoading: false }),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
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

const PLACE = {
  amountDueCents: 2000,
  amountPaidCents: 2000,
  amountRemainingCents: 0,
  campaign: {
    club: { name: 'AR Soccer' },
    documentId: 'camp-place',
    name: 'Inscription - Tournoi FoundClub x AR Soccer',
    paymentModes: {},
    seasonLabel: '2026',
    status: 'active',
    targetConfig: { eventId: 'tournoi-1912', source: 'tournament' },
    type: 'tournament',
  },
  club: { documentId: 'club-ar', name: 'AR Soccer' },
  currency: 'EUR',
  documentId: 'place',
  installments: [],
  payments: [{
    amountCents: 2000, documentId: 'pay-1', paidAt: '2026-11-24T18:00:00.000Z', receipt: { pdfFile: { url: '/uploads/recu-place.pdf' }, receiptNumber: 'FC-2026-1' }, status: 'confirmed',
  }],
  receipts: [],
  status: 'paid',
};
const COTISATION = {
  amountDueCents: 12000,
  amountPaidCents: 12000,
  amountRemainingCents: 0,
  campaign: {
    club: { name: 'Foot Rauze Montpellier' }, documentId: 'camp-lic', name: 'Cotisation 2026-2027', paymentModes: {}, seasonLabel: '2026-2027', status: 'active', type: 'license',
  },
  club: { documentId: 'club-rauze', name: 'Foot Rauze Montpellier' },
  currency: 'EUR',
  documentId: 'lic',
  installments: [],
  payments: [],
  receipts: [],
  status: 'paid',
  team: { name: 'Seniors A' },
};
const EVENEMENT = {
  data: {
    documentId: 'tournoi-1912',
    name: 'Tournoi FoundClub x AR Soccer',
    tournamentTeams: [
      { documentId: 'eq-autre', name: 'Les Autres', viewerMembership: null },
      { documentId: 'eq-pantheres', name: 'Les Panthères', viewerMembership: { responseStatus: 'present' } },
    ],
  },
};

/** @type {any} */
let arbre = null;
beforeEach(() => {
  mockEvenement = EVENEMENT;
  mockCompte = { accountRoleKey: 'player', userData: { documentId: 'u-thomas', firstname: 'Thomas', lastname: 'Garnier' } };
  mockTelecharger.mockClear();
  mockGenererRecu.mockClear();
});
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
  return JSON.stringify(arbre.toJSON()).replace(/\s/g, ' ');
};
const texteDe = (/** @type {any} */ n) => [].concat(n.props.children).flat(9).join('').replace(/\s/g, ' ');
const textes = () => arbre.root.findAll((/** @type {any} */ n) => n.type === 'Text').map(texteDe);

describe('PAIEMENTS-10E — la place du tournoi dans « Mes paiements » (planche 10e)', () => {
  test('1. le résumé du haut dit « 1 place de tournoi », sans mots de cotisation', () => {
    monter([PLACE]);
    expect(textes()).toContain('1 place de tournoi');
    expect(textes().join(' | ')).not.toMatch(/cotisation|saison 2026/);
  });

  test('1 bis. place + cotisation : la place ne compte ni dans les clubs ni dans la saison', () => {
    expect(describeTotalsLine([PLACE, COTISATION])).toBe('1 cotisation · 1 place de tournoi · 1 club · saison 2026-2027');
  });

  test('2. le titre est le nom du tournoi', () => {
    const rendu = monter([PLACE]);
    expect(textes()).toContain('Tournoi FoundClub x AR Soccer');
    expect(rendu).not.toContain('Inscription - ');
  });

  test('3. la ligne sous le titre : « Place de Thomas Garnier · équipe Les Panthères »', () => {
    monter([PLACE]);
    expect(textes()).toContain('Place de Thomas Garnier · équipe Les Panthères');
  });

  test('3 bis. sans équipe connue : « Place de Thomas Garnier », jamais « équipe » à vide', () => {
    mockEvenement = { data: undefined };
    monter([PLACE]);
    expect(textes()).toContain('Place de Thomas Garnier');
    expect(textes().join(' | ')).not.toMatch(/équipe\s*($|\|)/);
  });

  test('4. l’état en bleu : pastille, montant et barre, plus de vert', () => {
    monter([PLACE]);
    expect(getMemberStatusTone(Colors, 'paid')).toBe(Colors.primary500);
    const barre = arbre.root.findAll((/** @type {any} */ n) => n.props?.accessibilityRole === 'progressbar' && typeof n.type === 'string')[0];
    const remplissage = barre.props.children;
    expect([].concat(remplissage.props.style).flat(9).map((s) => s?.backgroundColor).filter(Boolean)).toEqual([Colors.primary500]);
    expect(JSON.stringify(arbre.toJSON())).not.toContain(Colors.success500);
    // « Payé le 24/11/2026 » de la planche : le jour du paiement, plus « soldée » (mot des cotisations).
    expect(textes()).toContain('payée le 24 novembre 2026');
    expect(textes()).not.toContain('soldée');
  });

  test('5. « Voir le reçu » est sur la carte et télécharge le reçu de la place', async () => {
    monter([PLACE]);
    const lien = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'my-licenses-place-receipt' && n.props?.onPress)[0];
    expect(lien).toBeTruthy();
    expect(textes()).toContain('Voir le reçu');
    await act(async () => { await lien.props.onPress(); });
    expect(mockTelecharger).toHaveBeenCalledTimes(1);
    expect(mockTelecharger.mock.calls[0][0].url).toContain('/uploads/recu-place.pdf');
  });

  test('5 bis. reçu sans fichier : il est fabriqué, puis téléchargé (même geste que le détail)', async () => {
    monter([{ ...PLACE, payments: [{ ...PLACE.payments[0], receipt: { receiptNumber: 'FC-2026-1' } }] }]);
    const lien = arbre.root.findAll((/** @type {any} */ n) => n.props?.testID === 'my-licenses-place-receipt' && n.props?.onPress)[0];
    await act(async () => { await lien.props.onPress(); });
    expect(mockGenererRecu).toHaveBeenCalledWith('pay-1');
    expect(mockTelecharger.mock.calls[0][0].url).toContain('/uploads/recu-neuf.pdf');
  });

  test('5 ter. place pas encore payée : pas de « Voir le reçu »', () => {
    monter([{
      ...PLACE, amountPaidCents: 0, amountRemainingCents: 2000, payments: [], status: 'pending',
    }]);
    expect(textes()).not.toContain('Voir le reçu');
  });
});

describe('PAIEMENTS-10E — « En attente » / « À payer » en ambre (chef 20/11, question 3 B)', () => {
  test('le jeton ambre de l’accueil (« 1 place à payer », warning400) ; « Payée » reste bleu', () => {
    expect(getMemberStatusTone(Colors, 'pending')).toBe(Colors.warning400);
    expect(getMemberStatusTone(Colors, 'partial')).toBe(Colors.warning400);
    expect(getMemberStatusTone(Colors, 'paid')).toBe(Colors.primary500);
  });

  test('une place à payer : la pastille « EN ATTENTE » est écrite en ambre', () => {
    monter([{
      ...PLACE, amountPaidCents: 0, amountRemainingCents: 2000, payments: [], status: 'pending',
    }]);
    const mot = arbre.root.findAll((/** @type {any} */ n) => n.type === 'Text' && texteDe(n) === 'EN ATTENTE')[0];
    // La couleur qui s'applique : la dernière du tableau de styles.
    const couleurs = [].concat(mot.props.style).flat(9).map((s) => s?.color).filter(Boolean);
    expect(couleurs[couleurs.length - 1]).toBe(Colors.warning400);
  });
});

describe('PAIEMENTS-10E — la vue d’un parent (lecture seule, FIN-PARENT)', () => {
  test('la place payée de l’enfant : « Place de Léo Garnier », mais pas de « Voir le reçu » (la carte ne s’ouvre pas)', () => {
    mockCompte = { accountRoleKey: 'parent', userData: { documentId: 'u-parent', firstname: 'Paul', lastname: 'Garnier' } };
    monter([PLACE]);
    expect(textes()).toContain('Place de Léo Garnier');
    expect(textes()).not.toContain('Voir le reçu');
  });
});

describe('PAIEMENTS-10E — caractérisant : une cotisation de club ne change pas', () => {
  test('titre, sous-titre « club · équipe », « soldée », résumé « 1 cotisation · 1 club · saison … », pas de lien de reçu', () => {
    monter([COTISATION]);
    expect(textes()).toEqual(expect.arrayContaining([
      'Cotisation 2026-2027',
      'Foot Rauze Montpellier · Seniors A',
      'soldée',
      '1 cotisation · 1 club · saison 2026-2027',
    ]));
    expect(textes()).not.toContain('Voir le reçu');
  });
});
