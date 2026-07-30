const mockGetAuthTokens = jest.fn();

jest.mock('@/domains/auth/authUseCases', () => ({
  getAuthTokens: mockGetAuthTokens,
}));

jest.mock('@/store/appContext', () => ({
  storage: {
    delete: jest.fn(),
    getString: jest.fn(),
    set: jest.fn(),
  },
}));

jest.mock('@/store/authRuntime', () => ({
  dispatchAuthRuntimeAction: jest.fn(() => true),
  getAuthRuntimeSnapshot: jest.fn(() => ({ auth: undefined })),
}));

jest.mock('@/utils/performance/bootPerformance', () => ({
  trackBootNetworkRequest: jest.fn(),
}));

jest.mock('@/config/runtimeUrls', () => ({
  assertRuntimeEndpointsReady: jest.fn(),
  getApiBaseUrl: jest.fn(() => 'https://api-staging.foundclubpro.com/api'),
}));

const client = require('./client.native').default;
const {
  BOOT_REQUEST_NO_SESSION_CODE,
  resetBootRequestGuard,
} = require('./bootRequestGuard');

// Les 5 appels mesurés en boucle dans les journaux de foundclub-staging-admin le
// 2026-07-29 entre 23:51 et 00:05, app déconnectée (403 / 401 côté serveur).
const APPELS_MESURES = [
  ['get', '/notifications/count-unread'],
  ['get', '/firebase-auth/me/pending-match-stats'],
  ['get', '/league-actions/pending'],
  ['get', '/app/bootstrap'],
  ['post', '/user-fcm-token/me/device'],
];

describe('client HTTP : aucun appel protégé ne part sans jeton', () => {
  /** @type {jest.Mock} */
  let adapter;

  beforeEach(() => {
    resetBootRequestGuard();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    adapter = jest.fn(() => Promise.resolve({
      config: {}, data: {}, headers: {}, status: 200,
    }));
    client.defaults.adapter = adapter;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test.each(APPELS_MESURES)('%s %s est refusé AVANT le réseau quand il n\'y a pas de jeton', async (method, url) => {
    mockGetAuthTokens.mockReturnValue(null);

    await expect(client.request({ method, url })).rejects.toMatchObject({
      code: BOOT_REQUEST_NO_SESSION_CODE,
    });
    expect(adapter).not.toHaveBeenCalled();
  });

  test('les mêmes appels partent normalement dès qu\'un jeton existe', async () => {
    mockGetAuthTokens.mockReturnValue({ token: 'jeton-valide' });

    await Promise.all(APPELS_MESURES.map(([method, url]) => client.request({ method, url })));

    expect(adapter).toHaveBeenCalledTimes(APPELS_MESURES.length);
    const [premiereRequete] = adapter.mock.calls[0];
    expect(premiereRequete.headers.Authorization).toBe('Bearer jeton-valide');
  });

  test('une route publique passe toujours, sans jeton', async () => {
    mockGetAuthTokens.mockReturnValue(null);

    await client.get('/firebase-auth/login');
    await client.get('/events?filters%5BisActive%5D=true');

    expect(adapter).toHaveBeenCalledTimes(2);
  });

  test('un en-tête Authorization explicite passe, même sans session active', async () => {
    // addDeviceTokenForSession : la session active peut être absente, la requête
    // parle au nom d'une autre session enregistrée sur l'appareil.
    mockGetAuthTokens.mockReturnValue(null);

    await client.post('/user-fcm-token/me/device', { data: {} }, {
      headers: { Authorization: 'Bearer jeton-autre-session' },
    });

    expect(adapter).toHaveBeenCalledTimes(1);
  });
});
