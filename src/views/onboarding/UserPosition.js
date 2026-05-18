import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
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

import { useGetMe } from '@/services/auth/authQueries';
import { updateMe } from '@/services/auth/authService';

// Import positions from centralized constants
import { getPositionsForSport, SPORTS_WITH_POSITIONS } from '@/constants/positions';

/**
 * User position selection screen
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 */
function UserPosition({ navigation, route }) {
  const [selectedPositions, setSelectedPositions] = useState(/** @type {string[]} */ ([]));

  const { getNextOnboardingRoute, getPostOnboardingHomeRoute } = useAuth();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const {
    data: userData,
    error: userDataError,
    isLoading: userDataLoading,
    refetch: refetchUserData,
  } = useGetMe();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  // Get sport from route params (passed from UserSport) or fall back to userData
  const userSport = route?.params?.selectedSport || userData?.preferredSport;

  // Get positions based on user's preferred sport
  const positions = useMemo(() => {
    const sportPositions = getPositionsForSport(userSport);
    // Default to football if sport not found
    return sportPositions.length > 0 ? sportPositions : getPositionsForSport('football');
  }, [userSport]);

  useEffect(() => {
    const currentPositions = String(userData?.position || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (currentPositions.length) {
      setSelectedPositions(currentPositions);
    }
  }, [userData?.position]);

  // Check if we should skip this step
  useEffect(() => {
    const sport = userSport?.toLowerCase();
    if (!userDataLoading && sport && !SPORTS_WITH_POSITIONS.includes(sport)) {
      // Sport doesn't have positions, skip this step
      navigation.navigate(getNextOnboardingRoute(RouteNames.UserPosition) || getPostOnboardingHomeRoute());
    }
  }, [getNextOnboardingRoute, getPostOnboardingHomeRoute, navigation, userDataLoading, userSport]);

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onError: (error) => {
      Alert.alert('Erreur', error?.message || 'Impossible de mettre à jour votre profil.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['get-me'] });
      navigation.navigate(getNextOnboardingRoute(RouteNames.UserPosition) || getPostOnboardingHomeRoute());
    },
  });

  // Toggle position selection
  const togglePosition = (positionValue) => {
    setSelectedPositions((prev) => {
      if (prev.includes(positionValue)) {
        return prev.filter((p) => p !== positionValue);
      }
      return [...prev, positionValue];
    });
  };

  const handleNext = () => {
    if (selectedPositions.length > 0 && userData) {
      // Join multiple positions with comma
      updateUserMutation.mutate({ position: selectedPositions.join(', ') });
    }
  };

  const handleSkip = () => {
    navigation.navigate(getNextOnboardingRoute(RouteNames.UserPosition) || getPostOnboardingHomeRoute());
  };

  // Get sport name for display
  const sportName = useMemo(() => {
    const sport = userSport?.toLowerCase();
    const sportNames = {
      basketball: 'Basketball',
      football: 'Football',
      handball: 'Handball',
      rugby: 'Rugby',
      volleyball: 'Volleyball',
    };
    return sportNames[sport] || sport;
  }, [userSport]);

  if (userDataLoading) {
    return (
      <OnboardingStateView
        description="Nous récupérons ton profil avant de choisir tes postes."
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
        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('onboarding.position.title', 'Quel(s) poste(s) ?')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {sportName
              ? `Postes en ${sportName} (plusieurs choix possibles)`
              : t('onboarding.position.subtitle', 'Sélectionne tes postes de prédilection')}
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={[Spaces.gap[12]]}
          showsVerticalScrollIndicator={false}
          style={[Alignments.fill]}
        >
          {positions.map((position) => {
            const isSelected = selectedPositions.includes(position.value);
            return (
              <TouchableOpacity
                key={position.value}
                onPress={() => togglePosition(position.value)}
                style={[
                  Spaces.padding[16],
                  Alignments.row,
                  Alignments.alignCenter,
                  {
                    backgroundColor: isSelected ? `${Colors.primary500}20` : Colors.neutral800,
                    borderColor: isSelected ? Colors.primary500 : Colors.neutral700,
                    borderRadius: 12,
                    borderWidth: 2,
                  },
                ]}
              >
                <Text style={[Fonts.p1Bold, { color: isSelected ? Colors.primary500 : Colors.neutral00 }]}>
                  {position.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <OnboardingStickyFooter>
        <OnboardingOptionalHint />
        <Button
          disabled={selectedPositions.length === 0}
          isLoading={updateUserMutation.isPending}
          onPress={handleNext}
          title={selectedPositions.length > 1
            ? t('common.actions.nextCount', `Suivant (${selectedPositions.length} postes)`)
            : t('common.actions.next', 'Suivant')}
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

export default UserPosition;
