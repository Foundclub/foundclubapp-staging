import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ParentalDeclarationCard from '@/components/molecules/parentalDeclarationCard/ParentalDeclarationCard';
import FormScreenContainer from '@/components/templates/FormScreenContainer';
import OnboardingStateView from '@/views/onboarding/components/OnboardingStateView';

import { RouteNames } from '@/navigation/routeNames';

import { updateMe } from '@/services/auth/authService';

import { buildMinorParentalDeclarationPayload } from '@/constants/parentalDeclaration';

/**
 *
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function UserParentalDeclaration({ navigation, route }) {
  const {
    Alignments, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [accepted, setAccepted] = useState(false);
  const queryClient = useQueryClient();
  const [, appDispatch] = useAppContext();
  const {
    refetchUserData,
    userData,
    userDataError,
    userDataLoading,
  } = useAuth();

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onError: (error) => {
      Alert.alert('Erreur', error?.message || 'Impossible d enregistrer la déclaration parentale.');
    },
    onSuccess: (updatedUser) => {
      queryClient.setQueriesData({ queryKey: ['get-me'] }, updatedUser);
      queryClient.invalidateQueries({ queryKey: ['get-me'] });
      if (updatedUser?.documentId) {
        appDispatch({
          payload: updatedUser,
          type: 'UPDATE_USER_DATA',
        });
      }
      // Hors onboarding (ex. carte de collection : returnRoute fourni), on
      // revient a l'ecran appelant au lieu de poursuivre le flux onboarding.
      if (route?.params?.returnRoute) {
        navigation.goBack();
      } else {
        navigation.navigate(RouteNames.UserAddress);
      }
    },
  });

  if (userDataLoading) {
    return (
      <OnboardingStateView
        description="Nous recuperons le profil avant la déclaration parentale."
        isLoading
        title="Chargement du profil"
      />
    );
  }

  if (userDataError) {
    return (
      <OnboardingStateView
        actionLabel="Reessayer"
        description={userDataError?.message || 'Impossible de charger le profil.'}
        onAction={refetchUserData}
        title="Chargement impossible"
      />
    );
  }

  const handleContinue = () => {
    if (!accepted || updateUserMutation.isPending) {
      return;
    }

    updateUserMutation.mutate({
      legalAcceptance: buildMinorParentalDeclarationPayload({
        metadata: {
          birthdate: userData?.birthdate || null,
          childUserDocumentId: userData?.documentId || null,
        },
        sourceScreen: 'onboarding_parental_declaration',
        targetDocumentId: userData?.documentId || null,
      }),
      parentalDeclarationAccepted: true,
    });
  };

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
      <View style={[Spaces.gap[32]]}>
        <View style={[Spaces.gap[16]]}>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('profile.titles.birthdate', 'Déclaration parentale obligatoire')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            Ce profil concerne un enfant de moins de 15 ans. Pour continuer, tu dois confirmer que tu es son parent ou représentant légal.
          </Text>
        </View>

        <ParentalDeclarationCard
          checked={accepted}
          description="La personne qui utilise FoundClub pour ce profil doit être le parent ou le représentant legal de l enfant."
          onChange={setAccepted}
        />
      </View>

      <View style={[Spaces.gap[16]]}>
        <Button
          disabled={!accepted || updateUserMutation.isPending}
          isLoading={updateUserMutation.isPending}
          onPress={handleContinue}
          title="Continuer"
          variant="Primary"
        />
      </View>
    </FormScreenContainer>
  );
}

export default UserParentalDeclaration;
