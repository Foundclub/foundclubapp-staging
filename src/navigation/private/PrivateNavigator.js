/* eslint-disable global-require */
import { createStackNavigator } from '@react-navigation/stack';
import {
  useCallback, useEffect, useMemo, useRef,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Stepper from '@/components/atoms/stepper/Stepper';
import { HistoryWizardProvider } from '@/views/historyWizard/HistoryWizardContext';
import UserAddress from '@/views/onboarding/UserAddress';
import UserAffiliationGuide from '@/views/onboarding/UserAffiliationGuide';
import UserAvatar from '@/views/onboarding/UserAvatar';
import UserBirthdate from '@/views/onboarding/UserBirthdate';
import UserCategory from '@/views/onboarding/UserCategory';
import UserClubSearch from '@/views/onboarding/UserClubSearch';
import UserLevel from '@/views/onboarding/UserLevel';
import UserName from '@/views/onboarding/UserName';
import UserParentalDeclaration from '@/views/onboarding/UserParentalDeclaration';
import UserPhysique from '@/views/onboarding/UserPhysique';
import UserPosition from '@/views/onboarding/UserPosition';
import UserType from '@/views/onboarding/UserRole';
import UserSection from '@/views/onboarding/UserSection';
import UserSport from '@/views/onboarding/UserSport';
import UserSportHistory from '@/views/onboarding/UserSportHistory';
import Welcome from '@/views/onboarding/Welcome';

import { commonOptions } from '@/navigation/commonOptions';
import { navigate as navigateRoot, navigationRef } from '@/navigation/navigationService';
import { readPendingSquadInviteLink } from '@/navigation/pendingSquadInviteLink';
import { RouteNames } from '@/navigation/routeNames';

import PrivateTabNavigator from './PrivateTabNavigator';
/* eslint-disable-next-line import/order */
import { useAppMode } from '@/context/AppModeContext';

const Stack = createStackNavigator();

/**
 *
 */
function PrivateNavigator() {
  const { Colors, Fonts, Spaces } = useTheme();
  const {
    onboardingViews, userData, userDataError, userDataLoading,
  } = useAuth();
  const { isGold } = useAppMode();
  const { t } = useTranslation();
  const isSuperAdmin = getUserRoleKey(userData?.role?.type || userData?.role?.name) === 'superAdmin';
  const pendingSquadInviteNavigationKeyRef = useRef(/** @type {string | null} */(null));
  const onboardingRedirectAttemptRef = useRef(/** @type {string | null} */(null));

  const getStepNumber = (/** @type {string} */ routeName) => onboardingViews?.views?.find((view) => view.route === routeName)?.index || 0;
  const getTotalSteps = () => onboardingViews?.totalViews || 0;
  const renderStepper = (/** @type {string} */ routeName) => <Stepper currentStep={getStepNumber(routeName)} steps={getTotalSteps()} />;
  const renderStepperIndicator = (/** @type {string} */ routeName) => (
    <View style={[Spaces.marginHorizontal[12]]}>
      <Text style={[Fonts.p2, Fonts.neutral300]}>
        {getStepNumber(routeName)}
        /
        {getTotalSteps()}
      </Text>
    </View>
  );

  const initialRouteName = useMemo(() => {
    const route = onboardingViews?.views?.reduce((acc, view) => {
      if (view.index < acc.index && view.canShow) { return view; }
      return acc;
    }, { index: 100, route: '' })?.route;

    if (route) return route;
    if (isGold) return RouteNames.LeagueHomeTab;
    return RouteNames.HomeTab;
  }, [onboardingViews, isGold]);

  const firstPendingOnboardingRoute = useMemo(() => {
    if (
      !initialRouteName
      || initialRouteName === RouteNames.HomeTab
      || initialRouteName === RouteNames.LeagueHomeTab
    ) {
      return null;
    }

    return initialRouteName;
  }, [initialRouteName]);

  useEffect(() => {
    if (!userData?.documentId || userDataLoading || userDataError) return undefined;

    const pendingInvite = readPendingSquadInviteLink();
    if (!pendingInvite?.teamId) return undefined;

    const navigationKey = `${userData.documentId}:${pendingInvite.teamId}:${pendingInvite.createdAt}`;
    if (pendingSquadInviteNavigationKeyRef.current === navigationKey) return undefined;
    pendingSquadInviteNavigationKeyRef.current = navigationKey;

    let attemptCount = 0;
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let retryTimeout;
    const openPendingInvite = () => {
      attemptCount += 1;
      const didNavigate = navigateRoot(RouteNames.SquadDetails, {
        invite: true,
        source: 'pending-squad-invite-link',
        teamId: pendingInvite.teamId,
      });

      if (!didNavigate && attemptCount < 6) {
        retryTimeout = setTimeout(openPendingInvite, 250);
      }
    };

    retryTimeout = setTimeout(openPendingInvite, 250);
    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [userData?.documentId, userDataError, userDataLoading]);

  useEffect(() => {
    if (!userData?.documentId || userDataLoading || userDataError || !firstPendingOnboardingRoute) {
      onboardingRedirectAttemptRef.current = null;
      return undefined;
    }

    const currentRouteName = navigationRef.getCurrentRoute()?.name || null;
    const shouldRedirectFromHome = (
      !currentRouteName
      || currentRouteName === RouteNames.HomeTab
      || currentRouteName === RouteNames.LeagueHomeTab
    );

    if (!shouldRedirectFromHome) {
      onboardingRedirectAttemptRef.current = null;
      return undefined;
    }

    const redirectKey = `${userData.documentId}:${firstPendingOnboardingRoute}:${currentRouteName || 'none'}`;
    if (onboardingRedirectAttemptRef.current === redirectKey) {
      return undefined;
    }
    onboardingRedirectAttemptRef.current = redirectKey;

    let attemptCount = 0;
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let retryTimeout;
    const openPendingOnboarding = () => {
      attemptCount += 1;
      const didNavigate = navigateRoot(firstPendingOnboardingRoute);

      if (!didNavigate && attemptCount < 6) {
        retryTimeout = setTimeout(openPendingOnboarding, 250);
      }
    };

    retryTimeout = setTimeout(openPendingOnboarding, 50);
    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [
    firstPendingOnboardingRoute,
    userData?.documentId,
    userDataError,
    userDataLoading,
  ]);

  const canShowView = useCallback((/** @type {string} */ routeName) => {
    const view = onboardingViews?.views?.find((item) => item.route === routeName);
    return !!view?.canShow;
  }, [onboardingViews]);

  if (userDataLoading) {
    return (
      <View style={{
        alignItems: 'center', backgroundColor: '#ffffff', flex: 1, justifyContent: 'center',
      }}
      >
        <ActivityIndicator color={Colors.primary500 || '#000'} size="large" />
      </View>
    );
  }

  if (userDataError) {
    return (
      <View style={{
        alignItems: 'center', backgroundColor: '#ffffff', flex: 1, justifyContent: 'center', padding: 20,
      }}
      >
        <Text style={{ color: 'red' }}>Erreur de connexion</Text>
      </View>
    );
  }

  return userData?.documentId ? (
    <HistoryWizardProvider>
      <Stack.Navigator id={undefined} initialRouteName={initialRouteName} key={userData?.documentId} screenOptions={commonOptions}>
        <Stack.Screen
          component={PrivateTabNavigator}
          name={RouteNames.HomeTab}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          getComponent={() => require('./LeagueTabNavigator').default}
          name={RouteNames.LeagueHomeTab}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/search/SearchHubLegacyRedirect').default}
          name={RouteNames.SearchHub}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/search/SearchRouteRedirect').default}
          name={RouteNames.SearchEvents}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/search/SearchRouteRedirect').default}
          name={RouteNames.SearchClubs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/search/SearchRouteRedirect').default}
          name={RouteNames.SearchReservations}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/search/SearchRouteRedirect').default}
          name={RouteNames.SearchRecruitment}
          options={{ headerShown: false }}
        />

        {/* Domain Stacks - These contain the refactored screens */}
        {/* Note: We use headerShown: false because the stacks manage their own headers */}

        <Stack.Screen
          getComponent={() => require('./stacks/ProfileStack').default}
          name={RouteNames.ProfileStack}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          getComponent={() => require('./stacks/ClubStack').default}
          name={RouteNames.ClubStack}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          getComponent={() => require('./stacks/TeamStack').default}
          name={RouteNames.TeamStack}
          options={{ headerShown: false }}
        />

        <Stack.Screen
          getComponent={() => require('./stacks/EventStack').default}
          name={RouteNames.EventStack}
          options={{ headerShown: false }}
        />

        {isSuperAdmin ? (
          <Stack.Screen
            getComponent={() => require('./stacks/AdminStack').default}
            name={RouteNames.AdminStack}
            options={{ headerShown: false }}
          />
        ) : null}

        {/* Remaining Screens (Filters, Chat, Alerts, Notifications) */}
        <Stack.Screen
          getComponent={() => require('@/views/event/EventFilters').default}
          name={RouteNames.EventFilters}
          options={{
            ...commonOptions,
            headerTitle: '',
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/mercato/MercatoFilters').default}
          name={RouteNames.MercatoFilters}
          options={{
            ...commonOptions,
            headerTitle: '',
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/recruitment/RecruitmentAdFilters').default}
          name={RouteNames.RecruitmentAdFilters}
          options={{
            ...commonOptions,
            headerTitle: '',
          }}
        />
        <Stack.Screen
          getComponent={() => require('./stacks/AdWizardStack').default}
          name={RouteNames.AdWizardStack}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/reservation/ReservationDetails').default}
          name={RouteNames.ReservationDetails}
          options={{
            ...commonOptions,
            headerTitle: '',
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/reservation/ReservationFilters').default}
          name={RouteNames.ReservationFilters}
          options={{
            ...commonOptions,
            headerTitle: '',
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/reservation/MissingPlayersView').default}
          name={RouteNames.MissingPlayersView}
          options={{
            ...commonOptions,
            headerTitle: 'Joueurs recherchés',
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/booking/BookingCalendar').default}
          name={RouteNames.BookingCalendar}
          options={{
            ...commonOptions,
            headerTitle: 'Réserver un créneau',
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/multisportClub/MultisportClubDetails').default}
          name={RouteNames.MultisportClubDetails}
          options={{
            ...commonOptions,
            headerTitle: 'Club Omnisport',
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/multisportClub/MultisportClubEditDetails').default}
          name={RouteNames.MultisportClubEdit}
          options={{
            ...commonOptions,
            headerTitle: 'Modifier le club',
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/multisportClub/FeaturedRequestsScreen').default}
          name={RouteNames.FeaturedRequests}
          options={{
            ...commonOptions,
            headerTitle: 'Demandes à la une',
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/multisportClub/CMDashboard').default}
          name={RouteNames.CMDashboard}
          options={{
            ...commonOptions,
            headerTitle: 'Gestion CM',
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/multisportClub/MyClubsScreen').default}
          name={RouteNames.MyClubs}
          options={{
            ...commonOptions,
            headerTitle: 'Mes clubs',
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/multisportClub/CMPlanningScreen').default}
          name={RouteNames.CMPlanning}
          options={{
            ...commonOptions,
            headerTitle: 'Planning',
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/license/CMLicensesDashboard').default}
          name={RouteNames.CMLicensesDashboard}
          options={{
            ...commonOptions,
            headerTitle: 'Cotisations multisport',
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/club/AddSponsor').default}
          name={RouteNames.AddSponsor}
          options={{
            ...commonOptions,
            headerTitle: 'Ajouter un partenaire',
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/multisportClub/CMMembersScreen').default}
          name={RouteNames.CMMembers}
          options={{
            ...commonOptions,
            headerTitle: 'Membres',
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/multisportClub/CMTeamsScreen').default}
          name={RouteNames.CMTeams}
          options={{
            headerShown: true,
            title: t('common.teams'),
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/multisportClub/CreateSectionScreen').default}
          name={RouteNames.CreateSection}
          options={{
            ...commonOptions,
            headerTitle: 'Nouvelle section',
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/search/SearchAlerts').default}
          name={RouteNames.SearchAlerts}
          options={{
            ...commonOptions,
            headerTitle: '',
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/search/SearchMapScreen').default}
          name={RouteNames.SearchMapScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/historyWizard/HistoryWizardCategory').default}
          name={RouteNames.HistoryWizardCategory}
          options={{
            ...commonOptions,
            headerTitle: 'Ajouter une expérience',
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/historyWizard/HistoryWizardClub').default}
          name={RouteNames.HistoryWizardClub}
          options={{
            ...commonOptions,
            headerTitle: 'Ajouter une expérience',
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/historyWizard/HistoryWizardPeriod').default}
          name={RouteNames.HistoryWizardPeriod}
          options={{
            ...commonOptions,
            headerTitle: 'Ajouter une expérience',
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/historyWizard/HistoryWizardLevel').default}
          name={RouteNames.HistoryWizardLevel}
          options={{
            ...commonOptions,
            headerTitle: 'Ajouter une expérience',
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/historyWizard/HistoryWizardRecap').default}
          name={RouteNames.HistoryWizardRecap}
          options={{
            ...commonOptions,
            headerTitle: 'Ajouter une expérience',
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/Conversation').default}
          name={RouteNames.Conversation}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/chat/ConversationPublicEventPicker').default}
          name={RouteNames.ConversationPublicEventPicker}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/planning/PersonalPlanningWeekFullscreen').default}
          name={RouteNames.PlanningWeekFullscreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/planning/PersonalPlanningWeekFullscreen').default}
          name={RouteNames.PersonalPlanningWeekFullscreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/NewConversation').default}
          name={RouteNames.NewConversation}
          options={{
            ...commonOptions,
            headerShown: false,
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/PollDetails').default}
          name={RouteNames.PollDetails}
          options={{
            ...commonOptions,
            headerShown: false,
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/notification/NotificationList').default}
          name={RouteNames.NotificationList}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/notification/NotificationDetails').default}
          name={RouteNames.NotificationDetails}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/license/MyLicense').default}
          name={RouteNames.MyLicense}
          options={{
            ...commonOptions,
            headerTitle: 'Ma cotisation',
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/guidance/GuideOffersRecap').default}
          name={RouteNames.GuideOffersRecap}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/subscription/SubscriptionSuccess').default}
          name={RouteNames.SubscriptionSuccess}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/subscription/SubscriptionWebSuccess').default}
          name={RouteNames.SubscriptionWebSuccess}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/license/LicenseCheckoutStatus').default}
          name={RouteNames.LicenseCheckoutStatus}
          options={{
            ...commonOptions,
            headerTitle: 'Paiement cotisation',
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/license/PublicLicensePayment').default}
          name={RouteNames.PublicLicensePayment}
          options={{
            ...commonOptions,
            headerTitle: 'Paiement cotisation',
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/requests/RequestsHub').default}
          name={RouteNames.RequestsHub}
          options={{
            headerShown: false,
          }}
        />

        <Stack.Screen
          getComponent={() => require('@/views/facility/FacilityList').default}
          name={RouteNames.FacilityList}
          options={{
            ...commonOptions,
            headerTitle: 'Installations',
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/recruitment/RecruitmentAdDetails').default}
          name={RouteNames.RecruitmentAdDetails}
          options={{
            ...commonOptions,
            headerTintColor: '#fff',
            headerTitle: '',
            headerTransparent: true,
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/recruitment/RecruitmentAdEdit').default}
          name={RouteNames.RecruitmentAdEdit}
          options={{
            ...commonOptions,
            headerTitle: 'Modifier l\'annonce',
          }}
        />
        {/* Showcase d'affiches généralisé (event/club/recruitment-ad) : registration UNIQUE
            à la racine, atteignable depuis ClubDetails (remontée) et RecruitmentAdDetails. */}
        <Stack.Screen
          getComponent={() => require('@/views/event/EventPublishedShowcase').default}
          name={RouteNames.VisualShowcase}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/facility/FacilityForm').default}
          name={RouteNames.FacilityForm}
          options={{
            ...commonOptions,
            headerTitle: '',
          }}
        />

        {/* League Screens */}
        <Stack.Screen
          getComponent={() => require('@/views/league/match/LeagueMatchDetails').default}
          name={RouteNames.MatchDetails}
          options={{
            ...commonOptions,
            headerTitle: 'Détails du match',
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/league/match/LeagueMatchDetails').default}
          name={RouteNames.LeagueMatchDetails}
          options={{
            ...commonOptions,
            headerShown: false,
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/league/match/PastMatchDetails').default}
          name={RouteNames.PastMatchDetails}
          options={{
            ...commonOptions,
            headerShown: false,
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/league/details/SquadDetailsScreen').default}
          name={RouteNames.SquadDetails}
          options={{
            ...commonOptions,
            headerShown: false,
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/league/search/SquadSearchScreen').default}
          name={RouteNames.SquadSearch}
          options={{
            ...commonOptions,
            headerShown: false,
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/league/search/SquadFiltersScreen').default}
          name={RouteNames.SquadFilters}
          options={{
            ...commonOptions,
            headerShown: false,
          }}
        />
        <Stack.Screen
          getComponent={() => require('@/views/league/details/SquadRequestsScreen').default}
          name={RouteNames.SquadRequests}
          options={{
            ...commonOptions,
            headerShown: false,
          }}
        />
        {canShowView(RouteNames.UserRole) ? (
          <Stack.Screen
            component={UserType}
            key={onboardingViews?.totalViews}
            name={RouteNames.UserRole}
            options={commonOptions}
          />
        ) : null}
        {canShowView(RouteNames.UserName) ? (
          <Stack.Screen
            component={UserName}
            key={onboardingViews?.totalViews}
            name={RouteNames.UserName}
            options={{
              ...commonOptions,
              headerRight: () => renderStepperIndicator(RouteNames.UserName),
              headerTitle: () => renderStepper(RouteNames.UserName),
              headerTitleAlign: 'left',

            }}
          />
        ) : null}
        {canShowView(RouteNames.UserSection) ? (
          <Stack.Screen
            component={UserSection}
            key={onboardingViews?.totalViews}
            name={RouteNames.UserSection}
            options={{
              ...commonOptions,
              headerRight: () => renderStepperIndicator(RouteNames.UserSection),
              headerTitle: () => renderStepper(RouteNames.UserSection),
              headerTitleAlign: 'left',

            }}
          />
        ) : null}

        {canShowView(RouteNames.UserBirthdate) ? (
          <Stack.Screen
            component={UserBirthdate}
            key={onboardingViews?.totalViews}
            name={RouteNames.UserBirthdate}
            options={{
              ...commonOptions,
              headerRight: () => renderStepperIndicator(RouteNames.UserBirthdate),
              headerTitle: () => renderStepper(RouteNames.UserBirthdate),
              headerTitleAlign: 'left',
            }}
          />
        ) : null}

        <Stack.Screen
          component={UserParentalDeclaration}
          key={onboardingViews?.totalViews}
          name={RouteNames.UserParentalDeclaration}
          options={{
            ...commonOptions,
            headerRight: () => renderStepperIndicator(RouteNames.UserParentalDeclaration),
            headerTitle: () => renderStepper(RouteNames.UserParentalDeclaration),
            headerTitleAlign: 'left',
          }}
        />

        {canShowView(RouteNames.UserAddress) ? (
          <Stack.Screen
            component={UserAddress}
            key={onboardingViews?.totalViews}
            name={RouteNames.UserAddress}
            options={{
              ...commonOptions,
              headerRight: () => renderStepperIndicator(RouteNames.UserAddress),
              headerTitle: () => renderStepper(RouteNames.UserAddress),
              headerTitleAlign: 'left',
            }}
          />
        ) : null}

        {canShowView(RouteNames.UserAvatar) ? (
          <Stack.Screen
            component={UserAvatar}
            key={onboardingViews?.totalViews}
            name={RouteNames.UserAvatar}
            options={{
              ...commonOptions,
              headerRight: () => renderStepperIndicator(RouteNames.UserAvatar),
              headerTitle: () => renderStepper(RouteNames.UserAvatar),
              headerTitleAlign: 'left',

            }}
          />
        ) : null}

        {/* Optional onboarding steps for players */}
        {canShowView(RouteNames.UserSport) ? (
          <Stack.Screen
            component={UserSport}
            key={onboardingViews?.totalViews}
            name={RouteNames.UserSport}
            options={{
              ...commonOptions,
              headerRight: () => renderStepperIndicator(RouteNames.UserSport),
              headerTitle: () => renderStepper(RouteNames.UserSport),
              headerTitleAlign: 'left',
            }}
          />
        ) : null}

        {canShowView(RouteNames.UserPosition) ? (
          <Stack.Screen
            component={UserPosition}
            key={onboardingViews?.totalViews}
            name={RouteNames.UserPosition}
            options={{
              ...commonOptions,
              headerRight: () => renderStepperIndicator(RouteNames.UserPosition),
              headerTitle: () => renderStepper(RouteNames.UserPosition),
              headerTitleAlign: 'left',
            }}
          />
        ) : null}

        {canShowView(RouteNames.UserPhysique) ? (
          <Stack.Screen
            component={UserPhysique}
            key={onboardingViews?.totalViews}
            name={RouteNames.UserPhysique}
            options={{
              ...commonOptions,
              headerRight: () => renderStepperIndicator(RouteNames.UserPhysique),
              headerTitle: () => renderStepper(RouteNames.UserPhysique),
              headerTitleAlign: 'left',
            }}
          />
        ) : null}

        {canShowView(RouteNames.UserLevel) ? (
          <Stack.Screen
            component={UserLevel}
            key={onboardingViews?.totalViews}
            name={RouteNames.UserLevel}
            options={{
              ...commonOptions,
              headerRight: () => renderStepperIndicator(RouteNames.UserLevel),
              headerTitle: () => renderStepper(RouteNames.UserLevel),
              headerTitleAlign: 'left',
            }}
          />
        ) : null}

        {canShowView(RouteNames.UserCategory) ? (
          <Stack.Screen
            component={UserCategory}
            key={onboardingViews?.totalViews}
            name={RouteNames.UserCategory}
            options={{
              ...commonOptions,
              headerRight: () => renderStepperIndicator(RouteNames.UserCategory),
              headerTitle: () => renderStepper(RouteNames.UserCategory),
              headerTitleAlign: 'left',
            }}
          />
        ) : null}

        {canShowView(RouteNames.UserSportHistory) ? (
          <Stack.Screen
            component={UserSportHistory}
            key={onboardingViews?.totalViews}
            name={RouteNames.UserSportHistory}
            options={{
              ...commonOptions,
              headerRight: () => renderStepperIndicator(RouteNames.UserSportHistory),
              headerTitle: () => renderStepper(RouteNames.UserSportHistory),
              headerTitleAlign: 'left',
            }}
          />
        ) : null}

        {canShowView(RouteNames.UserClubSearch) ? (
          <Stack.Screen
            component={UserClubSearch}
            key={onboardingViews?.totalViews}
            name={RouteNames.UserClubSearch}
            options={{
              ...commonOptions,
              headerRight: () => renderStepperIndicator(RouteNames.UserClubSearch),
              headerTitle: () => renderStepper(RouteNames.UserClubSearch),
              headerTitleAlign: 'left',
            }}
          />
        ) : null}

        {canShowView(RouteNames.UserAffiliationGuide) ? (
          <Stack.Screen
            component={UserAffiliationGuide}
            key={onboardingViews?.totalViews}
            name={RouteNames.UserAffiliationGuide}
            options={{
              ...commonOptions,
              headerRight: () => renderStepperIndicator(RouteNames.UserAffiliationGuide),
              headerTitle: () => renderStepper(RouteNames.UserAffiliationGuide),
              headerTitleAlign: 'left',
            }}
          />
        ) : null}

        {canShowView(RouteNames.Welcome) ? (
          <Stack.Screen
            component={Welcome}
            key={onboardingViews?.totalViews}
            name={RouteNames.Welcome}
            options={{
              ...commonOptions,
              headerRight: () => renderStepperIndicator(RouteNames.Welcome),
              headerTitle: () => renderStepper(RouteNames.Welcome),
              headerTitleAlign: 'left',

            }}
          />
        ) : null}

      </Stack.Navigator>
    </HistoryWizardProvider>
  ) : null;
}

export default PrivateNavigator;
