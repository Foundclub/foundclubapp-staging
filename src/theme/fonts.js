export const sizes = {
  h1Size: 32,
  h2Size: 28,
  h3Size: 24,
  h4Size: 20,
  h5Size: 18,
  p1Size: 16,
  p2Size: 14,
  p3Size: 14,
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
  boldItalic: {
    fontWeight: 'bold',
    fontStyle: 'italic',
  },
  bold: {
    fontWeight: 'bold',
  },
  italic: {
    fontStyle: 'italic',
  },
  regular: {
    fontWeight: 'normal',
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
    lineHeight: 40,
    fontFamily: 'Metropolis-Regular',
    color: 'black',
  },
  h1Bold: {
    fontSize: sizes.h1Size,
    lineHeight: 40,
    fontFamily: 'Metropolis-Bold',
    color: 'black',

  },
  h2: {
    fontSize: sizes.h2Size,
    lineHeight: 32,
    fontFamily: 'Metropolis-Regular',
    color: 'black',

  },
  h2Bold: {
    fontSize: sizes.h2Size,
    lineHeight: 32,
    fontFamily: 'Metropolis-Bold',
    color: 'black',

  },
  h3: {
    fontSize: sizes.h3Size,
    lineHeight: 28,
    fontWeight: 400,
    fontFamily: 'Metropolis-Regular',
    color: 'black',

  },
  h3Bold: {
    fontSize: sizes.h3Size,
    lineHeight: 28,
    fontWeight: 700,
    fontFamily: 'Metropolis-Bold',
    color: 'black',

  },
  h4: {
    fontSize: sizes.h4Size,
    lineHeight: 24,
    fontWeight: 400,
    fontFamily: 'Metropolis-Regular',
    color: 'black',

  },
  h4Bold: {
    fontSize: sizes.h4Size,
    lineHeight: 24,
    fontWeight: 700,
    fontFamily: 'Metropolis-Bold',
    color: 'black',

  },
  h5: {
    fontSize: sizes.h5Size,
    lineHeight: 22,
    fontFamily: 'HankenGrotesk-Regular',
    color: 'black',

  },
  h5Bold: {
    fontSize: sizes.h5Size,
    lineHeight: 22,
    fontFamily: 'HankenGrotesk-Bold',
    color: 'black',

  },
  p1: {
    fontSize: sizes.p1Size,
    lineHeight: 20,
    fontFamily: 'HankenGrotesk-Regular',
    color: 'black',

  },
  p1Bold: {
    fontSize: sizes.p1Size,
    lineHeight: 20,
    fontFamily: 'HankenGrotesk-Bold',
    color: 'black',

  },
  p2: {
    fontSize: sizes.p2Size,
    lineHeight: 18,
    fontWeight: 400,
    fontFamily: 'HankenGrotesk-Regular',
    color: 'black',

  },
  p2Bold: {
    fontSize: sizes.p2Size,
    lineHeight: 18,
    fontWeight: 700,
    fontFamily: 'HankenGrotesk-Bold',
    color: 'black',

  },
  p3: {
    fontSize: sizes.p3Size,
    lineHeight: 18,
    fontFamily: 'HankenGrotesk-Regular',
    color: 'black',

  },
  p3Bold: {
    fontSize: sizes.p3Size,
    lineHeight: 18,
    fontFamily: 'HankenGrotesk-Bold',
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
