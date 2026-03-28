import { buildWebPath } from './webRoutes';

const buildRouteState = (routeName, params = {}) => ({
  key: `${routeName}:${Date.now()}`,
  name: routeName,
  params,
});

export const createWebNavigationAdapter = ({
  currentPath = '/',
  currentRouteName,
  params = {},
  parentNavigation,
  push,
  replace,
  setSearchParams,
  goBack,
}) => {
  const adapter = {
    currentPath,
    currentRouteName,
    addListener: (_eventName, _listener) => {
      return () => {};
    },
    canGoBack: () => {
      if (typeof window === 'undefined') return false;
      return window.history.length > 1;
    },
    dispatch: (action) => {
      const type = action?.type;
      const payload = action?.payload || {};

      if (type === 'GO_BACK') {
        adapter.goBack();
        return;
      }

      if (type === 'REPLACE') {
        adapter.replace(payload.name, payload.params || {});
        return;
      }

      if (type === 'NAVIGATE') {
        adapter.navigate(payload.name, payload.params || {});
        return;
      }

      if (type === 'RESET') {
        const nextRoute = payload?.routes?.[payload?.index ?? 0];
        if (!nextRoute?.name) return;
        adapter.replace(nextRoute.name, nextRoute.params || {});
      }
    },
    getParent: () => parentNavigation || adapter,
    goBack: () => {
      if (typeof goBack === 'function') {
        goBack();
      }
    },
    isFocused: () => true,
    navigate: (routeName, nextParams = {}) => {
      if (typeof push !== 'function') {
        return;
      }
      push(buildWebPath(routeName, nextParams));
    },
    replace: (routeName, nextParams = {}) => {
      if (typeof replace !== 'function') {
        return;
      }
      replace(buildWebPath(routeName, nextParams));
    },
    route: buildRouteState(currentRouteName, params),
    setParams: (nextParams = {}) => {
      if (typeof setSearchParams !== 'function') {
        return;
      }
      const mergedParams = {
        ...params,
        ...nextParams,
      };
      setSearchParams(mergedParams);
    },
    setOptions: () => {},
  };

  return adapter;
};

export default createWebNavigationAdapter;
