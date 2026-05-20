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
 * @param {(routeName: string | null) => void} [props.onStateChange]
 * @returns {import('react').ReactElement} AppNavigator component.
 */
function AppNavigator({ navigationIntegration, onReady, onStateChange }) {
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
        [RouteNames.AdminStack]: {
          screens: {
            [RouteNames.SuperAdminDashboard]: 'superadmin/dashboard',
            [RouteNames.SuperAdminHome]: 'superadmin',
            [RouteNames.SuperAdminLeagueDisputes]: 'superadmin/disputes',
            [RouteNames.SuperAdminLeagueDivisions]: 'superadmin/divisions',
            [RouteNames.SuperAdminLeagueMatches]: 'superadmin/matches',
            [RouteNames.SuperAdminLeagueSquads]: 'superadmin/squads',
            [RouteNames.SuperAdminSettings]: 'superadmin/settings',
          },
        },
        [RouteNames.Club]: 'club/:clubId',
        [RouteNames.EventStack]: {
          screens: {
            [RouteNames.EventDetails]: 'event/:eventId',
          },
        },
        [RouteNames.Login]: 'login',
        [RouteNames.Register]: 'register',
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
        onStateChange?.(navigationRef.getCurrentRoute()?.name || null);
      }}
      onStateChange={() => {
        onStateChange?.(navigationRef.getCurrentRoute()?.name || null);
      }}
      ref={navigationRef}
      theme={navigationTheme}
    >
      <StatusBar
        backgroundColor={scheme === 'dark' ? (Colors.primary900 || Colors.neutral900) : Colors.neutral00}
        barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
        translucent={false}
      />
      {auth?.token && !isAddingAccount ? <PrivateNavigator /> : <PublicNavigator />}
    </NavigationContainer>
  );
}

export default AppNavigator;
