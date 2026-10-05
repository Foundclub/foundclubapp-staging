import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
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
 * @param {'arrowLeft' | 'close'} [props.iconName] - COLL-C4A3 : la croix d'un écran qu'on ANNULE
 *   (une saisie), la flèche (par défaut) d'un écran qu'on quitte.
 * @param {boolean} [props.decorative] - FINITIONS15 point 9c : dessinée DANS le bouton de
 *   react-navigation (`headerBackImage`), la flèche n'est pas un second élément accessible.
 * @returns {import('react').ReactElement}
 */
function HeaderBackButton({
  accessibilityHint = undefined,
  accessibilityLabel = undefined,
  accessibilityRole = 'button',
  borderColor = 'primary500',
  color = 'primary500',
  decorative = false,
  iconName = 'arrowLeft',
  iconStyle = [],
  onPress = undefined,
  style = [],
  withDefaultMargin = true,
}) {
  const navigation = useNavigation();
  const { t } = useTranslation();
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
      accessibilityHint={decorative ? undefined : accessibilityHint}
      accessibilityLabel={decorative ? undefined : accessibilityLabel || t('common.back')}
      accessibilityRole={decorative ? undefined : accessibilityRole}
      accessible={!decorative}
      hitSlop={ApplicationStyle.hitSlop.min44From32}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
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
        source={Images[iconName] || Images.arrowLeft}
        style={[ApplicationStyle.icon16, resolvedTintColor, iconStyle]}
      />
    </TouchableOpacity>
  );
}

export default HeaderBackButton;
