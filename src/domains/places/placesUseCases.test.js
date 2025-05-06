import { encode } from 'ngeohash';

import { getGeohashForPointAndRadius } from './placesUseCases';

jest.mock('ngeohash', () => ({
  encode: jest.fn(),
}));

describe('placesUseCases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    encode.mockImplementation((lat, lon, precision) => `mock-geohash-${precision}`);
  });

  describe('getGeohashForPointAndRadius', () => {
    it('should handle invalid radius', () => {
      expect(getGeohashForPointAndRadius(48.8566, 2.3522, -1)).toBe('mock-geohash-8');
      expect(getGeohashForPointAndRadius(48.8566, 2.3522, 0)).toBe('mock-geohash-8');
    });

    it('should use precision 1 for radius >= 2500km', () => {
      const result = getGeohashForPointAndRadius(48.8566, 2.3522, 3000);
      expect(encode).toHaveBeenCalledWith(48.8566, 2.3522, 1);
      expect(result).toBe('mock-geohash-1');
    });

    it('should use precision 2 for radius >= 625km', () => {
      const result = getGeohashForPointAndRadius(48.8566, 2.3522, 700);
      expect(encode).toHaveBeenCalledWith(48.8566, 2.3522, 2);
      expect(result).toBe('mock-geohash-2');
    });

    it('should use precision 3 for radius >= 78km', () => {
      const result = getGeohashForPointAndRadius(48.8566, 2.3522, 100);
      expect(encode).toHaveBeenCalledWith(48.8566, 2.3522, 3);
      expect(result).toBe('mock-geohash-3');
    });

    it('should use precision 4 for radius >= 20km', () => {
      const result = getGeohashForPointAndRadius(48.8566, 2.3522, 30);
      expect(encode).toHaveBeenCalledWith(48.8566, 2.3522, 4);
      expect(result).toBe('mock-geohash-4');
    });

    it('should use precision 5 for radius >= 2.5km', () => {
      const result = getGeohashForPointAndRadius(48.8566, 2.3522, 3);
      expect(encode).toHaveBeenCalledWith(48.8566, 2.3522, 5);
      expect(result).toBe('mock-geohash-5');
    });

    it('should use precision 6 for radius >= 0.6km', () => {
      const result = getGeohashForPointAndRadius(48.8566, 2.3522, 0.7);
      expect(encode).toHaveBeenCalledWith(48.8566, 2.3522, 6);
      expect(result).toBe('mock-geohash-6');
    });

    it('should use precision 7 for radius >= 0.076km', () => {
      const result = getGeohashForPointAndRadius(48.8566, 2.3522, 0.1);
      expect(encode).toHaveBeenCalledWith(48.8566, 2.3522, 7);
      expect(result).toBe('mock-geohash-7');
    });

    it('should use precision 8 for radius < 0.076km', () => {
      const result = getGeohashForPointAndRadius(48.8566, 2.3522, 0.05);
      expect(encode).toHaveBeenCalledWith(48.8566, 2.3522, 8);
      expect(result).toBe('mock-geohash-8');
    });

    it('should handle boundary cases for radius values', () => {
      // Test exact boundary values
      expect(getGeohashForPointAndRadius(48.8566, 2.3522, 2500)).toBe('mock-geohash-1');
      expect(getGeohashForPointAndRadius(48.8566, 2.3522, 625)).toBe('mock-geohash-2');
      expect(getGeohashForPointAndRadius(48.8566, 2.3522, 78)).toBe('mock-geohash-3');
      expect(getGeohashForPointAndRadius(48.8566, 2.3522, 20)).toBe('mock-geohash-4');
      expect(getGeohashForPointAndRadius(48.8566, 2.3522, 2.5)).toBe('mock-geohash-5');
      expect(getGeohashForPointAndRadius(48.8566, 2.3522, 0.6)).toBe('mock-geohash-6');
      expect(getGeohashForPointAndRadius(48.8566, 2.3522, 0.076)).toBe('mock-geohash-7');
    });

    it('should handle extreme coordinate values', () => {
      // Test edge cases for coordinates
      expect(getGeohashForPointAndRadius(90, 180, 100)).toBe('mock-geohash-3'); // Max valid coordinates
      expect(getGeohashForPointAndRadius(-90, -180, 100)).toBe('mock-geohash-3'); // Min valid coordinates
      expect(getGeohashForPointAndRadius(0, 0, 100)).toBe('mock-geohash-3'); // Null island
    });
  });
});
