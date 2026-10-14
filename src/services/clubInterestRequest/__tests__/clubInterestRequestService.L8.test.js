/**
 * PAR-L8 (13/10, design parent E19) — LE SERVICE SAIT RETIRER UNE DEMANDE.
 *
 * Le serveur a une route neuve, `POST /club-interest-requests/:id/cancel` (admin, lot PAR-L8) :
 * le parent retire SA demande de place pour son enfant, encore en attente. POST, comme
 * l'annulation joueur (`/team-membership-requests/:id/cancel`) : le serveur ne lit pas le corps
 * d'un DELETE.
 */

import { cancelClubInterestRequest } from '../clubInterestRequestService';

jest.mock('../../client', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

// eslint-disable-next-line import/first
import client from '../../client';

beforeEach(() => {
  jest.clearAllMocks();
  client.post.mockResolvedValue({ data: { data: { deleted: true, documentId: 'interest-lea' } } });
});

test('🔴 annuler part en POST sur /club-interest-requests/<id>/cancel, sans corps', async () => {
  const reponse = await cancelClubInterestRequest('interest-lea');

  expect(client.post).toHaveBeenCalledWith('/club-interest-requests/interest-lea/cancel');
  expect(reponse).toEqual({ data: { deleted: true, documentId: 'interest-lea' } });
});

test('🔴 sans identifiant, rien ne part (jamais de « /undefined/cancel »)', async () => {
  await expect(cancelClubInterestRequest('  ')).rejects.toThrow(/request id/i);
  expect(client.post).not.toHaveBeenCalled();
});

test('🔴 le refus du serveur remonte tel quel : l écran le traduit', async () => {
  const refus = {
    details: { accepted: true, code: 'CLUB_INTEREST_REQUEST_ALREADY_RESPONDED' },
    status: 400,
  };
  client.post.mockRejectedValue(refus);

  await expect(cancelClubInterestRequest('interest-lea')).rejects.toBe(refus);
});
