import { createStackNavigator } from '@react-navigation/stack';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Text, View } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { USER_ROLES } from '@/domains/auth/authUseCases';
import useTheme from '@/theme/themeContext';
import { useAppMode } from '@/context/AppModeContext';

import Stepper from '@/components/atoms/stepper/Stepper';
import MercatoFilters from '@/views/mercato/MercatoFilters';
import ReservationFilters from '@/views/reservation/ReservationFilters';
import MissingPlayersView from '@/views/reservation/MissingPlayersView';
import BookingCalendar from '@/views/booking/BookingCalendar';
import MultisportClubDetails from '@/views/multisportClub/MultisportClubDetails';
import MultisportClubEditDetails from '@/views/multisportClub/MultisportClubEditDetails';
import FeaturedRequestsScreen from '@/views/multisportClub/FeaturedRequestsScreen';
import CMDashboard from '@/views/multisportClub/CMDashboard';
import CMPlanningScreen from '@/views/multisportClub/CMPlanningScreen';
import CMMembersScreen from '@/views/multisportClub/CMMembersScreen';
import CMTeamsScreen from '@/views/multisportClub/CMTeamsScreen';
import CreateSectionScreen from '@/views/multisportClub/CreateSectionScreen';
import EventFilters from '@/views/event/EventFilters';
import SearchAlerts from '@/views/search/SearchAlerts';
import UserAddress from '@/views/onboarding/UserAddress';
import UserAvatar from '@/views/onboarding/UserAvatar';
import UserBirthdate from '@/views/onboarding/UserBirthdate';
import UserClubSearch from '@/views/onboarding/UserClubSearch';
import UserCategory from '@/views/onboarding/UserCategory';
import UserLevel from '@/views/onboarding/UserLevel';
import UserName from '@/views/onboarding/UserName';
import UserPhysique from '@/views/onboarding/UserPhysique';
import UserPosition from '@/views/onboarding/UserPosition';
import UserType from '@/views/onboarding/UserRole';
import UserSection from '@/views/onboarding/UserSection';
import UserSport from '@/views/onboarding/UserSport';
import UserSportHistory from '@/views/onboarding/UserSportHistory';
import Welcome from '@/views/onboarding/Welcome';
import Conversation from '@/views/Conversation';
import NotificationList from '@/views/notification/NotificationList';
import FacilityList from '@/views/facility/FacilityList';
import FacilityForm from '@/views/facility/FacilityForm';
import NewConversation from '@/views/NewConversation';
import AdWizardStack from './stacks/AdWizardStack';
import RecruitmentAdDetails from '@/views/recruitment/RecruitmentAdDetails';
import RecruitmentAdEdit from '@/views/recruitment/RecruitmentAdEdit';
import AddSponsor from '@/views/club/AddSponsor';

import { commonOptions } from '@/navigation/commonOptions';
import { RouteNames } from '@/navigation/routeNames';

import PrivateTabNavigator from './PrivateTabNavigator';
import AdminStack from './stacks/AdminStack';
import ClubStack from './stacks/ClubStack';
import EventStack from './stacks/EventStack';
import ProfileStack from './stacks/ProfileStack';
import TeamStack from './stacks/TeamStack';
import LeagueTabNavigator from './LeagueTabNavigator';

const Stack = createStackNavigator();

function PrivateNavigator() {
  const { Fonts, Spaces, Colors } = useTheme();
  const { onboardingViews, userData, userDataLoading, userDataError } = useAuth();
  const { isGold } = useAppMode();
  const { t } = useTranslation();

  const getStepNumber = (routeName) => onboardingViews?.views?.find((view) => view.route === routeName)?.index || 0;
  const getTotalSteps = () => onboardingViews?.totalViews || 0;
  const renderStepper = (routeName) => <Stepper currentStep={getStepNumber(routeName)} steps={getTotalSteps()} />;
  const renderStepperIndicator = (routeName) => (
    <View style={[Spaces.marginHorizontal[12]]}>
      <Text style={[Fonts.p2, Fonts.neutral300]}>{getStepNumber(routeName)}/{getTotalSteps()}</Text>
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

  const canShowHome = useMemo(() => !!(onboardingViews?.views?.filter(({ canShow }) => canShow)?.length || 0 <= 2), [onboardingViews]);
  
  const canShowView = useCallback((routeName) => {
    const view = onboardingViews?.views?.find((item) => item.route === routeName);
    const viewable = onboardingViews?.views?.filter(({ canShow }) => canShow)?.length || 0;
    return !!(view && viewable >= 1);
  }, [onboardingViews]);

  if (userDataLoading) {
    return (
      <View style={{ alignItems: 'center', backgroundColor: '#ffffff', flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.primary500 || '#000'} size="large" />
      </View>
    );
  }

  if (userDataError) {
    return (
      <View style={{ alignItems: 'center', backgroundColor: '#ffffff', flex: 1, justifyContent: 'center', padding: 20 }}>
        <Text style={{ color: 'red' }}>Erreur de connexion</Text>
      </View>
    );
  }

  return userData?.documentId ? (
    <Stack.Navigator id={undefined} initialRouteName={initialRouteName} key={userData?.documentId} screenOptions={commonOptions}>
      {canShowHome ? (
        isGold ? (
           <Stack.Screen
            component={LeagueTabNavigator}
            name={RouteNames.LeagueHomeTab}
            options={{ headerShown: false }}
          />
        ) : (
          <Stack.Screen
            component={PrivateTabNavigator}
            name={RouteNames.HomeTab}
            options={{ headerShown: false }}
          />
        )
      ) : null}


      {/* Domain Stacks - These contain the refactored screens */}
      {/* Note: We use headerShown: false because the stacks manage their own headers */}
      
      <Stack.Screen
        component={ProfileStack}
        name="ProfileStack"
        options={{ headerShown: false }}
      />
      
      <Stack.Screen
        component={ClubStack}
        name="ClubStack"
        options={{ headerShown: false }}
      />
      
      <Stack.Screen
        component={TeamStack}
        name="TeamStack"
        options={{ headerShown: false }}
      />
      
      <Stack.Screen
        component={EventStack}
        name="EventStack"
        options={{ headerShown: false }}
      />
      
      {userData?.role?.name === USER_ROLES.superAdmin ? (
        <Stack.Screen
          component={AdminStack}
          name="AdminStack"
          options={{ headerShown: false }}
        />
      ) : null}

      {/* Remaining Screens (Filters, Chat, Alerts, Notifications) */}
      <Stack.Screen
        component={EventFilters}
        name={RouteNames.EventFilters}
        options={{
          ...commonOptions,
          headerTitle: '',
        }}
      />
      <Stack.Screen
        component={MercatoFilters}
        name={RouteNames.MercatoFilters}
        options={{
          ...commonOptions,
          headerTitle: '',
        }}
      />
      <Stack.Screen
        component={AdWizardStack}
        name="AdWizardStack"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={ReservationFilters}
        name={RouteNames.ReservationFilters}
        options={{
          ...commonOptions,
          headerTitle: '',
        }}
      />
      <Stack.Screen
        component={MissingPlayersView}
        name={RouteNames.MissingPlayersView}
        options={{
          ...commonOptions,
          headerTitle: 'Joueurs recherchés',
        }}
      />
      <Stack.Screen
        component={BookingCalendar}
        name={RouteNames.BookingCalendar}
        options={{
          ...commonOptions,
          headerTitle: 'Réserver un créneau',
        }}
      />
      <Stack.Screen
        component={MultisportClubDetails}
        name={RouteNames.MultisportClubDetails}
        options={{
          ...commonOptions,
          headerTitle: 'Club Omnisport',
        }}
      />
      <Stack.Screen
        component={MultisportClubEditDetails}
        name={RouteNames.MultisportClubEdit}
        options={{
          ...commonOptions,
          headerTitle: 'Modifier le club',
        }}
      />
      <Stack.Screen
        component={FeaturedRequestsScreen}
        name={RouteNames.FeaturedRequests}
        options={{
          ...commonOptions,
          headerTitle: 'Demandes à la une',
        }}
      />
      <Stack.Screen
        component={CMDashboard}
        name="CMDashboard"
        options={{
          ...commonOptions,
          headerTitle: 'Gestion CM',
        }}
      />
      <Stack.Screen
        component={CMPlanningScreen}
        name={RouteNames.CMPlanning}
        options={{
          ...commonOptions,
          headerTitle: 'Planning',
        }}
      />
      <Stack.Screen
        component={AddSponsor}
        name={RouteNames.AddSponsor}
        options={{
          ...commonOptions,
          headerTitle: 'Ajouter un partenaire',
        }}
      />
      <Stack.Screen
        component={CMMembersScreen}
        name={RouteNames.CMMembers}
        options={{
          ...commonOptions,
          headerTitle: 'Membres',
        }}
      />
      <Stack.Screen
        component={CMTeamsScreen}
        name={RouteNames.CMTeams}
        options={{
          headerShown: true,
          title: t('common.teams'),
        }}
      />
      <Stack.Screen
        component={CreateSectionScreen}
        name={RouteNames.CreateSection}
        options={{
          ...commonOptions,
          headerTitle: 'Nouvelle section',
        }}
      />
      <Stack.Screen
        component={SearchAlerts}
        name={RouteNames.SearchAlerts}
        options={{
          ...commonOptions,
          headerTitle: '',
        }}
      />
      <Stack.Screen
        component={Conversation}
        name={RouteNames.Conversation}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        component={NewConversation}
        name="NewConversation"
        options={{
          ...commonOptions,
          headerShown: false,
        }}
      />
      <Stack.Screen
        component={NotificationList}
        name={RouteNames.NotificationList}
        options={{
          ...commonOptions,
          headerTitle: 'Notifications',
        }}
      />

      <Stack.Screen
        component={FacilityList}
        name={RouteNames.FacilityList}
        options={{
          ...commonOptions,
          headerTitle: 'Installations',
        }}
      />
      <Stack.Screen
        component={RecruitmentAdDetails}
        name={RouteNames.RecruitmentAdDetails}
        options={{
          ...commonOptions,
          headerTitle: '',
          headerTransparent: true,
          headerTintColor: '#fff',
        }}
      />
      <Stack.Screen
        component={RecruitmentAdEdit}
        name={RouteNames.RecruitmentAdEdit}
        options={{
          ...commonOptions,
          headerTitle: 'Modifier l\'annonce',
        }}
      />
      <Stack.Screen
        component={FacilityForm}
        name={RouteNames.FacilityForm}
        options={{
          ...commonOptions,
          headerTitle: '',
        }}
      />

      {/* League Screens */}
      <Stack.Screen
        component={require('@/views/league/match/LeagueMatchDetails').default}
        name={RouteNames.MatchDetails}
        options={{
          ...commonOptions,
          headerTitle: 'Détails du match',
        }}
      />
      <Stack.Screen
        component={require('@/views/league/match/LeagueMatchDetails').default}
        name={RouteNames.LeagueMatchDetails}
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
  ) : null;
}

export default PrivateNavigator;
