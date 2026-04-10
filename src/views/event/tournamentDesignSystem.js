const HEX_COLOR_REGEX = /^#([0-9a-f]{6})$/i;

/**
 *
 * @param {string} color
 * @param {string} alphaHex
 * @returns {string}
 */
export const withAlpha = (color, alphaHex) => {
  if (typeof color !== 'string' || typeof alphaHex !== 'string') {
    return color;
  }

  return HEX_COLOR_REGEX.test(color) ? `${color}${alphaHex}` : color;
};

/**
 *
 * @param root0
 * @param root0.ApplicationStyle
 * @param root0.Colors
 * @param root0.Fonts
 * @param root0.Spaces
 */
export const createTournamentDesignSystem = ({
  ApplicationStyle,
  Colors,
  Fonts,
  Spaces,
}) => {
  const borderSoft = withAlpha(Colors.primary500, '3D');
  const borderStrong = withAlpha(Colors.primary500, '55');
  const borderMuted = withAlpha(Colors.neutral300, '24');
  const fieldSurface = withAlpha(Colors.primary500, '14');
  const fieldSurfaceSelected = withAlpha(Colors.primary500, '29');
  const subtleSurface = withAlpha(Colors.primary500, '0D');
  const wizardSurface = withAlpha(Colors.primary700, 'CC');
  const panelSurface = withAlpha(Colors.primary900, 'F2');
  const nestedSurface = withAlpha(Colors.primary500, '10');

  return {
    colors: {
      borderMuted,
      borderSoft,
      borderStrong,
      fieldSurface,
      fieldSurfaceSelected,
      nestedSurface,
      panelSurface,
      subtleSurface,
      wizardSurface,
    },
    getMetricCardStyle: (accentColor) => ([
      ApplicationStyle.card,
      ApplicationStyle.borderRadius16,
      ApplicationStyle.borderWidth1,
      Spaces.padding[16],
      Spaces.gap[8],
      {
        backgroundColor: panelSurface,
        borderColor: withAlpha(accentColor, '55'),
        flexGrow: 1,
        minWidth: 156,
      },
    ]),
    getPillStyle: (selected) => ([
      ApplicationStyle.borderRadius16,
      ApplicationStyle.borderWidth1,
      Spaces.paddingHorizontal[16],
      Spaces.paddingVertical[12],
      {
        backgroundColor: selected ? fieldSurfaceSelected : subtleSurface,
        borderColor: selected ? Colors.primary500 : borderSoft,
      },
    ]),
    getSelectionCardStyle: (selected) => ([
      ApplicationStyle.card,
      Spaces.padding[16],
      Spaces.gap[8],
      {
        backgroundColor: selected ? fieldSurfaceSelected : fieldSurface,
        borderColor: selected ? Colors.primary500 : borderSoft,
      },
    ]),
    getToneTagStyle: (tone) => ({
      backgroundColor: withAlpha(tone, '18'),
      borderColor: withAlpha(tone, '33'),
    }),
    styles: {
      compactPanelCard: [
        ApplicationStyle.card,
        ApplicationStyle.borderRadius16,
        ApplicationStyle.borderWidth1,
        Spaces.padding[16],
        Spaces.gap[8],
        {
          backgroundColor: panelSurface,
          borderColor: borderSoft,
        },
      ],
      headerBlock: Spaces.gap[8],
      input: [
        ApplicationStyle.card,
        Spaces.paddingHorizontal[16],
        Spaces.paddingVertical[16],
        Fonts.p2,
        {
          backgroundColor: fieldSurface,
          borderColor: withAlpha(Colors.primary500, '42'),
          color: Colors.neutral00,
          minHeight: 56,
        },
      ],
      insetPanelCard: [
        ApplicationStyle.card,
        ApplicationStyle.borderRadius16,
        ApplicationStyle.borderWidth1,
        Spaces.padding[12],
        Spaces.gap[8],
        {
          backgroundColor: nestedSurface,
          borderColor: borderSoft,
        },
      ],
      multilineInput: [
        ApplicationStyle.card,
        Spaces.padding[16],
        Fonts.p2,
        {
          backgroundColor: fieldSurface,
          borderColor: withAlpha(Colors.primary500, '42'),
          color: Colors.neutral00,
          minHeight: 136,
          textAlignVertical: 'top',
        },
      ],
      panelCard: [
        ApplicationStyle.card,
        ApplicationStyle.borderRadius24,
        ApplicationStyle.borderWidth1,
        Spaces.padding[16],
        Spaces.gap[12],
        {
          backgroundColor: panelSurface,
          borderColor: borderStrong,
        },
      ],
      screenContent: [
        Spaces.paddingHorizontal[24],
        Spaces.paddingBottom[40],
        Spaces.gap[24],
      ],
      screenIntro: Spaces.gap[8],
      sectionStack: Spaces.gap[16],
      wizardSectionCard: [
        ApplicationStyle.card,
        Spaces.padding[24],
        Spaces.gap[16],
        {
          backgroundColor: wizardSurface,
          borderColor: borderSoft,
        },
      ],
    },
  };
};
