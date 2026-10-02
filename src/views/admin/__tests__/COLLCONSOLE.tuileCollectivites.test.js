/* eslint-disable max-len -- les phrases de l’écran sont citées en entier */
import renderer, { act } from 'react-test-renderer';

import {
  collectiviteInitial,
  countAdminCollectivitesByFilter,
  filterAdminCollectivites,
  readClubOfferStates,
  splitAdminInvitations,
  summarizeAdminCollectivites,
} from '@/domains/collectivite/collectiviteConsole';

import AdminDashboard from '../AdminDashboard';

// 🏛️ COLL-CONSOLE (02/10) — PLANCHE 1 : la tuile « Collectivités » du dashboard admin
// (design HY521H1, page 2, « P2-console-tel » et « P2-console-ordi »).
//
// Ce que ce témoin fige (ROUGE avant le lot : la tuile disait « Mairies », un mot à la
// place d'un nombre, et la console ne savait rien compter) :
//   T1 — la tuile porte ses chiffres : « 1 » et « 1 active · 3 clubs couverts » ;
//   T2 — une mairie INACTIVE qui a déjà des clubs passe la tuile en ORANGE :
//        « 1 à activer · 3 clubs attendent » ;
//   T3 — aucune : « 0 » et « Aucune mairie pour l'instant » ;
//   T4 — la tuile attend SEULE (« … ») : le reste du dashboard est là ;
//   T5 — sa lecture échoue : « — », jamais 0, et la ligne grise du dashboard le dit ;
//   D1-D5 — les calculs sans écran (domains/collectivite/collectiviteConsole.js).
// Le dictionnaire est le VRAI fr.js (même double qu'AdminDashboard.tuileChiffreAffaires).

jest.mock('i18next', () => {
  const catalogue = jest.requireActual('@/theme/strings/translations/fr').default;
  const t = (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
    const opts = typeof repli === 'object' && repli !== null ? repli : (options || {});
    let pluriel = '';
    if (typeof opts.count === 'number') pluriel = opts.count <= 1 ? '_one' : '_other';
    const valeur = `${cle}${pluriel}`.split('.').reduce(
      (/** @type {any} */ noeud, segment) => (noeud == null ? undefined : noeud[segment]),
      catalogue,
    );
    const defaut = typeof repli === 'string' ? repli : opts[`defaultValue${pluriel}`];
    const gabarit = typeof valeur === 'string' ? valeur : String(defaut);
    return gabarit.replace(/\{\{(\w+)\}\}/g, (_tout, nom) => String(opts[nom] ?? ''));
  };
  return { __esModule: true, default: { language: 'fr', t } };
});
jest.mock('react-i18next', () => {
  const i18next = jest.requireMock('i18next').default;
  return { useTranslation: () => ({ t: i18next.t }) };
});

const mockRequeteVide = {
  data: undefined, error: null, isError: false, isLoading: false,
};
const mockMutationVide = { isPending: false, mutate: jest.fn(), mutateAsync: jest.fn() };
/** @type {any} */
let mockCollectivites;

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: () => {},
  useNavigation: () => ({ navigate: jest.fn() }),
}));
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: undefined, error: null, isError: false, isLoading: false,
  }),
}));
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useAdminCollectivites: () => mockCollectivites,
}));
jest.mock('@/services/admin/adminQueries', () => ({
  useCreateManualSubscription: () => mockMutationVide,
  useGenerateTestTournament: () => mockMutationVide,
  useGetAdminStats: () => ({ ...mockRequeteVide, data: { eventsToday: 0, reportsCount: 0, revenue: 0 } }),
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
jest.mock('@/utils/errors/displayError', () => ({ getErrorMessage: () => 'erreur' }));
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
  () => function ScreenContainerMock({ children }) { return children; },
);
jest.mock('@/views/admin/components/AdminStateView', () => function AdminStateViewMock() { return null; });

const COULEURS = jest.requireActual('@/theme/colors').default();

/** @type {any[]} */
const arbresMontes = [];
afterEach(() => {
  while (arbresMontes.length) {
    const arbre = arbresMontes.pop();
    act(() => { arbre.unmount(); });
  }
});

const monter = () => {
  /** @type {any} */
  let arbre;
  act(() => { arbre = renderer.create(<AdminDashboard />); });
  arbresMontes.push(arbre);
  return arbre;
};

/**
 * Le texte affiche sous un noeud, aplati.
 * @param {any} noeud - Le noeud de l arbre de test.
 * @returns {string} Le texte.
 */
const texteSous = (noeud) => {
  const morceaux = [];
  const parcourir = (/** @type {any} */ n) => {
    if (n == null) return;
    if (typeof n === 'string' || typeof n === 'number') { morceaux.push(String(n)); return; }
    if (Array.isArray(n)) { n.forEach(parcourir); return; }
    parcourir(n.children);
  };
  parcourir(noeud);
  return morceaux.join(' ');
};

// La tuile la plus EXTERIEURE (DashboardCard) : elle porte la valeur, la couleur et l attente.
const tuileDe = (/** @type {any} */ arbre) => arbre.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === 'admin-tuile-collectivites' && typeof n.type !== 'string',
)[0];
const texteTuile = (/** @type {any} */ arbre) => {
  const json = arbre.toJSON();
  const trouver = (/** @type {any} */ n) => {
    if (!n || typeof n !== 'object') return null;
    if (Array.isArray(n)) return n.map(trouver).find(Boolean) || null;
    if (n.props?.testID === 'admin-tuile-collectivites') return n;
    return trouver(n.children);
  };
  return texteSous(trouver(json));
};

const ligne = (name, isActive, clubs) => ({
  clubs: Array.from({ length: clubs }, (_x, i) => ({ documentId: `${name}-club-${i}` })),
  documentId: `id-${name}`,
  isActive,
  name,
  type: 'commune',
});
const reponse = (lignes) => ({
  ...mockRequeteVide,
  data: { data: lignes, meta: { pagination: { total: lignes.length } } },
});

beforeEach(() => {
  mockCollectivites = reponse([ligne('Ville de Montrivage', true, 3)]);
});

test('T1 — la tuile porte ses chiffres : « 1 », « 1 active · 3 clubs couverts »', () => {
  const arbre = monter();
  const texte = texteTuile(arbre);
  expect(texte).toContain('Collectivités');
  expect(texte).toContain('1');
  expect(texte).toContain('1 active · 3 clubs couverts');
  expect(texte).not.toContain('Mairies');
  expect(tuileDe(arbre).props.accessibilityLabel).toBe('Collectivités : 1, 1 active · 3 clubs couverts');
});

test('T2 — une mairie INACTIVE qui a des clubs : orange, « 1 à activer · 3 clubs attendent »', () => {
  mockCollectivites = reponse([ligne('Ville de Montrivage', null, 3), ligne('Ville vide', false, 0)]);
  const arbre = monter();
  expect(texteTuile(arbre)).toContain('1 à activer · 3 clubs attendent');
  expect(tuileDe(arbre).props.color).toBe(COULEURS.warning500);
  expect(tuileDe(arbre).props.value).toBe('2');
});

test('T3 — aucune mairie : « 0 », « Aucune mairie pour l’instant »', () => {
  mockCollectivites = reponse([]);
  const arbre = monter();
  expect(tuileDe(arbre).props.value).toBe('0');
  expect(texteTuile(arbre)).toContain('Aucune mairie pour l’instant');
});

test('T4 — la tuile attend SEULE : « … » ; le reste du dashboard est déjà là', () => {
  mockCollectivites = { ...mockRequeteVide, isLoading: true };
  const arbre = monter();
  expect(tuileDe(arbre).props.value).toBe('…');
  expect(tuileDe(arbre).props.busy).toBe(true);
  expect(texteSous(arbre.toJSON())).toContain('Pilotage general');
});

test('T5 — la lecture échoue : « — », jamais 0 ; la ligne grise du dashboard le dit', () => {
  mockCollectivites = { ...mockRequeteVide, error: new Error('panne'), isError: true };
  const arbre = monter();
  expect(tuileDe(arbre).props.value).toBe('—');
  expect(texteTuile(arbre)).toContain('Nombre indisponible');
  expect(texteSous(arbre.toJSON())).toContain('Certaines tuiles admin sont temporairement indisponibles.');
});

test('D1 — les nombres : actives et clubs couverts ; inactives AVEC clubs et clubs qui attendent', () => {
  const lignes = [
    { clubsCount: 3, isActive: true },
    { clubsCount: 2, isActive: false },
    { clubsCount: 0, isActive: false },
    { clubsCount: 4, isActive: true },
  ];
  expect(summarizeAdminCollectivites(lignes)).toEqual({
    actives: 2, clubsCovered: 7, clubsWaiting: 2, toActivate: 1, total: 4,
  });
  expect(summarizeAdminCollectivites(null)).toEqual({
    actives: 0, clubsCovered: 0, clubsWaiting: 0, toActivate: 0, total: 0,
  });
});

test('D2 — filtrer : par état, et par nom sans casse ni accent', () => {
  const lignes = [
    { isActive: true, name: 'Ville de Montrivage' },
    { isActive: false, name: 'Département du Var' },
    { isActive: null, name: 'Ville d’Évry' },
  ];
  expect(filterAdminCollectivites(lignes, { filter: 'inactive' }).map((l) => l.name))
    .toEqual(['Département du Var', 'Ville d’Évry']);
  expect(filterAdminCollectivites(lignes, { query: 'EVRY' }).map((l) => l.name)).toEqual(['Ville d’Évry']);
  expect(filterAdminCollectivites(lignes, { filter: 'active', query: 'var' })).toEqual([]);
  expect(countAdminCollectivitesByFilter(lignes)).toEqual({ active: 1, all: 3, inactive: 2 });
});

test('D3 — l écusson : la lettre du nom propre', () => {
  expect(collectiviteInitial('Ville de Montrivage')).toBe('M');
  expect(collectiviteInitial('Ville d’Aix')).toBe('A');
  expect(collectiviteInitial('Département du Var')).toBe('V');
  expect(collectiviteInitial('')).toBe('?');
});

test('D4 — les demandes, rangées comme les onglets ; un rattaché sort des piles en attente', () => {
  const piles = splitAdminInvitations([
    { documentId: 'r1', kind: 'attach_request', status: 'registered' },
    { documentId: 'r2', kind: 'attach_request', status: 'attached' },
    { documentId: 'f1', kind: 'foundclub', status: 'sent' },
    { documentId: 'f2', kind: 'foundclub', status: 'registered' },
    { documentId: 'f3', kind: 'foundclub', status: 'attached' },
  ]);
  expect(piles.attachRequests.map((d) => d.documentId)).toEqual(['r1']);
  expect(piles.foundclub.map((d) => d.documentId)).toEqual(['f1', 'f2']);
  expect(piles.done.map((d) => d.documentId)).toEqual(['r2', 'f3']);
});

test('D5 — l état de l offre club par club, lu dans l APERÇU du serveur ; sans aperçu, rien', () => {
  const etats = readClubOfferStates({
    data: {
      clubs: [
        { clubDocumentId: 'a', offer: 'granted' },
        { clubDocumentId: 'b', offer: 'already-paid' },
        { clubDocumentId: 'c', offer: 'revoked' },
        { clubDocumentId: 'd', offer: 'none' },
        { clubDocumentId: 'e', offer: 'inconnu' },
      ],
      preview: true,
    },
  });
  expect(Object.fromEntries(etats)).toEqual({
    a: 'atActivation', b: 'paysItself', c: 'offered', d: 'paysItself',
  });
  expect(readClubOfferStates({ data: { clubs: [{ clubDocumentId: 'a', offer: 'granted' }] } }).size).toBe(0);
  expect(readClubOfferStates(null).size).toBe(0);
});
