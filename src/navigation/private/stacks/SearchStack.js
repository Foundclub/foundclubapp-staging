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
      {/*
        S9, vague S — la LISTE et l ARCHIVE vivent aussi ici, dans l onglet :
        ce sont des ecrans de CONSULTATION, le dock y reste (D5).
        ⛔ Le DETAIL n y est PAS : il doit remonter a la pile racine pour que le
        dock s efface pendant la tache.
      */}
      <Stack.Screen
        getComponent={() => require('@/views/license/MyLicenses').default}
        name={RouteNames.MyLicenses}
      />
      <Stack.Screen
        getComponent={() => require('@/views/license/MyLicensesArchive').default}
        name={RouteNames.MyLicensesArchive}
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
