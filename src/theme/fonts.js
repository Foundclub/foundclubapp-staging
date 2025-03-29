export const sizes = {
  h1Size: 28,
  h2Size: 24,
  h3Size: 20,
  h4Size: 18,
  p1Size: 16,
  p2Size: 14,
  p3Size: 12,
};

export const lineHeights = {
  h1Height: 36,
  h2Height: 32,
  h3Height: 28,
  h4Height: 24,
  p1Height: 23,
  p2Height: 21,
  p3Height: 18,
};

/**
 * Generate classes defining text color for every colors defined in the Colors file
 * @param {import('./types').Colors} colors - The colors object.
 * @returns {import('./types').StyleWithColors} - The generated classes.
 */
const coloredText = (colors) => {
  /**
   * @type {import('./types').StyleWithColors}
   */
  // @ts-expect-error because we can't use typescript as type to define the accumulator
  const initialAcc = {};
  return Object.entries(colors).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]: {
        color: value,
      },
    }),
    initialAcc,
  );
};

/**
 * Generate classes defining font size for every sizes defined above : [sizeName]
 * @returns {import('./types').FontSizes} - The generated classes.
 */
const fontSize = () => {
  /**
   * @type {import('./types').FontSizes}
   */
  // @ts-expect-error because we can't use typescript as type to define the accumulator
  const initialAcc = {};
  return Object.entries(sizes).reduce(
    (acc, [key, value]) => ({
      ...acc,
      [key]: {
        fontSize: value,
      },
    }),
    initialAcc,
  );
};

export const staticFontStyle = {
  capitalize: {
    textTransform: 'capitalize',
  },
  uppercase: {
    textTransform: 'uppercase',
  },
  lowercase: {
    textTransform: 'lowercase',
  },
  italic: {
    fontStyle: 'italic',
  },
  underlineText: {
    textDecorationLine: 'underline',
  },
  textCenter: {
    textAlign: 'center',
  },
  textJustify: {
    textAlign: 'justify',
  },
  textLeft: {
    textAlign: 'left',
  },
  textRight: {
    textAlign: 'right',
  },
  // from design system
  h1: {
    fontSize: sizes.h1Size,
    lineHeight: lineHeights.h1Height,
    fontFamily: 'Montserrat-Regular',
    color: 'black',
  },
  h1Bold: {
    fontSize: sizes.h1Size,
    lineHeight: lineHeights.h1Height,
    fontFamily: 'Montserrat-Bold',
    color: 'black',
  },
  h1Black: {
    fontSize: sizes.h1Size,
    lineHeight: lineHeights.h1Height,
    fontFamily: 'Montserrat-Black',
    color: 'black',
  },
  h2: {
    fontSize: sizes.h2Size,
    lineHeight: lineHeights.h2Height,
    fontFamily: 'Montserrat-Regular',
    color: 'black',
  },
  h2Bold: {
    fontSize: sizes.h2Size,
    lineHeight: lineHeights.h2Height,
    fontFamily: 'Montserrat-Bold',
    color: 'black',
  },
  h2Black: {
    fontSize: sizes.h2Size,
    lineHeight: lineHeights.h2Height,
    fontFamily: 'Montserrat-Black',
    color: 'black',
  },
  h3: {
    fontSize: sizes.h3Size,
    lineHeight: lineHeights.h3Height,
    fontFamily: 'Montserrat-Regular',
    color: 'black',
  },
  h3Bold: {
    fontSize: sizes.h3Size,
    lineHeight: lineHeights.h3Height,
    fontFamily: 'Montserrat-Bold',
    color: 'black',
  },
  h3Black: {
    fontSize: sizes.h3Size,
    lineHeight: lineHeights.h3Height,
    fontFamily: 'Montserrat-Black',
    color: 'black',
  },
  h4: {
    fontSize: sizes.h4Size,
    lineHeight: lineHeights.h4Height,
    fontFamily: 'Montserrat-Regular',
    color: 'black',
  },
  h4Bold: {
    fontSize: sizes.h4Size,
    lineHeight: lineHeights.h4Height,
    fontFamily: 'Montserrat-Bold',
    color: 'black',
  },
  h4Black: {
    fontSize: sizes.h4Size,
    lineHeight: lineHeights.h4Height,
    fontFamily: 'Montserrat-Black',
    color: 'black',
  },
  p1: {
    fontSize: sizes.p1Size,
    lineHeight: lineHeights.p1Height,
    fontFamily: 'Montserrat-Regular',
    color: 'black',
  },
  p1Bold: {
    fontSize: sizes.p1Size,
    lineHeight: lineHeights.p1Height,
    fontFamily: 'Montserrat-Bold',
    color: 'black',
  },
  p1Black: {
    fontSize: sizes.p1Size,
    lineHeight: lineHeights.p1Height,
    fontFamily: 'Montserrat-Black',
    color: 'black',
  },
  p2: {
    fontSize: sizes.p2Size,
    lineHeight: lineHeights.p2Height,
    fontFamily: 'Montserrat-Regular',
    color: 'black',
  },
  p2Bold: {
    fontSize: sizes.p2Size,
    lineHeight: lineHeights.p2Height,
    fontFamily: 'Montserrat-Bold',
    color: 'black',
  },
  p2Black: {
    fontSize: sizes.p2Size,
    lineHeight: lineHeights.p2Height,
    fontFamily: 'Montserrat-Black',
    color: 'black',
  },
  p3: {
    fontSize: sizes.p3Size,
    lineHeight: lineHeights.p3Height,
    fontFamily: 'Montserrat-Regular',
    color: 'black',
  },
  p3Bold: {
    fontSize: sizes.p3Size,
    lineHeight: lineHeights.p3Height,
    fontFamily: 'Montserrat-Bold',
    color: 'black',
  },
  p3Black: {
    fontSize: sizes.p3Size,
    lineHeight: lineHeights.p3Height,
    fontFamily: 'Montserrat-Black',
    color: 'black',
  },
};

/**
 * Generate the application fonts
 * @param {import('./types').Colors} colors - The colors of selected theme
 * @returns { import('./types').StyleWithColors
 * & import('./types').FontSizes & import('./types').StaticFontStyle }
 */
export default (colors) => ({
  ...coloredText(colors),
  ...fontSize(),
  ...staticFontStyle,
});
