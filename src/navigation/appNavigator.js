import { NavigationContainer } from '@react-navigation/native';
import { useRef } from 'react';
import { StatusBar } from 'react-native';

import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import PrivateNavigator from '@/navigation/private/PrivateNavigator';

import PublicNavigator from './public/PublicMainNavigator';
import { RouteNames } from './routeNames';

/**
 * AppNavigator component.
 * @param {object} props - Props object.
 * @param {{registerNavigationContainer:
 * (containerRef: any) => void}} props.navigationIntegration - Sentry navigation integration.
 * @returns {import('react').ReactElement} AppNavigator component.
 */
function AppNavigator({ navigationIntegration }) {
  // hooks
  const [{ auth, isAddingAccount }] = useAppContext();
  const { ApplicationStyle, Colors, scheme } = useTheme();
  const containerRef = useRef(null);

  const navigationTheme = scheme === 'dark'
    ? ApplicationStyle.darkNavigationTheme
    : ApplicationStyle.lightNavigationTheme;

  const linking = {
    config: {
      screens: {
        [RouteNames.TeamDetails]: 'team/:teamId',
      },
    },
    prefixes: [
      'foundclub://',
    ],
  };

  return (
    <NavigationContainer
      key={auth?.token || 'no-token'}
      linking={linking}
      onReady={() => {
        navigationIntegration.registerNavigationContainer(containerRef);
      }}
      ref={containerRef}
      theme={navigationTheme}
    >
      <StatusBar
        backgroundColor={Colors.transparent}
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
        translucent
      />
      {auth?.token && !isAddingAccount ? <PrivateNavigator /> : <PublicNavigator />}
    </NavigationContainer>
  );
}

export default AppNavigator;
