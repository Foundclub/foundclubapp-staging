import notifee from '@notifee/react-native';
import { MMKV } from 'react-native-mmkv';

import { activateSessionForNotificationPayload } from '@/domains/auth/authUseCases';

import client from '@/services/client';

import {
  normalizeNotificationPayload,
} from '@/utils/notifications/notificationNavigation';
import { NOTIFICATION_TYPES } from '@/utils/notifications/notificationTypes';

import {
  CHAT_REPLY_ACTION_CONTEXT,
  CHAT_REPLY_ACTION_REPLY,
  CHAT_REPLY_CATEGORY,
  EVENT_RSVP_ACTION_ABSENT,
  EVENT_RSVP_ACTION_CONTEXT,
  EVENT_RSVP_ACTION_PRESENT,
  EVENT_RSVP_CATEGORY,
  NOTIFICATION_DEFAULT_CHANNEL_ID,
  NOTIFICATION_PENDING_OPEN_KEY,
  NOTIFICATION_SILENT_CHANNEL_ID,
} from './constants';

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
  NOTIFICATION_TYPES.NEW_GROUP_MESSAGE,
  NOTIFICATION_TYPES.NEW_LEAGUE_MATCH_MESSAGE,
  NOTIFICATION_TYPES.NEW_TEAM_MESSAGE,
  NOTIFICATION_TYPES.NEW_TEAM_PLAYER_MESSAGE,
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
    body: 'Ta présence est enregistrée.',
    title: 'Présence confirmée',
  }
  : {
    body: 'Ton absence est enregistrée.',
    title: 'Absence confirmée',
  });

const getChatReplyFeedbackCopy = () => ({
  body: 'Ta réponse a été envoyée.',
  title: 'Réponse envoyée',
});

const getChatReplyFailureCopy = () => ({
  body: "Ouvre l'application pour finaliser ta réponse.",
  title: 'Action non finalisée',
});

const getChatReplyAndroidActions = () => ([
  {
    input: {
      allowFreeFormInput: true,
      placeholder: 'Ta réponse',
    },
    pressAction: { id: CHAT_REPLY_ACTION_REPLY },
    title: 'Repondre',
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
          title: 'Present',
        },
        {
          id: EVENT_RSVP_ACTION_ABSENT,
          title: 'Absent',
        },
      ],
      id: EVENT_RSVP_CATEGORY,
    },
    {
      actions: [
        {
          id: CHAT_REPLY_ACTION_REPLY,
          input: {
            buttonText: 'Envoyer',
            placeholderText: 'Ta réponse',
          },
          title: 'Repondre',
        },
      ],
      id: CHAT_REPLY_CATEGORY,
    },
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
    androidActions: [
      {
        pressAction: { id: EVENT_RSVP_ACTION_PRESENT },
        title: 'Present',
      },
      {
        pressAction: { id: EVENT_RSVP_ACTION_ABSENT },
        title: 'Absent',
      },
    ],
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
      body: "Ouvre l'application pour finaliser ta réponse.",
      channelId: NOTIFICATION_SILENT_CHANNEL_ID,
      data: normalizedData,
      title: 'Action non finalisée',
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

  if (pressActionId !== CHAT_REPLY_ACTION_REPLY) {
    return { handled: false };
  }

  const replyText = toSafeString(inputText).trim();
  if (!replyText) {
    return { handled: false };
  }

  const chatId = resolveChatIdFromNotification(normalizedData);
  if (!chatId) {
    return { handled: false };
  }

  try {
    const activationResult = await activateSessionForNotificationPayload(normalizedData);
    await sendChatReplyMessage(chatId, replyText, activationResult?.session?.token);

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
    const feedback = getChatReplyFailureCopy();
    await displayLocalNotification({
      body: feedback.body,
      channelId: NOTIFICATION_SILENT_CHANNEL_ID,
      data: normalizedData,
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
