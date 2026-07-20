import { positions } from '@/theme/alignements';

const buttonCommonStyle = {
  alignItems: positions.center,
  borderRadius: 47,
  height: 47,
  justifyContent: positions.center,
  paddingHorizontal: 16,
};

const buttonOptionStyle = {
  alignItems: positions.center,
  borderRadius: 12,
  // Cible tactile minimale 44pt — décision Adel 2026-07-20 (arbitrage n°2, option A).
  height: 44,
  justifyContent: positions.center,
  paddingHorizontal: 16,
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
  buttonGhost: {
    ...buttonCommonStyle,
    backgroundColor: 'transparent',
  },
  buttonGhostOption: {
    ...buttonOptionStyle,
    backgroundColor: 'transparent',
  },
  buttonIcon: {
    borderRadius: 47,
    height: 47,
    padding: 0,
    width: 47,
  },
  buttonIconOption: {
    borderRadius: 12,
    height: 44,
    padding: 0,
    width: 44,
  },
  buttonPrimary: {
    ...buttonCommonStyle,
    backgroundColor: colors.primary500,
  },

  buttonPrimaryLight: {
    ...buttonCommonStyle,
    backgroundColor: colors.primary200,
  },
  buttonPrimaryLightOption: {
    ...buttonOptionStyle,
    backgroundColor: colors.primary200,
  },

  buttonPrimaryOption: {
    ...buttonOptionStyle,
    backgroundColor: colors.primary500,
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

  buttonSecondaryLightOption: {
    ...buttonOptionStyle,
    backgroundColor: 'transparent',
    borderColor: colors.primary200,
    borderWidth: 1,
  },

  buttonSecondaryOption: {
    ...buttonOptionStyle,
    backgroundColor: 'transparent',
    borderColor: colors.primary500,
    borderWidth: 1,
  },
  buttonTextGhost: {
    color: colors.neutral300,
  },
  buttonTextPrimary: {
    // Encre foncée sur fond primary500 : neutral00 ≈ 2,4:1 (échec WCAG AA),
    // primary900 ≈ 8:1 (AA/AAA). Décision Adel 2026-07-14, cf. THEME.md.
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

});

export default getStyle;
