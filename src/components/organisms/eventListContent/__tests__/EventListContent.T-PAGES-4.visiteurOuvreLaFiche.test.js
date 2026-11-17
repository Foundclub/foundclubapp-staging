import renderer, { act } from 'react-test-renderer';

// T-PAGES-4 (17/11, défaut 2 de la recette 44, iPhone, sans compte) — Recherche › Événements :
// toucher la carte « TEST — FoundClub x AR Soccer » ne faisait RIEN. La liste naviguait vers
// `EventStack`, absente de la pile publique ; la fiche du tournoi (`EventDetails`, celle qui porte
// « Se connecter pour s'inscrire ») y est un écran direct.

const mockNavigate = jest.fn();
/** @type {{ carte: any, recherche: any }} */
const mockOptions = { carte: null, recherche: null };

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

// La pile PUBLIQUE d'un visiteur (PublicMainNavigator) : `EventDetails` y est un écran direct,
// `EventStack` n'existe pas.
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    addListener: () => () => {},
    getParent: () => undefined,
    getState: () => ({ routeNames: ['PublicTabs', 'EventFilters', 'EventDetails'] }),
    navigate: mockNavigate,
    setOptions: jest.fn(),
  }),
}));

jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn(), mutateAsync: jest.fn() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn(), setQueryData: jest.fn() }),
}));

// La liste rend chaque carte (la vraie liste virtualise ; ici, toutes).
jest.mock('@shopify/flash-list', () => {
  const { View } = jest.requireActual('react-native');
  return {
    FlashList: (/** @type {any} */ { data, renderItem }) => (
      <View>
        {(data || []).map((/** @type {any} */ item, /** @type {number} */ index) => (
          <View key={item?.documentId || index}>{renderItem({ index, item })}</View>
        ))}
      </View>
    ),
  };
});

jest.mock('@/components/molecules/eventCard/EventCardNew', () => 'EventCardNew');

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
    return { data: undefined, isFetching: false, isLoading: false };
  },
  useSearchEventsMap: (/** @type {any} */ params, /** @type {any} */ options) => {
    mockOptions.carte = { options, params };
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
  mockNavigate.mockClear();
});

const TOURNOI = {
  date: '2099-12-19T18:00:00.000Z',
  documentId: 'tournoi-1912',
  name: 'TEST — FoundClub x AR Soccer',
  tournamentConfig: { maxTeams: 24 },
  type: { name: 'Tournoi' },
};

describe('EventListContent — T-PAGES-4, le visiteur ouvre la fiche du tournoi', () => {
  test('🔴 sans compte, toucher la carte ouvre la fiche publique (EventDetails), pas EventStack', () => {
    act(() => {
      monte = renderer.create(<EventListContent events={[TOURNOI]} />);
    });
    const [carte] = monte.root.findAll((/** @type {any} */ node) => node.type === 'EventCardNew');
    expect(carte).toBeTruthy();
    act(() => {
      carte.props.onPress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('EventDetails', { eventId: 'tournoi-1912' });
    expect(mockNavigate).not.toHaveBeenCalledWith('EventStack', expect.anything());
  });
});
