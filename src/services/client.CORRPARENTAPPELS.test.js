const mockGetAuthTokens = jest.fn(() => ({ token: 'jeton-valide' }));
const mockSnapshot = jest.fn(() => ({ auth: undefined }));

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
  getAuthRuntimeSnapshot: mockSnapshot,
}));

jest.mock('@/utils/performance/bootPerformance', () => ({
  trackBootNetworkRequest: jest.fn(),
}));

jest.mock('@/config/runtimeUrls', () => ({
  assertRuntimeEndpointsReady: jest.fn(),
  getApiBaseUrl: jest.fn(() => 'https://api-staging.foundclubpro.com/api'),
}));

const { shouldRetryQuery } = require('@/app/queryClient');

// 👪 CORR-PARENT-APPELS (31/10, fin du point 46, décision d'Adel « A ») — le serveur
// refuse au rôle Parent ces quatre lectures (carte Parent de admin/src/index.ts : ni
// user-history.findMine, ni league-team.mine, ni event-participation.find, ni
// license.getMine). Mesuré à la recette du 29/10 : 403 à l'ouverture du profil, de la
// carte, d'un événement, de la League et des cotisations. L'app ne les envoie plus :
// le client les refuse avant le réseau, avec la forme du refus du serveur (403), donc
// les écrans gardent ce qu'ils montraient. Aucun droit ouvert ni retiré.
const LECTURES_REFUSEES = [
  '/user-histories/mine',
  '/league-teams/mine',
  '/event-participations',
  '/licenses/me',
  '/licenses/me/affectation-1',
];

const PARENT = { auth: { user: { role: { name: 'Parent', type: 'parent' } } } };
const JOUEUR = { auth: { user: { role: { name: 'Joueur', type: 'joueur' } } } };

describe.each([
  ['téléphone', './client.native'],
  ['site', './client.web'],
])('client HTTP (%s) : les lectures refusées au Parent ne partent plus', (_nom, chemin) => {
  const client = require(chemin).default;
  /** @type {jest.Mock} */
  let adapter;

  beforeEach(() => {
    adapter = jest.fn(() => Promise.resolve({
      config: {}, data: {}, headers: {}, status: 200,
    }));
    client.defaults.adapter = adapter;
  });

  test.each(LECTURES_REFUSEES)('GET %s : refusé avant le réseau, comme le serveur', async (url) => {
    mockSnapshot.mockReturnValue(PARENT);

    const erreur = await client.get(url).catch((e) => e);

    expect(adapter).not.toHaveBeenCalled();
    expect(erreur).toMatchObject({ name: 'ForbiddenError', status: 403 });
    expect(shouldRetryQuery(0, erreur)).toBe(false);
  });

  test('un autre rôle les envoie comme avant', async () => {
    mockSnapshot.mockReturnValue(JOUEUR);

    await Promise.all(LECTURES_REFUSEES.map((url) => client.get(url)));

    expect(adapter).toHaveBeenCalledTimes(LECTURES_REFUSEES.length);
  });

  test('le Parent garde ses autres lectures et ses écritures', async () => {
    mockSnapshot.mockReturnValue(PARENT);

    await client.get('/user-histories/user/enfant-1');
    await client.get('/event-participations/requests-hub/pending');
    await client.post('/event-participations', {});

    expect(adapter).toHaveBeenCalledTimes(3);
  });

  test('un en-tête déjà posé parle pour une autre session : il passe', async () => {
    mockSnapshot.mockReturnValue(PARENT);

    await client.get('/user-histories/mine', { headers: { Authorization: 'Bearer autre' } });

    expect(adapter).toHaveBeenCalledTimes(1);
  });
});
