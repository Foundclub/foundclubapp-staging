import renderer, { act } from 'react-test-renderer';

// Q2-05 / Q2-19 (BUGHUNT P2, 25/10) — UNE LISTE SANS FILTRES (fiche d'équipe, AdminEvents).
// Q2-05 : après « Voir la liste » depuis la carte, la fiche ne montrait plus que la zone de la carte.
// Q2-19 : toucher une date du curseur modifiait en cachette les filtres de la recherche d'événements,
// et la liste de la fiche, elle, ne changeait pas.
// Doublures reprises de EventListContent.anonyme.test.js.

/** @type {{ getEvents: any, carte: any }} */
const mockCapteur = { carte: null, getEvents: null };
const mockDispatch = jest.fn();
const mockEtat = {
  eventFilters: { activity: 'sport-foot' },
  searchMapSessions: {
    events: {
      executedQuery: { view: 'list' },
      searchedViewport: {
        east: 2.5, north: 48.9, south: 48.8, west: 2.2,
      },
    },
  },
};

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
  useQueryClient: () => ({
    cancelQueries: jest.fn(() => Promise.resolve()),
    invalidateQueries: jest.fn(),
    prefetchInfiniteQuery: jest.fn(() => Promise.resolve()),
    setQueryData: jest.fn(),
  }),
}));

jest.mock('@shopify/flash-list', () => {
  const { View } = jest.requireActual('react-native');
  // L en-tete (curseur de dates compris) est rendu : c est lui qu on touche.
  return { FlashList: (/** @type {any} */ { ListHeaderComponent }) => <View>{ListHeaderComponent}</View> };
});

jest.mock('@/components/molecules/eventCard/EventCardNew', () => 'EventCardNew');

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    canEditClub: () => false,
    canEditEvent: () => false,
    canManageEvent: () => false,
    isAuthenticated: true,
    userData: { documentId: 'user-1' },
  }),
}));

jest.mock('@/store/appContext', () => ({
  useAppContext: () => ([mockEtat, mockDispatch]),
}));

jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => ({ dockHeight: 0 }),
}));

jest.mock('@/navigation/public/publicAuthNavigation', () => ({ openPublicAuthFlow: jest.fn() }));

jest.mock('@/services/event/eventQueries', () => ({
  getEventsQueryKey: () => ['events'],
  useGetEvents: (/** @type {any} */ params, /** @type {any} */ options) => {
    // La liste principale (15 par page), pas les événements « à la une » (5).
    if (params?.pageSize === 15) mockCapteur.getEvents = { options, params };
    return {
      data: undefined,
      fetchNextPage: jest.fn(),
      hasNextPage: false,
      isFetching: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: jest.fn(),
    };
  },
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
  useSearchEvents: () => ({ data: undefined, isFetching: false, isLoading: false }),
  useSearchEventsMap: (/** @type {any} */ params, /** @type {any} */ options) => {
    mockCapteur.carte = { options, params };
    return { data: undefined, isFetching: false, isLoading: false };
  },
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
  mockDispatch.mockReset();
});

const monter = () => {
  act(() => {
    monte = renderer.create(<EventListContent additionalFilters={{ teamIds: ['team-1'] }} showFilters={false} />);
  });
};

test('Q2-05 — la fiche d équipe montre tous ses événements, pas la zone de la carte', () => {
  monter();

  expect(mockCapteur.getEvents.options.enabled).toBe(true);
  expect(mockCapteur.carte.options.enabled).toBe(false);
});

test('Q2-19 — toucher une date du curseur ne touche pas aux filtres de la recherche', () => {
  monter();
  const [curseur] = monte.root.findAllByType('DateSlider');
  act(() => { curseur.props.onDateSelected(new Date(2030, 4, 20, 15, 0)); });

  expect(mockDispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'SET_EVENT_FILTERS' }));
});

test('Q2-19 — et la liste de la fiche suit la date touchée', () => {
  monter();
  const [curseur] = monte.root.findAllByType('DateSlider');
  act(() => { curseur.props.onDateSelected(new Date(2030, 4, 20, 15, 0)); });

  expect(mockCapteur.getEvents.params.startDateAfter).toBe(new Date(2030, 4, 20).toISOString());
  expect(mockCapteur.getEvents.params.teamIds).toEqual(['team-1']);
});

test('CONTRÔLE — avec les filtres (onglet Événements), la date reste celle de la recherche', () => {
  act(() => {
    monte = renderer.create(<EventListContent showFilters />);
  });
  const [curseur] = monte.root.findAllByType('DateSlider');
  act(() => { curseur.props.onDateSelected(new Date(2030, 4, 20, 15, 0)); });

  expect(mockDispatch).toHaveBeenCalledWith({
    payload: { activity: 'sport-foot', startDateAfter: new Date(2030, 4, 20).toISOString() },
    type: 'SET_EVENT_FILTERS',
  });
});
