import { createStackNavigator } from '@react-navigation/stack';

import { useAppContext } from '@/store/appContext';

import ClubDetails from '@/views/club/ClubDetails';
import ClubFilters from '@/views/club/ClubFilters';
import EventDetails from '@/views/event/EventDetails';
import EventFilters from '@/views/event/EventFilters';
import RecruitmentAdDetails from '@/views/recruitment/RecruitmentAdDetails';
import RecruitmentAdFilters from '@/views/recruitment/RecruitmentAdFilters';
import ReservationDetails from '@/views/reservation/ReservationDetails';
import SearchMapScreen from '@/views/search/SearchMapScreen';
import TeamDetails from '@/views/team/TeamDetails';

import { commonOptions } from '@/navigation/commonOptions';
import { RouteNames } from '@/navigation/routeNames';

import AuthStackNavigator from './AuthStackNavigator';
import PublicTabNavigator from './PublicTabNavigator';

const Stack = createStackNavigator();

/**
 * PrivateNavigator component, with routes available for authenticated users.
 * Handles onboarding flow based on user data.
 * @returns {import('react').ReactElement | null} PrivateNavigator component.
 */
function PublicNavigator() {
  const [{ isAddingAccount }] = useAppContext();

  return (
    <Stack.Navigator
      id={undefined}
      initialRouteName={isAddingAccount ? RouteNames.PublicAuthStack : RouteNames.HomeTab}
      key={isAddingAccount ? 'public-add-account' : 'public-main'}
      screenOptions={commonOptions}
    >
      <Stack.Screen
        component={AuthStackNavigator}
        name={RouteNames.PublicAuthStack}
        options={{ headerShown: false }}
      />

      <Stack.Screen
        component={PublicTabNavigator}
        name={RouteNames.HomeTab}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        component={ClubFilters}
        name={RouteNames.ClubFilters}
        options={{
          ...commonOptions,
          headerTitle: '',
        }}
      />
      <Stack.Screen
        component={ClubDetails}
        name={RouteNames.Club}
        options={{
          ...commonOptions,
          headerTitle: '',
        }}
      />
      <Stack.Screen
        component={TeamDetails}
        name={RouteNames.TeamDetails}
        options={{
          ...commonOptions,
          headerTitle: '',
        }}
      />
      <Stack.Screen
        component={EventFilters}
        name={RouteNames.EventFilters}
        options={{
          ...commonOptions,
          headerTitle: '',
        }}
      />
      <Stack.Screen
        component={EventDetails}
        name={RouteNames.EventDetails}
        options={{
          ...commonOptions,
          headerTitle: '',
        }}
      />
      <Stack.Screen
        component={ReservationDetails}
        name={RouteNames.ReservationDetails}
        options={{
          ...commonOptions,
          headerTitle: '',
        }}
      />
      <Stack.Screen
        component={RecruitmentAdDetails}
        name={RouteNames.RecruitmentAdDetails}
        options={{
          ...commonOptions,
          headerTitle: '',
        }}
      />
      <Stack.Screen
        component={RecruitmentAdFilters}
        name={RouteNames.RecruitmentAdFilters}
        options={{
          ...commonOptions,
          headerTitle: '',
        }}
      />
      <Stack.Screen
        component={SearchMapScreen}
        name={RouteNames.SearchMapScreen}
        options={{ headerShown: false }}
      />

    </Stack.Navigator>
  );
}

export default PublicNavigator;
