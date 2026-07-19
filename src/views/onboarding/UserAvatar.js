import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { markOnboardingComplete } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import OnboardingOptionalHint from '@/components/molecules/onboardingOptionalHint/OnboardingOptionalHint';
import SelectAvatar from '@/components/molecules/selectAvatar/SelectAvatar';
import FormScreenContainer from '@/components/templates/FormScreenContainer';
import OnboardingStateView from '@/views/onboarding/components/OnboardingStateView';

import { RouteNames } from '@/navigation/routeNames';

import { updateMe } from '@/services/auth/authService';

/**
 * User avatar selection screen component
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} User avatar screen component
 */
function UserAvatar({ navigation }) {
  // local state
  const [avatar, setAvatar] = useState(
    /** @type {Avatar | undefined} */
    (undefined),
  );

  // hooks
  const {
    getNextOnboardingRoute,
    getPostOnboardingHomeRoute,
    refetchUserData,
    userData,
    userDataError,
    userDataLoading,
  } = useAuth();

  const {
    Alignments, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onError: (error) => {
      const rawMessage = typeof error?.message === 'string' ? error.message : '';
      const isNetworkFailure = rawMessage.toLowerCase().includes('network request failed');
      const message = isNetworkFailure
        ? 'Connexion impossible au serveur pour le moment. Réessaie dans quelques secondes.'
        : (rawMessage || 'Impossible de mettre à jour ton profil.');
      Alert.alert('Erreur', message);
    },
    onSuccess: () => {
      const nextRoute = getNextOnboardingRoute(RouteNames.UserAvatar);
      if (!nextRoute) {
        markOnboardingComplete(userData?.documentId);
        navigation.navigate(getPostOnboardingHomeRoute());
      } else {
        navigation.navigate(nextRoute);
      }
    },
  });

  useEffect(() => {
    if (!userData?.avatar?.url) return;
    setAvatar((currentValue) => currentValue || userData.avatar);
  }, [userData?.avatar]);

  if (userDataLoading) {
    return (
      <OnboardingStateView
        description="Nous récupérons ton profil avant de choisir ton avatar."
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
    if (updateUserMutation.isPending) return;

    if (avatar && userData) {
      updateUserMutation.mutate({ avatar });
    }
  };

  const handleSkip = () => {
    const nextRoute = getNextOnboardingRoute(RouteNames.UserAvatar);
    if (!nextRoute) {
      markOnboardingComplete(userData?.documentId);
      navigation.navigate(getPostOnboardingHomeRoute());
    } else {
      navigation.navigate(nextRoute);
    }
  };

  const hasSelectedAvatar = Boolean(avatar?.path || avatar?.uri);

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
      <View style={[Spaces.gap[40]]}>
        <View style={[Spaces.gap[16]]}>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('profile.titles.avatar')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t('profile.subtitles.avatar')}
          </Text>
        </View>

        <View style={[Alignments.row, Alignments.justifyCenter, Spaces.marginVertical[24]]}>
          <SelectAvatar
            currentAvatar={avatar}
            onAvatarSelected={setAvatar}
            size={95}
          />
        </View>
      </View>

      <View style={[Spaces.gap[16]]}>
        <OnboardingOptionalHint />
        <Button
          disabled={!hasSelectedAvatar || updateUserMutation.isPending}
          isLoading={updateUserMutation.isPending}
          onPress={handleNext}
          title={t('profile.actions.save')}
          variant="Primary"
        />
        <Button
          accessibilityLabel={t('common.actions.continueLater', 'Continuer plus tard')}
          onPress={handleSkip}
          title={t('common.actions.continueLater', 'Continuer plus tard')}
          variant="Secondary"
        />
      </View>
    </FormScreenContainer>
  );
}

export default UserAvatar;
