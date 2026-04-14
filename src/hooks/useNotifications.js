import notifee, { EventType } from '@notifee/react-native';
import { getApp } from '@react-native-firebase/app';
import {
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  requestPermission,
} from '@react-native-firebase/messaging';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  AppState,
  Linking,
  PermissionsAndroid,
  Platform,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { useAppContext } from '@/store/appContext';

import { RouteNames } from '@/navigation/routeNames';

import { addDeviceToken } from '@/services/auth/authService';
import {
  consumePendingOpenNotification,
  displayChatReplyActionableNotification,
  displayEventRsvpActionableNotification,
  ensureNotificationActionSetup,
  handleChatReplyActionPress,
  handleEventRsvpActionPress,
  isChatReplyActionablePayload,
  isEventRsvpActionablePayload,
} from '@/services/notificationActions/rsvpActions';

import { persistDiagnosticError } from '@/utils/bootDiagnostics';
import { createLogger } from '@/utils/logger/logger';
import { isDuplicateNotificationKey } from '@/utils/notifications/notificationDedupe';
import {
  getNotificationOpenKey,
  normalizeNotificationPayload,
  resolveNotificationDestination,
} from '@/utils/notifications/notificationNavigation';
import { NOTIFICATION_TYPES } from '@/utils/notifications/notificationTypes';

import {
  POPUP_DISMISS_SCOPES,
  POPUP_IDS,
} from '@/constants/popupRegistry';
import { ENABLE_PUSH_NOTIFICATIONS, ENABLE_SMART_NOTIFICATIONS } from '@/constants/runtimeFlags';
import {
  usePopupEligibility,
  usePopupManager,
} from '@/context/PopupManagerContext';
import { NOTIFICATIONS_QUERY_KEY, UNREAD_COUNT_QUERY_KEY } from '@/hooks/useNotificationController';
import useSafeTimers from '@/hooks/useSafeTimers';

const notificationsLogger = createLogger('notifications');

/**
 * @param {import('react').MutableRefObject<Set<string>>} ref
 * @param {string} key
 */
const rememberRuntimeKey = (ref, key) => {
  if (!key) return;
  ref.current.add(key);
  if (ref.current.size <= 100) return;
  const oldestKey = ref.current.values().next().value;
  if (oldestKey) {
    ref.current.delete(oldestKey);
  }
};

/**
 * @param {string | number | Date} dateInput
 * @returns {string | null}
 */
const formatDateForGoogleCalendar = (dateInput) => {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return null;
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
};

const getCalendarPromptKey = (notificationData) => String(
  notificationData?.matchId || notificationData?.dedupeKey || '',
).trim();

const getUserNotificationIdentity = (userData) => String(
  userData?.documentId || userData?.id || '',
).trim();

const isFirebaseMessagingApiAvailable = () => (
  typeof getApp === 'function'
  && typeof getMessaging === 'function'
  && typeof getToken === 'function'
  && typeof onMessage === 'function'
  && typeof onNotificationOpenedApp === 'function'
);

const isNotifeeApiAvailable = () => {
  try {
    return Boolean(
      notifee
      && typeof notifee.displayNotification === 'function'
      && typeof notifee.onForegroundEvent === 'function'
      && typeof notifee.getInitialNotification === 'function',
    );
  } catch (_error) {
    return false;
  }
};

const getMessagingInstanceSafe = () => {
  if (!isFirebaseMessagingApiAvailable()) {
    notificationsLogger.warn('[BOOT] FCM_API_UNAVAILABLE');
    return null;
  }

  try {
    return getMessaging(getApp());
  } catch (error) {
    notificationsLogger.warn('[BOOT] FCM_INSTANCE_UNAVAILABLE', {
      error: error?.message || 'unknown',
    });
    return null;
  }
};

const requestUserPermission = async () => {
  const messagingInstance = getMessagingInstanceSafe();
  if (!messagingInstance) return;

  if (Platform.OS === 'ios') {
    if (typeof requestPermission !== 'function') {
      notificationsLogger.warn('[FCM] requestPermission API unavailable on this runtime.');
      return;
    }
    await requestPermission(messagingInstance);
  }

  if (Platform.OS === 'android') {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }
};

const getPushPermissionGranted = async () => {
  if (Platform.OS === 'android') {
    return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  }

  if (Platform.OS === 'ios' && typeof notifee?.getNotificationSettings === 'function') {
    try {
      const settings = await notifee.getNotificationSettings();
      return Number(settings?.authorizationStatus || 0) > 0;
    } catch (error) {
      notificationsLogger.warn('[FCM] Failed to read iOS notification settings.', error);
      return false;
    }
  }

  return false;
};

/**
 * @param {{title: string, body: string, data: any}} param0
 * @returns {Promise<void>}
 */
const onDisplayNotification = async ({ body, data, title }) => {
  if (!isNotifeeApiAvailable()) {
    notificationsLogger.warn('[Notifications] Notifee unavailable. Foreground display skipped.');
    return;
  }

  try {
    const normalizedData = normalizeNotificationPayload(data || {});
    await ensureNotificationActionSetup();

    if (isEventRsvpActionablePayload(normalizedData)) {
      await displayEventRsvpActionableNotification({ body, data: normalizedData, title });
      return;
    }

    if (isChatReplyActionablePayload(normalizedData)) {
      await displayChatReplyActionableNotification({ body, data: normalizedData, title });
      return;
    }

    if (title || body) {
      await notifee.displayNotification({
        android: {
          channelId: 'default',
          importance: 4,
          pressAction: { id: 'default' },
          smallIcon: 'ic_notification',
          sound: 'default',
        },
        body,
        data: /** @type {any} */ (normalizedData),
        ios: {
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
  } catch (error) {
    notificationsLogger.warn('[Notifications] Failed to display foreground notification:', error);
  }
};

/**
 * @param {{
 *  navigate: (routeName: string, params?: Record<string, unknown>) => boolean | void;
 *  onSmartNotification?: (payload: any) => void;
 * }} props
 */
const useNotifications = ({ navigate, onSmartNotification }) => {
  const [{ pendingNotification }, dispatch] = useAppContext();
  const { userData } = useAuth();
  const queryClient = useQueryClient();
  const { clearSafeTimer, setSafeInterval } = useSafeTimers();
  const { isStartupWindowActive } = usePopupManager();

  const { mutate: saveTokenMutation } = useMutation({
    meta: { preventToastError: true },
    mutationFn: addDeviceToken,
    onError: (error) => {
      const typedError = /** @type {any} */ (error);
      const statusCode = typedError?.status || typedError?.response?.status;
      if (statusCode === 401 || statusCode === 403) {
        notificationsLogger.warn('[FCM] Token registration denied by backend permissions/auth. Notifications disabled for this session.');
      } else {
        notificationsLogger.error('[FCM] Failed to save token to backend:', typedError);
      }
      dispatch({ payload: undefined, type: 'SET_FCM_TOKEN' });
    },
    onSuccess: (_, token) => {
      notificationsLogger.debug('[FCM] Token saved to backend successfully');
      dispatch({ payload: token, type: 'SET_FCM_TOKEN' });
    },
  });

  const saveToken = useCallback((token) => {
    if (!token) return;
    notificationsLogger.debug('[FCM] Calling saveTokenMutation with token:', `${token.substring(0, 20)}...`);
    saveTokenMutation(token);
  }, [saveTokenMutation]);

  const smartNotifEnabled = useRef(ENABLE_SMART_NOTIFICATIONS);
  const [pendingCalendarPrompts, setPendingCalendarPrompts] = useState([]);
  const [pendingPushPermissionReason, setPendingPushPermissionReason] = useState('');
  const promptedCalendarMatchesRef = useRef(/** @type {Set<string>} */ (new Set()));
  const queuedCalendarPromptKeysRef = useRef(/** @type {Set<string>} */ (new Set()));
  const shownCalendarPromptKeyRef = useRef('');
  const queuedNotificationKeysRef = useRef(/** @type {Set<string>} */ (new Set()));
  const handledNotificationKeysRef = useRef(/** @type {Set<string>} */ (new Set()));
  const tokenSyncInFlightRef = useRef(false);
  const lastTokenSyncAtRef = useRef(0);
  const lastSyncedUserIdRef = useRef('');
  const currentUserNotificationIdentity = getUserNotificationIdentity(userData);
  const pendingCalendarPrompt = pendingCalendarPrompts[0] || null;
  const pendingCalendarPromptKey = getCalendarPromptKey(pendingCalendarPrompt);
  const calendarPrompt = usePopupEligibility(
    POPUP_IDS.NOTIFICATION_CALENDAR_ALERT,
    Boolean(pendingCalendarPrompt),
    {
      cooldownKey: pendingCalendarPromptKey || 'default',
      dismissScope: POPUP_DISMISS_SCOPES.SESSION,
    },
  );
  const pushPermissionPrompt = usePopupEligibility(
    POPUP_IDS.PUSH_PERMISSION_PREPROMPT,
    Boolean(
      pendingPushPermissionReason
      && userData
      && (!isStartupWindowActive || pendingPushPermissionReason !== 'login'),
    ),
    {
      cooldownKey: userData?.documentId || 'anonymous',
      dismissScope: POPUP_DISMISS_SCOPES.DAY,
    },
  );

  const invalidateNotificationQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_QUERY_KEY });
  }, [queryClient]);

  useEffect(() => {
    ensureNotificationActionSetup().catch((error) => {
      notificationsLogger.warn('[Notifications] Failed to setup notification actions:', error);
    });
  }, []);

  useEffect(() => {
    if (!userData) {
      setPendingPushPermissionReason('');
      lastSyncedUserIdRef.current = '';
    }
  }, [userData]);

  const finalizeCalendarPrompt = useCallback(() => {
    if (!pendingCalendarPromptKey) return;
    shownCalendarPromptKeyRef.current = '';
    queuedCalendarPromptKeysRef.current.delete(pendingCalendarPromptKey);
    setPendingCalendarPrompts((previousPrompts) => previousPrompts.filter(
      (prompt) => getCalendarPromptKey(prompt) !== pendingCalendarPromptKey,
    ));
  }, [pendingCalendarPromptKey]);

  const requestPushPermissionPrePrompt = useCallback((reason) => {
    if (!userData) return false;
    if (pushPermissionPrompt.isDismissed) {
      pushPermissionPrompt.trackEvent('deferred', { reason, source: 'cooldown' });
      return false;
    }

    setPendingPushPermissionReason((previousReason) => previousReason || reason);
    return true;
  }, [pushPermissionPrompt, userData]);

  const syncTokenIfNeeded = useCallback(async (reason = 'manual', options = {}) => {
    if (!ENABLE_PUSH_NOTIFICATIONS || !userData) {
      return;
    }

    const bypassPreprompt = Boolean(options?.bypassPreprompt);
    const force = Boolean(options?.force);

    const now = Date.now();
    if (
      tokenSyncInFlightRef.current
      || (!force && now - lastTokenSyncAtRef.current < 30000 && reason !== 'token_refresh')
    ) {
      return;
    }

    tokenSyncInFlightRef.current = true;
    lastTokenSyncAtRef.current = now;

    try {
      notificationsLogger.debug(`[FCM] Starting token retrieval. reason=${reason}`);
      const messagingInstance = getMessagingInstanceSafe();
      if (!messagingInstance) {
        notificationsLogger.warn('[FCM] Token retrieval skipped: messaging unavailable.');
        return;
      }
      const permissionGranted = await getPushPermissionGranted();

      if (!permissionGranted && !bypassPreprompt && requestPushPermissionPrePrompt(reason)) {
        notificationsLogger.info('[FCM] Deferring token sync until push pre-prompt is answered.', { reason });
        return;
      }

      if (Platform.OS === 'ios') {
        notificationsLogger.debug('[FCM] iOS detected - requesting permissions...');
        if (!permissionGranted) {
          await requestUserPermission();
        }
        const didGrantPermission = await getPushPermissionGranted();
        if (!didGrantPermission) {
          notificationsLogger.info('[FCM] Permission denied after iOS prompt. Token sync aborted.', { reason });
          return;
        }
        const registered = await messagingInstance.isDeviceRegisteredForRemoteMessages;
        notificationsLogger.debug('[FCM] Device registered for remote messages:', registered);
        if (!registered) {
          await messagingInstance.registerDeviceForRemoteMessages();
          notificationsLogger.debug('[FCM] Device registered successfully');
        }
      } else {
        const androidPermissionGranted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        notificationsLogger.debug('[FCM] Android permission granted:', androidPermissionGranted);
        if (!androidPermissionGranted) {
          await requestUserPermission();
        }
        const didGrantPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        if (!didGrantPermission) {
          notificationsLogger.info('[FCM] Permission denied after Android prompt. Token sync aborted.', { reason });
          return;
        }
      }

      notificationsLogger.debug('[FCM] Getting FCM token...');
      const token = await getToken(messagingInstance);
      notificationsLogger.debug('[FCM] Token received:', token ? `${token.substring(0, 20)}...` : 'null');
      if (!token) {
        const tokenError = new Error('Failed to get FCM token');
        persistDiagnosticError(tokenError, 'FCM_TOKEN_FAILED', {
          isFatal: false,
        });
        notificationsLogger.warn('[FCM] Empty token returned. Token sync skipped.', { reason });
        return;
      }
      saveToken(token);
    } catch (err) {
      const typedError = /** @type {any} */ (err);
      const errorMessage = typeof typedError === 'string'
        ? typedError
        : typedError?.message || 'Unknown FCM token error';
      persistDiagnosticError(typedError, 'FCM_TOKEN_FAILED', {
        isFatal: false,
      });
      if (errorMessage.includes('FIS_AUTH_ERROR')) {
        notificationsLogger.warn('[FCM] Firebase Auth failed (SHA-1 mismatch in local). Notifications skipped.');
      } else {
        notificationsLogger.error('[FCM] Error retrieving token:', typedError);
      }
    } finally {
      tokenSyncInFlightRef.current = false;
    }
  }, [requestPushPermissionPrePrompt, saveToken, userData]);

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

  const openCalendarFromNotification = useCallback(async (notificationData) => {
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
      notificationsLogger.warn('[Calendar] Failed to open calendar URL:', error);
    }
  }, []);

  const maybePromptAddToCalendar = useCallback((notificationData) => {
    if (!notificationData || notificationData.type !== NOTIFICATION_TYPES.LEAGUE_PROPOSAL_ACCEPTED) return;
    const key = getCalendarPromptKey(notificationData);
    if (
      !key
      || promptedCalendarMatchesRef.current.has(key)
      || queuedCalendarPromptKeysRef.current.has(key)
    ) {
      return;
    }

    queuedCalendarPromptKeysRef.current.add(key);
    setPendingCalendarPrompts((previousPrompts) => [...previousPrompts, notificationData]);
  }, []);

  const handleNavigateOnOpen = useCallback((remoteMessageData) => {
    const notificationData = normalizeNotificationPayload(remoteMessageData);
    const notificationOpenKey = getNotificationOpenKey(notificationData);
    notificationsLogger.debug('[useNotifications] handleNavigateOnOpen triggered with:', notificationData);
    if (handledNotificationKeysRef.current.has(notificationOpenKey)) {
      notificationsLogger.debug(`[NOTIF_OPENED] skip=duplicate_open key=${notificationOpenKey}`);
      return true;
    }

    const markHandled = () => {
      rememberRuntimeKey(handledNotificationKeysRef, notificationOpenKey);
      queuedNotificationKeysRef.current.delete(notificationOpenKey);
    };

    if (!notificationData?.type) {
      notificationsLogger.warn('[useNotifications] No type in notification data, cannot navigate');
      const fallback = navigate(RouteNames.NotificationList);
      if (fallback !== false) {
        markHandled();
      }
      return fallback !== false;
    }

    if (notificationData.type === NOTIFICATION_TYPES.LEAGUE_PROPOSAL_ACCEPTED) {
      maybePromptAddToCalendar(notificationData);
    }

    const tryNavigate = (routeName, params) => {
      const navigated = navigate(routeName, params);
      if (navigated === false) {
        const fallback = navigate(RouteNames.NotificationList);
        return fallback !== false;
      }
      return true;
    };

    const destination = resolveNotificationDestination(notificationData);
    if (!destination?.route) {
      notificationsLogger.warn('[useNotifications] Unknown notification type:', notificationData.type);
      const fallback = navigate(RouteNames.NotificationList);
      notificationsLogger.debug(`[NOTIF_OPENED] type=${notificationData.type} route=${RouteNames.NotificationList} fallback=invalid_destination`);
      if (fallback !== false) {
        markHandled();
      }
      return fallback !== false;
    }

    const handled = tryNavigate(destination.route, destination.params || {});
    if (handled) {
      markHandled();
      invalidateNotificationQueries();
    }
    notificationsLogger.debug(`[NOTIF_OPENED] type=${notificationData.type} route=${destination.route} handled=${Boolean(handled)}`);
    return handled;
  }, [invalidateNotificationQueries, maybePromptAddToCalendar, navigate]);

  const smartForegroundTypes = useRef(new Set([
    NOTIFICATION_TYPES.EVENT_LINEUP_PUBLISH_REMINDER,
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

  useEffect(() => {
    const messagingInstance = ENABLE_PUSH_NOTIFICATIONS ? getMessagingInstanceSafe() : null;
    if (!messagingInstance) {
      notificationsLogger.warn('[Notifications] Foreground FCM listener disabled: messaging unavailable or disabled.');
      return undefined;
    }

    const unsubscribe = onMessage(messagingInstance, async (remoteMessage) => {
      const normalizedData = normalizeNotificationPayload(remoteMessage.data || {});
      invalidateNotificationQueries();

      const messageType = normalizedData?.type;
      if (!messageType && !remoteMessage?.notification?.title && !remoteMessage?.notification?.body) {
        return;
      }

      if (messageType === NOTIFICATION_TYPES.LEAGUE_PROPOSAL_ACCEPTED) {
        maybePromptAddToCalendar(normalizedData);
      }

      const dedupeKey = getNotificationOpenKey({
        ...(normalizedData || {}),
        notificationId: normalizedData?.notificationId || remoteMessage?.messageId,
      });
      if (isDuplicateNotificationKey(dedupeKey)) {
        return;
      }

      const shouldUseSmartForeground = Boolean(
        messageType
        && onSmartNotification
        && (
          messageType === NOTIFICATION_TYPES.EVENT_LINEUP_PUBLISH_REMINDER
          || (smartNotifEnabled.current && smartForegroundTypes.current.has(messageType))
        ),
      );

      if (shouldUseSmartForeground) {
        onSmartNotification({
          ...normalizedData,
          body: remoteMessage.notification?.body || normalizedData?.body || '',
          title: remoteMessage.notification?.title || normalizedData?.title || '',
        });
        return;
      }

      onDisplayNotification({
        body: remoteMessage.notification?.body || normalizedData?.body || '',
        data: remoteMessage.data || {},
        title: remoteMessage.notification?.title || normalizedData?.title || '',
      });
    });

    return typeof unsubscribe === 'function' ? unsubscribe : undefined;
  }, [invalidateNotificationQueries, maybePromptAddToCalendar, onSmartNotification]);

  useEffect(() => {
    if (!isNotifeeApiAvailable()) {
      notificationsLogger.warn('[Notifications] Foreground Notifee listener disabled: notifee unavailable.');
      return undefined;
    }

    return notifee.onForegroundEvent(async ({ detail, type }) => {
      if (type === EventType.ACTION_PRESS) {
        const chatReplyResult = await handleChatReplyActionPress({
          inputText: detail.input,
          notificationData: detail.notification?.data || {},
          pressActionId: detail?.pressAction?.id,
        });
        if (chatReplyResult?.handled) {
          invalidateNotificationQueries();
          if (detail.notification?.id) {
            await notifee.cancelNotification(detail.notification.id);
          }
          return;
        }

        const result = await handleEventRsvpActionPress({
          notificationData: detail.notification?.data || {},
          pressActionId: detail?.pressAction?.id,
        });
        if (result?.handled && detail.notification?.id) {
          invalidateNotificationQueries();
          await notifee.cancelNotification(detail.notification.id);
        }
        return;
      }

      if (type === EventType.PRESS && detail.notification?.data?.type) {
        invalidateNotificationQueries();
        handleNavigateOnOpen(normalizeNotificationPayload(detail.notification.data));
      }
    });
  }, [handleNavigateOnOpen, invalidateNotificationQueries]);

  useEffect(() => {
    notificationsLogger.debug('[FCM] useEffect triggered - userData:', !!userData, 'userIdentity:', currentUserNotificationIdentity);
    if (
      ENABLE_PUSH_NOTIFICATIONS
      && currentUserNotificationIdentity
      && lastSyncedUserIdRef.current !== currentUserNotificationIdentity
    ) {
      lastSyncedUserIdRef.current = currentUserNotificationIdentity;
      syncTokenIfNeeded('login', { force: true });
    }

    const queuePendingNotification = (payload, source) => {
      const normalizedPayload = normalizeNotificationPayload(payload || {});
      if (normalizedPayload?.type) {
        const notificationOpenKey = getNotificationOpenKey(normalizedPayload);
        if (
          queuedNotificationKeysRef.current.has(notificationOpenKey)
          || handledNotificationKeysRef.current.has(notificationOpenKey)
        ) {
          notificationsLogger.debug(`[FCM] Skipping duplicate pending notification from ${source} key=${notificationOpenKey}`);
          return;
        }

        rememberRuntimeKey(queuedNotificationKeysRef, notificationOpenKey);
        notificationsLogger.debug(`[FCM] Storing pending notification from ${source} key=${notificationOpenKey}`);
        dispatch({
          payload: normalizedPayload,
          type: 'SET_PENDING_NOTIFICATION',
        });
      }
    };

    const messagingInstance = ENABLE_PUSH_NOTIFICATIONS ? getMessagingInstanceSafe() : null;
    if (!messagingInstance) {
      notificationsLogger.warn('[Notifications] Messaging unavailable or disabled. Boot listeners skipped.');
      return undefined;
    }

    if (typeof messagingInstance.getInitialNotification === 'function') {
      messagingInstance.getInitialNotification().then((remoteMessage) => {
        if (!remoteMessage) return;
        invalidateNotificationQueries();
        notificationsLogger.debug('[FCM] App opened from QUIT state by notification:', remoteMessage);
        queuePendingNotification(normalizeNotificationPayload(remoteMessage.data || {}), 'fcm');
      }).catch((error) => {
        notificationsLogger.warn('[FCM] getInitialNotification failed:', error);
      });
    }

    const unsubscribeNotificationOpened = onNotificationOpenedApp(
      messagingInstance,
      (remoteMessage) => {
        if (!remoteMessage) return;
        invalidateNotificationQueries();
        const normalizedData = normalizeNotificationPayload(remoteMessage.data || {});
        if (normalizedData?.type) {
          notificationsLogger.debug(`[NOTIF_OPENED] type=${normalizedData.type} source=background_push`);
        }
        queuePendingNotification(normalizedData, 'fcm-background');
      },
    );

    if (isNotifeeApiAvailable()) {
      notifee.getInitialNotification().then((initialNotification) => {
        queuePendingNotification(
          normalizeNotificationPayload(initialNotification?.notification?.data || {}),
          'notifee',
        );
      }).catch((error) => {
        notificationsLogger.warn('[Notifications] notifee.getInitialNotification failed:', error);
      });
    }

    const storedPending = consumePendingOpenNotification();
    queuePendingNotification(storedPending, 'storage');

    const unsubscribeTokenRefresh = onTokenRefresh(messagingInstance, async (token) => {
      if (!token) return;
      notificationsLogger.debug('[FCM] Token refreshed by Firebase runtime');
      lastTokenSyncAtRef.current = Date.now();
      saveToken(token);
    });

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        syncTokenIfNeeded('app_active');
        invalidateNotificationQueries();
      }
    });

    return () => {
      unsubscribeNotificationOpened();
      unsubscribeTokenRefresh();
      appStateSubscription?.remove?.();
    };
  }, [
    currentUserNotificationIdentity,
    dispatch,
    invalidateNotificationQueries,
    saveToken,
    syncTokenIfNeeded,
    userData,
  ]);

  useEffect(() => {
    if (!pendingNotification?.type) return undefined;
    let attempts = 0;
    const maxAttempts = 20;
    const interval = setSafeInterval(() => {
      const handled = handleNavigateOnOpen(/** @type {any} */ (pendingNotification));
      if (handled || attempts >= maxAttempts) {
        dispatch({ payload: null, type: 'SET_PENDING_NOTIFICATION' });
        clearSafeTimer(interval);
      }
      attempts += 1;
    }, 500);
    return () => clearSafeTimer(interval);
  }, [clearSafeTimer, pendingNotification, handleNavigateOnOpen, dispatch, setSafeInterval]);

  return {
    calendarPrompt: {
      body: pendingCalendarPrompt
        ? 'Ajouter ce match League à votre agenda pour ne pas le manquer ?'
        : '',
      canShow: calendarPrompt.canShow,
      descriptor: calendarPrompt.descriptor,
      onAccept: async () => {
        calendarPrompt.trackEvent('accepted', { pendingCalendarPromptKey });
        calendarPrompt.dismiss(POPUP_DISMISS_SCOPES.SESSION);
        await openCalendarFromNotification(pendingCalendarPrompt);
        finalizeCalendarPrompt();
      },
      onDismiss: () => {
        calendarPrompt.dismiss(POPUP_DISMISS_SCOPES.SESSION);
        finalizeCalendarPrompt();
      },
      onVisible: () => {
        if (!pendingCalendarPromptKey) return;
        if (shownCalendarPromptKeyRef.current === pendingCalendarPromptKey) return;
        shownCalendarPromptKeyRef.current = pendingCalendarPromptKey;
        promptedCalendarMatchesRef.current.add(pendingCalendarPromptKey);
        calendarPrompt.markShown({ pendingCalendarPromptKey });
      },
      title: 'Match confirmé',
      visiblePayload: pendingCalendarPrompt,
    },
    handleNavigateOnOpen,
    pushPermissionPrompt: {
      body: 'Activez les notifications FoundClub pour recevoir les validations League, les rappels de composition et les actions importantes sans attendre.',
      canShow: pushPermissionPrompt.canShow,
      descriptor: pushPermissionPrompt.descriptor,
      onAccept: async () => {
        const nextReason = pendingPushPermissionReason || 'manual';
        pushPermissionPrompt.dismiss(POPUP_DISMISS_SCOPES.SESSION);
        pushPermissionPrompt.trackEvent('accepted', { reason: nextReason });
        setPendingPushPermissionReason('');
        await syncTokenIfNeeded(nextReason, { bypassPreprompt: true });
      },
      onDismiss: () => {
        pushPermissionPrompt.dismiss(POPUP_DISMISS_SCOPES.DAY);
        setPendingPushPermissionReason('');
      },
      onVisible: () => {
        pushPermissionPrompt.markShown({ reason: pendingPushPermissionReason || 'manual' });
      },
      title: 'Activez les notifications FoundClub',
    },
    saveToken,
  };
};

export default useNotifications;
