import client from '@/services/client';

import {
  acceptStaffInvitation,
  getSentStaffInvitations,
  sendStaffInvitation,
} from '../staffInvitationService';

// INVITE-STAFF (10/11/2026) — le service parle aux portes `admin/.../staff-invitation` :
// la bonne route, le bon corps, et un refus qui garde son CODE (l'écran en dépend).

jest.unmock('@/services/staffInvitation/staffInvitationService');
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock('i18next', () => ({
  t: (/** @type {string} */ cle, /** @type {string} */ repli) => repli || cle,
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('INVITE-STAFF — staffInvitationService', () => {
  it('envoie le rôle, le club, l équipe, le numéro et le prénom ; rien d autre', async () => {
    /** @type {any} */ (client.post).mockResolvedValue({
      data: { data: { invitation: { phoneHint: '78' }, sent: true } },
    });
    const resultat = await sendStaffInvitation({
      clubId: 'club-1',
      firstname: 'Karim',
      phoneNumber: '0612345678',
      role: 'coach',
      teamId: 'team-1',
    });
    expect(client.post).toHaveBeenCalledWith('/staff-invitations', {
      data: {
        clubId: 'club-1',
        firstname: 'Karim',
        phoneCountry: undefined,
        phoneNumber: '0612345678',
        role: 'coach',
        teamId: 'team-1',
      },
    });
    expect(resultat).toEqual({ invitation: { phoneHint: '78' }, sent: true });
  });

  it('un refus garde son code serveur et sa décision d abonnement', async () => {
    /** @type {any} */ (client.post).mockRejectedValue({
      response: {
        data: { error: { details: { code: 'STAFF_INVITE_MINOR' }, message: 'STAFF_INVITE_MINOR' } },
        status: 403,
      },
    });
    await expect(acceptStaffInvitation('inv-1')).rejects.toMatchObject({
      code: 'STAFF_INVITE_MINOR',
      status: 403,
    });
    expect(client.post).toHaveBeenCalledWith('/staff-invitations/inv-1/accept');
  });

  it('la liste en attente se lit par club', async () => {
    /** @type {any} */ (client.get).mockResolvedValue({
      data: { data: { invitations: [{ documentId: 'i1' }] } },
    });
    await expect(getSentStaffInvitations('club-1')).resolves.toEqual([{ documentId: 'i1' }]);
    expect(client.get).toHaveBeenCalledWith('/staff-invitations/sent', {
      params: { clubId: 'club-1', withRefused: 1 }, // INVITE-REFUS (274 B)
    });
  });
});
