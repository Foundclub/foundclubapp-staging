import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'react-native';

import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import { navigationRef } from '@/navigation/navigationService';
import PrivateNavigator from '@/navigation/private/PrivateNavigator';

import { createLogger } from '@/utils/logger/logger';

import PublicNavigator from './public/PublicMainNavigator';
import { RouteNames } from './routeNames';

const appNavigatorLogger = createLogger('app-navigator');

/**
 * AppNavigator component.
 * @param {object} props - Props object.
 * @param {{registerNavigationContainer:
 * (containerRef: any) => void}} props.navigationIntegration - Sentry navigation integration.
 * @param {() => void} [props.onReady]
 * @returns {import('react').ReactElement} AppNavigator component.
 */
function AppNavigator({ navigationIntegration, onReady }) {
  // hooks
  const [{ auth, isAddingAccount }] = useAppContext();
  const { ApplicationStyle, Colors, scheme } = useTheme();
  appNavigatorLogger.debug('Rendering', { hasAuthToken: Boolean(auth?.token), isAddingAccount });

  const navigationTheme = scheme === 'dark'
    ? ApplicationStyle.darkNavigationTheme
    : ApplicationStyle.lightNavigationTheme;

  const linking = {
    config: {
      screens: {
        [RouteNames.Club]: 'club/:clubId',
        [RouteNames.EventStack]: {
          screens: {
            [RouteNames.EventDetails]: 'event/:eventId',
          },
        },
        [RouteNames.SquadDetails]: 'squad/:teamId',
        [RouteNames.TeamDetails]: 'team/:teamId',
      },
    },
    prefixes: [
      'foundclub://',
    ],
  };
  const navigationContainerKey = [
    auth?.token || 'no-token',
    isAddingAccount ? 'add-account' : 'main',
  ].join('-');

  return (
    <NavigationContainer
      key={navigationContainerKey}
      linking={linking}
      onReady={() => {
        navigationIntegration.registerNavigationContainer(navigationRef);
        onReady?.();
      }}
      ref={navigationRef}
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
