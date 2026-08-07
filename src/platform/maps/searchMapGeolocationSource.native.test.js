// La source NATIVE est importée par son nom COMPLET, comme sa jumelle web.
//
// D30 — ce que ces tests prouvent : sur natif la position vient bien du module
// natif (et non de `navigator`, absent de React Native 0.78), et la permission
// Android n'est réclamée QU'UNE fois — si elle est déjà accordée, aucune
// seconde boîte de dialogue ne s'ouvre.

const mockGetCurrentPosition = jest.fn();
const mockCheck = jest.fn();
const mockRequest = jest.fn();
const mockPlatform = { OS: 'android' };

jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: {
    getCurrentPosition: (/** @type {any[]} */ ...args) => mockGetCurrentPosition(...args),
  },
}));

// `Platform` est exposé par un ACCESSEUR, et ce n'est pas une coquetterie :
// `jest.mock` est remonté au-dessus du corps du fichier, et Babel compile les
// `const` en `var`. Une valeur lue directement dans la fabrique vaudrait donc
// `undefined`. Les autres entrées survivent parce qu'elles sont enveloppées
// dans des fonctions, évaluées bien plus tard.
jest.mock('react-native', () => ({
  PermissionsAndroid: {
    check: (/** @type {any[]} */ ...args) => mockCheck(...args),
    PERMISSIONS: { ACCESS_FINE_LOCATION: 'android.permission.ACCESS_FINE_LOCATION' },
    request: (/** @type {any[]} */ ...args) => mockRequest(...args),
    RESULTS: { GRANTED: 'granted' },
  },
  get Platform() {
    return mockPlatform;
  },
}));

// eslint-disable-next-line import/first -- les mocks doivent être posés avant l'import
import {
  ensureSearchMapGeolocationPermission,
  getCurrentSearchMapPosition,
  isSearchMapGeolocationSupported,
} from './searchMapGeolocationSource.native';

beforeEach(() => {
  jest.clearAllMocks();
  mockPlatform.OS = 'android';
});

describe('searchMapGeolocationSource.native — disponibilité', () => {
  it('la source est toujours déclarée disponible : le module est lié à la compilation', () => {
    expect(isSearchMapGeolocationSupported()).toBe(true);
  });
});

describe('searchMapGeolocationSource.native — permission Android', () => {
  it('déjà accordée : aucune seconde demande n`est ouverte', async () => {
    mockCheck.mockResolvedValue(true);

    await expect(ensureSearchMapGeolocationPermission()).resolves.toBe(true);
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('pas encore accordée : elle est demandée, et l`accord passe', async () => {
    mockCheck.mockResolvedValue(false);
    mockRequest.mockResolvedValue('granted');

    await expect(ensureSearchMapGeolocationPermission()).resolves.toBe(true);
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('refusée : la source le dit, elle ne fait pas semblant', async () => {
    mockCheck.mockResolvedValue(false);
    mockRequest.mockResolvedValue('denied');

    await expect(ensureSearchMapGeolocationPermission()).resolves.toBe(false);
  });

  it('iOS : rien n`est demandé ici, le module natif porte sa propre demande', async () => {
    mockPlatform.OS = 'ios';

    await expect(ensureSearchMapGeolocationPermission()).resolves.toBe(true);
    expect(mockCheck).not.toHaveBeenCalled();
    expect(mockRequest).not.toHaveBeenCalled();
  });
});

describe('searchMapGeolocationSource.native — position', () => {
  it('l`appel part au module natif, dans l`ordre attendu par l`API du web', () => {
    const onSuccess = jest.fn();
    const onFailure = jest.fn();

    getCurrentSearchMapPosition(onSuccess, onFailure, { timeout: 10000 });

    expect(mockGetCurrentPosition).toHaveBeenCalledWith(onSuccess, onFailure, { timeout: 10000 });
  });
});
