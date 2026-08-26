import {
  Image, Platform, Text, TouchableOpacity, View,
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
 * @param {import('react-native').Insets} [props.hitSlop]
 * @param {string} [props.title]
 * @param {'Primary' | 'PrimaryLight' | 'Secondary' | 'SecondaryLight' | 'Ghost'} [props.variant]
 * @param {import('react-native').ViewStyle | import('react-native').ViewStyle[]} [props.style]
 * @param {import('react-native').TextStyle | import('react-native').TextStyle[]} [props.textStyle]
 * @param {keyof import('../../../theme/types').AllImages} [props.icon]
 * @param {'before' | 'after'} [props.iconPosition]
 * @param {string} [props.iconColor]
 * @param {(event: import('react-native').GestureResponderEvent) => void} [props.onPress]
 * @param {boolean} [props.isOption]
 * @param {'md' | 'sm' | 'small'} [props.size]
 * @param {string} [props.accessibilityLabel]
 * @param {string} [props.accessibilityHint]
 * @param {import('react-native').AccessibilityRole} [props.accessibilityRole]
 * @param {boolean} [props.submitOnEnter]
 * @returns {import('react').ReactElement}
 */
function Button({
  accessibilityHint,
  accessibilityLabel,
  accessibilityRole = 'button',
  disabled,
  hitSlop,
  icon,
  iconColor,
  iconPosition,
  isLoading,
  isOption = false,
  onPress,
  size = 'md',
  style,
  submitOnEnter = false,
  textStyle,
  title,
  variant = 'Primary',
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
  const normalizedSize = size === 'small' ? 'sm' : size;
  const isSmall = normalizedSize === 'sm';
  const sizeStyle = isSmall
    ? {
      borderRadius: 12,
      height: 39,
      paddingHorizontal: 12,
    }
    : null;
  const sizeIconStyle = isSmall
    ? {
      borderRadius: 12,
      height: 39,
      width: 39,
    }
    : null;
  const sizeTextStyle = isSmall ? Fonts.p2Bold : null;
  const isDisabled = isLoading || disabled;

  /**
   * @param {any} event
   */
  const handleKeyDown = (event) => {
    if (Platform.OS !== 'web' || !submitOnEnter || isDisabled || !onPress) {
      return;
    }

    if (event?.key !== 'Enter' && event?.key !== ' ') {
      return;
    }

    event?.preventDefault?.();
    onPress(event);
  };

  return (
    <TouchableOpacity
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      disabled={isDisabled}
      focusable={!isDisabled}
      hitSlop={hitSlop}
      onKeyDown={handleKeyDown}
      onPress={onPress}
      style={[
        ApplicationStyle[`button${variant}${isOption ? 'Option' : ''}`],
        sizeStyle,
        !title && ApplicationStyle[`buttonIcon${isOption ? 'Option' : ''}`],
        !title && sizeIconStyle,
        isDisabled && ApplicationStyle.buttonDisabled,
        style,
      ]}
    >
      {isLoading ? <Loader color={ApplicationStyle[`buttonText${variant}`]?.color || Colors.primary100} />
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
                  sizeTextStyle,
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
