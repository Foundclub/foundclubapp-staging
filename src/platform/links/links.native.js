import { Linking } from 'react-native';

export const openUrl = async (url) => Linking.openURL(url);

// T-PAGES-2 (R8) : sur le site, la même page remplace l'onglet (links.web.js) ; sur le
// téléphone, il n'y a pas d'onglet à garder, le navigateur s'ouvre comme pour openUrl.
export const openUrlInPlace = openUrl;

export const buildDeepLink = (routeName, params = {}) => {
  const query = new URLSearchParams(
    Object.entries(params).reduce((acc, [key, value]) => {
      if (value === undefined || value === null || value === '') {
        return acc;
      }
      return {
        ...acc,
        [key]: String(value),
      };
    }, {}),
  ).toString();

  return `foundclub://${routeName}${query ? `?${query}` : ''}`;
};

export default {
  buildDeepLink,
  openUrl,
  openUrlInPlace,
};
