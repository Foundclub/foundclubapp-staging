import renderer, { act } from 'react-test-renderer';

// RECHERCHE-UNIQUE (phase 2, 25/09) — L'ONGLET ÉVÉNEMENTS POUR UN VISITEUR SANS COMPTE.
//
// Décision d'Adel du 25/09 (« D4 B ») : l'annuaire du site sert l'écran de recherche de l'app,
// onglet Événements compris, et le serveur ouvre la recherche d'événements aux visiteurs sans
// compte (la vitrine seulement : détections, tournois, stages, entraînements ouverts).
//
// 🧨 Même défaut que la liste de clubs (ClubListContent.anonyme.test.js) : les crochets de
// recherche sont éteints sans session sauf `allowAnonymous` (searchQueries.js, enabledWithSession).
// Sans lui, un visiteur qui tape « tournoi » reste sur « Chargement » sans fin.
//
// Ce filet capte les options que la liste passe aux deux crochets de recherche d'événements.

/** @type {{ carte: any, recherche: any }} */
const mockOptions = { carte: null, recherche: null };
/** @type {any} */
let mockPages;

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: () => ({
    t: (/** @type {string} */ key, /** @type {any} */ fallback) => (
      typeof fallback === 'string' ? fallback : key
    ),
  }),
}));

jest.mock('@/theme/themeContext', () => {
  const generateColors = jest.requireActual('@/theme/colors').default;
  const generateFonts = jest.requireActual('@/theme/fonts').default;
  const generateApplicationStyle = jest.requireActual('@/theme/applicationStyle').default;
  const Alignments = jest.requireActual('@/theme/alignements').default;
  const Spaces = jest.requireActual('@/theme/spaces').default;
  const Colors = generateColors();
  return {
    __esModule: true,
    default: () => ({
      Alignments,
      ApplicationStyle: generateApplicationStyle(Colors),
      Colors,
      Fonts: generateFonts(Colors),
      Images: new Proxy({}, { get: () => 1 }),
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

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn(), mutateAsync: jest.fn() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn() }),
}));

jest.mock('@shopify/flash-list', () => {
  const { View } = jest.requireActual('react-native');
  return {
    FlashList: (/** @type {any} */ { data, renderItem }) => (
      <View>
        {(data || []).map((/** @type {any} */ item, /** @type {number} */ index) => (
          <View key={item.documentId}>{renderItem({ index, item })}</View>
        ))}
      </View>
    ),
  };
});

jest.mock('@/components/molecules/eventCard/EventCardNew', () => {
  const { Text } = jest.requireActual('react-native');
  return function CarteDoublure({ item }) {
    return <Text>{`carte:${item.name}`}</Text>;
  };
});

// Le visiteur n'a PAS de compte.
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    canEditClub: () => false,
    canEditEvent: () => false,
    canManageEvent: () => false,
    isAuthenticated: false,
    userData: null,
  }),
}));

// Il a tapé « tournoi » dans le champ de l'onglet Événements.
jest.mock('@/store/appContext', () => ({
  useAppContext: () => ([{ eventFilters: { q: 'tournoi' }, searchMapSessions: {} }, jest.fn()]),
}));

jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => ({ dockHeight: 0 }),
}));

jest.mock('@/navigation/public/publicAuthNavigation', () => ({ openPublicAuthFlow: jest.fn() }));

jest.mock('@/services/event/eventQueries', () => ({
  getEventsQueryKey: () => ['events'],
  useGetEvents: () => ({
    data: undefined,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetching: false,
    isFetchingNextPage: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
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

// 📸 LE CAPTEUR : les options que la liste donne aux deux crochets.
jest.mock('@/services/search/searchQueries', () => ({
  useSearchEvents: (/** @type {any} */ params, /** @type {any} */ options) => {
    mockOptions.recherche = { options, params };
    return { data: mockPages, isFetching: false, isLoading: false };
  },
  useSearchEventsMap: (/** @type {any} */ params, /** @type {any} */ options) => {
    mockOptions.carte = { options, params };
    return { data: undefined, isFetching: false, isLoading: false };
  },
}));

jest.mock('@/services/search/searchService', () => ({
  getMatchReasonLabel: (/** @type {any} */ raison) => (
    raison === 'exact_name' ? 'Correspondance exacte du nom' : ''),
  mapSearchPayload: (/** @type {any} */ payload) => payload,
}));

jest.mock('@/services/queryOptions', () => ({ keepPreviousPageData: {} }));

jest.mock('@/utils/logger/logger', () => ({
  createLogger: () => ({
    debug: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn(),
  }),
}));

jest.mock('@/utils/performance/searchPerformance', () => ({ markSearchPerf: jest.fn() }));

jest.mock('@/components/organisms/filtersSheet/EventFiltersSheet', () => 'EventFiltersSheet');
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

// ALERTES (A20) — la liste porte désormais la création d'alerte
// (`useAlerteEvenement`, qui tire le client HTTP) et la mémoire de la proposition
// de première ouverture (`useFeatureTutorial`, qui lit le stockage). Hors sujet
// ici : doublés, avec une identité fixe d'un rendu à l'autre. Leur comportement
// est prouvé par `EventListContent.ALERTES.test.js`.
const mockAlerteEvenement = {
  creer: jest.fn(),
  enCours: false,
  estDejaCreee: () => false,
  sports: [],
};
jest.mock('@/domains/searchAlert/useAlerteEvenement', () => ({
  __esModule: true,
  default: () => mockAlerteEvenement,
}));
const mockPropositionAlerte = { hasSeen: true, markSeen: jest.fn() };
jest.mock('@/components/organisms/alerteEvenements/AlerteEvenements', () => ({
  CarteMePrevenir: 'CarteMePrevenir',
  GuideAlertes: 'GuideAlertes',
  PropositionAlerte: 'PropositionAlerte',
}));
jest.mock('@/domains/tutorial/useFeatureTutorial', () => ({
  __esModule: true,
  default: () => mockPropositionAlerte,
}));

const EventListContent = require('../EventListContent').default;

/** @type {any} */
let monte = null;

afterEach(() => {
  if (monte) act(() => { monte.unmount(); });
  monte = null;
});

const monter = () => {
  act(() => {
    monte = renderer.create(<EventListContent showFilters />);
  });
};

// PETITSBUGS-3 (rejeu 4) : chaque carte d'événement d'une recherche portait,
// en dur, « Tri pertinence: Correspondance exacte du nom ». Retiré ; l'ordre
// du serveur ne change pas.
const evenement = (/** @type {string} */ nom) => ({
  __search: { matchReasons: ['exact_name'] },
  date: '2099-06-01T10:00:00.000Z',
  documentId: `evt-${nom}`,
  endDate: '2099-06-01T12:00:00.000Z',
  name: nom,
});

const texteRendu = () => JSON.stringify(monte.toJSON());

describe('PETITSBUGS-3 — la carte d’événement ne montre plus la raison du tri', () => {
  test('recherche « tournoi » : aucun « Tri pertinence » au-dessus des cartes', () => {
    mockPages = { pages: [[evenement('Tournoi B'), evenement('Tournoi A')]] };
    monter();

    expect(texteRendu()).toContain('carte:Tournoi B');
    expect(texteRendu()).not.toContain('Tri pertinence');
  });

  test('témoin : l’ordre du serveur est gardé', () => {
    mockPages = { pages: [[evenement('Tournoi B'), evenement('Tournoi A')]] };
    monter();

    const lu = texteRendu();
    expect(lu.indexOf('carte:Tournoi B')).toBeLessThan(lu.indexOf('carte:Tournoi A'));
    expect(lu.indexOf('carte:Tournoi A')).toBeGreaterThan(-1);
  });
});
