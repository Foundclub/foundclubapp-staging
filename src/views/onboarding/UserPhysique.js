import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import FormScreenContainer from '@/components/templates/FormScreenContainer';
import OnboardingSkipLink from '@/views/onboarding/components/OnboardingSkipLink';
import OnboardingStateView from '@/views/onboarding/components/OnboardingStateView';

import { RouteNames } from '@/navigation/routeNames';

import { updateMe } from '@/services/auth/authService';

/**
 * User physique (height/weight) screen
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 */
function UserPhysique({ navigation }) {
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

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

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onError: (error) => {
      Alert.alert('Erreur', error?.message || 'Impossible de mettre à jour ton profil.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['get-me'] });
      navigation.navigate(getNextOnboardingRoute(RouteNames.UserPhysique) || getPostOnboardingHomeRoute());
    },
  });

  useEffect(() => {
    if (userData?.height) {
      setHeight(String(userData.height));
    }
    if (userData?.weight) {
      setWeight(String(userData.weight));
    }
  }, [userData?.height, userData?.weight]);

  if (userDataLoading) {
    return (
      <OnboardingStateView
        description="Nous récupérons ton profil avant de renseigner ton physique."
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
    <FormScreenContainer
      bgImage="bg2"
      // D31 ⑤ — l'écran pose LUI-MÊME le retrait bas (`marginBottom` ci-dessous).
      // Sans ce mode, le conteneur en ajoutait un SECOND : `insets.bottom` était
      // compté deux fois, soit ~34 pt de vide sous « Passer cette étape ».
      bottomInsetMode="edge-to-edge"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        { marginBottom: insets.bottom },
        Alignments.fill,
      ]}
    >
      {/*
        D23 — l'evitement de clavier vit dans `FormScreenContainer`
        (`keyboardAvoiding` y est vrai par defaut). Le KeyboardAvoidingView qui
        etait ici en ajoutait un SECOND, avec un decalage de 100 ecrit en dur :
        les deux se compensaient l'un l'autre et le bouton « Continuer » passait
        sous le clavier. Un seul evitement, et il se calcule.
      */}
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
              {t('onboarding.physique.subtitle', 'Facultatif — ces infos aident les recruteurs.')}
            </Text>
          </View>

          <View style={[Spaces.gap[24]]}>
            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00, styles.fieldLabel]}>
                {t('onboarding.physique.heightLabel', 'Taille (cm)')}
              </Text>
              <TextInput
                keyboardType="numeric"
                maxLength={3}
                onChangeText={setHeight}
                placeholder="Ex : 180"
                placeholderTextColor={Colors.neutral500}
                returnKeyType="next"
                style={[
                  Fonts.p1,
                  Spaces.padding[16],
                  {
                    backgroundColor: Colors.neutral800,
                    borderColor: Colors.neutral700,
                    borderRadius: 12,
                    borderWidth: 1,
                    color: Colors.neutral00,
                  },
                ]}
                value={height}
              />
            </View>

            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00, styles.fieldLabel]}>
                {t('onboarding.physique.weightLabel', 'Poids (kg)')}
              </Text>
              <TextInput
                keyboardType="numeric"
                maxLength={3}
                onChangeText={setWeight}
                placeholder="Ex : 75"
                placeholderTextColor={Colors.neutral500}
                returnKeyType="done"
                style={[
                  Fonts.p1,
                  Spaces.padding[16],
                  {
                    backgroundColor: Colors.neutral800,
                    borderColor: Colors.neutral700,
                    borderRadius: 12,
                    borderWidth: 1,
                    color: Colors.neutral00,
                  },
                ]}
                value={weight}
              />
            </View>

            {/*
              D56 — taille et poids sont des donnees sensibles, et le pack
              exige de les CONTEXTUALISER a l'endroit ou on les demande :
              « la donnee sensible est contextualisee ». Sans cette ligne,
              l'ecran demandait un physique sans jamais dire qui le verrait.
              La reponse depend de l'etape Visibilite, juste apres.
            */}
            <View style={[Alignments.row, Spaces.gap[8]]}>
              <Text
                importantForAccessibility="no"
                style={[Fonts.p2, { color: Colors.neutral600 }]}
              >
                i
              </Text>
              <Text style={[Fonts.p2, { color: Colors.neutral600, flex: 1 }]}>
                {t(
                  'onboarding.physique.privacyNotice',
                  'Visible uniquement si ton profil est public.',
                )}
              </Text>
            </View>
          </View>
        </View>

        <View style={[Spaces.gap[16], Spaces.marginTop[24]]}>
          <Button
            disabled={!isValid}
            isLoading={updateUserMutation.isPending}
            onPress={handleNext}
            title={t('common.actions.next', 'Continuer')}
            variant="Primary"
          />
          <OnboardingSkipLink onPress={handleSkip} />
        </View>
      </ScrollView>
    </FormScreenContainer>
  );
}

const styles = StyleSheet.create({
  // Le pack met les libelles de champ en capitales. `textTransform` plutot
  // qu'une chaine en majuscules : les lecteurs d'ecran epellent parfois un mot
  // ecrit tout en capitales, alors qu'ils lisent bien celui-ci.
  fieldLabel: {
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});

export default UserPhysique;
