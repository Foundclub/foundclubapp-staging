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

import { getApiErrorTranslation } from '@/utils/errors/displayError';

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
  // 🏛️ COLL-ACCUEIL (01/10, décision d'Adel « accueil A ») — la 5e rangée, « Je représente
  // une collectivité ». Ce n'est PAS un rôle Strapi : le compte garde son rôle provisoire, et
  // l'inscription de la mairie (CollectiviteSignup) remplace toutes les questions de sport.
  const [representeCollectivite, setRepresenteCollectivite] = useState(false);
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
    // FINITIONS5 (tournee 7, defaut 8) — UNE SEULE VOIX, EN FRANCAIS. La recette
    // lisait deux alertes pour un meme refus : celle-ci (« Failed to update user
    // data: Requested role is not allowed », le message brut du serveur), puis
    // celle du gestionnaire global des mutations (« Acces refuse. »). L'ecran
    // parle seul : la traduction du refus quand il en a une, sinon sa phrase.
    meta: { preventToastError: true },
    mutationFn: updateMe,
    onError: (error) => {
      Alert.alert(
        t('userRole.alerts.updateError.title', 'Erreur'),
        getApiErrorTranslation(error) || t(
          'userRole.alerts.updateError.message',
          'Impossible de mettre à jour ton profil.',
        ),
      );
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

  /**
   * Handle the selection of the user type
   * @param {string} selectedRole
   */
  const handleSelection = (selectedRole) => {
    const newRole = getRoleDocumentIdByKey(roles, selectedRole);
    setRepresenteCollectivite(false);
    setRole((currentRole) => (newRole === currentRole ? '' : newRole));
  };

  const handleSelectCollectivite = () => {
    setRole('');
    setRepresenteCollectivite((avant) => !avant);
  };

  const playerRoleId = getRoleDocumentIdByKey(roles, USER_ROLES.player);
  const coachRoleId = getRoleDocumentIdByKey(roles, USER_ROLES.coach);
  const presidentRoleId = getRoleDocumentIdByKey(roles, USER_ROLES.president);
  // PARENT (2026-09-02) — le 4e choix : « un compte parent dans les roles ».
  // Il n apparait que si le serveur porte ce role (liste `/users-permissions/roles`).
  const parentRoleId = getRoleDocumentIdByKey(roles, USER_ROLES.parent);
  // FINITIONS5 (tournee 7, defaut 8) — « Continuer » ne part qu'avec un role
  // COCHE. `role` demarre sur le role ACTUEL du compte : pour un compte neuf,
  // c'est le role provisoire (« Authenticated »), qu'aucune case ne montre.
  // Il n'etait pas vide, donc le bouton restait actif et l'envoyait — 403.
  const hasChosenRole = [playerRoleId, coachRoleId, presidentRoleId, parentRoleId]
    .filter(Boolean)
    .includes(role);

  const handleNext = () => {
    // COLL-ACCUEIL — la mairie : aucun rôle à poser, aucune question de sport.
    if (representeCollectivite) {
      navigation.navigate(RouteNames.CollectiviteSignup);
      return;
    }
    if (!hasChosenRole) return;
    updateUserMutation.mutate({ role });
  };

  if (userDataLoading) {
    return (
      <OnboardingStateView
        description={t(
          'userRole.loading.description',
          'Nous récupérons ton profil avant de choisir ton rôle.',
        )}
        isLoading
        title={t('userRole.loading.title', 'Chargement du profil')}
      />
    );
  }

  if (userDataError) {
    return (
      <OnboardingStateView
        actionLabel={t('userRole.loadError.retry', 'Réessayer')}
        description={userDataError?.message || t(
          'userRole.loadError.message',
          'Impossible de charger ton profil.',
        )}
        onAction={refetchUserData}
        title={t('userRole.loadError.title', 'Chargement impossible')}
      />
    );
  }

  if (rolesLoading && !roles?.length) {
    return (
      <OnboardingStateView
        description={t(
          'userRole.rolesLoading.description',
          'Nous chargeons les rôles disponibles.',
        )}
        isLoading
        title={t('userRole.rolesLoading.title', 'Chargement des rôles')}
      />
    );
  }

  if (rolesError && !roles?.length) {
    return (
      <OnboardingStateView
        actionLabel={t('userRole.loadError.retry', 'Réessayer')}
        description={rolesError?.message || t(
          'userRole.rolesError.message',
          'Impossible de charger les rôles.',
        )}
        onAction={refetchRoles}
        title={t('userRole.loadError.title', 'Chargement impossible')}
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
            {/* COLL-ACCUEIL (01/10) — séparée des rôles sportifs, sous son propre intertitre. */}
            <Text style={[Fonts.p3Bold, Fonts.neutral300, Spaces.marginTop[12]]}>
              {t('collectiviteAccueil.statut.intertitre', 'Pour une mairie').toUpperCase()}
            </Text>
            <OnboardingRadioRow
              checked={representeCollectivite}
              label={t('collectiviteAccueil.statut.libelle', 'Je représente une collectivité')}
              onPress={handleSelectCollectivite}
              subtitle={t(
                'collectiviteAccueil.statut.precision',
                'Mairie, intercommunalité, département, région.',
              )}
              testID="statut-collectivite"
            />
          </View>
        </WithDataWrapper>
      </ScrollView>
      <Button
        disabled={!hasChosenRole && !representeCollectivite}
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
