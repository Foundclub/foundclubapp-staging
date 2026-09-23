// LOT REPNOTIF (E6) — 🔌 LE CABLAGE APPLICATION FERMEE, ET RIEN D AUTRE.
//
// `repnotifReponseRapide.test.js` mesure les REGLES (qui peut repondre, ou part
// la reponse, ce qui se passe quand ca rate). Il ne mesure pas ce qui les
// relie : le fichier enregistre au demarrage (`index.js:95`) qui recoit
// l appui sur « Repondre » alors que l application est FERMEE.
//
// 🧨 C EST LA QUE LES PANNES SILENCIEUSES VIVENT, et aucune ne leve d erreur :
//   · oublier de passer `detail.input` ⇒ le texte arrive VIDE, la fonction rend
//     `handled: false`, et le message n est jamais envoye — sans un mot ;
//   · ne pas afficher la notification sur Android ⇒ la charge « a boutons » est
//     DATA-ONLY, donc rien ne s affiche DU TOUT ;
//   · ne pas annuler la notification traitee ⇒ elle reste sur l ecran, et on
//     peut repondre deux fois au meme message.
//
// On double notifee et Firebase pour attraper les fonctions enregistrees, puis
// on les appelle nous-memes : le test devient deterministe et voit le cablage.

const ecouteursDeFond = [];
const messagesDeFond = [];
const mockCancel = jest.fn(async () => undefined);

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    cancelNotification: (...args) => mockCancel(...args),
    onBackgroundEvent: (callback) => ecouteursDeFond.push(callback),
  },
  EventType: { ACTION_PRESS: 2, PRESS: 1 },
}));

jest.mock('@react-native-firebase/app', () => ({ getApp: () => ({}) }));
jest.mock('@react-native-firebase/messaging', () => ({
  getMessaging: () => ({}),
  setBackgroundMessageHandler: (_instance, callback) => messagesDeFond.push(callback),
}));

const mockHandleChatReply = jest.fn(async () => ({ handled: true, success: true }));
const mockHandleRsvp = jest.fn(async () => ({ handled: false }));
const mockDisplayChatReply = jest.fn(async () => undefined);
const mockDisplayRsvp = jest.fn(async () => undefined);

jest.mock('@/services/notificationActions/rsvpActions', () => ({
  displayChatReplyActionableNotification: (...args) => mockDisplayChatReply(...args),
  displayEventRsvpActionableNotification: (...args) => mockDisplayRsvp(...args),
  ensureNotificationActionSetup: jest.fn(async () => undefined),
  handleChatReplyActionPress: (...args) => mockHandleChatReply(...args),
  handleEventRsvpActionPress: (...args) => mockHandleRsvp(...args),
  isChatReplyActionablePayload: (data) => String(data?.type || '').includes('Message')
    || String(data?.type || '') === 'newWhisper',
  isEventRsvpActionablePayload: (data) => String(data?.type || '') === 'eventReminder',
  storePendingOpenNotification: jest.fn(),
}));

// eslint-disable-next-line import/first
import { Platform } from 'react-native';

// eslint-disable-next-line import/first
import { registerBackgroundHandler } from '@/services/notificationBackgroundHandler';

const MESSAGE = {
  actionContext: 'chat_reply',
  chatId: 'chat-77',
  targetUserDocumentId: 'bruno-doc',
  type: 'newWhisper',
};

beforeAll(() => {
  registerBackgroundHandler();
});

beforeEach(() => {
  mockHandleChatReply.mockClear();
  mockHandleRsvp.mockClear();
  mockDisplayChatReply.mockClear();
  mockCancel.mockClear();
});

test('REPNOTIF/C1 — le demarrage enregistre BIEN les deux ecouteurs de fond', () => {
  // Sans eux, l appui sur « Repondre » application fermee ne reveille personne.
  expect(ecouteursDeFond).toHaveLength(1);
  expect(messagesDeFond).toHaveLength(1);
});

test('REPNOTIF/C2 — l appui transmet LE TEXTE TAPE, pas seulement le bouton', async () => {
  // 🪤 Oublier `inputText` ne casse rien de visible : la reponse part vide,
  // la fonction rend `handled: false`, et le message disparait sans un mot.
  await ecouteursDeFond[0]({
    detail: {
      input: 'On se voit a 18h',
      notification: { data: MESSAGE, id: 'notif-1' },
      pressAction: { id: 'chat_reply_submit' },
    },
    type: 2,
  });

  expect(mockHandleChatReply).toHaveBeenCalledTimes(1);
  expect(mockHandleChatReply.mock.calls[0][0]).toEqual({
    inputText: 'On se voit a 18h',
    notificationData: MESSAGE,
    pressActionId: 'chat_reply_submit',
  });
});

test('REPNOTIF/C3 — une fois traitee, la notification DISPARAIT', async () => {
  // Sinon elle reste a l ecran et on repond deux fois au meme message.
  await ecouteursDeFond[0]({
    detail: {
      input: 'ok',
      notification: { data: MESSAGE, id: 'notif-1' },
      pressAction: { id: 'chat_reply_submit' },
    },
    type: 2,
  });

  expect(mockCancel).toHaveBeenCalledWith('notif-1');
});

test('REPNOTIF/C4 🔒 — ce que la reponse rapide ne prend pas, le RSVP le recoit', async () => {
  // L ordre compte : la reponse rapide passe en premier, mais elle ne doit pas
  // avaler les appuis « Present / Absent ».
  mockHandleChatReply.mockResolvedValueOnce({ handled: false });

  await ecouteursDeFond[0]({
    detail: {
      notification: { data: { eventId: 'e-1', type: 'eventReminder' }, id: 'notif-2' },
      pressAction: { id: 'event_rsvp_present' },
    },
    type: 2,
  });

  expect(mockHandleRsvp).toHaveBeenCalledTimes(1);
});

test('REPNOTIF/C5 — sur Android, la charge « a boutons » est AFFICHEE par l app', async () => {
  // 🪤 Elle est DATA-ONLY (`createActionableAndroidMessage` cote serveur) : si
  // l app ne l affiche pas elle-meme, il n y a AUCUNE notification.
  Platform.OS = 'android';

  await messagesDeFond[0]({ data: MESSAGE, notification: { body: 'Salut', title: 'Anna' } });

  expect(mockDisplayChatReply).toHaveBeenCalledTimes(1);
  const affichee = mockDisplayChatReply.mock.calls[0][0];
  expect(affichee.title).toBe('Anna');
  expect(affichee.body).toBe('Salut');
  expect(affichee.data.chatId).toBe('chat-77');
});
