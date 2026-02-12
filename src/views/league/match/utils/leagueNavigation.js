import { RouteNames } from '@/navigation/routeNames';
import { getEntityDocumentId } from '@/utils/entityId';

const END_MATCH_ROUTE = 'EndMatchScreen';
const MATCH_DETAILS_ROUTE = RouteNames.LeagueMatchDetails;

export const navigateToLeagueMatchDetails = (navigation, matchOrMatchId) => {
  if (!navigation) return false;

  const matchId = getEntityDocumentId(matchOrMatchId);
  if (!matchId) return false;

  const params = { matchId };
  const currentRouteNames = navigation?.getState?.()?.routeNames || [];
  if (currentRouteNames.includes(MATCH_DETAILS_ROUTE)) {
    navigation.navigate(MATCH_DETAILS_ROUTE, params);
    return true;
  }

  const parentNavigation = navigation.getParent?.();
  const parentRouteNames = parentNavigation?.getState?.()?.routeNames || [];
  if (parentNavigation && parentRouteNames.includes(MATCH_DETAILS_ROUTE)) {
    parentNavigation.navigate(MATCH_DETAILS_ROUTE, params);
    return true;
  }

  if (parentNavigation) {
    parentNavigation.navigate(RouteNames.LeagueDashboard, {
      params,
      screen: MATCH_DETAILS_ROUTE,
    });
    return true;
  }

  navigation.navigate(RouteNames.LeagueHomeTab, {
    screen: RouteNames.LeagueDashboard,
    params: {
      params,
      screen: MATCH_DETAILS_ROUTE,
    },
  });
  return true;
};

export const navigateToEndMatchScreen = (navigation, matchOrMatchId) => {
  if (!navigation) return false;

  const matchId = getEntityDocumentId(matchOrMatchId);
  if (!matchId) return false;

  const params = { matchId };
  const currentRouteNames = navigation?.getState?.()?.routeNames || [];
  if (currentRouteNames.includes(END_MATCH_ROUTE)) {
    navigation.navigate(END_MATCH_ROUTE, params);
    return true;
  }

  const parentNavigation = navigation.getParent?.();
  const parentRouteNames = parentNavigation?.getState?.()?.routeNames || [];
  if (parentNavigation && parentRouteNames.includes(END_MATCH_ROUTE)) {
    parentNavigation.navigate(END_MATCH_ROUTE, params);
    return true;
  }

  if (parentNavigation) {
    parentNavigation.navigate(RouteNames.LeagueDashboard, {
      params,
      screen: END_MATCH_ROUTE,
    });
    return true;
  }

  navigation.navigate(RouteNames.LeagueHomeTab, {
    screen: RouteNames.LeagueDashboard,
    params: {
      params,
      screen: END_MATCH_ROUTE,
    },
  });
  return true;
};
