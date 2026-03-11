import { Text, TouchableOpacity, View } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * @param {{
 *  items: Array<{ key: string; label: string; value: string | number; onPress?: () => void }>;
 * }} props
 */
function MultisportStatsRow({ items }) {
  const {
    Alignments, ApplicationStyle, Fonts, Spaces,
  } = useTheme();

  return (
    <View style={[Alignments.row, Spaces.gap[12]]}>
      {items.map((item) => {
        const Wrapper = item.onPress ? TouchableOpacity : View;
        return (
          <Wrapper
            accessibilityLabel={item.label}
            accessibilityRole={item.onPress ? 'button' : 'text'}
            key={item.key}
            onPress={item.onPress}
            style={[
              ApplicationStyle.borderRadius12,
              ApplicationStyle.backgroundColor.primary700,
              ApplicationStyle.borderWidth1,
              ApplicationStyle.borderColor.primary500,
              Spaces.padding[16],
              Alignments.alignCenter,
              { flex: 1 },
            ]}
          >
            <Text style={[Fonts.h2Black, Fonts.primary500]}>
              {item.value}
            </Text>
            <Text numberOfLines={1} style={[Fonts.p3, Fonts.neutral100, Fonts.textCenter]}>
              {item.label}
            </Text>
          </Wrapper>
        );
      })}
    </View>
  );
}

export default MultisportStatsRow;
