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
      // DESIGN-DENSITE (20/11, Adel d1 = A, règle point 1) : une sous-partie DANS une carte se
      // sépare par un trait fin, pas par un deuxième cadre (recette 51 b : carte dans la carte,
      // texte à 78 px du bord à 375 px). Les tuiles côte à côte et les fenêtres gardent
      // `insetPanelCard`.
      nestedSection: [
        Spaces.paddingTop[12],
        Spaces.gap[8],
        {
          backgroundColor: 'transparent',
          borderColor: borderSoft,
          borderTopWidth: 1,
        },
      ],
      // DESIGN-DENSITE (règle point 4) : coins de 16 et bord à 24 % (avant : 24 et 33 %), comme
      // les cartes `.cd` de la maquette.
      panelCard: [
        ApplicationStyle.card,
        ApplicationStyle.borderRadius16,
        ApplicationStyle.borderWidth1,
        Spaces.padding[16],
        Spaces.gap[12],
        {
          backgroundColor: panelSurface,
          borderColor: borderSoft,
        },
      ],
      // DESIGN-DENSITE (règle points 2 et 6) : la marge de page est posée UNE fois par le
      // conteneur (`ScreenContainer densePadding`) ; le contenu n'en rajoute pas (avant : 24 de
      // plus, soit 48 px avant la première carte). 12 px entre deux blocs (avant : 24).
      screenContent: [
        Spaces.paddingBottom[40],
        Spaces.gap[12],
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
