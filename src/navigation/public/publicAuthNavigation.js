import { RouteNames } from '@/navigation/routeNames';

/**
 * Build nested params for the standalone public auth stack.
 * T-PAGES-3b (18/11/2026) : l'écran du tunnel, la connexion par défaut ; l'inscription sur demande.
 * @param {Record<string, any>} [params]
 * @param {string} [screen] - L'écran ouvert (`RouteNames.Login` par défaut).
 * @returns {{ screen: string, params?: Record<string, any> }}
 */
export const buildPublicAuthStackParams = (params = {}, screen = RouteNames.Login) => ({
  params,
  screen,
});

/**
 * Open the standalone public auth flow from a nested navigator.
 * @param {any} navigation
 * @param {Record<string, any>} [params]
 * @param {string} [screen] - L'écran ouvert (`RouteNames.Login` par défaut).
 * @returns {boolean}
 */
export const openPublicAuthFlow = (navigation, params = {}, screen = RouteNames.Login) => {
  const targetParams = buildPublicAuthStackParams(params, screen);
  const parentNavigation = navigation?.getParent?.();

  if (typeof parentNavigation?.navigate === 'function') {
    parentNavigation.navigate(RouteNames.PublicAuthStack, targetParams);
    return true;
  }

  if (typeof navigation?.navigate === 'function') {
    navigation.navigate(RouteNames.PublicAuthStack, targetParams);
    return true;
  }

  return false;
};

export default openPublicAuthFlow;
