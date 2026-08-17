/**
 * S01 — filet E6 sur `getClubMembershipRequests`, qui n'avait AUCUN test.
 *
 * Meme defaut que la section « Équipe », meme famille, meme ecran : la reponse
 * est validee EN BLOC avec `club` et `state` en `.required()`. Une ligne dont le
 * club a ete supprime fait donc tomber toute la section « Club » de « Demandes »,
 * avec un 200 cote serveur — donc sans trace dans son journal.
 *
 * 📌 Et comme pour les demandes d'equipe, le `populate` envoye par l'app est MORT :
 * le controleur (`club-membership-request.ts:466-474`) appelle `validateQuery(ctx)`
 * puis impose son propre populate ET son propre filtre de club. Le parametre ne
 * sert qu'a se faire refuser quand `plugin::users-permissions.user.find` manque.
 */

const mockGet = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    get: mockGet,
  },
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({
  celebrate: jest.fn(),
}));

const { getClubMembershipRequests } = require('../clubMembershipRequestService');

const PAGINATION = {
  page: 1, pageCount: 1, pageSize: 50, total: 2,
};

const HEALTHY_REQUEST = {
  club: { documentId: 'club-1', name: 'AS Test' },
  documentId: 'cmr-sain',
  state: 'pending',
  user: { documentId: 'user-1', firstname: 'Lea' },
};

describe('S01 — getClubMembershipRequests, le filet qui manquait', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('temoin de controle — une reponse saine passe, telle quelle', async () => {
    mockGet.mockResolvedValueOnce({
      data: { data: [HEALTHY_REQUEST], meta: { pagination: PAGINATION } },
    });

    const result = await getClubMembershipRequests('club-1', { pageSize: 50 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].documentId).toBe('cmr-sain');
  });

  test('🔴 temoin 1 — UNE ligne sans club ne tue PAS la section', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [HEALTHY_REQUEST, { ...HEALTHY_REQUEST, club: null, documentId: 'cmr-sans-club' }],
        meta: { pagination: PAGINATION },
      },
    });

    const result = await getClubMembershipRequests('club-1', { pageSize: 50 });

    expect(result.data.map((item) => item.documentId)).toEqual(['cmr-sain']);
  });

  test('🔴 temoin 2 — le statut HTTP d un refus SURVIT jusqu a l ecran', async () => {
    const httpError = /** @type {any} */ (new Error('Request failed with status code 403'));
    httpError.response = { data: { error: { message: 'Forbidden' } }, status: 403 };
    mockGet.mockRejectedValueOnce(httpError);

    await expect(getClubMembershipRequests('club-1', { pageSize: 50 }))
      .rejects.toMatchObject({ status: 403 });
  });

  test('🔴 temoin 3 — l app n envoie plus le `populate` que le serveur remplace', async () => {
    mockGet.mockResolvedValueOnce({
      data: { data: [], meta: { pagination: PAGINATION } },
    });

    await getClubMembershipRequests('club-1', { pageSize: 50 });

    const [, config] = mockGet.mock.calls[0];
    expect(config.params.populate).toBeUndefined();
  });

  test('temoin de controle — une meta absente reste une erreur', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: [HEALTHY_REQUEST] } });

    await expect(getClubMembershipRequests('club-1', { pageSize: 50 })).rejects.toThrow();
  });
});
