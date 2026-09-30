import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Platform, TouchableOpacity, View } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';

import { openPublicAuthFlow } from '@/navigation/public/publicAuthNavigation';
import { RouteNames } from '@/navigation/routeNames';

/**
 * ProfileButton component displays user avatar and navigates to profile screen.
 *
 * 🔴 A17 (lot ACCUEIL, 30/09) — `hasAlert` : un point rouge sur l'avatar. La case
 * « Mes cotisations » de l'accueil le portait quand il reste une cotisation à
 * payer ; elle a rejoint « Mon compte », son rappel passe sur la porte de
 * « Mon compte ». Seul l'accueil le pose ; les autres écrans ne changent pas.
 * @param {{ hasAlert?: boolean }} [props]
 * @returns {import('react').ReactElement} ProfileButton component
 */
function ProfileButton({ hasAlert = false } = {}) {
  const { ApplicationStyle, Colors } = useTheme();
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
      accessibilityLabel={hasAlert
        ? `${t('profile.title', 'Profil')}, ${t('profile.alerts.licenseDue')}`
        : t('profile.title', 'Profil')}
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
        name={!isAddingAccount ? [userData?.firstname, userData?.lastname].filter(Boolean).join(' ') : ''}
        size={40}
      />
      {hasAlert ? (
        // Le même point que les cases de l'accueil et les lignes du bandeau
        // (`HomeHeadBanner.js`) : rouge d'alerte de la charte, collé au coin.
        <View
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={{
            backgroundColor: Colors.error500,
            borderRadius: 5,
            height: 10,
            position: 'absolute',
            right: 0,
            top: 0,
            width: 10,
          }}
        />
      ) : null}
    </TouchableOpacity>
  );
}

export default ProfileButton;
