import { InteractionManager } from 'react-native';
import renderer, { act } from 'react-test-renderer';

// CORR-RESA (71 A) — la lecture des réservations « à la une » n'est ouverte qu'au SuperAdmin
// (aucune carte de rôle ne la donne) : un Entraineur ou un Dirigeant ne la demande plus (403 en
// fond). Mêmes doublures que ReservationListContent.PETITSBUGS3.test.js ; le rôle varie.

/** @type {string} */
let mockRole = 'player';
const mockAppelsALaUne = /** @type {any[]} */ ([]);

// Style du thème : n'importe quelle clé, à n'importe quelle profondeur.
const mockStyle = () => new Proxy({}, {
  get: (_cible, cle) => (cle === 'then' ? undefined : mockStyle()),
});

jest.mock('@react-navigation/native', () => ({ useNavigation: () => ({ navigate: jest.fn() }) }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (/** @type {string} */ cle, /** @type {any} */ defaut, /** @type {any} */ options) => {
      const texte = typeof defaut === 'string' ? defaut : cle;
      return texte.replace(/{{(\w+)}}/g, (_c, nom) => String(options?.[nom] ?? ''));
    },
  }),
}));
jest.mock('@tanstack/react-query', () => ({
  useMutation: () => ({ isPending: false, mutate: jest.fn(), mutateAsync: jest.fn() }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
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
jest.mock('@/theme/themeContext', () => ({ __esModule: true, default: () => mockStyle() }));
jest.mock('@/theme/scaling', () => ({ horizontalScale: (/** @type {number} */ valeur) => valeur }));
jest.mock('@/domains/auth/useAuth', () => ({
  __esModule: true,
  default: () => ({ userData: { role: { name: mockRole } } }),
}));
jest.mock('@/store/appContext', () => ({
  useAppContext: () => ([{ reservationFilters: {} }, jest.fn()]),
}));
jest.mock('@/navigation/useBottomDockLayout', () => ({
  __esModule: true,
  default: () => ({ floatingActionBottomOffset: 0, sceneBottomInset: 0 }),
}));
jest.mock('@/services/reservation/reservationQueries', () => {
  const vide = () => ({
    data: undefined,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    refetch: jest.fn(),
  });
  return {
    useGetFeaturedReservations: (/** @type {number} */ taille, /** @type {any} */ options) => {
      mockAppelsALaUne.push(options);
      return vide();
    },
    useGetReservations: vide,
  };
});
jest.mock('@/services/reservation/reservationService', () => ({ joinReservation: jest.fn() }));
jest.mock('@/services/search/searchQueries', () => ({
  useSearchReservations: () => ({
    data: undefined,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
}));
jest.mock('@/services/search/searchService', () => ({
  getMatchReasonLabel: () => '',
  mapSearchPayload: (/** @type {any} */ page) => page,
}));
jest.mock('@/utils/performance/searchPerformance', () => ({ markSearchPerf: jest.fn() }));
jest.mock('@/components/molecules/eventCard/EventCardNew', () => {
  const { Text } = jest.requireActual('react-native');
  return function CarteDoublure({ item }) {
    return <Text>{`carte:${item.name}`}</Text>;
  };
});
jest.mock('@/components/molecules/withDataWrapper/WithDataWrapper', () => (
  (/** @type {any} */ { children }) => children));
jest.mock('@/components/atoms/searchMapFab/SearchMapFab', () => 'SearchMapFab');
jest.mock('@/components/molecules/dateSlider/DateSlider', () => 'DateSlider');
jest.mock(
  '@/components/organisms/filtersSheet/ReservationFiltersSheet',
  () => 'ReservationFiltersSheet',
);
jest.mock('@/components/organisms/joinEventModal/JoinEventModal', () => 'JoinEventModal');
jest.mock('@/components/organisms/searchComponent/searchComponent', () => 'SearchComponent');

const ReservationListContent = require('../ReservationListContent').default;

/** @type {any} */
let monte = null;
let espion = /** @type {any} */ (null);
beforeEach(() => {
  mockAppelsALaUne.length = 0;
  // « Après les interactions » tout de suite : l'écran ouvre alors la lecture à la une.
  espion = jest.spyOn(InteractionManager, 'runAfterInteractions')
    .mockImplementation((/** @type {any} */ tache) => {
      if (typeof tache === 'function') tache();
      return /** @type {any} */ ({ cancel: () => {}, done: () => {}, then: () => {} });
    });
});
afterEach(() => {
  if (monte) act(() => { monte.unmount(); });
  monte = null;
  espion.mockRestore();
});
const monter = async () => {
  await act(async () => { monte = renderer.create(<ReservationListContent showFilters />); });
  await act(async () => { await Promise.resolve(); });
};
const ouvertes = () => mockAppelsALaUne.filter((options) => options?.enabled === true);

describe('CORR-RESA (71 A) — la lecture « à la une » réservée au SuperAdmin', () => {
  test('Entraineur : useGetFeaturedReservations toujours appelé avec enabled false', async () => {
    mockRole = 'Entraineur';
    await monter();
    expect(mockAppelsALaUne.length).toBeGreaterThan(0);
    expect(ouvertes()).toHaveLength(0);
  });

  test('Dirigeant : useGetFeaturedReservations toujours appelé avec enabled false', async () => {
    mockRole = 'Dirigeant';
    await monter();
    expect(mockAppelsALaUne.length).toBeGreaterThan(0);
    expect(ouvertes()).toHaveLength(0);
  });

  test('SuperAdmin : la lecture s’ouvre (enabled true) après les interactions', async () => {
    mockRole = 'SuperAdmin';
    await monter();
    expect(ouvertes().length).toBeGreaterThan(0);
  });
});
