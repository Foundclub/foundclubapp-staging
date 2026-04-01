import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, RefreshControl, Text, View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getRoleDocumentIdByKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import TabButton from '@/components/atoms/tabButton/TabButton';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import FormScreenContainer from '@/components/templates/FormScreenContainer';
import OnboardingStateView from '@/views/onboarding/components/OnboardingStateView';

import { RouteNames } from '@/navigation/routeNames';

import { useGetMe, useGetRoles } from '@/services/auth/authQueries';
import { updateMe } from '@/services/auth/authService';

/**
 * User type selection screen component. Let users to select their role
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} User type screen component
 */
function UserRole({ navigation }) {
  const {
    data: userData,
    error: userDataError,
    isLoading: userDataLoading,
    refetch: refetchUserData,
  } = useGetMe();
  const { getNextOnboardingRoute, USER_ROLES } = useAuth();
  const insets = useSafeAreaInsets();
  // local state
  const [role, setRole] = useState(
    /** @type {string} */(userData?.role?.documentId || ''),
  );
  // hooks
  const {
    Alignments, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const {
    data: roles,
    error: rolesError,
    isLoading: rolesLoading,
    refetch: refetchRoles,
  } = useGetRoles();

  useEffect(() => {
    if (userData?.role?.documentId) {
      setRole(userData.role.documentId);
    }
  }, [userData?.role?.documentId]);

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onError: (error) => {
      Alert.alert('Erreur', error?.message || 'Impossible de mettre à jour votre profil.');
    },
    onSuccess: () => {
      navigation.navigate(getNextOnboardingRoute(RouteNames.UserRole) || RouteNames.UserName);
    },
  });

  const handleNext = () => {
    updateUserMutation.mutate({ role });
  };

  /**
   * Handle the selection of the user type
   * @param {string} selectedRole
   */
  const handleSelection = (selectedRole) => {
    const newRole = getRoleDocumentIdByKey(roles, selectedRole);
    setRole((currentRole) => (newRole === currentRole ? '' : newRole));
  };

  const playerRoleId = getRoleDocumentIdByKey(roles, USER_ROLES.player);
  const coachRoleId = getRoleDocumentIdByKey(roles, USER_ROLES.coach);
  const presidentRoleId = getRoleDocumentIdByKey(roles, USER_ROLES.president);

  if (userDataLoading) {
    return (
      <OnboardingStateView
        description="Nous r\u00E9cup\u00E9rons ton profil avant de choisir ton r\u00F4le."
        isLoading
        title="Chargement du profil"
      />
    );
  }

  if (userDataError) {
    return (
      <OnboardingStateView
        actionLabel="R\u00E9essayer"
        description={userDataError?.message || 'Impossible de charger ton profil.'}
        onAction={refetchUserData}
        title="Chargement impossible"
      />
    );
  }

  if (rolesLoading && !roles?.length) {
    return (
      <OnboardingStateView
        description="Nous chargeons les r\u00F4les disponibles."
        isLoading
        title="Chargement des r\u00F4les"
      />
    );
  }

  if (rolesError && !roles?.length) {
    return (
      <OnboardingStateView
        actionLabel="R\u00E9essayer"
        description={rolesError?.message || 'Impossible de charger les r\u00F4les.'}
        onAction={refetchRoles}
        title="Chargement impossible"
      />
    );
  }

  return (
    <FormScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.paddingVertical[24],
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
        { marginBottom: insets.bottom },
      ]}
    >
      <ScrollView
        contentContainerStyle={[Spaces.gap[40]]}
        refreshControl={(
          <RefreshControl
            onRefresh={refetchRoles}
            refreshing={rolesLoading}
          />
        )}
      >
        <View style={[Spaces.gap[16]]}>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('profile.titles.type')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {t('profile.subtitles.type')}
          </Text>
        </View>
        <WithDataWrapper error={rolesError?.message} isLoading={rolesLoading}>
          <View style={[Spaces.gap[24]]}>
            <TabButton
              isActive={role === playerRoleId}
              onPress={() => handleSelection(USER_ROLES.player)}
              title={t('profile.fields.types.player')}
            />
            <TabButton
              isActive={role === coachRoleId}
              onPress={() => handleSelection(USER_ROLES.coach)}
              title={t('profile.fields.types.coach')}
            />
            <TabButton
              isActive={role === presidentRoleId}
              onPress={() => handleSelection(USER_ROLES.president)}
              title={t('profile.fields.types.president')}
            />

          </View>
        </WithDataWrapper>
      </ScrollView>
      <Button
        disabled={!role}
        isLoading={updateUserMutation.isPending}
        onPress={handleNext}
        title={t('profile.actions.save')}
        variant="Primary"
      />
    </FormScreenContainer>
  );
}

export default UserRole;
