import {
  getClubCertificationLabel,
  isPartnerClub,
  isVerifiedClub,
} from './clubCertification';

describe('clubCertification utils', () => {
  test('recognizes only the new partner flag', () => {
    expect(isPartnerClub({ clubPartner: true, isCustomer: false })).toBe(true);
    expect(isPartnerClub({ clubPartner: false, isCustomer: true })).toBe(false);
    expect(isPartnerClub({ clubPartner: false, isCustomer: false })).toBe(false);
  });

  test('keeps certification tied to clubVerified when available', () => {
    expect(isVerifiedClub({ clubPartner: true, clubVerified: false })).toBe(false);
    expect(getClubCertificationLabel({ clubPartner: true, clubVerified: false })).toBe('Non certifiée');
    expect(isVerifiedClub({ clubPartner: true, clubVerified: true })).toBe(true);
    expect(getClubCertificationLabel({ clubPartner: true, clubVerified: true })).toBe('Vérifié');
    expect(isVerifiedClub({ clubPartner: true })).toBe(false);
  });
});
