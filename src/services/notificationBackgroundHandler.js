import notifee, { EventType } from '@notifee/react-native';
import { getApp } from '@react-native-firebase/app';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import { Platform } from 'react-native';

import { createLogger } from '@/utils/logger/logger';
import { normalizeNotificationPayload } from '@/utils/notifications/notificationNavigation';

import {
  displayChatReplyActionableNotification,
  displayEventRsvpActionableNotification,
  ensureNotificationActionSetup,
  handleChatReplyActionPress,
  handleEventRsvpActionPress,
  isChatReplyActionablePayload,
  isEventRsvpActionablePayload,
  storePendingOpenNotification,
} from './notificationActions/rsvpActions';

let handlersRegistered = false;
const notificationsBgLogger = createLogger('notifications-bg');

const getMessagingInstanceSafe = () => {
  try {
    return getMessaging(getApp());
  } catch (error) {
    notificationsBgLogger.warn('Messaging background handler unavailable', error);
    return null;
  }
};

/**
 * @param {any} remoteMessage
 * @param {Record<string, any>} data
 * @returns {string}
 */
const resolvePushTitle = (remoteMessage, data) => remoteMessage?.notification?.title || data?.title || 'Rappel evenement';

/**
 * @param {any} remoteMessage
 * @param {Record<string, any>} data
 * @returns {string}
 */
const resolvePushBody = (remoteMessage, data) => remoteMessage?.notification?.body
  || data?.body
  || 'Repondez rapidement : present ou absent.';

// This handler must be outside of the React lifecycle to handle background/quit state messages
export const registerBackgroundHandler = () => {
  if (handlersRegistered) return;
  handlersRegistered = true;

  ensureNotificationActionSetup().catch((error) => {
    notificationsBgLogger.warn('Failed to setup action categories', error);
  });

  const messagingInstance = getMessagingInstanceSafe();
  if (!messagingInstance) {
    notificationsBgLogger.warn('Skipping background FCM registration: messaging unavailable');
    return;
  }

  setBackgroundMessageHandler(messagingInstance, async (/** @type {any} */ remoteMessage) => {
    try {
      const normalizedData = normalizeNotificationPayload(remoteMessage?.data || {});
      if (
        Platform.OS === 'android'
        && isEventRsvpActionablePayload(normalizedData)
      ) {
        await displayEventRsvpActionableNotification({
          body: resolvePushBody(remoteMessage, normalizedData),
          data: normalizedData,
          title: resolvePushTitle(remoteMessage, normalizedData),
        });
      } else if (
        Platform.OS === 'android'
        && isChatReplyActionablePayload(normalizedData)
      ) {
        await displayChatReplyActionableNotification({
          body: resolvePushBody(remoteMessage, normalizedData),
          data: normalizedData,
          title: resolvePushTitle(remoteMessage, normalizedData),
        });
      }
    } catch (error) {
      notificationsBgLogger.warn('Failed to process FCM background message', error);
    }
    return Promise.resolve();
  });

  notifee.onBackgroundEvent(async ({ detail, type }) => {
    try {
      if (type === EventType.ACTION_PRESS) {
        const chatReplyResult = await handleChatReplyActionPress({
          inputText: detail.input,
          notificationData: detail.notification?.data || {},
          pressActionId: detail?.pressAction?.id,
        });
        if (chatReplyResult?.handled) {
          if (detail.notification?.id) {
            await notifee.cancelNotification(detail.notification.id);
          }
          return;
        }

        const rsvpResult = await handleEventRsvpActionPress({
          notificationData: detail.notification?.data || {},
          pressActionId: detail?.pressAction?.id,
        });
        if (rsvpResult?.handled && detail.notification?.id) {
          await notifee.cancelNotification(detail.notification.id);
        }
        return;
      }

      if (type === EventType.PRESS && detail.notification?.data) {
        const normalizedData = normalizeNotificationPayload(detail.notification.data);
        if (normalizedData?.type) {
          notificationsBgLogger.debug(
            `[NOTIF_OPENED] type=${normalizedData.type} source=background_notifee_press`,
          );
        }
        storePendingOpenNotification(normalizedData);
      }
    } catch (error) {
      notificationsBgLogger.warn('Failed to process notifee background event', error);
    }
  });
};
