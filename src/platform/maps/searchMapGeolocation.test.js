import {
  canUseSearchMapGeolocation,
  requestCurrentSearchMapLocation,
} from './searchMapGeolocation';

// D23 (défaut ④ : « le bouton autour de moi ne marche pas ») puis D30.
//
// CE QUE CES TESTS FIGENT, et c'est le contrat que D30 ne doit pas casser :
// aucun chemin d'échec ne LÈVE. Refus, capteur muet, coordonnées absurdes,
// module natif absent — tous rendent `null`, ce que l'écran traduit par un
// message de repli plutôt que par de l'inertie.
//
// Ce que D30 change : l'orchestrateur ne lit plus `navigator` lui-même, il
// délègue à `searchMapGeolocationSource`, résolu en `.native.js` par Metro et
// Jest, en `.web.js` par Vite. Chaque source a son propre test ; ici on teste
// l'orchestration, indépendamment de la plateforme.

const mockIsSupported = jest.fn();
const mockEnsurePermission = jest.fn();
const mockGetCurrentPosition = jest.fn();

jest.mock('./searchMapGeolocationSource', () => ({
  ensureSearchMapGeolocationPermission: (/** @type {any[]} */ ...args) => (
    mockEnsurePermission(...args)
  ),
  getCurrentSearchMapPosition: (/** @type {any[]} */ ...args) => mockGetCurrentPosition(...args),
  isSearchMapGeolocationSupported: (/** @type {any[]} */ ...args) => mockIsSupported(...args),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockIsSupported.mockReturnValue(true);
  mockEnsurePermission.mockResolvedValue(true);
});

describe('searchMapGeolocation — disponibilité de l`API', () => {
  it('source indisponible : l`API est déclarée indisponible', () => {
    mockIsSupported.mockReturnValue(false);

    expect(canUseSearchMapGeolocation()).toBe(false);
  });

  it('source disponible : elle est disponible', () => {
    mockIsSupported.mockReturnValue(true);

    expect(canUseSearchMapGeolocation()).toBe(true);
  });
});

describe('searchMapGeolocation — demande de position', () => {
  it('source indisponible : `null`, et AUCUNE permission réclamée', async () => {
    // Ne jamais demander une autorisation qu'on ne saurait pas exploiter :
    // c'est la règle que D23 a posée, elle survit au changement de source.
    mockIsSupported.mockReturnValue(false);

    await expect(requestCurrentSearchMapLocation()).resolves.toBeNull();
    expect(mockEnsurePermission).not.toHaveBeenCalled();
    expect(mockGetCurrentPosition).not.toHaveBeenCalled();
  });

  it('permission refusée : `null`, et le capteur n`est jamais sollicité', async () => {
    mockEnsurePermission.mockResolvedValue(false);

    await expect(requestCurrentSearchMapLocation()).resolves.toBeNull();
    expect(mockGetCurrentPosition).not.toHaveBeenCalled();
  });

  it('capteur en échec : `null`, sans lever', async () => {
    mockGetCurrentPosition.mockImplementation((_onSuccess, onFailure) => onFailure());

    await expect(requestCurrentSearchMapLocation()).resolves.toBeNull();
  });

  it('la source lève : `null`, sans lever non plus', async () => {
    // Cas du module natif non lié : le paquet remplace le module absent par un
    // objet piégé dont le premier accès lève.
    mockGetCurrentPosition.mockImplementation(() => {
      throw new Error('module natif absent');
    });

    await expect(requestCurrentSearchMapLocation()).resolves.toBeNull();
  });

  it('position acceptée : les coordonnées remontent', async () => {
    mockGetCurrentPosition.mockImplementation((onSuccess) => onSuccess({
      coords: { latitude: 43.3, longitude: 5.37 },
    }));

    await expect(requestCurrentSearchMapLocation()).resolves.toEqual({ lat: 43.3, lng: 5.37 });
  });

  it('coordonnées non exploitables : `null`', async () => {
    mockGetCurrentPosition.mockImplementation((onSuccess) => onSuccess({
      coords: { latitude: null, longitude: undefined },
    }));

    await expect(requestCurrentSearchMapLocation()).resolves.toBeNull();
  });

  it('le délai demandé est transmis au capteur', async () => {
    mockGetCurrentPosition.mockImplementation((_onSuccess, onFailure) => onFailure());

    await requestCurrentSearchMapLocation();

    expect(mockGetCurrentPosition.mock.calls[0][2]).toEqual(
      expect.objectContaining({ timeout: 10000 }),
    );
  });

  it('capteur qui ne répond JAMAIS : le filet rend `null`, l`écran n`est pas bloqué', async () => {
    // Le blocage réel qu'il couvre : quand le module natif n'est pas lié, le
    // paquet lève dans une fonction `async` dont il jette lui-même la
    // promesse — aucun des deux rappels ne part, et sans filet l'écran
    // resterait sur « … » indéfiniment.
    jest.useFakeTimers();
    mockGetCurrentPosition.mockImplementation(() => {});

    const pending = requestCurrentSearchMapLocation();
    await jest.advanceTimersByTimeAsync(12000);

    await expect(pending).resolves.toBeNull();
    jest.useRealTimers();
  });
});
