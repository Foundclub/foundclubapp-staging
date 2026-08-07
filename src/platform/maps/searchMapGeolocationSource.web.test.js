import {
  ensureSearchMapGeolocationPermission,
  getCurrentSearchMapPosition,
  isSearchMapGeolocationSupported,
} from './searchMapGeolocationSource.web';

// La source WEB est importée par son nom COMPLET : sans cela, Jest (préréglage
// react-native) résoudrait la variante `.native.js`. C'est aussi ce qui prouve
// que les deux fichiers coexistent sans se marcher dessus.
//
// Ce fichier reprend la couverture écrite par D23 : elle décrit le comportement
// du site, qui ne doit pas bouger d'un iota avec D30.

const originalNavigator = global.navigator;

const setNavigator = (/** @type {any} */ value) => {
  Object.defineProperty(global, 'navigator', {
    configurable: true,
    value,
    writable: true,
  });
};

afterEach(() => {
  setNavigator(originalNavigator);
});

describe('searchMapGeolocationSource.web — disponibilité', () => {
  it('sans `navigator.geolocation`, la source est indisponible', () => {
    setNavigator({ product: 'ReactNative' });

    expect(isSearchMapGeolocationSupported()).toBe(false);
  });

  it('avec `navigator.geolocation`, elle est disponible', () => {
    setNavigator({ geolocation: { getCurrentPosition: () => {} } });

    expect(isSearchMapGeolocationSupported()).toBe(true);
  });
});

describe('searchMapGeolocationSource.web — position', () => {
  it('le navigateur porte sa propre demande : rien à réclamer en amont', async () => {
    await expect(ensureSearchMapGeolocationPermission()).resolves.toBe(true);
  });

  it('API absente : l`échec est signalé, jamais un silence', () => {
    setNavigator({ product: 'ReactNative' });
    const onSuccess = jest.fn();
    const onFailure = jest.fn();

    getCurrentSearchMapPosition(onSuccess, onFailure, {});

    expect(onFailure).toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('API présente : l`appel est transmis tel quel, options comprises', () => {
    const getCurrentPosition = jest.fn();
    setNavigator({ geolocation: { getCurrentPosition } });
    const onSuccess = jest.fn();
    const onFailure = jest.fn();

    getCurrentSearchMapPosition(onSuccess, onFailure, { timeout: 10000 });

    expect(getCurrentPosition).toHaveBeenCalledWith(onSuccess, onFailure, { timeout: 10000 });
  });
});
