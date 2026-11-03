/* eslint-disable max-len */
// T3-SESSION-B (03/11/2026, fiche 25, option B) : le jeton se renouvelle pendant l'usage, en silence.
// Faux jetons : seule la date d'émission est lue par le client, la signature reste l'affaire du serveur.
const mockSnapshot = { current: { auth: undefined, authSessions: [] } };
const mockDispatch = jest.fn(() => true);

jest.mock('@/domains/auth/authUseCases', () => ({
  getAuthTokens: () => mockSnapshot.current.auth,
}));
jest.mock('@/store/appContext', () => ({
  storage: { delete: jest.fn(), getString: jest.fn(), set: jest.fn() },
}));
jest.mock('@/store/authRuntime', () => ({
  dispatchAuthRuntimeAction: mockDispatch,
  getAuthRuntimeSnapshot: () => mockSnapshot.current,
}));
jest.mock('@/utils/performance/bootPerformance', () => ({ trackBootNetworkRequest: jest.fn() }));
jest.mock('@/config/runtimeUrls', () => ({
  assertRuntimeEndpointsReady: jest.fn(),
  getApiBaseUrl: jest.fn(() => 'https://api.invalid/api'),
}));

const appReducer = require('@/store/appReducer').default;
const { resetBootRequestGuard } = require('../bootRequestGuard');
const {
  enregistrerCacheDesSessions,
  reinitialiserRenouvellementJeton,
} = require('./renouvellementJeton');

const JOUR_S = 24 * 3600;
const encode = (valeur) => Buffer.from(JSON.stringify(valeur)).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_')
  .replace(/=+$/, '');
const fauxJeton = (ageJours, nom = 'x') => `${encode({ alg: 'HS256' })}.${encode({
  iat: Math.floor(Date.now() / 1000) - ageJours * JOUR_S,
  nom,
})}.signature`;
const session = (token, documentId) => ({ token, user: { documentId } });
const attendre = () => new Promise((fin) => { setTimeout(fin, 0); });
const appelsRenouvellement = (adapter) => adapter.mock.calls
  .map(([config]) => config)
  .filter((config) => config.url === '/firebase-auth/me/renew-token');

const clientNatif = require('../client.native').default;
const clientWeb = require('../client.web').default;

describe.each([
  ['client.native', clientNatif],
  ['client.web', clientWeb],
])('%s', (_nom, client) => {
  let adapter;

  const repond = (config, status, data) => {
    const reponse = {
      config, data, headers: {}, status, statusText: String(status),
    };
    if (status < 400) return Promise.resolve(reponse);
    const erreur = new Error(`HTTP ${status}`);
    erreur.config = config;
    erreur.response = reponse;
    return Promise.reject(erreur);
  };

  beforeEach(() => {
    resetBootRequestGuard();
    reinitialiserRenouvellementJeton();
    mockDispatch.mockClear();
    adapter = jest.fn((config) => repond(
      config,
      200,
      config.url.includes('renew-token') ? { jwt: 'jeton-neuf' } : {},
    ));
    // eslint-disable-next-line no-param-reassign -- le client testé, seul moyen de couper le réseau
    client.defaults.adapter = adapter;
  });

  it('jeton de plus de 7 jours : un seul renouvellement, avec ce jeton, et le store est prévenu', async () => {
    const vieux = fauxJeton(8);
    mockSnapshot.current = { auth: session(vieux, 'A'), authSessions: [session(vieux, 'A')] };
    await Promise.all([client.get('/events'), client.get('/clubs')]);
    await attendre();
    const appels = appelsRenouvellement(adapter);
    expect(appels).toHaveLength(1);
    expect(appels[0].method).toBe('post');
    expect(appels[0].headers.Authorization).toBe(`Bearer ${vieux}`);
    expect(mockDispatch).toHaveBeenCalledWith({
      payload: { ancienJeton: vieux, jeton: 'jeton-neuf' },
      type: 'RENEW_SESSION_TOKEN',
    });
  });

  it('jeton de moins de 7 jours : aucun appel', async () => {
    const jeune = fauxJeton(6);
    mockSnapshot.current = { auth: session(jeune, 'A'), authSessions: [session(jeune, 'A')] };
    await client.get('/events');
    await attendre();
    expect(appelsRenouvellement(adapter)).toHaveLength(0);
  });

  it('un compte en arrière-plan est renouvelé avec son propre jeton', async () => {
    const actif = fauxJeton(1, 'actif');
    const second = fauxJeton(20, 'second');
    mockSnapshot.current = { auth: session(actif, 'A'), authSessions: [session(actif, 'A'), session(second, 'B')] };
    await client.get('/events');
    await attendre();
    const appels = appelsRenouvellement(adapter);
    expect(appels).toHaveLength(1);
    expect(appels[0].headers.Authorization).toBe(`Bearer ${second}`);
  });

  it.each([[403], [404], [500]])('échec %i : personne n est déconnecté, pas de nouvel essai avant une heure', async (status) => {
    const vieux = fauxJeton(8);
    mockSnapshot.current = { auth: session(vieux, 'A'), authSessions: [session(vieux, 'A')] };
    adapter.mockImplementation((config) => (config.url.includes('renew-token')
      ? repond(config, status, { error: { status } })
      : repond(config, 200, {})));
    await client.get('/events');
    await attendre();
    await client.get('/events');
    await attendre();
    expect(appelsRenouvellement(adapter)).toHaveLength(1);
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('plafond atteint (`jwt: null`) : le jeton reste, rien n est déconnecté', async () => {
    const vieux = fauxJeton(8);
    mockSnapshot.current = { auth: session(vieux, 'A'), authSessions: [session(vieux, 'A')] };
    adapter.mockImplementation((config) => repond(config, 200, config.url.includes('renew-token') ? { jwt: null } : {}));
    await client.get('/events');
    await attendre();
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('jeton illisible : aucun appel, aucune erreur', async () => {
    mockSnapshot.current = { auth: session('pas-un-jeton', 'A'), authSessions: [session('pas-un-jeton', 'A')] };
    await expect(client.get('/events')).resolves.toBeDefined();
    await attendre();
    expect(appelsRenouvellement(adapter)).toHaveLength(0);
  });

  it('compte actif : ses données déjà chargées suivent le jeton, sans écran de chargement', async () => {
    const vieux = fauxJeton(8);
    mockSnapshot.current = { auth: session(vieux, 'A'), authSessions: [session(vieux, 'A')] };
    const donnees = { 'app-bootstrap': { ok: true }, 'get-me': { id: 1 } };
    const ecrit = {};
    enregistrerCacheDesSessions({
      getQueryData: ([cle, jeton]) => (jeton === vieux ? donnees[cle] : undefined),
      setQueryData: ([cle, jeton], valeur) => { ecrit[`${cle}:${jeton}`] = valeur; },
    });
    await client.get('/events');
    await attendre();
    expect(ecrit).toEqual({ 'app-bootstrap:jeton-neuf': { ok: true }, 'get-me:jeton-neuf': { id: 1 } });
    enregistrerCacheDesSessions(undefined);
  });
});

describe('RENEW_SESSION_TOKEN', () => {
  const etat = (auth, authSessions) => ({
    activeSessionDocumentId: 'A', auth, authSessions, isAddingAccount: false,
  });
  const action = { payload: { ancienJeton: 'vieux', jeton: 'neuf' }, type: 'RENEW_SESSION_TOKEN' };

  it('remplace le jeton du compte actif, dans auth et dans la liste, sans rien changer d autre', () => {
    const a = { ...session('vieux', 'A'), idToken: 'i' };
    const suite = appReducer(etat(a, [a, session('autre', 'B')]), action);
    expect(suite.auth).toEqual({ ...a, token: 'neuf' });
    expect(suite.authSessions).toEqual([{ ...a, token: 'neuf' }, session('autre', 'B')]);
    expect(suite.activeSessionDocumentId).toBe('A');
  });

  it('compte en arrière-plan : le compte actif ne change pas', () => {
    const a = session('actif', 'A');
    const suite = appReducer(etat(a, [a, session('vieux', 'B')]), action);
    expect(suite.auth).toBe(a);
    expect(suite.authSessions[1]).toEqual(session('neuf', 'B'));
  });

  it('compte déconnecté pendant l appel : il ne ressuscite pas', () => {
    const a = session('actif', 'A');
    expect(appReducer(etat(a, [a]), action).authSessions).toEqual([a]);
  });
});
