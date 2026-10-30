import { RouteNames } from '@/navigation/routeNames';
import { NOTIFICATION_TYPES } from '@/domains/auth/authUseCases';
import { resolveNotificationDestination } from '@/utils/notifications/notificationNavigation';

// CORR-CHEMINS (30/10, point 48, Adel « A ») — deux notifications de la recette du site :
//   · « demande d'adhésion à l'équipe » menait à l'ancienne page « Ce flux a été migré vers
//     Demandes » : elle ouvre directement Demandes, filtre « Équipe » ;
//   · « Hugo L. sera présent samedi 10 h » (réservation d'un terrain, interrupteur du site éteint)
//     ne menait nulle part : elle ouvre son détail.
describe('CORR-CHEMINS 48 : une notification mène toujours quelque part', () => {
  test('une demande d adhésion à l équipe ouvre Demandes, filtre équipe', () => {
    const destination = resolveNotificationDestination({
      teamId: 'team-1',
      type: NOTIFICATION_TYPES.TEAM_MEMBERSHIP_REQUEST,
    });
    expect(destination?.route).toBe(RouteNames.RequestsHub);
    expect(destination?.params).toEqual(expect.objectContaining({ initialFilter: 'team' }));
  });

  test('« sera présent » d une réservation ouvre le détail de la notification', () => {
    const destination = resolveNotificationDestination({
      body: 'Hugo L. sera présent samedi 10 h (3/10).',
      data: { change: 'participant-present', reservationId: 'r-1' },
      notificationId: 'notif-7',
      title: 'Réservation',
      type: NOTIFICATION_TYPES.COMPLEXE_RESERVATION_JOUEUR,
    });
    expect(destination?.route).toBe(RouteNames.NotificationDetails);
    expect(destination?.params?.notificationId).toBe('notif-7');
  });
});
