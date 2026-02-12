export const colors = {
  error100: '#ffe1e7',
  error500: '#ff284f',
  error700: '#d02544',

  neutral00: '#ffffff',
  neutral100: '#e5e6e6',
  neutral200: '#d3d4d4',
  neutral300: '#adb1b2',
  neutral400: '#92979a',
  neutral50: '#f1f2f2',
  neutral500: '#777c7e',
  neutral700: '#474b4c',
  neutral800: '#242526',
  neutral900: '#0c0c0d',

  primary100: '#e6f7fe',
  primary200: '#99e1fb',
  primary500: '#01b3f4',
  primary700: '#173844',
  primary900: '#001218',

  success100: '#d4fcf0',
  success500: '#27d6a3',
  success700: '#399379',
  
  warning100: '#fff4e5',
  warning500: '#ffa115',
  warning700: '#cc7a00',

  gold100: '#FFF8E1',
  gold200: '#FFE082',
  gold500: '#FFD700',
  gold700: '#C5A000',
  gold900: '#3D2E0F',

  transparent: 'transparent',
};

/**
 * Get the colors for the current theme
 * @returns {import('./types').Colors} - The colors
 */
const getThemeColors = () => {
  /**
   * @type {import('./types').Colors}
   */
  // @ts-expect-error because we can't use typescript as type to define the accumulator
  const initialAcc = {};
  return Object.entries(colors).reduce((acc, [key, value]) => ({
    ...acc,
    [key]: value,
  }), initialAcc);
};

export default getThemeColors;
