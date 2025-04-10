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
  italic: {
    fontStyle: 'italic',
  },
  lowercase: {
    textTransform: 'lowercase',
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
  underlineText: {
    textDecorationLine: 'underline',
  },
  uppercase: {
    textTransform: 'uppercase',
  },
  // from design system
  h1: {
    color: 'black',
    fontFamily: 'Montserrat-Regular',
    fontSize: sizes.h1Size,
    fontWeight: '400',
    lineHeight: lineHeights.h1Height,
  },
  h1Black: {
    color: 'black',
    fontFamily: 'Montserrat-Black',
    fontSize: sizes.h1Size,
    lineHeight: lineHeights.h1Height,
  },
  h1Bold: {
    color: 'black',
    fontFamily: 'Montserrat-Bold',
    fontSize: sizes.h1Size,
    lineHeight: lineHeights.h1Height,
  },
  h2: {
    color: 'black',
    fontFamily: 'Montserrat-Regular',
    fontSize: sizes.h2Size,
    fontWeight: '400',
    lineHeight: lineHeights.h2Height,
  },
  h2Black: {
    color: 'black',
    fontFamily: 'Montserrat-Black',
    fontSize: sizes.h2Size,
    lineHeight: lineHeights.h2Height,
  },
  h2Bold: {
    color: 'black',
    fontFamily: 'Montserrat-Bold',
    fontSize: sizes.h2Size,
    lineHeight: lineHeights.h2Height,
  },
  h3: {
    color: 'black',
    fontFamily: 'Montserrat-Regular',
    fontSize: sizes.h3Size,
    fontWeight: '400',
    lineHeight: lineHeights.h3Height,
  },
  h3Black: {
    color: 'black',
    fontFamily: 'Montserrat-Black',
    fontSize: sizes.h3Size,
    lineHeight: lineHeights.h3Height,
  },
  h3Bold: {
    color: 'black',
    fontFamily: 'Montserrat-Bold',
    fontSize: sizes.h3Size,
    lineHeight: lineHeights.h3Height,
  },
  h4: {
    color: 'black',
    fontFamily: 'Montserrat-Regular',
    fontSize: sizes.h4Size,
    fontWeight: '400',
    lineHeight: lineHeights.h4Height,
  },
  h4Black: {
    color: 'black',
    fontFamily: 'Montserrat-Black',
    fontSize: sizes.h4Size,
    lineHeight: lineHeights.h4Height,
  },
  h4Bold: {
    color: 'black',
    fontFamily: 'Montserrat-Bold',
    fontSize: sizes.h4Size,
    lineHeight: lineHeights.h4Height,
  },
  p1: {
    color: 'black',
    fontFamily: 'Montserrat-Regular',
    fontSize: sizes.p1Size,
    fontWeight: '400',
    lineHeight: lineHeights.p1Height,
  },
  p1Black: {
    color: 'black',
    fontFamily: 'Montserrat-Black',
    fontSize: sizes.p1Size,
    lineHeight: lineHeights.p1Height,
  },
  p1Bold: {
    color: 'black',
    fontFamily: 'Montserrat-Bold',
    fontSize: sizes.p1Size,
    lineHeight: lineHeights.p1Height,
  },
  p2: {
    color: 'black',
    fontFamily: 'Montserrat-Regular',
    fontSize: sizes.p2Size,
    fontWeight: '400',
    lineHeight: lineHeights.p2Height,
  },
  p2Black: {
    color: 'black',
    fontFamily: 'Montserrat-Black',
    fontSize: sizes.p2Size,
    lineHeight: lineHeights.p2Height,
  },
  p2Bold: {
    color: 'black',
    fontFamily: 'Montserrat-Bold',
    fontSize: sizes.p2Size,
    lineHeight: lineHeights.p2Height,
  },
  p3: {
    color: 'black',
    fontFamily: 'Montserrat-Regular',
    fontSize: sizes.p3Size,
    fontWeight: '400',
    lineHeight: lineHeights.p3Height,
  },
  p3Black: {
    color: 'black',
    fontFamily: 'Montserrat-Black',
    fontSize: sizes.p3Size,
    lineHeight: lineHeights.p3Height,
  },
  p3Bold: {
    color: 'black',
    fontFamily: 'Montserrat-Bold',
    fontSize: sizes.p3Size,
    lineHeight: lineHeights.p3Height,
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
