import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ScrollView, StyleSheet, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import AdminRevenue from '../AdminRevenue';

// DEFILEMENT (11/11/2026) — TÉMOIN CARACTÉRISANT du pilotage des abonnements de la console
// SuperAdmin (règle E6 : aucun test ne montait cet écran). Il fige le comportement ACTUEL :
// l écran monte avec quelques montants, le titre, le MRR et un abonné s affichent, le
// défilement principal est rendu DANS le cadre. Le test « bas actuel » relève la marge du bas
// telle qu elle est aujourd hui ; une autre session la changera et mettra ce test à jour.

jest.setTimeout(30000);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {any[]} */ ...args) => jest.requireActual('i18next').t(...args),
  }),
}));

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

// Le tableau de bord : 49,90 € de MRR, 3 payants, 1 essai, 4 actifs, un claim, un club legacy.
jest.mock('@/services/admin/adminQueries', () => ({
  useGetSubscriptionOps: () => ({
    data: {
      counts: {
        entitlements: 7,
        failedBillingEvents: 1,
        legacyCandidateClubs: 1,
        pendingClaimReviews: 1,
        quotas: 2,
        subscriptions: 4,
      },
      monetization: {
        activeSubscriptionCount: 4,
        mrrEurCents: 4990,
        payingSubscriptionCount: 3,
        trialSubscriptionCount: 1,
      },
      previews: {
        claimRequests: [{ club: { name: 'AS Montrivage' }, documentId: 'claim-1' }],
        legacyCandidates: [{ documentId: 'legacy-1', name: 'BC Lyon', subscriptionValue: 120 }],
      },
    },
    error: null,
    isLoading: false,
    refetch: jest.fn(),
  }),
}));

// Les deux listes paginées (abonnés, billing events) passent par le vrai react-query.
jest.mock('@/services/admin/adminService', () => ({
  getSubscriptionOpsBillingEvents: () => Promise.resolve({
    data: [{
      documentId: 'be-1', eventType: 'invoice.paid', processingStatus: 'processed', provider: 'web',
    }],
    meta: { pagination: { pageCount: 1, total: 1 } },
  }),
  getSubscriptionOpsSubscriptions: () => Promise.resolve({
    data: [{
      billingPeriod: 'monthly',
      documentId: 'sub-1',
      payerUser: { firstname: 'Ana', lastname: 'Banc' },
      planCode: 'club_pro',
      provider: 'web',
      status: 'active',
    }],
    meta: { pagination: { pageCount: 1, total: 1 } },
  }),
  retrySubscriptionOpsBillingEvent: jest.fn(),
  runSubscriptionOpsReconcile: jest.fn(),
  updateSubscriptionOpsStatus: jest.fn(),
}));

/** @type {any[]} */
const mockCadres = [];
jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock(/** @type {any} */ props) {
    mockCadres.push(props);
    return props.children;
  },
);
// La place de la barre du téléphone (34) + la marge du cadre (12), comme sur un iPhone.
// L écran ne l importe pas encore : la doublure est posée pour la session qui l y branchera.
jest.mock('@/components/templates/useRetraitBasDuDefilement', () => ({
  __esModule: true,
  default: () => 46,
}));

/**
 * Aplatit les enfants React en une chaîne.
 * @param {any} enfants
 * @returns {string}
 */
const aplatir = (enfants) => {
  if (Array.isArray(enfants)) return enfants.map(aplatir).join('');
  if (enfants === null || enfants === undefined || typeof enfants === 'boolean') return '';
  if (typeof enfants === 'object') return aplatir(enfants?.props?.children);
  return String(enfants);
};
const textes = (/** @type {any} */ noeud) => noeud.findAllByType(Text)
  .map((/** @type {any} */ n) => aplatir(n.props.children).trim());

// Le défilement principal : le seul ScrollView vertical de l écran (les modales sont fermées).
const defilementPrincipal = (/** @type {any} */ arbre) => {
  const verticaux = arbre.root.findAllByType(ScrollView)
    .filter((/** @type {any} */ n) => !n.props.horizontal);
  expect(verticaux).toHaveLength(1);
  return verticaux[0];
};

/** @type {any[]} */
const arbresMontes = [];
const rendre = async () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { gcTime: 0, retry: false } },
  });
  /** @type {any} */
  let arbre;
  await act(async () => {
    arbre = renderer.create(
      <QueryClientProvider client={client}>
        <AdminRevenue />
      </QueryClientProvider>,
    );
  });
  // Laisse les deux requêtes paginées se résoudre : on attend que « club_pro » et
  // « invoice.paid » soient à l écran (au plus 50 tours de 10 ms).
  const pret = () => {
    const vus = textes(arbre.root);
    return vus.includes('club_pro') && vus.includes('invoice.paid');
  };
  for (let tour = 0; tour < 50 && !pret(); tour += 1) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { await new Promise((fini) => { setTimeout(fini, 10); }); });
  }
  arbresMontes.push(arbre);
  return arbre;
};

beforeEach(() => {
  mockCadres.length = 0;
});
afterEach(() => {
  act(() => { arbresMontes.splice(0).forEach((arbre) => arbre.unmount()); });
});

describe('DEFILEMENT — pilotage abonnements SuperAdmin, comportement actuel', () => {
  it('monte avec des montants : titre, MRR, abonné et club legacy affichés', async () => {
    const vus = textes((await rendre()).root);
    expect(vus).toEqual(expect.arrayContaining([
      'Pilotage abonnements',
      '49,90 € MRR',
      'club_pro',
      'Ana Banc',
      'invoice.paid',
      'AS Montrivage',
      'BC Lyon',
    ]));
  });

  it('titre et sections DANS le défilement principal, lui-même dans le cadre', async () => {
    const arbre = await rendre();
    expect(mockCadres.length).toBeGreaterThan(0);
    const dedans = textes(defilementPrincipal(arbre));
    expect(dedans).toEqual(expect.arrayContaining([
      'Pilotage abonnements',
      '49,90 € MRR',
      'club_pro',
      'BC Lyon',
    ]));
  });

  // DEFILEMENT-LOT1 (11/11) : avant, « tab-scene » et 40 (la place d une barre absente).
  it('bas : cadre en « scroll-edge », fin du défilement à 40 + le retrait commun', async () => {
    const liste = defilementPrincipal(await rendre());
    expect(mockCadres.at(-1).bottomInsetMode).toBe('scroll-edge');
    expect(StyleSheet.flatten(liste.props.contentContainerStyle).paddingBottom).toBe(40 + 46);
  });
});
