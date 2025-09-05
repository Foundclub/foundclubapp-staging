import { createStackNavigator } from '@react-navigation/stack';

import Login from '@/views/Login';
import Register from '@/views/Register';

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
      <Stack.Screen
        component={Login}
        name={RouteNames.Login}
      />
      <Stack.Screen
        component={Register}
        name={RouteNames.Register}
      />
    </Stack.Navigator>
  );
}

export default AuthStackNavigator;
