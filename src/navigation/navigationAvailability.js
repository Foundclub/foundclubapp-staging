export const hasRouteInNavigationTree = (navigation, routeName) => {
  let currentNavigation = navigation;

  while (currentNavigation) {
    const routeNames = currentNavigation.getState?.()?.routeNames;
    if (Array.isArray(routeNames) && routeNames.includes(routeName)) {
      return true;
    }

    currentNavigation = currentNavigation.getParent?.();
  }

  return false;
};

export const navigateToStackScreenOrScreen = (navigation, {
  params,
  screen,
  stack,
}) => {
  if (stack && hasRouteInNavigationTree(navigation, stack)) {
    navigation.navigate(stack, {
      params,
      screen,
    });
    return;
  }

  navigation.navigate(screen, params);
};
