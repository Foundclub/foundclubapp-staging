import { createStackNavigator } from '@react-navigation/stack';

import Login from '@/views/Login';
import Register from '@/views/Register';

import ClubStack from '@/navigation/private/stacks/ClubStack';

import { commonOptions } from '../commonOptions';
import { RouteNames } from '../routeNames';

const Stack = createStackNavigator();

/**
 * AuthStackNavigator component, with routes available for non authenticated users.
 * @returns {import('react').ReactElement} AuthStackNavigator component.
 */
function AuthStackNavigator() {
  return (
    <Stack.Navigator id={undefined} screenOptions={commonOptions}>
      {/* Login et Register affichent deja le logo FoundClub dans le corps de
          page : on retire celui du header natif pour ne pas l'empiler deux fois
          (audit visuel 2026-07-19). Le header transparent reste monte pour la
          fleche retour et la marge haute. */}
      <Stack.Screen
        component={Login}
        name={RouteNames.Login}
        options={{ headerTitle: '' }}
      />
      <Stack.Screen
        component={Register}
        name={RouteNames.Register}
        options={{ headerTitle: '' }}
      />
      <Stack.Screen
        component={ClubStack}
        name={RouteNames.ClubStack}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

export default AuthStackNavigator;
