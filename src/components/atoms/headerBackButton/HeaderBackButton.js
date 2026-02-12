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
 * @returns {import('react').ReactElement}
 */
function HeaderBackButton({
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

  return (
    <TouchableOpacity
      onPress={onPress || navigation.goBack}
      style={[
        ApplicationStyle.borderRadius100,
        ApplicationStyle.borderWidth1,
        resolvedBorderColor,
        Spaces.padding[12],
        Spaces.padding[8],
        withDefaultMargin ? (
          Platform.OS === 'ios'
            ? Spaces.marginLeft[16] : Spaces.marginLeft[12]
        ) : null,
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
