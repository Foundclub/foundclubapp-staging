import { useEffect } from 'react';
import { Image, Text, View } from 'react-native';

import { useAuth } from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import ScreenContainer from '@/components/templates/ScreenContainer';

/**
 * Main home screen component displayed after authentication and onboarding.
 * Shows user content and provides access to core app features.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Home screen component
 */
function Home({ navigation }) {
  // hooks
  const {
    Alignments, Fonts, Images, Spaces,
  } = useTheme();
  const { onboardingViews } = useAuth();

  useEffect(() => {
    const route = onboardingViews?.views?.reduce((acc, view) => {
      if (view.index < acc.index && view.canShow) {
        return view;
      }
      return acc;
    }, { index: 100, route: '' })?.route;
    if (route) {
      navigation.navigate(route);
    }
  }, [onboardingViews, navigation]);

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
