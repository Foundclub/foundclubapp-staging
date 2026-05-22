import { buildWebPath } from './webRoutes';

const buildRouteState = (routeName, params = {}) => ({
  key: `${routeName}:${Date.now()}`,
  name: routeName,
  params,
});

export const createWebNavigationAdapter = ({
  currentPath = '/',
  currentRouteName,
  goBack,
  params = {},
  parentNavigation,
  push,
  replace,
  setSearchParams,
}) => {
  const resolveResetTarget = (resetState = {}) => {
    const nextRoute = resetState?.routes?.[resetState?.index ?? 0];
    if (!nextRoute?.name) return null;
    return {
      params: nextRoute.params || {},
      routeName: nextRoute.name,
    };
  };

  const adapter = {
    addListener: () => () => {},
    canGoBack: () => {
      if (typeof window === 'undefined') return false;
      return window.history.length > 1;
    },
    currentPath,
    currentRouteName,
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
        const resetTarget = resolveResetTarget(payload);
        if (!resetTarget) return;
        adapter.replace(resetTarget.routeName, resetTarget.params);
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
    push: (routeName, nextParams = {}) => {
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
    reset: (resetState = {}) => {
      const resetTarget = resolveResetTarget(resetState);
      if (!resetTarget) {
        return;
      }
      adapter.replace(resetTarget.routeName, resetTarget.params);
    },
    route: buildRouteState(currentRouteName, params),
    setOptions: () => {},
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
  };

  return adapter;
};

export default createWebNavigationAdapter;
