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

const clientNative = require('./client.native').default;
const clientWeb = require('./client.web').default;
const { resetBootRequestGuard } = require('./bootRequestGuard');

/**
 * Fabrique l'erreur qu'un adaptateur axios rejette sur un timeout : une Error
 * portant un `code`, sans `response`.
 * @param {string} code Le code axios ('ECONNABORTED' ou 'ETIMEDOUT').
 * @param {string} message Le message axios.
 * @returns {Error & { code: string, isAxiosError: boolean }}
 */
const adapterTimeoutError = (code, message) => Object.assign(
  new Error(message),
  { code, isAxiosError: true },
);

// PERF3 — avant ce lot, un abandon de 15 s était rejeté en CHAÎNE NUE
// ('Request timeout - please retry.') : sans status ni code, la politique de
// reprise (queryClient.js) le retentait comme une panne réseau — 48 s d'attente
// et 3 requêtes, précisément quand le serveur rame. Le site web compile les
// mêmes sources : les DEUX intercepteurs doivent rester strictement symétriques.
describe.each([
  ['client.native', clientNative],
  ['client.web', clientWeb],
])('%s : un abandon est rejeté en OBJET triable, plus jamais en chaîne nue', (_name, client) => {
  beforeEach(() => {
    resetBootRequestGuard();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockGetAuthTokens.mockReturnValue({ token: 'jeton-valide' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // axios 1.13.5 : l'adaptateur XHR code un timeout ECONNABORTED, l'adaptateur
  // fetch ETIMEDOUT. Un témoin qui ne testerait qu'ECONNABORTED serait incomplet.
  test.each([
    ['ECONNABORTED', 'timeout of 15000ms exceeded'],
    ['ETIMEDOUT', 'timeout of 15000ms exceeded'],
  ])('un timeout %s ressort avec status 0 et le code dédié', async (code, message) => {
    client.defaults.adapter = jest.fn(
      () => Promise.reject(adapterTimeoutError(code, message)),
    );

    await expect(client.get('/events')).rejects.toEqual({
      code: 'REQUEST_TIMEOUT_ABANDONED',
      message: 'Request timeout - please retry.',
      name: 'RequestTimeoutAbandonError',
      status: 0,
    });
  });

  test('une panne réseau franche (sans code timeout) garde sa forme actuelle', async () => {
    client.defaults.adapter = jest.fn(
      () => Promise.reject(adapterTimeoutError('ERR_NETWORK', 'Network Error')),
    );

    await expect(client.get('/events')).rejects.toBe('Network Error');
  });

  test('une erreur applicative Strapi reste déballée comme avant', async () => {
    const strapiError = {
      details: {},
      message: 'Forbidden',
      name: 'ForbiddenError',
      status: 403,
    };
    client.defaults.adapter = jest.fn(() => Promise.reject(Object.assign(
      new Error('Request failed with status code 403'),
      {
        isAxiosError: true,
        response: { data: { error: strapiError }, status: 403 },
      },
    )));

    await expect(client.get('/events')).rejects.toEqual(strapiError);
  });
});
