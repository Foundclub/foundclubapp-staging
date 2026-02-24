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
let notificationDepsCache = null;

const getSafeProperty = (target, propertyName) => {
  if (!target) return undefined;
  try {
    return target[propertyName];
  } catch (_error) {
    return undefined;
  }
};

/**
 * Lazy-load notification native deps so startup never crashes when a native
 * notification module is unavailable in a given build.
 * @returns {{
 *  notifee: any,
 *  EventType: Record<string, any>,
 *  getMessagingInstance: () => any,
 *  setBackgroundMessageHandler: (messaging: any, handler: any) => void
 * } | null}
 */
const getNotificationDeps = () => {
  if (notificationDepsCache) return notificationDepsCache;
  try {
    // eslint-disable-next-line global-require
    const notifeeModule = require('@notifee/react-native');
    // eslint-disable-next-line global-require
    const firebaseAppModule = require('@react-native-firebase/app');
    // eslint-disable-next-line global-require
    const firebaseMessagingModule = require('@react-native-firebase/messaging');

    const notifeeExport = getSafeProperty(notifeeModule, 'default') || notifeeModule;
    const firebaseAppExport = getSafeProperty(firebaseAppModule, 'default') || firebaseAppModule;
    const firebaseMessagingExport = getSafeProperty(firebaseMessagingModule, 'default') || firebaseMessagingModule;

    const resolveDefaultApp = () => {
      const getAppFromModule = getSafeProperty(firebaseAppModule, 'getApp');
      const getAppFromExport = getSafeProperty(firebaseAppExport, 'getApp');
      const namespacedAppGetter = getSafeProperty(firebaseAppExport, 'app');

      if (typeof getAppFromModule === 'function') return getAppFromModule();
      if (typeof getAppFromExport === 'function') return getAppFromExport();
      if (typeof namespacedAppGetter === 'function') return namespacedAppGetter();
      return undefined;
    };

    const getMessagingInstance = () => {
      const defaultApp = resolveDefaultApp();
      const getMessagingFromModule = getSafeProperty(firebaseMessagingModule, 'getMessaging');
      const getMessagingFromExport = getSafeProperty(firebaseMessagingExport, 'getMessaging');
      const moduleFactory = getSafeProperty(firebaseMessagingModule, 'default');

      if (typeof getMessagingFromModule === 'function') return getMessagingFromModule(defaultApp);
      if (typeof getMessagingFromExport === 'function') return getMessagingFromExport(defaultApp);
      if (typeof moduleFactory === 'function') return moduleFactory();
      if (typeof firebaseMessagingExport === 'function') return firebaseMessagingExport();
      return null;
    };

    const safeNotifee = {
      cancelNotification: async () => {},
      onBackgroundEvent: () => {},
      ...(notifeeExport && typeof notifeeExport === 'object' ? notifeeExport : {}),
    };

    notificationDepsCache = {
      EventType: getSafeProperty(notifeeModule, 'EventType') || getSafeProperty(safeNotifee, 'EventType') || {},
      getMessagingInstance,
      notifee: safeNotifee,
      setBackgroundMessageHandler: (messagingInstance, handler) => {
        if (
          messagingInstance
          && typeof messagingInstance.setBackgroundMessageHandler === 'function'
        ) {
          messagingInstance.setBackgroundMessageHandler(handler);
          return;
        }

        const modularSetBackgroundHandler = getSafeProperty(firebaseMessagingExport, 'setBackgroundMessageHandler')
          || getSafeProperty(firebaseMessagingModule, 'setBackgroundMessageHandler');
        if (typeof modularSetBackgroundHandler === 'function') {
          if (messagingInstance) {
            try {
              modularSetBackgroundHandler(messagingInstance, handler);
              return;
            } catch (_error) {
              // fallback below for signatures expecting only handler
            }
          }
          modularSetBackgroundHandler(handler);
        }
      },
    };
    return notificationDepsCache;
  } catch (error) {
    console.warn('[NotificationBackground] Native notification deps unavailable:', error);
    return null;
  }
};

/**
 * Safely resolve messaging instance without crashing app startup when
 * Firebase default app is not initialized yet.
 * @returns {import('@react-native-firebase/messaging').FirebaseMessagingTypes.Module | null}
 */
const getMessagingInstanceSafely = () => {
  const deps = getNotificationDeps();
  if (!deps) return null;
  try {
    return deps.getMessagingInstance();
  } catch (error) {
    console.warn('[NotificationBackground] Firebase app unavailable, background handler disabled:', error);
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
  || 'Repondez rapidement: present ou absent.';

// This handler must be outside of the React lifecycle to handle background/quit state messages
export const registerBackgroundHandler = () => {
  if (handlersRegistered) return;
  handlersRegistered = true;

  const deps = getNotificationDeps();
  if (!deps) return;

  ensureNotificationActionSetup().catch((error) => {
    console.warn('[NotificationBackground] Failed to setup action categories:', error);
  });

  const messagingInstance = getMessagingInstanceSafely();
  if (messagingInstance) {
    deps.setBackgroundMessageHandler(messagingInstance, async (/** @type {any} */ remoteMessage) => {
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
  }

  deps.notifee.onBackgroundEvent(async ({ detail, type }) => {
    try {
      if (type === deps.EventType.ACTION_PRESS) {
        await handleEventRsvpActionPress({
          notificationData: detail.notification?.data || {},
          pressActionId: detail?.pressAction?.id,
        });
        if (detail.notification?.id) {
          await deps.notifee.cancelNotification(detail.notification.id);
        }
        return;
      }

      if (type === deps.EventType.PRESS && detail.notification?.data) {
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
