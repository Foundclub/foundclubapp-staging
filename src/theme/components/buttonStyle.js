import { positions } from '@/theme/alignements';

const buttonCommonStyle = {
  alignItems: positions.center,
  borderRadius: 47,
  height: 47,
  justifyContent: positions.center,
};

/**
 * Returns the styles for the Button component.
 * @param {import('../types').Colors} colors - The colors object.
 * @inheritdoc
 */
const getStyle = (colors) => ({
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonIcon: {
    borderRadius: 100,
    paddingHorizontal: 12,
  },
  buttonPrimary: {
    ...buttonCommonStyle,
    backgroundColor: colors.primary500,
  },

  buttonPrimaryLight: {
    ...buttonCommonStyle,
    backgroundColor: colors.primary200,
  },
  buttonSecondary: {
    ...buttonCommonStyle,
    backgroundColor: 'transparent',
    borderColor: colors.primary500,
    borderWidth: 1,
  },

  buttonSecondaryLight: {
    ...buttonCommonStyle,
    backgroundColor: 'transparent',
    borderColor: colors.primary200,
    borderWidth: 1,
  },
  buttonTextPrimary: {
    color: colors.primary900,
  },

  buttonTextPrimaryLight: {
    color: colors.primary900,
  },
  buttonTextSecondary: {
    color: colors.primary500,
  },

  buttonTextSecondaryLight: {
    color: colors.primary200,
  },
  buttonTextSmall: {
    fontSize: 14,
  },
});

export default getStyle;
