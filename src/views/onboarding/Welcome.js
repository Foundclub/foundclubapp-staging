import { useTranslation } from 'react-i18next';
import {
  Image, Platform, ScrollView, Text, View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getUserRoleKey,
  markOnboardingComplete,
} from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { storage, useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import FormScreenContainer from '@/components/templates/FormScreenContainer';
import OnboardingStateView from '@/views/onboarding/components/OnboardingStateView';

import { useGuidance } from '@/context/GuidanceContext';

// Pack du tour guide coach dans guidanceCatalog (missions coach_tour_*).
const COACH_TOUR_PACK_ID = 'coach_tour';

/**
 * Welcome screen component shown after completing onboarding.
 * Displays app features and information for new users.
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props - The props
 * @returns {import('react').ReactElement} Welcome screen component
 */
function Welcome({ navigation }) {
  // hooks
  const {
    Alignments, Fonts, Images, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [{ auth }] = useAppContext();
  const {
    getPostOnboardingHomeRoute,
    refetchUserData,
    userData,
    userDataError,
    userDataLoading,
  } = useAuth();
  const { openMission, snapshot } = /** @type {any} */ (useGuidance());
  const roleKey = getUserRoleKey(userData?.role?.type || userData?.role?.name);
  const canShowSubscriptionWelcome = roleKey === 'coach'
    || roleKey === 'president'
    || roleKey === 'superAdmin';
  // Seuls coach et dirigeant demarrent le tour guide (joueur/superadmin gardent le flux actuel).
  const canStartGuidedTour = roleKey === 'coach' || roleKey === 'president';
  // 1ere mission du tour (missions triees par priorite -> coach_tour_welcome en tete).
  // Absente si la guidance n'est pas hydratee ou si le programme du role ne contient pas le tour.
  const guidedTourFirstMission = /** @type {any[]} */ (snapshot?.missions || []).find(
    (/** @type {any} */ mission) => mission.packId === COACH_TOUR_PACK_ID,
  ) || null;
  // On ne propose le bouton "Demarrer le tour" que si le tour est reellement disponible pour le
  // role courant, pour ne jamais afficher un bouton qui retomberait silencieusement sur le home.
  const shouldOfferGuidedTour = canStartGuidedTour && Boolean(guidedTourFirstMission);

  // Les quotas gratuits sont des constantes produit : des puces statiques evitent l'etat
  // "resume pas encore charge" qui affichait un texte vague au moment le plus vendeur.
  const offerCards = [
    {
      borderColor: 'rgba(255,255,255,0.14)',
      bullets: [
        t('welcome.subscription.free.bullet1', '1 équipe offerte'),
        t('welcome.subscription.free.bullet2', '1 événement, 1 match et 1 annonce offerts'),
        t('welcome.subscription.free.bullet3', 'Chat illimité, pour toujours'),
      ],
      eyebrow: t('welcome.subscription.free.eyebrow', 'Gratuit'),
      fillColor: 'rgba(255,255,255,0.08)',
      key: 'free',
      title: t('welcome.subscription.free.title', 'Commence sans payer'),
    },
    {
      borderColor: 'rgba(1, 179, 244, 0.28)',
      bullets: [
        t('welcome.subscription.team.bullet1', 'Événements illimités'),
        t('welcome.subscription.team.bullet2', 'Compositions et convocations'),
        t('welcome.subscription.team.bullet3', 'Cotisations de ton équipe'),
      ],
      eyebrow: t('welcome.subscription.team.eyebrow', 'Équipe'),
      fillColor: 'rgba(1, 179, 244, 0.1)',
      key: 'team',
      title: t('welcome.subscription.team.title', 'Débloque tes équipes'),
    },
    {
      borderColor: 'rgba(16, 185, 129, 0.24)',
      bullets: [
        t('welcome.subscription.club.bullet1', 'Toutes tes équipes incluses'),
        t('welcome.subscription.club.bullet2', 'Installations et planning du club'),
        t('welcome.subscription.club.bullet3', 'Sponsors et canal de diffusion'),
      ],
      eyebrow: t('welcome.subscription.club.eyebrow', 'Club'),
      fillColor: 'rgba(16, 185, 129, 0.08)',
      footnote: t('welcome.subscription.club.footnote', 'Réservée aux clubs vérifiés.'),
      key: 'club',
      title: t('welcome.subscription.club.title', 'Pilote tout le club'),
    },
  ];

  if (userDataLoading) {
    return (
      <OnboardingStateView
        description="Nous récupérons ton profil avant de finaliser l'onboarding."
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

  const finalizeOnboarding = () => {
    if (auth?.user?.documentId) {
      storage.set(`hasSeenWelcome_${auth.user.documentId}`, true);
      // Mark onboarding as fully completed so it won't show again
      markOnboardingComplete(auth.user.documentId);
    }
  };

  const navigateAfterOnboarding = (targetRoute, params) => {
    if (Platform.OS === 'web') {
      if (typeof navigation?.replace === 'function') {
        navigation.replace(targetRoute, params);
        return;
      }

      if (typeof navigation?.navigate === 'function') {
        navigation.navigate(targetRoute, params);
        return;
      }
    }

    navigation.reset({
      index: 0,
      routes: [{ name: targetRoute, ...(params ? { params } : {}) }],
    });
  };

  const handleContinue = () => {
    finalizeOnboarding();
    navigateAfterOnboarding(getPostOnboardingHomeRoute());
  };

  const handleStartTour = () => {
    finalizeOnboarding();
    // Demarre le tour via le moteur de missions existant (spotlight + suivi d'etapes).
    // Si le tour n'est pas disponible (guidance non hydratee, role sans programme), fallback home.
    const started = guidedTourFirstMission
      && openMission(guidedTourFirstMission, {
        startTutorial: true,
        tutorialSource: 'onboarding',
      });
    if (started) {
      return;
    }
    navigateAfterOnboarding(getPostOnboardingHomeRoute());
  };

  const renderOfferCard = (card) => (
    <View
      key={card.key}
      style={[
        Spaces.padding[16],
        Spaces.gap[10],
        {
          backgroundColor: card.fillColor,
          borderColor: card.borderColor,
          borderRadius: 20,
          borderWidth: 1,
        },
      ]}
    >
      <Text style={[Fonts.p3Bold, Fonts.primary200]}>
        {card.eyebrow}
      </Text>
      <Text style={[Fonts.h4Black, Fonts.neutral00]}>
        {card.title}
      </Text>
      {card.bullets.map((bullet) => (
        <View key={bullet} style={[Alignments.row, Spaces.gap[8]]}>
          <Text style={[Fonts.p2Bold, Fonts.primary200]}>✓</Text>
          <Text style={[Fonts.p2, Fonts.neutral100, { flex: 1 }]}>
            {bullet}
          </Text>
        </View>
      ))}
      {card.footnote ? (
        <Text style={[Fonts.p3, Fonts.neutral300]}>
          {card.footnote}
        </Text>
      ) : null}
    </View>
  );

  return (
    <FormScreenContainer
      bgImage="bg2"
      contentContainerStyle={[
        Spaces.padding[24],
        Alignments.justifySpaceBetween,
        Alignments.column,
        Alignments.fill,
        { marginBottom: insets.bottom },
      ]}
      contentWidth="readable"
    >
      {canShowSubscriptionWelcome ? (
        <>
          <View style={[Alignments.fill]}>
            <ScrollView
              contentContainerStyle={[Spaces.gap[24], Spaces.paddingBottom[24]]}
              style={[Alignments.fill]}
            >
              <View style={[Spaces.gap[12]]}>
                <Text style={[Fonts.h1Bold, Fonts.neutral00]}>
                  {t('welcome.subscription.title', 'Bienvenue dans FoundClub')}
                </Text>
                <Text style={[Fonts.h4Bold, Fonts.neutral100]}>
                  {t(
                    roleKey === 'president'
                      ? 'welcome.subscription.presidentSubtitle'
                      : 'welcome.subscription.coachSubtitle',
                    roleKey === 'president'
                      ? 'Commence gratuitement. Débloque la suite quand ton club grandit.'
                      : 'Commence gratuitement. Débloque la suite quand ton équipe grandit.',
                  )}
                </Text>
              </View>
              <View style={[Spaces.gap[16]]}>
                {offerCards.map(renderOfferCard)}
                <Text style={[Fonts.p3, Fonts.neutral300]}>
                  {t(
                    'welcome.subscription.hint',
                    'Tu retrouveras les offres à tout moment depuis ton profil.',
                  )}
                </Text>
              </View>
            </ScrollView>
            <LinearGradient
              colors={['rgba(0, 18, 24, 0)', 'rgba(0, 18, 24, 0.92)']}
              pointerEvents="none"
              style={{
                bottom: 0,
                height: 56,
                left: 0,
                position: 'absolute',
                right: 0,
              }}
            />
          </View>
          <View style={[Spaces.gap[8], Spaces.paddingTop[12]]}>
            {shouldOfferGuidedTour ? (
              // Tour guidé obligatoire (décision produit 2026-07-10) : pas d'option
              // « Passer » — le seul chemin de sortie est de démarrer le tour.
              <Button
                onPress={handleStartTour}
                title={t('welcome.tour.actions.start', 'Démarrer le tour guidé')}
                variant="Primary"
              />
            ) : (
              <Button
                onPress={handleContinue}
                title={t('welcome.subscription.actions.skip', 'Continuer')}
                variant="Primary"
              />
            )}
          </View>
        </>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={[Spaces.gap[40]]}
            style={[Alignments.fill]}
          >
            <View style={[Alignments.alignCenter, Spaces.gap[12]]}>
              <Text style={[Fonts.h1Bold, Fonts.neutral00]}>
                {t('welcome.title')}
              </Text>
              <Image
                source={Images.logo}
                style={{ height: 17, width: 156 }}
              />

            </View>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
              {t('welcome.subtitle')}
            </Text>
            <Text style={[Fonts.p1Black, Fonts.neutral00]}>
              {t('welcome.descriptions.search.bold')}
              <Text style={[Fonts.p1, Fonts.neutral00]}>
                {t('welcome.descriptions.search.regular')}
              </Text>
            </Text>
            <Text style={[Fonts.p1Black, Fonts.neutral00]}>
              {t('welcome.descriptions.register.bold')}
              <Text style={[Fonts.p1, Fonts.neutral00]}>
                {t('welcome.descriptions.register.regular')}
              </Text>
            </Text>
            <Text style={[Fonts.p1Black, Fonts.neutral00]}>
              {t('welcome.descriptions.club.bold')}
              <Text style={[Fonts.p1, Fonts.neutral00]}>
                {t('welcome.descriptions.club.regular')}
              </Text>
            </Text>
            <Text style={[Fonts.p1Black, Fonts.neutral00]}>
              {t('welcome.descriptions.info.bold')}
              <Text style={[Fonts.p1, Fonts.neutral00]}>
                {t('welcome.descriptions.info.regular')}
              </Text>
            </Text>
          </ScrollView>
          <View style={[Spaces.gap[12]]}>
            <Button
              onPress={handleContinue}
              title={t('welcome.actions.go')}
              variant="Primary"
            />
          </View>
        </>
      )}
    </FormScreenContainer>
  );
}

export default Welcome;
