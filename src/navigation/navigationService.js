import { createNavigationContainerRef } from '@react-navigation/native';
import { Platform } from 'react-native';

import { buildWebPath } from './webRoutes';

export const navigationRef = createNavigationContainerRef();

/**
 * @typedef {(name: string, params?: Record<string, unknown>) => void} WebNavigateHandler
 * @typedef {() => (string | null | undefined)} WebCurrentRouteNameResolver
 * @typedef {{ name?: string, state?: NavigationStateLike | null } | null} NavigationRouteLike
 * @typedef {{ index?: number, routes?: NavigationRouteLike[] } | null} NavigationStateLike
 */

let webNavigateHandler = /** @type {WebNavigateHandler | null} */ (null);
let webCurrentRouteNameResolver = /** @type {WebCurrentRouteNameResolver | null} */ (null);

/**
 * @param {{ navigate?: WebNavigateHandler, getCurrentRouteName?: WebCurrentRouteNameResolver }} [handlers]
 * @returns {() => void}
 */
export const registerWebNavigationHandlers = (handlers = {}) => {
  webNavigateHandler = typeof handlers.navigate === 'function' ? handlers.navigate : null;
  webCurrentRouteNameResolver = typeof handlers.getCurrentRouteName === 'function'
    ? handlers.getCurrentRouteName
    : null;

  return () => {
    webNavigateHandler = null;
    webCurrentRouteNameResolver = null;
  };
};

/**
 * @param {string} name
 * @param {Record<string, unknown>} [params]
 * @returns {boolean}
 */
export const navigate = (name, params) => {
  if (Platform.OS === 'web') {
    if (typeof webNavigateHandler === 'function') {
      webNavigateHandler(name, params || {});
      return true;
    }

    if (typeof window !== 'undefined') {
      window.location.assign(buildWebPath(name, params || {}));
      return true;
    }

    return false;
  }

  if (!navigationRef.isReady()) return false;
  /** @type {any} */ (navigationRef).navigate(name, params);
  return true;
};

/**
 * @returns {string | null}
 */
export const getCurrentRouteName = () => {
  if (Platform.OS === 'web') {
    if (typeof webCurrentRouteNameResolver === 'function') {
      return webCurrentRouteNameResolver() || null;
    }
    return null;
  }

  if (!navigationRef.isReady()) return null;
  return navigationRef.getCurrentRoute()?.name || null;
};

/**
 * @param {NavigationStateLike | undefined} state
 * @param {string[]} [trail]
 * @returns {string[]}
 */
const collectActiveRouteTrail = (state, trail = []) => {
  if (!state || !Array.isArray(state.routes) || state.routes.length === 0) {
    return trail;
  }

  const activeIndex = Number.isInteger(state.index) ? state.index : 0;
  const activeRoute = state.routes[activeIndex] || state.routes[0];
  if (!activeRoute) {
    return trail;
  }

  const nextTrail = activeRoute?.name ? [...trail, activeRoute.name] : trail;
  if (activeRoute.state) {
    return collectActiveRouteTrail(activeRoute.state, nextTrail);
  }

  return nextTrail;
};

/**
 * @returns {string[]}
 */
export const getCurrentRouteTrail = () => {
  if (Platform.OS === 'web') {
    const currentRouteName = typeof webCurrentRouteNameResolver === 'function'
      ? webCurrentRouteNameResolver()
      : null;
    return currentRouteName ? [currentRouteName] : [];
  }

  if (!navigationRef.isReady()) return [];
  return collectActiveRouteTrail(/** @type {any} */ (navigationRef).getRootState?.());
};
