import { Image, Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * Team shield component that displays initials on top of a shield image
 * @param {object} props - Component props
 * @param {string} props.initials - Team initials (max 3 letters)
 * @param {boolean} [props.isSmall] - Size of the shield
 * @param {boolean} [props.isNeutral] - Colors
 * @param {boolean} [props.isGold] - League gold variant
 * @param {number} [props.size] - Explicit size override.
 * @returns {import('react').ReactElement} TeamShield component
 */
function TeamShield({
  initials,
  isGold = false,
  isNeutral = false,
  isSmall = false,
  size,
}) {
  // hooks
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images,
  } = useTheme();

  // Format initials to max 3 letters uppercase
  const formattedInitials = (initials || '?').slice(0, 3).toUpperCase();
  const shieldSize = Number.isFinite(size) ? Number(size) : (isSmall ? 60 : 90);

  return (
    <View style={[
      Alignments.relative,
      Alignments.alignCenter,
    ]}
    >
      <Image
        source={Images.shield}
        style={[
          isGold
            ? ApplicationStyle.tintColor.gold500
            : isNeutral
              ? ApplicationStyle.tintColor.neutral200
              : ApplicationStyle.tintColor.primary200,
          {
            height: shieldSize,
            width: shieldSize,
          }]}
      />
      <View style={[
        Alignments.absolute,
      ]}
      >
        <Text style={[
          isSmall ? Fonts.p2Black : Fonts.h4Black,
          isGold
            ? { color: Colors.neutral900 }
            : isNeutral
              ? Fonts.neutral700
              : Fonts.primary700,
          { top: shieldSize / 3.5 },
        ]}
        >
          {formattedInitials}
        </Text>
      </View>
    </View>
  );
}

export default TeamShield;
