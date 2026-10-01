import { TouchableOpacity } from 'react-native';

import useTheme from '@/theme/themeContext';

import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';

/**
 *
 * @param root0
 * @param root0.disabled
 * @param root0.onValueChange
 * @param root0.value
 */
function Checkbox({ disabled, onValueChange, value }) {
  const { Colors } = useTheme();

  return (
    <TouchableOpacity
      accessibilityRole="checkbox"
      accessibilityState={{ checked: Boolean(value), disabled: Boolean(disabled) }}
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
      {value && <SvgIcon color={Colors.neutral900} height={16} name="check" width={16} />}
    </TouchableOpacity>
  );
}

export default Checkbox;
