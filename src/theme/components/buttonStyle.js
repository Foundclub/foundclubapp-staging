import { positions } from '../alignements';

const buttonCommonStyle = {
  borderRadius: 47,
  height: 47,
  justifyContent: positions.center,
  alignItems: positions.center,
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
  buttonDisabled: {
    opacity: 0.5,
  },

  buttonPrimary: {
    ...buttonCommonStyle,
    backgroundColor: colors.primary500,
  },
  buttonTextPrimary: {
    color: colors.primary900,
  },

  buttonPrimaryLight: {
    ...buttonCommonStyle,
    backgroundColor: colors.primary200,
  },
  buttonTextPrimaryLight: {
    color: colors.primary900,
  },

  buttonSecondary: {
    ...buttonCommonStyle,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary500,
  },
  buttonTextSecondary: {
    color: colors.primary500,
  },

  buttonSecondaryLight: {
    ...buttonCommonStyle,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary200,
  },
  buttonTextSecondaryLight: {
    color: colors.primary200,
  },
});

export default getStyle;
