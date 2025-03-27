import { createStackNavigator } from '@react-navigation/stack';
// utils
import { RouteNames } from '../routeNames';
import { commonOptions } from '../commonOptions';
// screens
import Home from '../../views/EXAMPLE-Home';

const Stack = createStackNavigator();

/**
 * PrivateNavigator component, with routes available for authenticated users.
 * @returns {import('react').ReactElement} PrivateNavigator component.
 */
function PrivateNavigator() {
  return (
    <Stack.Navigator
      id={undefined}
      screenOptions={commonOptions}
      initialRouteName={RouteNames.Home}
    >
      <Stack.Screen
        name={RouteNames.Home}
        component={Home}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}

export default PrivateNavigator;
