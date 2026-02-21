import { useNavigation } from '@react-navigation/native';
import { Image, Platform, TouchableOpacity } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * HeaderBackButton component.
 * @param {object} props
 * @param {() => void} [props.onPress]
 * @param {import('react-native').StyleProp<import('react-native').ViewStyle>} [props.style]
 * @param {import('react-native').StyleProp<import('react-native').ImageStyle>} [props.iconStyle]
 * @param {boolean} [props.withDefaultMargin]
 * @param {keyof import('../../../theme/types').Colors} [props.color]
 * @param {keyof import('../../../theme/types').Colors} [props.borderColor]
 * @param {string} [props.accessibilityLabel]
 * @param {string} [props.accessibilityHint]
 * @param {import('react-native').AccessibilityRole} [props.accessibilityRole]
 * @returns {import('react').ReactElement}
 */
function HeaderBackButton({
  accessibilityHint = undefined,
  accessibilityLabel = undefined,
  accessibilityRole = 'button',
  borderColor = 'primary500',
  color = 'primary500',
  iconStyle = [],
  onPress = undefined,
  style = [],
  withDefaultMargin = true,
}) {
  const navigation = useNavigation();
  const { ApplicationStyle, Images, Spaces } = useTheme();
  const resolvedBorderColor = ApplicationStyle.borderColor[borderColor]
    || ApplicationStyle.borderColor.primary500;
  const resolvedTintColor = ApplicationStyle.tintColor[color]
    || ApplicationStyle.tintColor.primary500;
  let defaultMarginStyle = null;
  if (withDefaultMargin) {
    defaultMarginStyle = Platform.OS === 'ios'
      ? Spaces.marginLeft[16]
      : Spaces.marginLeft[12];
  }

  return (
    <TouchableOpacity
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      onPress={onPress || navigation.goBack}
      style={[
        ApplicationStyle.borderRadius100,
        ApplicationStyle.borderWidth1,
        resolvedBorderColor,
        Spaces.padding[8],
        defaultMarginStyle,
        style,
      ]}
    >
      <Image
        source={Images.arrowLeft}
        style={[ApplicationStyle.icon16, resolvedTintColor, iconStyle]}
      />
    </TouchableOpacity>
  );
}

export default HeaderBackButton;
