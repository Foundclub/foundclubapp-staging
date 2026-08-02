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
    expect(getClubCertificationLabel({ clubPartner: true, clubVerified: false })).toBe('Non certifié');
    expect(isVerifiedClub({ clubPartner: true, clubVerified: true })).toBe(true);
    expect(getClubCertificationLabel({ clubPartner: true, clubVerified: true })).toBe('Certifié');
    expect(isVerifiedClub({ clubPartner: true })).toBe(false);
  });

  // R10 — un seul vocabulaire cote utilisateur : CERTIFIE. Le mot « vérifié »
  // appartient a la console SuperAdmin, qui est la seule a pouvoir agir.
  test('ne parle jamais de « vérifié » a l utilisateur final', () => {
    [true, false].forEach((clubVerified) => {
      expect(getClubCertificationLabel({ clubVerified })).not.toMatch(/vérifi/i);
      expect(getClubCertificationLabel({ clubVerified })).toMatch(/certifié/i);
    });
  });
});
