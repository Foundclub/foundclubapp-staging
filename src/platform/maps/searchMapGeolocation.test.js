import {
  canUseSearchMapGeolocation,
  requestCurrentSearchMapLocation,
} from './searchMapGeolocation';

// D23 — défaut ④ : « le bouton autour de moi ne marche pas ».
//
// LA MESURE QUI TRANCHE, et elle ne concerne pas la permission : ce module lit
// `navigator.geolocation`. Sur natif, React Native 0.78 ne le définit PAS —
// `Libraries/Core/setUpNavigator.js` pose seulement `{ product: 'ReactNative' }`,
// `setUpGeolocation.js` n'existe plus, `react-native/index.js` n'exporte aucun
// `Geolocation`, et aucun paquet de géolocalisation n'est installé.
// `requestCurrentSearchMapLocation()` rend donc TOUJOURS `null` sur l'appareil,
// avant même qu'il soit question d'autoriser quoi que ce soit.
//
// Ces tests figent le contrat pour que l'écran puisse le DIRE plutôt que de
// rester inerte, et pour qu'un jour où la dépendance sera ajoutée, le passage
// au vert se voie.

const originalNavigator = global.navigator;

const setNavigator = (value) => {
  Object.defineProperty(global, 'navigator', {
    configurable: true,
    value,
    writable: true,
  });
};

afterEach(() => {
  setNavigator(originalNavigator);
});

describe('searchMapGeolocation — disponibilité de l`API (D23 ④)', () => {
  it('sans `navigator.geolocation`, l`API est déclarée indisponible', () => {
    setNavigator({ product: 'ReactNative' });

    expect(canUseSearchMapGeolocation()).toBe(false);
  });

  it('avec `navigator.geolocation`, elle est disponible', () => {
    setNavigator({ geolocation: { getCurrentPosition: () => {} } });

    expect(canUseSearchMapGeolocation()).toBe(true);
  });

  it('API absente : la demande de position rend `null`, sans lever', async () => {
    setNavigator({ product: 'ReactNative' });

    await expect(requestCurrentSearchMapLocation()).resolves.toBeNull();
  });

  it('API présente mais en échec : `null` aussi', async () => {
    setNavigator({
      geolocation: {
        getCurrentPosition: (_success, failure) => failure(new Error('refus')),
      },
    });

    await expect(requestCurrentSearchMapLocation()).resolves.toBeNull();
  });

  it('API présente et acceptée : les coordonnées remontent', async () => {
    setNavigator({
      geolocation: {
        getCurrentPosition: (success) => success({
          coords: { latitude: 43.3, longitude: 5.37 },
        }),
      },
    });

    await expect(requestCurrentSearchMapLocation()).resolves.toEqual({ lat: 43.3, lng: 5.37 });
  });
});
