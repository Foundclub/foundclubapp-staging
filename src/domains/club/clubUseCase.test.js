import { getClubFiltersNumber, getClubInitials } from './clubUseCase';

describe('clubUseCases', () => {
  describe('getClubInitials', () => {
    it('should return empty string for null or undefined input', () => {
      expect(getClubInitials(null)).toBe('');
      expect(getClubInitials(undefined)).toBe('');
    });

    it('should return empty string for non-string input', () => {
      expect(getClubInitials(123)).toBe('');
      expect(getClubInitials({})).toBe('');
    });

    it('should return initials for simple club name', () => {
      expect(getClubInitials('Football Club Paris')).toBe('FCP');
    });

    it('should ignore French connecting words', () => {
      expect(getClubInitials('Club de Football de Paris')).toBe('CFP');
      expect(getClubInitials('Association du Sport Lyonnais')).toBe('ASL');
      expect(getClubInitials('Olympique de Marseille')).toBe('OM');
      expect(getClubInitials("Racing Club d'Avignon")).toBe('RCA');
    });

    it('should handle empty strings and whitespace', () => {
      expect(getClubInitials('')).toBe('');
      expect(getClubInitials('   ')).toBe('');
    });
  });

  describe('getClubFiltersNumber', () => {
    it('should return 0 for null or undefined input', () => {
      expect(getClubFiltersNumber(null)).toBe(0);
      expect(getClubFiltersNumber(undefined)).toBe(0);
    });

    it('should count geohash filter when present', () => {
      expect(getClubFiltersNumber({ geohash: ['ABC123'] })).toBe(1);
    });

    it('should not count empty geohash array', () => {
      expect(getClubFiltersNumber({ geohash: [] })).toBe(0);
    });

    it('should count activity filter when present', () => {
      expect(getClubFiltersNumber({ activity: 'football' })).toBe(1);
    });

    it('should count both filters when present', () => {
      expect(getClubFiltersNumber({
        activity: 'football',
        geohash: ['ABC123'],
      })).toBe(2);
    });

    // Test for commented out name filter in case it gets enabled in the future
    // it('should count name filter when uncommented and present', () => {
    //   expect(getClubFiltersNumber({ name: 'Club Name' })).toBe(1);
    // });
  });
});
