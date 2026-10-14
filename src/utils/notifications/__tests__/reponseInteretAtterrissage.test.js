import { Platform } from 'react-native';

import { RouteNames } from '@/navigation/routeNames';

import {
  getNotificationOpenKey,
  resolveNotificationDestination,
} from '@/utils/notifications/notificationNavigation';

/**
 * 👪 PAR-L9a (13/10) — LA RÉPONSE À UNE DEMANDE D'INTÉRÊT MÈNE QUELQUE PART.
 *
 * Recette parent d'Adel (iPhone 2.6.73, 11/10), fiche PAR-011 ; design du 12/10,
 * écran E18 (planche 7). Le serveur envoie `clubInterestResponse` avec
 * `chatDocumentId` quand le club a ouvert une conversation
 * (`admin/src/api/club-interest-request/services/notification.ts`) ; l'app
 * ne connaissait PAS cette étiquette : l'appui ne faisait rien.
 *
 * 🪤 Les deux étiquettes sont écrites à la main côté serveur
 * (`admin/src/api/user-fcm-token/types/index.ts`) : rien ne les relie à l'app.
 */
const REPONSE = 'clubInterestResponse';
const DEMANDE = 'clubInterestRequest';

/**
 * La destination telle que l'app la donne à `navigate`, réduite à ce qui compte.
 * @param {Record<string, unknown>} charge La notification reçue.
 * @returns {string} Sa forme sérialisée.
 */
const destinationDe = (charge) => JSON.stringify(resolveNotificationDestination(charge));

describe('PAR-L9a — la notification « Réponse du club » ouvre la conversation', () => {
  const plateformeDOrigine = Platform.OS;
  afterEach(() => { Platform.OS = plateformeDOrigine; });

  test.each(['ios', 'android', 'web'])('%s : une réponse « conversation » ouvre CE fil', (os) => {
    Platform.OS = os;
    const destination = resolveNotificationDestination({
      chatDocumentId: 'fil-maryline',
      responseText: 'Le club t’a ouvert une conversation.',
      teamName: 'U11 Filles',
      type: REPONSE,
    });

    expect(JSON.stringify(destination)).toContain(RouteNames.Conversation);
    expect(JSON.stringify(destination)).toContain('"chatId":"fil-maryline"');
  });

  test('la notification RANGÉE dans la cloche (données imbriquées) mène au même fil', () => {
    const destination = destinationDe({
      body: 'Réponse concernant U11 Filles: …',
      data: { chatDocumentId: 'fil-maryline', teamName: 'U11 Filles' },
      documentId: 'notif-1',
      title: 'Réponse du club',
      type: REPONSE,
    });

    expect(destination).toContain(RouteNames.Conversation);
    expect(destination).toContain('"chatId":"fil-maryline"');
  });

  test('une réponse « message type » (sans fil) ouvre son détail, avec son texte', () => {
    const destination = destinationDe({
      body: 'Réponse concernant U11 Filles: Merci pour ton intérêt, on revient vers toi.',
      documentId: 'notif-2',
      title: 'Réponse du club',
      type: REPONSE,
    });

    expect(destination).toContain(RouteNames.NotificationDetails);
    expect(destination).toContain('Merci pour ton intérêt');
    expect(destination).not.toContain(RouteNames.Conversation);
  });

  test('deux réponses de deux fils différents ne se confondent pas (clé d ouverture)', () => {
    expect(getNotificationOpenKey({ chatDocumentId: 'fil-a', type: REPONSE }))
      .not.toBe(getNotificationOpenKey({ chatDocumentId: 'fil-b', type: REPONSE }));
  });
});

describe('PAR-L9a — la notification « Nouveau profil intéressé » mène quelque part aussi', () => {
  test('sans fil : l onglet Demandes, filtré sur les intérêts', () => {
    const destination = destinationDe({ teamId: 'team-u11f', type: DEMANDE });

    expect(destination).toContain(RouteNames.RequestsHub);
    expect(destination).toContain('"initialFilter":"interest"');
  });

  test('avec un fil (conversation confiée à un coach, L9b) : ce fil', () => {
    const destination = destinationDe({ chatDocumentId: 'fil-a-trois', type: DEMANDE });

    expect(destination).toContain(RouteNames.Conversation);
    expect(destination).toContain('"chatId":"fil-a-trois"');
  });
});
