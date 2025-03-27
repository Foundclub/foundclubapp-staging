import NavigationStyle from './components/navigationStyle';
import ButtonStyle from './components/buttonStyle';

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
  solid: 'solid',
  dotted: 'dotted',
  dashed: 'dashed',
});

export const staticStyle = {
  // Border radius
  borderRadius2: {
    borderRadius: 2,
  },
  borderRadius8: {
    borderRadius: 8,
  },
  borderRadius16: {
    borderRadius: 16,
  },
  borderRadius32: {
    borderRadius: 32,
  },
  borderRadius100: {
    borderRadius: 100,
  },
  // Border Width
  borderWidth1: {
    borderWidth: 1,
  },
  borderTopWidth1: {
    borderTopWidth: 1,
  },
  borderWidth1Half: {
    borderWidth: 1.5,
  },
  borderWidth2: {
    borderWidth: 2,
  },
  // border style
  borderStyleSolid: {
    borderStyle: borderStyles.solid,
  },
  borderStyleDotted: {
    borderStyle: borderStyles.dotted,
  },
  borderStyleDashed: {
    borderStyle: borderStyles.dashed,
  },
  // Opacities
  opacityVisible: {
    opacity: 1,
  },
  opacityHalfVisible: {
    opacity: 0.5,
  },
  opacityQuarterVisible: {
    opacity: 0.25,
  },
  opacityHidden: {
    opacity: 0,
  },
  // icons
  icon20: {
    width: 20,
    height: 20,
    resizeMode: resizeModes.contain,
  },
  icon24: {
    width: 24,
    height: 24,
    resizeMode: resizeModes.contain,
  },
  icon28: {
    width: 28,
    height: 28,
    resizeMode: resizeModes.contain,
  },
  icon32: {
    width: 32,
    height: 32,
    resizeMode: resizeModes.contain,
  },
  icon44: {
    width: 44,
    height: 44,
    resizeMode: resizeModes.cover,
  },
  dashedSeparator: {
    borderStyle: borderStyles.dashed,
    borderWidth: 1,
    margin: -2,
    marginBottom: 0,
    height: 3,
  },
  // Shadows
  cardShadow: {
    // iOS shadow
    shadowColor: '#000000',
    shadowOffset: {
      width: 5,
      height: 5,
    },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    // Android shadow
    elevation: 10,
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
  borderColor: borderColor(colors),
  backgroundColor: backgroundColors(colors),
  ...staticStyle,
});
