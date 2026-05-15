import { createNavigationContainerRef } from '@react-navigation/native';
import { Platform } from 'react-native';

import { buildWebPath } from './webRoutes';

export const navigationRef = createNavigationContainerRef();

let webNavigateHandler = null;
let webCurrentRouteNameResolver = null;

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
  navigationRef.navigate(name, params);
  return true;
};

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
