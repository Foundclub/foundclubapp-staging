import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ParentalDeclarationCard from '@/components/molecules/parentalDeclarationCard/ParentalDeclarationCard';
import FormScreenContainer from '@/components/templates/FormScreenContainer';
import OnboardingStateView from '@/views/onboarding/components/OnboardingStateView';

import { RouteNames } from '@/navigation/routeNames';

import { useGetMe } from '@/services/auth/authQueries';
import { updateMe } from '@/services/auth/authService';

import { buildMinorParentalDeclarationPayload } from '@/constants/parentalDeclaration';

/**
 *
 * @param root0
 * @param root0.navigation
 */
function UserParentalDeclaration({ navigation }) {
  const {
    Alignments, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [accepted, setAccepted] = useState(false);
  const {
    data: userData,
    error: userDataError,
    isLoading: userDataLoading,
    refetch: refetchUserData,
  } = useGetMe();

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onError: (error) => {
      Alert.alert('Erreur', error?.message || 'Impossible d enregistrer la declaration parentale.');
    },
    onSuccess: () => {
      navigation.navigate(RouteNames.UserAddress);
    },
  });

  if (userDataLoading) {
    return (
      <OnboardingStateView
        description="Nous recuperons le profil avant la declaration parentale."
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
            {t('profile.titles.birthdate', 'Declaration parentale obligatoire')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            Ce profil concerne un enfant de moins de 13 ans. Pour continuer, vous devez confirmer que vous etes son parent ou representant legal.
          </Text>
        </View>

        <ParentalDeclarationCard
          checked={accepted}
          description="La personne qui utilise FoundClub pour ce profil doit etre le parent ou le representant legal de l enfant."
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
