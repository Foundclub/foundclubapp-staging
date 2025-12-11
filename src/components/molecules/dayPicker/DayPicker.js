import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
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

const DayPicker = ({ selectedDays = [], onChange }) => {
    const { Spaces, Fonts, Colors, Alignments } = useTheme();

    const toggleDay = (dayValue) => {
        if (selectedDays.includes(dayValue)) {
            onChange(selectedDays.filter(d => d !== dayValue));
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
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: isSelected ? Colors.primary500 : 'transparent',
                            borderWidth: isSelected ? 0 : 1,
                            borderColor: isSelected ? 'transparent' : Colors.neutral500,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        <Text
                            style={[
                                Fonts.p2,
                                {
                                    color: isSelected ? Colors.neutral00 : Colors.neutral200,
                                    fontWeight: isSelected ? '700' : '400',
                                    textAlign: 'center',
                                }
                            ]}
                        >
                            {day.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

export default DayPicker;
