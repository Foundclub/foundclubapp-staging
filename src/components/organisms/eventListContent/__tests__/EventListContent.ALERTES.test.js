import renderer, { act } from 'react-test-renderer';

import { choisirLeSport } from '../../../../testSupport/temoinChoixDuSport';

// ALERTES (audit V1, A20) — « MES ALERTES ARRIVE TROP TARD ».
//
// Constat de l'audit : on ne crée une alerte qu'en allant la chercher dans
// « Gérer mes alertes », loin de la recherche. Jusqu'au 12/08, les filtres
// d'événements portaient une étoile « ★ Créer alerte » en haut à droite ; le
// lot D82 (85e300a0) a remplacé l'écran plein par une FEUILLE qui ne l'a pas
// reprise, et l'écran plein n'est plus ouvert par la recherche.
//
// Décision d'Adel (30/09), quatre éléments, chacun a son bloc ci-dessous :
//   1. sous les résultats, « Me prévenir des nouveaux événements comme
//      ceux-ci » : un toucher crée l'alerte avec les filtres affichés ;
//   2. la PREMIÈRE ouverture des événements propose de créer son alerte, une
//      seule fois, avec la mémoire de « déjà vu » PAR COMPTE ;
//   3. un guide qui montre comment créer une alerte, accessible à chaque fois ;
//   4. l'étoile en haut à droite des filtres revient, et elle crée VRAIMENT une
//      alerte : on regarde l'appel qui part au serveur (`POST /search-alerts`).
//
// ⚠️ La liste est NON VIDE (3 événements) : la maquette AVANT de l'audit avait
// été prise sur une liste vide, ce qui la rendait fausse.
//
// Le premier bloc est la CARACTÉRISATION (E6) de ce qui marchait déjà : il passe
// sur le code d'avant le lot et doit passer après.
//
// Ce qui est VRAI dans ce filet : la liste, la feuille « Filtrer » et sa
// coquille, le service `searchAlertService`, la mémoire des tutoriels
// (`tutorialStorage`, sur un stockage en mémoire). Ce qui est doublé : le client
// HTTP (c'est lui qu'on écoute), le moteur de liste, les champs de saisie.

jest.setTimeout(30000);

const PROPOSITION_ID = 'search_events_alert_offer';
const MONTRIVAGE = { label: 'Montrivage', value: '5.37|43.29' };
const REFUS_DU_SERVEUR = 'Limite de 10 alertes atteinte. Supprimez une alerte existante.';

// --- Le stockage des tutoriels, en mémoire (MMKV hors de portée de Jest). ---
const mockMemoire = new Map();
const mockStockage = {
  contains: (/** @type {string} */ cle) => mockMemoire.has(cle),
  delete: (/** @type {string} */ cle) => { mockMemoire.delete(cle); },
  getAllKeys: () => Array.from(mockMemoire.keys()),
  getBoolean: (/** @type {string} */ cle) => (
    mockMemoire.has(cle) ? Boolean(mockMemoire.get(cle)) : undefined
  ),
  getNumber: (/** @type {string} */ cle) => (
    mockMemoire.has(cle) ? Number(mockMemoire.get(cle)) : undefined
  ),
  getString: (/** @type {string} */ cle) => (
    mockMemoire.has(cle) ? String(mockMemoire.get(cle)) : undefined
  ),
  set: (/** @type {string} */ cle, /** @type {any} */ valeur) => { mockMemoire.set(cle, valeur); },
};

// --- Les doubles dont l'IDENTITÉ doit rester fixe d'un rendu à l'autre
// (sinon les `useMemo`/`useEffect` de la liste tournent en boucle). ---
const mockDispatch = jest.fn();
const mockContexte = {
  valeur: /** @type {any} */ ([{ eventFilters: {}, searchMapSessions: {} }, mockDispatch]),
};
const mockAuth = { valeur: /** @type {any} */ (null) };
const mockListe = { valeur: /** @type {any} */ (null) };
const mockNavigation = {
  addListener: () => () => {},
  getParent: () => undefined,
  navigate: jest.fn(),
  setOptions: jest.fn(),
};
const mockRetour = { showBanner: jest.fn() };
const mockClient = {
  delete: jest.fn(),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
};
const mockGeohash = jest.fn(
  (/** @type {number} */ lat, /** @type {number} */ lon, /** @type {number} */ rayon) => (
    `gh(${String(lat)},${String(lon)},${String(rayon)})`
  ),
);
const mockQueryClient = {
  cancelQueries: jest.fn(() => Promise.resolve()),
  getQueryData: jest.fn(),
  invalidateQueries: jest.fn(),
  prefetchInfiniteQuery: jest.fn(() => Promise.resolve()),
  setQueryData: jest.fn(),
};
const mockRechercheVide = {
  data: undefined, isFetched: true, isFetching: false, isLoading: false, refetch: jest.fn(),
};
// Un texte tapé (« tournoi ») fait passer la liste par la recherche PAR
// PERTINENCE : elle rend alors ce que cette doublure porte.
const mockRecherche = { valeur: /** @type {any} */ (mockRechercheVide) };
const mockSports = {
  data: [{ documentId: 'a-foot', name: 'Football' }, { documentId: 'a-hand', name: 'Handball' }],
};
const mockCategories = { data: [{ documentId: 'c-1', name: 'U13' }] };
const mockNiveaux = { data: [{ documentId: 'n-1', name: 'Régional 1' }] };
const mockTypes = { data: [{ documentId: 't-1', name: 'Match' }] };
const mockClubs = { data: { pages: [{ data: [{ documentId: 'cl-1', name: 'OM' }] }] } };
const mockEquipes = { data: { pages: [{ data: [] }] } };

jest.mock('@/services/client', () => ({ __esModule: true, default: mockClient }));

jest.mock('@/store/appContext', () => ({
  storage: mockStockage,
  useAppContext: () => mockContexte.valeur,
}));

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => mockAuth.valeur,
}));

jest.mock('@/context/AppFeedbackContext', () => ({
  useAppFeedback: () => mockRetour,
}));

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    // La doublure INTERPOLE `{{x}}` : sans elle, le gabarit « Événement ·
    // {{cityName}} » partirait tel quel dans le nom de l'alerte.
    t: (/** @type {string} */ cle, /** @type {any} */ repli, /** @type {any} */ options) => {
      let texte = cle;
      if (typeof repli === 'string') texte = repli;
      else if (repli && typeof repli.defaultValue === 'string') texte = repli.defaultValue;
      const valeurs = repli && typeof repli === 'object' ? repli : (options || {});
      return String(texte).replace(/\{\{(\w+)\}\}/g, (_, nom) => (
        valeurs[nom] === undefined ? `{{${nom}}}` : String(valeurs[nom])
      ));
    },
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const generateApplicationStyle = jest.requireActual('@/theme/applicationStyle').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  const theme = {
    Alignments,
    ApplicationStyle: generateApplicationStyle(Colors),
    Colors,
    Fonts: generateFonts(Colors),
    Images: new Proxy({}, { get: () => 1 }),
    scheme: 'dark',
    Spaces,
  };
  return { __esModule: true, default: () => theme };
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn(), mutateAsync: jest.fn() }),
  useQueryClient: () => mockQueryClient,
}));

// Le moteur de liste rend ce que FlashList rend : l'en-tête, les cartes (ou
// l'état vide), puis le PIED — c'est là que vit « Me prévenir ».
jest.mock('@shopify/flash-list', () => {
  const { View } = jest.requireActual('react-native');
  return {
    FlashList: (/** @type {any} */ {
      data, ListEmptyComponent, ListFooterComponent, ListHeaderComponent, renderItem,
    }) => (
      <View>
        {ListHeaderComponent}
        {data && data.length
          ? data.map((/** @type {any} */ item, /** @type {number} */ index) => (
            <View key={item.documentId}>{renderItem({ index, item })}</View>
          ))
          : ListEmptyComponent}
        {ListFooterComponent}
      </View>
    ),
  };
});

jest.mock('@/components/molecules/eventCard/EventCardNew', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { item }) => <Text>{`CARTE ${item.title}`}</Text>,
  };
});

jest.mock('@/components/atoms/emptyState/EmptyState', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { title }) => <Text>{`VIDE ${title}`}</Text>,
  };
});

jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => ({ dockHeight: 0, sceneBottomInset: 0 }),
}));

jest.mock('@/navigation/public/publicAuthNavigation', () => ({ openPublicAuthFlow: jest.fn() }));

jest.mock('@/services/event/eventQueries', () => ({
  getEventsQueryKey: () => ['events'],
  useGetEvents: () => mockListe.valeur,
  useGetEventTypes: () => mockTypes,
}));

jest.mock('@/services/event/eventService', () => ({
  getEvents: jest.fn(() => Promise.resolve({ data: [], meta: {} })),
  missingEvent: jest.fn(() => Promise.resolve({})),
  respondToEventRsvp: jest.fn(() => Promise.resolve({})),
}));

jest.mock('@/services/eventParticipation/eventParticipationService', () => ({
  createEventParticipation: jest.fn(() => Promise.resolve({})),
}));

jest.mock('@/services/reservation/reservationService', () => ({
  joinReservation: jest.fn(() => Promise.resolve({})),
}));

jest.mock('@/services/search/searchQueries', () => ({
  useSearchEvents: () => mockRecherche.valeur,
  useSearchEventsMap: () => mockRechercheVide,
}));

jest.mock('@/services/search/searchService', () => ({
  getMatchReasonLabel: () => '',
  mapSearchPayload: (/** @type {any} */ payload) => payload,
}));

jest.mock('@/services/queryOptions', () => ({ keepPreviousPageData: {} }));

jest.mock('@/utils/logger/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn(),
  }),
}));

jest.mock('@/utils/performance/searchPerformance', () => ({ markSearchPerf: jest.fn() }));

// --- Ce que la feuille « Filtrer » réclame (la feuille elle-même est VRAIE). ---
jest.mock('@/components/molecules/bottomModal/BottomModal', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    // Fermée, elle ne rend RIEN : son contenu est DÉMONTÉ, comme la vraie
    // feuille une fois partie. C'est ce qui déclenche les actions « à la
    // sortie » (le motif EVEDIT-2 de `EventDetails`).
    default: (/** @type {any} */ {
      children, footerComponent, headerComponent, isVisible,
    }) => (
      isVisible ? (
        <View>
          {headerComponent}
          {children}
          {footerComponent}
        </View>
      ) : null
    ),
  };
});

jest.mock('@/components/molecules/autocompleteSelect/AutocompleteSelect', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    default: (/** @type {any} */ props) => <View testID="select" {...props} />,
  };
});

jest.mock('@/components/organisms/autocompleteAddressInput/autocompleteAddressInput', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    default: (/** @type {any} */ props) => <View testID="adresse" {...props} />,
  };
});

jest.mock('@react-native-community/slider', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    default: (/** @type {any} */ props) => <View testID="rayon" {...props} />,
  };
});

jest.mock('@/domains/places/usePlaces', () => ({
  __esModule: true,
  default: () => ({ getGeohashForPointAndRadius: mockGeohash }),
}));

jest.mock('@/services/activity/activityQueries', () => ({ useGetActivities: () => mockSports }));
jest.mock('@/services/category/categoryQueries', () => ({
  useGetCategories: () => mockCategories,
}));
jest.mock('@/services/level/levelQueries', () => ({ useGetLevels: () => mockNiveaux }));
jest.mock('@/services/club/clubQueries', () => ({ useGetClubs: () => mockClubs }));
jest.mock('@/services/team/teamQueries', () => ({ useGetTeams: () => mockEquipes }));

jest.mock('@/components/organisms/featuredEvents/FeaturedEvents', () => 'FeaturedEvents');
jest.mock('@/components/organisms/searchComponent/searchComponent', () => 'SearchComponent');
jest.mock('@/components/molecules/dateSlider/DateSlider', () => 'DateSlider');
jest.mock('@/components/organisms/joinEventModal/JoinEventModal', () => 'JoinEventModal');
jest.mock(
  '@/components/molecules/searchResultsLoadingState/SearchResultsLoadingState',
  () => 'SearchResultsLoadingState',
);
jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

const EventListContent = require('../EventListContent').default;

// --- Les données de la recette : une liste NON vide. ---
const EVENEMENTS = Object.freeze([
  {
    date: '2099-10-03T08:00:00.000Z',
    documentId: 'ev-1',
    title: 'Détection U13',
    type: { name: 'Détection' },
  },
  {
    date: '2099-10-06T16:30:00.000Z',
    documentId: 'ev-2',
    title: 'Séance d essai U15',
    type: { name: 'Entraînement' },
  },
  {
    date: '2099-10-10T13:00:00.000Z',
    documentId: 'ev-3',
    title: 'Tournoi U11',
    type: { name: 'Tournoi' },
  },
]);

/**
 * La réponse d'une requête de liste, construite UNE fois (identité fixe).
 * @param {any[]} evenements Les événements rendus.
 * @returns {any} La réponse.
 */
const reponseDeListe = (evenements) => ({
  data: { pages: [{ data: evenements, meta: {} }] },
  error: null,
  fetchNextPage: jest.fn(),
  hasNextPage: false,
  isFetched: true,
  isFetching: false,
  isFetchingNextPage: false,
  isLoading: false,
  refetch: jest.fn(),
});
const LISTE_PLEINE = reponseDeListe(EVENEMENTS);
const LISTE_VIDE = reponseDeListe([]);
// La recherche par pertinence rend des pages que `mapSearchPayload` (doublé
// en identité) déplie : une page = le tableau de ses événements.
const RECHERCHE_PLEINE = {
  data: { pages: [EVENEMENTS] },
  isFetched: true,
  isFetching: false,
  isLoading: false,
  refetch: jest.fn(),
};

const JOUEUR = Object.freeze({
  canEditClub: () => false,
  canEditEvent: () => false,
  canManageEvent: () => false,
  isAuthenticated: true,
  userData: { documentId: 'u-1', role: { name: 'Joueur' } },
});
const AUTRE_COMPTE = Object.freeze({
  ...JOUEUR,
  userData: { documentId: 'u-2', role: { name: 'Joueur' } },
});
const VISITEUR = Object.freeze({
  canEditClub: () => false,
  canEditEvent: () => false,
  canManageEvent: () => false,
  isAuthenticated: false,
  userData: null,
});

/**
 * Range la proposition comme DÉJÀ VUE pour ce compte, dans la forme exacte du
 * stockage des tutoriels (`tutorialStorage.js`).
 * @param {string} userId Le compte.
 */
const propositionDejaVue = (userId) => {
  mockMemoire.set(`tutorial-v1:${userId}:program_version`, 1);
  mockMemoire.set(
    `tutorial-v1:${userId}:feature_seen_map`,
    JSON.stringify({ [PROPOSITION_ID]: { seenAt: '2026-09-30T08:00:00.000Z', source: 'auto' } }),
  );
};

/**
 * Ramasse les chaînes d'un arbre rendu.
 * @param {any} node Le noeud.
 * @returns {string[]} Les chaînes qu'il porte.
 */
const collecterTexte = (node) => {
  if (node === null || node === undefined) return [];
  if (typeof node === 'string') return [node];
  if (Array.isArray(node)) return node.flatMap(collecterTexte);
  return collecterTexte(node.children);
};
const texteVisible = (/** @type {any} */ tree) => collecterTexte(tree.toJSON()).join(' | ');

/**
 * Recolle le texte d'un noeud et de ses descendants.
 * @param {any} node Le noeud.
 * @returns {string} Son texte, recollé.
 */
const texteDuNoeud = (node) => {
  if (typeof node === 'string') return node;
  if (!node || !Array.isArray(node.children)) return '';
  return node.children.map(texteDuNoeud).join('');
};

const laisserFiler = async () => {
  await act(async () => {
    await new Promise((resolve) => { setTimeout(resolve, 0); });
  });
};

/**
 * Appuie sur le premier élément pressable qui porte exactement ce libellé.
 * @param {any} tree L'arbre.
 * @param {string} libelle Le texte.
 */
const appuyerSur = async (tree, libelle) => {
  const cibles = tree.root.findAll(
    (/** @type {any} */ node) => (
      typeof node.props?.onPress === 'function' && texteDuNoeud(node).trim() === libelle
    ),
    { deep: true },
  );
  if (cibles.length === 0) throw new Error(`Aucun bouton « ${libelle} »`);
  await act(async () => {
    await cibles[0].props.onPress();
  });
  await laisserFiler();
};

/**
 * Le premier élément pressable dont l'étiquette d'accessibilité est celle-ci.
 * @param {any} tree L'arbre.
 * @param {string} etiquette L'étiquette.
 * @returns {any} L'élément, ou undefined.
 */
const parEtiquette = (tree, etiquette) => tree.root.findAll(
  (/** @type {any} */ node) => typeof node.props?.onPress === 'function'
    && node.props?.accessibilityLabel === etiquette,
  { deep: true },
)[0];

/**
 * Déplie la rangée de la feuille dont l'étiquette commence par cet intitulé.
 * @param {any} tree L'arbre.
 * @param {string} intitule L'intitulé.
 */
const ouvrirRangee = async (tree, intitule) => {
  const cibles = tree.root.findAll(
    (/** @type {any} */ node) => typeof node.props?.onPress === 'function'
      && String(node.props?.accessibilityLabel || '').startsWith(`${intitule} : `),
    { deep: true },
  );
  if (cibles.length === 0) throw new Error(`Aucune rangée « ${intitule} »`);
  await act(async () => { cibles[0].props.onPress(); });
};

const ouvrirLesFiltres = async (/** @type {any} */ tree) => {
  const barre = tree.root.findAll((/** @type {any} */ n) => n.type === 'SearchComponent')[0];
  await act(async () => { barre.props.openFilters(); });
};

/** @type {any[]} */
let montes = [];

/**
 * Monte la liste de Rechercher › Événement, telle que `SearchHubScreen` la pose.
 * @param {{ auth?: any, filtres?: any, liste?: any, annuaire?: boolean }} [options] Le décor.
 * @returns {Promise<any>} L'arbre.
 */
const monter = async ({
  annuaire = false, auth = JOUEUR, filtres = {}, liste = LISTE_PLEINE,
} = {}) => {
  mockAuth.valeur = auth;
  mockListe.valeur = liste;
  mockRecherche.valeur = liste === LISTE_VIDE ? mockRechercheVide : RECHERCHE_PLEINE;
  mockContexte.valeur = [{ eventFilters: filtres, searchMapSessions: {} }, mockDispatch];
  /** @type {any} */
  let tree;
  await act(async () => {
    tree = renderer.create(
      <EventListContent
        additionalFilters={{ excludeType: 'Réservation', sessionStatus: 'open' }}
        annuaire={annuaire}
        enableMapMode
        screenActive
        showFilters
      />,
    );
  });
  await laisserFiler();
  montes.push(tree);
  return tree;
};

const demonter = async (/** @type {any} */ tree) => {
  await act(async () => { tree.unmount(); });
  montes = montes.filter((t) => t !== tree);
};

beforeEach(() => {
  mockMemoire.clear();
  mockDispatch.mockClear();
  mockNavigation.navigate.mockClear();
  mockRetour.showBanner.mockClear();
  mockGeohash.mockClear();
  mockClient.get.mockReset();
  mockClient.post.mockReset();
  mockClient.get.mockResolvedValue({ data: { data: [] } });
  mockClient.post.mockResolvedValue({ data: { data: { documentId: 'al-1' } } });
});

afterEach(async () => {
  const restants = montes;
  montes = [];
  // eslint-disable-next-line no-restricted-syntax -- démontage séquentiel voulu
  for (const tree of restants) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { tree.unmount(); });
  }
});

describe('E6 — ce qui marchait AVANT le lot (caractérisation)', () => {
  beforeEach(() => { propositionDejaVue('u-1'); });

  it('la liste NON vide affiche ses 3 événements sous la barre de recherche', async () => {
    const tree = await monter();
    const texte = texteVisible(tree);

    const barres = tree.root.findAll((/** @type {any} */ n) => n.type === 'SearchComponent');
    expect(barres).toHaveLength(1);
    expect(texte).toContain('CARTE Détection U13');
    expect(texte).toContain('CARTE Séance d essai U15');
    expect(texte).toContain('CARTE Tournoi U11');
  });

  it('le bouton de filtres ouvre la feuille « Filtrer »', async () => {
    const tree = await monter();
    expect(texteVisible(tree)).not.toContain('Voir les résultats');

    await ouvrirLesFiltres(tree);

    expect(texteVisible(tree)).toContain('Filtrer');
    expect(texteVisible(tree)).toContain('Voir les résultats');
  });

  it('« Voir les résultats » range les filtres dans la recherche, sans rien créer', async () => {
    const tree = await monter({ filtres: { city: MONTRIVAGE, radius: 20 } });
    await ouvrirLesFiltres(tree);

    await appuyerSur(tree, 'Voir les résultats');

    expect(mockDispatch)
      .toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_EVENT_FILTERS' }));
    expect(mockClient.post).not.toHaveBeenCalled();
  });

  it('liste vide : l état vide est affiché', async () => {
    const tree = await monter({ liste: LISTE_VIDE });
    expect(texteVisible(tree)).toContain('VIDE eventList.noData');
  });
});

describe('A20.1 — sous les résultats : « Me prévenir des nouveaux événements »', () => {
  beforeEach(() => { propositionDejaVue('u-1'); });

  it('la carte est SOUS le dernier événement de la liste', async () => {
    const tree = await monter({ filtres: { activity: ['a-foot'], city: MONTRIVAGE, radius: 20 } });
    const texte = texteVisible(tree);

    const carte = texte.indexOf('Me prévenir des nouveaux événements comme ceux-ci');
    expect(carte).toBeGreaterThan(-1);
    expect(carte).toBeGreaterThan(texte.indexOf('CARTE Tournoi U11'));
  });

  it('elle résume les filtres affichés : « Football · Montrivage · 20 km »', async () => {
    const tree = await monter({ filtres: { activity: ['a-foot'], city: MONTRIVAGE, radius: 20 } });
    expect(texteVisible(tree)).toContain('Football · Montrivage · 20 km');
  });

  it('UN toucher crée l alerte avec les filtres affichés : POST /search-alerts', async () => {
    const tree = await monter({
      filtres: {
        activity: ['a-foot'], city: MONTRIVAGE, q: 'tournoi', radius: 20,
      },
    });
    // Le texte tapé est une recherche par pertinence : la liste est bien pleine.
    expect(texteVisible(tree)).toContain('CARTE Tournoi U11');

    await appuyerSur(tree, 'Créer l\'alerte');

    expect(mockClient.post).toHaveBeenCalledTimes(1);
    expect(mockClient.post).toHaveBeenCalledWith('/search-alerts', {
      data: {
        filters: {
          activity: ['a-foot'],
          category: [],
          city: MONTRIVAGE,
          geohash: 'gh(43.29,5.37,20)',
          level: [],
          radius: 20,
          type: [],
        },
        isActive: true,
        label: 'Football · Montrivage',
        type: 'event',
      },
    });
  });

  it('après la création, la carte le dit et mène à « Gérer mes alertes »', async () => {
    const tree = await monter({ filtres: { activity: ['a-foot'], city: MONTRIVAGE, radius: 20 } });

    await appuyerSur(tree, 'Créer l\'alerte');

    const texte = texteVisible(tree);
    expect(texte).toContain('Alerte créée');
    expect(texte).not.toContain('Créer l\'alerte');
    await appuyerSur(tree, 'Gérer mes alertes');
    expect(mockNavigation.navigate).toHaveBeenCalledWith('SearchAlerts');
  });

  it('SANS VILLE : « Choisir une ville » ouvre la Ville des filtres — AUCUN appel', async () => {
    const tree = await monter({ filtres: { activity: ['a-foot'] } });
    expect(texteVisible(tree)).toContain('Choisis une ville');

    await appuyerSur(tree, 'Choisir une ville');

    expect(mockClient.post).not.toHaveBeenCalled();
    const texte = texteVisible(tree);
    // PAR-L10 (E22) : la feuille s'ouvre en mode CRÉATION, son bouton dit ce qu'il fait.
    expect(texte).toContain('Créer cette alerte');
    expect(texte).toContain('Choisis une ville, puis touche « Créer cette alerte ».');
    // La rangée Ville est DÉJÀ dépliée : son champ d'adresse est là.
    expect(tree.root.findAll((/** @type {any} */ n) => n.props?.testID === 'adresse').length)
      .toBeGreaterThan(0);
  });

  // PAR-L10 (12/10) — la forme de l'erreur est celle que REJETTE le client HTTP
  // (`client.native.js:91-97` : la charge Strapi déballée, sans `.response` ;
  // prouvé par `client.timeoutAbandon.test.js:98-113`). L'ancienne doublure
  // simulait une erreur axios brute : ce témoin était vert à tort, et l'app
  // affichait « Erreur lors de la sauvegarde » à chaque refus.
  it('un refus du serveur est DIT, pas avalé (limite de 10 alertes)', async () => {
    mockClient.post.mockRejectedValueOnce({
      details: {}, message: REFUS_DU_SERVEUR, name: 'BadRequestError', status: 400,
    });
    const tree = await monter({ filtres: { city: MONTRIVAGE, radius: 20 } });

    await appuyerSur(tree, 'Créer l\'alerte');

    expect(mockRetour.showBanner).toHaveBeenCalledWith(expect.objectContaining({
      body: 'Tu as déjà 10 alertes : supprimes-en une dans Mes alertes.',
      title: 'L\'alerte n\'a pas été créée.',
      tone: 'error',
    }));
    expect(texteVisible(tree)).not.toContain('Alerte créée');
  });

  it('un visiteur sans compte ne la voit pas (une alerte appartient à un compte)', async () => {
    const tree = await monter({ auth: VISITEUR, filtres: { city: MONTRIVAGE } });
    expect(texteVisible(tree)).not.toContain('Me prévenir');
  });

  it('l annuaire du site ne la montre pas', async () => {
    const tree = await monter({ annuaire: true, filtres: { city: MONTRIVAGE } });
    expect(texteVisible(tree)).not.toContain('Me prévenir');
  });
});

describe('A20.2 — la PREMIÈRE ouverture propose de créer son alerte, une fois par compte', () => {
  it('première ouverture : la proposition s affiche', async () => {
    const tree = await monter();
    expect(texteVisible(tree)).toContain('Ne rate plus aucun événement');
    expect(texteVisible(tree)).toContain('Créer mon alerte');
  });

  it('deuxième ouverture, MÊME compte : plus rien', async () => {
    const premier = await monter();
    expect(texteVisible(premier)).toContain('Ne rate plus aucun événement');
    await demonter(premier);

    const second = await monter();
    expect(texteVisible(second)).not.toContain('Ne rate plus aucun événement');
  });

  it('un AUTRE compte sur le même téléphone la voit à son tour', async () => {
    const premier = await monter();
    await demonter(premier);

    const autre = await monter({ auth: AUTRE_COMPTE });
    expect(texteVisible(autre)).toContain('Ne rate plus aucun événement');
  });

  it('« Plus tard » la ferme, et elle ne revient pas', async () => {
    const tree = await monter();
    await appuyerSur(tree, 'Plus tard');
    expect(texteVisible(tree)).not.toContain('Ne rate plus aucun événement');
    await demonter(tree);

    const encore = await monter();
    expect(texteVisible(encore)).not.toContain('Ne rate plus aucun événement');
  });

  it('« Créer mon alerte » AVEC ville : l alerte part, une fois la feuille partie', async () => {
    const tree = await monter({ filtres: { activity: ['a-hand'], city: MONTRIVAGE, radius: 30 } });

    await appuyerSur(tree, 'Créer mon alerte');

    expect(texteVisible(tree)).not.toContain('Ne rate plus aucun événement');
    expect(mockClient.post).toHaveBeenCalledWith('/search-alerts', expect.objectContaining({
      data: expect.objectContaining({
        filters: expect.objectContaining({ activity: ['a-hand'], city: MONTRIVAGE, radius: 30 }),
        type: 'event',
      }),
    }));
  });

  it('« Créer mon alerte » SANS ville : la proposition part, PUIS les filtres', async () => {
    const tree = await monter();

    await appuyerSur(tree, 'Créer mon alerte');

    const texte = texteVisible(tree);
    expect(texte).not.toContain('Ne rate plus aucun événement');
    expect(texte).toContain('Créer cette alerte');
    expect(texte).toContain('Choisis une ville, puis touche « Créer cette alerte ».');
    expect(mockClient.post).not.toHaveBeenCalled();
  });

  it('un visiteur sans compte n a pas de proposition (rien à retenir)', async () => {
    const tree = await monter({ auth: VISITEUR });
    expect(texteVisible(tree)).not.toContain('Ne rate plus aucun événement');
  });
});

describe('A20.3 — un guide pour créer une alerte, accessible à chaque fois', () => {
  beforeEach(() => { propositionDejaVue('u-1'); });

  it('« Comment ça marche ? » sous les résultats ouvre le guide en 3 étapes', async () => {
    const tree = await monter({ filtres: { city: MONTRIVAGE } });
    expect(texteVisible(tree)).not.toContain('Comment créer une alerte ?');

    await appuyerSur(tree, 'Comment ça marche ?');

    const texte = texteVisible(tree);
    expect(texte).toContain('Comment créer une alerte ?');
    expect(texte).toContain('Choisis tes critères');
    expect(texte).toContain('Touche « Créer l\'alerte »');
    expect(texte).toContain('Reçois une notification');
  });

  it('il se ferme et se rouvre autant de fois qu on veut', async () => {
    const tree = await monter();

    await appuyerSur(tree, 'Comment ça marche ?');
    await appuyerSur(tree, 'J\'ai compris');
    expect(texteVisible(tree)).not.toContain('Choisis tes critères');

    await appuyerSur(tree, 'Comment ça marche ?');
    expect(texteVisible(tree)).toContain('Choisis tes critères');
  });

  it('la proposition de première ouverture montre les mêmes étapes, sur place', async () => {
    mockMemoire.clear();
    const tree = await monter();
    expect(texteVisible(tree)).toContain('Ne rate plus aucun événement');

    const lienDeLaProposition = tree.root.findAll(
      (/** @type {any} */ n) => typeof n.props?.onPress === 'function'
        && n.props?.accessibilityLabel === 'Voir comment créer une alerte',
      { deep: true },
    );
    expect(lienDeLaProposition.length).toBeGreaterThan(0);
    await act(async () => { lienDeLaProposition[0].props.onPress(); });

    expect(texteVisible(tree)).toContain('Choisis tes critères');
    expect(texteVisible(tree)).toContain('Ne rate plus aucun événement');
  });
});

describe('A20.4 — l étoile en haut à droite des filtres', () => {
  beforeEach(() => { propositionDejaVue('u-1'); });

  it('la feuille « Filtrer » porte le bouton d alerte, sur la ligne du titre, à droite', async () => {
    const tree = await monter();
    await ouvrirLesFiltres(tree);

    const etoile = parEtiquette(tree, 'Créer une alerte avec ces filtres');
    expect(etoile).toBeDefined();
    expect(etoile.findAll((n) => n.props && n.props.name === 'bell').length).toBeGreaterThan(0);
    // Même rangée que le titre, et APRÈS lui. ALERTES-ANNONCES : l'étoile est
    // devenue un composant partagé (`EtoileAlerte`), son parent direct est ce
    // composant : on remonte jusqu'au premier ancêtre qui porte le titre.
    let rangee = etoile.parent;
    while (rangee && !texteDuNoeud(rangee).includes('Filtrer')) rangee = rangee.parent;
    const texteDeLaRangee = texteDuNoeud(rangee);
    expect(texteDeLaRangee.indexOf('Filtrer')).toBe(0);
    expect(texteDeLaRangee.replace(/\s/g, ' ').indexOf('Créer alerte')).toBeGreaterThan(0);
  });

  it('l étoile crée l alerte avec les filtres EN COURS de réglage (POST)', async () => {
    const tree = await monter({ filtres: { activity: ['a-foot'], city: MONTRIVAGE, radius: 20 } });
    await ouvrirLesFiltres(tree);

    // On change le sport DANS la feuille, sans appliquer : l'étoile prend le brouillon.
    // LISTE-ANNONCES (A09) : le sport se coche / décoche par sa LIGNE dans le choix commun.
    await ouvrirRangee(tree, 'Sport');
    await choisirLeSport(tree, 'Football');
    await choisirLeSport(tree, 'Handball');

    await act(async () => {
      await parEtiquette(tree, 'Créer une alerte avec ces filtres').props.onPress();
    });
    await laisserFiler();

    expect(mockClient.post).toHaveBeenCalledTimes(1);
    const [chemin, corps] = mockClient.post.mock.calls[0];
    expect(chemin).toBe('/search-alerts');
    expect(corps.data).toEqual({
      filters: {
        activity: ['a-hand'],
        category: [],
        city: MONTRIVAGE,
        geohash: 'gh(43.29,5.37,20)',
        level: [],
        radius: 20,
        type: [],
      },
      isActive: true,
      label: 'Handball · Montrivage',
      type: 'event',
    });
    // La feuille reste ouverte et dit que c'est fait.
    expect(texteVisible(tree)).toContain('Voir les résultats');
    expect(texteVisible(tree)).toContain('Alerte créée');
  });

  it('sans ville, l étoile ne part PAS au serveur : elle dit quoi faire', async () => {
    const tree = await monter({ filtres: { activity: ['a-foot'] } });
    await ouvrirLesFiltres(tree);

    await act(async () => {
      await parEtiquette(tree, 'Créer une alerte avec ces filtres').props.onPress();
    });
    await laisserFiler();

    expect(mockClient.post).not.toHaveBeenCalled();
    expect(texteVisible(tree)).toContain("Choisis une ville, puis touche « Créer l'alerte ».");
  });

  it('un nom déjà pris reçoit un numéro (les alertes existantes sont lues d abord)', async () => {
    mockClient.get.mockResolvedValue({ data: { data: [{ label: 'Football · Montrivage' }] } });
    const tree = await monter({ filtres: { activity: ['a-foot'], city: MONTRIVAGE, radius: 20 } });
    await ouvrirLesFiltres(tree);

    await act(async () => {
      await parEtiquette(tree, 'Créer une alerte avec ces filtres').props.onPress();
    });
    await laisserFiler();

    expect(mockClient.get).toHaveBeenCalledWith('/search-alerts');
    expect(mockClient.post.mock.calls[0][1].data.label).toBe('Football · Montrivage (2)');
  });
});

// PAR-L10 (12/10, recette parent PAR-013) — « Erreur lors de la sauvegarde », et
// rien d'autre : l'alerte d'un parent ne partait pas (403 du rôle), et l'app ne
// disait pas pourquoi. Deux défauts, deux blocs :
//   · la RAISON du refus, lue dans la forme que rejette vraiment le client HTTP
//     (la charge Strapi déballée, ou une chaîne nue sans réseau) ;
//   · la feuille ouverte POUR une alerte (E22) : « Créer cette alerte » crée, le
//     succès n'est dit qu'après l'enregistrement, l'échec garde les critères.

const REFUS_DE_DROIT = Object.freeze({
  details: {}, message: 'Forbidden', name: 'ForbiddenError', status: 403,
});

/**
 * Une promesse qu'on tient en main : on la résout quand on veut.
 * @returns {{ promesse: Promise<any>, resoudre: (valeur: any) => void }} La promesse et sa clef.
 */
const differe = () => {
  let resoudre = (/** @type {any} */ valeur) => valeur;
  const promesse = new Promise((ok) => { resoudre = ok; });
  return { promesse, resoudre };
};

/**
 * Le premier élément pressable qui porte exactement ce libellé, sans appuyer.
 * @param {any} tree L'arbre.
 * @param {string} libelle Le texte.
 * @returns {any} L'élément, ou undefined.
 */
const boutonDeLibelle = (tree, libelle) => tree.root.findAll(
  (/** @type {any} */ node) => (
    typeof node.props?.onPress === 'function' && texteDuNoeud(node).trim() === libelle
  ),
  { deep: true },
)[0];

/**
 * Choisit la ville dans la rangée Ville (déjà dépliée en mode création).
 * @param {any} tree L'arbre.
 * @param {{ label: string, value: string }} ville La ville.
 */
const choisirLaVille = async (tree, ville) => {
  const champ = tree.root.findAll((/** @type {any} */ n) => n.props?.testID === 'adresse')[0];
  await act(async () => { champ.props.setAddress(ville); });
};

/**
 * Ouvre la feuille en mode création, par le bouton de la carte, sans ville.
 * @returns {Promise<any>} L'arbre.
 */
const ouvrirLaFeuilleDeCreation = async () => {
  const tree = await monter({ filtres: { activity: ['a-foot'] } });
  await appuyerSur(tree, 'Choisir une ville');
  return tree;
};

const appelsFiltres = () => mockDispatch.mock.calls
  .map(([action]) => action)
  .filter((action) => action?.type === 'SET_EVENT_FILTERS');

describe('PAR-L10 — la raison d un refus, lue dans la VRAIE forme de l erreur', () => {
  beforeEach(() => { propositionDejaVue('u-1'); });

  /**
   * Crée l'alerte depuis la carte (ville déjà choisie) contre ce refus.
   * @param {any} refus Ce que le client HTTP rejette.
   * @returns {Promise<any>} L'arbre.
   */
  const creerContre = async (refus) => {
    mockClient.post.mockRejectedValueOnce(refus);
    const tree = await monter({ filtres: { city: MONTRIVAGE, radius: 20 } });
    await appuyerSur(tree, 'Créer l\'alerte');
    return tree;
  };

  it('refus de droit (403, rôle Parent avant le 12/10) : « pas encore »', async () => {
    const tree = await creerContre(REFUS_DE_DROIT);

    expect(mockRetour.showBanner).toHaveBeenCalledWith(expect.objectContaining({
      body: 'Ton compte ne peut pas encore créer d\'alerte.',
      title: 'L\'alerte n\'a pas été créée.',
      tone: 'error',
    }));
    expect(texteVisible(tree)).not.toContain('Alerte créée');
  });

  it('pas de réseau (le client rejette une chaîne nue) : « Pas de connexion. »', async () => {
    await creerContre('Network Error');

    expect(mockRetour.showBanner).toHaveBeenCalledWith(expect.objectContaining({
      body: 'Pas de connexion.',
      tone: 'error',
    }));
  });

  it('délai dépassé : l alerte a pu partir, on dit de regarder avant de réessayer', async () => {
    await creerContre({
      code: 'REQUEST_TIMEOUT_ABANDONED',
      message: 'Request timeout - please retry.',
      name: 'RequestTimeoutAbandonError',
      status: 0,
    });

    expect(mockRetour.showBanner).toHaveBeenCalledWith(expect.objectContaining({
      body: 'Le serveur met du temps à répondre : regarde dans Mes alertes avant de réessayer.',
      tone: 'error',
    }));
  });

  it('un autre refus que le serveur explique (400) : sa phrase, telle quelle', async () => {
    await creerContre({
      details: {},
      message: 'La ville est obligatoire pour une alerte.',
      name: 'BadRequestError',
      status: 400,
    });

    expect(mockRetour.showBanner).toHaveBeenCalledWith(expect.objectContaining({
      body: 'La ville est obligatoire pour une alerte.',
      tone: 'error',
    }));
  });

  it('une panne sans explication (500) : jamais le texte technique du serveur', async () => {
    await creerContre({
      details: {}, message: 'Internal Server Error', name: 'InternalServerError', status: 500,
    });

    expect(mockRetour.showBanner).toHaveBeenCalledWith(expect.objectContaining({
      body: 'Réessaie dans un instant.',
      tone: 'error',
    }));
  });

  it('la feuille « Filtrer » (étoile) dit aussi pourquoi, sous son titre', async () => {
    mockClient.post.mockRejectedValueOnce(REFUS_DE_DROIT);
    const tree = await monter({ filtres: { city: MONTRIVAGE, radius: 20 } });
    await ouvrirLesFiltres(tree);

    await act(async () => {
      await parEtiquette(tree, 'Créer une alerte avec ces filtres').props.onPress();
    });
    await laisserFiler();

    const texte = texteVisible(tree);
    expect(texte).toContain('L\'alerte n\'a pas été créée.');
    expect(texte).toContain('Ton compte ne peut pas encore créer d\'alerte.');
  });
});

describe('PAR-L10 — E22 : la feuille ouverte pour créer une alerte', () => {
  beforeEach(() => { propositionDejaVue('u-1'); });

  // Pied : « Créer cette alerte » + « Voir les résultats sans créer d'alerte ».
  it('titre « Créer une alerte », les deux boutons du pied, sans étoile', async () => {
    const tree = await ouvrirLaFeuilleDeCreation();

    const texte = texteVisible(tree);
    expect(texte).toContain('Créer une alerte');
    expect(texte).not.toContain('Filtrer');
    expect(boutonDeLibelle(tree, 'Créer cette alerte')).toBeDefined();
    expect(boutonDeLibelle(tree, 'Voir les résultats sans créer d\'alerte')).toBeDefined();
    // Deux boutons pour un même geste, c'est un de trop : l'étoile disparaît ici.
    expect(parEtiquette(tree, 'Créer une alerte avec ces filtres')).toBeUndefined();
    expect(texte).not.toContain('Réinitialiser');
  });

  it('« Créer cette alerte » ENREGISTRE, puis annonce, applique et ferme', async () => {
    const tree = await ouvrirLaFeuilleDeCreation();
    await choisirLaVille(tree, MONTRIVAGE);

    await appuyerSur(tree, 'Créer cette alerte');

    expect(mockClient.post).toHaveBeenCalledTimes(1);
    expect(mockClient.post.mock.calls[0][1].data).toEqual(expect.objectContaining({
      filters: expect.objectContaining({ activity: ['a-foot'], city: MONTRIVAGE, radius: 20 }),
      type: 'event',
    }));
    expect(mockRetour.showBanner).toHaveBeenCalledWith(expect.objectContaining({
      actionLabel: 'Gérer mes alertes',
      title: 'Alerte créée',
      tone: 'success',
    }));
    expect(appelsFiltres()).toEqual([
      expect.objectContaining({ payload: expect.objectContaining({ city: MONTRIVAGE }) }),
    ]);
    expect(boutonDeLibelle(tree, 'Créer cette alerte')).toBeUndefined();
  });

  it('succès dit APRÈS l enregistrement ; un 2e appui pendant l envoi ne crée rien', async () => {
    const envoi = differe();
    mockClient.post.mockReturnValueOnce(envoi.promesse);
    const tree = await ouvrirLaFeuilleDeCreation();
    await choisirLaVille(tree, MONTRIVAGE);

    await act(async () => { boutonDeLibelle(tree, 'Créer cette alerte').props.onPress(); });
    await laisserFiler();

    expect(mockClient.post).toHaveBeenCalledTimes(1);
    expect(mockRetour.showBanner).not.toHaveBeenCalled();
    expect(texteVisible(tree)).not.toContain('Alerte créée');
    const occupe = boutonDeLibelle(tree, 'Créer cette alerte');
    expect(occupe.props.accessibilityState).toEqual(expect.objectContaining({ busy: true }));

    await act(async () => { occupe.props.onPress(); });
    await laisserFiler();
    expect(mockClient.post).toHaveBeenCalledTimes(1);

    await act(async () => { envoi.resoudre({ data: { data: { documentId: 'al-1' } } }); });
    await laisserFiler();
    expect(mockRetour.showBanner).toHaveBeenCalledTimes(1);
    expect(mockRetour.showBanner).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Alerte créée',
    }));
  });

  it('échec : feuille et critères restent, la raison est dite, « Réessayer »', async () => {
    mockClient.post.mockRejectedValueOnce(REFUS_DE_DROIT);
    const tree = await ouvrirLaFeuilleDeCreation();
    await choisirLaVille(tree, MONTRIVAGE);

    await appuyerSur(tree, 'Créer cette alerte');

    const texte = texteVisible(tree);
    expect(texte).toContain('L\'alerte n\'a pas été créée.');
    expect(texte).toContain('Ton compte ne peut pas encore créer d\'alerte.');
    expect(texte).toContain('Montrivage · 20 km');
    expect(texte).not.toContain('Alerte créée');
    expect(appelsFiltres()).toEqual([]);

    await appuyerSur(tree, 'Réessayer');

    expect(mockClient.post).toHaveBeenCalledTimes(2);
    expect(mockClient.post.mock.calls[1][1].data.filters.city).toEqual(MONTRIVAGE);
    expect(mockRetour.showBanner).toHaveBeenLastCalledWith(expect.objectContaining({
      title: 'Alerte créée',
    }));
  });

  it('après la feuille, la carte dit « Alerte créée » : pas de deuxième création', async () => {
    // La recherche prend VRAIMENT les critères rangés (le contexte suit le dispatch).
    mockDispatch.mockImplementation((/** @type {any} */ action) => {
      if (action?.type !== 'SET_EVENT_FILTERS') return;
      mockContexte.valeur = [{ eventFilters: action.payload, searchMapSessions: {} }, mockDispatch];
    });
    try {
      const tree = await ouvrirLaFeuilleDeCreation();
      await choisirLaVille(tree, MONTRIVAGE);

      await appuyerSur(tree, 'Créer cette alerte');

      const texte = texteVisible(tree);
      expect(texte).toContain('Alerte créée');
      expect(boutonDeLibelle(tree, 'Créer l\'alerte')).toBeUndefined();
      expect(mockClient.post).toHaveBeenCalledTimes(1);
    } finally {
      mockDispatch.mockReset();
    }
  });

  it('« Voir les résultats sans créer d alerte » applique les critères, AUCUN appel', async () => {
    const tree = await ouvrirLaFeuilleDeCreation();
    await choisirLaVille(tree, MONTRIVAGE);

    await appuyerSur(tree, 'Voir les résultats sans créer d\'alerte');

    expect(mockClient.post).not.toHaveBeenCalled();
    expect(appelsFiltres()).toEqual([
      expect.objectContaining({ payload: expect.objectContaining({ city: MONTRIVAGE }) }),
    ]);
    expect(boutonDeLibelle(tree, 'Créer cette alerte')).toBeUndefined();
  });

  it('hors de ce mode, la feuille « Filtrer » ne change pas', async () => {
    const tree = await monter();
    await ouvrirLesFiltres(tree);

    const texte = texteVisible(tree);
    expect(texte).toContain('Filtrer');
    expect(boutonDeLibelle(tree, 'Voir les résultats')).toBeDefined();
    expect(boutonDeLibelle(tree, 'Réinitialiser')).toBeDefined();
    expect(parEtiquette(tree, 'Créer une alerte avec ces filtres')).toBeDefined();
    expect(texte).not.toContain('Créer cette alerte');
  });
});
