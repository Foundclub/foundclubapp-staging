import notifee, { EventType } from '@notifee/react-native';
import { getApp } from '@react-native-firebase/app';
import {
  getMessaging,
  getToken,
  onMessage,
  requestPermission,
} from '@react-native-firebase/messaging';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import { MMKV } from 'react-native-mmkv';

import { NOTIFICATION_TYPES } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';

import { addDeviceToken } from '@/services/auth/authService';

import { RouteNames } from '../navigation/routeNames';
import { useAppContext } from '../store/appContext';

// Create a storage instance for notifications
let notificationStorageInstance = null;

const getNotificationStorage = () => {
  if (!notificationStorageInstance) {
    notificationStorageInstance = new MMKV({
      id: 'notifications-storage',
    });
  }
  return notificationStorageInstance;
};

const notificationStorage = {
  getString: (key) => getNotificationStorage().getString(key),
  set: (key, value) => getNotificationStorage().set(key, value),
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

const parseMaybeJson = (value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(trimmed);
    } catch (_error) {
      return value;
    }
  }
  return value;
};

const normalizeNotificationData = (value) => {
  if (!value || typeof value !== 'object') return {};
  return Object.entries(value).reduce((acc, [key, raw]) => {
    acc[key] = parseMaybeJson(raw);
    return acc;
  }, {});
};

const formatDateForGoogleCalendar = (dateInput) => {
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return null;
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
  // Create a channel for android with high importance
  const channelId = await notifee.createChannel({
    id: 'default',
    importance: 4,
    name: 'Default Channel',
    sound: 'default',
    vibration: true,
  });

  if (title || body) {
    // Display a notification
    await notifee.displayNotification({
      android: {
        channelId,
        importance: 4,
        pressAction: {
          id: 'default',
        },
        smallIcon: 'ic_notification',
        sound: 'default',
      },
      body,
      data,
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
 * @param {object} props - The props
 * @param {Function} props.navigate - The navigation prop
 * @param {(payload: any) => void} [props.onSmartNotification] - In-app smart notification callback
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
      console.error('[FCM] Failed to save token to backend:', error);
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
      console.log('[FCM] Calling saveTokenMutation with token:', token.substring(0, 20) + '...');
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
  const promptedCalendarMatchesRef = useRef(new Set());

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
      console.warn('[Calendar] Failed to open calendar URL:', error);
    }
  }, []);

  const maybePromptAddToCalendar = useCallback((notificationData) => {
    if (!notificationData || notificationData.type !== NOTIFICATION_TYPES.LEAGUE_PROPOSAL_ACCEPTED) return;
    const key = notificationData.matchId || notificationData.dedupeKey;
    if (!key) return;
    if (promptedCalendarMatchesRef.current.has(key)) return;
    promptedCalendarMatchesRef.current.add(key);

    Alert.alert(
      'Match confirme',
      'Ajouter ce match a votre agenda ?',
      [
        { text: 'Plus tard', style: 'cancel' },
        {
          text: 'Ajouter',
          onPress: () => openCalendarFromNotification(notificationData),
        },
      ],
    );
  }, [openCalendarFromNotification]);

  // methods
  const handleNavigateOnOpen = useCallback((/** @type {remoteMessageData} */remoteMessageData) => {
    const notificationData = normalizeNotificationData(remoteMessageData);
    console.log('[useNotifications] handleNavigateOnOpen triggered with:', notificationData);
    if (!notificationData?.type) {
        console.warn('[useNotifications] No type in notification data, cannot navigate');
        return false;
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

    if (notificationData.ctaRoute) {
      const ctaOk = tryNavigate(notificationData.ctaRoute, notificationData.ctaParams || {});
      if (ctaOk) return true;
    }

    switch (notificationData.type) {
      case NOTIFICATION_TYPES.ADD_TO_TEAM:
        return tryNavigate(RouteNames.TeamStack, {
          params: {
            teamId: notificationData.teamId,
          },
          screen: RouteNames.TeamDetails,
        });
      case NOTIFICATION_TYPES.CLUB_MEMBERSHIP_REQUEST:
        return tryNavigate(RouteNames.ClubStack, {
          screen: RouteNames.ClubMembershipRequests,
          params: {
            clubId: notificationData.clubId,
          },
        });
      case NOTIFICATION_TYPES.CLUB_REQUEST:
        return tryNavigate(RouteNames.ClubStack, {
          params: {
            clubId: notificationData.clubId,
          },
          screen: RouteNames.Club,
        });
      case NOTIFICATION_TYPES.EVENT_CANCELLATION:
        return tryNavigate(RouteNames.MyEventList);
      case NOTIFICATION_TYPES.EVENT_REMINDER:
        return tryNavigate(RouteNames.EventStack, {
          params: {
            eventId: notificationData.eventId,
          },
          screen: RouteNames.EventDetails,
        });
      case NOTIFICATION_TYPES.NEW_PARTICIPATION:
        return tryNavigate(RouteNames.EventStack, {
          params: {
            eventId: notificationData.eventId,
          },
          screen: RouteNames.EventDetails,
        });
      case NOTIFICATION_TYPES.NEW_TEAM:
        return tryNavigate(RouteNames.TeamStack, {
          params: {
            teamId: notificationData.teamId,
          },
          screen: RouteNames.TeamDetails,
        });
      case NOTIFICATION_TYPES.NEW_TEAM_MESSAGE:
        return tryNavigate(RouteNames.Conversation, {
          chatId: notificationData.conversationId,
        });
      case NOTIFICATION_TYPES.NEW_TEAM_PLAYER_MESSAGE:
        return tryNavigate(RouteNames.Conversation, {
          chatId: notificationData.conversationId,
        });
      case NOTIFICATION_TYPES.NEW_WHISPER:
        return tryNavigate(RouteNames.Conversation, {
          chatId: notificationData.conversationId,
        });
      case NOTIFICATION_TYPES.PARTICIPATION_REQUEST:
        return tryNavigate(RouteNames.EventStack, {
          params: {
            eventId: notificationData.eventId,
          },
          screen: RouteNames.EventDetails,
        });
      case NOTIFICATION_TYPES.TEAM_MEMBERSHIP_REQUEST:
        return tryNavigate(RouteNames.TeamStack, {
          params: {
            teamId: notificationData.teamId,
          },
          screen: RouteNames.TeamDetails,
        });
      case NOTIFICATION_TYPES.TEAM_REQUEST:
        return tryNavigate(RouteNames.TeamStack, {
          screen: RouteNames.TeamMembershipRequests,
        });
      case NOTIFICATION_TYPES.LEAGUE_MATCH_FOUND:
      case NOTIFICATION_TYPES.MATCH_FOUND:
        return tryNavigate(RouteNames.LeagueMatchTab);
      case NOTIFICATION_TYPES.LEAGUE_PROPOSAL_RECEIVED:
      case NOTIFICATION_TYPES.LEAGUE_PROPOSAL_ACCEPTED:
      case NOTIFICATION_TYPES.LEAGUE_MATCH_DISPUTED:
        if (notificationData.chatId || notificationData.conversationId) {
          return tryNavigate(RouteNames.Conversation, {
            chatId: notificationData.chatId || notificationData.conversationId,
          });
        }
        return tryNavigate(RouteNames.LeagueMatchTab);
      case NOTIFICATION_TYPES.LEAGUE_VENUE_BOOKED:
      case NOTIFICATION_TYPES.LEAGUE_SCORE_DUE:
      case NOTIFICATION_TYPES.LEAGUE_SEARCH_RELAUNCH_PROMPT:
        return tryNavigate(RouteNames.LeagueMatchTab);
      case NOTIFICATION_TYPES.LEAGUE_MATCH_VALIDATED:
        if (notificationData.matchId) {
          return tryNavigate(RouteNames.PastMatchDetails, {
            matchId: notificationData.matchId,
          });
        }
        return tryNavigate(RouteNames.LeagueMatchTab);
      default:
        console.warn('[useNotifications] Unknown notification type:', notificationData.type);
        return false;
    }
  }, [navigate, maybePromptAddToCalendar]);

  const smartForegroundTypes = useRef(new Set([
    NOTIFICATION_TYPES.LEAGUE_MATCH_FOUND,
    NOTIFICATION_TYPES.LEAGUE_PROPOSAL_RECEIVED,
    NOTIFICATION_TYPES.LEAGUE_PROPOSAL_ACCEPTED,
    NOTIFICATION_TYPES.LEAGUE_VENUE_BOOKED,
    NOTIFICATION_TYPES.LEAGUE_SCORE_DUE,
    NOTIFICATION_TYPES.LEAGUE_MATCH_VALIDATED,
    NOTIFICATION_TYPES.LEAGUE_MATCH_DISPUTED,
    NOTIFICATION_TYPES.LEAGUE_SEARCH_RELAUNCH_PROMPT,
    NOTIFICATION_TYPES.MATCH_FOUND,
  ]));

  // listeners
  // Handle foreground notif display
  useEffect(() => {
    const messagingInstance = getMessaging(getApp());
    const unsubscribe = onMessage(messagingInstance, async (remoteMessage) => {
      const normalizedData = normalizeNotificationData(remoteMessage.data || {});
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
        maybePromptAddToCalendar(normalizedData);
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

      onDisplayNotification({
        body: remoteMessage.notification?.body || '',
        data: remoteMessage.data,
        title: remoteMessage.notification?.title || '',
      });
    });
    return unsubscribe;
  }, [onSmartNotification, maybePromptAddToCalendar]);

  // open notification when app is in foreground
  useEffect(() => notifee.onForegroundEvent(({ detail, type }) => {
    if (type === EventType.PRESS) {
      if (detail.notification?.data?.type) {
        handleNavigateOnOpen(
          /** @type {{type: string, bookingId: string}} */(normalizeNotificationData(detail.notification.data)),
        );
      }
    }
  }), [handleNavigateOnOpen]);

  // open notification when app is in background (notifee part to use custom display)
  useEffect(() => notifee.onBackgroundEvent(async ({ detail, type }) => {
    if (type === EventType.PRESS) {
      if (detail.notification?.data?.type) {
        handleNavigateOnOpen(
          /** @type {{type: string, bookingId: string}} */(normalizeNotificationData(detail.notification.data)),
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
        const errorMessage = typeof err === 'string' ? err : err?.message || JSON.stringify(err);
        if (errorMessage.includes('FIS_AUTH_ERROR')) {
          console.warn('[FCM] Firebase Auth failed (SHA-1 mismatch in Local). Notifications skipped.');
        } else {
          console.error('[FCM] Error retrieving token:', err);
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

    // Check for initial notification (Cold Start)
    getMessaging().getInitialNotification().then(remoteMessage => {
      if (remoteMessage) {
        console.log('[FCM] App opened from QUIT state by notification:', remoteMessage);
        const normalizedData = normalizeNotificationData(remoteMessage.data || {});
        if (normalizedData?.type) {
           // Store it in context to be handled when navigation is ready
           console.log('[FCM] Storing pending notification in context');
           dispatch({ 
              type: 'SET_PENDING_NOTIFICATION', 
              payload: normalizedData,
           });
        }
      }
    });

  }, [saveToken, userData, dispatch]);

  useEffect(() => {
    if (!pendingNotification?.type) return undefined;
    let attempts = 0;
    const maxAttempts = 20;
    const interval = setInterval(() => {
      const handled = handleNavigateOnOpen(pendingNotification);
      if (handled || attempts >= maxAttempts) {
        dispatch({ type: 'SET_PENDING_NOTIFICATION', payload: null });
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
