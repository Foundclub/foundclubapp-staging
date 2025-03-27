import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
// Navigators
import PublicNavigator from './public/publicNavigator';
import PrivateNavigator from './private/PrivateNavigator';
// hooks
import useTheme from '../theme/themeContext';
import { useAppContext } from '../store/appContext';

/**
 * AppNavigator component.
 * @returns {import('react').ReactElement} AppNavigator component.
 */
function AppNavigator() {
  // hooks
  const [{ auth }] = useAppContext();
  const { Colors, ApplicationStyle, scheme } = useTheme();

  const navigationTheme = scheme === 'dark'
    ? ApplicationStyle.darkNavigationTheme
    : ApplicationStyle.lightNavigationTheme;

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
        translucent
        backgroundColor={Colors.transparent}
      />
      {auth?.accessToken ? <PrivateNavigator /> : <PublicNavigator />}
    </NavigationContainer>
  );
}

export default AppNavigator;
