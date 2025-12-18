import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetMe } from '@/services/auth/authQueries';
import { updateMe } from '@/services/auth/authService';

/**
 * User physique (height/weight) screen
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 */
function UserPhysique({ navigation }) {
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  const { getNextOnboardingRoute } = useAuth();
  const { Alignments, Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const { data: userData } = useGetMe();
  const insets = useSafeAreaInsets();

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onSuccess: () => {
      navigation.navigate(getNextOnboardingRoute(RouteNames.UserPhysique) || RouteNames.Welcome);
    },
  });

  const handleNext = () => {
    if ((height || weight) && userData) {
      const data = {};
      if (height) data.height = height;
      if (weight) data.weight = weight;
      updateUserMutation.mutate(data);
    }
  };

  const handleSkip = () => {
    navigation.navigate(getNextOnboardingRoute(RouteNames.UserPhysique) || RouteNames.Welcome);
  };

  const isValid = height || weight;

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
            {t('onboarding.physique.title', 'Ton physique')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t('onboarding.physique.subtitle', 'Ces informations aident les recruteurs')}
          </Text>
        </View>

        <View style={[Spaces.gap[24]]}>
          <View style={[Spaces.gap[8]]}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Taille (cm)</Text>
            <TextInput
              value={height}
              onChangeText={setHeight}
              placeholder="Ex: 180"
              placeholderTextColor={Colors.neutral500}
              keyboardType="numeric"
              maxLength={3}
              style={[
                Fonts.p1, 
                Spaces.padding[16], 
                { 
                  backgroundColor: Colors.neutral800, 
                  borderRadius: 12, 
                  borderWidth: 1, 
                  borderColor: Colors.neutral700,
                  color: Colors.neutral00,
                }
              ]}
            />
          </View>

          <View style={[Spaces.gap[8]]}>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Poids (kg)</Text>
            <TextInput
              value={weight}
              onChangeText={setWeight}
              placeholder="Ex: 75"
              placeholderTextColor={Colors.neutral500}
              keyboardType="numeric"
              maxLength={3}
              style={[
                Fonts.p1, 
                Spaces.padding[16], 
                { 
                  backgroundColor: Colors.neutral800, 
                  borderRadius: 12, 
                  borderWidth: 1, 
                  borderColor: Colors.neutral700,
                  color: Colors.neutral00,
                }
              ]}
            />
          </View>
        </View>
      </View>

      <View style={[Spaces.gap[16]]}>
        <Button
          disabled={!isValid}
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

export default UserPhysique;
