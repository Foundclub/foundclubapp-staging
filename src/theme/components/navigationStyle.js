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
      background: colors.neutral252,
      primary: colors.primaryViolet,
      card: colors.neutral252,
      text: colors.neutralFFF,
      border: colors.neutral252,
      notification: colors.primaryViolet,
    },
    fonts: {
      regular: {
        fontFamily: 'HankenGrotesk-Regular',
        fontWeight: 'normal',
      },
      medium: {
        fontFamily: 'HankenGrotesk-Regular',
        fontWeight: 'normal',
      },
      bold: {
        fontFamily: 'HankenGrotesk-Bold',
        fontWeight: 'bold',
      },
      heavy: {
        fontFamily: 'HankenGrotesk-Bold',
        fontWeight: 'bold',
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
        fontFamily: 'HankenGrotesk-Regular',
        fontWeight: 'normal',
      },
      medium: {
        fontFamily: 'HankenGrotesk-Regular',
        fontWeight: 'normal',
      },
      bold: {
        fontFamily: 'HankenGrotesk-Bold',
        fontWeight: 'bold',
      },
      heavy: {
        fontFamily: 'HankenGrotesk-Bold',
        fontWeight: 'bold',
      },
    },
  },

});
