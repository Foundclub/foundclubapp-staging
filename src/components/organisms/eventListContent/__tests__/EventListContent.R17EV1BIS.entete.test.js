import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// 🏛️ R17-EVT-1-BIS (g) (20/10/2026, tri du chef) — LA LISTE D'ÉVÉNEMENTS PREND UN EN-TÊTE.
//
// La bande « Événements de la Ville » (RechercheVille) se pose en tete de la liste de la
// recherche : au-dessus de « Événements à partir de », et elle defile avec la liste (sur le
// telephone, l ecran de recherche est SearchHubScreen, ou la bande ne paraissait jamais).
// `entete` est facultatif : sans lui, la liste ne change pas. Doublures reprises de
// EventListContent.anonyme.test.js ; la liste doublee rend son en-tete.
// ROUGE avant (la prop etait ignoree).

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

// La liste doublee rend son en-tete (c est lui qu on regarde).
jest.mock('@shopify/flash-list', () => {
  const { View } = jest.requireActual('react-native');
  return {
    FlashList: (/** @type {any} */ { ListHeaderComponent }) => <View>{ListHeaderComponent}</View>,
  };
});

jest.mock('@/components/molecules/eventCard/EventCardNew', () => 'EventCardNew');

// Le compte est sans importance ici (la liste est la meme).
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

const monter = (/** @type {any} */ entete) => {
  act(() => {
    monte = renderer.create(<EventListContent entete={entete} showFilters />);
  });
};

const textes = () => monte.root.findAllByType(Text)
  .map((/** @type {any} */ n) => String(n.props.children));

describe('EventListContent — l en-tête de la liste (R17-EVT-1-BIS)', () => {
  test('🔴 l en-tête donné passe AVANT « Événements à partir de »', () => {
    monter(<Text testID="entete-du-banc">Événements de la Ville</Text>);

    const lus = textes();
    expect(lus).toContain('Événements de la Ville');
    expect(lus.indexOf('Événements de la Ville'))
      .toBeLessThan(lus.indexOf('Événements à partir de'));
  });

  test('✅ sans en-tête, la liste reste celle d avant', () => {
    monter(undefined);

    const entetes = monte.root
      .findAll((/** @type {any} */ n) => n.props?.testID === 'entete-du-banc');
    expect(entetes).toHaveLength(0);
    expect(textes()).toContain('Événements à partir de');
  });
});

// CORR-RECHERCHE point 2 (recette du site, 30/10, décision A) — l'en-tête de la recherche (logo,
// onglets) défile avec la liste : la liste le pose en tête, AVANT sa propre bande.
describe('EventListContent — CORR-RECHERCHE point 2 : l en-tete de la recherche', () => {
  // eslint-disable-next-line global-require
  const { EnTeteDeRechercheContext } = require('@/views/search/components/enTeteDeRecherche');
  const reclamer = jest.fn(() => () => {});

  test('🔴 pose l en-tete de la recherche en tete de la liste, et le reclame', () => {
    act(() => {
      monte = renderer.create(
        <EnTeteDeRechercheContext.Provider
          value={{ enTete: <Text>temoin-entete-recherche</Text>, reclamer }}
        >
          <EventListContent entete={<Text>Événements de la Ville</Text>} showFilters />
        </EnTeteDeRechercheContext.Provider>,
      );
    });

    const lus = textes();
    expect(lus).toContain('temoin-entete-recherche');
    const placeEnTete = lus.indexOf('temoin-entete-recherche');
    expect(placeEnTete).toBeLessThan(lus.indexOf('Événements de la Ville'));
    expect(reclamer).toHaveBeenCalled();
  });
});
