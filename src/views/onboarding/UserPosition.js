import { useMutation } from '@tanstack/react-query';
import { useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetMe } from '@/services/auth/authQueries';
import { updateMe } from '@/services/auth/authService';

// Positions by sport (without Polyvalent)
const POSITIONS_BY_SPORT = {
  football: [
    { label: 'Gardien', value: 'Gardien' },
    { label: 'Défenseur central', value: 'Défenseur central' },
    { label: 'Latéral droit', value: 'Latéral droit' },
    { label: 'Latéral gauche', value: 'Latéral gauche' },
    { label: 'Milieu défensif', value: 'Milieu défensif' },
    { label: 'Milieu central', value: 'Milieu central' },
    { label: 'Milieu offensif', value: 'Milieu offensif' },
    { label: 'Ailier droit', value: 'Ailier droit' },
    { label: 'Ailier gauche', value: 'Ailier gauche' },
    { label: 'Attaquant', value: 'Attaquant' },
    { label: 'Avant-centre', value: 'Avant-centre' },
  ],
  basketball: [
    { label: 'Meneur', value: 'Meneur' },
    { label: 'Arrière', value: 'Arrière' },
    { label: 'Ailier', value: 'Ailier' },
    { label: 'Ailier fort', value: 'Ailier fort' },
    { label: 'Pivot', value: 'Pivot' },
  ],
  handball: [
    { label: 'Gardien', value: 'Gardien' },
    { label: 'Arrière gauche', value: 'Arrière gauche' },
    { label: 'Arrière droit', value: 'Arrière droit' },
    { label: 'Demi-centre', value: 'Demi-centre' },
    { label: 'Ailier gauche', value: 'Ailier gauche' },
    { label: 'Ailier droit', value: 'Ailier droit' },
    { label: 'Pivot', value: 'Pivot' },
  ],
  volleyball: [
    { label: 'Pointu (Opposite)', value: 'Pointu' },
    { label: 'Réceptionneur-attaquant', value: 'Réceptionneur-attaquant' },
    { label: 'Central', value: 'Central' },
    { label: 'Passeur (Setter)', value: 'Passeur' },
    { label: 'Libéro', value: 'Libéro' },
  ],
  rugby: [
    { label: 'Pilier', value: 'Pilier' },
    { label: 'Talonneur', value: 'Talonneur' },
    { label: 'Deuxième ligne', value: 'Deuxième ligne' },
    { label: 'Troisième ligne aile', value: 'Troisième ligne aile' },
    { label: 'Troisième ligne centre', value: 'Troisième ligne centre' },
    { label: 'Demi de mêlée', value: 'Demi de mêlée' },
    { label: 'Demi d\'ouverture', value: 'Demi d\'ouverture' },
    { label: 'Centre', value: 'Centre' },
    { label: 'Ailier', value: 'Ailier' },
    { label: 'Arrière', value: 'Arrière' },
  ],
};

// Sports that have positions
const SPORTS_WITH_POSITIONS = Object.keys(POSITIONS_BY_SPORT);

/**
 * User position selection screen
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 */
function UserPosition({ navigation, route }) {
  const [selectedPositions, setSelectedPositions] = useState(/** @type {string[]} */ ([]));

  const { getNextOnboardingRoute } = useAuth();
  const { Alignments, Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const { data: userData } = useGetMe();
  const insets = useSafeAreaInsets();

  // Get sport from route params (passed from UserSport) or fall back to userData
  const userSport = route?.params?.selectedSport || userData?.preferredSport;

  // Get positions based on user's preferred sport
  const positions = useMemo(() => {
    const sport = userSport?.toLowerCase();
    if (sport && POSITIONS_BY_SPORT[sport]) {
      return POSITIONS_BY_SPORT[sport];
    }
    // Default to football if sport not found
    return POSITIONS_BY_SPORT.football;
  }, [userSport]);

  // Check if we should skip this step
  useEffect(() => {
    const sport = userSport?.toLowerCase();
    if (sport && !SPORTS_WITH_POSITIONS.includes(sport)) {
      // Sport doesn't have positions, skip this step
      navigation.navigate(getNextOnboardingRoute(RouteNames.UserPosition) || RouteNames.Welcome);
    }
  }, [userSport, navigation, getNextOnboardingRoute]);

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onSuccess: () => {
      navigation.navigate(getNextOnboardingRoute(RouteNames.UserPosition) || RouteNames.Welcome);
    },
  });

  // Toggle position selection
  const togglePosition = (positionValue) => {
    setSelectedPositions(prev => {
      if (prev.includes(positionValue)) {
        return prev.filter(p => p !== positionValue);
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
    navigation.navigate(getNextOnboardingRoute(RouteNames.UserPosition) || RouteNames.Welcome);
  };

  // Get sport name for display
  const sportName = useMemo(() => {
    const sport = userSport?.toLowerCase();
    const sportNames = {
      football: 'Football',
      basketball: 'Basketball',
      handball: 'Handball',
      volleyball: 'Volleyball',
      rugby: 'Rugby',
    };
    return sportNames[sport] || sport;
  }, [userSport]);

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
      <View style={[Alignments.fill, Spaces.gap[24]]}>
        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('onboarding.position.title', 'Quel(s) poste(s) ?')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {sportName 
              ? `Postes en ${sportName} (plusieurs choix possibles)`
              : t('onboarding.position.subtitle', 'Sélectionne tes postes de prédilection')
            }
          </Text>
        </View>

        <ScrollView 
          style={[Alignments.fill]} 
          contentContainerStyle={[Spaces.gap[12]]}
          showsVerticalScrollIndicator={false}
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
                    borderRadius: 12,
                    borderWidth: 2,
                    borderColor: isSelected ? Colors.primary500 : Colors.neutral700,
                    backgroundColor: isSelected ? Colors.primary500 + '20' : Colors.neutral800,
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

      <View style={[Spaces.gap[16], { paddingTop: 16 }]}>
        <Button
          disabled={selectedPositions.length === 0}
          isLoading={updateUserMutation.isPending}
          onPress={handleNext}
          title={selectedPositions.length > 1 
            ? t('common.actions.nextCount', `Suivant (${selectedPositions.length} postes)`)
            : t('common.actions.next', 'Suivant')
          }
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

export default UserPosition;
