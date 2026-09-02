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
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import FormScreenContainer from '@/components/templates/FormScreenContainer';
import OnboardingRadioRow from '@/views/onboarding/components/OnboardingRadioRow';
import OnboardingStateView from '@/views/onboarding/components/OnboardingStateView';

import { RouteNames } from '@/navigation/routeNames';

import { useGetRoles } from '@/services/auth/authQueries';
import { updateMe } from '@/services/auth/authService';

/**
 * User type selection screen component. Let users to select their role
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} User type screen component
 */
function UserRole({ navigation }) {
  const {
    refetchUserData,
    USER_ROLES,
    userData,
    userDataError,
    userDataLoading,
  } = useAuth();
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
      Alert.alert('Erreur', error?.message || 'Impossible de mettre à jour ton profil.');
    },
    onSuccess: async () => {
      // Rafraichir le profil AVANT de naviguer : sinon les etapes suivantes sont
      // calculees avec l'ancien role ('new') et le flux coach/dirigeant (dont
      // l'etape « Trouve ton club ») ne s'applique jamais.
      try {
        await refetchUserData?.();
      } catch {
        // On navigue quand meme : les ecrans suivants refetchent le profil.
      }
      // UserName est la premiere etape de TOUS les flux apres le choix du role.
      navigation.navigate(RouteNames.UserName);
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
  // PARENT (2026-09-02) — le 4e choix : « un compte parent dans les roles ».
  // Il n apparait que si le serveur porte ce role (liste `/users-permissions/roles`).
  const parentRoleId = getRoleDocumentIdByKey(roles, USER_ROLES.parent);

  if (userDataLoading) {
    return (
      <OnboardingStateView
        description="Nous récupérons ton profil avant de choisir ton rôle."
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

  if (rolesLoading && !roles?.length) {
    return (
      <OnboardingStateView
        description="Nous chargeons les rôles disponibles."
        isLoading
        title="Chargement des rôles"
      />
    );
  }

  if (rolesError && !roles?.length) {
    return (
      <OnboardingStateView
        actionLabel="Réessayer"
        description={rolesError?.message || 'Impossible de charger les rôles.'}
        onAction={refetchRoles}
        title="Chargement impossible"
      />
    );
  }

  return (
    <FormScreenContainer
      bgImage="bg2"
      // D31 ⑤ — l'écran pose LUI-MÊME le retrait bas (`marginBottom` ci-dessous).
      // Sans ce mode, le conteneur en ajoutait un SECOND : `insets.bottom` était
      // compté deux fois, soit ~34 pt de vide sous le bouton du bas.
      bottomInsetMode="edge-to-edge"
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
          {/*
            D56 — la grammaire de selection du pack : trois rangees-radio
            identiques. L'ancien `TabButton` remplissait la rangee choisie de
            cyan et remplacait sa fleche par une CROIX — deux signes qui disent
            « fermer », pas « choisi ». Il reste en place ailleurs dans l'app.
          */}
          <View style={[Spaces.gap[12]]}>
            <OnboardingRadioRow
              checked={Boolean(role) && role === playerRoleId}
              label={t('profile.fields.types.player')}
              onPress={() => handleSelection(USER_ROLES.player)}
            />
            <OnboardingRadioRow
              checked={Boolean(role) && role === coachRoleId}
              label={t('profile.fields.types.coach')}
              onPress={() => handleSelection(USER_ROLES.coach)}
            />
            <OnboardingRadioRow
              checked={Boolean(role) && role === presidentRoleId}
              label={t('profile.fields.types.president')}
              onPress={() => handleSelection(USER_ROLES.president)}
            />
            {parentRoleId ? (
              <OnboardingRadioRow
                checked={Boolean(role) && role === parentRoleId}
                label={t('profile.fields.types.parent', 'Parent')}
                onPress={() => handleSelection(USER_ROLES.parent)}
              />
            ) : null}
          </View>
        </WithDataWrapper>
      </ScrollView>
      <Button
        disabled={!role}
        isLoading={updateUserMutation.isPending}
        onPress={handleNext}
        style={[Spaces.marginTop[24]]}
        title={t('profile.actions.save')}
        variant="Primary"
      />
    </FormScreenContainer>
  );
}

export default UserRole;
