import { buildEventMapViewportQuery } from '@/views/search/SearchMapScreen';

// BUGHUNT C02 (25/10/2026) — P14-08 : la carte des événements partait des filtres bruts, sans les
// deux règles de la liste (`eventConfig`) : les réservations et les séances fermées apparaissaient
// sur la carte. Témoin de la requête de la carte (l'écran entier ne se monte pas sous jest).

jest.mock('@/domains/auth/useAuth', () => () => ({}));
jest.mock('@/domains/places/usePlaces', () => () => ({}));
jest.mock('@/store/appContext', () => ({ useAppContext: () => ({}) }));
jest.mock(
  '@/components/organisms/autocompleteAddressInput/autocompleteAddressInput',
  () => () => null,
);
jest.mock('@/components/organisms/searchMap/SearchMap', () => () => null);
jest.mock('@/components/atoms/glassSurface/GlassSurface', () => () => null);
jest.mock('@/components/templates/ScreenContainer', () => () => null);
jest.mock('@/services/event/eventQueries', () => ({}));
jest.mock('@/services/reservation/reservationQueries', () => ({}));
jest.mock('@/services/search/searchQueries', () => ({}));
jest.mock('@/services/search/searchService', () => ({}));
jest.mock('@/platform/maps/searchMapDetailNavigation', () => ({}));

const PARIS = {
  east: 2.45, lat: 48.85, lng: 2.35, north: 48.9, south: 48.8, west: 2.25, zoom: 12,
};

describe('P14-08 — carte des événements : ni réservations ni séances fermées', () => {
  it('sans filtre, la requête exclut les réservations et ne garde que les séances ouvertes', () => {
    const requete = buildEventMapViewportQuery({}, PARIS, 'map');
    expect(requete).toEqual(expect.objectContaining({
      excludeType: 'Réservation', sessionStatus: 'open',
    }));
  });
});
