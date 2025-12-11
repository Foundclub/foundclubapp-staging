import { useNavigation } from '@react-navigation/native';
import { Image, TouchableOpacity } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import { RouteNames } from '@/navigation/routeNames';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

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
    navigation.navigate(userData ? RouteNames.Profile : RouteNames.AuthStackAccount);
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
      <ProfileAvatar
        imageUrl={userData?.avatar?.url}
        size={40}
        enablePreview={false}
      />
    </TouchableOpacity>
  );
}

export default ProfileButton;
