/**
 * S01 — filet E6 sur `getTeamMembershipRequests`, qui n'avait AUCUN test.
 *
 * 🔴 LE CONSTAT D'ADEL (recette du 2026-08-16) : l'ecran « Demandes » affiche
 * « Équipe indisponible ». Or le journal du serveur ne porte AUCUNE erreur sur
 * `/team-membership-requests` — ni 400, ni 403, ni 500.
 *
 * 🔎 CE QUE CE FICHIER ETABLIT, ET QUI N'ETAIT ECRIT NULLE PART :
 *
 * La panne est CLIENT, pas serveur, et c'est pour ca qu'elle est invisible cote
 * VPS. `getTeamMembershipRequests` valide la reponse ENTIERE avec un seul schema
 * Joi dont `team` et `user` sont `.required()`. Ces deux relations sont pourtant
 * NULLABLES cote serveur (`team-membership-request/schema.json` : aucune n'est
 * `required`, et la suppression de compte laisse `user: null`).
 * ⇒ UNE seule ligne abimee fait echouer la validation de tout le lot, la
 * fonction leve, `requestsHubService` classe la source `team` en erreur, et
 * l'ecran ecrit « Équipe indisponible » — alors que le serveur a repondu 200.
 *
 * 🧨 Et le `throw new Error(...)` de la branche de validation PERD le statut HTTP :
 * `getSourceErrorDescription` (RequestsHub.js:97) ne peut plus distinguer un
 * refus d'un incident, et retombe sur le message fourre-tout.
 *
 * 📌 Le `populate` envoye par l'app est par ailleurs MORT : le controleur serveur
 * (`team-membership-request.ts:127-172`) appelle `validateQuery(ctx)` — donc il
 * VALIDE ce que l'app demande — puis remplace le populate par le sien. Le
 * parametre ne sert donc qu'a se faire refuser : `populate: ['user', ...]` exige
 * `plugin::users-permissions.user.find`, une action que AUCUN role ne declare
 * (elle ne survit en production que par heritage, hors manifeste).
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

const { getTeamMembershipRequests } = require('../teamMembershipRequestService');

const PAGINATION = {
  page: 1, pageCount: 1, pageSize: 50, total: 2,
};

const HEALTHY_REQUEST = {
  documentId: 'tmr-sain',
  state: 'pending',
  team: { documentId: 'team-1', name: 'U15' },
  user: { documentId: 'user-1', firstname: 'Lea' },
};

/** Le compte du demandeur a ete supprime : le serveur rend `user: null`. */
const REQUEST_WITH_DELETED_ACCOUNT = {
  documentId: 'tmr-compte-supprime',
  state: 'pending',
  team: { documentId: 'team-1', name: 'U15' },
  user: null,
};

describe('S01 — getTeamMembershipRequests, le filet qui manquait', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('temoin de controle — une reponse saine passe, telle quelle', async () => {
    mockGet.mockResolvedValueOnce({
      data: { data: [HEALTHY_REQUEST], meta: { pagination: PAGINATION } },
    });

    const result = await getTeamMembershipRequests(['team-1'], { pageSize: 50 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].documentId).toBe('tmr-sain');
    expect(result.meta.pagination.total).toBe(2);
  });

  test('🔴 temoin 1 — UNE ligne dont le compte est supprime ne tue PAS la section', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [HEALTHY_REQUEST, REQUEST_WITH_DELETED_ACCOUNT],
        meta: { pagination: PAGINATION },
      },
    });

    const result = await getTeamMembershipRequests(['team-1'], { pageSize: 50 });

    // La demande saine reste lisible : c'est exactement ce qu'Adel ne voyait plus.
    expect(result.data.map((item) => item.documentId)).toEqual(['tmr-sain']);
  });

  test('🔴 temoin 2 — une ligne sans equipe est ECARTEE, pas fatale', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        data: [{ ...HEALTHY_REQUEST, documentId: 'tmr-sans-equipe', team: null }, HEALTHY_REQUEST],
        meta: { pagination: PAGINATION },
      },
    });

    const result = await getTeamMembershipRequests(['team-1'], { pageSize: 50 });

    expect(result.data.map((item) => item.documentId)).toEqual(['tmr-sain']);
  });

  test('🔴 temoin 3 — le statut HTTP d un refus SURVIT jusqu a l ecran', async () => {
    const httpError = /** @type {any} */ (
      new Error('Request failed with status code 403')
    );
    httpError.response = { data: { error: { message: 'Forbidden' } }, status: 403 };
    mockGet.mockRejectedValueOnce(httpError);

    await expect(getTeamMembershipRequests(['team-1'], { pageSize: 50 }))
      .rejects.toMatchObject({ status: 403 });
  });

  test('🔴 temoin 4 — l app n envoie plus le `populate` que le serveur remplace', async () => {
    mockGet.mockResolvedValueOnce({
      data: { data: [], meta: { pagination: PAGINATION } },
    });

    await getTeamMembershipRequests(['team-1'], { pageSize: 50 });

    const [, config] = mockGet.mock.calls[0];
    expect(config.params.populate).toBeUndefined();
  });

  test('temoin de controle — une meta absente reste une erreur : on ne devine pas', async () => {
    mockGet.mockResolvedValueOnce({ data: { data: [HEALTHY_REQUEST] } });

    await expect(getTeamMembershipRequests(['team-1'], { pageSize: 50 })).rejects.toThrow();
  });
});
