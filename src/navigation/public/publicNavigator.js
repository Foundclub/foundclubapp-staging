import { createStackNavigator } from '@react-navigation/stack';
// constants
import { RouteNames } from '../routeNames';
import { commonOptions } from '../commonOptions';
// components
import Login from '../../views/EXAMPLE-Login';

const Stack = createStackNavigator();

/**
 * PublicNavigator component, with routes available for non authenticated users.
 * @returns {import('react').ReactElement} PublicNavigator component.
 */
function PublicNavigator() {
  return (
    <Stack.Navigator screenOptions={commonOptions} id={undefined}>
      <Stack.Screen
        name={RouteNames.Login}
        component={Login}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

export default PublicNavigator;
