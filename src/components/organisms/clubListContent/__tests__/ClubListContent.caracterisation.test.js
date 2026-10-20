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
    default: (/** @type {any} */ { href, item, onPress }) => (
      <Text
        onPress={onPress}
        testID={`carte-${item?.documentId || ''}`}
        // L adresse de la fiche n est posee que si la liste en donne une.
        // eslint-disable-next-line react/jsx-props-no-spreading
        {...(href ? { accessibilityHint: href } : {})}
      >
        {`carte:${item?.name || ''}`}
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

// D6 — decision d'Adel du 25/09 (« D6 B ») : le sport et la ville se voient sans ouvrir la feuille.
// ANNUAIRE-E1 (maquette validee le 29/09) : la ligne-resume « Football · Lyon · 10 km » est devenue
// DEUX pastilles, qui ouvrent chacune leur choix en un geste (PastillesFiltresClub, et ses libelles
// sont verrouilles par PastillesFiltresClub.test.js). Le bouton filtre du champ, lui, reste.
describe('D6 / ANNUAIRE-E1 — le sport et le lieu en deux pastilles sous le champ', () => {
  const pastilles = () => monte.root.findByType('PastillesFiltresClub');
  const feuille = () => monte.root.findByType('ClubFiltersSheet');

  test('✅ les pastilles lisent les filtres de la recherche', async () => {
    mockEtat.filtres = { activity: 'sport-foot', city: { label: 'Lyon', value: '4.83|45.76' }, radius: 10 };

    await monter();

    expect(pastilles().props.filters).toEqual(expect.objectContaining({
      activity: 'sport-foot', city: { label: 'Lyon', value: '4.83|45.76' }, radius: 10,
    }));
  });

  test('✅ un choix fait dans une pastille est appliqué tout de suite à la recherche', async () => {
    await monter();

    await act(async () => { pastilles().props.onApply({ activity: 'sport-basket' }); });

    expect(mockDispatch).toHaveBeenCalledWith({
      payload: { activity: 'sport-basket' }, type: 'SET_CLUB_FILTERS',
    });
  });

  test('📌 plus de ligne-resume ; le bouton filtre du champ ouvre toujours la feuille', async () => {
    await monter();
    expect(monte.root.findAllByProps({ testID: 'club-filtres-resume' })).toHaveLength(0);
    expect(feuille().props.isVisible).toBe(false);

    await act(async () => { mockChamp.props.openFilters(); });

    expect(feuille().props.isVisible).toBe(true);
  });
});

// ANNUAIRE-E1 (29/09) — sur l'annuaire du site (`annuaire`), la liste defile AVEC la page : les
// cartes sont posees a plat, la page suivante se demande au bouton « Voir plus », et chaque carte
// est un lien vers sa fiche publique. Sans le drapeau, rien ne change (temoins ci-dessus).
describe('ANNUAIRE-E1 — la liste de l annuaire du site', () => {
  const SMUC = { documentId: 'abc', name: 'Stade Marseillais UC' };
  const boutonVoirPlus = () => monte.root.findAll(
    (noeud) => noeud.props?.accessibilityRole === 'button'
      && typeof noeud.props?.onPress === 'function'
      && noeud.findAll((enfant) => enfant.props?.children === 'Voir plus').length > 0,
  );

  test('✅ les cartes sont posees a plat : aucune liste virtualisee', async () => {
    mockEtat.pagesListe = { pages: [{ data: [club('Olympique'), club('Racing')] }] };

    await monter({ annuaire: true });

    expect(mockListe.props).toBeNull();
    expect(texteRendu()).toContain('carte:Olympique');
    expect(texteRendu()).toContain('carte:Racing');
  });

  test('✅ chaque carte recoit l adresse de sa fiche publique', async () => {
    mockEtat.pagesListe = { pages: [{ data: [SMUC] }] };

    await monter({ annuaire: true });

    expect(monte.root.findByProps({ testID: 'carte-abc' }).props.accessibilityHint)
      .toBe('/annuaire/clubs/abc/stade-marseillais-uc/');
  });

  test('✅ « Voir plus » demande la page suivante, et elle seule', async () => {
    mockEtat.pagesListe = { pages: [{ data: [club('Olympique')] }] };

    await monter({ annuaire: true });
    expect(mockPageSuivanteListe).not.toHaveBeenCalled();
    expect(boutonVoirPlus().length).toBeGreaterThan(0);

    await act(async () => { boutonVoirPlus()[0].props.onPress(); });

    expect(mockPageSuivanteListe).toHaveBeenCalledTimes(1);
  });

  test('📌 sans le drapeau, pas de lien sur la carte (le telephone ne change pas)', async () => {
    mockEtat.pagesListe = { pages: [{ data: [SMUC] }] };

    await monter();

    expect(monte.root.findByProps({ testID: 'carte-abc' }).props.accessibilityHint).toBeUndefined();
  });
});

// RECHERCHE-UNIQUE (phase 3, decision d Adel « Q2 = B ») — un departement ou une region choisi : la
// liste lit l ANNUAIRE (le meme compte que le titre de la page), pas la table des clubs.
describe('RECHERCHE-UNIQUE — un departement dans le champ Lieu', () => {
  const BOUCHES = {
    label: 'Bouches-du-Rhône (département)',
    nom: 'Bouches-du-Rhône',
    slug: 'bouches-du-rhone',
    territoire: 'departement',
    value: 'departement:bouches-du-rhone',
  };

  test('✅ la liste lit l annuaire du departement, pour le sport choisi', async () => {
    mockEtat.filtres = { activity: 'sport-foot', city: BOUCHES };
    mockEtat.pagesTerritoire = {
      pages: [{
        items: [{ documentId: 'c-13', name: 'Club des Bouches' }],
        pagination: { page: 1, pageCount: 1, total: 1 },
      }],
    };

    await monter();

    expect(mockEtat.territoireDemande).toEqual({
      department: 'bouches-du-rhone', q: undefined, region: undefined, sport: 'football',
    });
    expect(texteRendu()).toContain('carte:Club des Bouches');
    // ANNUAIRE-E1 : le lieu se lit dans la pastille Lieu (« Bouches-du-Rhône ▾ »).
    expect(monte.root.findByType('PastillesFiltresClub').props.filters.city).toEqual(BOUCHES);
  });

  test('✅ le nom tape cherche DANS le departement (q), pas dans la France entiere', async () => {
    mockEtat.filtres = { activity: 'sport-foot', city: BOUCHES };
    mockEtat.recherche = 'stade';

    await monter();

    expect(mockEtat.territoireDemande.q).toBe('stade');
    expect(texteRendu()).not.toContain('Trie par pertinence');
  });

  test('📌 une region part en « region », jamais en « department »', async () => {
    mockEtat.filtres = {
      activity: 'sport-foot',
      city: {
        ...BOUCHES,
        nom: 'Provence',
        slug: 'provence-alpes-cote-d-azur',
        territoire: 'region',
      },
    };

    await monter();

    expect(mockEtat.territoireDemande.region).toBe('provence-alpes-cote-d-azur');
    expect(mockEtat.territoireDemande.department).toBeUndefined();
  });
});

// 👶 PAR-L4 (13/10, recette PAR-009) — « Chercher un club pour Anissa » : l'enfant venu de SA fiche
// voyage jusqu'a la fiche club (son identifiant seul ; son prenom se relit la-bas).
describe('PAR-L4 — la carte ouvre la fiche club avec l enfant vise', () => {
  const SMUC = { documentId: 'abc', name: 'Stade Marseillais UC' };
  const { navigateToStackScreenOrScreen } = jest.requireMock('@/navigation/navigationAvailability');

  test('📌 la recherche ordinaire ouvre la fiche avec le seul club', async () => {
    mockEtat.pagesListe = { pages: [{ data: [SMUC] }] };
    await monter();

    await act(async () => { monte.root.findByProps({ testID: 'carte-abc' }).props.onPress(); });

    expect(navigateToStackScreenOrScreen).toHaveBeenLastCalledWith(expect.anything(), {
      params: { clubId: 'abc' },
      screen: 'Club',
      stack: 'ClubStack',
    });
  });

  test('✅ venue de la fiche d Anissa, la carte emmene childDocumentId', async () => {
    mockEtat.pagesListe = { pages: [{ data: [SMUC] }] };
    await monter({ childDocumentId: 'c-anissa' });

    await act(async () => { monte.root.findByProps({ testID: 'carte-abc' }).props.onPress(); });

    expect(navigateToStackScreenOrScreen).toHaveBeenLastCalledWith(expect.anything(), {
      params: { childDocumentId: 'c-anissa', clubId: 'abc' },
      screen: 'Club',
      stack: 'ClubStack',
    });
  });
});

// 🏛️ R17-INVITER (19/10, REC17-009) — la Ville cherche un club dans la recherche HABITUELLE et,
// sur la carte, « Ce club fait partie de ma collectivité ». La liste ne connaît pas la Ville :
// elle rend l'action que l'écran de la Ville lui donne (`actionDeCarte`), sous la carte de chaque
// club, et ouvre la fiche avec les paramètres qu'il lui donne (`paramsDeFiche`). Sans eux, rien
// ne change.
describe('R17-INVITER — l action de carte, que seule la Ville pose', () => {
  const { Text: TexteRN } = jest.requireActual('react-native');
  const { navigateToStackScreenOrScreen } = jest.requireMock('@/navigation/navigationAvailability');
  const OLYMPIQUE = club('Olympique');
  const RACING = club('Racing');
  const VILLE = { collectiviteId: 'ville-de-recette' };
  const actionDeCarte = (/** @type {any} */ c) => (
    <TexteRN testID={`action-${c.documentId}`}>{`action:${c.name}`}</TexteRN>
  );
  const appuyerSurRacing = async () => {
    const carte = monte.root.findByProps({ testID: 'carte-club-Racing' });
    await act(async () => { carte.props.onPress(); });
  };
  const actionDe = (/** @type {string} */ id) => monte.root.findByProps({ testID: `action-${id}` });

  test('📌 sans action (joueur, dirigeant) : rien sous les cartes, fiche du seul club', async () => {
    mockEtat.pagesListe = { pages: [{ data: [OLYMPIQUE, RACING] }] };
    await monter();

    expect(texteRendu()).not.toContain('action:');
    await appuyerSurRacing();
    expect(navigateToStackScreenOrScreen).toHaveBeenLastCalledWith(expect.anything(), {
      params: { clubId: 'club-Racing' },
      screen: 'Club',
      stack: 'ClubStack',
    });
  });

  test('✅ la Ville : CHAQUE club a SON action sous sa carte ; la fiche avec la Ville', async () => {
    mockEtat.pagesListe = { pages: [{ data: [OLYMPIQUE, RACING] }] };
    await monter({ actionDeCarte, paramsDeFiche: VILLE });

    expect(actionDe('club-Olympique').props.children).toBe('action:Olympique');
    expect(actionDe('club-Racing').props.children).toBe('action:Racing');
    await appuyerSurRacing();
    expect(navigateToStackScreenOrScreen).toHaveBeenLastCalledWith(expect.anything(), {
      params: { clubId: 'club-Racing', ...VILLE },
      screen: 'Club',
      stack: 'ClubStack',
    });
  });

  test('✅ la Ville ne crée pas de club : la liste vide sans « Créer un club »', async () => {
    mockEtat.pagesListe = { pages: [{ data: [] }] };
    await monter();
    expect(mockListe.props.ListEmptyComponent().props.onAction).toEqual(expect.any(Function));

    await monter({ actionDeCarte, paramsDeFiche: VILLE });
    expect(mockListe.props.ListEmptyComponent().props.onAction).toBeUndefined();
  });
});

// INVPAD (20/10/2026) — Adel, « Ajouter un club » sur le site, grand ecran : une colonne etroite,
// une seule carte et son bouton coupe. La Ville demande ses cartes sur DEUX colonnes ; la liste ne
// les pose que sur le SITE, a partir de 1 024 px (la meme borne que l annuaire). Les autres ecrans
// (recherche, accueil, hub) ne le demandent pas : rien ne change pour eux, ni sur le telephone.
describe('INVPAD — deux colonnes sur le site ordinateur, pour qui les demande', () => {
  const { Platform, StyleSheet } = jest.requireActual('react-native');
  const osDOrigine = Platform.OS;
  const CLUBS = [club('Olympique'), club('Racing'), club('Stade')];
  const actionDeCarte = (/** @type {any} */ c) => {
    const { Text: TexteRN } = jest.requireActual('react-native');
    return <TexteRN testID={`action-${c.documentId}`}>{`action:${c.name}`}</TexteRN>;
  };
  // La case d une carte : l ancetre le plus proche qui porte une largeur.
  const caseDe = (/** @type {string} */ testID) => {
    let noeud = monte.root.findByProps({ testID }).parent;
    const sansLargeur = (/** @type {any} */ n) => (
      StyleSheet.flatten(n.props?.style || {})?.width === undefined
    );
    while (noeud && sansLargeur(noeud)) noeud = noeud.parent;
    return noeud ? StyleSheet.flatten(noeud.props.style) : null;
  };
  const surLeSite = (/** @type {number} */ largeur) => {
    Platform.OS = 'web';
    mockFenetre.width = largeur;
  };

  afterEach(() => {
    Platform.OS = osDOrigine;
    mockFenetre.width = 750;
  });

  test('✅ site, 1 360 px, demandées : deux colonnes, chaque carte sa moitié', async () => {
    surLeSite(1360);
    mockEtat.pagesListe = { pages: [{ data: CLUBS }] };
    await monter({ actionDeCarte, surDeuxColonnes: true });

    expect(mockListe.props.numColumns).toBe(2);
    const gauche = { paddingLeft: 0, paddingRight: 6, width: '50%' };
    expect(caseDe('carte-club-Olympique')).toEqual(gauche);
    expect(caseDe('carte-club-Racing')).toEqual({ paddingLeft: 6, paddingRight: 0, width: '50%' });
    // La 3e, seule sur sa rangee, garde la meme largeur que les autres ; l action est dans la case.
    expect(caseDe('carte-club-Stade')).toEqual(gauche);
    expect(caseDe('action-club-Racing')).toEqual(caseDe('carte-club-Racing'));
  });

  test('📌 site, 1 360 px, NON demandées (recherche, accueil, hub) : une colonne', async () => {
    surLeSite(1360);
    mockEtat.pagesListe = { pages: [{ data: CLUBS }] };
    await monter({ actionDeCarte });

    expect(mockListe.props.numColumns ?? 1).toBe(1);
    expect(caseDe('carte-club-Olympique')).toBeNull();
  });

  test('📌 site, 390 px, demandées : une colonne', async () => {
    surLeSite(390);
    mockEtat.pagesListe = { pages: [{ data: CLUBS }] };
    await monter({ actionDeCarte, surDeuxColonnes: true });

    expect(mockListe.props.numColumns ?? 1).toBe(1);
    expect(caseDe('carte-club-Olympique')).toBeNull();
  });

  test('📌 telephone (meme une tablette de 1 366 px), demandées : une colonne', async () => {
    mockFenetre.width = 1366;
    mockEtat.pagesListe = { pages: [{ data: CLUBS }] };
    await monter({ actionDeCarte, surDeuxColonnes: true });

    expect(mockListe.props.numColumns ?? 1).toBe(1);
    expect(caseDe('carte-club-Olympique')).toBeNull();
  });
});
