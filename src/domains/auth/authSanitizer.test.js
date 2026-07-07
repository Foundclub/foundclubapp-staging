import { sanitizeUser } from './authSanitizer';

describe('authSanitizer', () => {
  test('preserves club partner and verification flags', () => {
    const sanitized = sanitizeUser({
      club: {
        clubPartner: true,
      clubVerified: false,
      documentId: 'club-1',
      name: 'FC Example',
      },
      clubs: [],
      documentId: 'user-1',
      id: 1,
      phoneNumber: '+33600000000',
      role: {
        documentId: 'role-1',
        name: 'Dirigeant',
        type: 'dirigeant',
      },
    });

    expect(sanitized?.club).toEqual(expect.objectContaining({
      clubPartner: true,
      clubVerified: false,
      documentId: 'club-1',
    }));
  });
});
