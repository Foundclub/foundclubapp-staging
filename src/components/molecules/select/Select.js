import React, { useState } from 'react';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import BottomModal from '@/components/molecules/bottomModal/BottomModal';

/**
 *
 * @param root0
 * @param root0.error
 * @param root0.label
 * @param root0.onSelect
 * @param root0.options
 * @param root0.placeholder
 * @param root0.value
 */
function Select({
  error, label, onSelect, options, placeholder, value,
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const [isVisible, setIsVisible] = useState(false);

  const selectedOption = options.find((opt) => opt.value === value);

  const handleSelect = (val) => {
    onSelect(val);
    setIsVisible(false);
  };

  return (
    <View>
      {label && <Text style={[Fonts.p2, Fonts.neutral300, Spaces.marginBottom[8]]}>{label}</Text>}
      <TouchableOpacity
        onPress={() => setIsVisible(true)}
        style={[
          ApplicationStyle.input,
          Alignments.row,
          Alignments.alignCenter,
          Alignments.justifySpaceBetween,
          error && { borderColor: Colors.error500 },
        ]}
      >
        <Text style={[Fonts.p1, selectedOption ? Fonts.primary500 : Fonts.neutral500]}>
          {selectedOption ? selectedOption.label : placeholder || 'Sélectionner'}
        </Text>
      </TouchableOpacity>
      {error && <Text style={[Fonts.p3, Fonts.error500, Spaces.marginTop[4]]}>{error}</Text>}

      <BottomModal
        close={() => setIsVisible(false)}
        hideCloseButton
        isVisible={isVisible}
      >
        <ScrollView contentContainerStyle={[Spaces.gap[16], Spaces.paddingTop[24]]}>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => handleSelect(opt.value)}
              style={[
                Spaces.padding[16],
                ApplicationStyle.backgroundColor.neutral100,
                { borderRadius: 8 },
                opt.value === value && ApplicationStyle.backgroundColor.primary100,
              ]}
            >
              <Text style={[Fonts.p1Bold, Fonts.primary500]}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </BottomModal>
    </View>
  );
}

export default Select;
