import {
  Image,
  Pressable,
  Text,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * @typedef {'half' | 'full'} HomeCardLayout
 * @typedef {'default' | 'primary'} HomeCardEmphasis
 */

/**
 * Home action card used by the HomeHub sections.
 * @param {object} props
 * @param {string} props.title
 * @param {string} props.subtitle
 * @param {() => void} props.onPress
 * @param {boolean} [props.disabled]
 * @param {keyof import('@/theme/types').AllImages} [props.icon]
 * @param {string} [props.accentColor]
 * @param {HomeCardLayout} [props.layout]
 * @param {HomeCardEmphasis} [props.emphasis]
 * @param {1 | 2} [props.subtitleLines]
 * @param {((node: any) => void) | { current: any }} [props.tutorialTargetRef]
 * @returns {import('react').ReactElement}
 */
function HomeActionCard({
  accentColor,
  disabled = false,
  emphasis = 'default',
  icon = 'search',
  layout = 'half',
  onPress,
  subtitle,
  subtitleLines = 2,
  title,
  tutorialTargetRef,
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();

  const resolvedAccentColor = accentColor || Colors.primary500;
  const accentBorderColor = emphasis === 'primary'
    ? resolvedAccentColor
    : `${resolvedAccentColor}CC`;
  const borderColor = disabled ? `${resolvedAccentColor}66` : accentBorderColor;
  const minHeight = layout === 'full' ? 148 : 172;
  const cardBackgroundColor = disabled ? 'rgba(23, 56, 68, 0.62)' : 'rgba(23, 56, 68, 0.96)';

  return (
    <Pressable
      accessibilityHint={subtitle}
      accessibilityLabel={title}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ([
        {
          borderRadius: 16,
          width: '100%',
        },
        pressed && {
          opacity: 0.94,
        },
        disabled && {
          opacity: 0.5,
        },
      ])}
    >
      <View
        collapsable={false}
        ref={tutorialTargetRef}
        style={[
          ApplicationStyle.card,
          {
            backgroundColor: cardBackgroundColor,
            borderColor,
            borderRadius: 16,
            borderWidth: 1,
            justifyContent: 'space-between',
            minHeight,
            paddingHorizontal: 16,
            paddingVertical: 16,
          },
        ]}
      >
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
          <View
            style={{
              alignItems: 'center',
              backgroundColor: `${resolvedAccentColor}24`,
              borderColor: `${resolvedAccentColor}66`,
              borderRadius: 12,
              borderWidth: 1,
              height: 38,
              justifyContent: 'center',
              width: 38,
            }}
          >
            <Image
              source={Images[icon]}
              style={{ height: 18, width: 18 }}
              tintColor={resolvedAccentColor}
            />
          </View>
          <View
            style={{
              alignItems: 'center',
              backgroundColor: `${resolvedAccentColor}22`,
              borderColor: `${resolvedAccentColor}55`,
              borderRadius: 10,
              borderWidth: 1,
              height: 26,
              justifyContent: 'center',
              width: 26,
            }}
          >
            <Image
              source={Images.arrowRight}
              style={{ height: 12, width: 12 }}
              tintColor={resolvedAccentColor}
            />
          </View>
        </View>

        <View style={[Spaces.marginTop[16], Spaces.gap[8]]}>
          <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00]}>{title}</Text>
          <Text numberOfLines={subtitleLines} style={[Fonts.p3, Fonts.neutral200]}>{subtitle}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default HomeActionCard;
