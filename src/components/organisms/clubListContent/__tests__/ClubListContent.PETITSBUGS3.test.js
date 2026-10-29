import renderer, { act } from 'react-test-renderer';

// 📌 PREMIER FILET de `ClubListContent.js` (701 lignes, AUCUN temoin jusqu ici).
//
// Pose avant le lot HAUT (« la liste doit remonter au 1er resultat quand la
// recherche change »), en application de E6 : on decrit d abord ce que le
// composant fait AUJOURD HUI, pour qu un lot futur voie tout de suite s il
// deplace un comportement qu on n avait pas l intention de toucher.
//
// Ce que ce fichier verrouille :
//  1. le mode « liste par defaut » rend une carte par club ;
//  2. des 2 caracteres tapes, c est la recherche PAR PERTINENCE qui alimente
//     la liste (et son entete apparait) ;
//  3. arriver en bas demande la page suivante ;
//  4. tant que la page suivante charge, on ne la redemande pas.
//
// ⚠️ Les points 3 et 4 sont la PAGINATION : c est exactement ce que le lot HAUT
// ne doit pas casser (flash-list relache son verrou des que l identite de
// `data` change — une liste vide a deja relance sa pagination sur 3 pages).

const mockEtat = {
  /** @type {Record<string, any>} */
  filtres: {},
  pagesListe: { pages: [{ data: [] }] },
  pagesPertinence: { pages: [{ data: [] }] },
  /** @type {any} */
  pagesTerritoire: { pages: [] },
  pageSuivanteEnCours: false,
  recherche: '',
  /** @type {any} */
  territoireDemande: null,
};

const mockChamp = { props: null };
// `montages` compte les MONTAGES de la liste : c est le detecteur de `key` neuve
// (une `key` qui change remonte le composant, et flash-list repart alors de zero).
const mockListe = { montages: 0, poignee: { scrollToOffset: jest.fn() }, props: null };
const mockPageSuivanteListe = jest.fn();
const mockPageSuivantePertinence = jest.fn();
const mockRien = jest.fn();
const mockDispatch = jest.fn((/** @type {any} */ action) => {
  if (action?.type === 'SET_CLUB_FILTERS') {
    mockEtat.recherche = action?.payload?.name || '';
  }
});

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {any} */ repli) => (
      typeof repli === 'string' ? repli : key
    ),
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const genererCouleurs = jest.requireActual('@/theme/colors').default;
  const genererPolices = jest.requireActual('@/theme/fonts').default;
  const genererStyleApp = jest.requireActual('@/theme/applicationStyle').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = genererCouleurs();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: genererStyleApp(Colors),
      Colors,
      Fonts: genererPolices(Colors),
      Images: {},
      scheme: 'dark',
      Spaces,
    }),
  };
});

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    addListener: () => () => {},
    getParent: () => undefined,
    navigate: jest.fn(),
    setOptions: jest.fn(),
  }),
}));

// 🎛️ LA LISTE DOUBLEE : elle expose une poignee imperative (comme la vraie
// FlashList) et garde ses dernieres props, pour qu on puisse appuyer sur
// `onEndReached` comme le doigt d Adel le ferait en arrivant en bas.
jest.mock('@shopify/flash-list', () => {
  const React = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    FlashList: React.forwardRef((/** @type {any} */ props, /** @type {any} */ ref) => {
      mockListe.props = props;
      React.useImperativeHandle(ref, () => mockListe.poignee);
      React.useEffect(() => { mockListe.montages += 1; }, []);
      return (
        <View>
          {props.ListHeaderComponent || null}
          {(props.data || []).map((/** @type {any} */ item, /** @type {number} */ index) => (
            <View key={item?.documentId || index}>{props.renderItem({ index, item })}</View>
          ))}
        </View>
      );
    }),
  };
});

jest.mock('@/components/molecules/clubCard/ClubCard', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ {
      href, item, onPress, reasonLabel,
    }) => (
      <Text
        onPress={onPress}
        testID={`carte-${item?.documentId || ''}`}
        // L adresse de la fiche n est posee que si la liste en donne une.
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...(href ? { accessibilityHint: href } : {})}
      >
        {`carte:${item?.name || ''}${reasonLabel ? ` ${reasonLabel}` : ''}`}
      </Text>
    ),
  };
});

jest.mock('@/components/organisms/searchComponent/searchComponent', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => {
      mockChamp.props = props;
      return <View testID="champ-recherche" />;
    },
  };
});

jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: (/** @type {any} */ { children }) => <View>{children}</View>,
  };
});

jest.mock('@/components/atoms/emptyState/EmptyState', () => 'EmptyState');
jest.mock('@/components/atoms/loader/Loader', () => 'Loader');
jest.mock('@/components/atoms/searchMapFab/SearchMapFab', () => 'SearchMapFab');
jest.mock('@/components/organisms/filtersSheet/ClubFiltersSheet', () => 'ClubFiltersSheet');
jest.mock('@/components/organisms/filtersSheet/PastillesFiltresClub', () => 'PastillesFiltresClub');
jest.mock(
  '@/components/molecules/searchResultsLoadingState/SearchResultsLoadingState',
  () => 'SearchResultsLoadingState',
);

jest.mock('@/store/appContext', () => ({
  useAppContext: () => ([
    { clubFilters: { ...mockEtat.filtres, name: mockEtat.recherche }, searchMapSessions: {} },
    mockDispatch,
  ]),
}));

jest.mock('@/domains/club/useClub', () => ({
  __esModule: true,
  default: () => ({ getClubFiltersNumber: () => 0 }),
}));

// INVPAD (20/10) : la largeur de la fenetre decide des deux colonnes du site. Par defaut, celle
// du telephone de jest (750 x 1334) : les autres temoins ne voient rien changer.
const mockFenetre = {
  fontScale: 2, height: 1334, scale: 2, width: 750,
};
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => mockFenetre,
}));

jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => ({ floatingActionBottomOffset: 0, sceneBottomInset: 0 }),
}));

jest.mock('@/navigation/navigationAvailability', () => ({
  navigateToStackScreenOrScreen: jest.fn(),
}));

// RECHERCHE-UNIQUE (phase 3) : le mode « departement ou region » lit l annuaire. Double ici :
// ce fichier ne monte pas de QueryClient.
jest.mock('@/services/annuaire/annuaireQueries', () => ({
  useGetClubsDuTerritoire: (/** @type {any} */ params) => {
    mockEtat.territoireDemande = params;
    return {
      data: mockEtat.pagesTerritoire,
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetched: true,
      isFetching: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: jest.fn(),
    };
  },
}));

// D6 (25/09) : la ligne « Sport · Ville » lit la liste des sports (la meme
// requete que la feuille de filtres). Doublee ici : ce fichier ne monte pas de
// QueryClient.
jest.mock('@/services/activity/activityQueries', () => ({
  useGetActivities: () => ({ data: [{ documentId: 'sport-foot', name: 'Football' }] }),
}));

jest.mock('@/services/club/clubQueries', () => ({
  useGetClubs: () => ({
    data: mockEtat.pagesListe,
    error: undefined,
    fetchNextPage: mockPageSuivanteListe,
    hasNextPage: true,
    isFetched: true,
    isFetching: false,
    isFetchingNextPage: mockEtat.pageSuivanteEnCours,
    isLoading: false,
    refetch: mockRien,
  }),
  useGetMultisportClubs: () => ({ data: undefined, refetch: mockRien }),
}));

jest.mock('@/services/search/searchQueries', () => ({
  useSearchClubs: () => ({
    data: mockEtat.pagesPertinence,
    error: undefined,
    fetchNextPage: mockPageSuivantePertinence,
    hasNextPage: true,
    isFetched: true,
    isFetching: false,
    isFetchingNextPage: mockEtat.pageSuivanteEnCours,
    isLoading: false,
    refetch: mockRien,
  }),
  useSearchClubsMap: () => ({
    data: undefined,
    error: undefined,
    fetchNextPage: mockRien,
    hasNextPage: false,
    isFetched: true,
    isFetching: false,
    isFetchingNextPage: false,
    isLoading: false,
    refetch: mockRien,
  }),
}));

jest.mock('@/services/search/searchService', () => ({
  getMatchReasonLabel: (/** @type {any} */ raison) => (
    raison === 'exact_name' ? 'Correspondance exacte du nom' : ''),
  mapSearchPayload: (/** @type {any} */ page) => page?.data || [],
}));

jest.mock('@/services/queryOptions', () => ({ keepPreviousPageData: undefined }));
jest.mock('@/utils/performance/searchPerformance', () => ({ markSearchPerf: jest.fn() }));

const ClubListContent = require('../ClubListContent').default;

/**
 * Fabrique un club minimal tel que la liste le recoit du serveur.
 * @param {string} nom - le nom affiche sur la carte
 * @returns {any} le club
 */
const club = (nom) => ({ documentId: `club-${nom}`, name: nom });

/** @type {any} */
let monte = null;

const demonter = () => {
  if (!monte) return;
  act(() => { monte.unmount(); });
  monte = null;
};

/** @type {Record<string, any>} */
let propsMontees = {};

const monter = async (/** @type {Record<string, any>} */ props = {}) => {
  demonter();
  propsMontees = props;
  await act(async () => {
    // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
    monte = renderer.create(<ClubListContent {...props} />);
  });
};

const rendreDeNouveau = async () => {
  // eslint-disable-next-line react/jsx-props-no-spreading -- fabrique de test
  await act(async () => { monte.update(<ClubListContent {...propsMontees} />); });
};

/**
 * Tape un texte dans le champ, comme le doigt d Adel, puis laisse la liste se
 * re-rendre avec les resultats que le serveur double vient de recevoir.
 * @param {string} texte - ce qui est tape dans le champ de recherche
 * @returns {Promise<void>} rien
 */
const chercher = async (texte) => {
  act(() => { mockChamp.props.handleSearchField(texte); });
  await rendreDeNouveau();
};

const texteRendu = () => JSON.stringify(monte.toJSON());

beforeEach(() => {
  mockEtat.filtres = {};
  mockEtat.pagesTerritoire = { pages: [] };
  mockEtat.territoireDemande = null;
  mockEtat.pagesListe = { pages: [{ data: [] }] };
  mockEtat.pagesPertinence = { pages: [{ data: [] }] };
  mockEtat.pageSuivanteEnCours = false;
  mockEtat.recherche = '';
  mockChamp.props = null;
  mockListe.props = null;
  mockListe.montages = 0;
  mockListe.poignee = { scrollToOffset: jest.fn() };
  mockPageSuivanteListe.mockClear();
  mockPageSuivantePertinence.mockClear();
  mockDispatch.mockClear();
});

afterEach(() => {
  demonter();
});

// PETITSBUGS-3 (rejeu 4, R4-91) : Rechercher › Club, chaque carte portait
// « Tri pertinence: Correspondance exacte du nom ». Retiré de l'affichage ;
// l'ordre (le tri du serveur) ne change pas.
describe('PETITSBUGS-3 — la carte de club ne montre plus la raison du tri', () => {
  test('recherche par pertinence : aucun « Tri pertinence » sur les cartes', async () => {
    mockEtat.pagesPertinence = {
      pages: [{
        data: [
          { ...club('Olympique'), __search: { matchReasons: ['exact_name'] } },
          { ...club('Olympia'), __search: { matchReasons: ['exact_name'] } },
        ],
      }],
    };
    mockEtat.recherche = 'olym';

    await monter();

    expect(texteRendu()).toContain('carte:Olympique');
    expect(texteRendu()).not.toContain('Tri pertinence');
    expect(texteRendu()).not.toContain('Correspondance exacte du nom');
  });

  test('témoin : l’ordre du serveur est gardé', async () => {
    mockEtat.pagesPertinence = { pages: [{ data: [club('B'), club('A')] }] };
    mockEtat.recherche = 'ab';

    await monter();

    expect(mockListe.props.data.map((/** @type {any} */ item) => item.name)).toEqual(['B', 'A']);
  });
});
