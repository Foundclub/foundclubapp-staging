import { Platform, Settings } from 'react-native';
/**
 * Get the device locale
 * @returns {[lang: string, code: import('libphonenumber-js').CountryCode]} The device locale
 */
export const getDeviceLocale = () => {
  const locale = Platform.OS === 'ios'
    ? Settings.get('AppleLocale') || Settings.get('AppleLanguages')?.[0]
    : Intl.DateTimeFormat().resolvedOptions().locale;
  const separator = Platform.OS === 'ios' ? '_' : '-';
  return locale?.split(separator);
};

/**
 * Get the device locale country
 * @returns {import('libphonenumber-js').CountryCode} The device locale country
 */
export const getDeviceLocaleCountry = () => {
  const locales = getDeviceLocale();
  return locales?.[1] || 'FR';
};

/**
 * Get the device locale language
 * @returns {string} The device locale language
 */
export const getDeviceLocaleLang = () => {
  const locales = getDeviceLocale();
  return locales?.[0] || 'EN';
};
