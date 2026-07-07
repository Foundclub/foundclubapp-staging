import { useTranslation } from 'react-i18next';
import {
  Image, Platform, ScrollView, Text, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getUserRoleKey,
  markOnboardingComplete,
} from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import {
  getSubscriptionQuotaItems,
} from '@/domains/subscription/subscriptionDecision';
import { storage, useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import FormScreenContainer from '@/components/templates/FormScreenContainer';
import OnboardingStateView from '@/views/onboarding/components/OnboardingStateView';

import { RouteNames } from '@/navigation/routeNames';

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
    freeUsageSummary,
    getPostOnboardingHomeRoute,
    refetchUserData,
    subscriptionAccessLevel,
    userData,
    userDataError,
    userDataLoading,
  } = useAuth();
  const roleKey = getUserRoleKey(userData?.role?.type || userData?.role?.name);
  const canShowSubscriptionWelcome = roleKey === 'coach' || roleKey === 'president' || roleKey === 'superAdmin';
  const freeQuotaItems = getSubscriptionQuotaItems(freeUsageSummary, subscriptionAccessLevel)
    .slice(0, 3);

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

  const handleOpenSubscription = () => {
    finalizeOnboarding();
    navigateAfterOnboarding(RouteNames.ProfileStack, {
      screen: RouteNames.SubscriptionOverview,
    });
  };

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
      <ScrollView
        contentContainerStyle={[Spaces.gap[40]]}
        style={[Alignments.fill]}
      >
        <View style={[Alignments.alignCenter, Spaces.gap[12]]}>
          <Text style={[Fonts.h1Bold, Fonts.neutral00]}>
            {canShowSubscriptionWelcome
              ? t('welcome.subscription.title', 'Bienvenue dans FoundClub')
              : t('welcome.title')}
          </Text>
          <Image
            source={Images.logo}
            style={{ height: 17, width: 156 }}
          />

        </View>
        <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
          {canShowSubscriptionWelcome
            ? t(
              roleKey === 'president'
                ? 'welcome.subscription.presidentSubtitle'
                : 'welcome.subscription.coachSubtitle',
              roleKey === 'president'
                ? 'Voici ce que tu peux faire avec les offres Free, Team et Club avant de prendre la main sur ton club.'
                : 'Voici ce que tu peux faire en gratuit, puis ce que les offres Team et Club debloquent pour ton organisation.',
            )
            : t('welcome.subtitle')}
        </Text>
        {canShowSubscriptionWelcome ? (
          <View style={[Spaces.gap[16]]}>
            <View style={[
              Spaces.padding[16],
              Spaces.gap[10],
              {
                backgroundColor: 'rgba(255,255,255,0.08)',
                borderColor: 'rgba(255,255,255,0.14)',
                borderRadius: 20,
                borderWidth: 1,
              },
            ]}
            >
              <Text style={[Fonts.p3Bold, Fonts.primary200]}>
                {t('welcome.subscription.free.eyebrow', 'Free')}
              </Text>
              <Text style={[Fonts.h4Black, Fonts.neutral00]}>
                {t('welcome.subscription.free.title', 'Commencer sans payer')}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral00]}>
                {t(
                  'welcome.subscription.free.description',
                  'Tu peux lancer ton activité avec les quotas gratuits FoundClub, puis debloquer la suite quand tu en as besoin.',
                )}
              </Text>
              {freeQuotaItems.length ? freeQuotaItems.map((item) => (
                <Text key={item.quotaType} style={[Fonts.p2, Fonts.neutral100]}>
                  {`• ${item.total} ${item.label.toLowerCase()} offert${item.total > 1 ? 's' : ''}`}
                </Text>
              )) : (
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  {t(
                    'welcome.subscription.free.fallback',
                    'Tu retrouveras tes compteurs gratuits directement dans ton profil.',
                  )}
                </Text>
              )}
            </View>

            <View style={[
              Spaces.padding[16],
              Spaces.gap[10],
              {
                backgroundColor: 'rgba(1, 179, 244, 0.1)',
                borderColor: 'rgba(1, 179, 244, 0.28)',
                borderRadius: 20,
                borderWidth: 1,
              },
            ]}
            >
              <Text style={[Fonts.p3Bold, Fonts.primary200]}>
                {t('welcome.subscription.team.eyebrow', 'Team')}
              </Text>
              <Text style={[Fonts.h4Black, Fonts.neutral00]}>
                {t('welcome.subscription.team.title', 'Debloquer une ou plusieurs equipes')}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral100]}>
                {t(
                  'welcome.subscription.team.description',
                  'L offre Team ouvre les publications et la gestion sur les equipes couvertes par tes slots.',
                )}
              </Text>
            </View>

            <View style={[
              Spaces.padding[16],
              Spaces.gap[10],
              {
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                borderColor: 'rgba(16, 185, 129, 0.24)',
                borderRadius: 20,
                borderWidth: 1,
              },
            ]}
            >
              <Text style={[Fonts.p3Bold, Fonts.primary200]}>
                {t('welcome.subscription.club.eyebrow', 'Club')}
              </Text>
              <Text style={[Fonts.h4Black, Fonts.neutral00]}>
                {t('welcome.subscription.club.title', 'Piloter tout le club')}
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral100]}>
                {t(
                  'welcome.subscription.club.description',
                  roleKey === 'president'
                    ? 'L offre Club ouvre la gouvernance, les roles, les cotisations et les actions club une fois la verification dirigeant validee.'
                    : 'L offre Club est reservee aux clubs verifies et centralise les droits pour toutes les equipes du club.',
                )}
              </Text>
            </View>

            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t(
                'welcome.subscription.hint',
                "Tu pourras retrouver l'entree Abonnement FoundClub a tout moment depuis ton profil.",
              )}
            </Text>
          </View>
        ) : (
          <>
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
          </>
        )}
      </ScrollView>
      <View style={[Spaces.gap[12]]}>
        {canShowSubscriptionWelcome ? (
          <Button
            onPress={handleOpenSubscription}
            title={t('welcome.subscription.actions.open', 'Voir mon abonnement')}
            variant="Secondary"
          />
        ) : null}
        <Button
          onPress={handleContinue}
          title={canShowSubscriptionWelcome
            ? t('welcome.subscription.actions.skip', 'Continuer en gratuit')
            : t('welcome.actions.go')}
          variant="Primary"
        />
      </View>
    </FormScreenContainer>
  );
}

export default Welcome;
