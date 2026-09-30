import { RouteNames } from '@/navigation/routeNames';

import { resolveNotificationDestination } from '@/utils/notifications/notificationNavigation';
import { NOTIFICATION_TYPES } from '@/utils/notifications/notificationTypes';

/**
 * LOT ALERTES-ANNONCES (30/09) — « Ton alerte "Annonces · Football · Lyon" a
 * trouvé : Gardien · U17 A · FC Rhône ». L'appui doit ouvrir l'ANNONCE.
 *
 * 🪤 La charge est écrite par le serveur (`admin/.../search-alert/services/matcher.ts`,
 * `notifyMatch`) : `alertType: 'recruitment'` et l'annonce sous `recruitmentAdId`
 * (`TARGET_DATA_KEYS`, `admin/.../search-alert/types/filters.ts`). Rien ne relie les
 * deux côtés ; une charge inconnue retombe sur « Mes alertes ».
 */
const CHARGE_DU_SERVEUR = {
  alertId: 'al-1',
  alertType: 'recruitment',
  matchType: 'recruitment',
  recruitmentAdId: 'ad-1',
  type: 'searchAlertMatch',
};

describe('ALERTES-ANNONCES — une alerte d annonce ouvre l annonce', () => {
  test('l étiquette du serveur est connue de l app, au caractère près', () => {
    expect(NOTIFICATION_TYPES.SEARCH_ALERT_MATCH).toBe('searchAlertMatch');
  });

  test('l appui ouvre la fiche de l annonce, comme une notification de candidature', () => {
    const destination = /** @type {any} */ (resolveNotificationDestination(CHARGE_DU_SERVEUR));
    expect(destination?.route).toBe(RouteNames.RecruitmentAdDetails);
    expect(destination).toEqual(resolveNotificationDestination({
      adId: 'ad-1',
      type: NOTIFICATION_TYPES.RECRUITMENT_APPLICATION_STATUS,
    }));
  });

  test('LE TEMOIN : les alertes d événements et de profils mènent toujours au même endroit', () => {
    const evenement = /** @type {any} */ (resolveNotificationDestination({
      alertType: 'event', eventId: 'evt-1', type: 'searchAlertMatch',
    }));
    const profil = /** @type {any} */ (resolveNotificationDestination({
      alertType: 'mercato', profileId: 'prof-1', type: 'searchAlertMatch',
    }));
    expect(JSON.stringify(evenement)).toContain('evt-1');
    expect(JSON.stringify(profil)).toContain('prof-1');
    expect(evenement?.route).not.toBe(RouteNames.SearchAlerts);
    expect(profil?.route).not.toBe(RouteNames.SearchAlerts);
  });
});
