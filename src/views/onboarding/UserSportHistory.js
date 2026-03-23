import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { markOnboardingComplete } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import OnboardingOptionalHint from '@/components/molecules/onboardingOptionalHint/OnboardingOptionalHint';
import UserHistorySection from '@/components/organisms/userHistorySection/UserHistorySection'; // Added import
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetMe } from '@/services/auth/authQueries';

/**
 * User sports history input screen
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 */
function UserSportHistory({ navigation }) {
  const { getNextOnboardingRoute, getPostOnboardingHomeRoute } = useAuth();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { data: userData } = useGetMe();
  const insets = useSafeAreaInsets();

  // We don't save the history here anymore, it's done via the wizard
  // So we just handle navigation
  const handleNext = () => {
    const nextRoute = getNextOnboardingRoute(RouteNames.UserSportHistory);
    if (!nextRoute) {
      markOnboardingComplete(userData?.documentId);
      navigation.navigate(getPostOnboardingHomeRoute());
    } else {
      navigation.navigate(nextRoute);
    }
  };

  const handleAddExperience = () => {
    // Navigate to the wizard, asking to return here afterwards
    // We also ask to reset the wizard context to start fresh
    navigation.navigate('ProfileStack', {
      params: {
        resetContext: true,
        returnRoute: RouteNames.UserSportHistory,
      },
      screen: RouteNames.HistoryWizardCategory,
    });
  };

  const handleSkip = () => {
    const nextRoute = getNextOnboardingRoute(RouteNames.UserSportHistory);
    if (!nextRoute) {
      markOnboardingComplete(userData?.documentId);
      navigation.navigate(getPostOnboardingHomeRoute());
    } else {
      navigation.navigate(nextRoute);
    }
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        { marginBottom: insets.bottom },
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
      ]}
    >
      <View style={[Spaces.gap[40], { flex: 1 }]}>
        <View style={[Spaces.gap[16]]}>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('onboarding.history.title', 'Ton parcours sportif')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t('onboarding.history.subtitle', 'Raconte-nous brièvement tes expériences passées (Clubs, niveaux, postes...)')}
          </Text>
        </View>

        {/* Reusing UserHistorySection directly */}
        {/* We wrap it in a View to ensure it doesn't stretch weirdly */}
        <View style={{ flex: 1 }}>
          <UserHistorySection
            isOwnProfile
            onAddPress={handleAddExperience}
            onEditPress={(entry) => {
              // Optional: Allow editing during onboarding
              // For now let's just allow adding, or we can enable editing too
              // To enable editing we'd need to pass the entry to the wizard
            }}
            userId={userData?.documentId}
          />
        </View>
      </View>

      <View style={[Spaces.gap[16]]}>
        <OnboardingOptionalHint />
        <Button
          onPress={handleNext}
          title={t('common.actions.next', 'Suivant')}
          variant="Primary"
        />
        <Button
          accessibilityLabel={t('common.actions.continueLater', 'Continuer plus tard')}
          onPress={handleSkip}
          title={t('common.actions.continueLater', 'Continuer plus tard')}
          variant="Secondary"
        />
      </View>
    </ScreenContainer>
  );
}

export default UserSportHistory;
