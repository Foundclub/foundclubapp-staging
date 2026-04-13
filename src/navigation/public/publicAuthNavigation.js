import { RouteNames } from '@/navigation/routeNames';

/**
 * Build nested params for the standalone public auth stack.
 * @param {Record<string, any>} [params]
 * @returns {{ screen: string, params?: Record<string, any> }}
 */
export const buildPublicAuthStackParams = (params = {}) => ({
  params,
  screen: RouteNames.Login,
});

/**
 * Open the standalone public auth flow from a nested navigator.
 * @param {any} navigation
 * @param {Record<string, any>} [params]
 * @returns {boolean}
 */
export const openPublicAuthFlow = (navigation, params = {}) => {
  const targetParams = buildPublicAuthStackParams(params);
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
