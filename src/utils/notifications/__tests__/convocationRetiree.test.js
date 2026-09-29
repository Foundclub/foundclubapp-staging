import { RouteNames } from '@/navigation/routeNames';

import { resolveNotificationDestination } from '@/utils/notifications/notificationNavigation';
import { getNotificationIcon } from '@/utils/notifications/notificationPresentation';
import { NOTIFICATION_TYPES } from '@/utils/notifications/notificationTypes';

/**
 * LOT CONVOC-NOTIFS (29/09, « retiré A » d'Adel) — le joueur RETIRÉ d'une
 * convocation republiée reçoit « Tu n'es plus dans la convocation de … ».
 *
 * 🪤 L'étiquette est écrite À LA MAIN des deux côtés : serveur
 * (`admin/src/api/user-fcm-token/types/index.ts`, témoin jumeau
 * `admin/tests/authz/CONVOCNOTIF-qui-est-prevenu.test.js` CN3) et app
 * (`authUseCases.js`). Rien ne les relie ; une étiquette inconnue de l'app ne
 * lève aucune erreur, l'appui retombe sur la cloche.
 */
const ETIQUETTE_SERVEUR = 'eventConvocationRemoved';

const FICHE_DU_MATCH = {
  params: {
    params: { eventId: 'evt-1' },
    screen: RouteNames.EventDetails,
  },
  route: RouteNames.EventStack,
};

describe('CONVOC-NOTIFS — « tu n es plus dans la convocation » mène à la fiche du match', () => {
  test('l étiquette du serveur est connue de l app, au caractère près', () => {
    // ⛔ La chaîne LITTÉRALE du serveur, pas la constante des deux côtés : une
    // faute de frappe symétrique se compenserait.
    expect(NOTIFICATION_TYPES.EVENT_CONVOCATION_REMOVED).toBe(ETIQUETTE_SERVEUR);
  });

  test('sans route du serveur, l aiguillage de l app ouvre la fiche du match', () => {
    expect(resolveNotificationDestination({ eventId: 'evt-1', type: ETIQUETTE_SERVEUR }))
      .toEqual(FICHE_DU_MATCH);
  });

  test('avec la charge TELLE QUE le serveur l envoie (ctaRoute + ctaParams en texte), même écran', () => {
    // FCM ne transporte que des chaînes : ctaParams arrive sérialisé.
    expect(resolveNotificationDestination({
      ctaParams: JSON.stringify({ params: { eventId: 'evt-1' }, screen: 'EventDetails' }),
      ctaRoute: 'EventStack',
      eventId: 'evt-1',
      teamId: 'team-7',
      type: ETIQUETTE_SERVEUR,
    })).toEqual(FICHE_DU_MATCH);
  });

  test('sans événement, on retombe sur la liste (null), jamais sur un écran vide', () => {
    expect(resolveNotificationDestination({ type: ETIQUETTE_SERVEUR })).toBeNull();
  });

  test('dans la cloche, elle porte l icône des événements', () => {
    expect(getNotificationIcon(ETIQUETTE_SERVEUR))
      .toBe(getNotificationIcon(NOTIFICATION_TYPES.EVENT_CONVOCATION_PUBLISHED));
  });
});
