import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, ScrollView, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import FormScreenContainer from '@/components/templates/FormScreenContainer';
import OnboardingRadioRow from '@/views/onboarding/components/OnboardingRadioRow';
import OnboardingSkipLink from '@/views/onboarding/components/OnboardingSkipLink';
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
    Alignments, Fonts, Spaces,
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
      Alert.alert('Erreur', error?.message || 'Impossible de mettre à jour ton profil.');
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
      <View style={[Alignments.fill, Spaces.gap[24]]}>
        <View style={[Spaces.gap[16]]}>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('onboarding.level.title', 'Ton meilleur niveau ?')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t('onboarding.level.subtitle', 'Le plus haut niveau auquel tu as joué — facultatif.')}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={[Spaces.gap[12], Spaces.paddingBottom[24]]}
          showsVerticalScrollIndicator={false}
          style={[Alignments.fill]}
        >
          {/*
            D56 — meme grammaire que Statut et Section : le pack montre bien
            des rangees-radio ici, pas des chips. La coche « ✓ » en texte
            disparait, et la rangee cesse de se declarer « bouton ».
          */}
          {sortedLevels.map((level) => (
            <OnboardingRadioRow
              checked={selectedLevel === level.name}
              key={level.documentId || level.id}
              label={level.name}
              onPress={() => setSelectedLevel(level.name)}
            />
          ))}
        </ScrollView>
      </View>

      <OnboardingStickyFooter>
        <Button
          disabled={!selectedLevel}
          isLoading={updateUserMutation.isPending}
          onPress={handleNext}
          title={t('common.actions.next', 'Continuer')}
          variant="Primary"
        />
        <OnboardingSkipLink onPress={handleSkip} />
      </OnboardingStickyFooter>
    </FormScreenContainer>
  );
}

export default UserLevel;
