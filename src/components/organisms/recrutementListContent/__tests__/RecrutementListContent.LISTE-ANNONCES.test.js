import { FlatList } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import RecrutementListContent from '../RecrutementListContent';

// LISTE-ANNONCES (audit V1, 30/09) — la liste des annonces de Rechercher › Recrutement.
//
// A11 — « Le comptage du nombre d'annonces n'est pas bon, il faut dérouler toute la page ».
//   Le chiffre comptait les annonces DÉJÀ CHARGÉES, par paquets de 10 ; le serveur envoie
//   pourtant le vrai total (`meta.pagination.total`) à chaque réponse. Il doit s'afficher,
//   et ne plus bouger quand on fait défiler.
//
// A08 — « Compatibles avec mon profil » triait DANS LE TÉLÉPHONE les 10 annonces chargées,
//   se laissait allumer sans profil, et tout disparaissait. Décision d'Adel : il devient
//   « Pour moi », ses critères sont écrits, le tri est fait PAR LE SERVEUR, et « Autres
//   annonces » suit en bas : « la liste ne doit jamais être vide ».
//
// Harnais repris du témoin ALERTES-ANNONCES (mêmes doublures, mêmes pièges payés).

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
jest.mock('@/services/recruitment/recruitmentService', () => ({
  applyToRecruitmentAd: jest.fn(),
  buildDetectionApplicationStatusMap: () => ({}),
  // FINITIONS8 (point 6) : la liste range « mes candidatures » par annonce.
  buildOwnApplicationStatusMap: () => ({}),
  filterVisibleRecruitmentAds: (/** @type {any[]} */ ads) => ads,
  getMyApplications: (/** @type {any} */ user) => mockGetMyApplications(user),
  getMyRecruitmentAds: jest.fn(),
  getRecruitmentAds: (/** @type {any} */ filters) => mockGetRecruitmentAds(filters),
  resolveRecruitmentAdApplicationState: () => ({
    hasApplied: false,
    linkedRecruitmentAdDocumentId: '',
    status: '',
  }),
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

const JOUEUR_SANS_SPORT = { documentId: 'u-joueur', role: { name: 'Joueur' } };
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

/**
 * L'interrupteur « Pour moi » (rôle switch).
 * @param {any} tree L'arbre.
 * @returns {any} Le nœud.
 */
const interrupteur = (tree) => tree.root.findAll(
  (/** @type {any} */ n) => n.props?.accessibilityRole === 'switch'
    && typeof n.props?.onPress === 'function',
)[0];

afterEach(async () => {
  // Une FlatList arme des minuteries : démonter explicitement chaque arbre.
  const aDemonter = arbres;
  arbres = [];
  await act(async () => { aDemonter.forEach((arbre) => arbre.unmount()); });
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetMyApplications.mockResolvedValue([]);
  mockSearchRecruitment.mockResolvedValue(pageRecherche([], { total: 0 }));
});

const DIX_PREMIERES = Array.from({ length: 10 }, (_, i) => annonce(`ad-${i}`, `Club ${i}`));
const DIX_SUIVANTES = Array.from(
  { length: 10 },
  (_, i) => annonce(`ad-${i + 10}`, `Club ${i + 10}`),
);

describe('A11 — le nombre d annonces est le TOTAL du serveur', () => {
  it('à l ouverture : « 38 annonces », pas les 10 chargées', async () => {
    mockGetRecruitmentAds.mockResolvedValue(pageRest(DIX_PREMIERES, { pageCount: 4, total: 38 }));
    const tree = await rendrePour(JOUEUR_SANS_SPORT);

    const texte = texteVisible(tree);
    expect(texte).toContain('Club 0');
    expect(texte).toContain('38 annonces');
    expect(texte).not.toContain('10 annonces');
  });

  it('en faisant défiler, le chiffre ne bouge pas (38, jamais 20)', async () => {
    // Répondre SELON LA PAGE : l'ouverture charge la page 1 deux fois (montage + focus).
    mockGetRecruitmentAds.mockImplementation(async (/** @type {any} */ { page }) => (
      page === 1
        ? pageRest(DIX_PREMIERES, { pageCount: 4, total: 38 })
        : pageRest(DIX_SUIVANTES, { page: 2, pageCount: 4, total: 38 })
    ));
    const tree = await rendrePour(JOUEUR_SANS_SPORT);

    await act(async () => { tree.root.findByType(FlatList).props.onEndReached(); });
    await laisserFiler();

    const texte = texteVisible(tree);
    expect(mockGetRecruitmentAds).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
    // La FlatList ne rend que ses 10 premiers éléments sous Jest : la page 2 se lit
    // dans ses DONNÉES, pas dans le texte.
    const cles = tree.root.findByType(FlatList).props.data.map((/** @type {any} */ i) => i.key);
    expect(cles.some((/** @type {string} */ cle) => cle.endsWith('ad-19'))).toBe(true);
    expect(texte).toContain('38 annonces');
    expect(texte).not.toContain('20 annonces');
  });

  it('le public choisi (« Pratiquants / Joueurs ») part au SERVEUR, total compris', async () => {
    mockGetRecruitmentAds.mockResolvedValue(pageRest(DIX_PREMIERES, { pageCount: 4, total: 38 }));
    mockSearchRecruitment.mockResolvedValue(
      pageRecherche(DIX_PREMIERES.slice(0, 3), { total: 3 }),
    );
    const tree = await rendrePour(JOUEUR_SANS_SPORT);

    await appuyerSur(tree, 'Pratiquants / Joueurs');
    await laisserFiler();

    // Filtré dans le téléphone, le public faisait mentir le compte (38 affiché
    // pour 3 annonces de joueurs) : il part désormais avec la recherche.
    expect(mockSearchRecruitment).toHaveBeenLastCalledWith(expect.objectContaining({
      audienceType: 'player',
      page: 1,
    }));
    const texte = texteVisible(tree);
    expect(texte).toContain('3 annonces');
    expect(texte).not.toContain('38 annonces');
  });
});

describe('A08 — « Pour moi » : critères écrits, tri serveur, « Autres annonces » en bas', () => {
  const POUR_MOI = [annonce('ad-pm-1', 'Pour Moi FC'), annonce('ad-pm-2', 'Pour Moi AS')];
  const TOUTES = [
    annonce('ad-pm-1', 'Pour Moi FC'),
    annonce('ad-autre-1', 'Autre Basket', 'Basketball'),
    annonce('ad-pm-2', 'Pour Moi AS'),
    annonce('ad-autre-2', 'Autre Rugby', 'Rugby'),
  ];

  beforeEach(() => {
    mockGetRecruitmentAds.mockResolvedValue(pageRest(TOUTES, { total: 38 }));
  });

  it('le serveur est interrogé avec le sport et la catégorie du profil', async () => {
    mockSearchRecruitment.mockResolvedValue(pageRecherche(POUR_MOI, { total: 2 }));
    const tree = await rendrePour(JOUEUR_FOOT_U15);

    expect(mockSearchRecruitment).toHaveBeenCalledWith(expect.objectContaining({
      category: ['cat-u15'],
      page: 1,
      sport: 'Football',
    }));
    const texte = texteVisible(tree);
    // L'interrupteur s'appelle « Pour moi », et ses critères sont ÉCRITS.
    expect(texte).toContain('Pour moi');
    expect(texte).not.toContain('Compatibles avec mon profil');
    expect(texte).toContain('Football');
    expect(texte).toContain('U15');
    expect(interrupteur(tree).props.accessibilityState).toEqual(
      expect.objectContaining({ checked: true }),
    );
  });

  it('« Pour moi » en tête (2 sur 38), puis « Autres annonces » (36), sans doublon', async () => {
    mockSearchRecruitment.mockResolvedValue(pageRecherche(POUR_MOI, { total: 2 }));
    const tree = await rendrePour(JOUEUR_FOOT_U15);

    const texte = texteVisible(tree);
    expect(texte).toContain('Correspondent à ton profil');
    expect(texte).toContain('2 sur 38');
    expect(texte).toContain('Autres annonces');
    expect(texte).toContain('36 annonces');
    // L'ordre : les annonces pour moi, PUIS la rubrique, PUIS les autres.
    expect(texte.indexOf('Pour Moi AS')).toBeLessThan(texte.indexOf('Autres annonces'));
    expect(texte.indexOf('Autres annonces')).toBeLessThan(texte.indexOf('Autre Basket'));
    expect(texte.indexOf('Autres annonces')).toBeLessThan(texte.indexOf('Autre Rugby'));
    // Une annonce déjà « pour moi » ne revient pas dans les autres.
    expect(occurrences(tree, 'Pour Moi FC')).toBe(occurrences(tree, 'Autre Basket'));
  });

  it('AUCUNE annonce pour moi : on le dit, et « Autres annonces » suit (jamais vide)', async () => {
    mockSearchRecruitment.mockResolvedValue(pageRecherche([], { total: 0 }));
    const tree = await rendrePour(JOUEUR_FOOT_U15);

    const texte = texteVisible(tree);
    // Le libellé existant (`empty.noMatch`) est réutilisé, à sa nouvelle place.
    expect(texte).toContain('Aucune annonce ne correspond exactement à ton profil pour le moment.');
    expect(texte).toContain('Autres annonces');
    expect(texte).toContain('Autre Basket');
    expect(texte).toContain('Pour Moi FC');
    expect(texte).not.toContain('Aucune annonce disponible pour le moment.');
  });

  it('éteint : « Toutes les annonces », le total du serveur, pas de « Autres »', async () => {
    mockSearchRecruitment.mockResolvedValue(pageRecherche(POUR_MOI, { total: 2 }));
    const tree = await rendrePour(JOUEUR_FOOT_U15);

    await act(async () => { interrupteur(tree).props.onPress(); });
    await laisserFiler();

    const texte = texteVisible(tree);
    expect(interrupteur(tree).props.accessibilityState).toEqual(
      expect.objectContaining({ checked: false }),
    );
    expect(texte).toContain('Toutes les annonces');
    expect(texte).toContain('38 annonces');
    expect(texte).not.toContain('Autres annonces');
  });

  it('SANS sport au profil : l interrupteur ne s allume pas, il dit quoi faire', async () => {
    const tree = await rendrePour(JOUEUR_SANS_SPORT);

    await act(async () => { interrupteur(tree).props.onPress(); });
    await laisserFiler();

    expect(interrupteur(tree).props.accessibilityState).toEqual(
      expect.objectContaining({ checked: false, disabled: true }),
    );
    expect(mockSearchRecruitment).not.toHaveBeenCalled();
    const texte = texteVisible(tree);
    expect(texte).toContain(
      'Ajoute ton sport à ton profil pour voir les annonces faites pour toi.',
    );
    // Les annonces restent là : l'interrupteur ne vide plus la liste.
    expect(texte).toContain('Pour Moi FC');
    expect(texte).toContain('38 annonces');
  });

  it('un VISITEUR voit « Pour moi » grisé, avec « Connecte-toi »', async () => {
    const tree = await rendrePour(null);

    await act(async () => { interrupteur(tree).props.onPress(); });
    await laisserFiler();

    expect(interrupteur(tree).props.accessibilityState).toEqual(
      expect.objectContaining({ checked: false, disabled: true }),
    );
    expect(mockSearchRecruitment).not.toHaveBeenCalled();
    const texte = texteVisible(tree);
    expect(texte).toContain('Connecte-toi pour voir les annonces faites pour toi.');
    expect(texte).toContain('Autre Basket');
  });

  it('toucher un critère mène à la modification du profil', async () => {
    mockSearchRecruitment.mockResolvedValue(pageRecherche(POUR_MOI, { total: 2 }));
    const tree = await rendrePour(JOUEUR_FOOT_U15);

    const critere = tree.root.findAll(
      (/** @type {any} */ n) => typeof n.props?.onPress === 'function'
        && n.props?.accessibilityLabel === 'Changer ce critère : Football',
    )[0];
    expect(critere).toBeDefined();
    await act(async () => { critere.props.onPress(); });
    expect(mockNavigate).toHaveBeenCalledWith('ProfileStack', { screen: 'ProfileEdit' });
  });
});
