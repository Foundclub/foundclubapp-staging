import { useNavigation } from '@react-navigation/native';
import { Image, Platform, TouchableOpacity } from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * HeaderBackButton component.
 * @param {object} props
 * @param {() => void} [props.onPress]
 * @returns {import('react').ReactElement}
 */
function HeaderBackButton({ onPress = undefined }) {
  const navigation = useNavigation();
  const { ApplicationStyle, Images, Spaces } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress || navigation.goBack}
      style={[
        ApplicationStyle.borderRadius100,
        ApplicationStyle.borderWidth1,
        ApplicationStyle.borderColor.primary500,
        Spaces.padding[12],
        Spaces.padding[8],
        Platform.OS === 'ios'
          ? Spaces.marginLeft[16] : Spaces.marginLeft[12],
      ]}
    >
      <Image
        source={Images.arrowLeft}
        style={[ApplicationStyle.icon16, ApplicationStyle.tintColor.primary500]}
      />
    </TouchableOpacity>
  );
}

export default HeaderBackButton;
