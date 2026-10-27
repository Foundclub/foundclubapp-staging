// TUTOE-CALIBRAGE (27/10) — bonus B2 du guide : le match d'exemple ne doit
// RIEN écrire sur le serveur. En développement, l'intercepteur note chaque
// écriture `[TUTOE-NET] <MÉTHODE> <url>` ; la tournée compte ces lignes pendant
// B2 (0 attendu). Ce témoin prouve que le journal VOIT une écriture, sinon un
// « 0 » ne prouverait rien.

jest.mock('@/domains/auth/authUseCases', () => ({ getAuthTokens: () => ({ token: 'jeton' }) }));
jest.mock('@/store/appContext', () => ({
  storage: { delete: jest.fn(), getString: jest.fn(), set: jest.fn() },
}));
jest.mock('@/store/authRuntime', () => ({
  dispatchAuthRuntimeAction: jest.fn(() => true),
  getAuthRuntimeSnapshot: jest.fn(() => ({ auth: undefined })),
}));
jest.mock('@/utils/performance/bootPerformance', () => ({ trackBootNetworkRequest: jest.fn() }));
jest.mock('@/config/runtimeUrls', () => ({
  assertRuntimeEndpointsReady: jest.fn(),
  getApiBaseUrl: jest.fn(() => 'https://api-staging.foundclubpro.com/api'),
}));

const client = require('./client.native').default;

const onRequest = client.interceptors.request.handlers[0].fulfilled;

describe('journal des écritures (développement)', () => {
  it('note une écriture, pas une lecture', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    onRequest({ headers: {}, method: 'post', url: '/events' });
    onRequest({ headers: {}, method: 'get', url: '/events' });
    const lignes = log.mock.calls.map((args) => String(args[0]))
      .filter((ligne) => ligne.startsWith('[TUTOE-NET]'));
    expect(lignes).toEqual(['[TUTOE-NET] POST /events']);
    log.mockRestore();
  });
});
