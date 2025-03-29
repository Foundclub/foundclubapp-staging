/**
 * Returns the navigation style based on the provided colors.
 * @param {import('../types').Colors} colors - The colors object.
 * @returns {import('../types').NavigationStyle} - The navigation style object.
 */
export default (colors) => ({
  // navigation container style
  darkNavigationTheme: {
    dark: true,
    colors: {
      background: colors.primary900,
      primary: colors.primary500,
      card: colors.primary900,
      text: colors.neutral00,
      border: colors.primary500,
      notification: colors.primary500,
    },
    fonts: {
      regular: {
        fontFamily: 'Montserrat-Regular',
        fontWeight: 'normal',
      },
      medium: {
        fontFamily: 'Montserrat-Regular',
        fontWeight: 'normal',
      },
      bold: {
        fontFamily: 'Montserrat-Bold',
        fontWeight: 'normal',
      },
      heavy: {
        fontFamily: 'Montserrat-Black',
        fontWeight: 'normal',
      },
    },
  },
  lightNavigationTheme: {
    dark: false,
    colors: {
      background: '#F1F1EF',
      primary: '#7A5D15',
      card: '#F1F1EF',
      text: '#0F0609',
      border: '#F1F1EF',
      notification: '#7A5D15',
    },
    fonts: {
      regular: {
        fontFamily: 'Montserrat-Regular',
        fontWeight: 'normal',
      },
      medium: {
        fontFamily: 'Montserrat-Regular',
        fontWeight: 'normal',
      },
      bold: {
        fontFamily: 'Montserrat-Bold',
        fontWeight: 'normal',
      },
      heavy: {
        fontFamily: 'Montserrat-Black',
        fontWeight: 'normal',
      },
    },
  },

});
