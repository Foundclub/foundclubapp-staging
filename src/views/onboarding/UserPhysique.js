import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Alert,
  KeyboardAvoidingView, 
  Platform, 
  ScrollView,
  Text, 
  TextInput, 
  View 
} from 'react-native';
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

  const { getNextOnboardingRoute, getPostOnboardingHomeRoute } = useAuth();
  const { Alignments, Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const { data: userData } = useGetMe();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onError: (error) => {
      Alert.alert('Erreur', error?.message || 'Impossible de mettre a jour votre profil.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['get-me'] });
      navigation.navigate(getNextOnboardingRoute(RouteNames.UserPhysique) || getPostOnboardingHomeRoute());
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
    navigation.navigate(getNextOnboardingRoute(RouteNames.UserPhysique) || getPostOnboardingHomeRoute());
  };

  const isValid = height || weight;

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        { marginBottom: insets.bottom },
        Alignments.fill,
      ]}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[Alignments.fill]}
        keyboardVerticalOffset={100}
      >
        <ScrollView 
          contentContainerStyle={[
            Alignments.justifySpaceBetween,
            { flexGrow: 1 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
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
                  returnKeyType="next"
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
                  returnKeyType="done"
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

          <View style={[Spaces.gap[16], Spaces.marginTop[24]]}>
            <Button
              disabled={!isValid}
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
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

export default UserPhysique;

