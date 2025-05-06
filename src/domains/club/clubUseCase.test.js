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
      expect(getClubInitials([])).toBe('');
    });

    it('should return initials for simple club names', () => {
      expect(getClubInitials('Football Club Paris')).toBe('FCP');
      expect(getClubInitials('Sport Club Lyon')).toBe('SCL');
      expect(getClubInitials('Tennis Club Marseille')).toBe('TCM');
    });

    it('should ignore French connecting words', () => {
      expect(getClubInitials('Club de Football de Paris')).toBe('CFP');
      expect(getClubInitials('Association du Sport Lyonnais')).toBe('ASL');
      expect(getClubInitials('Olympique de Marseille')).toBe('OM');
      expect(getClubInitials("Racing Club d'Avignon")).toBe('RCA');
      expect(getClubInitials('Union Sportive de Nice')).toBe('USN');
    });

    it('should handle special characters and accents', () => {
      expect(getClubInitials('École de Football Paris')).toBe('ÉFP');
      expect(getClubInitials('Stade Français Paris')).toBe('SFP');
      expect(getClubInitials('Équipe Athlétique Bordeaux')).toBe('ÉAB');
    });

    it('should handle empty strings and whitespace', () => {
      expect(getClubInitials('')).toBe('');
      expect(getClubInitials('   ')).toBe('');
      expect(getClubInitials('\t\n')).toBe('');
    });

    it('should handle single word names', () => {
      expect(getClubInitials('Arsenal')).toBe('A');
      expect(getClubInitials('Bordeaux')).toBe('B');
    });
  });

  describe('getClubFiltersNumber', () => {
    it('should return 0 for null or undefined input', () => {
      expect(getClubFiltersNumber(null)).toBe(0);
      expect(getClubFiltersNumber(undefined)).toBe(0);
      expect(getClubFiltersNumber({})).toBe(0);
    });

    it('should count geohash filter when present', () => {
      expect(getClubFiltersNumber({ geohash: ['ABC123'] })).toBe(1);
      expect(getClubFiltersNumber({ geohash: ['ABC123', 'DEF456'] })).toBe(1);
    });

    it('should not count empty geohash array', () => {
      expect(getClubFiltersNumber({ geohash: [] })).toBe(0);
    });

    it('should count activity filter when present', () => {
      expect(getClubFiltersNumber({ activity: 'football' })).toBe(1);
      expect(getClubFiltersNumber({ activity: 'tennis' })).toBe(1);
    });

    it('should not count empty activity filter', () => {
      expect(getClubFiltersNumber({ activity: '' })).toBe(0);
      expect(getClubFiltersNumber({ activity: null })).toBe(0);
      expect(getClubFiltersNumber({ activity: undefined })).toBe(0);
    });

    it('should count both filters when present', () => {
      expect(getClubFiltersNumber({
        activity: 'football',
        geohash: ['ABC123'],
      })).toBe(2);
      expect(getClubFiltersNumber({
        activity: 'tennis',
        geohash: ['ABC123', 'DEF456'],
      })).toBe(2);
    });

    it('should handle invalid filter values', () => {
      expect(getClubFiltersNumber({
        activity: '',
        geohash: [],
      })).toBe(0);
      expect(getClubFiltersNumber({
        activity: null,
        geohash: null,
      })).toBe(0);
    });
  });
});
