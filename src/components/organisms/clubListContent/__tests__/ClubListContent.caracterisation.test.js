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

const rendreDeNouveau = async () => {
  await act(async () => { monte.update(<ClubListContent />); });
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

describe('HAUT — la liste remonte au 1er resultat quand la recherche change', () => {
  // 🎯 LE CONSTAT D ADEL (26/08) : « il m arrive de taper quelque chose et ce que
  // je vois en premier c est le 6e meilleur resultat — il faut que je remonte a
  // la main pour voir les premiers ». La liste garde la position de defilement
  // de la recherche PRECEDENTE alors que les resultats, eux, ont change.

  test('temoin 6 — une nouvelle recherche demande la remontee, une seule fois', async () => {
    mockEtat.pagesPertinence = { pages: [{ data: [club('Avant')] }] };
    mockEtat.recherche = 'av';
    await monter();
    // Le passage de montage ne compte pas : la liste est deja en haut.
    mockListe.poignee.scrollToOffset.mockClear();

    mockEtat.pagesPertinence = { pages: [{ data: [club('Apres')] }] };
    await chercher('paris');

    expect(mockListe.poignee.scrollToOffset).toHaveBeenCalledTimes(1);
    expect(mockListe.poignee.scrollToOffset).toHaveBeenCalledWith({
      animated: false,
      offset: 0,
    });
  });

  test('temoin 7 — deux recherches successives : une remontee par recherche', async () => {
    mockEtat.pagesPertinence = { pages: [{ data: [club('Un')] }] };
    mockEtat.recherche = 'un';
    await monter();
    mockListe.poignee.scrollToOffset.mockClear();

    mockEtat.pagesPertinence = { pages: [{ data: [club('Deux')] }] };
    await chercher('deux');
    expect(mockListe.poignee.scrollToOffset).toHaveBeenCalledTimes(1);

    mockEtat.pagesPertinence = { pages: [{ data: [club('Trois')] }] };
    await chercher('trois');
    expect(mockListe.poignee.scrollToOffset).toHaveBeenCalledTimes(2);
  });

  test('temoin 8 — un re-rendu SANS changement de recherche ne remonte rien', async () => {
    // 🔒 La borne du lot : on remonte quand la REQUETE change, pas a chaque rendu.
    // C est aussi ce qui protege le retour d onglet : la position est gardee.
    mockEtat.pagesPertinence = { pages: [{ data: [club('Stable')] }] };
    mockEtat.recherche = 'st';
    await monter();
    mockListe.poignee.scrollToOffset.mockClear();

    await rendreDeNouveau();
    await rendreDeNouveau();

    expect(mockListe.poignee.scrollToOffset).not.toHaveBeenCalled();
  });

  test('temoin 9 (D3) — sans poignee de defilement, rien ne plante', async () => {
    // 🛟 Le repli honnete : la reference peut manquer au premier rendu, et le web
    // n a pas la meme implementation. Motif deja en service dans le depot
    // (VenueProposalModal.js:255, Conversation.js:4480).
    mockListe.poignee = {};
    mockEtat.pagesPertinence = { pages: [{ data: [club('SansPoignee')] }] };
    mockEtat.recherche = 'sa';
    await monter();

    mockEtat.pagesPertinence = { pages: [{ data: [club('Autre')] }] };
    await expect(chercher('autre')).resolves.toBeUndefined();

    expect(texteRendu()).toContain('carte:Autre');
  });
});

describe('HAUT / D2 — la remontee ne doit RIEN faire a la pagination', () => {
  // 🧨 LE PIEGE DEJA PAYE : flash-list v2 relache son verrou de pagination des
  // que l IDENTITE de `data` change. Une liste vide a deja relance sa pagination
  // en boucle sur 3 pages entieres. Ces temoins gardent les trois voies par
  // lesquelles un lot futur pourrait rouvrir ce trou.

  test('temoin 10 — l arrivee de la page 2 ne demande AUCUNE remontee', async () => {
    // 🔒 Le defaut qui serait PIRE que celui d Adel : remonter quand la page
    // suivante arrive ramenerait l utilisateur en haut pendant qu il defile.
    mockEtat.pagesPertinence = { pages: [{ data: [club('Page1')] }] };
    mockEtat.recherche = 'pa';
    await monter();
    mockListe.poignee.scrollToOffset.mockClear();

    mockEtat.pagesPertinence = {
      pages: [{ data: [club('Page1')] }, { data: [club('Page2')] }],
    };
    await rendreDeNouveau();

    expect(mockListe.props.data).toHaveLength(2);
    expect(mockListe.poignee.scrollToOffset).not.toHaveBeenCalled();
  });

  test('temoin 11 — une nouvelle recherche ne REMONTE pas le composant de liste', async () => {
    // 🔒 Le detecteur de `key` neuve : une `key` qui change demonterait la liste
    // et flash-list repartirait de zero (pagination comprise).
    mockEtat.pagesPertinence = { pages: [{ data: [club('Un')] }] };
    mockEtat.recherche = 'un';
    await monter();
    expect(mockListe.montages).toBe(1);

    mockEtat.pagesPertinence = { pages: [{ data: [club('Deux')] }] };
    await chercher('deux');

    expect(mockListe.montages).toBe(1);
  });

  test('temoin 12 — a resultats inchanges, `data` garde la MEME identite', async () => {
    // 🔒 Le detecteur de tableau recree a chaque rendu : c est cette identite
    // qui tient le verrou de pagination de flash-list.
    mockEtat.pagesPertinence = { pages: [{ data: [club('Stable')] }] };
    mockEtat.recherche = 'st';
    await monter();
    const avant = mockListe.props.data;

    await rendreDeNouveau();

    expect(mockListe.props.data).toBe(avant);
  });

  test('temoin 13 — une nouvelle recherche ne demande aucune page', async () => {
    mockEtat.pagesPertinence = { pages: [{ data: [club('Un')] }] };
    mockEtat.recherche = 'un';
    await monter();
    await act(async () => { mockListe.props.onEndReached(); });
    expect(mockPageSuivantePertinence).toHaveBeenCalledTimes(1);

    mockEtat.pagesPertinence = { pages: [{ data: [club('Deux')] }] };
    await chercher('deux');

    expect(mockPageSuivantePertinence).toHaveBeenCalledTimes(1);
  });
});
