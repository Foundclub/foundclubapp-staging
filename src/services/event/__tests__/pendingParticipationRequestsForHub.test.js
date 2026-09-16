/**
 * DEMR — LE TUYAU DE LA LECTURE DEDIEE DE L'ONGLET « DEMANDES ».
 *
 * `getPendingEventParticipationRequestsForHub` remplace, pour l'onglet
 * « Demandes », le parcours de toutes les activites a venir du club. Ce
 * fichier verrouille ce qui part sur le reseau : le bon chemin (deux segments,
 * jamais avale par `/event-participations/:id`), le club et RIEN d'autre, et le
 * `signal` qui permet de couper la requete quand une relecture la remplace.
 */

jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: { config: jest.fn(), fs: { dirs: {} } },
}));

jest.mock('@/domains/auth/authUseCases', () => ({
  getAuthTokens: () => ({ token: 'jeton-de-test' }),
}));

jest.mock('@/config/runtimeUrls', () => ({
  getApiBaseUrl: () => 'https://api.test',
}));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    delete: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({
  celebrate: jest.fn(),
}));

jest.mock('@/domains/guidance/guidanceRuntime', () => ({
  emitGuidanceAction: jest.fn(),
}));

const client = require('@/services/client').default;
const { getPendingEventParticipationRequestsForHub } = require('../eventService');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('DEMR — getPendingEventParticipationRequestsForHub', () => {
  it('appelle la route dediee avec le club et le signal, et rend la reponse', async () => {
    const reponse = {
      data: [{ documentId: 'event-1', participationRequests: [] }],
      meta: { truncated: false },
    };
    client.get.mockResolvedValue({ data: reponse });
    const controller = new AbortController();

    const rendu = await getPendingEventParticipationRequestsForHub(
      { clubId: 'club-1' },
      { signal: controller.signal },
    );

    expect(client.get).toHaveBeenCalledTimes(1);
    expect(client.get).toHaveBeenCalledWith('/event-participations/requests-hub/pending', {
      params: { clubId: 'club-1' },
      signal: controller.signal,
    });
    expect(rendu).toBe(reponse);
  });

  it('laisse remonter le refus du serveur sans le deguiser (le hub lit son status)', async () => {
    const refus = { message: 'Not Found', name: 'NotFoundError', status: 404 };
    client.get.mockRejectedValue(refus);

    await expect(getPendingEventParticipationRequestsForHub({ clubId: 'club-1' }))
      .rejects.toBe(refus);
  });
});
