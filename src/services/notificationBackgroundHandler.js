import notifee, { EventType } from '@notifee/react-native';
import { getApp } from '@react-native-firebase/app';
import { getMessaging, setBackgroundMessageHandler } from '@react-native-firebase/messaging';
import { Platform } from 'react-native';

import { normalizeNotificationPayload } from '@/utils/notifications/notificationNavigation';

import {
  displayEventRsvpActionableNotification,
  ensureNotificationActionSetup,
  handleEventRsvpActionPress,
  isEventRsvpActionablePayload,
  storePendingOpenNotification,
} from './notificationActions/rsvpActions';

let handlersRegistered = false;

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
  || 'Repondez rapidement: present ou absent.';

// This handler must be outside of the React lifecycle to handle background/quit state messages
export const registerBackgroundHandler = () => {
  if (handlersRegistered) return;
  handlersRegistered = true;

  ensureNotificationActionSetup().catch((error) => {
    console.warn('[NotificationBackground] Failed to setup action categories:', error);
  });

  const messagingInstance = getMessaging(getApp());

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
      }
    } catch (error) {
      console.warn('[NotificationBackground] Failed to process FCM message:', error);
    }
    return Promise.resolve();
  });

  notifee.onBackgroundEvent(async ({ detail, type }) => {
    try {
      if (type === EventType.ACTION_PRESS) {
        await handleEventRsvpActionPress({
          notificationData: detail.notification?.data || {},
          pressActionId: detail?.pressAction?.id,
        });
        if (detail.notification?.id) {
          await notifee.cancelNotification(detail.notification.id);
        }
        return;
      }

      if (type === EventType.PRESS && detail.notification?.data) {
        const normalizedData = normalizeNotificationPayload(detail.notification.data);
        if (normalizedData?.type) {
          console.log(`[NOTIF_OPENED] type=${normalizedData.type} source=background_notifee_press`);
        }
        storePendingOpenNotification(normalizedData);
      }
    } catch (error) {
      console.warn('[NotificationBackground] Failed to process notifee background event:', error);
    }
  });
};
