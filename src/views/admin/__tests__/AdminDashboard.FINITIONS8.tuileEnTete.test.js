/* eslint-disable max-len -- les phrases de l’écran sont citées en entier */
import renderer, { act } from 'react-test-renderer';

import AdminDashboard from '../AdminDashboard';

// FINITIONS8 · POINT 8 (tournee 9) — LA TUILE « COLLECTIVITES » EST ENFOUIE.
//
// Capture et notes : .recette/tournee9/T9_C12_0_superadmin_accueil_a_traiter.png, _notes.md
// (« 3 × 6 défilements dans « Dashboard complet » (abonnements, quotas, clubs legacy…) sans la
// trouver »). Elle etait la 12e de la grille « Pilotage general », sous deux blocs a boutons
// reels (« Gouvernance », « Outils de test »). La porte de la console des collectivites ne doit
// pas se chercher : elle passe EN TETE de l ecran, et rien n est retire.
// Banc : les doublures de COLLCONSOLE.tuileCollectivites.test.js (fabrique).

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
// OFFRIR-ABONNEMENT (07/10) : la liste des abonnements offerts a son propre temoin
// (OffresFoundclubListe.test.js) ; ici elle est doublee comme les autres sous-composants.
jest.mock(
  '@/views/admin/components/OffresFoundclubListe',
  () => function OffresFoundclubListeMock() {
    return null;
  },
);

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

// Les tuiles de « Pilotage general » : aucune ne doit disparaitre.
const TUILES_DU_PILOTAGE = [
  'CA par mois', 'Événements du jour', 'Signalements', 'Demandes à la une', 'Revendications',
  'Clubs à onboarder', 'Campagnes pop-up', 'Litiges League', 'Notifications', 'Utilisateurs',
  'Clubs', 'Explorer CM',
];

/**
 * Les tuiles rendues (DashboardCard), dans l ordre de l ecran : leur titre.
 * @param {any} arbre - L arbre rendu.
 * @returns {string[]} Les titres.
 */
const titresDesTuiles = (arbre) => arbre.root.findAll(
  (/** @type {any} */ n) => typeof n.type === 'function' && n.type.name === 'DashboardCard',
).map((/** @type {any} */ n) => n.props.title);

test('🚨 la tuile « Collectivités » est la PREMIERE de l ecran, avant « Gouvernance »', () => {
  const arbre = monter();
  const texte = texteSous(arbre.toJSON());

  expect(titresDesTuiles(arbre)[0]).toBe('Collectivités');
  expect(texte.indexOf('Collectivités')).toBeGreaterThan(-1);
  expect(texte.indexOf('Collectivités')).toBeLessThan(texte.indexOf('Gouvernance'));
  expect(texte.indexOf('Collectivités')).toBeLessThan(texte.indexOf('Pilotage général'));
});

test('rien n est retire : les 12 autres tuiles du pilotage restent, et « Collectivités » n est pas en double', () => {
  const titres = titresDesTuiles(monter());

  TUILES_DU_PILOTAGE.forEach((titre) => expect(titres).toContain(titre));
  expect(titres.filter((titre) => titre === 'Collectivités')).toHaveLength(1);
});

test('jumeau : la tuile porte toujours ses chiffres (COLL-CONSOLE T1)', () => {
  const texte = texteSous(monter().toJSON());

  expect(texte).toContain('1 active · 3 clubs couverts');
});
