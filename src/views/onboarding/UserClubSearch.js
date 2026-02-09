import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { markOnboardingComplete } from '@/domains/auth/authUseCases';

/**
 * User club search status screen
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 */
function UserClubSearch({ navigation }) {
  const [isLooking, setIsLooking] = useState(/** @type {boolean | null} */ (null));

  const { getNextOnboardingRoute } = useAuth();
  const { Alignments, Colors, Fonts, Spaces } = useTheme();
  const { t } = useTranslation();
  const { data: userData } = useGetMe();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
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
            {t('onboarding.clubSearch.title', 'Visibilité de ton profil')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t('onboarding.clubSearch.subtitle', 'Souhaites-tu que les clubs et entraîneurs puissent voir ton profil ?')}
          </Text>
        </View>

        <View style={[Spaces.gap[16]]}>
          <TouchableOpacity
            onPress={() => setIsLooking(true)}
            style={[
              Spaces.padding[24],
              Alignments.alignCenter,
              {
                borderRadius: 16,
                borderWidth: 2,
                borderColor: isLooking === true ? Colors.primary500 : Colors.neutral700,
                backgroundColor: isLooking === true ? Colors.primary500 + '20' : Colors.neutral800,
              },
            ]}
          >
            <Text style={[Fonts.h3Bold, { color: isLooking === true ? Colors.primary500 : Colors.neutral00 }]}>
              👁️ Oui, rendre mon profil visible
            </Text>
            <Text style={[Fonts.p2, { color: Colors.neutral300, marginTop: 8, textAlign: 'center' }]}>
              Les clubs et entraîneurs pourront me contacter
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setIsLooking(false)}
            style={[
              Spaces.padding[24],
              Alignments.alignCenter,
              {
                borderRadius: 16,
                borderWidth: 2,
                borderColor: isLooking === false ? Colors.primary500 : Colors.neutral700,
                backgroundColor: isLooking === false ? Colors.primary500 + '20' : Colors.neutral800,
              },
            ]}
          >
            <Text style={[Fonts.h3Bold, { color: isLooking === false ? Colors.primary500 : Colors.neutral00 }]}>
              🔒 Non, garder mon profil privé
            </Text>
            <Text style={[Fonts.p2, { color: Colors.neutral300, marginTop: 8, textAlign: 'center' }]}>
              Mon profil ne sera pas visible dans le mercato
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[Spaces.gap[16]]}>
        <Button
          disabled={isLooking === null}
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

export default UserClubSearch;
