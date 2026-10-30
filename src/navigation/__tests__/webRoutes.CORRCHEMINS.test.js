import fs from 'fs';
import path from 'path';

import { resolveNotificationDestination } from '@/utils/notifications/notificationNavigation';

import { RouteNames } from '../routeNames';
import { MOBILE_ONLY_SCREENS, UNREGISTERED_WEB_PATTERNS } from '../webRouteExemptions';
import { buildWebPath, isWebRouteSupported, WEB_ROUTE_PATTERNS } from '../webRoutes';

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
    const parametres = destination?.params?.params || destination?.params;
    expect(buildWebPath(ecran, parametres)).toBe('/profile/parent');
  });
});

const VUES = path.join(__dirname, '..', '..', 'views', 'reservation');

describe('CORR-CHEMINS 50 : « modifier une réservation » et « joueurs recherchés » retirés', () => {
  test('ni nom de route, ni adresse, ni fichier', () => {
    expect(RouteNames.ReservationEdit).toBeUndefined();
    expect(Object.values(WEB_ROUTE_PATTERNS)).not.toContain('/reservations/:reservationId/edit');
    expect(fs.existsSync(path.join(VUES, 'ReservationEdit.web.js'))).toBe(false);
  });

  // Adel « 4- A » (30/10, 20:02) : « joueurs recherchés » retiré, comme ReservationEdit.
  test('« joueurs recherchés » : ni nom de route, ni adresse, ni exemption, ni fichier', () => {
    expect(RouteNames.MissingPlayersView).toBeUndefined();
    expect(Object.values(WEB_ROUTE_PATTERNS)).not.toContain('/booking/missing-players');
    expect(Object.keys(UNREGISTERED_WEB_PATTERNS)).not.toContain('MissingPlayersView');
    expect(fs.existsSync(path.join(VUES, 'MissingPlayersView.web.js'))).toBe(false);
  });
});
