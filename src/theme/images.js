/* eslint-disable global-require */
import { Appearance } from 'react-native';

export const images = {
  // pictures
  bg1: require('../assets/pictures/bg-1.png'),
  bg2: require('../assets/pictures/bg-2.png'),
  bg3: require('../assets/pictures/bg-3.png'),
  bg4: require('../assets/pictures/bg-4.png'),
  bg5: require('../assets/pictures/bg-5.png'),
  logo: require('../assets/pictures/logo.png'),
  roundAvatar: require('../assets/pictures/avatar-round.png'),
  // icon
  arrowLeft: require('../assets/icons/arrowLeft.png'),
  arrowRight: require('../assets/icons/arrowRight.png'),
  calendar: require('../assets/icons/calendar.png'),
  bell: require('../assets/icons/bell.png'),
  camera: require('../assets/icons/camera.png'),
  check: require('../assets/icons/check.png'),
  chevronDown: require('../assets/icons/chevron-down.png'),
  clock: require('../assets/icons/clock.png'),
  close: require('../assets/icons/close.png'),
  edit: require('../assets/icons/edit.png'),
  euroCircle: require('../assets/icons/euro-circle.png'),
  envelope: require('../assets/icons/envelope.png'),
  filter: require('../assets/icons/filter.png'),
  flag: require('../assets/icons/flag.png'),
  phone: require('../assets/icons/phone.png'),
  pin: require('../assets/icons/pin.png'),
  plus: require('../assets/icons/plus.png'),
  running: require('../assets/icons/running.png'),
  search: require('../assets/icons/search.png'),
  send: require('../assets/icons/send.png'),
  share: require('../assets/icons/share.png'),
  share2: require('../assets/icons/share2.png'),
  shield: require('../assets/icons/shield.png'),
  stadium: require('../assets/icons/stadium.png'),
  strokeShield: require('../assets/icons/stroke-shield.png'),
  trash: require('../assets/icons/trash.png'),
  trashAlt: require('../assets/icons/trash-alt.png'),
  redTrash: require('../assets/icons/redtrash.png'),
  users: require('../assets/icons/users.png'),
  // League Icons (Mapped to existing until assets are added)
  trophy: require('../assets/icons/flag.png'), // Temp mapping
  whistle: require('../assets/icons/stadium.png'), // Temp mapping
  chart: require('../assets/icons/filter.png'), // Temp mapping
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
