import { Image, Text, View } from 'react-native';

import useTheme from '@/theme/themeContext';

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
        Spaces.marginTop[16],
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
    </ScreenContainer>
  );
}

export default Home;
