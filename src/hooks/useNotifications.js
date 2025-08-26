import notifee, { EventType } from '@notifee/react-native';
import { getApp } from '@react-native-firebase/app';
import {
  getMessaging,
  getToken,
  onMessage,
  requestPermission,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

import { NOTIFICATION_TYPES } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';

import { addDeviceToken } from '@/services/auth/authService';

import { RouteNames } from '../navigation/routeNames';
import { useAppContext } from '../store/appContext';

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
 * @inheritdoc
 */
const useNotifications = ({ navigate }) => {
  // hooks
  const [{ fcmToken }, dispatch] = useAppContext();
  const { userData } = useAuth();

  const { mutate: saveTokenMutation } = useMutation({
    meta: {
      preventToastError: true,
    },
    mutationFn: addDeviceToken,
    onError: () => {
      dispatch({ payload: undefined, type: 'SET_FCM_TOKEN' });
    },
    onSuccess: (_, token) => {
      dispatch({ payload: token, type: 'SET_FCM_TOKEN' });
    },
  });

  // api calls
  const saveToken = useCallback((/** @type {string} */token) => {
    if (token) {
      saveTokenMutation(token);
    }
  }, [saveTokenMutation]);

  // methods
  const handleNavigateOnOpen = useCallback((/** @type {remoteMessageData} */remoteMessageData) => {
    switch (remoteMessageData.type) {
      case NOTIFICATION_TYPES.ADD_TO_TEAM:
        navigate(RouteNames.Profile, {
          params: {
            teamId: remoteMessageData.teamId,
          },
          screen: RouteNames.TeamDetails,
        });
        break;
      case NOTIFICATION_TYPES.CLUB_MEMBERSHIP_REQUEST:
        navigate(RouteNames.Profile, {
          screen: RouteNames.ClubMembershipRequests,
        });
        break;
      case NOTIFICATION_TYPES.CLUB_REQUEST:
        navigate(RouteNames.Profile, {
          params: {
            clubId: remoteMessageData.clubId,
          },
          screen: RouteNames.Club,
        });
        break;
      case NOTIFICATION_TYPES.EVENT_CANCELLATION:
        navigate(RouteNames.MyEventList);
        break;
      case NOTIFICATION_TYPES.EVENT_REMINDER:
        navigate(RouteNames.MyEventList, {
          params: {
            eventId: remoteMessageData.eventId,
          },
          screen: RouteNames.EventDetails,
        });
        break;
      case NOTIFICATION_TYPES.NEW_PARTICIPATION:
        navigate(RouteNames.MyEventList, {
          params: {
            eventId: remoteMessageData.eventId,
          },
          screen: RouteNames.EventDetails,
        });
        break;
      case NOTIFICATION_TYPES.NEW_TEAM:
        navigate(RouteNames.Profile, {
          params: {
            teamId: remoteMessageData.teamId,
          },
          screen: RouteNames.TeamDetails,
        });
        break;
      case NOTIFICATION_TYPES.NEW_TEAM_MESSAGE:
        navigate(RouteNames.Chat, {
          params: {
            chatId: remoteMessageData.conversationId,
          },
          screen: RouteNames.Conversation,
        });
        break;
      case NOTIFICATION_TYPES.NEW_TEAM_PLAYER_MESSAGE:
        navigate(RouteNames.Chat, {
          params: {
            chatId: remoteMessageData.conversationId,
          },
          screen: RouteNames.Conversation,
        });
        break;
      case NOTIFICATION_TYPES.NEW_WHISPER:
        navigate(RouteNames.Chat, {
          params: {
            chatId: remoteMessageData.conversationId,
          },
          screen: RouteNames.Conversation,
        });
        break;
      case NOTIFICATION_TYPES.PARTICIPATION_REQUEST:
        navigate(RouteNames.MyEventList, {
          params: {
            eventId: remoteMessageData.eventId,
          },
          screen: RouteNames.EventDetails,
        });
        break;
      case NOTIFICATION_TYPES.TEAM_MEMBERSHIP_REQUEST:
        navigate(RouteNames.Profile, {
          params: {
            teamId: remoteMessageData.teamId,
          },
          screen: RouteNames.TeamDetails,
        });
        break;
      case NOTIFICATION_TYPES.TEAM_REQUEST:
        navigate(RouteNames.Profile, {
          screen: RouteNames.TeamMembershipRequests,
        });
        break;
      default:
        break;
    }
  }, [navigate]);

  // listeners

  // Handle foreground notif display
  useEffect(() => {
    const messagingInstance = getMessaging(getApp());
    const unsubscribe = onMessage(messagingInstance, async (remoteMessage) => {
      // Skip notification display for message types that shouldn't show in foreground
      const skipTypes = [
        '',
        // NOTIFICATION_TYPES.NEW_TEAM_MESSAGE,
        // NOTIFICATION_TYPES.NEW_TEAM_PLAYER_MESSAGE,
        // NOTIFICATION_TYPES.NEW_WHISPER,
      ];

      const messageType = remoteMessage.data?.type;
      if (messageType && typeof messageType === 'string' && skipTypes.includes(messageType)) {
        return;
      }

      onDisplayNotification({
        body: remoteMessage.notification?.body || '',
        data: remoteMessage.data,
        title: remoteMessage.notification?.title || '',
      });
    });
    return unsubscribe;
  }, []);

  // open notification press event
  useEffect(() => {
    const messagingInstance = getMessaging(getApp());
    const unsubscribe = setBackgroundMessageHandler(messagingInstance, async (remoteMessage) => {
      if (remoteMessage.data?.type) {
        handleNavigateOnOpen(/** @type {{type: string, bookingId: string}} */(remoteMessage.data));
      }
    });
    return unsubscribe;
  });

  // open notification when app is in foreground
  useEffect(() => notifee.onForegroundEvent(({ detail, type }) => {
    if (type === EventType.PRESS) {
      if (detail.notification?.data?.type) {
        handleNavigateOnOpen(
          /** @type {{type: string, bookingId: string}} */(detail.notification.data),
        );
      }
    }
  }));

  // open notification when app is in background (notifee part to use custom display)
  useEffect(() => notifee.onBackgroundEvent(async ({ detail, type }) => {
    if (type === EventType.PRESS) {
      if (detail.notification?.data?.type) {
        handleNavigateOnOpen(
          /** @type {{type: string, bookingId: string}} */(detail.notification.data),
        );
      }
    }
  }));

  // Get FCM token
  useEffect(() => {
    const retreiveFCMToken = async () => {
      try {
        const messagingInstance = getMessaging(getApp());

        if (Platform.OS === 'ios') {
          // Ensure device is registered and has permissions
          await requestUserPermission();

          // Double check registration
          const registered = await messagingInstance.isDeviceRegisteredForRemoteMessages;
          if (!registered) {
            await messagingInstance.registerDeviceForRemoteMessages();
          }
        } else {
          // For Android, just request permission
          const permissionGranted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          );
          if (!permissionGranted) {
            await requestUserPermission();
          }
        }

        // Finally get FCM token
        const token = await getToken(messagingInstance);
        if (token) {
          saveToken(token);
        } else {
          throw new Error('Failed to get FCM token');
        }
      } catch (err) {
        throw new Error(`Failed to retrieve token: ${err}`);
      }
    };
    if (userData && !fcmToken) {
      retreiveFCMToken();
    }
  }, [fcmToken, saveToken, userData]);

  return {
    saveToken,
  };
};
export default useNotifications;
