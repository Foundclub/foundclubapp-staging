import PropTypes from 'prop-types';
import React from 'react';
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
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();

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
          disabled={value <= min}
          onPress={onDecrement}
          style={[
            Spaces.padding[12],
            { backgroundColor: Colors.neutral00, borderRadius: 6 },
            value <= min && { opacity: 0.5 },
          ]}
        >
          <Text style={[Fonts.h3, Fonts.primary500]}>-</Text>
        </TouchableOpacity>

        <Text style={[Fonts.h3, Fonts.neutral900]}>{value}</Text>

        <TouchableOpacity
          disabled={value >= max}
          onPress={onIncrement}
          style={[
            Spaces.padding[12],
            { backgroundColor: Colors.neutral00, borderRadius: 6 },
            value >= max && { opacity: 0.5 },
          ]}
        >
          <Text style={[Fonts.h3, Fonts.primary500]}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

InputStepper.propTypes = {
  label: PropTypes.string,
  max: PropTypes.number,
  min: PropTypes.number,
  onDecrement: PropTypes.func.isRequired,
  onIncrement: PropTypes.func.isRequired,
  value: PropTypes.number.isRequired,
};

export default InputStepper;
