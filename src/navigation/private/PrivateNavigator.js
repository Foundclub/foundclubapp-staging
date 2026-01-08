import { createStackNavigator } from '@react-navigation/stack';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Stepper from '@/components/atoms/stepper/Stepper';
import MercatoFilters from '@/views/mercato/MercatoFilters';
import ReservationFilters from '@/views/reservation/ReservationFilters';
import MissingPlayersView from '@/views/reservation/MissingPlayersView';
import BookingCalendar from '@/views/booking/BookingCalendar';
import MultisportClubDetails from '@/views/multisportClub/MultisportClubDetails';
import FeaturedRequestsScreen from '@/views/multisportClub/FeaturedRequestsScreen';
import CMDashboard from '@/views/multisportClub/CMDashboard';
import CMPlanningScreen from '@/views/multisportClub/CMPlanningScreen';
import CMMembersScreen from '@/views/multisportClub/CMMembersScreen';
import CMTeamsScreen from '@/views/multisportClub/CMTeamsScreen';
import CreateSectionScreen from '@/views/multisportClub/CreateSectionScreen';
import EventFilters from '@/views/event/EventFilters';
import SearchAlerts from '@/views/search/SearchAlerts';
import UserAvatar from '@/views/onboarding/UserAvatar';
import UserBirthdate from '@/views/onboarding/UserBirthdate';
import UserClubSearch from '@/views/onboarding/UserClubSearch';
import UserLevel from '@/views/onboarding/UserLevel';
import UserName from '@/views/onboarding/UserName';
import UserPhysique from '@/views/onboarding/UserPhysique';
import UserPosition from '@/views/onboarding/UserPosition';
import UserType from '@/views/onboarding/UserRole';
import UserSection from '@/views/onboarding/UserSection';
import UserSport from '@/views/onboarding/UserSport';
import Welcome from '@/views/onboarding/Welcome';
import Conversation from '@/views/Conversation';
import NotificationList from '@/views/notification/NotificationList';
import FacilityList from '@/views/facility/FacilityList';
import FacilityForm from '@/views/facility/FacilityForm';

import { commonOptions } from '@/navigation/commonOptions';
import { RouteNames } from '@/navigation/routeNames';

import PrivateTabNavigator from './PrivateTabNavigator';
import AdminStack from './stacks/AdminStack';
import ClubStack from './stacks/ClubStack';
import EventStack from './stacks/EventStack';
import ProfileStack from './stacks/ProfileStack';
import TeamStack from './stacks/TeamStack';

const Stack = createStackNavigator();

/**
 * PrivateNavigator component, with routes available for authenticated users.
 * Handles onboarding flow based on user data.
 * @returns {import('react').ReactElement | null} PrivateNavigator component.
 */
function PrivateNavigator() {
  // hooks
  const { Fonts, Spaces } = useTheme();
  const { onboardingViews, userData } = useAuth();
  const { t } = useTranslation();

  // methods
  /**
   * Get the step number based on the current route name.
   * @param {string} routeName
   * @returns {number} Step number
   */
  const getStepNumber = (routeName) => onboardingViews?.views?.find(
    (view) => view.route === routeName,
  )?.index || 0;

  /**
   * Get the total number of steps in the onboarding process.
   * @returns {number} Total steps
   */
  const getTotalSteps = () => onboardingViews?.totalViews || 0;

  // renderers
  /**
   * Render the stepper component.
   * @param {string} routeName
   * @returns {import('react').ReactElement}
   */
  const renderStepper = (routeName) => (
    <Stepper currentStep={getStepNumber(routeName)} steps={getTotalSteps()} />
  );

  /**
   * Render the stepper indicator.
   * @param {string} routeName
   * @returns {import('react').ReactElement}
   */
  const renderStepperIndicator = (routeName) => (
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
      if (view.index < acc.index && view.canShow) {
        return view;
      }
      return acc;
    }, { index: 100, route: '' })?.route;
    return route || RouteNames.HomeTab;
  }, [onboardingViews]);

  const canShowHome = useMemo(() => !!(onboardingViews?.views
    ?.filter(({ canShow }) => canShow)?.length || 0 <= 2), [onboardingViews]);

  const canShowView = useCallback((/** @type {string} */routeName) => {
    // console.log('canShowView', routeName, onboardingViews);
    const view = onboardingViews?.views?.find((item) => item.route === routeName);
    const viewable = onboardingViews?.views?.filter(({ canShow }) => canShow)?.length || 0;
    return !!(view && viewable >= 1);
  }, [onboardingViews]);

  return userData?.documentId ? (
    <Stack.Navigator
      id={undefined}
      initialRouteName={initialRouteName}
      key={userData?.documentId}
      screenOptions={commonOptions}
    >
      {canShowHome ? (
        <Stack.Screen
          component={PrivateTabNavigator}
          name={RouteNames.HomeTab}
          options={{ headerShown: false }}
        />
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
      
      <Stack.Screen
        component={AdminStack}
        name="AdminStack"
        options={{ headerShown: false }}
      />

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
          ...commonOptions,
          headerTitle: '',
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
        component={FacilityForm}
        name={RouteNames.FacilityForm}
        options={{
          ...commonOptions,
          headerTitle: '',
        }}
      />

      {/* Onboarding Flow */}
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
