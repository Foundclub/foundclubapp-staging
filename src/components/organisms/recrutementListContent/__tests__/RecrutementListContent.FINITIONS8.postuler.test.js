import { Alert } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import RecrutementListContent from '../RecrutementListContent';

// FINITIONS8 · POINT 6 (tournee 9) — « POSTULER » RESTE AFFICHE APRES L'ENVOI.
//
// Dans la liste de recrutement, Hugo postule ; la carte dit toujours « Postuler ».
// 🧭 La cause (la meme qu'au point 1) : la carte cherchait « ai-je postule ? » dans l'annonce —
// `applications` (retire par Strapi depuis D10) puis `candidates`, qu'une annonce de la
// RECHERCHE (« Pour moi », filtres) ne porte meme pas. La liste lit pourtant « mes candidatures »
// (GET /me/recruitment-applications), et la relit apres l'envoi : elle ne s'en servait que pour
// les detections. Elle la passe desormais a chaque carte (`ownApplicationStatusByAd`).
// Banc : les doublures de RecrutementListContent.LISTE-ANNONCES.test.js (fabrique), sauf le
// service de recrutement, dont les fonctions d'etat restent les vraies.

jest.setTimeout(30000);

jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ proprietes) => (
      <TexteRN>{`CHAMP:${proprietes.label ?? ''}`}</TexteRN>
    ),
  };
});

jest.mock('@/components/organisms/autocompleteAddressInput/autocompleteAddressInput', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ proprietes) => (
      <TexteRN>{`ADRESSE:${proprietes.label ?? ''}`}</TexteRN>
    ),
  };
});

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (/** @type {any} */ callback) => {
    // eslint-disable-next-line global-require
    const { useEffect } = require('react');
    useEffect(callback, [callback]);
  },
  useNavigation: () => ({ navigate: mockNavigate }),
}));

/**
 * Une doublure de `t` qui INTERPOLE `{{x}}` et connaît les pluriels `_one` / `_other` :
 * sans ça, « {{count}} annonces » resterait un gabarit et aucun chiffre ne se lirait.
 * @param {string} cle La clef.
 * @param {any} repli Le repli (texte) ou les options.
 * @param {any} options Les options, quand le repli est un texte.
 * @returns {string} Le texte rendu.
 */
const mockTraduire = (cle, repli, options) => {
  const valeurs = typeof repli === 'object' && repli !== null ? repli : (options || {});
  let gabarit = typeof repli === 'string' ? repli : cle;
  if (typeof valeurs.count === 'number') {
    gabarit = valeurs.count === 1
      ? (valeurs.defaultValue_one || gabarit)
      : (valeurs.defaultValue_other || gabarit);
  }
  return gabarit.replace(/\{\{(\w+)\}\}/g, (_, nom) => String(valeurs[nom] ?? ''));
};
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (...args) => mockTraduire(...args) }),
}));
jest.mock('i18next', () => ({
  __esModule: true,
  default: { t: (...args) => mockTraduire(...args) },
}));

jest.mock('react-native-reanimated', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    useAnimatedStyle: () => ({}),
    useSharedValue: (/** @type {any} */ value) => ({ value }),
    withTiming: (/** @type {any} */ value) => value,
  };
});

jest.mock('react-native-linear-gradient', () => 'LinearGradient');

jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ {
      children, footerComponent, headerComponent, isVisible,
    }) => (
      isVisible ? (
        <View testID="sheet">
          {headerComponent}
          {children}
          {footerComponent}
        </View>
      ) : null
    ),
  };
});

// Les listes de référence : construites UNE fois au niveau module. Une doublure qui
// rendrait un tableau neuf à chaque appel relancerait les effets qui en dépendent sans fin.
const mockReponseCategories = {
  data: [
    { documentId: 'cat-u15', name: 'U15' },
    { documentId: 'cat-u17', name: 'U17' },
  ],
};
const mockReponseVide = { data: [] };
jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => mockReponseVide,
}));
jest.mock('@/services/category/categoryQueries', () => ({
  useGetCategories: () => mockReponseCategories,
}));
jest.mock('@/services/level/levelQueries', () => ({
  useGetLevels: () => mockReponseVide,
}));
jest.mock('@/services/section/sectionQueries', () => ({
  useGetSections: () => mockReponseVide,
}));

/** @type {any} */
let mockUserData;
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUserData }),
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
      Images: new Proxy({}, { get: () => 1 }),
      Spaces: espaces,
    }),
  };
});

const mockEtatApplicatif = [{ recruitmentAdFilters: {} }, () => {}];
jest.mock('@/store/appContext', () => ({ useAppContext: () => mockEtatApplicatif }));

const mockGetRecruitmentAds = jest.fn();
const mockGetMyApplications = jest.fn();
const mockApply = jest.fn();
// Le client HTTP refuse de se charger sans .env : double, pour que le VRAI service se charge.
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
// FINITIONS8 : les fonctions d'ETAT du service (resolveRecruitmentAdApplicationState,
// buildOwnApplicationStatusMap, buildDetectionApplicationStatusMap) sont les VRAIES ; seules
// les lectures et l'envoi sont doubles.
jest.mock('@/services/recruitment/recruitmentService', () => ({
  ...jest.requireActual('@/services/recruitment/recruitmentService'),
  applyToRecruitmentAd: (/** @type {any[]} */ ...args) => mockApply(...args),
  getMyApplications: (/** @type {any} */ user) => mockGetMyApplications(user),
  getRecruitmentAds: (/** @type {any} */ filters) => mockGetRecruitmentAds(filters),
}));

const mockSearchRecruitment = jest.fn();
jest.mock('@/services/search/searchService', () => ({
  getMatchReasonLabel: () => '',
  mapSearchPayload: (/** @type {any} */ reponse) => (reponse?.data || []).map(
    (/** @type {any} */ entree) => ({ ...entree.payload }),
  ),
  searchRecruitment: (/** @type {any} */ params) => mockSearchRecruitment(params),
}));

jest.mock('@/services/search/searchQueries', () => ({
  useSearchProfiles: () => ({
    data: { pages: [] },
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isError: false,
    isFetching: false,
    isFetchingNextPage: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
}));

jest.mock('@/components/organisms/searchComponent/searchComponent', () => {
  // eslint-disable-next-line global-require
  const { Text, View } = require('react-native');
  return {
    __esModule: true,
    default: () => <View testID="search-bar"><Text>BARRE</Text></View>,
  };
});

jest.mock('@/utils/performance/searchPerformance', () => ({ markSearchPerf: jest.fn() }));
jest.mock('@/navigation/public/publicAuthNavigation', () => ({ openPublicAuthFlow: jest.fn() }));
// La carte « Me prévenir » a son propre témoin (ALERTES-ANNONCES) : doublée NEUTRE ici.
jest.mock('@/domains/searchAlert/useAlerteRecherche', () => ({
  __esModule: true,
  default: () => ({
    creer: jest.fn(), enCours: false, estDejaCreee: () => false, sports: [],
  }),
}));

const JOUEUR_FOOT_U15 = {
  category: 'U15',
  documentId: 'u-foot',
  preferredSport: 'Football',
  role: { name: 'Joueur' },
};

/**
 * Une annonce publique, reconnaissable par le nom de son club.
 * @param {string} cle Son identifiant.
 * @param {string} club Le nom du club, que la carte affiche.
 * @param {string} sport Le sport de l'annonce.
 * @returns {any} L'annonce.
 */
const annonce = (cle, club, sport = 'Football') => ({
  category: { name: 'U15' },
  city: 'Lyon',
  documentId: cle,
  isActive: true,
  sport,
  team: { club: { name: club }, name: `${club} équipe` },
  title: `Annonce ${cle}`,
});

/**
 * Une page de réponse du serveur, avec son total.
 * @param {any[]} annonces Les annonces de la page.
 * @param {{ page?: number, pageCount?: number, total: number }} pagination La pagination.
 * @returns {any} La réponse, à la forme de `getRecruitmentAds`.
 */
const pageRest = (annonces, { page = 1, pageCount = 1, total }) => ({
  data: annonces,
  meta: {
    pagination: {
      page, pageCount, pageSize: 10, total,
    },
  },
});

/**
 * La même page, à la forme de la recherche (`/search/recruitment`).
 * @param {any[]} annonces Les annonces de la page.
 * @param {{ page?: number, pageCount?: number, total: number }} pagination La pagination.
 * @returns {any} La réponse de la recherche.
 */
const pageRecherche = (annonces, pagination) => ({
  ...pageRest([], pagination),
  data: annonces.map((payload) => ({ payload, score: 1 })),
});

/**
 * Tous les textes rendus, aplatis (les props d'une FlatList sont circulaires).
 * @param {any} node Le nœud.
 * @returns {string[]} Les textes.
 */
const collectText = (node) => {
  if (node === null || node === undefined) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  return collectText(node.children);
};

/**
 * Le texte visible du rendu, en une seule chaîne cherchable.
 * @param {any} tree L'arbre.
 * @returns {string} Le texte.
 */
const texteVisible = (tree) => collectText(tree.toJSON())
  .join(' | ')
  // Les pastilles passent leurs espaces en insécables (piège Android 16) : on lit
  // le texte comme l'œil le lit.
  .replace(/\u00a0/g, ' ');

/**
 * Combien de fois un texte apparaît dans le rendu.
 * @param {any} tree L'arbre.
 * @param {string} texte Le texte cherché.
 * @returns {number} Le nombre d'apparitions.
 */
const occurrences = (tree, texte) => texteVisible(tree).split(texte).length - 1;

const laisserFiler = async () => {
  await act(async () => {
    await new Promise((resolve) => { setTimeout(resolve, 0); });
  });
};

/** @type {any[]} */
let arbres = [];

/**
 * Rend la liste pour un compte donné, et laisse les chargements aboutir.
 * @param {any} userData Le compte.
 * @returns {Promise<any>} L'arbre.
 */
const rendrePour = async (userData) => {
  mockUserData = userData;
  /** @type {any} */
  let tree;
  await act(async () => {
    tree = renderer.create(<RecrutementListContent />);
  });
  arbres.push(tree);
  await laisserFiler();
  return tree;
};

/**
 * Appuie sur l'élément pressable qui porte EXACTEMENT ce libellé.
 * @param {any} tree L'arbre.
 * @param {string} libelle Le libellé.
 * @returns {Promise<void>} Rien.
 */
const appuyerSur = async (tree, libelle) => {
  const texteDuNoeud = (/** @type {any} */ node) => {
    if (typeof node === 'string') return node;
    if (!node || !Array.isArray(node.children)) return '';
    return node.children.map(texteDuNoeud).join('');
  };
  const cibles = tree.root.findAll(
    (/** @type {any} */ node) => (
      typeof node.props?.onPress === 'function' && texteDuNoeud(node).trim() === libelle
    ),
    { deep: true },
  );
  if (cibles.length === 0) throw new Error(`Aucun pressable ne porte « ${libelle} »`);
  await act(async () => { cibles[0].props.onPress(); });
};

afterEach(async () => {
  // Une FlatList arme des minuteries : démonter explicitement chaque arbre.
  const aDemonter = arbres;
  arbres = [];
  await act(async () => { aDemonter.forEach((arbre) => arbre.unmount()); });
});

/**
 * Une ligne de « mes candidatures », telle que getMyApplications la rend : l'annonce, avec le
 * statut de MA candidature (`applicationStatus`, `myApplication` — recruitmentService.js,
 * mapApplicationToRecruitmentAd).
 * @param {any} ad L'annonce.
 * @param {string} status Le statut.
 * @returns {any} La ligne.
 */
const maCandidature = (ad, status) => ({
  ...ad,
  applicationStatus: status,
  myApplication: { documentId: `cand-${ad.documentId}`, status },
});

const POUR_MOI = [annonce('ad-pm-1', 'Pour Moi FC'), annonce('ad-pm-2', 'Pour Moi AS')];
const TOUTES = [...POUR_MOI, annonce('ad-autre-1', 'Autre Basket', 'Basketball')];

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockGetMyApplications.mockResolvedValue([]);
  mockGetRecruitmentAds.mockResolvedValue(pageRest(TOUTES, { total: 3 }));
  mockSearchRecruitment.mockResolvedValue(pageRecherche(POUR_MOI, { total: 2 }));
});

describe('FINITIONS8 · point 6 — la carte dit ce que j ai envoye', () => {
  it('🚨 apres « Postuler », la carte dit « Demande en attente »', async () => {
    const tree = await rendrePour(JOUEUR_FOOT_U15);
    const avant = occurrences(tree, 'Postuler');
    expect(avant).toBeGreaterThan(0);

    // Le serveur accepte ; « mes candidatures » porte desormais celle-ci.
    mockApply.mockResolvedValue({ message: 'Ta candidature a été envoyée', status: 'pending' });
    mockGetMyApplications.mockResolvedValue([maCandidature(POUR_MOI[0], 'pending')]);
    await appuyerSur(tree, 'Postuler');
    await laisserFiler();

    expect(mockApply).toHaveBeenCalledWith('ad-pm-1', {});
    expect(occurrences(tree, 'Demande en attente')).toBe(1);
    expect(occurrences(tree, 'Postuler')).toBe(avant - 1);
  });

  it('🚨 a l ouverture, une candidature en attente se lit sur sa carte', async () => {
    mockGetMyApplications.mockResolvedValue([maCandidature(POUR_MOI[1], 'pending')]);

    const tree = await rendrePour(JOUEUR_FOOT_U15);

    expect(occurrences(tree, 'Demande en attente')).toBe(1);
  });

  it('🚨 une candidature refusee se lit « Candidature refusée » (point 1)', async () => {
    mockGetMyApplications.mockResolvedValue([maCandidature(POUR_MOI[0], 'declined')]);

    const tree = await rendrePour(JOUEUR_FOOT_U15);

    expect(occurrences(tree, 'Candidature refusée')).toBe(1);
  });

  it('jumeau : sans candidature, chaque carte propose « Postuler »', async () => {
    const tree = await rendrePour(JOUEUR_FOOT_U15);

    expect(occurrences(tree, 'Demande en attente')).toBe(0);
    expect(occurrences(tree, 'Postuler')).toBe(3);
  });
});
