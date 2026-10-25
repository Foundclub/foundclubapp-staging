import { Platform, Settings } from 'react-native';
/**
 * Get the device locale
 * @returns {[lang: string, code: import('libphonenumber-js').CountryCode]} The device locale
 */
export const getDeviceLocale = () => {
  const locale = Platform.OS === 'ios'
    ? Settings.get('AppleLocale') || Settings.get('AppleLanguages')?.[0]
    : Intl.DateTimeFormat().resolvedOptions().locale;
  // Le repli AppleLanguages s'ecrit « en-US » : les deux separateurs sont admis.
  return locale?.split(/[-_]/);
};

/**
 * Get the device locale country
 * @returns {import('libphonenumber-js').CountryCode} The device locale country
 */
export const getDeviceLocaleCountry = () => {
  const locales = getDeviceLocale();
  // Le pays est le premier sous-element de 2 lettres ou 3 chiffres (« zh-Hans-CN » : CN).
  const country = locales?.slice(1).find((part) => /^([A-Za-z]{2}|\d{3})$/.test(part));
  return /** @type {import('libphonenumber-js').CountryCode} */ (country) || 'FR';
};

/**
 * Get the device locale language
 * @returns {string} The device locale language
 */
export const getDeviceLocaleLang = () => {
  const locales = getDeviceLocale();
  return locales?.[0] || 'EN';
};
