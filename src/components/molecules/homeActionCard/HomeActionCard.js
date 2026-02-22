import { Image, Pressable, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

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
}) {
  const {
    Alignments,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();

  const resolvedAccentColor = accentColor || Colors.primary500;
  const borderColor = disabled ? `${resolvedAccentColor}66` : resolvedAccentColor;
  const minHeight = layout === 'full' ? 136 : 154;

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
          shadowColor: Colors.primary900,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 6,
          width: '100%',
          elevation: 1,
        },
        pressed && {
          opacity: 0.92,
          shadowOpacity: 0.14,
          shadowRadius: 4,
          elevation: 1,
        },
        disabled && {
          opacity: 0.5,
        },
      ])}
    >
      <LinearGradient
        colors={[`${resolvedAccentColor}20`, `${resolvedAccentColor}0E`, 'rgba(23,56,68,0.94)']}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={{
          borderColor,
          borderRadius: 16,
          borderWidth: emphasis === 'primary' ? 1.5 : 1,
          justifyContent: 'space-between',
          minHeight,
          overflow: 'hidden',
          padding: 12,
          position: 'relative',
        }}
      >
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
          <View
            style={{
              alignItems: 'center',
              backgroundColor: `${resolvedAccentColor}24`,
              borderColor: `${resolvedAccentColor}66`,
              borderRadius: 12,
              borderWidth: 1,
              height: 36,
              justifyContent: 'center',
              width: 36,
            }}
          >
            <Image source={Images[icon]} style={{ height: 18, tintColor: resolvedAccentColor, width: 18 }} />
          </View>
          <View
            style={{
              alignItems: 'center',
              backgroundColor: `${resolvedAccentColor}22`,
              borderColor: `${resolvedAccentColor}55`,
              borderRadius: 10,
              borderWidth: 1,
              height: 24,
              justifyContent: 'center',
              width: 24,
            }}
          >
            <Image source={Images.arrowRight} style={{ height: 12, tintColor: resolvedAccentColor, width: 12 }} />
          </View>
        </View>

        <View style={[Spaces.marginTop[12], Spaces.gap[6]]}>
          <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00]}>{title}</Text>
          <Text numberOfLines={subtitleLines} style={[Fonts.p3, Fonts.neutral200]}>{subtitle}</Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

export default HomeActionCard;
