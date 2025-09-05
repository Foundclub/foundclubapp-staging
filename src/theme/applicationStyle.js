import ButtonStyle from '@/theme/components/buttonStyle';
import NavigationStyle from '@/theme/components/navigationStyle';

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
    resizeMode: resizeModes.contain,
    width: 16,
  },
  icon20: {
    height: 20,
    resizeMode: resizeModes.contain,
    width: 20,
  },
  icon24: {
    height: 24,
    resizeMode: resizeModes.contain,
    width: 24,
  },
  icon28: {
    height: 28,
    resizeMode: resizeModes.contain,
    width: 28,
  },
  icon48: {
    height: 48,
    resizeMode: resizeModes.contain,
    width: 48,
  },
  roundIcon40: {
    borderRadius: 40,
    height: 40,
    resizeMode: resizeModes.cover,
    width: 40,
  },
  roundIcon55: {
    borderRadius: 55,
    height: 55,
    resizeMode: resizeModes.cover,
    width: 55,
  },
  // Shadows
  shadow100: {
    // iOS shadow
    shadowColor: '#000000',
    shadowOffset: {
      height: 5,
      width: 5,
    },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    // Android shadow
    elevation: 5,
  },
  shadow200: {
    // iOS shadow
    shadowColor: '#000000',
    shadowOffset: {
      height: 5,
      width: 5,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    // Android shadow
    elevation: 10,
  },
  shadow300: {
    // iOS shadow
    shadowColor: '#000000',
    shadowOffset: {
      height: 5,
      width: 5,
    },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    // Android shadow
    elevation: 20,
  },
};

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
  ...staticStyle,
});
