import { NavigationContainer } from '@react-navigation/native';
import { Platform, StatusBar } from 'react-native';

import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import TourBanner from '@/components/molecules/tour/TourBanner';

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
  const shouldAvoidDeprecatedSystemBarColors = Platform.OS === 'android'
    && typeof Platform.Version === 'number'
    && Platform.Version >= 35;
  const isPrivateMode = Boolean(auth?.token) && !isAddingAccount;

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
        // En mode connecte, TeamDetails est imbrique dans PrivateNavigator > TeamStack :
        // le mapping linking doit refleter cette hierarchie pour que foundclub://team/:teamId
        // resolve. En mode public, TeamDetails reste a la racine du navigateur.
        // Le meme pattern ne peut pas etre declare deux fois (React Navigation le rejette),
        // d'ou le mapping conditionnel ; le NavigationContainer est re-monte au changement
        // d'auth (via navigationContainerKey), la config est donc reevaluee.
        ...(isPrivateMode
          ? {
            [RouteNames.TeamStack]: {
              screens: {
                [RouteNames.TeamDetails]: 'team/:teamId',
              },
            },
          }
          : {
            [RouteNames.TeamDetails]: 'team/:teamId',
          }),
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
      {shouldAvoidDeprecatedSystemBarColors ? (
        <StatusBar
          barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
          translucent={false}
        />
      ) : (
        <StatusBar
          backgroundColor={scheme === 'dark' ? (Colors.primary900 || Colors.neutral900) : Colors.neutral00}
          barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'}
          translucent={false}
        />
      )}
      {isPrivateMode ? <PrivateNavigator /> : <PublicNavigator />}
      {isPrivateMode ? <TourBanner /> : null}
    </NavigationContainer>
  );
}

export default AppNavigator;
