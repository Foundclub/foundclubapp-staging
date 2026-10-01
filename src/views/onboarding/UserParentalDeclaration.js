import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Platform, Text, View,
} from 'react-native';
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
 * L'ecran de la case, vu par les 8 parcours d'un 13-14 ans (tunnel d'inscription, refus du
 * serveur, carte de collection).
 *
 * CONSENTEMENT-PHRASE (2026-10-01, decision d'Adel « 3-A corrige ») — c'est L'ADO qui coche :
 * il declare qu'un parent est d'accord, il ne declare plus ETRE le parent. Le lien parent est
 * propose comme autre voie ; il n'existe que dans l'application mobile (`webRouteExemptions.js`,
 * MyParentLink et ParentLinkInvite), et l'ecran le dit sur le site.
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
      Alert.alert(t(
        'userParentalDeclaration.alerts.saveError.title',
        'Erreur',
      ), error?.message || t(
        'userParentalDeclaration.alerts.saveError.message',
        'Impossible d’enregistrer ta réponse.',
      ));
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
        description={t(
          'userParentalDeclaration.loading.description',
          'Nous récupérons ton profil.',
        )}
        isLoading
        title={t('userParentalDeclaration.loading.title', 'Chargement du profil')}
      />
    );
  }

  if (userDataError) {
    return (
      <OnboardingStateView
        actionLabel={t('userParentalDeclaration.loadError.retry', 'Reessayer')}
        description={userDataError?.message || t(
          'userParentalDeclaration.loadError.message',
          'Impossible de charger le profil.',
        )}
        onAction={refetchUserData}
        title={t('userParentalDeclaration.loadError.title', 'Chargement impossible')}
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
            {t('userParentalDeclaration.title', 'L’accord de tes parents')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t(
              'userParentalDeclaration.intro',
              'Tu as moins de 15 ans : pour continuer, un de tes parents (ou ton représentant '
                + 'légal) doit être d’accord. Si c’est le cas, coche la case.',
            )}
          </Text>
        </View>

        <ParentalDeclarationCard
          checked={accepted}
          description={t(
            'userParentalDeclaration.card.description',
            'Coche seulement si c’est vrai : ta réponse est enregistrée.',
          )}
          onChange={setAccepted}
          // Le titre de l'ecran dit deja « L'accord de tes parents » : la carte ne le repete pas.
          title={t('userParentalDeclaration.card.title', 'Ta déclaration')}
        />

        <Text style={[Fonts.p2, Fonts.neutral200]}>
          {Platform.OS === 'web'
            ? t(
              'userParentalDeclaration.parentLink.web',
              'Ton parent peut aussi donner son accord depuis son propre compte, dans '
                + 'l’application mobile FoundClub : ce n’est pas encore possible sur le site.',
            )
            : t(
              'userParentalDeclaration.parentLink.app',
              'Ton parent peut aussi donner son accord depuis son propre compte FoundClub : '
                + 'Profil → Mes enfants. Tu recevras sa demande, et c’est toi qui l’accepteras.',
            )}
        </Text>
      </View>

      <View style={[Spaces.gap[16]]}>
        <Button
          disabled={!accepted || updateUserMutation.isPending}
          isLoading={updateUserMutation.isPending}
          onPress={handleContinue}
          title={t('userParentalDeclaration.actions.continue', 'Continuer')}
          variant="Primary"
        />
      </View>
    </FormScreenContainer>
  );
}

export default UserParentalDeclaration;
