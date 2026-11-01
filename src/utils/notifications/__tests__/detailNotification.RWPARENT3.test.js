import { RouteNames } from '@/navigation/routeNames';
import { buildWebPath } from '@/navigation/webRoutes';
import { resolveNotificationDestination } from '@/utils/notifications/notificationNavigation';

// RW-PARENT passe 3 (30/10) — « Réponse du club » (clubInterestResponse sans fil) ouvrait sur le
// site l'adresse littérale /notifications/:notificationId, puis « Notification introuvable » :
// le détail recevait la notification en objet, jamais son identifiant au premier niveau.
describe('RW-PARENT3 : le détail d une notification a son adresse sur le site', () => {
  test('clubInterestResponse sans fil porte notificationId', () => {
    const destination = resolveNotificationDestination({
      // REPRISE-MESSAGERIE p63 (01/11) : la réponse POUR UN ENFANT mène désormais à « Mes enfants »
      // (reponseInteretAtterrissage.test.js) ; ici, une réponse du club à un adulte.
      body: 'Merci pour ton intérêt, on revient vers toi.',
      notificationId: 'notif-42',
      title: 'Réponse du club',
      type: 'clubInterestResponse',
    });
    expect(destination?.route).toBe(RouteNames.NotificationDetails);
    expect(destination?.params?.notificationId).toBe('notif-42');
    expect(buildWebPath(destination.route, destination.params)).toMatch(/^\/notifications\/notif-42(\?|$)/);
  });
});
