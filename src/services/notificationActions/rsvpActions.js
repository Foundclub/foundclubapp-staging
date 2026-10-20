import notifee from '@notifee/react-native';
import i18next from 'i18next';
import { MMKV } from 'react-native-mmkv';

import { activateSessionForNotificationPayload } from '@/domains/auth/authUseCases';
import { joueurDesComplexesAllume } from '@/domains/complexe/reservationsDuJoueur';

import client from '@/services/client';
import { repondreALaVeille } from '@/services/complexe/complexeJoueurService';

import { createLogger } from '@/utils/logger/logger';
import {
  normalizeNotificationPayload,
} from '@/utils/notifications/notificationNavigation';
import { NOTIFICATION_TYPES } from '@/utils/notifications/notificationTypes';

import {
  CHAT_REPLY_ACTION_CONTEXT,
  CHAT_REPLY_ACTION_REPLY,
  CHAT_REPLY_ACTION_RETRY,
  CHAT_REPLY_CATEGORY,
  CHAT_REPLY_RETRY_CATEGORY,
  EVENT_RSVP_ACTION_ABSENT,
  EVENT_RSVP_ACTION_CONTEXT,
  EVENT_RSVP_ACTION_PRESENT,
  EVENT_RSVP_CATEGORY,
  NOTIFICATION_DEFAULT_CHANNEL_ID,
  NOTIFICATION_PENDING_OPEN_KEY,
  NOTIFICATION_SILENT_CHANNEL_ID,
  RESA_VEILLE_ACTION_ANNULER,
  RESA_VEILLE_ACTION_CONFIRMER,
  RESA_VEILLE_ACTION_CONTEXT,
  RESA_VEILLE_CATEGORY,
} from './constants';

// RESA-L6B-1 — le journal des boutons de N-20 (le journal du projet, pas `console`).
const resaVeilleLogger = createLogger('notifications-resa-veille');

/** @type {MMKV | null} */
let storageInstance = null;

const getStorage = () => {
  if (!storageInstance) {
    storageInstance = new MMKV({
      id: 'notifications-storage',
    });
  }
  return storageInstance;
};

const getNotificationStorage = () => ({
  /** @param {string} key */
  delete: (key) => getStorage().delete(key),
  /** @param {string} key */
  getString: (key) => getStorage().getString(key),
  /**
   * @param {string} key @param {string} value
   * @param value
   */
  set: (key, value) => getStorage().set(key, value),
});

const notificationStorage = getNotificationStorage();

const CHAT_REPLY_ACTIONABLE_TYPES = new Set([
  // REPNOTIF — le canal de CLUB manquait ici ET dans la liste du serveur : des
  // centaines de personnes recevaient un message sans jamais pouvoir y repondre
  // depuis la notification.
  NOTIFICATION_TYPES.NEW_CLUB_MESSAGE,
  NOTIFICATION_TYPES.NEW_GROUP_MESSAGE,
  NOTIFICATION_TYPES.NEW_LEAGUE_MATCH_MESSAGE,
  NOTIFICATION_TYPES.NEW_TEAM_MESSAGE,
  NOTIFICATION_TYPES.NEW_WHISPER,
]);

/**
 * @param {unknown} value
 * @returns {string}
 */
const toSafeString = (value) => {
  if (value === undefined || value === null) return '';
  return String(value);
};

/**
 * @param {unknown} rawData
 * @returns {boolean}
 */
// COACH1 (decision d Adel du 2026-09-21, qui remplace Y07) — l entraineur
// repond Present / Absent comme un joueur. ⛔ NE PAS AJOUTER DE CONTROLE DE
// ROLE ICI : cette surface suit deja la regle de la fiche — aucun filtre dans
// l app, et le serveur accepte la reponse d un membre, encadrant compris.
// Ce qui decide QUI recoit ce rappel, c est le serveur : la relance
// « reponse attendue » ne vise que `team.players` (`event-governance.ts`,
// `unansweredEligiblePlayers`). Relancer aussi les encadrants est une question
// ouverte, posee a Adel par COACH1. Caracterisation : `__tests__/*COACH1.test.js`.
export const isEventRsvpActionablePayload = (rawData) => {
  const data = normalizeNotificationPayload(rawData || {});
  const hasContext = data.actionContext === EVENT_RSVP_ACTION_CONTEXT;
  const hasEventId = Boolean(data.eventId);
  const isReminder = data.type === NOTIFICATION_TYPES.EVENT_REMINDER;
  return hasEventId && isReminder && (hasContext || !data.actionContext);
};

/**
 * @param {unknown} rawData
 * @returns {boolean}
 */
export const isChatReplyActionablePayload = (rawData) => {
  const data = normalizeNotificationPayload(rawData || {});
  const type = toSafeString(data.type).trim();
  const hasChatId = Boolean(data.chatId || data.conversationId);
  const hasContext = data.actionContext === CHAT_REPLY_ACTION_CONTEXT;
  return hasChatId && CHAT_REPLY_ACTIONABLE_TYPES.has(type) && (hasContext || !data.actionContext);
};

/**
 * RESA-L6B-1 — N-20, la question de la veille (`complexeReservationJoueur`, `change: 'veille'`)
 * porte « J'annule » / « Je confirme ». Interrupteur `COMPLEXES_JOUEUR` éteint : jamais (comme
 * staging). Le serveur décide QUI la reçoit (le réserveur, RESA-L2B) : aucun contrôle de rôle ici.
 * Témoin : `__tests__/resaVeilleActions.test.js`.
 * @param {unknown} rawData
 * @returns {boolean}
 */
export const isResaVeilleActionablePayload = (rawData) => {
  if (!joueurDesComplexesAllume()) return false;
  const data = normalizeNotificationPayload(rawData || {});
  const hasContext = data.actionContext === RESA_VEILLE_ACTION_CONTEXT;
  return data.type === NOTIFICATION_TYPES.COMPLEXE_RESERVATION_JOUEUR
    && toSafeString(data.change).trim() === 'veille'
    && Boolean(toSafeString(data.reservationId).trim())
    && (hasContext || !data.actionContext);
};

/**
 * @param {string | undefined} pressActionId
 * @returns {'present' | 'absent' | null}
 */
const resolveAnswerFromAction = (pressActionId) => {
  if (pressActionId === EVENT_RSVP_ACTION_PRESENT) return 'present';
  if (pressActionId === EVENT_RSVP_ACTION_ABSENT) return 'absent';
  return null;
};

/**
 * @param {'present' | 'absent'} answer
 * @returns {{ title: string, body: string }}
 */
const getRsvpFeedbackCopy = (answer) => (answer === 'present'
  ? {
    body: i18next.t('rsvpActions.present.body', 'Ta présence est enregistrée.'),
    title: i18next.t('rsvpActions.present.title', 'Présence confirmée'),
  }
  : {
    body: i18next.t('rsvpActions.absent.body', 'Ton absence est enregistrée.'),
    title: i18next.t('rsvpActions.absent.title', 'Absence confirmée'),
  });

const getChatReplyFeedbackCopy = () => ({
  body: i18next.t('rsvpActions.chatReply.sent.body', 'Ta réponse a été envoyée.'),
  title: i18next.t('rsvpActions.chatReply.sent.title', 'Réponse envoyée'),
});

/**
 * REPNOTIF — 🧯 CE QUE DIT UN ENVOI RATE, ET POURQUOI IL MONTRE LE TEXTE.
 *
 * Avant, l echec disait « Ouvre l application pour finaliser ta reponse » et le
 * texte tape DISPARAISSAIT : personne ne pouvait le relire ni le renvoyer.
 * Maintenant il est ECRIT dans le corps — donc lisible et recopiable meme si
 * tout le reste echoue — et RANGE dans la notification pour le bouton.
 *
 * 🔤 Aucune interpolation i18next ici, volontairement : elle ECHAPPE ses
 * valeurs, et une apostrophe du message ressortirait en `&#39;`
 * (memoire `piege-i18next-echappe-et-le-zero-prend-le-pluriel`).
 * @param {string} message Le texte que la personne a tape.
 * @returns {{ body: string, title: string }} Le titre et le corps.
 */
const getChatReplyFailureCopy = (message) => {
  const invite = i18next.t(
    'rsvpActions.chatReply.failed.body',
    'Appuie sur « Réessayer » pour renvoyer :',
  );
  const texte = toSafeString(message).trim();
  return {
    body: texte ? `${invite} ${texte}` : invite,
    title: i18next.t('rsvpActions.chatReply.failed.title', 'Message non envoyé'),
  };
};

/**
 * REPNOTIF — 📛 LES DEUX BOUTONS DU RAPPEL, ECRITS UNE SEULE FOIS.
 *
 * Ils l etaient DEUX fois, et pas de la meme facon : iOS passait par les
 * traductions, Android les avait en dur ('Present', 'Absent'). Sur Android le
 * bouton restait donc en francais pour un anglophone, et sans accent pour tout
 * le monde. Les deux plateformes lisent desormais la meme source, et un temoin
 * verifie qu elles disent exactement la meme chose.
 * @returns {Array<object>} Les deux actions Android du rappel d evenement.
 */
const getEventRsvpAndroidActions = () => ([
  {
    pressAction: { id: EVENT_RSVP_ACTION_PRESENT },
    title: i18next.t('rsvpActions.actions.present', 'Présent'),
  },
  {
    pressAction: { id: EVENT_RSVP_ACTION_ABSENT },
    title: i18next.t('rsvpActions.actions.absent', 'Absent'),
  },
]);

/**
 * RESA-L6B-1 — les deux boutons de N-20, dans l'ordre de la planche EP14 (« J'annule » puis
 * « Je confirme »). UNE source pour Android et pour la catégorie iOS (leçon REPNOTIF).
 * @returns {Array<{ pressAction: { id: string }, title: string }>} Les deux actions.
 */
const getResaVeilleAndroidActions = () => ([
  {
    pressAction: { id: RESA_VEILLE_ACTION_ANNULER },
    title: i18next.t('rsvpActions.resaVeille.annuler', 'J’annule'),
  },
  {
    pressAction: { id: RESA_VEILLE_ACTION_CONFIRMER },
    title: i18next.t('rsvpActions.resaVeille.confirmer', 'Je confirme'),
  },
]);

const getChatReplyRetryAndroidActions = () => ([
  {
    pressAction: { id: CHAT_REPLY_ACTION_RETRY },
    title: i18next.t('rsvpActions.chatReply.retry', 'Réessayer'),
  },
]);

const getChatReplyAndroidActions = () => ([
  {
    input: {
      allowFreeFormInput: true,
      placeholder: i18next.t('rsvpActions.chatReply.placeholder', 'Ta réponse'),
    },
    pressAction: { id: CHAT_REPLY_ACTION_REPLY },
    title: i18next.t('rsvpActions.chatReply.action', 'Repondre'),
  },
]);

/**
 * @param {string | number} eventId
 * @param {'present' | 'absent'} answer
 * @param {string | number | undefined} notificationId
 * @param {string | undefined} sessionToken
 * @returns {Promise<any>}
 */
const sendRsvpAnswer = async (eventId, answer, notificationId, sessionToken) => {
  const config = sessionToken
    ? {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    }
    : undefined;
  const response = await client.post(`/events/${eventId}/rsvp`, {
    answer,
    notificationId,
    source: 'push_action',
  }, config);
  return response.data;
};

/**
 * @param {string | number} chatId
 * @param {string} message
 * @param {string | undefined} sessionToken
 * @returns {Promise<any>}
 */
const sendChatReplyMessage = async (chatId, message, sessionToken) => {
  const config = sessionToken
    ? {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    }
    : undefined;
  const response = await client.post('/chat-messages', {
    data: {
      chat: chatId,
      message,
    },
  }, config);
  return response.data;
};

/**
 * @param {Record<string, any>} notificationData
 * @returns {string}
 */
const resolveChatIdFromNotification = (notificationData) => {
  const rawChatId = notificationData?.chatId || notificationData?.conversationId || '';
  return toSafeString(rawChatId).trim();
};

/**
 * @param {{
 *  title?: string,
 *  body?: string,
 *  data?: Record<string, any>,
 *  channelId?: string,
 *  androidActions?: any[],
 *  iosCategoryId?: string,
 * }} payload
 * @returns {Promise<void>}
 */
const displayLocalNotification = async ({
  androidActions,
  body,
  channelId = NOTIFICATION_DEFAULT_CHANNEL_ID,
  data,
  iosCategoryId,
  title,
}) => {
  const androidConfig = /** @type {any} */ ({
    actions: Array.isArray(androidActions) && androidActions.length > 0
      ? androidActions
      : undefined,
    channelId,
    importance: channelId === NOTIFICATION_SILENT_CHANNEL_ID ? 2 : 4,
    pressAction: {
      id: 'default',
    },
    smallIcon: 'ic_notification',
    sound: channelId === NOTIFICATION_SILENT_CHANNEL_ID ? undefined : 'default',
    vibration: channelId !== NOTIFICATION_SILENT_CHANNEL_ID,
  });

  await notifee.displayNotification({
    android: androidConfig,
    body: toSafeString(body),
    data,
    ios: {
      categoryId: iosCategoryId || undefined,
      foregroundPresentationOptions: {
        alert: true,
        badge: false,
        sound: channelId !== NOTIFICATION_SILENT_CHANNEL_ID,
      },
      sound: channelId !== NOTIFICATION_SILENT_CHANNEL_ID ? 'default' : undefined,
    },
    title: toSafeString(title),
  });
};

/**
 * @returns {Promise<void>}
 */
export const ensureNotificationActionSetup = async () => {
  await notifee.createChannel({
    id: NOTIFICATION_DEFAULT_CHANNEL_ID,
    importance: 4,
    name: 'Default Channel',
    sound: 'default',
    vibration: true,
  });

  await notifee.createChannel({
    id: NOTIFICATION_SILENT_CHANNEL_ID,
    importance: 2,
    name: 'Silent Feedback',
    vibration: false,
  });

  await notifee.setNotificationCategories([
    {
      actions: [
        {
          id: EVENT_RSVP_ACTION_PRESENT,
          title: i18next.t('rsvpActions.actions.present', 'Présent'),
        },
        {
          id: EVENT_RSVP_ACTION_ABSENT,
          title: i18next.t('rsvpActions.actions.absent', 'Absent'),
        },
      ],
      id: EVENT_RSVP_CATEGORY,
    },
    {
      actions: [
        {
          id: CHAT_REPLY_ACTION_REPLY,
          input: {
            buttonText: i18next.t('rsvpActions.chatReply.send', 'Envoyer'),
            placeholderText: i18next.t('rsvpActions.chatReply.placeholder', 'Ta réponse'),
          },
          title: i18next.t('rsvpActions.chatReply.action', 'Repondre'),
        },
      ],
      id: CHAT_REPLY_CATEGORY,
    },
    {
      // REPNOTIF — la categorie de REESSAI : un seul bouton, sans champ de
      // saisie, parce que le texte est deja range dans la notification.
      actions: [
        {
          id: CHAT_REPLY_ACTION_RETRY,
          title: i18next.t('rsvpActions.chatReply.retry', 'Réessayer'),
        },
      ],
      id: CHAT_REPLY_RETRY_CATEGORY,
    },
    // RESA-L6B-1 — N-20 : la catégorie n'existe que l'interrupteur allumé (éteint : la liste
    // reste celle de staging).
    ...(joueurDesComplexesAllume() ? [{
      actions: getResaVeilleAndroidActions().map(({ pressAction, title }) => ({
        id: pressAction.id,
        title,
      })),
      id: RESA_VEILLE_CATEGORY,
    }] : []),
  ]);
};

/**
 * @param {{ title?: string, body?: string, data?: Record<string, any> }} payload
 * @returns {Promise<void>}
 */
export const displayEventRsvpActionableNotification = async ({
  body,
  data,
  title,
}) => {
  const normalizedData = normalizeNotificationPayload(data || {});
  await ensureNotificationActionSetup();
  await displayLocalNotification({
    androidActions: getEventRsvpAndroidActions(),
    body,
    channelId: NOTIFICATION_DEFAULT_CHANNEL_ID,
    data: normalizedData,
    iosCategoryId: EVENT_RSVP_CATEGORY,
    title,
  });
};

/**
 * @param {{ title?: string, body?: string, data?: Record<string, any> }} payload
 * @returns {Promise<void>}
 */
export const displayChatReplyActionableNotification = async ({
  body,
  data,
  title,
}) => {
  const normalizedData = normalizeNotificationPayload(data || {});
  await ensureNotificationActionSetup();
  await displayLocalNotification({
    androidActions: getChatReplyAndroidActions(),
    body,
    channelId: NOTIFICATION_DEFAULT_CHANNEL_ID,
    data: normalizedData,
    iosCategoryId: CHAT_REPLY_CATEGORY,
    title,
  });
};

/**
 * RESA-L6B-1 — N-20 au premier plan, ou en message de fond sur Android : la notification avec ses
 * deux boutons.
 * @param {{ title?: string, body?: string, data?: Record<string, any> }} payload
 * @returns {Promise<void>}
 */
export const displayResaVeilleActionableNotification = async ({
  body,
  data,
  title,
}) => {
  const normalizedData = normalizeNotificationPayload(data || {});
  await ensureNotificationActionSetup();
  await displayLocalNotification({
    androidActions: getResaVeilleAndroidActions(),
    body,
    channelId: NOTIFICATION_DEFAULT_CHANNEL_ID,
    data: normalizedData,
    iosCategoryId: RESA_VEILLE_CATEGORY,
    title,
  });
};

/**
 * RESA-L6B-1 — « Je confirme » / « J'annule » sans ouvrir l'app (E-P14) : la réponse part au nom
 * du compte que vise la notification (`POST /reservations-terrain/:id/veille`). Réussi : un mot
 * discret. Raté (réseau, réservation annulée entre-temps, créneau commencé) : JAMAIS de silence —
 * une notification visible, qui garde la charge : la toucher ouvre E-P14, qui dit où en est la
 * réservation.
 * @param {{ notificationData?: Record<string, any>, pressActionId?: string }} payload
 * @returns {Promise<{ handled: boolean, success?: boolean }>}
 */
export const handleResaVeilleActionPress = async ({
  notificationData,
  pressActionId,
}) => {
  const normalizedData = normalizeNotificationPayload(notificationData || {});
  if (!isResaVeilleActionablePayload(normalizedData)) {
    return { handled: false };
  }
  /** @type {Record<string, 'confirme' | 'annule'>} */
  const reponses = {
    [RESA_VEILLE_ACTION_ANNULER]: 'annule',
    [RESA_VEILLE_ACTION_CONFIRMER]: 'confirme',
  };
  const reponse = reponses[toSafeString(pressActionId)];
  if (!reponse) {
    return { handled: false };
  }
  const reservationId = toSafeString(normalizedData.reservationId).trim();

  try {
    const activationResult = await activateSessionForNotificationPayload(normalizedData);
    await repondreALaVeille(reservationId, reponse, {
      jeton: activationResult?.session?.token || null,
    });
    const feedback = reponse === 'confirme'
      ? {
        body: i18next.t('rsvpActions.resaVeille.confirme.body', 'Merci, c’est confirmé.'),
        title: i18next.t('rsvpActions.resaVeille.confirme.title', 'Réservation confirmée'),
      }
      : {
        body: i18next.t('rsvpActions.resaVeille.annule.body', 'Le créneau est libéré.'),
        title: i18next.t('rsvpActions.resaVeille.annule.title', 'Réservation annulée'),
      };
    await displayLocalNotification({
      body: feedback.body,
      channelId: NOTIFICATION_SILENT_CHANNEL_ID,
      title: feedback.title,
    });
    return { handled: true, success: true };
  } catch (error) {
    resaVeilleLogger.warn('[RESA_VEILLE_ACTION] Failed to answer the day-before question:', error);
    resaVeilleLogger.warn(
      `[NOTIF_ACTION_FAILED] type=${normalizedData?.type || 'unknown'}`
        + ` action=${pressActionId || 'unknown'} reservationId=${reservationId || 'unknown'}`,
    );
    await displayLocalNotification({
      body: i18next.t('rsvpActions.resaVeille.echec.body', 'Touche ici pour répondre dans l’app.'),
      // ⛔ PAS le canal silencieux : une réponse qui n'est pas partie doit se VOIR.
      channelId: NOTIFICATION_DEFAULT_CHANNEL_ID,
      data: normalizedData,
      title: i18next.t('rsvpActions.resaVeille.echec.title', 'Réponse non envoyée'),
    });
    return { handled: true, success: false };
  }
};

/**
 * @param {{ notificationData?: Record<string, any>, pressActionId?: string }} payload
 * @returns {Promise<{ handled: boolean, success?: boolean }>}
 */
export const handleEventRsvpActionPress = async ({
  notificationData,
  pressActionId,
}) => {
  const normalizedData = normalizeNotificationPayload(notificationData || {});
  if (!isEventRsvpActionablePayload(normalizedData)) {
    return { handled: false };
  }

  const answer = resolveAnswerFromAction(pressActionId);
  if (!answer) {
    return { handled: false };
  }

  const eventId = normalizedData?.eventId;
  if (eventId === undefined || eventId === null) {
    return { handled: false };
  }
  const notificationId = (typeof normalizedData?.notificationId === 'string'
    || typeof normalizedData?.notificationId === 'number')
    ? normalizedData.notificationId
    : undefined;

  try {
    const activationResult = await activateSessionForNotificationPayload(normalizedData);
    await sendRsvpAnswer(eventId, answer, notificationId, activationResult?.session?.token);

    const feedback = getRsvpFeedbackCopy(answer);
    await displayLocalNotification({
      body: feedback.body,
      channelId: NOTIFICATION_SILENT_CHANNEL_ID,
      title: feedback.title,
    });
    return { handled: true, success: true };
  } catch (error) {
    console.warn('[RSVP_ACTION] Failed to apply RSVP action:', error);
    console.warn(
      `[NOTIF_ACTION_FAILED] type=${normalizedData?.type || 'unknown'} action=${pressActionId || 'unknown'} eventId=${normalizedData?.eventId || 'unknown'}`,
    );
    await displayLocalNotification({
      body: i18next.t(
        'rsvpActions.notFinalized.body',
        "Ouvre l'application pour finaliser ta réponse.",
      ),
      channelId: NOTIFICATION_SILENT_CHANNEL_ID,
      data: normalizedData,
      title: i18next.t('rsvpActions.notFinalized.title', 'Action non finalisée'),
    });
    return { handled: true, success: false };
  }
};

/**
 * @param {{ notificationData?: Record<string, any>, pressActionId?: string, inputText?: string }} payload
 * @returns {Promise<{ handled: boolean, success?: boolean }>}
 */
export const handleChatReplyActionPress = async ({
  inputText,
  notificationData,
  pressActionId,
}) => {
  const normalizedData = normalizeNotificationPayload(notificationData || {});
  if (!isChatReplyActionablePayload(normalizedData)) {
    return { handled: false };
  }

  // REPNOTIF — DEUX boutons arrivent ici, et ils ne different que par l ENDROIT
  // ou le texte se trouve : la personne vient de l ecrire (`inputText`), ou
  // c est un REESSAI et il attend, range, dans la notification d echec.
  const estUnReessai = pressActionId === CHAT_REPLY_ACTION_RETRY;
  if (pressActionId !== CHAT_REPLY_ACTION_REPLY && !estUnReessai) {
    return { handled: false };
  }

  const replyText = estUnReessai
    ? toSafeString(normalizedData?.chatReplyRetryText).trim()
    : toSafeString(inputText).trim();
  if (!replyText) {
    return { handled: false };
  }

  const chatId = resolveChatIdFromNotification(normalizedData);
  if (!chatId) {
    return { handled: false };
  }

  try {
    const activationResult = await activateSessionForNotificationPayload(normalizedData);
    const sessionToken = activationResult?.session?.token;

    // 🔒 REPNOTIF — SANS LE JETON DU COMPTE VISE, ON N ENVOIE RIEN.
    //
    // Un telephone porte souvent PLUSIEURS comptes (memoire
    // `piege-un-telephone-plusieurs-comptes-notification`). Sans ce garde-fou,
    // la requete partait quand meme : le client y aurait mis le jeton du compte
    // ACTIF, et la reponse serait publiee dans la conversation SOUS LE NOM DE
    // QUELQU UN D AUTRE. Publier un message au nom d un tiers ne se rattrape
    // pas — mieux vaut un echec, d autant que le texte est desormais garde et
    // renvoyable d un bouton.
    if (!sessionToken) {
      throw new Error(`chat_reply_no_session:${activationResult?.reason || 'unknown'}`);
    }

    await sendChatReplyMessage(chatId, replyText, sessionToken);

    const feedback = getChatReplyFeedbackCopy();
    await displayLocalNotification({
      body: feedback.body,
      channelId: NOTIFICATION_SILENT_CHANNEL_ID,
      title: feedback.title,
    });
    return { handled: true, success: true };
  } catch (error) {
    console.warn('[CHAT_REPLY_ACTION] Failed to send quick reply:', error);
    console.warn(
      `[NOTIF_ACTION_FAILED] type=${normalizedData?.type || 'unknown'} action=${pressActionId || 'unknown'} chatId=${chatId || 'unknown'}`,
    );
    const feedback = getChatReplyFailureCopy(replyText);
    await displayLocalNotification({
      androidActions: getChatReplyRetryAndroidActions(),
      body: feedback.body,
      // ⛔ PAS le canal silencieux, contrairement aux confirmations : un message
      // qui n est pas parti doit se VOIR. Une perte silencieuse est exactement
      // ce que ce lot devait empecher.
      channelId: NOTIFICATION_DEFAULT_CHANNEL_ID,
      data: { ...normalizedData, chatReplyRetryText: replyText },
      iosCategoryId: CHAT_REPLY_RETRY_CATEGORY,
      title: feedback.title,
    });
    return { handled: true, success: false };
  }
};

/**
 * @param {Record<string, any>} data
 */
export const storePendingOpenNotification = (data) => {
  try {
    const normalizedData = normalizeNotificationPayload(data || {});
    notificationStorage.set(
      NOTIFICATION_PENDING_OPEN_KEY,
      JSON.stringify(normalizedData),
    );
  } catch (error) {
    console.warn('[NotificationAction] Failed to persist pending notification:', error);
  }
};

/**
 * @returns {Record<string, any> | null}
 */
export const consumePendingOpenNotification = () => {
  try {
    const serialized = notificationStorage.getString(NOTIFICATION_PENDING_OPEN_KEY);
    if (!serialized) return null;
    notificationStorage.delete(NOTIFICATION_PENDING_OPEN_KEY);
    const parsed = JSON.parse(serialized);
    return normalizeNotificationPayload(parsed || {});
  } catch (error) {
    console.warn('[NotificationAction] Failed to consume pending notification:', error);
    notificationStorage.delete(NOTIFICATION_PENDING_OPEN_KEY);
    return null;
  }
};
