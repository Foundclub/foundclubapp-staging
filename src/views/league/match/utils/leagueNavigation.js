import { RouteNames } from '@/navigation/routeNames';

import { getEntityDocumentId } from '@/utils/entityId';

const END_MATCH_ROUTE = RouteNames.EndMatchScreen;
const MATCH_DETAILS_ROUTE = RouteNames.LeagueMatchDetails;

/**
 * @param {any} navigation
 * @param {string} routeName
 * @returns {any}
 */
const findNavigatorWithRoute = (navigation, routeName) => {
  let cursor = navigation;
  while (cursor) {
    const routeNames = cursor?.getState?.()?.routeNames || [];
    if (routeNames.includes(routeName)) return cursor;
    cursor = cursor.getParent?.();
  }
  return null;
};

/**
 * @param {any} navigation
 * @param {string} routeName
 * @param {Record<string, unknown>} [params]
 * @returns {boolean}
 */
const safeNavigate = (navigation, routeName, params) => {
  const targetNavigator = findNavigatorWithRoute(navigation, routeName);
  if (!targetNavigator) return false;
  targetNavigator.navigate(routeName, params);
  return true;
};

/**
 * @param {any} navigation
 * @param {LeagueMatch | string} matchOrMatchId
 * @returns {boolean}
 */
export const navigateToLeagueMatchDetails = (navigation, matchOrMatchId) => {
  if (!navigation) return false;

  const matchId = getEntityDocumentId(matchOrMatchId);
  if (!matchId) return false;

  const params = { matchId };
  if (safeNavigate(navigation, MATCH_DETAILS_ROUTE, params)) {
    return true;
  }

  if (safeNavigate(navigation, RouteNames.LeagueDashboard, {
    params,
    screen: MATCH_DETAILS_ROUTE,
  })) {
    return true;
  }

  if (safeNavigate(navigation, RouteNames.LeagueHomeTab, {
    params: {
      params,
      screen: MATCH_DETAILS_ROUTE,
    },
    screen: RouteNames.LeagueDashboard,
  })) {
    return true;
  }

  return false;
};

/**
 * @param {any} navigation
 * @param {LeagueMatch | string} matchOrMatchId
 * @returns {boolean}
 */
/**
 * NAVMORTE (2026-09-11) -- ouvre un ecran de la pile LEAGUE d ou qu on soit.
 * Meme recette que navigateToLeagueMatchDetails : l ecran directement s il est a
 * portee (les ecrans montes DANS la pile LEAGUE ne changent pas de comportement),
 * sinon par le tableau de bord, sinon par l onglet LEAGUE. Sans elle, les ecrans
 * montes a la RACINE (LeagueMatchDetails, SquadDetails) appelaient la route en
 * direct et le bouton ne faisait RIEN.
 * @param {any} navigation
 * @param {string} routeName une route de LeagueNavigator
 * @param {Record<string, unknown>} [params]
 * @returns {boolean} vrai si un navigateur a pris l action
 */
export const navigateToLeagueStackScreen = (navigation, routeName, params) => {
  if (!navigation || !routeName) return false;

  if (safeNavigate(navigation, routeName, params)) {
    return true;
  }

  if (safeNavigate(navigation, RouteNames.LeagueDashboard, {
    params,
    screen: routeName,
  })) {
    return true;
  }

  return safeNavigate(navigation, RouteNames.LeagueHomeTab, {
    params: {
      params,
      screen: routeName,
    },
    screen: RouteNames.LeagueDashboard,
  });
};

/**
 * @param {any} navigation
 * @param {LeagueMatch | string} matchOrMatchId
 * @returns {boolean}
 */
export const navigateToEndMatchScreen = (navigation, matchOrMatchId) => {
  if (!navigation) return false;

  const matchId = getEntityDocumentId(matchOrMatchId);
  if (!matchId) return false;

  const params = { matchId };
  if (safeNavigate(navigation, END_MATCH_ROUTE, params)) {
    return true;
  }

  if (safeNavigate(navigation, RouteNames.LeagueDashboard, {
    params,
    screen: END_MATCH_ROUTE,
  })) {
    return true;
  }

  if (safeNavigate(navigation, RouteNames.LeagueHomeTab, {
    params: {
      params,
      screen: END_MATCH_ROUTE,
    },
    screen: RouteNames.LeagueDashboard,
  })) {
    return true;
  }

  return false;
};
