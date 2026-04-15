/* eslint-disable global-require */
import { createStackNavigator } from '@react-navigation/stack';

import HomeHub from '@/views/home/HomeHub';

import { RouteNames } from '@/navigation/routeNames';

const Stack = createStackNavigator();
const SEARCH_STACK_HOME = 'SearchHome';

/**
 * Search stack embedded in the first tab to keep bottom tab bar visible.
 * @returns {import('react').ReactElement}
 */
function SearchStack() {
  return (
    <Stack.Navigator
      id={undefined}
      initialRouteName={SEARCH_STACK_HOME}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen
        component={HomeHub}
        name={SEARCH_STACK_HOME}
      />
      <Stack.Screen
        getComponent={() => require('@/views/search/SearchEventsScreen').default}
        name={RouteNames.SearchEvents}
      />
      <Stack.Screen
        getComponent={() => require('@/views/search/SearchClubsScreen').default}
        name={RouteNames.SearchClubs}
      />
      <Stack.Screen
        getComponent={() => require('@/views/search/SearchReservationsScreen').default}
        name={RouteNames.SearchReservations}
      />
      <Stack.Screen
        getComponent={() => require('@/views/search/SearchRecruitmentScreen').default}
        name={RouteNames.SearchRecruitment}
      />
    </Stack.Navigator>
  );
}

export default SearchStack;
