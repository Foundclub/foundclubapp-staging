import {
  Image, Text, TouchableOpacity, View,
} from 'react-native';
// Hooks
import useTheme from '@/theme/themeContext';
// Components
import Loader from '@/components/atoms/loader/Loader';

/**
 * Button component.
 * @param {object} props
 * @param {boolean} [props.isLoading]
 * @param {boolean} [props.disabled]
 * @param {string} [props.title]
 * @param {'Primary' | 'PrimaryLight' | 'Secondary' | 'SecondaryLight' } props.variant
 * @param {import('react-native').ViewStyle | import('react-native').ViewStyle[]} [props.style]
 * @param {keyof import('../../../theme/types').AllImages} [props.icon]
 * @param {'before' | 'after'} [props.iconPosition]
 * @param {string} [props.iconColor]
 * @param {(event: import('react-native').GestureResponderEvent) => void} [props.onPress]
 * @param {boolean} [props.isOption]
 * @returns {import('react').ReactElement}
 */
function Button({
  disabled,
  icon,
  iconColor,
  iconPosition,
  isLoading,
  isOption = false,
  onPress,
  style,
  textStyle,
  title,
  variant,
}) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();

  const imageStyle = {
    aspectRatio: 1,
    height: 20,
    tintColor: iconColor || ApplicationStyle[`buttonText${variant}`]?.color,
    width: 20,
  };

  return (
    <TouchableOpacity
      disabled={isLoading || disabled}
      onPress={onPress}
      style={[
        ApplicationStyle[`button${variant}${isOption ? 'Option' : ''}`],
        !title && ApplicationStyle[`buttonIcon${isOption ? 'Option' : ''}`],
        disabled && ApplicationStyle.buttonDisabled,
        style,
      ]}
    >
      {isLoading ? <Loader color={Colors.primary100} />
        : (
          <View
            style={[
              Alignments.row,
              Alignments.alignCenter,
              Spaces.gap[12],
              iconPosition === 'before' && Alignments.rowReverse,
            ]}
          >
            {title ? (
              <Text
                numberOfLines={1}
                style={[
                  Fonts.p1Bold,
                  ApplicationStyle[`buttonText${variant}`],
                  textStyle,
                ]}
              >
                {title}
              </Text>
            ) : null}
            {icon ? (
              <Image
                source={Images[icon]}
                style={imageStyle}
              />
            ) : null}
          </View>
        )}
    </TouchableOpacity>
  );
}

export default Button;
