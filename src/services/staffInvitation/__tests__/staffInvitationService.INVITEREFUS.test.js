import client from '@/services/client';

import { getSentStaffInvitations } from '../staffInvitationService';

// INVITE-REFUS (« 274 B », 12/11/2026) — la liste du club ne renvoie les invitations refusées
// qu'à l'app qui les demande (`withRefused=1`) : l'app du train 9 les lirait « En attente ».

jest.unmock('@/services/staffInvitation/staffInvitationService');
jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn() },
}));
jest.mock('i18next', () => ({
  t: (/** @type {string} */ cle, /** @type {string} */ repli) => repli || cle,
}));

it('la liste du club demande aussi les refusées (withRefused=1)', async () => {
  /** @type {any} */ (client.get).mockResolvedValue({
    data: { data: { invitations: [{ documentId: 'i1', state: 'refused' }] } },
  });
  await expect(getSentStaffInvitations('club-1')).resolves.toEqual([
    { documentId: 'i1', state: 'refused' },
  ]);
  expect(client.get).toHaveBeenCalledWith('/staff-invitations/sent', {
    params: { clubId: 'club-1', withRefused: 1 },
  });
});
