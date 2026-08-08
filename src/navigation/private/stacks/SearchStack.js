/* eslint-disable global-require */
import { createStackNavigator } from '@react-navigation/stack';

import HomeHub from '@/views/home/HomeHub';

import { RouteNames } from '@/navigation/routeNames';

const Stack = createStackNavigator();

/**
 * Search stack embedded in the first tab to keep bottom tab bar visible.
 * @returns {import('react').ReactElement}
 */
function SearchStack() {
  return (
    <Stack.Navigator
      id={undefined}
      initialRouteName={RouteNames.SearchHome}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen
        component={HomeHub}
        name={RouteNames.SearchHome}
      />
      <Stack.Screen
        getComponent={() => require('@/views/search/SearchHubScreen').default}
        name={RouteNames.SearchHub}
      />
      <Stack.Screen
        getComponent={() => require('@/views/search/SearchHubRouteAlias').default}
        name={RouteNames.SearchEvents}
      />
      <Stack.Screen
        getComponent={() => require('@/views/search/SearchHubRouteAlias').default}
        name={RouteNames.SearchClubs}
      />
      <Stack.Screen
        getComponent={() => require('@/views/search/SearchHubRouteAlias').default}
        name={RouteNames.SearchReservations}
      />
      <Stack.Screen
        getComponent={() => require('@/views/search/SearchHubRouteAlias').default}
        name={RouteNames.SearchRecruitment}
      />
      <Stack.Screen
        getComponent={() => require('@/views/license/MyLicense').default}
        name={RouteNames.MyLicense}
      />
      <Stack.Screen
        getComponent={() => require('@/views/license/LicenseCheckoutStatus').default}
        name={RouteNames.LicenseCheckoutStatus}
      />
      <Stack.Screen
        getComponent={() => require('@/views/search/MyActivitiesScreen').default}
        name={RouteNames.MyActivities}
      />
    </Stack.Navigator>
  );
}

export default SearchStack;
