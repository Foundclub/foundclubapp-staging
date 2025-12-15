
import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import useTheme from '@/theme/themeContext';

const Checkbox = ({ value, onValueChange, disabled }) => {
  const { Colors, ApplicationStyle } = useTheme();

  return (
    <TouchableOpacity
      onPress={() => !disabled && onValueChange(!value)}
      disabled={disabled}
      style={{
        width: 24,
        height: 24,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: value ? Colors.primary500 : Colors.neutral200,
        backgroundColor: value ? Colors.primary500 : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {value && <Text style={{ color: Colors.neutral900, fontSize: 16, fontWeight: 'bold' }}>✓</Text>}
    </TouchableOpacity>
  );
};

export default Checkbox;
