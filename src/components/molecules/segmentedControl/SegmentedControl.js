import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import useTheme from '@/theme/themeContext';
import { horizontalScale, moderateScale, verticalScale } from '@/theme/scaling';

/**
 * SegmentedControl component.
 * @param {object} props
 * @param {Array<{label: string, value: string}>} props.options
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @returns {import('react').ReactElement}
 */
function SegmentedControl({ options, value, onChange }) {
  const { Colors, Fonts } = useTheme();

  const styles = useMemo(() => StyleSheet.create({
    container: {
      alignItems: 'center',
      backgroundColor: Colors.transparent,
      flexDirection: 'row',
      gap: horizontalScale(8.58),
      height: verticalScale(37.52),
      minWidth: horizontalScale(327),
    },
    segment: {
      alignItems: 'center',
      backgroundColor: Colors.transparent,
      borderColor: Colors.neutral500,
      borderRadius: moderateScale(33.24),
      borderWidth: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      minHeight: verticalScale(32),
      paddingHorizontal: horizontalScale(16),
      paddingVertical: verticalScale(8),
    },
    segmentSelected: {
      backgroundColor: Colors.primary500,
      borderColor: Colors.primary500,
      borderRadius: moderateScale(34.31),
      elevation: 4,
      shadowColor: Colors.neutral900,
      shadowOffset: {
        height: verticalScale(4.29),
        width: 0,
      },
      shadowOpacity: 0.47,
      shadowRadius: moderateScale(4.29),
    },
    segmentText: {
      ...Fonts.p3,
      color: Colors.neutral00,
      fontSize: moderateScale(12.87),
      includeFontPadding: false,
      textAlign: 'center',
      textAlignVertical: 'center',
    },
    segmentTextSelected: {
      ...Fonts.p3Bold,
      color: Colors.neutral00,
      fontSize: moderateScale(12.87),
    },
    wrapper: {
      height: verticalScale(45),
    },
  }), [Colors, Fonts.p3, Fonts.p3Bold]);

  return (
    <View style={styles.wrapper}>
      <ScrollView
        contentContainerStyle={styles.container}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <TouchableOpacity
              key={option.value}
              activeOpacity={0.8}
              onPress={() => onChange(option.value)}
              style={[
                styles.segment,
                isSelected && styles.segmentSelected,
              ]}
            >
              <Text
                style={[
                  styles.segmentText,
                  isSelected && styles.segmentTextSelected,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default SegmentedControl;
