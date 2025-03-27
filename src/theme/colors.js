import { Appearance } from 'react-native';

export const colors = {
  transparent: 'transparent',
  primaryDarkBlue: {
    dark: '#210266',
    light: '#210266',
  },
  primaryBlue: {
    dark: '#3D3C9A',
    light: '#3D3C9A',
  },
  primaryLightBlue: {
    dark: '#536DFE',
    light: '#536DFE',
  },
  primaryDarkViolet: {
    dark: '#592DAB',
    light: '#592DAB',
  },
  primaryViolet: {
    dark: '#922BE7',
    light: '#922BE7',
  },
  primaryOrange: {
    dark: '#FF6128',
    light: '#FF6128',
  },
  primaryYellow: {
    dark: '#FFE036',
    light: '#FFE036',
  },
  primaryGreen: {
    dark: '#1BE2A8',
    light: '#1BE2A8',
  },
  neutral252: {
    dark: '#252C3D',
    light: '#252C3D',
  },
  neutral515: {
    dark: '#515664',
    light: '#515664',
  },
  neutral7C8: {
    dark: '#7C808B',
    light: '#7C808B',
  },
  neutralB3B: {
    dark: '#B3B6BC',
    light: '#B3B6BC',
  },
  neutralD3D: {
    dark: '#D3D5D8',
    light: '#D3D5D8',
  },
  neutralF4F: {
    dark: '#F4F4F5',
    light: '#F4F4F5',
  },
  neutralFFF: {
    dark: '#FFFFFF',
    light: '#FFFFFF',
  },
  error700: {
    dark: '#E5254B',
    light: '#E5254B',
  },
  error500: {
    dark: '#E5254B',
    light: '#E5254B',
  },
  error100: {
    dark: '#FDEDF0',
    light: '#FDEDF0',
  },
  success700: {
    dark: '#399379',
    light: '#399379',
  },
  success500: {
    dark: '#65C3A8',
    light: '#65C3A8',
  },
  success100: {
    dark: '#E9F6F3',
    light: '#E9F6F3',
  },
};

/**
 * Get the colors for the current theme
 * @param {import('./types').ColorScheme} [theme] - The theme
 * @returns {import('./types').Colors} - The colors
 */
const getThemeColors = (theme = null) => {
  const scheme = theme || Appearance.getColorScheme();
  /**
   * @type {import('./types').Colors}
   */
  // @ts-expect-error because we can't use typescript as type to define the accumulator
  const initialAcc = {};
  return Object.entries(colors).reduce((acc, [key, value]) => {
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

export default getThemeColors;
