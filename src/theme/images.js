/* eslint-disable global-require */
import { Appearance } from 'react-native';

export const images = {
  // pictures
  bg1: require('../assets/pictures/bg-1.png'),
  bg2: require('../assets/pictures/bg-2.png'),
  logo: require('../assets/pictures/logo.png'),
  // icon
  chevronDown: require('../assets/icons/chevron-down.png'),
};

/**
 * Get the images for the current theme
 * @param {import('./types').ColorScheme} [theme] - The theme
 * @returns {import('./types').Images} - The images
 */
const getThemeImages = (theme = null) => {
  const scheme = theme || Appearance.getColorScheme();
  /**
   * @type {import('./types').Images}
   */
  // @ts-expect-error because we can't use typescript as type to define the accumulator
  const initialAcc = {};
  return Object.entries(images).reduce((acc, [key, value]) => {
    if (typeof value === 'object' && 'dark' in value && 'light' in value) {
      return {
        ...acc,
        [key]: value[scheme],
      };
    }
    return {
      ...acc,
      [key]: value,
    };
  }, initialAcc);
};

export default getThemeImages;
