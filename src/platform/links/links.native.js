import { Linking } from 'react-native';

export const openUrl = async (url) => Linking.openURL(url);

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
};
