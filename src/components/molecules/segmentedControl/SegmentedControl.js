import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { horizontalScale, verticalScale, moderateScale } from '@/theme/scaling';

/**
 * SegmentedControl component - Scrollable & Auto-sizing
 * @param {object} props
 * @param {Array<{label: string, value: string}>} props.options - The options to display
 * @param {string} props.value - The currently selected value
 * @param {Function} props.onChange - Callback when selection changes
 * @returns {import('react').ReactElement}
 */
function SegmentedControl({ options, value, onChange }) {
  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.container}
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

const styles = StyleSheet.create({
  wrapper: {
    height: verticalScale(45), // Increased height to accommodate shadows
  },
  // Container principal - ScrollView content
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: horizontalScale(8.58),
    height: verticalScale(37.52),
    backgroundColor: 'transparent',
    // Allow container to grow based on content
    minWidth: horizontalScale(327),
  },
  // Segment
  segment: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: verticalScale(8),
    paddingHorizontal: horizontalScale(16),
    minHeight: verticalScale(32),
    backgroundColor: 'transparent',
    borderRadius: moderateScale(33.24),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  // Segment sélectionné
  segmentSelected: {
    backgroundColor: '#01B3F4',
    borderColor: '#01B3F4', // Match background to hide border but keep layout consistent
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: verticalScale(4.29),
    },
    shadowOpacity: 0.47,
    shadowRadius: moderateScale(4.29),
    elevation: 4,
    borderRadius: moderateScale(34.31),
  },
  // Texte du segment
  segmentText: {
    fontFamily: 'Montserrat-Regular',
    fontSize: moderateScale(12.87),
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    color: '#FFFFFF',
  },
  // Texte du segment sélectionné
  segmentTextSelected: {
    color: '#FFFFFF',
    fontFamily: 'Montserrat-Bold', // Bold for selected
  },
});

export default SegmentedControl;

