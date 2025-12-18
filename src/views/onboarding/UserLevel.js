import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetMe } from '@/services/auth/authQueries';
import { updateMe } from '@/services/auth/authService';

const LEVELS = [
  { label: 'Départemental', value: 'Departemental' },
  { label: 'Pré-Régional', value: 'PreRegional' },
  { label: 'Régional', value: 'Regional' },
  { label: 'Pré-National', value: 'PreNational' },
  { label: 'National', value: 'National' },
];

/**
 * User best level selection screen
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 */
function UserLevel({ navigation }) {
  const [selectedLevel, setSelectedLevel] = useState(/** @type {string | null} */ (null));

  const { getNextOnboardingRoute } = useAuth();
  const { Alignments, Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const { data: userData } = useGetMe();
  const insets = useSafeAreaInsets();

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onSuccess: () => {
      navigation.navigate(getNextOnboardingRoute(RouteNames.UserLevel) || RouteNames.Welcome);
    },
  });

  const handleNext = () => {
    if (selectedLevel && userData) {
      updateUserMutation.mutate({ bestLevel: selectedLevel });
    }
  };

  const handleSkip = () => {
    navigation.navigate(getNextOnboardingRoute(RouteNames.UserLevel) || RouteNames.Welcome);
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
      <View style={[Spaces.gap[40]]}>
        <View style={[Spaces.gap[16]]}>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('onboarding.level.title', 'Ton meilleur niveau ?')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t('onboarding.level.subtitle', 'Quel est le plus haut niveau auquel tu as joué ?')}
          </Text>
        </View>

        <View style={[Spaces.gap[12]]}>
          {LEVELS.map((level) => (
            <TouchableOpacity
              key={level.value}
              onPress={() => setSelectedLevel(level.value)}
              style={[
                Spaces.padding[16],
                {
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: selectedLevel === level.value ? Colors.primary500 : Colors.neutral700,
                  backgroundColor: selectedLevel === level.value ? Colors.primary500 + '20' : Colors.neutral800,
                },
              ]}
            >
              <Text style={[Fonts.p1Bold, { color: selectedLevel === level.value ? Colors.primary500 : Colors.neutral00 }]}>
                {level.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[Spaces.gap[16]]}>
        <Button
          disabled={!selectedLevel}
          isLoading={updateUserMutation.isPending}
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

export default UserLevel;
