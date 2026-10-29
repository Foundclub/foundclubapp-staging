import { RouteNames } from '../routeNames';
import { MOBILE_ONLY_SCREENS } from '../webRouteExemptions';
import { buildWebPath, isWebRouteSupported } from '../webRoutes';

// RW-PARENT e1 (29/10, Adel « 5- A ») — « Relier le compte de mon enfant » existe sur le site,
// comme dans l'app, et l'adresse ne porte que l'identifiant de la fiche, jamais le prénom.
describe('RW-PARENT e1 : route du lien parent sur le site', () => {
  test('ParentLinkInvite a une adresse et n est plus exempté', () => {
    expect(isWebRouteSupported(RouteNames.ParentLinkInvite)).toBe(true);
    expect(MOBILE_ONLY_SCREENS[RouteNames.ParentLinkInvite]).toBeUndefined();
  });

  test('l adresse ne garde que l identifiant de la fiche', () => {
    expect(buildWebPath(RouteNames.ParentLinkInvite, { childDocumentId: 'enfant-1' }))
      .toBe('/profile/children/link?childDocumentId=enfant-1');
    expect(buildWebPath(RouteNames.ParentLinkInvite)).toBe('/profile/children/link');
  });
});
