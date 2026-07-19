import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 *
 * @param root0
 * @param root0.label
 * @param root0.max
 * @param root0.min
 * @param root0.onDecrement
 * @param root0.onIncrement
 * @param root0.value
 */
function InputStepper({
  label, max = 100, min = 0, onDecrement, onIncrement, value,
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  return (
    <View>
      {label && <Text style={[Fonts.p2, Fonts.neutral300, Spaces.marginBottom[8]]}>{label}</Text>}
      <View style={[
        Alignments.row,
        Alignments.alignCenter,
        Alignments.justifySpaceBetween,
        { backgroundColor: Colors.neutral100, borderRadius: 8, padding: 4 },
      ]}
      >
        <TouchableOpacity
          accessibilityLabel={`${t('common.previous')} ${label || ''}`.trim()}
          accessibilityRole="button"
          accessibilityState={{ disabled: value <= min }}
          disabled={value <= min}
          hitSlop={ApplicationStyle.hitSlop.min44From40}
          onPress={onDecrement}
          style={[
            Spaces.padding[12],
            { backgroundColor: Colors.neutral00, borderRadius: 6 },
            value <= min && { opacity: 0.5 },
          ]}
        >
          <Text style={[Fonts.h3, Fonts.primary700]}>-</Text>
        </TouchableOpacity>

        <Text style={[Fonts.h3, Fonts.neutral900]}>{value}</Text>

        <TouchableOpacity
          accessibilityLabel={`${t('common.next')} ${label || ''}`.trim()}
          accessibilityRole="button"
          accessibilityState={{ disabled: value >= max }}
          disabled={value >= max}
          hitSlop={ApplicationStyle.hitSlop.min44From40}
          onPress={onIncrement}
          style={[
            Spaces.padding[12],
            { backgroundColor: Colors.neutral00, borderRadius: 6 },
            value >= max && { opacity: 0.5 },
          ]}
        >
          <Text style={[Fonts.h3, Fonts.primary700]}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default InputStepper;
