import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import OnboardingOptionalHint from '@/components/molecules/onboardingOptionalHint/OnboardingOptionalHint';
import FormScreenContainer from '@/components/templates/FormScreenContainer';
import OnboardingStateView from '@/views/onboarding/components/OnboardingStateView';
import OnboardingStickyFooter from '@/views/onboarding/components/OnboardingStickyFooter';

import { RouteNames } from '@/navigation/routeNames';

import { updateMe } from '@/services/auth/authService';
import { useGetLevels } from '@/services/level/levelQueries';

/**
 * User best level selection screen
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 */
function UserLevel({ navigation }) {
  const [selectedLevel, setSelectedLevel] = useState(/** @type {string | null} */ (null));

  const {
    getNextOnboardingRoute,
    getPostOnboardingHomeRoute,
    refetchUserData,
    userData,
    userDataError,
    userDataLoading,
  } = useAuth();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const {
    data: levels,
    error: levelsError,
    isLoading: levelsLoading,
    refetch: refetchLevels,
  } = useGetLevels();
  const insets = useSafeAreaInsets();

  const queryClient = useQueryClient();
  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onError: (error) => {
      Alert.alert('Erreur', error?.message || 'Impossible de mettre à jour votre profil.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['get-me'] });
      navigation.navigate(getNextOnboardingRoute(RouteNames.UserLevel) || getPostOnboardingHomeRoute());
    },
  });

  useEffect(() => {
    const currentLevel = userData?.bestLevel?.name || userData?.bestLevel || null;
    if (currentLevel) {
      setSelectedLevel(String(currentLevel));
    }
  }, [userData?.bestLevel]);

  if (userDataLoading) {
    return (
      <OnboardingStateView
        description="Nous récupérons ton profil avant de choisir ton niveau."
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

  if (levelsLoading && !levels?.length) {
    return (
      <OnboardingStateView
        description="Nous chargeons les niveaux disponibles."
        isLoading
        title="Chargement des niveaux"
      />
    );
  }

  if (levelsError && !levels?.length) {
    return (
      <OnboardingStateView
        actionLabel="Réessayer"
        description={levelsError?.message || 'Impossible de charger les niveaux.'}
        onAction={refetchLevels}
        title="Chargement impossible"
      />
    );
  }

  const handleNext = () => {
    if (selectedLevel && userData) {
      updateUserMutation.mutate({ bestLevel: selectedLevel });
    }
  };

  const handleSkip = () => {
    navigation.navigate(getNextOnboardingRoute(RouteNames.UserLevel) || getPostOnboardingHomeRoute());
  };

  const sortedLevels = levels || [];

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
    >
      <View style={[Alignments.fill, Spaces.gap[24]]}>
        <View style={[Spaces.gap[16]]}>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('onboarding.level.title', 'Ton meilleur niveau ?')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t('onboarding.level.subtitle', 'Quel est le plus haut niveau auquel tu as joué ?')}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={[Spaces.gap[12], Spaces.paddingBottom[20]]}
          showsVerticalScrollIndicator={false}
          style={[Alignments.fill]}
        >
          {sortedLevels.map((level) => (
            <TouchableOpacity
              key={level.documentId || level.id}
              onPress={() => setSelectedLevel(level.name)}
              style={[
                Spaces.padding[16],
                {
                  backgroundColor: selectedLevel === level.name ? `${Colors.primary500}20` : Colors.neutral800,
                  borderColor: selectedLevel === level.name ? Colors.primary500 : Colors.neutral700,
                  borderRadius: 12,
                  borderWidth: 2,
                },
              ]}
            >
              <Text style={[Fonts.p1Bold, { color: selectedLevel === level.name ? Colors.primary500 : Colors.neutral00 }]}>
                {level.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <OnboardingStickyFooter>
        <OnboardingOptionalHint />
        <Button
          disabled={!selectedLevel}
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
      </OnboardingStickyFooter>
    </FormScreenContainer>
  );
}

export default UserLevel;
