import ButtonStyle from '@/theme/components/buttonStyle';
import NavigationStyle from '@/theme/components/navigationStyle';
import { Platform } from 'react-native';

/**
 * Generate classes defining background color for every colors defined : [colorName]Background
 * @param {import('./types').Colors} colors - The colors object.
 * @returns {import('./types').StyleWithColors} - The generated classes.
 */
const backgroundColors = (colors) => {
  /**
   * @type {import('./types').StyleWithColors}}
   */
  // @ts-ignore
  const initialAcc = {
    transparent: { backgroundColor: 'transparent' },
  };
  return Object.entries(colors).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]: {
        backgroundColor: value,
      },
    }),
    initialAcc,
  );
};

/**
 * Generate classes defining tint color for every colors defined : [colorName]Tint
 * @param {import('./types').Colors} colors - The colors object.
 * @returns {import('./types').StyleWithColors} - The generated classes.
 */
const tintColors = (colors) => {
  /**
   * @type {import('./types').StyleWithColors}}
   */
  // @ts-ignore
  const initialAcc = {};
  return Object.entries(colors).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]: {
        tintColor: value,
      },
    }),
    initialAcc,
  );
};

/**
 * Generate classes defining border color for every colors defined : [colorName]Border
 * @param {import('./types').Colors} colors - The colors object.
 * @returns {import('./types').StyleWithColors} - The generated classes.
 */
const borderColor = (colors) => {
  /**
   * @type {import('./types').StyleWithColors}
   */
  // @ts-ignore
  const initialAcc = {};
  return Object.entries(colors).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]: {
        borderColor: value,
      },
    }),
    initialAcc,
  );
};

export const resizeModes = /** @type {const} */ ({
  contain: 'contain',
  cover: 'cover',
});

const buildShadowStyle = ({ elevation, opacity }) => (
  Platform.OS === 'web'
    ? { boxShadow: `0 5px 20px rgba(0, 0, 0, ${opacity})` }
    : {
      elevation,
      shadowColor: '#000000',
      shadowOffset: {
        height: 5,
        width: 5,
      },
      shadowOpacity: opacity,
      shadowRadius: 20,
    }
);

const borderStyles = /** @type {const} */ ({
  dashed: 'dashed',
  dotted: 'dotted',
  solid: 'solid',
});

export const staticStyle = {
  // custom
  separator: {
    height: 1,
  },
  // Border radius
  borderRadius100: {
    borderRadius: 100,
  },
  borderRadius12: {
    borderRadius: 12,
  },
  borderRadius16: {
    borderRadius: 16,
  },
  borderRadius2: {
    borderRadius: 2,
  },
  borderRadius24: {
    borderRadius: 24,
  },
  borderRadius32: {
    borderRadius: 32,
  },
  borderRadius8: {
    borderRadius: 8,
  },
  // Border Width
  borderWidth0: {
    borderWidth: 0,
  },
  borderWidth1: {
    borderWidth: 1,
  },
  borderWidth1Half: {
    borderWidth: 1.5,
  },
  borderWidth2: {
    borderWidth: 2,
  },
  noBorderTop: {
    borderTopWidth: 0,
  },
  // border style
  borderStyleDashed: {
    borderStyle: borderStyles.dashed,
  },
  borderStyleDotted: {
    borderStyle: borderStyles.dotted,
  },
  borderStyleSolid: {
    borderStyle: borderStyles.solid,
  },
  // Opacities
  opacityHalfVisible: {
    opacity: 0.5,
  },
  opacityHidden: {
    opacity: 0,
  },
  opacityQuarterVisible: {
    opacity: 0.25,
  },
  opacityVisible: {
    opacity: 1,
  },
  // icons
  icon16: {
    height: 16,
    width: 16,
  },
  icon20: {
    height: 20,
    width: 20,
  },
  icon24: {
    height: 24,
    width: 24,
  },
  icon28: {
    height: 28,
    width: 28,
  },
  icon48: {
    height: 48,
    width: 48,
  },
  roundIcon40: {
    borderRadius: 40,
    height: 40,
    width: 40,
  },
  roundIcon55: {
    borderRadius: 55,
    height: 55,
    width: 55,
  },
  // Shadows
  shadow100: buildShadowStyle({ elevation: 5, opacity: 0.05 }),
  shadow200: buildShadowStyle({ elevation: 10, opacity: 0.25 }),
  shadow300: buildShadowStyle({ elevation: 20, opacity: 0.5 }),
};

/**
 * Generate component-level primitive styles.
 * @param {import('./types').Colors} colors - Theme colors.
 * @returns {{card: import('react-native').ViewStyle, input: import('react-native').ViewStyle}}
 */
const componentPrimitives = (colors) => ({
  card: {
    backgroundColor: colors.neutral800,
    borderColor: colors.neutral700,
    borderRadius: 16,
    borderWidth: 1,
  },
  input: {
    backgroundColor: colors.transparent,
    borderColor: colors.neutral300,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});

/**
 * Generate the application styles
 * @param {import('./types').Colors} colors - The colors object.
 * @returns {import('./types').ApplicationStyle} - The generated classes.
 */
export default (colors) => ({
  ...NavigationStyle(colors),
  ...ButtonStyle(colors),
  backgroundColor: backgroundColors(colors),
  borderColor: borderColor(colors),
  tintColor: tintColors(colors),
  ...componentPrimitives(colors),
  ...staticStyle,
});
