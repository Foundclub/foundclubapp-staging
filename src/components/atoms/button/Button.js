import {
  TouchableOpacity, Text, Image, View,
} from 'react-native';
// hooks
import useTheme from '../../../theme/themeContext';
// components
import Loader from '../loader/Loader';

/**
 * Button component.
 * @param {object} props
 * @param {boolean} [props.isLoading]
 * @param {boolean} [props.disabled]
 * @param {string} [props.title]
 * @param {'Primary' | 'PrimaryLight' | 'Secondary' | 'SecondaryLight' } props.variant
 * @param {import('react-native').ViewStyle} [props.style]
 * @param {string} [props.loaderColor]
 * @param {keyof import('../../../theme/types').AllImages} [props.icon]
 * @param {'before' | 'after'} [props.iconPosition]
 * @param {(event: import('react-native').GestureResponderEvent) => void} [props.onPress]
 * @returns {import('react').ReactElement}
 */
function Button({
  isLoading,
  disabled,
  title,
  variant,
  style,
  loaderColor,
  icon,
  iconPosition,
  onPress,
}) {
  const {
    ApplicationStyle, Images, Alignments, Spaces, Fonts,
  } = useTheme();

  const imageStyle = {
    width: 16,
    aspectRatio: 1,
    tintColor: ApplicationStyle[`buttonText${variant}`].color,
  };

  return (
    <TouchableOpacity
      disabled={isLoading || disabled}
      onPress={onPress}
      style={[
        ApplicationStyle[`button${variant}`],
        !title && ApplicationStyle.buttonIcon,
        disabled && ApplicationStyle.buttonDisabled,
        style,
      ]}
    >
      {isLoading ? <Loader color={loaderColor} />
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
                style={[
                  Fonts.p1Bold,
                  ApplicationStyle[`buttonText${variant}`],
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
