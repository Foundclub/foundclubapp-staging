import {
  Image,
  Pressable,
  Text,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * @param {{
 *  items: Array<{
 *   key: string;
 *   title: string;
 *   subtitle: string;
 *   icon: keyof import('@/theme/types').AllImages;
 *   onPress?: () => void;
 *   disabled?: boolean;
 *  }>
 * }} props
 */
function MultisportActionGrid({ items }) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();

  return (
    <View style={[Alignments.row, Alignments.wrap, Alignments.justifySpaceBetween]}>
      {items.map((item) => (
        <Pressable
          accessibilityHint={item.subtitle}
          accessibilityLabel={item.title}
          accessibilityRole="button"
          disabled={item.disabled || !item.onPress}
          key={item.key}
          onPress={item.onPress}
          style={({ pressed }) => ([
            Spaces.marginBottom[12],
            {
              flexBasis: '48.5%',
              maxWidth: '48.5%',
              opacity: item.disabled ? 0.45 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            },
          ])}
        >
          <View
            style={[
              ApplicationStyle.borderRadius16,
              ApplicationStyle.backgroundColor.primary700,
              ApplicationStyle.borderWidth1,
              Spaces.padding[12],
              {
                aspectRatio: 1,
                borderColor: `${Colors.primary500}99`,
                justifyContent: 'space-between',
              },
            ]}
          >
            <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
              <View
                style={[
                  Alignments.center,
                  ApplicationStyle.borderRadius12,
                  ApplicationStyle.borderWidth1,
                  {
                    backgroundColor: `${Colors.primary500}26`,
                    borderColor: `${Colors.primary500}80`,
                    height: 36,
                    width: 36,
                  },
                ]}
              >
                <Image
                  source={Images[item.icon]}
                  style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.primary500]}
                />
              </View>

              <View
                style={[
                  Alignments.center,
                  ApplicationStyle.borderRadius100,
                  ApplicationStyle.borderWidth1,
                  {
                    backgroundColor: `${Colors.primary500}1A`,
                    borderColor: `${Colors.primary500}66`,
                    height: 24,
                    width: 24,
                  },
                ]}
              >
                <Image
                  source={Images.arrowRight}
                  style={[
                    ApplicationStyle.tintColor.primary500,
                    { height: 12, width: 12 },
                  ]}
                />
              </View>
            </View>

            <View style={[Spaces.gap[6]]}>
              <Text numberOfLines={2} style={[Fonts.p2Bold, Fonts.neutral00]}>
                {item.title}
              </Text>
              <Text numberOfLines={2} style={[Fonts.p3, Fonts.neutral200]}>
                {item.subtitle}
              </Text>
            </View>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

export default MultisportActionGrid;
