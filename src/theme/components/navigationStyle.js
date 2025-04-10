/**
 * Returns the navigation style based on the provided colors.
 * @param {import('../types').Colors} colors - The colors object.
 * @returns {import('../types').NavigationStyle} - The navigation style object.
 */
export default (colors) => ({
  // navigation container style
  darkNavigationTheme: {
    colors: {
      background: colors.primary900,
      border: colors.primary500,
      card: colors.primary900,
      notification: colors.primary500,
      primary: colors.primary500,
      text: colors.neutral00,
    },
    dark: true,
    fonts: {
      bold: {
        fontFamily: 'Montserrat-Bold',
        fontWeight: 'normal',
      },
      heavy: {
        fontFamily: 'Montserrat-Black',
        fontWeight: 'normal',
      },
      medium: {
        fontFamily: 'Montserrat-Regular',
        fontWeight: 'normal',
      },
      regular: {
        fontFamily: 'Montserrat-Regular',
        fontWeight: 'normal',
      },
    },
  },
  lightNavigationTheme: {
    colors: {
      background: '#F1F1EF',
      border: '#F1F1EF',
      card: '#F1F1EF',
      notification: '#7A5D15',
      primary: '#7A5D15',
      text: '#0F0609',
    },
    dark: false,
    fonts: {
      bold: {
        fontFamily: 'Montserrat-Bold',
        fontWeight: 'normal',
      },
      heavy: {
        fontFamily: 'Montserrat-Black',
        fontWeight: 'normal',
      },
      medium: {
        fontFamily: 'Montserrat-Regular',
        fontWeight: 'normal',
      },
      regular: {
        fontFamily: 'Montserrat-Regular',
        fontWeight: 'normal',
      },
    },
  },

});
