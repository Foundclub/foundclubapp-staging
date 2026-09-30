import { RouteNames } from '@/navigation/routeNames';

import { resolveNotificationDestination } from '@/utils/notifications/notificationNavigation';
import { NOTIFICATION_TYPES } from '@/utils/notifications/notificationTypes';

/**
 * PARENT-LIEN (30/09) — « Un parent demande à relier ton compte au sien ».
 *
 * 🪤 L'étiquette est écrite À LA MAIN des deux côtés : serveur
 * (`admin/src/api/user-fcm-token/types/index.ts`, témoin jumeau
 * `admin/tests/authz/PARENT-LIEN-rattachement.test.js` ㉔) et app (`authUseCases.js`).
 * Rien ne les relie : une étiquette inconnue de l'app ne lève aucune erreur, l'appui ne mène
 * nulle part — et l'enfant ne trouve jamais l'écran où il doit répondre.
 */
const ETIQUETTE_SERVEUR = 'parentLinkRequest';

describe('PARENT-LIEN — la demande de lien mène à l écran « Mon parent »', () => {
  test('l étiquette du serveur est connue de l app, au caractère près', () => {
    expect(NOTIFICATION_TYPES.PARENT_LINK_REQUEST).toBe(ETIQUETTE_SERVEUR);
  });

  test('l appui ouvre « Mon parent », dans la pile du profil', () => {
    const destination = resolveNotificationDestination({ type: ETIQUETTE_SERVEUR });
    expect(JSON.stringify(destination)).toContain(RouteNames.MyParentLink);
    expect(RouteNames.MyParentLink).toBe('MyParentLink');
  });
});
