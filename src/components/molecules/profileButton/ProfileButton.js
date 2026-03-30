import { useNavigation } from '@react-navigation/native';
import { Platform, TouchableOpacity } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import { RouteNames } from '@/navigation/routeNames';

/**
 * ProfileButton component displays user avatar and navigates to profile screen.
 * @returns {import('react').ReactElement} ProfileButton component
 */
function ProfileButton() {
  const { ApplicationStyle } = useTheme();
  const { userData } = useAuth();
  const navigation = useNavigation();
  const [{ isAddingAccount }, dispatch] = useAppContext();

  const handlePress = () => {
    if (isAddingAccount) {
      dispatch({ type: 'CANCEL_ADD_ACCOUNT' });
      return;
    }
    const targetRoute = userData
      ? (Platform.OS === 'web' ? RouteNames.Profile : RouteNames.ProfileStack)
      : (Platform.OS === 'web' ? RouteNames.Login : RouteNames.AuthStackAccount);
    // @ts-expect-error - Navigation typing will be fixed when types are properly set up
    navigation.navigate(targetRoute);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[
        ApplicationStyle.borderRadius24,
      ]}
    >
      <ProfileAvatar
        enablePreview={false}
        imageUrl={!isAddingAccount ? userData?.avatar?.url : undefined}
        size={40}
      />
    </TouchableOpacity>
  );
}

export default ProfileButton;
