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
import FormScreenContainer from '@/components/templates/FormScreenContainer';
import OnboardingSkipLink from '@/views/onboarding/components/OnboardingSkipLink';
import OnboardingStateView from '@/views/onboarding/components/OnboardingStateView';
import OnboardingStickyFooter from '@/views/onboarding/components/OnboardingStickyFooter';

import { RouteNames } from '@/navigation/routeNames';

import { updateMe } from '@/services/auth/authService';

// Import positions from centralized constants
import { getPositionsForSport } from '@/constants/positions';

/**
 * User position selection screen
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 */
function UserPosition({ navigation, route }) {
  const [selectedPositions, setSelectedPositions] = useState(/** @type {string[]} */ ([]));

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
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  // Get sport from route params (passed from UserSport) or fall back to userData
  const userSport = route?.params?.selectedSport || userData?.preferredSport;

  // Get positions based on user's preferred sport.
  // D23 - le repli « liste du football » a ete retire : il montrait des postes
  // de football a un rugbyman et, surtout, il masquait le cas « aucun sport »
  // que le garde-fou ci-dessous doit voir.
  const positions = useMemo(() => getPositionsForSport(userSport), [userSport]);

  useEffect(() => {
    const currentPositions = String(userData?.position || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (currentPositions.length) {
      setSelectedPositions(currentPositions);
    }
  }, [userData?.position]);

  // D23 - L'ECRAN SE RETIRE LUI-MEME QUAND IL N'A RIEN A MONTRER.
  // Deux cas : sport sans postes (comportement d'origine), et AUCUN sport -
  // l'utilisateur a saute l'etape Sport. C'est ce garde-fou qui autorise
  // l'etape a rester au programme tant que le sport n'est pas repondu, ce qui
  // est la condition pour que `PrivateNavigator` la monte : sans elle, l'ecran
  // Sport ne pouvait pas y naviguer et le poste etait saute pour les 5 sports.
  useEffect(() => {
    if (userDataLoading || positions.length > 0) return;
    navigation.navigate(getNextOnboardingRoute(RouteNames.UserPosition) || getPostOnboardingHomeRoute());
  }, [getNextOnboardingRoute, getPostOnboardingHomeRoute, navigation, positions, userDataLoading]);

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onError: (error) => {
      Alert.alert('Erreur', error?.message || 'Impossible de mettre à jour ton profil.');
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
                accessibilityRole="checkbox"
                accessibilityState={{ checked: isSelected }}
                key={position.value}
                onPress={() => togglePosition(position.value)}
                style={[
                  Spaces.padding[16],
                  Alignments.row,
                  Alignments.alignCenter,
                  Alignments.justifySpaceBetween,
                  Spaces.gap[12],
                  {
                    backgroundColor: isSelected ? `${Colors.primary500}20` : Colors.neutral800,
                    borderColor: isSelected ? Colors.primary500 : Colors.neutral700,
                    borderRadius: 12,
                    borderWidth: 2,
                  },
                ]}
              >
                <Text
                  style={[
                    Fonts.p1Bold,
                    { color: isSelected ? Colors.primary500 : Colors.neutral00, flex: 1 },
                  ]}
                >
                  {position.label}
                </Text>
                {isSelected ? (
                  <Text
                    importantForAccessibility="no"
                    style={[Fonts.p1Bold, Fonts.primary500]}
                  >
                    ✓
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <OnboardingStickyFooter>
        <Button
          disabled={selectedPositions.length === 0}
          isLoading={updateUserMutation.isPending}
          onPress={handleNext}
          title={selectedPositions.length > 1
            ? t('common.actions.nextCount', `Continuer (${selectedPositions.length} postes)`)
            : t('common.actions.next', 'Continuer')}
          variant="Primary"
        />
        <OnboardingSkipLink onPress={handleSkip} />
      </OnboardingStickyFooter>
    </FormScreenContainer>
  );
}

export default UserPosition;
