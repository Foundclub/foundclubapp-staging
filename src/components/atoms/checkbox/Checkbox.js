import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 *
 * @param root0
 * @param root0.disabled
 * @param root0.onValueChange
 * @param root0.value
 */
function Checkbox({ disabled, onValueChange, value }) {
  const { ApplicationStyle, Colors } = useTheme();

  return (
    <TouchableOpacity
      disabled={disabled}
      onPress={() => !disabled && onValueChange(!value)}
      style={{
        alignItems: 'center',
        backgroundColor: value ? Colors.primary500 : 'transparent',
        borderColor: value ? Colors.primary500 : Colors.neutral200,
        borderRadius: 4,
        borderWidth: 2,
        height: 24,
        justifyContent: 'center',
        width: 24,
      }}
    >
      {value && <Text style={{ color: Colors.neutral900, fontSize: 16, fontWeight: 'bold' }}>✓</Text>}
    </TouchableOpacity>
  );
}

export default Checkbox;
