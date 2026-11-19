import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getOnboardingViews, markOnboardingStarted } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { identiteComplete } from '@/domains/complexe/arriveeSansRole';
import { ecrireModeComplexe } from '@/domains/complexe/modeComplexe';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import ChoixDuSport from '@/components/organisms/choixDuSport/ChoixDuSport';
import FormScreenContainer from '@/components/templates/FormScreenContainer';
import ChoixPourUnComplexe from '@/views/onboarding/components/ChoixPourUnComplexe';
import OnboardingRadioRow from '@/views/onboarding/components/OnboardingRadioRow';
import OnboardingStateView from '@/views/onboarding/components/OnboardingStateView';
import OnboardingStickyFooter from '@/views/onboarding/components/OnboardingStickyFooter';
import useFiletVilleSeule from '@/views/onboarding/components/useFiletVilleSeule';

import { RouteNames } from '@/navigation/routeNames';

import { useGetActivities } from '@/services/activity/activityQueries';
import { updateMe } from '@/services/auth/authService';

import { COMPLEXES_GERANT, INSCRIPTION_PLUSIEURS_SPORTS } from '@/config/fonctionsMasquees';

// INSCRIPTION-CODE (19/11/2026, V01 + V02 validés, v2_01 et v2_02 « ok ») — LE PREMIER ÉCRAN DE
// L'INSCRIPTION, pour tout le monde : « Que pratiques-tu ? ». La recherche d'abord (sans accents),
// les plus choisis, puis toute la liste de A à Z (le choix du sport de la recherche,
// `ChoixDuSport`, sans préfiltre par famille). Obligatoire : plus de « Passer » à l'écran
// (l'étape reste « facultative » pour la REPRISE d'un tunnel : authUseCases
// OPTIONAL_ONBOARDING_ROUTES). Deux sorties en bas : « Je ne trouve pas mon activité », et la
// porte « mairie ou complexe ? », venue de l'écran du statut avec les mêmes gestes.
const MAX_SPORTS = INSCRIPTION_PLUSIEURS_SPORTS ? 3 : 1;

const resolveAvailableRoute = (
  navigation,
  ...candidates
) => {
  const routeNames = navigation?.getState?.()?.routeNames || [];
  const firstCandidate = candidates.find(Boolean);

  if (!Array.isArray(routeNames) || routeNames.length === 0) {
    return firstCandidate;
  }

  return candidates.find((candidate) => candidate && routeNames.includes(candidate)) || firstCandidate;
};

/**
 * Le premier écran de l'inscription : l'activité.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement} L'écran.
 */
function UserSport({ navigation }) {
  // Les activités cochées ; la première est la principale (`preferredSport`).
  // ponytail: au-delà de la première, rien n'est enregistré : INSCRIPTION_PLUSIEURS_SPORTS reste
  // éteint (un seul choix) tant que le compte n'a pas de champ pour les autres activités.
  const [choisis, setChoisis] = useState(/** @type {string[]} */ ([]));
  const selectedSport = choisis[0] || null;
  // 🏛️ COLL-ACCUEIL (01/10) et RESA-INSCRIPTION (19/10), venus de UserRole : « Je représente une
  // collectivité » et « Je gère un complexe ». Ce ne sont PAS des rôles Strapi : le compte garde
  // son rôle provisoire, et leur propre inscription remplace les questions d'activité.
  const [porteOuverte, setPorteOuverte] = useState(false);
  const [representeCollectivite, setRepresenteCollectivite] = useState(false);
  const [gereUnComplexe, setGereUnComplexe] = useState(false);

  const {
    getNextOnboardingRoute,
    getPostOnboardingHomeRoute,
    refetchUserData,
    userData,
    userDataError,
    userDataLoading,
  } = useAuth();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const {
    data: activities,
    error: activitiesError,
    isLoading: activitiesLoading,
    refetch: refetchActivities,
  } = useGetActivities();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  // 🏛️ COLL-ACCUEIL (01/10), copié de l'écran du statut (INSCRIPTION-CODE-3) : sur le site, un
  // compte « Ville seule » qui gère une Ville, ou l'a demandé, retrouve sa Ville ou sa demande.
  useFiletVilleSeule(navigation, userData);

  const updateUserMutation = useMutation({
    mutationFn: updateMe,
    onError: (error) => {
      Alert.alert(t('userSport.alerts.updateError.title', 'Erreur'), error?.message || t(
        'userSport.alerts.updateError.message',
        'Impossible de mettre à jour ton profil.',
      ));
    },
    onSuccess: () => {
      // Invalidate user query to refresh data
      queryClient.invalidateQueries({ queryKey: ['get-me'] });

      // Calculate next route based on the NEW sport, not the old userData
      const chosenSport = String(selectedSport || '').trim();
      const tempUserData = { ...userData, preferredSport: chosenSport };
      const views = getOnboardingViews(tempUserData);

      const currentView = views.views.find((v) => v.route === RouteNames.UserSport);
      const currentIndex = currentView?.index || 0;
      const nextView = views.views.find((v) => v.index > currentIndex && v.canShow !== false);
      const sequentialNextRoute = getNextOnboardingRoute(RouteNames.UserSport);
      const postOnboardingRoute = getPostOnboardingHomeRoute();
      const nextRoute = resolveAvailableRoute(
        navigation,
        nextView?.route,
        sequentialNextRoute,
        postOnboardingRoute,
      );

      if (nextRoute) {
        // D23 - le sport voyage EN PARAMETRE jusqu'a l'etape Poste.
        navigation.navigate(
          nextRoute,
          nextRoute === RouteNames.UserPosition ? { selectedSport: chosenSport } : undefined,
        );
      }
    },
  });

  useEffect(() => {
    if (userData?.preferredSport) {
      setChoisis([String(userData.preferredSport)]);
    }
  }, [userData?.preferredSport]);

  // FINITIONS18 · POINT 4 — une inscription NEUVE commence ici désormais (premier écran) : elle est
  // marquée sur cet appareil, comme le fait toujours l'écran du statut.
  useEffect(() => {
    markOnboardingStarted(userData?.documentId);
  }, [userData?.documentId]);

  if (userDataLoading) {
    return (
      <OnboardingStateView
        description={t(
          'userSport.loading.description',
          'Nous récupérons ton profil avant de choisir ton sport.',
        )}
        isLoading
        title={t('userSport.loading.title', 'Chargement du profil')}
      />
    );
  }

  if (userDataError) {
    return (
      <OnboardingStateView
        actionLabel={t('userSport.loadError.retry', 'Réessayer')}
        description={userDataError?.message || t(
          'userSport.loadError.message',
          'Impossible de charger ton profil.',
        )}
        onAction={refetchUserData}
        title={t('userSport.loadError.title', 'Chargement impossible')}
      />
    );
  }

  if (activitiesLoading && !activities?.length) {
    return (
      <OnboardingStateView
        description={t(
          'userSport.sportsLoading.description',
          'Nous chargeons la liste des sports.',
        )}
        isLoading
        title={t('userSport.sportsLoading.title', 'Chargement des sports')}
      />
    );
  }

  if (activitiesError && !activities?.length) {
    return (
      <OnboardingStateView
        actionLabel={t('userSport.loadError.retry', 'Réessayer')}
        description={activitiesError?.message || t(
          'userSport.sportsError.message',
          'Impossible de charger les sports.',
        )}
        onAction={refetchActivities}
        title={t('userSport.loadError.title', 'Chargement impossible')}
      />
    );
  }

  const choisirUnSport = (/** @type {string} */ nom) => {
    setRepresenteCollectivite(false);
    setGereUnComplexe(false);
    setChoisis((avant) => {
      if (avant.includes(nom)) return avant.filter((n) => n !== nom);
      if (MAX_SPORTS === 1) return [nom];
      return avant.length >= MAX_SPORTS ? avant : [...avant, nom];
    });
  };

  const basculer = (/** @type {'collectivite' | 'complexe'} */ quoi) => {
    setChoisis([]);
    setRepresenteCollectivite((avant) => (quoi === 'collectivite' ? !avant : false));
    setGereUnComplexe((avant) => (quoi === 'complexe' ? !avant : false));
  };

  const handleNext = () => {
    // COLL-ACCUEIL — la mairie : aucun rôle à poser, aucune question d'activité.
    if (representeCollectivite) {
      navigation.navigate(RouteNames.CollectiviteSignup);
      return;
    }
    // RESA-INSCRIPTION — le complexe : aucun rôle à poser, le tunnel EXISTANT (RESA-L5A1).
    // GERANT-INSCRIPTION (10/11/2026, décision 3 A) : l'identité d'abord, et le contrôle d'âge
    // avant qu'un complexe existe. Le mode complexe garde le choix (stockage local, tient un
    // rechargement du site) : « Qui es-tu ? » mène ensuite à la fiche.
    if (gereUnComplexe) {
      ecrireModeComplexe(userData?.documentId, true);
      navigation.navigate(identiteComplete(userData)
        ? RouteNames.ComplexeDevenirGerant
        : RouteNames.UserName);
      return;
    }
    if (selectedSport && userData) {
      updateUserMutation.mutate({ preferredSport: selectedSport.trim() });
    }
  };

  // « Je ne trouve pas mon activité » (V02) : V1 et V2 ne disent pas ce qu'il fait ; le chemin sûr
  // est celui de l'ancien « Passer » : continuer sans activité, rien d'enregistré (mots d'avant).
  // Choix confirmé par le chef d'orchestre (19/11, option A).
  // ponytail: l'activité manquante n'est dite à personne. Un jour : un champ « dis-nous laquelle »
  // envoyé à l'Assistance.
  const handleSkip = () => {
    // D23 - sauter le sport saute AUSSI le poste.
    const afterSport = getNextOnboardingRoute(RouteNames.UserSport);
    const nextRoute = resolveAvailableRoute(
      navigation,
      afterSport === RouteNames.UserPosition
        ? getNextOnboardingRoute(RouteNames.UserPosition)
        : afterSport,
      getPostOnboardingHomeRoute(),
    );
    if (nextRoute) {
      navigation.navigate(nextRoute);
    }
  };

  const peutContinuer = Boolean(selectedSport) || representeCollectivite || gereUnComplexe;

  return (
    <FormScreenContainer
      bgImage="bg2"
      // D31 ⑤ — l'écran pose LUI-MÊME le retrait bas (`marginBottom` ci-dessous).
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
      <ScrollView
        contentContainerStyle={[Spaces.gap[24]]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.h2Black, Fonts.neutral00]}>
            {t('onboarding.sport.premierEcran.titre', 'Que pratiques-tu ?')}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral00]}>
            {MAX_SPORTS > 1
              ? t(
                'onboarding.sport.premierEcran.sousTitrePlusieurs',
                'Ton sport ou ton activité. Tu peux en choisir jusqu’à 3.',
              )
              : t('onboarding.sport.premierEcran.sousTitre', 'Ton sport ou ton activité.')}
          </Text>
        </View>

        {activitiesLoading ? (
          <ActivityIndicator color={Colors.primary500} size="large" />
        ) : (
          <ChoixDuSport
            cle="name"
            multiple={MAX_SPORTS > 1}
            onChoisir={choisirUnSport}
            sansTousLesSports
            sports={activities}
            textes={{
              populaires: t('onboarding.sport.premierEcran.populaires', 'Les plus choisis'),
              recherche: t(
                'onboarding.sport.premierEcran.recherche',
                'Rechercher : football, judo, yoga…',
              ),
              toutes: t('onboarding.sport.premierEcran.toutes', 'Toutes les activités, de A à Z'),
            }}
            valeurs={choisis}
          />
        )}

        <View style={[Spaces.gap[12], { paddingBottom: 24 }]}>
          <TouchableOpacity
            accessibilityRole="button"
            onPress={handleSkip}
            style={{ justifyContent: 'center', minHeight: 44 }}
            testID="sport-pas-dans-la-liste"
          >
            <Text style={[Fonts.p2Bold, { color: Colors.primary300 }]}>
              {t('onboarding.sport.premierEcran.pasDansLaListe', 'Je ne trouve pas mon activité')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ expanded: porteOuverte }}
            onPress={() => setPorteOuverte((avant) => !avant)}
            style={{ justifyContent: 'center', minHeight: 44 }}
            testID="porte-mairie-complexe"
          >
            <Text style={[Fonts.p2Bold, { color: Colors.primary300 }]}>
              {COMPLEXES_GERANT
                ? t(
                  'onboarding.sport.premierEcran.porte',
                  'Tu représentes une mairie ou un complexe ?',
                )
                : t('onboarding.sport.premierEcran.porteMairie', 'Tu représentes une mairie ?')}
            </Text>
          </TouchableOpacity>
          {porteOuverte ? (
            <View style={[Spaces.gap[12]]}>
              <Text style={[Fonts.p3Bold, Fonts.neutral300]}>
                {t('collectiviteAccueil.statut.intertitre', 'Pour une mairie').toUpperCase()}
              </Text>
              <OnboardingRadioRow
                checked={representeCollectivite}
                label={t('collectiviteAccueil.statut.libelle', 'Je représente une collectivité')}
                onPress={() => basculer('collectivite')}
                subtitle={t(
                  'collectiviteAccueil.statut.precision',
                  'Mairie, intercommunalité, département, région.',
                )}
                testID="statut-collectivite"
              />
              {COMPLEXES_GERANT ? (
                <ChoixPourUnComplexe
                  checked={gereUnComplexe}
                  onPress={() => basculer('complexe')}
                />
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <OnboardingStickyFooter contentWidth="readable">
        <Button
          disabled={!peutContinuer}
          isLoading={updateUserMutation.isPending}
          onPress={handleNext}
          title={t('common.actions.next', 'Continuer')}
          variant="Primary"
        />
      </OnboardingStickyFooter>
    </FormScreenContainer>
  );
}

export default UserSport;
