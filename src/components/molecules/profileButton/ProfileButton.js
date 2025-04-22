import { useNavigation } from '@react-navigation/native';
import { Image, TouchableOpacity } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

/**
 * ProfileButton component displays user avatar and navigates to profile screen.
 * @returns {import('react').ReactElement} ProfileButton component
 */
function ProfileButton() {
  const { ApplicationStyle, Images } = useTheme();
  const { userData } = useAuth();
  const navigation = useNavigation();

  const handlePress = () => {
    // @ts-expect-error - Navigation typing will be fixed when types are properly set up
    navigation.navigate('Profile');
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[
        ApplicationStyle.borderRadius24,
        ApplicationStyle.borderColor.primary100,
        ApplicationStyle.borderWidth1,
      ]}
    >
      <Image
        source={userData?.avatar ? { uri: userData.avatar?.url } : Images.roundAvatar}
        style={[
          ApplicationStyle.borderRadius24,
          { height: 40, width: 40 },
        ]}
      />
    </TouchableOpacity>
  );
}

export default ProfileButton;
