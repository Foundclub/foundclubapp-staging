import renderer, { act } from 'react-test-renderer';

// PETITSBUGS-3 (rejeu 4, suite de R4-91) : Rechercher › Réservation, chaque carte
// d'une recherche portait « Tri pertinence: Correspondance exacte du nom ».
// Retiré de l'affichage ; l'ordre du serveur ne change pas. Écran sans test :
// le témoin décrit ce qu'il montrait déjà (une carte par réservation, dans l'ordre).

/** @type {any} */
let mockPages;

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
    FlashList: (/** @type {any} */ { data, ListHeaderComponent, renderItem }) => (
      <View>
        {typeof ListHeaderComponent === 'function' ? <ListHeaderComponent /> : ListHeaderComponent}
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
  default: () => ({ userData: { role: { name: 'player' } } }),
}));
jest.mock('@/store/appContext', () => ({
  useAppContext: () => ([{ reservationFilters: { q: 'padel' } }, jest.fn()]),
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
  return { useGetFeaturedReservations: vide, useGetReservations: vide };
});
jest.mock('@/services/reservation/reservationService', () => ({ joinReservation: jest.fn() }));
jest.mock('@/services/search/searchQueries', () => ({
  useSearchReservations: () => ({
    data: mockPages,
    fetchNextPage: jest.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isLoading: false,
    refetch: jest.fn(),
  }),
}));
jest.mock('@/services/search/searchService', () => ({
  getMatchReasonLabel: (/** @type {any} */ raison) => (
    raison === 'exact_name' ? 'Correspondance exacte du nom' : ''),
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

const reservation = (/** @type {string} */ nom) => ({
  __search: { matchReasons: ['exact_name'] },
  date: '2099-06-01T10:00:00.000Z',
  documentId: `resa-${nom}`,
  name: nom,
});

/** @type {any} */
let monte = null;
afterEach(() => {
  if (monte) act(() => { monte.unmount(); });
  monte = null;
});
const monter = () => {
  act(() => { monte = renderer.create(<ReservationListContent showFilters />); });
};
const texteRendu = () => JSON.stringify(monte.toJSON());

describe('PETITSBUGS-3 — la carte de réservation ne montre plus la raison du tri', () => {
  test('recherche « padel » : aucun « Tri pertinence » au-dessus des cartes', () => {
    mockPages = { pages: [[reservation('Padel B'), reservation('Padel A')]] };
    monter();

    expect(texteRendu()).toContain('carte:Padel B');
    expect(texteRendu()).not.toContain('Tri pertinence');
  });

  test('témoin : une carte par réservation, dans l’ordre du serveur', () => {
    mockPages = { pages: [[reservation('Padel B'), reservation('Padel A')]] };
    monter();

    const lu = texteRendu();
    expect(lu.indexOf('carte:Padel B')).toBeGreaterThan(-1);
    expect(lu.indexOf('carte:Padel B')).toBeLessThan(lu.indexOf('carte:Padel A'));
  });
});

// CORR-RECHERCHE point 2 (recette du site, 30/10, décision A) — sur le site, /search/reservations
// monte cette liste sous l'en-tête de la recherche : il défile désormais AVEC elle.
describe('CORR-RECHERCHE point 2 — l en-tete de la recherche defile avec la liste', () => {
  const { Text } = jest.requireActual('react-native');
  const moduleEnTete = jest.requireActual('@/views/search/components/enTeteDeRecherche');
  const { EnTeteDeRechercheContext } = moduleEnTete;

  test('🔴 l en-tete de la recherche est pose en tete de la liste, avant les cartes', () => {
    mockPages = { pages: [[reservation('Padel B')]] };
    const reclamer = jest.fn(() => () => {});
    act(() => {
      monte = renderer.create(
        <EnTeteDeRechercheContext.Provider value={{ enTete: <Text>temoin-entete-recherche</Text>, reclamer }}>
          <ReservationListContent showFilters />
        </EnTeteDeRechercheContext.Provider>,
      );
    });

    const lu = texteRendu();
    expect(lu).toContain('temoin-entete-recherche');
    expect(lu.indexOf('temoin-entete-recherche')).toBeLessThan(lu.indexOf('carte:Padel B'));
    expect(reclamer).toHaveBeenCalled();
  });
});
