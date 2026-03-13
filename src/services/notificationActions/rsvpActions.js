import notifee from '@notifee/react-native';
import { MMKV } from 'react-native-mmkv';

import client from '@/services/client';

import { normalizeNotificationPayload } from '@/utils/notifications/notificationNavigation';
import { NOTIFICATION_TYPES } from '@/utils/notifications/notificationTypes';

import {
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
const getFeedbackCopy = (answer) => (answer === 'present'
  ? {
    body: 'Votre presence est enregistrée.',
    title: 'Presence confirmee',
  }
  : {
    body: 'Votre absence est enregistrée.',
    title: 'Absence confirmee',
  });

/**
 * @param {string | number} eventId
 * @param {'present' | 'absent'} answer
 * @param {string | number | undefined} notificationId
 * @returns {Promise<any>}
 */
const sendRsvpAnswer = async (eventId, answer, notificationId) => {
  const response = await client.post(`/events/${eventId}/rsvp`, {
    answer,
    notificationId,
    source: 'push_action',
  });
  return response.data;
};

/**
 * @param {{
 *  title?: string,
 *  body?: string,
 *  data?: Record<string, any>,
 *  channelId?: string,
 *  isActionable?: boolean,
 * }} payload
 * @returns {Promise<void>}
 */
const displayLocalNotification = async ({
  body,
  channelId = NOTIFICATION_DEFAULT_CHANNEL_ID,
  data,
  isActionable = false,
  title,
}) => {
  const androidConfig = /** @type {any} */ ({
    actions: isActionable
      ? [
        {
          pressAction: { id: EVENT_RSVP_ACTION_PRESENT },
          title: 'Present',
        },
        {
          pressAction: { id: EVENT_RSVP_ACTION_ABSENT },
          title: 'Absent',
        },
      ]
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
      categoryId:
        isActionable
          ? EVENT_RSVP_CATEGORY
          : undefined,
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
    body,
    channelId: NOTIFICATION_DEFAULT_CHANNEL_ID,
    data: normalizedData,
    isActionable: true,
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
    await sendRsvpAnswer(eventId, answer, notificationId);

    const feedback = getFeedbackCopy(answer);
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
      body: "Ouvrez l'application pour finaliser votre réponse.",
      channelId: NOTIFICATION_SILENT_CHANNEL_ID,
      data: normalizedData,
      title: 'Action non finalisee',
    });
    return { handled: true, success: false };
  }
};

/**
 * @param {Record<string, any>} data
 */
export const storePendingOpenNotification = (data) => {
  try {
    notificationStorage.set(
      NOTIFICATION_PENDING_OPEN_KEY,
      JSON.stringify(data || {}),
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
