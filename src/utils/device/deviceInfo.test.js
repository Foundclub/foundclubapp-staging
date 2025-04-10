import { Platform, Settings } from 'react-native';

import { getDeviceLocale, getDeviceLocaleCountry, getDeviceLocaleLang } from './deviceInfo';

// Mock React Native modules
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
  Settings: {
    get: jest.fn(),
  },
}));

describe('deviceInfo utils', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('getDeviceLocale', () => {
    it('should return locale array for iOS', () => {
      Platform.OS = 'ios';
      Settings.get.mockImplementation((key) => {
        if (key === 'AppleLocale') return 'en_US';
        if (key === 'AppleLanguages') return ['en-US'];
        return null;
      });

      expect(getDeviceLocale()).toEqual(['en', 'US']);
    });

    it('should return locale array for Android', () => {
      Platform.OS = 'android';
      global.Intl = {
        DateTimeFormat: () => ({
          resolvedOptions: () => ({ locale: 'en-US' }),
        }),
      };

      expect(getDeviceLocale()).toEqual(['en', 'US']);
    });
  });

  describe('getDeviceLocaleCountry', () => {
    it('should return country code', () => {
      Platform.OS = 'ios';
      Settings.get.mockImplementation((key) => {
        if (key === 'AppleLocale') return 'en_US';
        return null;
      });

      expect(getDeviceLocaleCountry()).toBe('US');
    });

    it('should return FR as fallback country', () => {
      Platform.OS = 'ios';
      Settings.get.mockImplementation(() => null);

      expect(getDeviceLocaleCountry()).toBe('FR');
    });
  });

  describe('getDeviceLocaleLang', () => {
    it('should return language code', () => {
      Platform.OS = 'ios';
      Settings.get.mockImplementation((key) => {
        if (key === 'AppleLocale') return 'fr_FR';
        return null;
      });

      expect(getDeviceLocaleLang()).toBe('fr');
    });

    it('should return EN as fallback language', () => {
      Platform.OS = 'ios';
      Settings.get.mockImplementation(() => null);

      expect(getDeviceLocaleLang()).toBe('EN');
    });
  });
});
