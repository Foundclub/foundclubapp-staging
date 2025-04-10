import { createStackNavigator } from '@react-navigation/stack';

import Login from '@/views/Login';
import Register from '@/views/Register';

import { commonOptions } from '@/navigation/commonOptions';
import { RouteNames } from '@/navigation/routeNames';

const Stack = createStackNavigator();

/**
 * PublicNavigator component, with routes available for non authenticated users.
 * @returns {import('react').ReactElement} PublicNavigator component.
 */
function PublicNavigator() {
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

export default PublicNavigator;
