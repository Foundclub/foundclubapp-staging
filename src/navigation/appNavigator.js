import { NavigationContainer } from '@react-navigation/native';
import { Platform, StatusBar } from 'react-native';

import { readInviteLink } from '@/domains/invitations/inviteLink';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import TourBanner from '@/components/molecules/tour/TourBanner';

import { navigationRef } from '@/navigation/navigationService';
import PrivateNavigator from '@/navigation/private/PrivateNavigator';

import { createLogger } from '@/utils/logger/logger';

import PublicNavigator from './public/PublicMainNavigator';
import { RouteNames } from './routeNames';

const appNavigatorLogger = createLogger('app-navigator');

// LIENS-EVENEMENT (2026-09-15, decision Q2 = B d Adel) -- le lien d evenement partage
// ouvre l app si elle est installee, la page web sinon. UNE seule adresse :
// `https://foundclub.app/events/<id>` (shareLinks.js, buildPublicEventUrl), la meme
// route que le site (webRoutes.js). L alias la mene au meme ecran que foundclub://event/.
// ponytail: Android reclame tout /events/ (pathPrefix : pas d exclusion avant l API 31).
// Une page du site comme /events/mine y ouvre donc une fiche d identifiant « mine », en
// etat d erreur. Sortie : pathAdvancedPattern="/events/[^/]+" quand minSdkVersion >= 31.
// iOS, lui, exclut ces pages (apple-app-site-association du site).
// Temoin : src/navigation/__tests__/linking.routesAtteignables.test.js.
const EVENT_DETAILS_LINK = { alias: ['events/:eventId'], path: 'event/:eventId' };
const WEB_LINK_ORIGINS = ['https://foundclub.app', 'https://www.foundclub.app', 'https://staging.foundclub.app'];

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
      // Chaque lien doit viser un ecran que le navigateur du MODE COURANT porte
      // a sa racine, ou le declarer sous la pile qui l heberge : React Navigation
      // abandonne sans rien faire si une route du chemin n est pas dans les routes
      // racine (useLinking.native.tsx:189). Le meme motif ne peut pas etre declare
      // deux fois, d ou une forme PAR MODE ; le NavigationContainer est re-monte au
      // changement d auth (navigationContainerKey), la config est donc reevaluee.
      // NAVMORTE2 (2026-09-11) : en mode connecte, club/ visait Club a la racine
      // alors qu il ne vit que dans ClubStack -- le lien ne menait nulle part. En
      // mode public, event/, login et register visaient des routes absentes de
      // la racine publique, et superadmin/* une pile qui n y existe pas.
      // Temoin : src/navigation/__tests__/linking.routesAtteignables.test.js.
      screens: isPrivateMode
        ? {
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
          [RouteNames.ClubStack]: {
            screens: {
              [RouteNames.Club]: 'club/:clubId',
            },
          },
          [RouteNames.EventStack]: {
            screens: {
              [RouteNames.EventDetails]: EVENT_DETAILS_LINK,
            },
          },
          [RouteNames.SquadDetails]: 'squad/:teamId',
          [RouteNames.TeamStack]: {
            screens: {
              [RouteNames.TeamDetails]: 'team/:teamId',
            },
          },
        }
        : {
          [RouteNames.Club]: 'club/:clubId',
          [RouteNames.EventDetails]: EVENT_DETAILS_LINK,
          [RouteNames.PublicAuthStack]: {
            screens: {
              [RouteNames.Login]: 'login',
              [RouteNames.Register]: 'register',
            },
          },
          [RouteNames.SquadDetails]: 'squad/:teamId',
          [RouteNames.TeamDetails]: 'team/:teamId',
        },
    },
    // NAVMORTE2, relecture adverse (constat 3) -- une invitation n est PAS un lien de
    // navigation. La fenetre d invitation la lit aussi, et sa regle est « lire un lien ne
    // fait RIEN » (InvitationLinkHost.js:7-10) : l ecran ne s ouvre qu apres l appui.
    // readInviteLink est le seul juge (inviteLink.js:2) ; React Navigation ne prend que ce
    // qu il refuse. Sans ce filtre, foundclub://club/<id>?invite=true ouvrait la fiche
    // AVANT la reponse. Temoin : src/navigation/__tests__/linking.routesAtteignables.test.js.
    filter: (/** @type {string} */ url) => !readInviteLink(url).ok,
    prefixes: [
      'foundclub://',
      // LIENS-EVENEMENT : les liens https que le telephone confie a l app. Seuls les
      // chemins que l app RECLAME arrivent ici (AndroidManifest.xml, filtre autoVerify ;
      // apple-app-site-association du site) ; un chemin sans ecran ne fait rien.
      ...WEB_LINK_ORIGINS,
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
