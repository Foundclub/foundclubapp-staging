import renderer, { act } from 'react-test-renderer';

// Lot R9 (vague R du 24/08) — « PARTICIPER » DEPUIS UNE CARTE, SUR UNE DETECTION.
//
// 🧨 LE CONSTAT DE RECETTE : repondre « participer » depuis la CARTE ne propose
// jamais l ecran de candidature aux postes. A la place, l app cree une
// participation GENERIQUE sans poste — et cette participation VERROUILLE
// ensuite la candidature aux postes (`alreadyHandled` dans `participationFlow`).
//
// 🕳️ LA VRAIE CAUSE, mesuree : `handleJoinEvent`, vingt lignes plus haut DANS LE
// MEME FICHIER, sait deja quoi faire — il aiguille vers l ecran de l evenement.
// `handleParticipateToEvent`, lui, n avait pas cette branche. Ce filet monte
// donc le composant pour de vrai et appuie sur le bouton de la carte : c est le
// seul moyen de prouver qu une branche est ATTEIGNABLE.
//
// 📌 Ce fichier est le PREMIER filet de `EventListContent.js` (1 497 lignes,
// aucun test jusqu ici). Le temoin 17 decrit le comportement des AUTRES types
// d evenement tel qu il est aujourd hui, pour qu on voie tout de suite si un lot
// futur le deplace.

const mockNavigate = jest.fn();
const mockCreerParticipation = jest.fn(() => Promise.resolve({}));
const mockRepondrePresent = jest.fn(() => Promise.resolve({}));

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
    navigate: mockNavigate,
    setOptions: jest.fn(),
  }),
}));

// 🔌 Les mutations executent VRAIMENT leur `mutationFn` : c est ce qui permet
// d observer le service reellement appele — ou de prouver qu il ne l est pas.
jest.mock('@tanstack/react-query', () => ({
  useMutation: (/** @type {any} */ options) => ({
    isPending: false,
    mutate: (/** @type {any} */ variables) => options?.mutationFn?.(variables),
    mutateAsync: (/** @type {any} */ variables) => Promise.resolve(
      options?.mutationFn?.(variables),
    ),
  }),
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
    setQueryData: jest.fn(),
  }),
}));

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

// 📸 LE CAPTEUR : la carte est doublee pour recuperer `onParticipate`. On appuie
// ensuite dessus comme le doigt d Adel le ferait a l ecran.
jest.mock('@/components/molecules/eventCard/EventCardNew', () => {
  const { View } = jest.requireActual('react-native');
  const capteur = jest.requireActual('@/testSupport/r9CapteurCarte').capteurCarte;
  return {
    __esModule: true,
    default: (/** @type {any} */ props) => {
      capteur.props = props;
      return <View testID="carte-evenement" />;
    },
  };
});

jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({
    canEditClub: () => false,
    canEditEvent: () => false,
    canManageEvent: () => false,
    isAuthenticated: true,
    userData: { documentId: 'user-1', role: { name: 'Joueur' } },
  }),
}));

jest.mock('@/store/appContext', () => ({
  // Le contexte rend un TABLEAU [etat, dispatch], pas un objet.
  useAppContext: () => ([{ eventFilters: {}, searchMapSessions: {} }, jest.fn()]),
}));

jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => ({ dockHeight: 0 }),
}));

jest.mock('@/navigation/public/publicAuthNavigation', () => ({
  openPublicAuthFlow: jest.fn(),
}));

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
  respondToEventRsvp: (/** @type {any} */ payload) => mockRepondrePresent(payload),
}));

jest.mock('@/services/eventParticipation/eventParticipationService', () => ({
  createEventParticipation: (/** @type {any} */ payload) => mockCreerParticipation(payload),
}));

jest.mock('@/services/reservation/reservationService', () => ({
  joinReservation: jest.fn(() => Promise.resolve({})),
}));

jest.mock('@/services/search/searchQueries', () => ({
  useSearchEvents: () => ({ data: undefined, isFetching: false, isLoading: false }),
  useSearchEventsMap: () => ({ data: undefined, isFetching: false, isLoading: false }),
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

const { capteurCarte } = jest.requireActual('@/testSupport/r9CapteurCarte');

const EventListContent = require('../EventListContent').default;

const DETECTION = {
  date: '2099-01-01T10:00:00.000Z',
  documentId: 'detection-1',
  name: 'Detection gardiens',
  participationRequests: [],
  participations: [],
  type: { name: 'Détection' },
};

/** @type {any} */
let monte = null;

const demonter = () => {
  if (!monte) return;
  act(() => { monte.unmount(); });
  monte = null;
};

/**
 * Monte la liste avec UN evenement et rend les props captees de sa carte.
 * @param {any} evenement - l evenement a poser dans la liste
 * @returns {any} les props de la carte
 */
const monterAvec = (evenement) => {
  demonter();
  mockNavigate.mockClear();
  mockCreerParticipation.mockClear();
  mockRepondrePresent.mockClear();
  capteurCarte.props = null;

  act(() => {
    monte = renderer.create(<EventListContent events={[evenement]} isLoading={false} />);
  });

  return capteurCarte.props;
};

afterEach(() => {
  demonter();
});

describe('R9 - repondre « Participer » sur la carte d une DETECTION', () => {
  test('R9 · temoin 15 — l appui ouvre l ecran ou vivent les postes', async () => {
    const carte = monterAvec(DETECTION);

    await act(async () => { await carte.onParticipate(); });

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(mockNavigate.mock.calls[0])).toContain('detection-1');
  });

  test('R9 · temoin 16 — et surtout : AUCUNE participation sans poste n est creee', async () => {
    // 🔒 Le temoin qui porte tout le defaut. Une participation generique
    // verrouille ensuite la candidature aux postes : la creer, c est refermer la
    // porte que ce lot vient d ouvrir.
    const carte = monterAvec(DETECTION);

    await act(async () => { await carte.onParticipate(); });

    expect(mockCreerParticipation).not.toHaveBeenCalled();
  });

  test('R9 · temoin 17 — un MATCH ouvert cree toujours sa participation, comme avant', async () => {
    // 🔒 La borne du lot : seule la detection change de chemin.
    const carte = monterAvec({ ...DETECTION, type: { name: 'Match' } });

    await act(async () => { await carte.onParticipate(); });

    expect(mockCreerParticipation).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
