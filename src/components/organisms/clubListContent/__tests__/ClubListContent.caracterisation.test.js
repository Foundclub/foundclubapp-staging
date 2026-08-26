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
  pagesListe: { pages: [{ data: [] }] },
  pagesPertinence: { pages: [{ data: [] }] },
  pageSuivanteEnCours: false,
  recherche: '',
};

const mockChamp = { props: null };
const mockListe = { poignee: { scrollToOffset: jest.fn() }, props: null };
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
    default: (/** @type {any} */ { item }) => <Text>{`carte:${item?.name || ''}`}</Text>,
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
jest.mock(
  '@/components/molecules/searchResultsLoadingState/SearchResultsLoadingState',
  () => 'SearchResultsLoadingState',
);

jest.mock('@/store/appContext', () => ({
  useAppContext: () => ([
    { clubFilters: { name: mockEtat.recherche }, searchMapSessions: {} },
    mockDispatch,
  ]),
}));

jest.mock('@/domains/club/useClub', () => ({
  __esModule: true,
  default: () => ({ getClubFiltersNumber: () => 0 }),
}));

jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => ({ floatingActionBottomOffset: 0, sceneBottomInset: 0 }),
}));

jest.mock('@/navigation/navigationAvailability', () => ({
  navigateToStackScreenOrScreen: jest.fn(),
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
  getMatchReasonLabel: () => '',
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

const monter = async () => {
  demonter();
  await act(async () => {
    monte = renderer.create(<ClubListContent />);
  });
};

const texteRendu = () => JSON.stringify(monte.toJSON());

beforeEach(() => {
  mockEtat.pagesListe = { pages: [{ data: [] }] };
  mockEtat.pagesPertinence = { pages: [{ data: [] }] };
  mockEtat.pageSuivanteEnCours = false;
  mockEtat.recherche = '';
  mockChamp.props = null;
  mockListe.props = null;
  mockListe.poignee = { scrollToOffset: jest.fn() };
  mockPageSuivanteListe.mockClear();
  mockPageSuivantePertinence.mockClear();
  mockDispatch.mockClear();
});

afterEach(() => {
  demonter();
});

describe('ClubListContent — filet de caracterisation (etat au 2026-08-26)', () => {
  test('temoin 1 — sans recherche, la liste rend une carte par club du catalogue', async () => {
    mockEtat.pagesListe = { pages: [{ data: [club('Olympique'), club('Racing')] }] };

    await monter();

    expect(texteRendu()).toContain('carte:Olympique');
    expect(texteRendu()).toContain('carte:Racing');
    expect(mockListe.props.data).toHaveLength(2);
  });

  test('temoin 2 — des 2 caracteres, c est la recherche par pertinence qui alimente', async () => {
    mockEtat.pagesListe = { pages: [{ data: [club('Catalogue')] }] };
    mockEtat.pagesPertinence = { pages: [{ data: [club('Pertinent')] }] };
    mockEtat.recherche = 'ol';

    await monter();

    expect(texteRendu()).toContain('carte:Pertinent');
    expect(texteRendu()).not.toContain('carte:Catalogue');
    expect(texteRendu()).toContain('Trie par pertinence');
  });

  test('temoin 3 — arriver en bas de la liste demande la page suivante', async () => {
    mockEtat.pagesListe = { pages: [{ data: [club('Olympique')] }] };

    await monter();
    await act(async () => { mockListe.props.onEndReached(); });

    expect(mockPageSuivanteListe).toHaveBeenCalledTimes(1);
  });

  test('temoin 4 — tant que la page suivante charge, on ne la redemande pas', async () => {
    // 🔒 Le garde-fou de la pagination : c est lui qui empeche la liste de
    // derouler la table entiere si un lot futur fait bouger l identite de `data`.
    mockEtat.pagesListe = { pages: [{ data: [club('Olympique')] }] };
    mockEtat.pageSuivanteEnCours = true;

    await monter();
    await act(async () => { mockListe.props.onEndReached(); });

    expect(mockPageSuivanteListe).not.toHaveBeenCalled();
  });

  test('temoin 5 — taper dans le champ ecrit le filtre de nom dans le contexte', async () => {
    await monter();

    act(() => { mockChamp.props.handleSearchField('paris'); });

    expect(mockDispatch).toHaveBeenCalledTimes(1);
    expect(mockDispatch.mock.calls[0][0].type).toBe('SET_CLUB_FILTERS');
    expect(mockDispatch.mock.calls[0][0].payload.name).toBe('paris');
  });
});
