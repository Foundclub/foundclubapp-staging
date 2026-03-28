import { Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

import ScreenContainer from '@/components/templates/ScreenContainer';

/**
 * Shared render-first fallback for web routes that are not fully ported yet.
 * @param {object} props
 * @param {string} [props.eyebrow]
 * @param {string} props.title
 * @param {string} props.description
 * @returns {import('react').ReactElement}
 */
function FeatureFallback({
  description,
  eyebrow = 'FoundClub Web',
  title,
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Alignments.justifyCenter,
        Alignments.alignCenter,
        Alignments.fill,
        Spaces.paddingVertical[24],
      ]}
      responsiveHorizontalPadding
    >
      <View
        style={[
          ApplicationStyle.borderRadius24,
          ApplicationStyle.borderWidth1,
          Spaces.padding[24],
          Spaces.gap[12],
          {
            backgroundColor: 'rgba(16, 29, 36, 0.9)',
            borderColor: `${Colors.primary500}55`,
            maxWidth: 620,
            width: '100%',
          },
        ]}
      >
        <Text style={[Fonts.p2Bold, Fonts.primary500]}>{eyebrow.toUpperCase()}</Text>
        <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{title}</Text>
        <Text style={[Fonts.p2, Fonts.neutral100]}>{description}</Text>
      </View>
    </ScreenContainer>
  );
}

export default FeatureFallback;
