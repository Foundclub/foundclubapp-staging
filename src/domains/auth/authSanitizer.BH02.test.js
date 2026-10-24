// BH02 (BUGHUNT 24/10) : témoin P1-05 / P1-25, la signature voit téléphone, e-mail et l'état des demandes.
import { haveSameSanitizedUser } from './authSanitizer';

describe('authSanitizer - BH02 P1-05', () => {
  const base = { documentId: 'u1', email: 'a@b.fr', phoneNumber: '1' };
  test('un téléphone ou un e-mail changé change la signature', () => {
    expect(haveSameSanitizedUser(base, { ...base, phoneNumber: '2' })).toBe(false);
    expect(haveSameSanitizedUser(base, { ...base, email: 'c@d.fr' })).toBe(false);
  });
  test('une demande d\'équipe ou de club qui change d\'état change la signature', () => {
    const team = (state) => ({ ...base, teamMembershipRequests: [{ documentId: 'r1', state, direction: 'invite', team: { documentId: 't1' } }] });
    expect(haveSameSanitizedUser(team('pending'), team('accepted'))).toBe(false);
    const club = (state) => ({ ...base, clubMembershipRequests: [{ documentId: 'c1', state }] });
    expect(haveSameSanitizedUser(club('pending'), club('accepted'))).toBe(false);
    expect(haveSameSanitizedUser(team('pending'), team('pending'))).toBe(true);
  });
});
