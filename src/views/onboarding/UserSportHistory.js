import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { markOnboardingComplete } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import UserHistorySection from '@/components/organisms/userHistorySection/UserHistorySection'; // Added import
import FormScreenContainer from '@/components/templates/FormScreenContainer';
import OnboardingSkipLink from '@/views/onboarding/components/OnboardingSkipLink';
import OnboardingStateView from '@/views/onboarding/components/OnboardingStateView';

import { RouteNames } from '@/navigation/routeNames';

/**
 * User sports history input screen
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 */
function UserSportHistory({ navigation }) {
  const {
    getNextOnboardingRoute,
    refetchUserData,
    userData,
    userDataError,
    userDataLoading,
  } = useAuth();
  const {
    Alignments, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  if (userDataLoading) {
    return (
      <OnboardingStateView
        description="Nous récupérons ton profil avant d'afficher ton historique."
        isLoading
        title="Chargement du profil"
      />
    );
  }

  if (userDataError) {
    return (
      <OnboardingStateView
        actionLabel="Réessayer"
        description={userDataError?.message || 'Impossible de charger ton profil.'}
        onAction={refetchUserData}
        title="Chargement impossible"
      />
    );
  }

  // We don't save the history here anymore, it's done via the wizard
  // So we just handle navigation
  const handleNext = () => {
    const nextRoute = getNextOnboardingRoute(RouteNames.UserSportHistory);
    if (!nextRoute) {
      markOnboardingComplete(userData?.documentId);
      // Reveal fin d'onboarding (chantier C, Option A) : carte de collection en
      // mode celebration AVANT le home. PlayerCard est enregistre dans le
      // ProfileStack imbrique -> navigation imbriquee obligatoire depuis ici.
      // Le bouton "Plus tard, continuer" de PlayerCardScreen route ensuite
      // vers getPostOnboardingHomeRoute().
      navigation.navigate(RouteNames.ProfileStack, {
        params: { celebration: true },
        screen: RouteNames.PlayerCard,
      });
    } else {
      navigation.navigate(nextRoute);
    }
  };

  const handleAddExperience = () => {
    navigation.navigate(RouteNames.HistoryWizardCategory, {
      resetContext: true,
      returnRoute: RouteNames.UserSportHistory,
    });
  };

  const handleSkip = () => {
    const nextRoute = getNextOnboardingRoute(RouteNames.UserSportHistory);
    if (!nextRoute) {
      markOnboardingComplete(userData?.documentId);
      navigation.navigate(RouteNames.ProfileStack, {
        params: { celebration: true },
        screen: RouteNames.PlayerCard,
      });
    } else {
      navigation.navigate(nextRoute);
    }
  };

  return (
    <FormScreenContainer
      bgImage="bg2"
      // D31 ⑤ — l'écran pose LUI-MÊME le retrait bas (`marginBottom` ci-dessous).
      // Sans ce mode, le conteneur en ajoutait un SECOND : `insets.bottom` était
      // compté deux fois, soit ~34 pt de vide sous « Passer cette étape ».
      bottomInsetMode="edge-to-edge"
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
              navigation.navigate(RouteNames.HistoryWizardCategory, {
                editingEntry: entry,
                returnRoute: RouteNames.UserSportHistory,
              });
            }}
            userId={userData?.documentId}
          />
        </View>
      </View>

      <View style={[Spaces.gap[16]]}>
        <Button
          onPress={handleNext}
          title={t('common.actions.next', 'Continuer')}
          variant="Primary"
        />
        <OnboardingSkipLink onPress={handleSkip} />
      </View>
    </FormScreenContainer>
  );
}

export default UserSportHistory;
