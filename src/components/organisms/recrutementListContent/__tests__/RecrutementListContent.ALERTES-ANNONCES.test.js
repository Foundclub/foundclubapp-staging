import renderer, { act } from 'react-test-renderer';

import RecrutementListContent from '../RecrutementListContent';

// ALERTES-ANNONCES (30/09) — « 🔔 ME PRÉVENIR DES NOUVELLES ANNONCES COMME CELLES-CI ».
//
// Décision d'Adel : « je veux que les joueurs soient prévenus [des annonces], même
// les entraîneurs ». Sous les résultats de Rechercher › Recrutement, la MÊME carte
// que sous les événements (lot ALERTES, `AlerteEvenements.js`, `sorte="annonce"`)
// crée une alerte `recruitment` avec les filtres AFFICHÉS : ville (texte), sport,
// catégorie, niveau et le profil choisi. Sans ville, elle ouvre les filtres sur la
// rangée Ville. La feuille « Filtrer » porte l'étoile ★.
// Ce qui part au serveur est lu sur l'appel `createSearchAlert` ; la notification
// qui en résulte est prouvée au banc Postgres du lot (admin).
//
// Harnais repris du témoin des onglets (`RecrutementListContent.tabs.test.js`),
// images du thème en Proxy : la carte porte une cloche et une coche.

jest.setTimeout(30000);

// D69 — depuis que le bouton de filtres des profils ouvre une FEUILLE au lieu
// de pousser l'ecran plein, cette suite tire `AutocompleteSelect` et
// `AutocompleteAddressInput`, qui descendent tous deux vers
// `react-native-bouncy-checkbox` : publie en ESM pur et absent de
// `transformIgnorePatterns`. Sans ces doublures, la suite ne se CHARGE pas —
// elle ne rate pas un test, elle n'en execute aucun. Meme motif que les 4
// filets de `views/profile`.
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
  // useFocusEffect rejoue son rappel quand l'ecran prend le focus : au montage,
  // un useEffect en est l'equivalent fidele, et c'est lui qui declenche le
  // rechargement d'onglet qu'on veut observer.
  useFocusEffect: (/** @type {any} */ callback) => {
    // eslint-disable-next-line global-require
    const { useEffect } = require('react');
    useEffect(callback, [callback]);
  },
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : cle
    ),
  }),
}));

// react-native-reanimated est publie en ESM pur et n'est pas dans
// transformIgnorePatterns (jest.config.js) : sans ce mock, importer la carte
// d'annonce suffit a faire tomber la suite.
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

// D57 : l'ecran porte desormais la feuille de filtres, donc BottomModal, donc
// @gorhom/bottom-sheet — publie en ESM et hors transformIgnorePatterns. On garde
// la seule chose qui compte ici : le contenu n'existe que si `isVisible`, ce qui
// permet de voir depuis ce test si le bouton de filtres l'ouvre vraiment.
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  // eslint-disable-next-line global-require
  const { View } = require('react-native');
  return {
    __esModule: true,
    // D86 : la doublure rend l'entete et le pied, comme le vrai composant. Sans
    // eux, elle effacerait en silence le titre et les deux actions — et ce test,
    // qui les cherche par leur texte, tomberait pour une raison FAUSSE.
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

jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: [] }),
}));
jest.mock('@/services/category/categoryQueries', () => ({
  useGetCategories: () => ({ data: [] }),
}));
jest.mock('@/services/level/levelQueries', () => ({
  useGetLevels: () => ({ data: [] }),
}));
// D69 — la feuille de filtres des profils lit les SECTIONS. Sans cette
// doublure, le vrai module descend jusqu'au client HTTP, qui exige `API_URL`
// et fait mourir la suite entiere au chargement.
jest.mock('@/services/section/sectionQueries', () => ({
  useGetSections: () => ({ data: [] }),
}));

/** @type {any} */
let mockUserData;
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: mockUserData }),
}));

// Le VRAI theme, sans le contexte React qui le porte : un mock en Proxy rend
// les echecs Jest illisibles (constat du lot paywall, 2026-08-02), et un objet
// invente masquerait un jeton absent. `Images` est le seul element stub, pour
// ne pas faire dependre ce test de la resolution des fichiers d'assets.
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

// La valeur du contexte doit etre STABLE d'un rendu a l'autre : la rendre
// neuve a chaque appel relance `fetchAdsForPlayer` (qui en depend) a chaque
// rendu, et la suite tourne en boucle sans jamais rendre la main.
let mockEtatApplicatif = [{ recruitmentAdFilters: {} }, () => {}];
jest.mock('@/store/appContext', () => ({ useAppContext: () => mockEtatApplicatif }));

/**
 * Repose un etat applicatif FIGE portant ces filtres. La valeur doit rester la
 * meme d'un rendu a l'autre : la rendre neuve a chaque appel relance
 * `fetchAdsForPlayer` (qui en depend) sans fin.
 * @param {any} recruitmentAdFilters Les filtres deja poses.
 * @returns {void} Rien.
 */
const poserFiltres = (recruitmentAdFilters) => {
  mockEtatApplicatif = [{ recruitmentAdFilters }, jest.fn()];
};

const mockGetRecruitmentAds = jest.fn();
const mockGetMyRecruitmentAds = jest.fn();
const mockGetMyApplications = jest.fn();
// Le service est double ENTIEREMENT, y compris ses fonctions pures : le charger
// pour de vrai importe le client HTTP, qui refuse de se charger sans API_URL
// (`[CONFIG][runtime-endpoints]`). Les doublures des fonctions pures sont
// volontairement neutres — ce test parle d'ONGLETS, pas de visibilite d'annonce.
jest.mock('@/services/recruitment/recruitmentService', () => ({
  applyToRecruitmentAd: jest.fn(),
  buildDetectionApplicationStatusMap: () => ({}),
  // FINITIONS8 (point 6) : la liste range « mes candidatures » par annonce.
  buildOwnApplicationStatusMap: () => ({}),
  filterVisibleRecruitmentAds: (/** @type {any[]} */ ads) => ads,
  getMyApplications: (/** @type {any} */ user) => mockGetMyApplications(user),
  getMyRecruitmentAds: (/** @type {any} */ filters) => mockGetMyRecruitmentAds(filters),
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

const mockUseSearchProfiles = jest.fn();
jest.mock('@/services/search/searchQueries', () => ({
  useSearchProfiles: (/** @type {any} */ params, /** @type {any} */ options) => (
    mockUseSearchProfiles(params, options)
  ),
}));

// La barre de recherche partagee n'est pas l'objet de ce test — mais son bouton
// de filtres l'est depuis D57 : la doublure expose donc `openFilters` et le
// compte de la pastille, et rien d'autre.
jest.mock('@/components/organisms/searchComponent/searchComponent', () => {
  // eslint-disable-next-line global-require
  const { Text, TouchableOpacity, View } = require('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { filterNumber, openFilters }) => (
      <View testID="search-bar">
        <TouchableOpacity onPress={openFilters}>
          <Text>{`Filtres ${filterNumber || 0}`}</Text>
        </TouchableOpacity>
      </View>
    ),
  };
});

jest.mock('@/utils/performance/searchPerformance', () => ({ markSearchPerf: jest.fn() }));
jest.mock('@/navigation/public/publicAuthNavigation', () => ({ openPublicAuthFlow: jest.fn() }));

// Un Dirigeant AVEC une equipe : c'est le cas reel (compte de recette), et le
// message de liste vide en depend — sans equipe geree, l'ecran dit « Aucune
// annonce creee » au lieu de « Aucune annonce publiee pour tes equipes ».
const DIRIGEANT = {
  documentId: 'u-dirigeant',
  myTeams: [{ documentId: 'team-1', name: 'CD Senior' }],
  role: { name: 'Dirigeant' },
};
const JOUEUR = { documentId: 'u-joueur', role: { name: 'Joueur' } };

// `sport` est un champ SCALAIRE cote serveur (il est filtre en `$eqi`, il n'est
// pas dans le `populate`) : la carte le rend tel quel. Lui donner un objet
// `{ name }` fait tomber le rendu — piege paye pendant l'ecriture de ce filet.
const ANNONCE_PUBLIQUE = {
  category: { name: 'U17' },
  city: 'Lyon',
  documentId: 'ad-publique',
  isActive: true,
  level: { name: 'Regional' },
  positions: ['Gardien'],
  sport: 'Football',
  team: { club: { name: 'Olympique Public' }, name: 'OP U17' },
  title: 'Recherche gardien U17',
};

const PROFIL_OUVERT = {
  category: 'U17',
  city: 'Lyon',
  documentId: 'p-1',
  firstname: 'Lucas',
  lastname: 'Martin',
  position: 'Gardien',
  username: 'Lucas Martin',
};

const MON_ANNONCE = {
  city: 'Lille',
  documentId: 'ad-a-moi',
  isActive: true,
  team: { club: { name: 'Club des Dirigeants' }, name: 'CD Senior' },
  title: 'Recherche attaquant senior',
};

const MA_CANDIDATURE = {
  city: 'Nantes',
  documentId: 'ad-candidature',
  isActive: true,
  team: { club: { name: 'Club Postule' }, name: 'CP U19' },
  title: 'Recherche milieu U19',
};

/**
 * Tous les textes rendus, aplatis. On parcourt les enfants plutot que de
 * serialiser l'arbre : les props d'une FlatList sont circulaires.
 * @param {any} node
 * @returns {string[]}
 */
const collectText = (node) => {
  if (node === null || node === undefined) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collectText);
  return collectText(node.children);
};

/**
 * Le texte visible du rendu, en une seule chaine cherchable.
 * @param {any} tree
 * @returns {string}
 */
const texteVisible = (tree) => collectText(tree.toJSON()).join(' | ');

/**
 * Le texte porte par un noeud de l'arbre de test (instances ou chaines).
 * @param {any} node
 * @returns {string}
 */
const texteDuNoeud = (node) => {
  if (typeof node === 'string') return node;
  if (!node || !Array.isArray(node.children)) return '';
  return node.children.map(texteDuNoeud).join('');
};

/**
 * Rend le contenu recrutement pour un utilisateur donne.
 * @param {any} userData
 * @param {any} props
 * @returns {Promise<any>}
 */
const rendrePour = async (userData, props = {}) => {
  mockUserData = userData;
  /** @type {any} */
  let tree;
  await act(async () => {
    tree = renderer.create(<RecrutementListContent initialTab={props.initialTab} />);
  });
  return tree;
};

/**
 * Appuie sur l'element pressable qui porte EXACTEMENT ce libelle.
 * @param {any} tree
 * @param {string} libelle
 * @returns {Promise<void>}
 */
const appuyerSur = async (tree, libelle) => {
  const cibles = tree.root.findAll(
    (/** @type {any} */ node) => (
      typeof node.props?.onPress === 'function' && texteDuNoeud(node).trim() === libelle
    ),
    { deep: true },
  );
  if (cibles.length === 0) {
    throw new Error(`Aucun element pressable ne porte le libelle « ${libelle} »`);
  }
  await act(async () => {
    cibles[0].props.onPress();
  });
};

/**
 * Le retour de la requete de profils, avec ou sans resultat.
 * @param {any[]} profils
 * @returns {any}
 */
const requeteProfils = (profils) => ({
  data: { pages: [{ data: profils.map((profil) => ({ payload: profil, score: 1 })), meta: {} }] },
  fetchNextPage: jest.fn(),
  hasNextPage: false,
  isError: false,
  isFetching: false,
  isFetchingNextPage: false,
  isLoading: false,
  refetch: jest.fn(),
});

beforeEach(() => {
  jest.clearAllMocks();
  poserFiltres({});
  mockGetRecruitmentAds.mockResolvedValue({ data: [ANNONCE_PUBLIQUE], meta: {} });
  mockGetMyRecruitmentAds.mockResolvedValue([MON_ANNONCE]);
  mockGetMyApplications.mockResolvedValue([MA_CANDIDATURE]);
  mockSearchRecruitment.mockResolvedValue({ data: [], meta: {} });
  mockUseSearchProfiles.mockReturnValue(requeteProfils([PROFIL_OUVERT]));
});

const mockCreateSearchAlert = jest.fn();
const mockGetSearchAlerts = jest.fn();
// Le service est double ENTIEREMENT : le vrai charge le client HTTP, qui exige API_URL.
jest.mock('@/services/searchAlert/searchAlertService', () => ({
  createSearchAlert: (/** @type {any} */ donnees) => mockCreateSearchAlert(donnees),
  getSearchAlerts: () => mockGetSearchAlerts(),
}));
const mockShowBanner = jest.fn();
jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => ({ showBanner: mockShowBanner }),
}));

const CARTE = 'Me prévenir des nouvelles annonces comme celles-ci';
const ETOILE = 'Créer une alerte avec ces filtres';
const NOTE_VILLE = "Choisis une ville, puis touche « Créer l'alerte ».";
const CORPS_ANNONCES = 'Tu seras prévenu·e dès qu\'une nouvelle annonce '
  + 'comme celles-ci est publiée.';

beforeEach(() => {
  mockCreateSearchAlert.mockResolvedValue({ data: { documentId: 'al-neuve' } });
  mockGetSearchAlerts.mockResolvedValue({ data: [] });
});

const laisserFiler = async () => {
  await act(async () => {
    await new Promise((resolve) => { setTimeout(resolve, 0); });
  });
};

/**
 * L'élément pressable qui porte cette étiquette d'accessibilité.
 * @param {any} tree L'arbre.
 * @param {string} etiquette L'étiquette.
 * @returns {any} L'élément, ou undefined.
 */
const parEtiquette = (tree, etiquette) => tree.root.findAll(
  (/** @type {any} */ n) => typeof n.props?.onPress === 'function'
    && n.props?.accessibilityLabel === etiquette,
  { deep: true },
)[0];

/**
 * La feuille de filtres est-elle ouverte ?
 * @param {any} tree L'arbre.
 * @returns {boolean} Vrai si la doublure de BottomModal est rendue.
 */
const feuilleOuverte = (tree) => tree.root.findAll(
  (/** @type {any} */ n) => n.props?.testID === 'sheet',
).length > 0;

describe('ALERTES-ANNONCES — la carte « Me prévenir » sous les annonces', () => {
  it('LE TEMOIN : un visiteur non connecté ne voit pas la carte', async () => {
    // Une alerte appartient à un compte.
    const tree = await rendrePour(null);
    await laisserFiler();
    expect(texteVisible(tree)).not.toContain(CARTE);
  });

  it('un JOUEUR la voit sous les annonces, avec les mots des annonces', async () => {
    const tree = await rendrePour(JOUEUR);
    await laisserFiler();
    const texte = texteVisible(tree);
    // Repère : le club de l'annonce, que la carte d'annonce affiche.
    expect(texte).toContain('Olympique Public');
    expect(texte).toContain(CARTE);
    expect(texte.indexOf(CARTE)).toBeGreaterThan(texte.lastIndexOf('Olympique Public'));
  });

  it('un ENTRAÎNEUR / dirigeant la voit sous les opportunités', async () => {
    // « Même les entraîneurs » (Adel, 30/09).
    const tree = await rendrePour(DIRIGEANT, { initialTab: 'opportunites' });
    await laisserFiler();
    expect(texteVisible(tree)).toContain(CARTE);
  });

  it('avec une ville, « Créer l alerte » crée une alerte d ANNONCES', async () => {
    poserFiltres({
      category: ['c-u17'], city: 'Lyon', level: [], sport: 'Football',
    });
    const tree = await rendrePour(JOUEUR);
    await laisserFiler();
    expect(texteVisible(tree)).toContain('Football · Lyon');

    await appuyerSur(tree, 'Créer l\'alerte');
    await laisserFiler();

    expect(mockCreateSearchAlert).toHaveBeenCalledTimes(1);
    expect(mockCreateSearchAlert.mock.calls[0][0]).toEqual({
      filters: {
        category: ['c-u17'], city: { label: 'Lyon', value: 'Lyon' }, level: [], sport: 'Football',
      },
      isActive: true,
      label: 'Annonces · Football · Lyon',
      type: 'recruitment',
    });
    expect(mockShowBanner).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Alerte créée', tone: 'success' }),
    );
    expect(texteVisible(tree)).toContain(CORPS_ANNONCES);
  });

  it('sans ville, le bouton ouvre les filtres sur la rangée Ville, et rien ne part', async () => {
    const tree = await rendrePour(JOUEUR);
    await laisserFiler();

    await appuyerSur(tree, 'Choisir une ville');
    await laisserFiler();

    expect(mockCreateSearchAlert).not.toHaveBeenCalled();
    expect(feuilleOuverte(tree)).toBe(true);
    expect(texteVisible(tree)).toContain(NOTE_VILLE);
  });

  it('la feuille « Filtrer » porte l étoile ★ : elle crée l alerte avec le brouillon', async () => {
    poserFiltres({ city: 'Lyon' });
    const tree = await rendrePour(JOUEUR);
    await laisserFiler();

    await appuyerSur(tree, 'Filtres 1');
    await laisserFiler();
    const etoile = parEtiquette(tree, ETOILE);
    expect(etoile).toBeDefined();

    await act(async () => { await etoile.props.onPress(); });
    await laisserFiler();

    expect(mockCreateSearchAlert).toHaveBeenCalledTimes(1);
    expect(mockCreateSearchAlert.mock.calls[0][0]).toEqual(expect.objectContaining({
      filters: expect.objectContaining({ city: { label: 'Lyon', value: 'Lyon' } }),
      type: 'recruitment',
    }));
    expect(texteVisible(tree)).toContain('Alerte créée');
  });

  it('« Gérer mes alertes » (après création) mène à l écran des alertes', async () => {
    poserFiltres({ city: 'Lyon' });
    const tree = await rendrePour(JOUEUR);
    await laisserFiler();
    await appuyerSur(tree, 'Créer l\'alerte');
    await laisserFiler();

    await appuyerSur(tree, 'Gérer mes alertes');
    expect(mockNavigate).toHaveBeenCalledWith('SearchAlerts');
  });
});
