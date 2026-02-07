import { useTranslation } from 'react-i18next';
import {
  Image, ScrollView, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import { storage, useAppContext } from '@/store/appContext';
import { markOnboardingComplete } from '@/domains/auth/authUseCases';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

/**
 * Welcome screen component shown after completing onboarding.
 * Displays app features and information for new users.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Welcome screen component
 */
function Welcome({ navigation }) {
  // hooks
  const {
    Alignments, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [{ auth }] = useAppContext();

  const handleNext = () => {
    if (auth?.user?.documentId) {
      storage.set(`hasSeenWelcome_${auth.user.documentId}`, true);
      // Mark onboarding as fully completed so it won't show again
      markOnboardingComplete(auth.user.documentId);
    }
    navigation.reset({
      index: 0,
      routes: [{ name: RouteNames.HomeTab }],
    });
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.padding[24],
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
        { marginBottom: insets.bottom },
      ]}
    >
      <ScrollView
        contentContainerStyle={[Spaces.gap[40]]}
        style={[Alignments.fill]}
      >
        <View style={[Alignments.alignCenter, Spaces.gap[12]]}>
          <Text style={[Fonts.h1Bold, Fonts.neutral00]}>
            {t('welcome.title')}
          </Text>
          <Image
            source={Images.logo}
            style={{ height: 17, width: 156 }}
          />

        </View>
        <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
          {t('welcome.subtitle')}
        </Text>
        <Text style={[Fonts.p1Black, Fonts.neutral00]}>
          {t('welcome.descriptions.search.bold')}
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t('welcome.descriptions.search.regular')}
          </Text>
        </Text>
        <Text style={[Fonts.p1Black, Fonts.neutral00]}>
          {t('welcome.descriptions.register.bold')}
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t('welcome.descriptions.register.regular')}
          </Text>
        </Text>
        <Text style={[Fonts.p1Black, Fonts.neutral00]}>
          {t('welcome.descriptions.club.bold')}
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t('welcome.descriptions.club.regular')}
          </Text>
        </Text>
        <Text style={[Fonts.p1Black, Fonts.neutral00]}>
          {t('welcome.descriptions.info.bold')}
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t('welcome.descriptions.info.regular')}
          </Text>
        </Text>
      </ScrollView>
      <Button
        onPress={handleNext}
        title={t('welcome.actions.go')}
        variant="Primary"
      />
    </ScreenContainer>
  );
}

export default Welcome;
