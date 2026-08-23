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
  resolveTeamInvitationAvailability,
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
    mockGet.mockResolvedValue({
      data: { data: [DEMANDE_HERITEE], meta: { pagination: PAGINATION } },
    });

    const result = await getTeamMembershipRequests('team-1');

    expect(result.data).toHaveLength(1);
    expect(result.data[0].direction).toBeNull();
  });

  test('temoin 3 — `inviteToTeam` poste sur la route NEUVE, avec sa candidature', async () => {
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

  test('temoin 4 — accepter et refuser empruntent leurs PROPRES routes', async () => {
    mockPost.mockResolvedValue({ data: { data: {} } });

    await acceptTeamInvitation('tmr-invitation');
    await refuseTeamInvitation('tmr-invitation');

    const BASE = '/team-membership-requests/tmr-invitation';
    expect(mockPost).toHaveBeenNthCalledWith(1, `${BASE}/accept-invite`);
    expect(mockPost).toHaveBeenNthCalledWith(2, `${BASE}/refuse-invite`);
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

describe('P10 (D11) — qui peut etre invite, et qui ne peut pas', () => {
  const TEAM = 'team-1';

  test('temoin 6 — une candidature portee par un COMPTE peut etre invitee', () => {
    const resultat = resolveTeamInvitationAvailability(
      { applicant: { documentId: 'candidate-1' }, documentId: 'app-1' },
      TEAM,
    );

    expect(resultat).toEqual({ candidateId: 'candidate-1', canInvite: true, reason: '' });
  });

  test('🔴 temoin 7 — un LEAD SANS COMPTE ne peut PAS etre invite, et le motif est nomme', () => {
    // La candidature ne porte que des instantanes : il n y a personne a qui
    // demander son consentement.
    const resultat = resolveTeamInvitationAvailability(
      {
        documentId: 'app-2',
        emailSnapshot: 'lead@example.test',
        phoneSnapshot: '0600000000',
      },
      TEAM,
    );

    expect(resultat.canInvite).toBe(false);
    expect(resultat.reason).toBe('no-account');
    expect(resultat.candidateId).toBe('');
  });

  test('temoin 8 — sans equipe sur l annonce, on n invite nulle part', () => {
    const resultat = resolveTeamInvitationAvailability(
      { applicant: { documentId: 'candidate-1' }, documentId: 'app-3' },
      '',
    );

    expect(resultat.canInvite).toBe(false);
    expect(resultat.reason).toBe('missing-team');
  });
});
