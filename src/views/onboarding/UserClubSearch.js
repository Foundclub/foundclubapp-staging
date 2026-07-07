import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { markOnboardingComplete } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import OnboardingOptionalHint from '@/components/molecules/onboardingOptionalHint/OnboardingOptionalHint';
import FormScreenContainer from '@/components/templates/FormScreenContainer';
import OnboardingStateView from '@/views/onboarding/components/OnboardingStateView';

import { RouteNames } from '@/navigation/routeNames';

import { updateMe } from '@/services/auth/authService';

/**
 * User club search status screen
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 */
function UserClubSearch({ navigation }) {
  const [isLooking, setIsLooking] = useState(/** @type {boolean | null} */ (null));

  const {
    getNextOnboardingRoute,
    refetchUserData,
    userData,
    userDataError,
    userDataLoading,
  } = useAuth();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onError: (error) => {
      Alert.alert('Erreur', error?.message || 'Impossible de mettre à jour votre profil.');
    },
    onSuccess: async () => {
      const nextRoute = getNextOnboardingRoute(RouteNames.UserClubSearch);
      if (!nextRoute) {
        markOnboardingComplete(userData?.documentId);
        // Invalidate get-me to trigger PrivateNavigator re-evaluation
        // This will update onboardingViews -> canShowHome -> render HomeTab
        // And unmount this screen (UserClubSearch) as it's removed from valid views
        await queryClient.invalidateQueries({ queryKey: ['get-me'] });
      } else {
        navigation.navigate(nextRoute);
      }
    },
  });

  useEffect(() => {
    if (typeof userData?.isLookingForClub === 'boolean') {
      setIsLooking(userData.isLookingForClub);
    }
  }, [userData?.isLookingForClub]);

  if (userDataLoading) {
    return (
      <OnboardingStateView
        description="Nous récupérons ton profil avant de régler la visibilité."
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

  const handleNext = () => {
    if (isLooking !== null && userData) {
      updateUserMutation.mutate({ isLookingForClub: isLooking });
    }
  };

  const handleSkip = async () => {
    const nextRoute = getNextOnboardingRoute(RouteNames.UserClubSearch);
    if (!nextRoute) {
      markOnboardingComplete(userData?.documentId);
      await queryClient.invalidateQueries({ queryKey: ['get-me'] });
    } else {
      navigation.navigate(nextRoute);
    }
  };

  return (
    <FormScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        { marginBottom: insets.bottom },
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
      ]}
      contentWidth="readable"
    >
      <View style={[Spaces.gap[40]]}>
        <View style={[Spaces.gap[16]]}>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('onboarding.clubSearch.title', 'Visibilité de ton profil')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t('onboarding.clubSearch.subtitle', 'Souhaites-tu que les clubs et entraîneurs puissent voir ton profil ?')}
          </Text>
        </View>

        <View style={[Spaces.gap[16]]}>
          <TouchableOpacity
            onPress={() => setIsLooking(true)}
            style={[
              Spaces.padding[24],
              Alignments.alignCenter,
              {
                backgroundColor: isLooking === true ? `${Colors.primary500}20` : Colors.neutral800,
                borderColor: isLooking === true ? Colors.primary500 : Colors.neutral700,
                borderRadius: 16,
                borderWidth: 2,
              },
            ]}
          >
            <Text style={[Fonts.h3Bold, { color: isLooking === true ? Colors.primary500 : Colors.neutral00 }]}>
              👁️ Oui, rendre mon profil visible
            </Text>
            <Text style={[Fonts.p2, { color: Colors.neutral300, marginTop: 8, textAlign: 'center' }]}>
              Les clubs et entraîneurs pourront me contacter
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setIsLooking(false)}
            style={[
              Spaces.padding[24],
              Alignments.alignCenter,
              {
                backgroundColor: isLooking === false ? `${Colors.primary500}20` : Colors.neutral800,
                borderColor: isLooking === false ? Colors.primary500 : Colors.neutral700,
                borderRadius: 16,
                borderWidth: 2,
              },
            ]}
          >
            <Text style={[Fonts.h3Bold, { color: isLooking === false ? Colors.primary500 : Colors.neutral00 }]}>
              🔒 Non, garder mon profil privé
            </Text>
            <Text style={[Fonts.p2, { color: Colors.neutral300, marginTop: 8, textAlign: 'center' }]}>
              Mon profil ne sera pas visible dans le mercato
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[Spaces.gap[16]]}>
        <OnboardingOptionalHint />
        <Button
          disabled={isLooking === null}
          isLoading={updateUserMutation.isPending}
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
    </FormScreenContainer>
  );
}

export default UserClubSearch;
