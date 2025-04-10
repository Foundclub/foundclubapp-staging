import { Image, Text, View } from 'react-native';

import { useAuth } from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import ScreenContainer from '@/components/templates/ScreenContainer';

/**
 * Main home screen component displayed after authentication and onboarding.
 * Shows user content and provides access to core app features.
 * @returns {import('react').ReactElement} Home screen component
 */
function Home() {
  // hooks
  const {
    Alignments, Fonts, Images, Spaces,
  } = useTheme();
  const { logoutMutation } = useAuth();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Alignments.column,
        Alignments.fill,
        Spaces.gap[24],
      ]}
    >
      {/* header */}
      <View style={[
        Alignments.row,
        Alignments.alignCenter,
        Alignments.justifySpaceBetween]}
      >
        <Image source={Images.logo} style={{ height: 23, resizeMode: 'cover', width: 222 }} />
        <ProfileButton />
      </View>
      <View>
        <Text style={[Fonts.h2Black, Fonts.neutral00]}>
          Titre
        </Text>
        <Text style={[Fonts.p1, Fonts.neutral00]}>
          Sous titre
        </Text>
      </View>
      <Button onPress={handleLogout} title="Logout" variant="Primary" />
    </ScreenContainer>
  );
}

export default Home;
