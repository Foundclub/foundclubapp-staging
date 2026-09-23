// LOT REPNOTIF (E6) — CARACTERISATION de « repondre depuis la notification ».
//
// 🗺️ CE QUE LA CARTE A TROUVE, ET C EST L INVERSE DE CE QU ON CROYAIT : la
// fonctionnalite EXISTE deja, de bout en bout, des deux cotes.
//   · serveur : `send-notifications.ts` pose `actionContext: 'chat_reply'` et la
//     categorie iOS `CHAT_REPLY_CATEGORY` sur les notifications de message, et
//     n envoie la version « a boutons » qu aux telephones qui savent l afficher
//     (`supportsPushActions`) — les autres recoivent la notification normale ;
//   · app : `rsvpActions.js` declare l action, `notificationBackgroundHandler.js`
//     la traite application FERMEE, `useNotifications.js` au PREMIER PLAN.
//
// ⛔ MAIS ELLE N AVAIT AUCUN TEMOIN. `rsvpActionsCOACH1.test.js` ne couvre que
// « Present / Absent ». Toute cette chaine pouvait casser sans qu une seule
// porte ne bouge. Ce fichier la decrit et la verrouille.
//
// 🧨 ET LA CARTE A TROUVE DEUX TROUS REELS, mesures ici :
//   1. le canal de CLUB est absent de la liste des types repondables — et il
//      est meme absent de TOUTE l app (voir le temoin R3) ;
//   2. quand l envoi echoue, le texte tape est PERDU sans retour possible.

const mockPost = jest.fn();
const mockDisplay = jest.fn(async () => undefined);

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn(async () => 'canal'),
    displayNotification: (...args) => mockDisplay(...args),
    setNotificationCategories: jest.fn(async () => undefined),
  },
}));

jest.mock('@/services/client', () => ({
  __esModule: true,
  default: { post: (...args) => mockPost(...args) },
}));

jest.mock('@/domains/auth/authUseCases', () => ({
  ...jest.requireActual('@/domains/auth/authUseCases'),
  activateSessionForNotificationPayload: jest.fn(async () => ({
    session: { token: 'jeton-du-compte-vise' },
  })),
}));

// eslint-disable-next-line import/first
import {
  CHAT_REPLY_ACTION_REPLY,
  CHAT_REPLY_ACTION_RETRY,
} from '../constants';
// eslint-disable-next-line import/first
import { activateSessionForNotificationPayload } from '@/domains/auth/authUseCases';

// eslint-disable-next-line import/first
import {
  handleChatReplyActionPress,
  isChatReplyActionablePayload,
} from '../rsvpActions';

/**
 * Une notification de message TELLE QUE le serveur l envoie.
 * @param {Record<string, unknown>} extra Ce qu on veut changer.
 * @returns {Record<string, unknown>} La charge.
 */
const messageRecu = (extra = {}) => ({
  actionContext: 'chat_reply',
  chatId: 'chat-77',
  conversationId: 'chat-77',
  firstname: 'Anna',
  lastname: 'Martin',
  // Le compte VISE : un telephone peut porter plusieurs comptes, et la reponse
  // doit partir de CELUI a qui le message etait adresse.
  targetUserDocumentId: 'bruno-doc',
  type: 'newWhisper',
  ...extra,
});

beforeEach(() => {
  mockPost.mockReset();
  mockPost.mockResolvedValue({ data: { id: 1 } });
  mockDisplay.mockClear();
});

// ─────────────────────────────────────────────────────────────────────────────
// R1 — CE QUI MARCHE DEJA. Ces temoins sont verts d emblee : ils decrivent.
// ─────────────────────────────────────────────────────────────────────────────

test('REPNOTIF/R1 — un message a deux, d equipe ou de groupe porte le bouton', () => {
  ['newWhisper', 'newTeamMessage', 'newGroupMessage', 'newLeagueMatchMessage'].forEach((type) => {
    expect(isChatReplyActionablePayload(messageRecu({ type }))).toBe(true);
  });
});

test('REPNOTIF/R1 bis 🔒 — ce qui n est PAS un message n a pas de bouton', () => {
  // Une reaction emoji, par exemple : on ne repond pas a un pouce leve.
  ['messageReaction', 'eventReminder', 'eventPublished'].forEach((type) => {
    expect(isChatReplyActionablePayload(messageRecu({ type }))).toBe(false);
  });
});

test('REPNOTIF/R1 ter 🔒 — sans conversation, pas de bouton', () => {
  // Sinon le bouton s affiche et la reponse n a nulle part ou aller.
  expect(isChatReplyActionablePayload(
    messageRecu({ chatId: undefined, conversationId: undefined }),
  )).toBe(false);
});

test('REPNOTIF/R2 — la reponse part sur la MEME porte que l envoi normal', async () => {
  const result = await handleChatReplyActionPress({
    inputText: 'On se voit a 18h',
    notificationData: messageRecu(),
    pressActionId: CHAT_REPLY_ACTION_REPLY,
  });

  expect(result).toEqual({ handled: true, success: true });
  expect(mockPost).toHaveBeenCalledTimes(1);
  expect(mockPost.mock.calls[0][0]).toBe('/chat-messages');
  // La MEME forme que `createChatMessage` : le serveur applique donc les memes
  // controles qu un envoi normal, blocage compris.
  expect(mockPost.mock.calls[0][1]).toEqual({
    data: { chat: 'chat-77', message: 'On se voit a 18h' },
  });
});

test('REPNOTIF/R2 bis 🔒 — la reponse part avec le jeton du compte VISE', async () => {
  // Un telephone peut porter plusieurs comptes. Sans ce jeton, la reponse
  // partirait du compte actif, pas de celui a qui on ecrivait.
  await handleChatReplyActionPress({
    inputText: 'ok',
    notificationData: messageRecu(),
    pressActionId: CHAT_REPLY_ACTION_REPLY,
  });

  expect(mockPost.mock.calls[0][2]).toEqual({
    headers: { Authorization: 'Bearer jeton-du-compte-vise' },
  });
});

test('REPNOTIF/R2 ter 🔒 — un texte vide ou un autre bouton n envoie RIEN', async () => {
  const vide = await handleChatReplyActionPress({
    inputText: '   ',
    notificationData: messageRecu(),
    pressActionId: CHAT_REPLY_ACTION_REPLY,
  });
  const autreBouton = await handleChatReplyActionPress({
    inputText: 'coucou',
    notificationData: messageRecu(),
    pressActionId: 'event_rsvp_present',
  });

  expect(vide).toEqual({ handled: false });
  expect(autreBouton).toEqual({ handled: false });
  expect(mockPost).not.toHaveBeenCalled();
});

// ─────────────────────────────────────────────────────────────────────────────
// R3 — LE CANAL DE CLUB. 🧨 Trou mesure : le serveur envoie `newClubMessage`
// (`chat-message/services/notification.ts`) a TOUS les membres du club, et
// l app ne connait pas cette etiquette DU TOUT.
// ─────────────────────────────────────────────────────────────────────────────

test('REPNOTIF/R3 — un message du canal du CLUB porte aussi le bouton', () => {
  expect(isChatReplyActionablePayload(messageRecu({ type: 'newClubMessage' }))).toBe(true);
});

// ─────────────────────────────────────────────────────────────────────────────
// R4 — L ECHEC. 🧨 Trou mesure : le texte tape disparaissait.
// ─────────────────────────────────────────────────────────────────────────────

test('REPNOTIF/R4 — un envoi qui echoue NE PERD PAS le texte tape', async () => {
  mockPost.mockRejectedValueOnce(new Error('reseau coupe'));

  const result = await handleChatReplyActionPress({
    inputText: 'Je serai en retard de 10 minutes',
    notificationData: messageRecu(),
    pressActionId: CHAT_REPLY_ACTION_REPLY,
  });

  expect(result).toEqual({ handled: true, success: false });

  const echec = mockDisplay.mock.calls.at(-1)?.[0];
  // Le texte doit etre VISIBLE (on peut le relire, le recopier)…
  expect(echec.body).toContain('Je serai en retard de 10 minutes');
  // …et RANGE dans la notification, pour que « Reessayer » sache quoi renvoyer.
  expect(echec.data.chatReplyRetryText).toBe('Je serai en retard de 10 minutes');
});

test('REPNOTIF/R4 bis — la notification d echec porte un bouton « Reessayer »', async () => {
  mockPost.mockRejectedValueOnce(new Error('reseau coupe'));

  await handleChatReplyActionPress({
    inputText: 'a tout de suite',
    notificationData: messageRecu(),
    pressActionId: CHAT_REPLY_ACTION_REPLY,
  });

  const echec = mockDisplay.mock.calls.at(-1)?.[0];
  const actions = echec.android?.actions || [];
  expect(actions.some((action) => action?.pressAction?.id === CHAT_REPLY_ACTION_RETRY)).toBe(true);
  expect(echec.ios?.categoryId).toBe('CHAT_REPLY_RETRY_CATEGORY');
});

test('REPNOTIF/R4 ter — « Reessayer » renvoie le MEME texte, dans la MEME conversation', async () => {
  const result = await handleChatReplyActionPress({
    notificationData: messageRecu({ chatReplyRetryText: 'Je serai en retard de 10 minutes' }),
    pressActionId: CHAT_REPLY_ACTION_RETRY,
  });

  expect(result).toEqual({ handled: true, success: true });
  expect(mockPost.mock.calls[0][1]).toEqual({
    data: { chat: 'chat-77', message: 'Je serai en retard de 10 minutes' },
  });
});

test('REPNOTIF/R4 quater — un DEUXIEME echec ne perd toujours rien', async () => {
  mockPost.mockRejectedValueOnce(new Error('toujours coupe'));

  await handleChatReplyActionPress({
    notificationData: messageRecu({ chatReplyRetryText: 'on reessaie' }),
    pressActionId: CHAT_REPLY_ACTION_RETRY,
  });

  const echec = mockDisplay.mock.calls.at(-1)?.[0];
  expect(echec.data.chatReplyRetryText).toBe('on reessaie');
});

// ─────────────────────────────────────────────────────────────────────────────
// R5 — LE COMPTE. 🔒 Un telephone porte souvent plusieurs comptes.
// ─────────────────────────────────────────────────────────────────────────────

test('REPNOTIF/R5 🔒 — sans session pour le compte vise, RIEN ne part', async () => {
  // Sans ce garde-fou, la requete partait quand meme et le client y mettait le
  // jeton du compte ACTIF : la reponse serait publiee SOUS LE NOM DE QUELQU UN
  // D AUTRE. Publier au nom d un tiers ne se rattrape pas.
  activateSessionForNotificationPayload.mockResolvedValueOnce({
    activated: false,
    reason: 'session_not_found',
  });

  const result = await handleChatReplyActionPress({
    inputText: 'a tout de suite',
    notificationData: messageRecu(),
    pressActionId: CHAT_REPLY_ACTION_REPLY,
  });

  expect(mockPost).not.toHaveBeenCalled();
  expect(result).toEqual({ handled: true, success: false });
});

test('REPNOTIF/R5 bis — et meme la, le texte tape n est PAS perdu', async () => {
  activateSessionForNotificationPayload.mockResolvedValueOnce({
    activated: false,
    reason: 'session_not_found',
  });

  await handleChatReplyActionPress({
    inputText: 'je passe au stade vers 19h',
    notificationData: messageRecu(),
    pressActionId: CHAT_REPLY_ACTION_REPLY,
  });

  const echec = mockDisplay.mock.calls.at(-1)?.[0];
  expect(echec.data.chatReplyRetryText).toBe('je passe au stade vers 19h');
});

test('REPNOTIF/R4 quinquies 🔒 — « Reessayer » sans texte range ne fait rien', async () => {
  const result = await handleChatReplyActionPress({
    notificationData: messageRecu(),
    pressActionId: CHAT_REPLY_ACTION_RETRY,
  });

  expect(result).toEqual({ handled: false });
  expect(mockPost).not.toHaveBeenCalled();
});
