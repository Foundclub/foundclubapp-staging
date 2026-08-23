/**
 * P10 — L'INVITATION AVEC CONSENTEMENT, cote app (etape 5).
 *
 * 🧨 LE PIEGE QUE CE FICHIER SURVEILLE (D9) : `getTeamMembershipRequests` valide
 * la reponse LIGNE PAR LIGNE, et toute ligne qui echoue est ECARTEE EN SILENCE
 * (teamMembershipRequestService.js:60-66). Une invitation qui ne passerait pas
 * la validation disparaitrait donc de l'ecran sans le moindre message — c'est
 * exactement le defaut que S01 a corrige pour les demandes.
 *
 * ✅ Ce qui rend le lot sur : `allowUnknown: true` (:62) laisse deja passer un
 * champ inconnu. `direction` SURVIT donc sans rien casser, et — c'est le point —
 * P10 n'introduit AUCUN etat `state` nouveau : c'est `state` qui est
 * `.valid('processed', 'refused', 'pending')`, et un etat neuf aurait fait
 * ecarter toutes les invitations en silence.
 */

const mockGet = jest.fn();
const mockPost = jest.fn();

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: {
    get: mockGet,
    post: mockPost,
  },
}));

jest.mock('@/services/celebrations/celebrationRuntime', () => ({
  celebrate: jest.fn(),
}));

const {
  acceptTeamInvitation,
  getTeamMembershipRequests,
  inviteToTeam,
  refuseTeamInvitation,
} = require('../teamMembershipRequestService');

const PAGINATION = {
  page: 1, pageCount: 1, pageSize: 50, total: 1,
};

const INVITATION = {
  direction: 'invite',
  documentId: 'tmr-invitation',
  state: 'pending',
  team: { documentId: 'team-1', name: 'U15' },
  user: { documentId: 'user-1', firstname: 'Lea' },
};

const DEMANDE_HERITEE = {
  // Une ligne d'AVANT le lot : la colonne n'existait pas, le serveur rend null.
  direction: null,
  documentId: 'tmr-heritee',
  state: 'pending',
  team: { documentId: 'team-1', name: 'U15' },
  user: { documentId: 'user-2', firstname: 'Sam' },
};

describe('P10 — l invitation traverse l app sans se faire ecarter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('🔴 temoin 1 — une ligne `direction: invite` SURVIT a la validation (D9)', async () => {
    mockGet.mockResolvedValue({ data: { data: [INVITATION], meta: { pagination: PAGINATION } } });

    const result = await getTeamMembershipRequests('team-1');

    expect(result.data).toHaveLength(1);
    expect(result.data[0].documentId).toBe('tmr-invitation');
    expect(result.data[0].direction).toBe('invite');
  });

  test('temoin 2 — une ligne heritee (`direction: null`) passe elle aussi, inchangee', async () => {
    mockGet.mockResolvedValue({ data: { data: [DEMANDE_HERITEE], meta: { pagination: PAGINATION } } });

    const result = await getTeamMembershipRequests('team-1');

    expect(result.data).toHaveLength(1);
    expect(result.data[0].direction).toBeNull();
  });

  test('temoin 3 — `inviteToTeam` poste sur la route NEUVE, avec la candidature d origine', async () => {
    mockPost.mockResolvedValue({ data: { data: { documentId: 'tmr-cree' } } });

    await inviteToTeam({
      sourceApplication: 'application-1',
      team: 'team-1',
      user: 'candidate-1',
    });

    expect(mockPost).toHaveBeenCalledWith('/team-membership-requests/invite', {
      data: {
        sourceApplication: 'application-1',
        team: 'team-1',
        user: 'candidate-1',
      },
    });
  });

  test('temoin 4 — accepter et refuser une invitation empruntent leurs PROPRES routes', async () => {
    mockPost.mockResolvedValue({ data: { data: {} } });

    await acceptTeamInvitation('tmr-invitation');
    await refuseTeamInvitation('tmr-invitation');

    expect(mockPost).toHaveBeenNthCalledWith(1, '/team-membership-requests/tmr-invitation/accept-invite');
    expect(mockPost).toHaveBeenNthCalledWith(2, '/team-membership-requests/tmr-invitation/refuse-invite');
    // ⛔ Jamais /accept ni /refuse : ce sont les routes du STAFF sur une DEMANDE.
    const chemins = mockPost.mock.calls.map(([chemin]) => chemin);
    expect(chemins.some((chemin) => /\/(accept|refuse)$/.test(chemin))).toBe(false);
  });

  test('temoin 5 — un refus du serveur GARDE son statut jusqu a l ecran', async () => {
    mockPost.mockRejectedValue({
      message: 'Request failed',
      response: { data: { error: { message: 'Forbidden' } }, status: 403 },
    });

    await expect(acceptTeamInvitation('tmr-invitation')).rejects.toMatchObject({
      message: 'Forbidden',
      status: 403,
    });
  });
});
