import fs from 'fs';
import path from 'path';

import { RouteNames } from '../routeNames';
import { MOBILE_ONLY_SCREENS } from '../webRouteExemptions';
import { buildWebPath, isWebRouteSupported, WEB_ROUTE_PATTERNS } from '../webRoutes';
import { resolveNotificationDestination } from '@/utils/notifications/notificationNavigation';

// CORR-CHEMINS (30/10, recette du site, décisions d'Adel).
describe('CORR-CHEMINS 40 : « Mon parent » existe sur le site', () => {
  test('MyParentLink a son adresse et n est plus exempté', () => {
    expect(isWebRouteSupported(RouteNames.MyParentLink)).toBe(true);
    expect(buildWebPath(RouteNames.MyParentLink)).toBe('/profile/parent');
    expect(MOBILE_ONLY_SCREENS[RouteNames.MyParentLink]).toBeUndefined();
  });

  test('la notification « Demande de lien parent » mène à /profile/parent sur le site', () => {
    const destination = resolveNotificationDestination({ type: 'parentLinkRequest' });
    const ecran = destination?.params?.screen || destination?.route;
    expect(buildWebPath(ecran, destination?.params?.params || destination?.params)).toBe('/profile/parent');
  });
});

describe('CORR-CHEMINS 50 : « modifier une réservation » est retiré du code', () => {
  test('ni nom de route, ni adresse, ni fichier', () => {
    expect(RouteNames.ReservationEdit).toBeUndefined();
    expect(Object.values(WEB_ROUTE_PATTERNS)).not.toContain('/reservations/:reservationId/edit');
    expect(fs.existsSync(path.join(__dirname, '..', '..', 'views', 'reservation', 'ReservationEdit.web.js'))).toBe(false);
  });
});
