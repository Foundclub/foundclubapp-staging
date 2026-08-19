// @ts-nocheck
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

import {
  activateSessionByDocumentId,
} from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import {
  invalidateAfterAction,
  resolveNotificationRefreshAction,
} from '@/domains/refresh/afterAction';
import { useAppContext } from '@/store/appContext';

import { RouteNames } from '@/navigation/routeNames';

import {
  addDeviceToken,
  addDeviceTokenForSession,
} from '@/services/auth/authService';
import { emitCelebrationFromNotificationPayload } from '@/services/celebrations/celebrationRuntime';
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
import { getMatchDurationMinutes } from '@/utils/leagueSportConfig';
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
import {
  APP_RUNTIME_ENV,
  ENABLE_PUSH_NOTIFICATIONS,
  ENABLE_SMART_NOTIFICATIONS,
} from '@/constants/runtimeFlags';
import {
  usePopupEligibility,
  usePopupManager,
} from '@/context/PopupManagerContext';
import { NOTIFICATIONS_QUERY_KEY, UNREAD_COUNT_QUERY_KEY } from '@/hooks/useNotificationController';
import useSafeTimers from '@/hooks/useSafeTimers';

const notificationsLogger = createLogger('notifications');

const isNetworkError = (error) => {
  const statusCode = error?.status || error?.response?.status;
  const message = String(error?.message || error || '').toLowerCase();
  return !statusCode && message.includes('network');
};

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

const hasCelebrationPayload = (payload) => Boolean(
  String(payload?.celebrationKey || '').trim()
  || String(payload?.celebrationVariant || '').trim()
  || String(payload?.celebrationTitle || '').trim(),
);

/**
 * @param {{
 *  navigate: (routeName: string, params?: Record<string, unknown>) => boolean | void;
 *  onSmartNotification?: (payload: any) => void;
 * }} props
 */
const useNotifications = ({ navigate, onSmartNotification }) => {
  const [{ activeSessionDocumentId, authSessions, pendingNotification }, dispatch] = useAppContext();
  const { userData } = useAuth();
  const queryClient = useQueryClient();
  const {
    clearSafeTimer,
    setSafeInterval,
    setSafeTimeout,
  } = useSafeTimers();
  const { isStartupWindowActive } = usePopupManager();

  const { mutateAsync: saveTokenMutationAsync } = useMutation({
    meta: { preventToastError: true },
    mutationFn: addDeviceToken,
    onError: (error) => {
      const typedError = /** @type {any} */ (error);
      const statusCode = typedError?.status || typedError?.response?.status;
      if (statusCode === 401 || statusCode === 403) {
        notificationsLogger.warn('[FCM] Token registration denied by backend permissions/auth. Notifications disabled for this session.');
      } else if (isNetworkError(typedError)) {
        notificationsLogger.warn('[FCM] Failed to save token to backend: network unavailable. Token sync will retry later.');
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

  const saveToken = useCallback(async (token) => {
    if (!token) return false;
    notificationsLogger.debug('[FCM] Calling saveTokenMutation with token:', `${token.substring(0, 20)}...`);
    try {
      await saveTokenMutationAsync(token);
      await syncLinkedSessionsWithToken(token);
      return true;
    } catch (_error) {
      return false;
    }
  }, [saveTokenMutationAsync, syncLinkedSessionsWithToken]);

  const smartNotifEnabled = useRef(ENABLE_SMART_NOTIFICATIONS);
  const [pendingCalendarPrompts, setPendingCalendarPrompts] = useState([]);
  const [pendingPushPermissionReason, setPendingPushPermissionReason] = useState('');
  const promptedCalendarMatchesRef = useRef(/** @type {Set<string>} */ (new Set()));
  const queuedCalendarPromptKeysRef = useRef(/** @type {Set<string>} */ (new Set()));
  const shownCalendarPromptKeyRef = useRef('');
  const queuedNotificationKeysRef = useRef(/** @type {Set<string>} */ (new Set()));
  const handledNotificationKeysRef = useRef(/** @type {Set<string>} */ (new Set()));
  const linkedSessionSyncKeysRef = useRef(/** @type {Set<string>} */ (new Set()));
  const tokenSyncInFlightRef = useRef(false);
  const tokenSyncRetryTimerRef = useRef(null);
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

  /**
   * U05 — LA CLOCHE, ET CE QUE LA NOTIFICATION REND FAUX EN PLUS.
   *
   * Avant : ces deux cles, et rien d'autre. Une notification « ta demande a ete
   * acceptee » ne faisait donc relire QUE la cloche — l'appartenance aux equipes
   * restait celle d'avant, jusqu'a la prochaine relecture spontanee. C'est
   * exactement ce qu'Adel decrit : « quand on est accepte, c'est hyper long ».
   *
   * ⛔ Le fan-out ne part QUE sur les trois types d'appartenance
   * (`resolveNotificationRefreshAction`). Sans type, ou sur un type ordinaire,
   * cette fonction fait exactement ce qu'elle faisait hier : deux invalidations.
   * @param {string} [notificationType] Le type porte par la notification recue.
   * @returns {void}
   */
  const invalidateNotificationQueries = useCallback((notificationType) => {
    queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_QUERY_KEY });

    const refreshAction = resolveNotificationRefreshAction(notificationType);
    if (!refreshAction) return;
    invalidateAfterAction(queryClient, refreshAction).catch(() => {});
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
      linkedSessionSyncKeysRef.current.clear();
      if (tokenSyncRetryTimerRef.current) {
        clearSafeTimer(tokenSyncRetryTimerRef.current);
        tokenSyncRetryTimerRef.current = null;
      }
    }
  }, [clearSafeTimer, userData]);

  const syncLinkedSessionsWithToken = useCallback(async (token) => {
    const normalizedToken = typeof token === 'string' ? token.trim() : '';
    if (!normalizedToken) {
      return;
    }

    const sessions = Array.isArray(authSessions) ? authSessions : [];
    if (sessions.length <= 1) {
      return;
    }

    const pendingSessionSyncs = sessions
      .map((session) => {
        const sessionDocumentId = String(session?.user?.documentId || '').trim();
        const sessionToken = String(session?.token || '').trim();
        const syncKey = `${normalizedToken}:${sessionDocumentId}`;

        if (!sessionDocumentId || !sessionToken || linkedSessionSyncKeysRef.current.has(syncKey)) {
          return null;
        }

        return {
          sessionDocumentId,
          sessionToken,
          syncKey,
        };
      })
      .filter(Boolean);

    await Promise.all(pendingSessionSyncs.map(async (sessionSync) => {
      try {
        await addDeviceTokenForSession(sessionSync.sessionToken, normalizedToken);
        rememberRuntimeKey(linkedSessionSyncKeysRef, sessionSync.syncKey);
      } catch (error) {
        const typedError = /** @type {any} */ (error);
        const statusCode = typedError?.status || typedError?.response?.status;
        if (statusCode === 401 || statusCode === 403) {
          notificationsLogger.warn('[FCM] Linked session token sync skipped: session authorization rejected.', {
            sessionDocumentId: sessionSync.sessionDocumentId,
          });
        } else if (isNetworkError(typedError)) {
          notificationsLogger.warn('[FCM] Linked session token sync postponed: network unavailable.', {
            sessionDocumentId: sessionSync.sessionDocumentId,
          });
        } else {
          notificationsLogger.warn('[FCM] Linked session token sync failed.', {
            error: typedError?.message || 'unknown',
            sessionDocumentId: sessionSync.sessionDocumentId,
          });
        }
      }
    }));
  }, [authSessions]);

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
      return 'skipped';
    }

    const bypassPreprompt = Boolean(options?.bypassPreprompt);
    // In local development we allow the native OS prompt immediately so emulator
    // push validation is not blocked behind the in-app pre-prompt flow.
    const bypassPrepromptForLocal = APP_RUNTIME_ENV === 'local';
    const force = Boolean(options?.force);

    const now = Date.now();
    if (
      tokenSyncInFlightRef.current
      || (!force && now - lastTokenSyncAtRef.current < 30000 && reason !== 'token_refresh')
    ) {
      return 'throttled';
    }

    tokenSyncInFlightRef.current = true;
    lastTokenSyncAtRef.current = now;

    try {
      notificationsLogger.debug(`[FCM] Starting token retrieval. reason=${reason}`);
      const messagingInstance = getMessagingInstanceSafe();
      if (!messagingInstance) {
        notificationsLogger.warn('[FCM] Token retrieval skipped: messaging unavailable.');
        return 'skipped';
      }
      const permissionGranted = await getPushPermissionGranted();

      // iOS must reach the native permission prompt at least once, otherwise the app
      // never appears in Settings > Notifications and no FCM token can be issued.
      const shouldDeferBehindInAppPreprompt = (
        Platform.OS !== 'ios'
        && !permissionGranted
        && !bypassPreprompt
        && !bypassPrepromptForLocal
        && requestPushPermissionPrePrompt(reason)
      );

      if (shouldDeferBehindInAppPreprompt) {
        notificationsLogger.info('[FCM] Deferring token sync until push pre-prompt is answered.', { reason });
        return 'deferred';
      }

      if (Platform.OS === 'ios') {
        notificationsLogger.debug('[FCM] iOS detected - requesting permissions...');
        if (!permissionGranted) {
          await requestUserPermission();
        }
        const didGrantPermission = await getPushPermissionGranted();
        if (!didGrantPermission) {
          notificationsLogger.info('[FCM] Permission denied after iOS prompt. Token sync aborted.', { reason });
          return 'denied';
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
          return 'denied';
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
        return 'failed';
      }
      const didSaveToken = await saveToken(token);
      return didSaveToken ? 'success' : 'failed';
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
      return 'failed';
    } finally {
      tokenSyncInFlightRef.current = false;
    }
  }, [requestPushPermissionPrePrompt, saveToken, userData]);

  const scheduleTokenSyncRetry = useCallback((userIdentity, reason = 'retry') => {
    if (!userIdentity || tokenSyncRetryTimerRef.current) {
      return;
    }

    tokenSyncRetryTimerRef.current = setSafeTimeout(async () => {
      tokenSyncRetryTimerRef.current = null;

      if (getUserNotificationIdentity(userData) !== userIdentity) {
        return;
      }

      notificationsLogger.info('[FCM] Retrying token sync after earlier failure.', {
        reason,
        userIdentity,
      });

      const retryStatus = await syncTokenIfNeeded(`retry_${reason}`, { force: true });
      if (retryStatus === 'success') {
        lastSyncedUserIdRef.current = userIdentity;
      }
    }, 15000);
  }, [setSafeTimeout, syncTokenIfNeeded, userData]);

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
    const durationMinutes = getMatchDurationMinutes(notificationData?.matchSport);
    const endDate = new Date(startDate.getTime() + (durationMinutes * 60 * 1000));
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

    const targetSessionDocumentId = String(notificationData?.targetUserDocumentId || '').trim();
    if (targetSessionDocumentId) {
      const activationResult = activateSessionByDocumentId(targetSessionDocumentId);
      if (!activationResult?.activated && activationResult?.reason === 'session_not_found') {
        notificationsLogger.warn('[NOTIF_OPENED] target session missing locally, opening current account notification center instead.', {
          targetSessionDocumentId,
          type: notificationData.type,
        });
        const fallback = navigate(RouteNames.NotificationList);
        if (fallback !== false) {
          markHandled();
        }
        return fallback !== false;
      }

      if (String(activeSessionDocumentId || '').trim() !== targetSessionDocumentId) {
        notificationsLogger.debug(
          `[NOTIF_OPENED] waiting_for_account_switch target=${targetSessionDocumentId} current=${String(activeSessionDocumentId || '').trim() || 'none'} type=${notificationData.type}`,
        );
        return false;
      }
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
      invalidateNotificationQueries(notificationData.type);
    }
    notificationsLogger.debug(`[NOTIF_OPENED] type=${notificationData.type} route=${destination.route} handled=${Boolean(handled)}`);
    return handled;
  }, [activeSessionDocumentId, invalidateNotificationQueries, maybePromptAddToCalendar, navigate]);

  const smartForegroundTypes = useRef(new Set([
    NOTIFICATION_TYPES.EVENT_LINEUP_PUBLISH_REMINDER,
    NOTIFICATION_TYPES.LEAGUE_COUNTER_PROPOSAL_RECEIVED,
    NOTIFICATION_TYPES.LEAGUE_MATCH_CANCELLED_NEGOTIATION_TIMEOUT,
    NOTIFICATION_TYPES.LEAGUE_MATCH_DISPUTED,
    NOTIFICATION_TYPES.LEAGUE_MATCH_FINALIZED,
    NOTIFICATION_TYPES.LEAGUE_MATCH_FOUND,
    NOTIFICATION_TYPES.LEAGUE_MATCH_VALIDATED,
    NOTIFICATION_TYPES.LEAGUE_PROPOSAL_ACCEPTED,
    NOTIFICATION_TYPES.LEAGUE_PROPOSAL_DECLINED,
    NOTIFICATION_TYPES.LEAGUE_PROPOSAL_RECEIVED,
    NOTIFICATION_TYPES.LEAGUE_QUORUM_REACHED,
    NOTIFICATION_TYPES.LEAGUE_QUORUM_REMINDER,
    NOTIFICATION_TYPES.LEAGUE_SCORE_ADMIN_ESCALATED,
    NOTIFICATION_TYPES.LEAGUE_SCORE_DEADLINE_WARNING,
    NOTIFICATION_TYPES.LEAGUE_SCORE_DISPUTED_BY_OPPONENT,
    NOTIFICATION_TYPES.LEAGUE_SCORE_DUE,
    NOTIFICATION_TYPES.LEAGUE_SCORE_END_DUE,
    NOTIFICATION_TYPES.LEAGUE_SCORE_REMINDER_2H,
    NOTIFICATION_TYPES.LEAGUE_SCORE_START_INFO,
    NOTIFICATION_TYPES.LEAGUE_SCORE_SUBMITTED_BY_OPPONENT,
    NOTIFICATION_TYPES.LEAGUE_SCORE_VALIDATION_REQUIRED,
    NOTIFICATION_TYPES.LEAGUE_SEARCH_RELAUNCH_PROMPT,
    NOTIFICATION_TYPES.LEAGUE_SEARCH_STARTED,
    NOTIFICATION_TYPES.LEAGUE_SEARCH_STILL_RUNNING,
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
      invalidateNotificationQueries(normalizedData?.type);

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

      const foregroundNotificationPayload = {
        ...normalizedData,
        body: remoteMessage.notification?.body || normalizedData?.body || '',
        title: remoteMessage.notification?.title || normalizedData?.title || '',
      };
      const emittedForegroundCelebration = emitCelebrationFromNotificationPayload(
        foregroundNotificationPayload,
      );

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
          ...foregroundNotificationPayload,
        });
        return;
      }

      if (emittedForegroundCelebration || hasCelebrationPayload(normalizedData)) {
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
        const normalizedData = normalizeNotificationPayload(detail.notification.data);
        invalidateNotificationQueries(normalizedData?.type);
        const handled = handleNavigateOnOpen(normalizedData);
        if (!handled) {
          dispatch({
            payload: normalizedData,
            type: 'SET_PENDING_NOTIFICATION',
          });
        }
      }
    });
  }, [dispatch, handleNavigateOnOpen, invalidateNotificationQueries]);

  useEffect(() => {
    notificationsLogger.debug('[FCM] useEffect triggered - userData:', !!userData, 'userIdentity:', currentUserNotificationIdentity);
    if (
      ENABLE_PUSH_NOTIFICATIONS
      && currentUserNotificationIdentity
      && lastSyncedUserIdRef.current !== currentUserNotificationIdentity
    ) {
      if (tokenSyncRetryTimerRef.current) {
        clearSafeTimer(tokenSyncRetryTimerRef.current);
        tokenSyncRetryTimerRef.current = null;
      }

      (async () => {
        const syncStatus = await syncTokenIfNeeded('login', { force: true });
        if (syncStatus === 'success') {
          lastSyncedUserIdRef.current = currentUserNotificationIdentity;
          return;
        }

        if (syncStatus === 'failed') {
          scheduleTokenSyncRetry(currentUserNotificationIdentity, 'login');
        }
      })();
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
        const normalizedData = normalizeNotificationPayload(remoteMessage.data || {});
        invalidateNotificationQueries(normalizedData?.type);
        notificationsLogger.debug('[FCM] App opened from QUIT state by notification:', remoteMessage);
        queuePendingNotification(normalizedData, 'fcm');
      }).catch((error) => {
        notificationsLogger.warn('[FCM] getInitialNotification failed:', error);
      });
    }

    const unsubscribeNotificationOpened = onNotificationOpenedApp(
      messagingInstance,
      (remoteMessage) => {
        if (!remoteMessage) return;
        const normalizedData = normalizeNotificationPayload(remoteMessage.data || {});
        invalidateNotificationQueries(normalizedData?.type);
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
    clearSafeTimer,
    currentUserNotificationIdentity,
    dispatch,
    invalidateNotificationQueries,
    saveToken,
    scheduleTokenSyncRetry,
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
        ? 'Ajouter ce match League à ton agenda pour ne pas le manquer ?'
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
      body: 'Active les notifications FoundClub pour recevoir les validations League, les rappels de composition et les actions importantes sans attendre.',
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
      title: 'Active les notifications FoundClub',
    },
    saveToken,
  };
};

export default useNotifications;
