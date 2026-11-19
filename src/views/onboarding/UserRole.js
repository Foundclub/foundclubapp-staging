import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, Platform, RefreshControl, Text, View,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { familleDuSport } from '@/domains/activity/familleDuSport';
import {
  getOnboardingViews, getRoleDocumentIdByKey, markOnboardingStarted,
} from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { aUneDemandeDeGestion } from '@/domains/collectivite/collectiviteAccueil';
import { lienDeLaVilleRetenu } from '@/domains/collectivite/lienDeLaVille';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import FormScreenContainer from '@/components/templates/FormScreenContainer';
import BandeauTournoiEnCours from '@/views/onboarding/components/BandeauTournoiEnCours';
import {
  continuerSurOrdinateur,
  STYLE_CONTINUER_ORDINATEUR,
} from '@/views/onboarding/components/continuerOrdinateur';
import OnboardingRadioRow from '@/views/onboarding/components/OnboardingRadioRow';
import OnboardingStateView from '@/views/onboarding/components/OnboardingStateView';

import { RouteNames } from '@/navigation/routeNames';

import { useGetRoles } from '@/services/auth/authQueries';
import { updateMe } from '@/services/auth/authService';
import {
  useMyCollectivites,
  useMyManagerRequests,
} from '@/services/collectivite/collectiviteQueries';

import { getApiErrorTranslation } from '@/utils/errors/displayError';

import { isBirthdateUnderAge } from '@/constants/parentalDeclaration';
import { useIsDesktop } from '@/responsive';

/**
 * User type selection screen component. Let users to select their role
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} User type screen component
 */
function UserRole({ navigation }) {
  const {
    getPostOnboardingHomeRoute,
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
  // INSCRIPTION-CODE (19/11, V02 validé) — « Je représente une collectivité » et « Je gère un
  // complexe » ont quitté cet écran : ils sont au bas du PREMIER écran (UserSport), derrière
  // « Tu représentes une mairie ou un complexe ? », avec les mêmes gestes.
  // hooks
  const {
    Alignments, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const isDesktop = useIsDesktop();
  const {
    data: roles,
    error: rolesError,
    isLoading: rolesLoading,
    refetch: refetchRoles,
  } = useGetRoles();

  // 🏛️ COLL-ACCUEIL (01/10) — SUR LE SITE, un compte « Ville seule » (aucun rôle sportif) qui
  // gère une Ville, ou qui a déjà demandé à en gérer une, ne refait pas le choix du statut :
  // l'accueil de sa Ville, ou l'écran de sa demande. Sur téléphone, la pile racine
  // (PrivateNavigator) l'y emmène déjà au démarrage ; ici, c'est le filet du site, dont le
  // parcours d'inscription vient de getOnboardingViews.
  const sansRoleSportif = Platform.OS === 'web' && userData?.role?.type === 'authenticated';
  // FINITIONS16 21 (planche 8, P1-inscription-ordi) : sur ordinateur, « Continuer » à droite.
  const surOrdinateur = continuerSurOrdinateur(isDesktop);
  const villes = useMyCollectivites({ enabled: sansRoleSportif });
  const demandesDeGestion = useMyManagerRequests({ enabled: sansRoleSportif });
  const villeGeree = Array.isArray(villes.data) ? villes.data[0] : null;
  // REPRISE-102BIS (02/11) : une demande annulée ne compte plus, comme sur l'accueil du site et
  // au téléphone ; sinon « Choisir mon statut », après l'annulation, ramenait à la demande.
  const aDemande = aUneDemandeDeGestion(demandesDeGestion.data);
  useEffect(() => {
    if (!sansRoleSportif) return;
    if (villeGeree?.documentId) {
      navigation.reset({
        index: 0,
        routes: [{
          name: RouteNames.CollectiviteHome,
          params: { collectiviteId: villeGeree.documentId },
        }],
      });
    } else if (aDemande) {
      navigation.reset({ index: 0, routes: [{ name: RouteNames.CollectiviteSignupStatus }] });
    }
  }, [aDemande, navigation, sansRoleSportif, villeGeree?.documentId]);

  // FINITIONS18 · POINT 4 — une inscription NEUVE commence ici : elle est marquee sur cet appareil
  // (un compte deja affilie qui n'a jamais vu cet ecran ici n'est pas renvoye au tunnel).
  useEffect(() => {
    markOnboardingStarted(userData?.documentId);
  }, [userData?.documentId]);

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
      // INSCRIPTION-CODE (19/11) — l'activité et « Qui es-tu ? » viennent AVANT le rôle : la suite
      // est la première étape due du parcours du rôle choisi (calculée sur ce rôle, pas sur l'ancien
      // profil en mémoire). Plus rien de dû : la sortie habituelle.
      const roleChoisi = (Array.isArray(roles) ? roles : [])
        .find((r) => r?.documentId === role);
      const suite = getOnboardingViews({ ...userData, role: roleChoisi || userData?.role })
        .views.find((view) => view.canShow && view.route !== RouteNames.UserRole)?.route;
      navigation.navigate(suite || getPostOnboardingHomeRoute());
    },
  });

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

  // CORR-INSCRIPTION p10 (recette du site, décision A) — arrivé par « Inscrire mon club » d'une
  // invitation de la Ville, sans compte : le lien est retenu 48 h (lienDeLaVille). Le compte neuf
  // trouve « Dirigeant·e » déjà coché ; la création du club enverra le lien (ClubWizardRecap).
  useEffect(() => {
    if (!presidentRoleId || !lienDeLaVilleRetenu()) return;
    setRole((avant) => (
      [coachRoleId, parentRoleId, playerRoleId, presidentRoleId].includes(avant)
        ? avant
        : presidentRoleId
    ));
  }, [coachRoleId, parentRoleId, playerRoleId, presidentRoleId]);
  // FINITIONS5 (tournee 7, defaut 8) — « Continuer » ne part qu'avec un role
  // COCHE. `role` demarre sur le role ACTUEL du compte : pour un compte neuf,
  // c'est le role provisoire (« Authenticated »), qu'aucune case ne montre.
  // Il n'etait pas vide, donc le bouton restait actif et l'envoyait — 403.
  // INSCRIPTION-CODE (19/11, V05 + reco de v2_01 « ok ») — l'âge est connu AVANT le rôle : avant
  // 18 ans, les rôles d'adulte restent visibles mais fermés, et disent pourquoi. Le serveur reste
  // le garde-fou (« Requested role is not allowed ») ; ceci évite d'y arriver.
  const estMineur = isBirthdateUnderAge(userData?.birthdate, 18);
  const rolesDAdulte = estMineur ? [coachRoleId, presidentRoleId, parentRoleId] : [];
  const hasChosenRole = [playerRoleId, coachRoleId, presidentRoleId, parentRoleId]
    .filter(Boolean)
    .filter((id) => !rolesDAdulte.includes(id))
    .includes(role);
  const reserveAuxAdultes = estMineur
    ? t('userRole.mineur.aPartirDe18', 'À partir de 18 ans')
    : undefined;

  // INSCRIPTION-CODE (b) (19/11, V04, V06 à V09, v2_03 « ok ») — les mots du rôle suivent la famille
  // de l'activité choisie au premier écran. Activité inconnue ou absente : les mots d'avant.
  const activite = String(userData?.preferredSport || '').trim();
  const famille = familleDuSport(activite);
  const libelleDuRole = (/** @type {string} */ cle, /** @type {string} */ avant) => (famille
    ? t(`familles.${famille}.roles.${cle}`)
    : avant);
  const descriptionDuRole = (/** @type {string} */ cle) => (famille
    ? t(`familles.${famille}.descriptions.${cle}`)
    : undefined);
  // « en football », « en spéléologie », mais « en VTT » : un sigle garde ses capitales.
  const activiteDansLaPhrase = activite === activite.toUpperCase()
    ? activite
    : activite.charAt(0).toLowerCase() + activite.slice(1);

  const handleNext = () => {
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
          {/* T-PAGES-6b (18/11, point 5 de T-PAGES-6) : venu d'un tournoi, le rappel du tournoi et
              la phrase de Clément ; sinon le bandeau ne rend rien. */}
          <BandeauTournoiEnCours
            phrase={t(
              'inscriptionTournoi.roleSansEffet',
              'Le rôle que tu choisis ne change rien pour le tournoi : il sert seulement à '
                + 'savoir quel est ton rôle dans ta vie sportive de tous les jours.',
            )}
          />
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {activite
              ? t('familles.roleTitre', {
                activite: activiteDansLaPhrase, interpolation: { escapeValue: false },
              })
              : t('profile.titles.type')}
          </Text>
          {/* V1 (insc_02) : la promesse « tu pourras en ajouter d'autres plus tard » n'avait aucun
              code derrière ; on dit la vérité (un coach peut jouer dans une équipe). */}
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {famille === 'equipe' || !famille
              ? t('familles.roleSousTitreEquipe')
              : t('familles.roleSousTitre')}
          </Text>
          {estMineur ? (
            <Text style={[Fonts.p2, Fonts.neutral300]} testID="role-mineur">
              {t(
                'userRole.mineur.explication',
                'Certains rôles sont réservés aux 18 ans et plus.',
              )}
            </Text>
          ) : null}
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
              label={libelleDuRole('player', t('profile.fields.types.player'))}
              onPress={() => handleSelection(USER_ROLES.player)}
              subtitle={descriptionDuRole('player')}
            />
            <OnboardingRadioRow
              checked={Boolean(role) && role === coachRoleId}
              disabled={estMineur}
              label={libelleDuRole('coach', t('profile.fields.types.coach'))}
              onPress={() => handleSelection(USER_ROLES.coach)}
              subtitle={reserveAuxAdultes || descriptionDuRole('coach')}
            />
            <OnboardingRadioRow
              checked={Boolean(role) && role === presidentRoleId}
              disabled={estMineur}
              label={libelleDuRole('president', t('profile.fields.types.president'))}
              onPress={() => handleSelection(USER_ROLES.president)}
              subtitle={reserveAuxAdultes || descriptionDuRole('president')}
            />
            {parentRoleId ? (
              <OnboardingRadioRow
                checked={Boolean(role) && role === parentRoleId}
                disabled={estMineur}
                label={libelleDuRole('parent', t('profile.fields.types.parent', 'Parent'))}
                onPress={() => handleSelection(USER_ROLES.parent)}
                subtitle={reserveAuxAdultes || descriptionDuRole('parent')}
              />
            ) : null}
          </View>
        </WithDataWrapper>
      </ScrollView>
      <Button
        disabled={!hasChosenRole}
        isLoading={updateUserMutation.isPending}
        onPress={handleNext}
        style={surOrdinateur
          ? [Spaces.marginTop[24], STYLE_CONTINUER_ORDINATEUR]
          : [Spaces.marginTop[24]]}
        title={t('profile.actions.save')}
        variant="Primary"
      />
    </FormScreenContainer>
  );
}

export default UserRole;
