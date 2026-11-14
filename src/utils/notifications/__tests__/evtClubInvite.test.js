/**
 * EVT-CLUB (14/11/2026, D121, Q11 B) — « Tout le club est invité » mène à la fiche de l'événement.
 * Jumeau serveur : admin/src/api/user-fcm-token/types/index.ts (EVENT_CLUB_INVITED = 'eventClubInvited'),
 * témoin admin tests/authz/EVTCLUB-2-tout-le-club-est-invite.test.js.
 */
import { RouteNames } from '@/navigation/routeNames';

import { resolveNotificationDestination } from '@/utils/notifications/notificationNavigation';
import { NOTIFICATION_TYPES } from '@/utils/notifications/notificationTypes';

describe('EVT-CLUB — notification « Tout le club est invité »', () => {
  test('le type existe, avec la même chaîne que le serveur', () => {
    expect(NOTIFICATION_TYPES.EVENT_CLUB_INVITED).toBe('eventClubInvited');
  });

  test('elle ouvre la fiche de l événement', () => {
    expect(resolveNotificationDestination({ eventId: 'evt-fete', type: 'eventClubInvited' })).toEqual({
      params: { params: { eventId: 'evt-fete' }, screen: RouteNames.EventDetails },
      route: RouteNames.EventStack,
    });
  });
});
