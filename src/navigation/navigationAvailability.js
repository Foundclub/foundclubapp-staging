export const hasRouteInNavigationTree = (navigation, routeName) => {
  let currentNavigation = navigation;
  // RECHERCHE-UNIQUE (25/09) : sur le site, l'adaptateur web se rend LUI-MEME comme
  // parent (webNavigationAdapter.js, getParent). Sans ce registre, la remontee
  // tournait sans fin et un appui sur une carte de club figeait l'onglet.
  const dejaVus = new Set();

  while (currentNavigation && !dejaVus.has(currentNavigation)) {
    dejaVus.add(currentNavigation);
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
