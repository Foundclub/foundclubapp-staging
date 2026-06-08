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
 * @param {object | object[]} [props.style] - Additional root style.
 * @param {object | object[]} [props.textStyle] - Additional initials style.
 * @returns {import('react').ReactElement} TeamShield component
 */
function TeamShield({
  initials,
  isGold = false,
  isNeutral = false,
  isSmall = false,
  size,
  style,
  textStyle,
}) {
  // hooks
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images,
  } = useTheme();

  const formattedInitials = String(initials || '?')
    .replace(/\s+/g, '')
    .slice(0, 3)
    .toUpperCase();
  let shieldSize = 90;
  if (Number.isFinite(size)) {
    shieldSize = Number(size);
  } else if (isSmall) {
    shieldSize = 60;
  }
  const textLength = Math.max(formattedInitials.length, 1);
  let initialsFontRatio = 0.22;
  if (textLength === 1) {
    initialsFontRatio = 0.3;
  } else if (textLength === 2) {
    initialsFontRatio = 0.26;
  }
  const initialsFontSize = Math.max(
    10,
    Math.round(shieldSize * initialsFontRatio),
  );
  const initialsLineHeight = Math.round(initialsFontSize * 1.1);
  let shieldTintStyle = ApplicationStyle.tintColor.primary200;
  if (isGold) {
    shieldTintStyle = ApplicationStyle.tintColor.gold500;
  } else if (isNeutral) {
    shieldTintStyle = ApplicationStyle.tintColor.neutral200;
  }
  let initialsColorStyle = Fonts.primary700;
  if (isGold) {
    initialsColorStyle = { color: Colors.neutral900 };
  } else if (isNeutral) {
    initialsColorStyle = Fonts.neutral700;
  }

  return (
    <View style={[
      Alignments.relative,
      Alignments.alignCenter,
      Alignments.justifyCenter,
      {
        flexShrink: 0,
        height: shieldSize,
        width: shieldSize,
      },
      style,
    ]}
    >
      <Image
        source={Images.shield}
        style={[
          shieldTintStyle,
          {
            height: shieldSize,
            position: 'absolute',
            width: shieldSize,
          }]}
      />
      <View style={[
        Alignments.absolute,
        Alignments.alignCenter,
        Alignments.justifyCenter,
        {
          bottom: 0,
          left: 0,
          paddingBottom: shieldSize * 0.06,
          paddingHorizontal: shieldSize * 0.08,
          right: 0,
          top: 0,
        },
      ]}
      >
        <Text style={[
          initialsColorStyle,
          {
            fontSize: initialsFontSize,
            fontWeight: '900',
            includeFontPadding: false,
            letterSpacing: textLength >= 3 ? -0.8 : -0.2,
            lineHeight: initialsLineHeight,
            maxWidth: shieldSize * 0.74,
            textAlign: 'center',
          },
          textStyle,
        ]}
        >
          {formattedInitials}
        </Text>
      </View>
    </View>
  );
}

export default TeamShield;
