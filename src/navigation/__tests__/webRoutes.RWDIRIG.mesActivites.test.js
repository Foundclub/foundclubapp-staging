import { RouteNames } from '../routeNames';
import { createWebNavigationAdapter } from '../webNavigationAdapter';
import { MOBILE_ONLY_SCREENS } from '../webRouteExemptions';

// ==========================================================================
// RECETTE-WEB-DIRIGEANT (29/10) — « MES ACTIVITÉS » A ENFIN UNE ADRESSE SUR LE SITE.
//
// Sur le site, la carte « Mes activités » de l'accueil (dirigeant, entraîneur) ne faisait
// RIEN : l'écran était exempté « par séquencement » (TODO lot D35) et `buildWebPath`
// rendait « / », l'accueil où l'on était déjà. Feu vert du chef d'orchestre, 29/10.
// ==========================================================================

describe('RWDIRIG — « Mes activités » sur le site', () => {
  test('🔴 la carte de l accueil ouvre /search/activities', () => {
    const push = jest.fn();
    const adapter = createWebNavigationAdapter({
      currentPath: '/',
      currentRouteName: RouteNames.SearchHome,
      goBack: jest.fn(),
      params: {},
      push,
      replace: jest.fn(),
      setSearchParams: jest.fn(),
    });

    // Le geste de la carte (HomeHub.js) : navigation.navigate(RouteNames.MyActivities).
    adapter.navigate(RouteNames.MyActivities);

    expect(push).toHaveBeenCalledWith('/search/activities', undefined);
  });

  test('🔴 l écran n est plus exempté du site', () => {
    expect(Object.keys(MOBILE_ONLY_SCREENS)).not.toContain(RouteNames.MyActivities);
  });
});
