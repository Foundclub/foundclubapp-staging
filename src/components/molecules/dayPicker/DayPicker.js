import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import useTheme from '@/theme/themeContext';

const DAYS = [
  { label: 'L', value: 1 }, // Lundi
  { label: 'M', value: 2 }, // Mardi
  { label: 'M', value: 3 }, // Mercredi
  { label: 'J', value: 4 }, // Jeudi
  { label: 'V', value: 5 }, // Vendredi
  { label: 'S', value: 6 }, // Samedi
  { label: 'D', value: 0 }, // Dimanche
];

/**
 *
 * @param root0
 * @param root0.onChange
 * @param root0.selectedDays
 */
function DayPicker({ onChange, selectedDays = [] }) {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();

  const toggleDay = (dayValue) => {
    if (selectedDays.includes(dayValue)) {
      onChange(selectedDays.filter((d) => d !== dayValue));
    } else {
      onChange([...selectedDays, dayValue]);
    }
  };

  return (
    <View style={[Alignments.row, Alignments.justifySpaceBetween, Spaces.marginTop[8]]}>
      {DAYS.map((day) => {
        const isSelected = selectedDays.includes(day.value);
        return (
          <TouchableOpacity
            key={day.value}
            onPress={() => toggleDay(day.value)}
            style={{
              alignItems: 'center',
              backgroundColor: isSelected ? Colors.primary500 : 'transparent',
              borderColor: isSelected ? 'transparent' : Colors.neutral500,
              borderRadius: 20,
              borderWidth: isSelected ? 0 : 1,
              height: 40,
              justifyContent: 'center',
              width: 40,
            }}
          >
            <Text
              style={[
                Fonts.p2,
                {
                  color: isSelected ? Colors.neutral00 : Colors.neutral200,
                  fontWeight: isSelected ? '700' : '400',
                  textAlign: 'center',
                },
              ]}
            >
              {day.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default DayPicker;
