import renderer, { act } from 'react-test-renderer';

import AdminDashboard from '../AdminDashboard';

/**
 * CA — LA TUILE « CHIFFRE D AFFAIRES » DE L ACCUEIL SUPERADMIN.
 *
 * LE SYMPTOME : elle affiche « 0 EUR », et elle l afficherait pour toujours.
 * Le serveur additionnait `legacySubscriptionValue`, un champ herite d un ancien
 * systeme : mesure en production le 2026-09-08, il vaut 0 sur les 8 abonnements.
 *
 * LA REPARATION EST COTE SERVEUR (admin-dashboard.ts) : la tuile recoit desormais
 * le MRR calcule depuis les prix du catalogue. Ce temoin garde le COTE ECRAN, et
 * il garde trois choses precises :
 *
 * 1. 🧭 LE NOMBRE DIT CE QU IL EST. « CA génère » suivi de « 20,83 EUR » laisse
 *    croire a un cumul encaisse. C est un revenu PAR MOIS. Un indicateur qui ne
 *    dit pas sa nature est la raison pour laquelle personne n a vu que l ancien
 *    etait mort : « 0 » pouvait vouloir dire « aucun client » comme « je ne sais
 *    pas compter ».
 *
 * 2. 💶 LE FORMATAGE VIENT DU DEPOT, PAS DE CET ECRAN. `formatSubscriptionPriceLabel`
 *    existe deja dans subscriptionBilling.js et sert les ecrans de vente. Un
 *    formatage d argent recopie une troisieme fois finirait par diverger d un
 *    centime — et c est de l argent.
 *
 * 3. 🧪 LE BAC A SABLE RESTE VISIBLE. Le serveur le compte a part plutot que de
 *    l effacer : un chiffre retire sans le dire devient un deuxieme mensonge.
 *
 * ⚠️ CE QUE CE TEMOIN NE MESURE PAS : il ne calcule aucun montant. Le calcul est
 * garde cote serveur par tests/authz/CA-compteur-chiffre-affaires.test.js.
 * Ici on verifie seulement ce qui s AFFICHE.
 */

/** @type {any} */
let mockStats;

const mockRequeteVide = {
  data: undefined, error: null, isError: false, isLoading: false,
};
const mockMutationVide = { isPending: false, mutate: jest.fn(), mutateAsync: jest.fn() };

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
  useNavigation: () => ({ navigate: jest.fn() }),
}));

jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: undefined, error: null, isError: false, isLoading: false,
  }),
}));

jest.mock('@/services/admin/adminQueries', () => ({
  useCreateManualSubscription: () => mockMutationVide,
  useGenerateTestTournament: () => mockMutationVide,
  useGetAdminStats: () => ({ ...mockRequeteVide, data: mockStats }),
  useGetDetectionVerificationQueue: () => mockRequeteVide,
  useGetLeagueDisputes: () => mockRequeteVide,
  useGetNonPartnerCoachAffiliations: () => mockRequeteVide,
  useGetPendingClubClaims: () => mockRequeteVide,
  useGetPendingClubOnboardingRequests: () => mockRequeteVide,
  useGetSubscriptionOps: () => mockRequeteVide,
  useMigrateLegacySubscriptions: () => mockMutationVide,
  useSaveManualEntitlement: () => mockMutationVide,
  useSyncSubscriptionTeamEntitlements: () => mockMutationVide,
  useUpdateDetectionVerification: () => mockMutationVide,
  useUpdateNonPartnerCoachAffiliation: () => mockMutationVide,
  useUpdateNonPartnerCoachGovernance: () => mockMutationVide,
}));

jest.mock('@/services/event/eventService', () => ({
  getPendingFeaturedRequests: jest.fn(() => Promise.resolve([])),
}));

jest.mock('@/services/inAppPopupCampaign/inAppPopupCampaignQueries', () => ({
  useGetInAppPopupCampaigns: () => mockRequeteVide,
}));

jest.mock('@/utils/errors/displayError', () => ({
  getErrorMessage: () => 'erreur',
}));

// Le VRAI theme, jamais un Proxy : un Proxy rend les echecs Jest illisibles.
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
      Spaces: espaces,
    }),
  };
});

jest.mock(
  '@/components/templates/ScreenContainer',
  () => function ScreenContainerMock({ children }) {
    return children;
  },
);

jest.mock(
  '@/views/admin/components/AdminStateView',
  () => function AdminStateViewMock() {
    return null;
  },
);

/**
 * 🧨 UN ARBRE JAMAIS DEMONTE FAIT ROUGIR LA CI SANS QU AUCUN TEMOIN NE SOIT ROUGE.
 *
 * Le `clearInterval` d un ecran vit dans le retour de son `useEffect` : il ne
 * tourne QU AU DEMONTAGE. Un arbre laisse en vie garde donc son minuteur, qui se
 * reveille dans un environnement Jest deja demoli et jette « You are trying to
 * import a file after the Jest environment has been torn down ». C est CETTE
 * exception qui fait le code de sortie 1, pas l attente.
 *
 * 🪤 On garde une LISTE, pas une variable : un test qui monte DEUX fois ecraserait
 * la variable et le premier arbre ne serait jamais demonte.
 * @type {any[]}
 */
const arbresMontes = [];

afterEach(() => {
  while (arbresMontes.length) {
    const arbre = arbresMontes.pop();
    act(() => { arbre.unmount(); });
  }
});

/**
 * Monte l ecran et rend son arbre.
 * @returns {any} L arbre rendu.
 */
const monter = () => {
  /** @type {any} */
  let arbre;
  act(() => {
    arbre = renderer.create(<AdminDashboard />);
  });
  arbresMontes.push(arbre);
  return arbre;
};

/**
 * Tous les libelles d accessibilite de l arbre. Les tuiles portent
 * `accessibilityLabel={`${title}: ${value}`}` — c est l ancre la plus stable.
 * @param {any} arbre - L arbre rendu.
 * @returns {string[]} Les libelles.
 */
const libellesDe = (arbre) => arbre.root
  .findAll((noeud) => typeof noeud.props?.accessibilityLabel === 'string', { deep: true })
  .map((noeud) => String(noeud.props.accessibilityLabel));

/**
 * Le libelle de la tuile d argent, quel que soit son intitule exact.
 * @param {any} arbre - L arbre rendu.
 * @returns {string} Le libelle trouve, ou '' .
 */
const tuileArgentDe = (arbre) => libellesDe(arbre)
  .find((libelle) => libelle.startsWith('CA ')) || '';

/**
 * Tout le texte reellement affiche. La pastille d une tuile (`meta`) n entre PAS
 * dans son libelle d accessibilite : elle se lit ici.
 * @param {any} arbre - L arbre rendu.
 * @returns {string} Le texte, aplati.
 */
const texteDe = (arbre) => {
  const morceaux = [];
  const parcourir = (noeud) => {
    if (noeud == null) return;
    if (typeof noeud === 'string' || typeof noeud === 'number') {
      morceaux.push(String(noeud));
      return;
    }
    if (Array.isArray(noeud)) {
      noeud.forEach(parcourir);
      return;
    }
    parcourir(noeud.children);
  };
  parcourir(arbre.toJSON());
  return morceaux.join(' ');
};

beforeEach(() => {
  mockStats = {
    eventsToday: 0,
    payingSubscriptionCount: 1,
    reportsCount: 0,
    revenue: 20.83,
    revenueEurCents: 2083,
    revenueKind: 'mrr',
    sandboxSubscriptionCount: 2,
    trialSubscriptionCount: 3,
  };
});

test('CA-ECRAN/1 — l ecran se monte et porte bien une tuile d argent', () => {
  const arbre = monter();

  expect(tuileArgentDe(arbre)).not.toBe('');
});

test('CA-ECRAN/2 — le montant est ecrit a la francaise et dit qu il est MENSUEL', () => {
  const arbre = monter();

  // 2 083 centimes = 20,83 EUR par mois. Le « /mois » est la partie qui compte :
  // sans lui, Adel lit un cumul encaisse qui n existe pas.
  expect(tuileArgentDe(arbre)).toContain('20,83 €/mois');
});

test('CA-ECRAN/3 — la tuile ne dit plus « génère », qui laissait croire a un cumul', () => {
  const arbre = monter();

  expect(tuileArgentDe(arbre)).not.toContain('génère');
});

test('CA-ECRAN/4 — la tuile montre combien paient et combien sont en essai', () => {
  const arbre = monter();
  const texte = texteDe(arbre);

  expect(texte).toContain('1 payant');
  expect(texte).toContain('3 essais');
});

test('CA-ECRAN/5 — un serveur qui ne sait pas compter le DIT, au lieu de zero', () => {
  mockStats = {
    ...mockStats, revenue: 0, revenueEurCents: 0, revenueKind: 'indisponible',
  };

  const arbre = monter();

  // Un « 0,00 EUR » et un « je ne sais pas » ne doivent JAMAIS se ressembler :
  // c est exactement la confusion qui a laisse l ancien compteur mentir des mois.
  expect(tuileArgentDe(arbre)).toContain('indisponible');
});

test('CA-ECRAN/6 — un serveur qui ne renvoie que l ancien champ reste lisible', () => {
  mockStats = {
    eventsToday: 0,
    reportsCount: 0,
    revenue: 41.66,
  };

  const arbre = monter();

  // Filet pour la fenetre ou une app neuve parle a un serveur pas encore deploye :
  // on retombe sur `revenue` en euros plutot que d afficher un vide.
  expect(tuileArgentDe(arbre)).toContain('41,66 €/mois');
});
