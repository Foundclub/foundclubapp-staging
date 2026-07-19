import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Platform, TouchableOpacity } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import { openPublicAuthFlow } from '@/navigation/public/publicAuthNavigation';
import { RouteNames } from '@/navigation/routeNames';

/**
 * ProfileButton component displays user avatar and navigates to profile screen.
 * @returns {import('react').ReactElement} ProfileButton component
 */
function ProfileButton() {
  const { ApplicationStyle } = useTheme();
  const { t } = useTranslation();
  const { userData } = useAuth();
  const navigation = useNavigation();
  const [{ isAddingAccount }, dispatch] = useAppContext();

  const handlePress = () => {
    if (isAddingAccount) {
      dispatch({ type: 'CANCEL_ADD_ACCOUNT' });
      return;
    }

    let targetRoute = null;
    if (userData) {
      targetRoute = Platform.OS === 'web' ? RouteNames.Profile : RouteNames.ProfileStack;
    }

    // @ts-expect-error - Navigation typing will be fixed when types are properly set up
    if (targetRoute) {
      navigation.navigate(targetRoute);
      return;
    }

    openPublicAuthFlow(navigation, {
      origin: 'profile-button',
      source: 'profile-button',
    });
  };

  return (
    <TouchableOpacity
      accessibilityLabel={t('profile.title', 'Profil')}
      accessibilityRole="button"
      hitSlop={ApplicationStyle.hitSlop.min44From40}
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
