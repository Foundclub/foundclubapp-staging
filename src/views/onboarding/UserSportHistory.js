import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';
import UserHistorySection from '@/components/organisms/userHistorySection/UserHistorySection'; // Added import

import { RouteNames } from '@/navigation/routeNames';

import { useGetMe } from '@/services/auth/authQueries';
import { markOnboardingComplete } from '@/domains/auth/authUseCases';

/**
 * User sports history input screen
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 */
function UserSportHistory({ navigation }) {
  const { getNextOnboardingRoute } = useAuth();
  const { Alignments, Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const { data: userData } = useGetMe();
  const insets = useSafeAreaInsets();
  
  // We don't save the history here anymore, it's done via the wizard
  // So we just handle navigation
  const handleNext = () => {
    markOnboardingComplete(userData?.documentId);
    
    const nextRoute = getNextOnboardingRoute(RouteNames.UserSportHistory);
    if (!nextRoute) {
      navigation.navigate(RouteNames.HomeTab);
    } else {
      navigation.navigate(nextRoute);
    }
  };

  const handleAddExperience = () => {
    // Navigate to the wizard, asking to return here afterwards
    // We also ask to reset the wizard context to start fresh
    navigation.navigate('ProfileStack', {
      screen: RouteNames.HistoryWizardClub,
      params: { 
        returnRoute: RouteNames.UserSportHistory,
        resetContext: true
      }
    });
  };

  const handleSkip = () => {
    const nextRoute = getNextOnboardingRoute(RouteNames.UserSportHistory);
    if (!nextRoute) {
      markOnboardingComplete(userData?.documentId);
      navigation.navigate(RouteNames.HomeTab);
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
            userId={userData?.documentId} 
             isOwnProfile={true}
             onAddPress={handleAddExperience}
             onEditPress={(entry) => {
               // Optional: Allow editing during onboarding
               // For now let's just allow adding, or we can enable editing too
               // To enable editing we'd need to pass the entry to the wizard
             }}
           />
        </View>
      </View>

      <View style={[Spaces.gap[16]]}>
        <Button
          onPress={handleNext}
          title={t('common.actions.next', 'Suivant')}
          variant="Primary"
        />
        <TouchableOpacity onPress={handleSkip} style={[Alignments.alignCenter]}>
          <Text style={[Fonts.p1, Fonts.neutral300, Fonts.underlineText]}>
            {t('profile.actions.ignore', 'Ignorer')}
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

export default UserSportHistory;
