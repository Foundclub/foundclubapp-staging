import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { markOnboardingComplete } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import FormScreenContainer from '@/components/templates/FormScreenContainer';
import OnboardingSkipLink from '@/views/onboarding/components/OnboardingSkipLink';
import OnboardingStateView from '@/views/onboarding/components/OnboardingStateView';

import { RouteNames } from '@/navigation/routeNames';

import { updateMe } from '@/services/auth/authService';

// D56 — les deux pilules du pack, dans l'ordre de la maquette. La copy vit
// dans `fr.js` ; le repli garde l'ecran lisible si la cle disparait.
const VISIBILITY_OPTIONS = [
  {
    helpFallback: 'Les clubs et entraîneurs peuvent te trouver et te contacter pour te recruter.',
    helpKey: 'onboarding.clubSearch.visibleHelp',
    labelFallback: 'Profil visible',
    labelKey: 'onboarding.clubSearch.visibleLabel',
    value: true,
  },
  {
    helpFallback: 'Ton profil n\'apparaît dans aucune recherche — seuls tes coéquipiers te voient.',
    helpKey: 'onboarding.clubSearch.privateHelp',
    labelFallback: 'Profil privé',
    labelKey: 'onboarding.clubSearch.privateLabel',
    value: false,
  },
];

/**
 * User club search status screen
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 */
function UserClubSearch({ navigation }) {
  const [isLooking, setIsLooking] = useState(/** @type {boolean | null} */ (null));

  const {
    getNextOnboardingRoute,
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
    onSuccess: async () => {
      const nextRoute = getNextOnboardingRoute(RouteNames.UserClubSearch);
      if (!nextRoute) {
        markOnboardingComplete(userData?.documentId);
        // Invalidate get-me to trigger PrivateNavigator re-evaluation
        // This will update onboardingViews -> canShowHome -> render HomeTab
        // And unmount this screen (UserClubSearch) as it's removed from valid views
        await queryClient.invalidateQueries({ queryKey: ['get-me'] });
      } else {
        navigation.navigate(nextRoute);
      }
    },
  });

  useEffect(() => {
    if (typeof userData?.isLookingForClub === 'boolean') {
      setIsLooking(userData.isLookingForClub);
    }
  }, [userData?.isLookingForClub]);

  if (userDataLoading) {
    return (
      <OnboardingStateView
        description="Nous récupérons ton profil avant de régler la visibilité."
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

  const selectedOption = VISIBILITY_OPTIONS.find((option) => option.value === isLooking);

  const handleNext = () => {
    if (isLooking !== null && userData) {
      updateUserMutation.mutate({ isLookingForClub: isLooking });
    }
  };

  const handleSkip = async () => {
    const nextRoute = getNextOnboardingRoute(RouteNames.UserClubSearch);
    if (!nextRoute) {
      markOnboardingComplete(userData?.documentId);
      await queryClient.invalidateQueries({ queryKey: ['get-me'] });
    } else {
      navigation.navigate(nextRoute);
    }
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
      contentWidth="readable"
    >
      <View style={[Spaces.gap[40]]}>
        <View style={[Spaces.gap[16]]}>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('onboarding.clubSearch.title', 'Visibilité de ton profil')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t(
              'onboarding.clubSearch.subtitle',
              'Les clubs et entraîneurs peuvent-ils te trouver ?',
            )}
          </Text>
        </View>

        <View style={[Spaces.gap[16]]}>
          {/*
            D56 — le pack remplace les deux gros pavés pictogrammes par DEUX
            PILULES et une explication qui suit le choix. Les pictogrammes et
            le jargon de transfert sont retires : le registre valide dit ce que
            le reglage fait, il ne le decore pas.
          */}
          <View
            style={[
              Alignments.row,
              Spaces.padding[4],
              Spaces.gap[4],
              {
                backgroundColor: Colors.neutral800,
                borderColor: Colors.neutral700,
                borderRadius: 999,
                borderWidth: 1,
              },
            ]}
          >
            {VISIBILITY_OPTIONS.map((option) => {
              const isChecked = isLooking === option.value;

              return (
                <TouchableOpacity
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isChecked }}
                  key={option.labelKey}
                  onPress={() => setIsLooking(option.value)}
                  style={[
                    Alignments.alignCenter,
                    Spaces.paddingHorizontal[16],
                    {
                      backgroundColor: isChecked ? Colors.primary500 : 'transparent',
                      borderRadius: 999,
                      flex: 1,
                      justifyContent: 'center',
                      minHeight: 44,
                    },
                  ]}
                >
                  <Text
                    style={[
                      Fonts.p1Bold,
                      { color: isChecked ? Colors.neutral900 : Colors.neutral00 },
                    ]}
                  >
                    {t(option.labelKey, option.labelFallback)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Explication dynamique : elle change avec la pilule choisie. */}
          {selectedOption ? (
            <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
              {t(selectedOption.helpKey, selectedOption.helpFallback)}
            </Text>
          ) : null}

          <View style={[Alignments.row, Spaces.gap[8]]}>
            <Text
              importantForAccessibility="no"
              style={[Fonts.p2, { color: Colors.neutral600 }]}
            >
              i
            </Text>
            <Text style={[Fonts.p2, { color: Colors.neutral600, flex: 1 }]}>
              {t(
                'onboarding.clubSearch.editableLater',
                'Modifiable à tout moment depuis Mon profil.',
              )}
            </Text>
          </View>
        </View>
      </View>

      <View style={[Spaces.gap[16]]}>
        <Button
          disabled={isLooking === null}
          isLoading={updateUserMutation.isPending}
          onPress={handleNext}
          title={t('common.actions.next', 'Continuer')}
          variant="Primary"
        />
        <OnboardingSkipLink onPress={handleSkip} />
      </View>
    </FormScreenContainer>
  );
}

export default UserClubSearch;
