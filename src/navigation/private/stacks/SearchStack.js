import { createStackNavigator } from '@react-navigation/stack';

import HomeHub from '@/views/home/HomeHub';
import SearchClubsScreen from '@/views/search/SearchClubsScreen';
import SearchEventsScreen from '@/views/search/SearchEventsScreen';
import SearchRecruitmentScreen from '@/views/search/SearchRecruitmentScreen';
import SearchReservationsScreen from '@/views/search/SearchReservationsScreen';

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
        component={SearchEventsScreen}
        name={RouteNames.SearchEvents}
      />
      <Stack.Screen
        component={SearchClubsScreen}
        name={RouteNames.SearchClubs}
      />
      <Stack.Screen
        component={SearchReservationsScreen}
        name={RouteNames.SearchReservations}
      />
      <Stack.Screen
        component={SearchRecruitmentScreen}
        name={RouteNames.SearchRecruitment}
      />
    </Stack.Navigator>
  );
}

export default SearchStack;
