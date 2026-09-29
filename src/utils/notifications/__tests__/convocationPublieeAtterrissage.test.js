import { RouteNames } from '@/navigation/routeNames';

import { resolveNotificationDestination } from '@/utils/notifications/notificationNavigation';
import { NOTIFICATION_TYPES } from '@/utils/notifications/notificationTypes';

/**
 * LOT CONVOC-NOTIFS2 (29/09) — « Composition d'équipes publiée » : chacun sur SON
 * écran. Témoin de CONTRAT, pas de correction : l'app ne change pas.
 *
 * 🧾 Le serveur (admin `event/services/notification.ts`,
 * `sendNotificationEventConvocationPublished`, témoin jumeau
 * `admin/tests/authz/CONVOCNOTIF2-ou-mene-la-convocation.test.js`) pose désormais
 * un `ctaRoute` PAR DESTINATAIRE. Et l'app suit ce `ctaRoute` AVANT son propre
 * aiguillage par type : c'est donc la charge du serveur, telle qu'elle arrive par
 * FCM (des chaînes), qui décide de l'écran. Ce témoin la rejoue.
 */
const charge = (ctaParams) => ({
  ctaParams: JSON.stringify(ctaParams),
  ctaRoute: 'EventStack',
  eventId: 'evt-1',
  teamId: 'team-7',
  type: NOTIFICATION_TYPES.EVENT_CONVOCATION_PUBLISHED,
});

describe('CONVOC-NOTIFS2 — la convocation publiée ouvre l écran de chacun', () => {
  test('un joueur convoqué atterrit sur « Tu es convoqué », avec le match et l équipe', () => {
    expect(resolveNotificationDestination(charge({
      params: { eventId: 'evt-1', teamId: 'team-7' },
      screen: 'PlayerConvocation',
    }))).toEqual({
      params: {
        params: { eventId: 'evt-1', teamId: 'team-7' },
        screen: RouteNames.PlayerConvocation,
      },
      route: RouteNames.EventStack,
    });
  });

  test('le staff et l organisateur atterrissent sur la fiche du match', () => {
    expect(resolveNotificationDestination(charge({
      params: { eventId: 'evt-1' },
      screen: 'EventDetails',
    }))).toEqual({
      params: {
        params: { eventId: 'evt-1' },
        screen: RouteNames.EventDetails,
      },
      route: RouteNames.EventStack,
    });
  });

  test('🪤 le nom d écran écrit par le serveur est bien celui de l app', () => {
    // Le serveur écrit la chaîne en dur : si l'app renommait l'écran, l'appui
    // ne mènerait plus nulle part, sans erreur.
    expect(RouteNames.PlayerConvocation).toBe('PlayerConvocation');
    expect(RouteNames.EventDetails).toBe('EventDetails');
    expect(RouteNames.EventStack).toBe('EventStack');
  });
});
