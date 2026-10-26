import renderer, { act } from 'react-test-renderer';

import AdminDashboard from '../AdminDashboard';

// I18N-3 : l ecran lit ses textes par t() (composant) et i18next.t (fonctions de module).
// Les doubles lisent le vrai fr.js, puis le repli, remplissent les {{jetons}} et
// choisissent _one / _other comme la regle francaise d i18next (0 et 1 au singulier) :
// le temoin affirme toujours le texte francais affiche (« 1 payant », « 3 essais »).
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
/**
 * C10 / P9-05 — « Migration legacy » du tableau de bord SuperAdmin.
 *
 * LE SYMPTOME : « Apply » partait en un appui, sans confirmation, et sur TOUS les
 * clubs si le champ « club » etait laisse vide (migration reelle des abonnements).
 * LE CONTRAT : « Apply » demande d abord une confirmation qui dit la portee (un club
 * nomme, ou TOUS les clubs) ; la migration ne part qu apres « Appliquer ».
 * « Dry-run » (lecture seule) reste en un appui.
 */

const mockMigration = { isPending: false, mutate: jest.fn(), mutateAsync: jest.fn() };

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
  useMigrateLegacySubscriptions: () => mockMigration,
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

// COLL-CONSOLE (02/10) — la tuile « Collectivités » lit la liste des collectivites : doublee ici
// (sans elle, le vrai service charge le client HTTP, qui exige un .env absent des copies).
jest.mock('@/services/collectivite/collectiviteQueries', () => ({
  useAdminCollectivites: () => mockRequeteVide,
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
// OFFRIR-ABONNEMENT (07/10) : la liste des abonnements offerts a son propre temoin
// (OffresFoundclubListe.test.js) ; ici elle est doublee comme les autres sous-composants.
jest.mock(
  '@/views/admin/components/OffresFoundclubListe',
  () => function OffresFoundclubListeMock() {
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
const { Alert } = require('react-native');

/**
 * Le bouton dont un texte descendant vaut exactement `libelle`.
 * @param {any} arbre - L arbre rendu.
 * @param {string} libelle - Le texte du bouton.
 * @returns {any} Le premier noeud pressable trouve.
 */
const boutonDe = (arbre, libelle) => arbre.root.findAll(
  (noeud) => typeof noeud.props?.onPress === 'function'
    && noeud.findAll((enfant) => enfant.children?.includes?.(libelle)).length > 0,
)[0];

/** @type {any} */
let alerte;

beforeEach(() => {
  mockStats = {};
  mockMigration.mutate.mockClear();
  alerte = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

afterEach(() => { alerte.mockRestore(); });

/**
 * Ouvre la fenetre de migration, saisit le club, appuie sur Apply.
 * @param {string} club - Le documentId saisi ('' = aucun).
 * @returns {any} L arbre.
 */
const appliquer = (club) => {
  const arbre = monter();
  act(() => { boutonDe(arbre, 'Migration legacy').props.onPress(); });
  if (club) {
    const champ = arbre.root.findAll((n) => n.props?.placeholder === 'club-document-id')[0];
    act(() => { champ.props.onChangeText(club); });
  }
  act(() => { boutonDe(arbre, 'Apply').props.onPress(); });
  return arbre;
};

test('P9-05/1 — Apply sans club : rien ne part, la confirmation dit « TOUS les clubs »', () => {
  appliquer('');

  expect(mockMigration.mutate).not.toHaveBeenCalled();
  expect(alerte).toHaveBeenCalledTimes(1);
  expect(String(alerte.mock.calls[0][1])).toContain('TOUS les clubs');
});

test('P9-05/2 — Apply avec un club : la confirmation le nomme, puis « Appliquer » migre', () => {
  appliquer('club-abc');

  expect(mockMigration.mutate).not.toHaveBeenCalled();
  expect(String(alerte.mock.calls[0][1])).toContain('club-abc');
  const boutons = alerte.mock.calls[0][2];
  expect(boutons.find((b) => b.style === 'cancel')).toBeTruthy();
  act(() => { boutons.find((b) => b.style === 'destructive').onPress(); });
  expect(mockMigration.mutate).toHaveBeenCalledTimes(1);
  expect(mockMigration.mutate.mock.calls[0][0])
    .toEqual({ apply: true, clubDocumentId: 'club-abc' });
});

test('P9-05/3 — Dry-run part toujours en un appui', () => {
  const arbre = monter();
  act(() => { boutonDe(arbre, 'Migration legacy').props.onPress(); });
  act(() => { boutonDe(arbre, 'Dry-run').props.onPress(); });

  expect(mockMigration.mutate).toHaveBeenCalledTimes(1);
  expect(mockMigration.mutate.mock.calls[0][0].apply).toBe(false);
});
