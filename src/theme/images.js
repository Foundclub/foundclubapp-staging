/* eslint-disable global-require */
import { Appearance } from 'react-native';

export const images = {
  // pictures
  bg1: require('../assets/pictures/bg-1.png'),
  bg2: require('../assets/pictures/bg-2.png'),
  bg3: require('../assets/pictures/bg-3.png'),
  logo: require('../assets/pictures/logo.png'),
  roundAvatar: require('../assets/pictures/avatar-round.png'),
  // icon
  arrowLeft: require('../assets/icons/arrowLeft.png'),
  arrowRight: require('../assets/icons/arrowRight.png'),
  camera: require('../assets/icons/camera.png'),
  check: require('../assets/icons/check.png'),
  chevronDown: require('../assets/icons/chevron-down.png'),
  close: require('../assets/icons/close.png'),
  edit: require('../assets/icons/edit.png'),
  envelope: require('../assets/icons/envelope.png'),
  filter: require('../assets/icons/filter.png'),
  phone: require('../assets/icons/phone.png'),
  plus: require('../assets/icons/plus.png'),
  search: require('../assets/icons/search.png'),
  share: require('../assets/icons/share.png'),
  shield: require('../assets/icons/shield.png'),
  trash: require('../assets/icons/trash.png'),
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
    if (scheme && typeof value === 'object' && 'dark' in value && 'light' in value) {
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
