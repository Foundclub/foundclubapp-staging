// BH02 (BUGHUNT 24/10) — P3-11 : le pays de l'appareil.
import { Platform, Settings } from 'react-native';

import { getDeviceLocaleCountry } from './deviceInfo';

jest.mock('react-native', () => ({ Platform: { OS: 'ios' }, Settings: { get: jest.fn() } }));

const IntlDOrigine = global.Intl;
afterEach(() => { global.Intl = IntlDOrigine; });

it('iOS, repli AppleLanguages « en-US » : US', () => {
  Platform.OS = 'ios';
  Settings.get.mockImplementation((key) => (key === 'AppleLanguages' ? ['en-US'] : null));
  expect(getDeviceLocaleCountry()).toBe('US');
});

it('Android « zh-Hans-CN » : CN', () => {
  Platform.OS = 'android';
  global.Intl = { DateTimeFormat: () => ({ resolvedOptions: () => ({ locale: 'zh-Hans-CN' }) }) };
  expect(getDeviceLocaleCountry()).toBe('CN');
});
