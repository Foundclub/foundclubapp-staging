import notifee, { EventType } from '@notifee/react-native';
import { getApp } from '@react-native-firebase/app';
import {
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  requestPermission,
} from '@react-native-firebase/messaging';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import {
  Alert, Linking, PermissionsAndroid, Platform,
} from 'react-native';
import { MMKV } from 'react-native-mmkv';

import useAuth from '@/domains/auth/useAuth';

import { addDeviceToken } from '@/services/auth/authService';
import {
  consumePendingOpenNotification,
  displayEventRsvpActionableNotification,
  ensureNotificationActionSetup,
  handleEventRsvpActionPress,
  isEventRsvpActionablePayload,
} from '@/services/notificationActions/rsvpActions';

import {
  normalizeNotificationPayload,
  resolveNotificationDestination,
} from '@/utils/notifications/notificationNavigation';
import { NOTIFICATION_TYPES } from '@/utils/notifications/notificationTypes';

import { RouteNames } from '../navigation/routeNames';
import { useAppContext } from '../store/appContext';

// Create a storage instance for notifications
/** @type {MMKV | null} */
let notificationStorageInstance = null;

/** @returns {MMKV} */
const getNotificationStorage = () => {
  if (!notificationStorageInstance) {
    notificationStorageInstance = new MMKV({
      id: 'notifications-storage',
    });
  }
  return notificationStorageInstance;
};

const notificationStorage = {
  /** @param {string} key */
  getString: (key) => getNotificationStorage().getString(key),
  /**
   * @param {string} key @param {string | number | boolean} value
   * @param value
   */
  set: (key, value) => getNotificationStorage().set(key, value),
  /** @param {string} key */
  contains: (key) => getNotificationStorage().contains(key),
};

/**
 * Check if a notification is a duplicate based on its messageId
 * @param {string} [messageId]
 * @returns {boolean}
 */
const isNotificationDuplicate = (messageId) => {
  if (!messageId) return false;
  const lastNotificationId = notificationStorage.getString('last-notification-id');
  if (lastNotificationId === messageId) {
    return true;
  }
  notificationStorage.set('last-notification-id', messageId);
  return false;
};

/**
 * @param {string | number | Date} dateInput
 * @returns {string | null}
 */
const formatDateForGoogleCalendar = (dateInput) => {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return null;
  /** @param {number} value */
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
};

const requestUserPermission = async () => {
  const messagingInstance = getMessaging(getApp());

  if (Platform.OS === 'ios') {
    try {
      // Then request permission
      await requestPermission(messagingInstance);
    } catch (error) {
      throw new Error(`Failed to request permission: ${error}`);
    }
  }

  if (Platform.OS === 'android') {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }
};

/**
 * Display notification when app is open
 * @param {{title: string, body: string, data: any}} param - Notification data
 * @returns {Promise<void>}
 */
const onDisplayNotification = async ({ body, data, title }) => {
  const normalizedData = normalizeNotificationPayload(data || {});
  await ensureNotificationActionSetup();

  if (isEventRsvpActionablePayload(normalizedData)) {
    await displayEventRsvpActionableNotification({
      body,
      data: normalizedData,
      title,
    });
    return;
  }

  if (title || body) {
    // Display a notification
    await notifee.displayNotification({
      android: {
        channelId: 'default',
        importance: 4,
        pressAction: {
          id: 'default',
        },
        smallIcon: 'ic_notification',
        sound: 'default',
      },
      body,
      data: /** @type {any} */ (normalizedData),
      ios: {
        critical: true,
        foregroundPresentationOptions: {
          alert: true,
          badge: true,
          sound: true,
        },
        sound: 'default',
      },
      title,
    });
  }
};

/**
 * Handle notifications for the application
 * @param {{
 *  navigate: (routeName: string, params?: Record<string, unknown>) => boolean | void;
 *  onSmartNotification?: (payload: any) => void;
 * }} props - The props
 * @inheritdoc
 */
const useNotifications = ({ navigate, onSmartNotification }) => {
  // hooks
  const [{ pendingNotification }, dispatch] = useAppContext();
  const { userData } = useAuth();

  const { mutate: saveTokenMutation } = useMutation({
    meta: {
      preventToastError: true,
    },
    mutationFn: addDeviceToken,
    onError: (error) => {
      const typedError = /** @type {any} */ (error);
      const statusCode = typedError?.status || typedError?.response?.status;
      if (statusCode === 401 || statusCode === 403) {
        console.warn('[FCM] Token registration denied by backend permissions/auth. Notifications disabled for this session.');
      } else {
        console.error('[FCM] Failed to save token to backend:', typedError);
      }
      dispatch({ payload: undefined, type: 'SET_FCM_TOKEN' });
    },
    onSuccess: (_, token) => {
      console.log('[FCM] Token saved to backend successfully');
      dispatch({ payload: token, type: 'SET_FCM_TOKEN' });
    },
  });

  // api calls
  const saveToken = useCallback((/** @type {string} */token) => {
    if (token) {
      console.log('[FCM] Calling saveTokenMutation with token:', `${token.substring(0, 20)}...`);
      saveTokenMutation(token);
    }
  }, [saveTokenMutation]);

  const smartNotifEnabled = useRef((() => {
    const raw = process.env.LEAGUE_SMART_NOTIF_V1;
    if (typeof raw === 'string' && raw.length > 0) {
      return raw.trim().toLowerCase() === 'true';
    }
    return __DEV__;
  })());
  const promptedCalendarMatchesRef = useRef(/** @type {Set<string>} */ (new Set()));

  useEffect(() => {
    ensureNotificationActionSetup().catch((error) => {
      console.warn('[Notifications] Failed to setup notification actions:', error);
    });
  }, []);

  /**
   * @typedef {{
   *  type?: string;
   *  matchDate?: string;
   *  date?: string;
   *  teamName?: string;
   *  opponentName?: string;
   *  venue?: string;
   *  location?: string;
   *  matchId?: string;
   *  dedupeKey?: string;
   *  [key: string]: any;
   * }} NotificationData
   */

  const openCalendarFromNotification = useCallback(async (/** @type {NotificationData} */ notificationData) => {
    const startIso = notificationData?.matchDate || notificationData?.date;
    const startDate = startIso ? new Date(startIso) : new Date();
    const endDate = new Date(startDate.getTime() + (60 * 60 * 1000));
    const startParam = formatDateForGoogleCalendar(startDate);
    const endParam = formatDateForGoogleCalendar(endDate);
    if (!startParam || !endParam) return;

    const text = encodeURIComponent(`Match FoundClub League - ${notificationData?.teamName || 'Squad'}`);
    const details = encodeURIComponent(`Match confirme contre ${notificationData?.opponentName || 'adversaire'}`);
    const location = encodeURIComponent(notificationData?.venue || notificationData?.location || '');
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${startParam}/${endParam}&details=${details}&location=${location}`;
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.warn('[Calendar] Failed to open calendar URL:', error);
    }
  }, []);

  const maybePromptAddToCalendar = useCallback((/** @type {NotificationData | undefined} */ notificationData) => {
    if (!notificationData || notificationData.type !== NOTIFICATION_TYPES.LEAGUE_PROPOSAL_ACCEPTED) return;
    const key = notificationData.matchId || notificationData.dedupeKey;
    if (!key) return;
    if (promptedCalendarMatchesRef.current.has(key)) return;
    promptedCalendarMatchesRef.current.add(key);

    Alert.alert(
      'Match confirme',
      'Ajouter ce match a votre agenda ?',
      [
        { style: 'cancel', text: 'Plus tard' },
        {
          onPress: () => openCalendarFromNotification(notificationData),
          text: 'Ajouter',
        },
      ],
    );
  }, [openCalendarFromNotification]);

  // methods
  const handleNavigateOnOpen = useCallback((/** @type {any} */ remoteMessageData) => {
    const notificationData = normalizeNotificationPayload(remoteMessageData);
    console.log('[useNotifications] handleNavigateOnOpen triggered with:', notificationData);
    if (!notificationData?.type) {
      console.warn('[useNotifications] No type in notification data, cannot navigate');
      const fallback = navigate(RouteNames.NotificationList);
      return fallback !== false;
    }

    if (notificationData.type === NOTIFICATION_TYPES.LEAGUE_PROPOSAL_ACCEPTED) {
      maybePromptAddToCalendar(/** @type {NotificationData} */ (notificationData));
    }

    const tryNavigate = (/** @type {string} */ routeName, /** @type {Record<string, unknown> | undefined} */ params) => {
      const navigated = navigate(routeName, params);
      if (navigated === false) {
        const fallback = navigate(RouteNames.NotificationList);
        return fallback !== false;
      }
      return true;
    };

    const destination = resolveNotificationDestination(notificationData);
    if (!destination?.route) {
      console.warn('[useNotifications] Unknown notification type:', notificationData.type);
      const fallback = navigate(RouteNames.NotificationList);
      console.log(`[NOTIF_OPENED] type=${notificationData.type} route=${RouteNames.NotificationList} fallback=invalid_destination`);
      return fallback !== false;
    }

    const handled = tryNavigate(destination.route, destination.params || {});
    console.log(`[NOTIF_OPENED] type=${notificationData.type} route=${destination.route} handled=${Boolean(handled)}`);
    return handled;
  }, [navigate, maybePromptAddToCalendar]);

  const smartForegroundTypes = useRef(new Set([
    NOTIFICATION_TYPES.LEAGUE_MATCH_DISPUTED,
    NOTIFICATION_TYPES.LEAGUE_MATCH_FINALIZED,
    NOTIFICATION_TYPES.LEAGUE_MATCH_FOUND,
    NOTIFICATION_TYPES.LEAGUE_MATCH_VALIDATED,
    NOTIFICATION_TYPES.LEAGUE_PROPOSAL_ACCEPTED,
    NOTIFICATION_TYPES.LEAGUE_PROPOSAL_RECEIVED,
    NOTIFICATION_TYPES.LEAGUE_SCORE_ADMIN_ESCALATED,
    NOTIFICATION_TYPES.LEAGUE_SCORE_DEADLINE_WARNING,
    NOTIFICATION_TYPES.LEAGUE_SCORE_DISPUTED_BY_OPPONENT,
    NOTIFICATION_TYPES.LEAGUE_SCORE_DUE,
    NOTIFICATION_TYPES.LEAGUE_SCORE_END_DUE,
    NOTIFICATION_TYPES.LEAGUE_SCORE_REMINDER_2H,
    NOTIFICATION_TYPES.LEAGUE_SCORE_START_INFO,
    NOTIFICATION_TYPES.LEAGUE_SCORE_SUBMITTED_BY_OPPONENT,
    NOTIFICATION_TYPES.LEAGUE_SEARCH_RELAUNCH_PROMPT,
    NOTIFICATION_TYPES.LEAGUE_SQUAD_JOIN_REQUEST,
    NOTIFICATION_TYPES.LEAGUE_VENUE_BOOKED,
    NOTIFICATION_TYPES.MATCH_FOUND,
  ]));

  // listeners
  // Handle foreground notif display
  useEffect(() => {
    const messagingInstance = getMessaging(getApp());
    const unsubscribe = onMessage(messagingInstance, async (remoteMessage) => {
      const normalizedData = normalizeNotificationPayload(remoteMessage.data || {});
      // Skip notification display for message types that shouldn't show in foreground
      const skipTypes = [
        '',
        // NOTIFICATION_TYPES.NEW_TEAM_MESSAGE,
        // NOTIFICATION_TYPES.NEW_TEAM_PLAYER_MESSAGE,
        // NOTIFICATION_TYPES.NEW_WHISPER,
      ];

      const messageType = normalizedData?.type;
      if (messageType && typeof messageType === 'string' && skipTypes.includes(messageType)) {
        return;
      }

      if (messageType === NOTIFICATION_TYPES.LEAGUE_PROPOSAL_ACCEPTED) {
        maybePromptAddToCalendar(/** @type {NotificationData} */ (normalizedData));
      }

      if (
        smartNotifEnabled.current
        && messageType
        && smartForegroundTypes.current.has(messageType)
        && onSmartNotification
      ) {
        onSmartNotification({
          ...normalizedData,
          body: remoteMessage.notification?.body || '',
          title: remoteMessage.notification?.title || '',
        });
        return;
      }

      // Check for duplicate notifications using messageId
      const { messageId } = remoteMessage;
      if (isNotificationDuplicate(messageId)) {
        return;
      }

      const fallbackBody = typeof normalizedData?.body === 'string' ? normalizedData.body : '';
      const fallbackTitle = typeof normalizedData?.title === 'string' ? normalizedData.title : '';

      onDisplayNotification({
        body: remoteMessage.notification?.body || fallbackBody,
        data: remoteMessage.data || {},
        title: remoteMessage.notification?.title || fallbackTitle,
      });
    });
    return unsubscribe;
  }, [onSmartNotification, maybePromptAddToCalendar]);

  // open notification when app is in foreground
  useEffect(() => notifee.onForegroundEvent(async ({ detail, type }) => {
    if (type === EventType.ACTION_PRESS) {
      const result = await handleEventRsvpActionPress({
        notificationData: detail.notification?.data || {},
        pressActionId: detail?.pressAction?.id,
      });
      if (result?.handled && detail.notification?.id) {
        await notifee.cancelNotification(detail.notification.id);
      }
      return;
    }

    if (type === EventType.PRESS) {
      if (detail.notification?.data?.type) {
        handleNavigateOnOpen(
          normalizeNotificationPayload(detail.notification.data),
        );
      }
    }
  }), [handleNavigateOnOpen]);

  const hasSynced = useRef(false);

  // Get FCM token
  useEffect(() => {
    const retreiveFCMToken = async () => {
      try {
        console.log('[FCM] Starting token retrieval...');
        const messagingInstance = getMessaging(getApp());

        if (Platform.OS === 'ios') {
          console.log('[FCM] iOS detected - requesting permissions...');
          // Ensure device is registered and has permissions
          const permResult = await requestUserPermission();
          console.log('[FCM] Permission result:', permResult);

          // Double check registration
          const registered = await messagingInstance.isDeviceRegisteredForRemoteMessages;
          console.log('[FCM] Device registered for remote messages:', registered);
          if (!registered) {
            console.log('[FCM] Registering device for remote messages...');
            await messagingInstance.registerDeviceForRemoteMessages();
            console.log('[FCM] Device registered successfully');
          }
        } else {
          // For Android, just request permission
          const permissionGranted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          );
          console.log('[FCM] Android permission granted:', permissionGranted);
          if (!permissionGranted) {
            await requestUserPermission();
          }
        }

        // Finally get FCM token
        console.log('[FCM] Getting FCM token...');
        const token = await getToken(messagingInstance);
        console.log('[FCM] Token received:', token ? `${token.substring(0, 20)}...` : 'null');
        if (token) {
          console.log('[FCM] Saving token to backend...');
          saveToken(token);
        } else {
          throw new Error('Failed to get FCM token');
        }
      } catch (err) {
        const typedError = /** @type {any} */ (err);
        const errorMessage = typeof typedError === 'string' ? typedError : typedError?.message || JSON.stringify(typedError);
        if (errorMessage.includes('FIS_AUTH_ERROR')) {
          console.warn('[FCM] Firebase Auth failed (SHA-1 mismatch in Local). Notifications skipped.');
        } else {
          console.error('[FCM] Error retrieving token:', typedError);
        }
        // Do not throw error here to prevent app crash
        // throw new Error(`Failed to retrieve token: ${err}`);
      }
    };

    console.log('[FCM] useEffect triggered - userData:', !!userData, 'hasSynced:', hasSynced.current);
    if (userData && !hasSynced.current) {
      hasSynced.current = true;
      retreiveFCMToken();
    }

    const queuePendingNotification = (
      /** @type {Record<string, any> | undefined | null} */ payload,
      /** @type {string} */ source,
    ) => {
      if (payload?.type) {
        console.log(`[FCM] Storing pending notification from ${source}`);
        dispatch({
          payload,
          type: 'SET_PENDING_NOTIFICATION',
        });
      }
    };

    const messagingInstance = getMessaging(getApp());

    // Check for initial notification (Cold Start) - Firebase remote push
    messagingInstance.getInitialNotification().then((remoteMessage) => {
      if (remoteMessage) {
        console.log('[FCM] App opened from QUIT state by notification:', remoteMessage);
        const normalizedData = normalizeNotificationPayload(remoteMessage.data || {});
        queuePendingNotification(normalizedData, 'fcm');
      }
    });

    // Handle app opened from BACKGROUND state by Firebase remote push.
    const unsubscribeNotificationOpened = onNotificationOpenedApp(messagingInstance, (remoteMessage) => {
      if (!remoteMessage) return;
      const normalizedData = normalizeNotificationPayload(remoteMessage.data || {});
      if (normalizedData?.type) {
        console.log(`[NOTIF_OPENED] type=${normalizedData.type} source=background_push`);
      }
      queuePendingNotification(normalizedData, 'fcm-background');
    });

    // Check Notifee initial notification (local/actionable notifications)
    notifee.getInitialNotification().then((initialNotification) => {
      const normalizedData = normalizeNotificationPayload(
        initialNotification?.notification?.data || {},
      );
      queuePendingNotification(normalizedData, 'notifee');
    });

    // Consume pending open intent captured by background headless handler
    const storedPending = consumePendingOpenNotification();
    queuePendingNotification(storedPending, 'storage');

    return () => {
      unsubscribeNotificationOpened();
    };
  }, [saveToken, userData, dispatch]);

  useEffect(() => {
    if (!pendingNotification?.type) return undefined;
    let attempts = 0;
    const maxAttempts = 20;
    const interval = setInterval(() => {
      const handled = handleNavigateOnOpen(/** @type {any} */ (pendingNotification));
      if (handled || attempts >= maxAttempts) {
        dispatch({ payload: null, type: 'SET_PENDING_NOTIFICATION' });
        clearInterval(interval);
      }
      attempts += 1;
    }, 500);
    return () => clearInterval(interval);
  }, [pendingNotification, handleNavigateOnOpen, dispatch]);

  return {
    handleNavigateOnOpen,
    saveToken,
  };
};
export default useNotifications;
