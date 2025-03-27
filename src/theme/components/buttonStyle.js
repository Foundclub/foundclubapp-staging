import { positions } from '../alignements';

const buttonCommonStyle = {
  borderRadius: 8,
  paddingVertical: 12,
  paddingHorizontal: 25,
  justifyContent: positions.center,
  alignItems: positions.center,
};

const smallButtonCommonStyle = {
  borderRadius: 8,
  paddingVertical: 8,
  paddingHorizontal: 16,
  justifyContent: positions.center,
  alignItems: positions.center,
};

const buttonTextCommonStyle = {
  fontSize: 16,
};

/**
 * Returns the styles for the Button component.
 * @param {import('../types').Colors} colors - The colors object.
 * @inheritdoc
 */
const getStyle = (colors) => ({
  buttonTextSmall: {
    fontSize: 14,
  },
  buttonIcon: {
    paddingHorizontal: 12,
    borderRadius: 100,
  },
  buttonPrimaryDark: {
    ...buttonCommonStyle,
    backgroundColor: colors.neutral252,
  },
  buttonPrimary: {
    ...buttonCommonStyle,
    backgroundColor: colors.primaryViolet,
  },
  buttonNeutral: {
    ...buttonCommonStyle,
    backgroundColor: colors.neutral515,
  },
  buttonPrimaryLight: {
    ...buttonCommonStyle,
    backgroundColor: colors.primaryViolet,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonSecondaryDark: {
    ...buttonCommonStyle,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.neutral252,
  },
  buttonSecondaryLight: {
    ...buttonCommonStyle,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primaryBlue,
  },
  buttonPrimaryDarkSmall: {
    ...smallButtonCommonStyle,
    backgroundColor: colors.neutral252,
  },
  buttonPrimarySmall: {
    ...smallButtonCommonStyle,
    backgroundColor: colors.primaryViolet,
  },
  buttonNeutralSmall: {
    ...smallButtonCommonStyle,
    backgroundColor: colors.neutral515,
  },
  buttonPrimaryLightSmall: {
    ...smallButtonCommonStyle,
    backgroundColor: colors.primaryBlue,
  },
  buttonSecondaryDarkSmall: {
    ...smallButtonCommonStyle,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.neutral252,
  },
  buttonSecondaryLightSmall: {
    ...smallButtonCommonStyle,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primaryBlue,
  },
  buttonTextPrimaryDark: {
    ...buttonTextCommonStyle,
    color: colors.primaryBlue,
  },
  buttonTextPrimary: {
    ...buttonTextCommonStyle,
    color: colors.neutralFFF,
  },
  buttonTextNeutral: {
    ...buttonTextCommonStyle,
    color: colors.neutralB3B,
  },
  buttonTextPrimaryLight: {
    ...buttonTextCommonStyle,
    color: colors.neutralFFF,
  },
  buttonTextSecondaryDark: {
    ...buttonTextCommonStyle,
    color: colors.neutral252,
  },
  buttonTextSecondaryLight: {
    ...buttonTextCommonStyle,
    color: colors.primaryBlue,
  },
});

export default getStyle;
