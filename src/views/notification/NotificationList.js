import { useNavigation } from '@react-navigation/native';
import { isThisWeek, isToday, isYesterday } from 'date-fns';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  FlatList,
  Platform,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import Animated, { FadeInDown } from 'react-native-reanimated';

import useTheme from '@/theme/themeContext';

import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import client from '@/services/client';

import { resolveNotificationDestination } from '@/utils/notifications/notificationNavigation';
import {
  formatNotificationRelativeTime,
  getNotificationIcon,
  NOTIFICATION_EMPTY_STATE_BODY,
  NOTIFICATION_EMPTY_STATE_TITLE,
} from '@/utils/notifications/notificationPresentation';
import { normalizeNotificationType, NOTIFICATION_TYPES } from '@/utils/notifications/notificationTypes';

import { useNotificationController } from '@/hooks/useNotificationController';

/**
 * @typedef {{ id?: string | number; documentId?: string; createdAt?: string; type?: string; title?: string; body?: string; read?: boolean; data?: Record<string, any> }} NotificationItem
 * @typedef {{ type: 'header'; title: string; key: string } | { type: 'item'; data: NotificationItem; key: string }} NotificationSectionItem
 */

const groupNotificationsByDate = (/** @type {NotificationItem[]} */ notifications) => {
  const groups = {
    older: /** @type {NotificationItem[]} */ ([]),
    thisWeek: /** @type {NotificationItem[]} */ ([]),
    today: /** @type {NotificationItem[]} */ ([]),
    yesterday: /** @type {NotificationItem[]} */ ([]),
  };

  notifications.forEach((notif) => {
    const date = new Date(notif.createdAt || Date.now());
    if (isToday(date)) {
      groups.today.push(notif);
    } else if (isYesterday(date)) {
      groups.yesterday.push(notif);
    } else if (isThisWeek(date)) {
      groups.thisWeek.push(notif);
    } else {
      groups.older.push(notif);
    }
  });

  return groups;
};

const getNotificationPayload = (/** @type {NotificationItem} */ notification) => ({
  ...(notification.data || {}),
  createdAt: notification.createdAt,
  notificationBody: notification.body,
  notificationId: notification.documentId || notification.id,
  notificationKind: notification?.data?.type,
  notificationTitle: notification.title,
  type: notification.type,
});

/**
 *
 */
function NotificationList() {
  const {
    Alignments,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const navigation = useNavigation();
  const nav = /** @type {any} */ (navigation);
  const { t } = useTranslation();
  const {
    deleteNotification,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    loadMore,
    markAllAsRead,
    markAsRead,
    notifications,
    refreshNotifications,
    unreadCount,
  } = useNotificationController();

  const groupedNotifications = useMemo(
    () => groupNotificationsByDate(notifications),
    [notifications],
  );

  const getStableItemKey = useCallback((/** @type {NotificationItem} */ notification, /** @type {number} */ index) => (
    String(
      notification.documentId
      || notification.id
      || `${notification.type || 'notification'}-${notification.createdAt || index}`,
    )
  ), []);

  const sections = useMemo(() => {
    /** @type {NotificationSectionItem[]} */
    const result = [];

    if (groupedNotifications.today.length > 0) {
      result.push({ key: 'header-today', title: "Aujourd'hui", type: 'header' });
      groupedNotifications.today.forEach((n, index) => result.push({ data: n, key: getStableItemKey(n, index), type: 'item' }));
    }
    if (groupedNotifications.yesterday.length > 0) {
      result.push({ key: 'header-yesterday', title: 'Hier', type: 'header' });
      groupedNotifications.yesterday.forEach((n, index) => result.push({ data: n, key: getStableItemKey(n, index), type: 'item' }));
    }
    if (groupedNotifications.thisWeek.length > 0) {
      result.push({ key: 'header-week', title: 'Cette semaine', type: 'header' });
      groupedNotifications.thisWeek.forEach((n, index) => result.push({ data: n, key: getStableItemKey(n, index), type: 'item' }));
    }
    if (groupedNotifications.older.length > 0) {
      result.push({ key: 'header-older', title: 'Plus ancien', type: 'header' });
      groupedNotifications.older.forEach((n, index) => result.push({ data: n, key: getStableItemKey(n, index), type: 'item' }));
    }

    return result;
  }, [getStableItemKey, groupedNotifications]);

  const showActionMessage = useCallback((/** @type {string} */ message) => {
    if (Platform.OS === 'android' && ToastAndroid?.show) {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    }
    Alert.alert('Notifications', message);
  }, []);

  const showActionError = useCallback((/** @type {string} */ fallbackMessage, /** @type {any} */ error) => {
    const message = error?.response?.data?.error?.message || fallbackMessage;
    showActionMessage(message);
  }, [showActionMessage]);

  const isDeclinedParticipationNotification = useCallback((/** @type {NotificationItem} */ notification) => {
    const normalizedType = normalizeNotificationType(
      notification?.type || notification?.data?.type || notification?.data?.notificationKind || '',
    );
    const status = String(notification?.data?.status || '').toLowerCase();
    return normalizedType === NOTIFICATION_TYPES.PARTICIPATION_REQUEST && status === 'declined';
  }, []);

  const isRsvpReminderNotification = useCallback((/** @type {NotificationItem} */ notification) => {
    const normalizedType = normalizeNotificationType(
      notification?.type || notification?.data?.type || notification?.data?.notificationKind || '',
    );
    return normalizedType === NOTIFICATION_TYPES.EVENT_REMINDER;
  }, []);

  const sendRsvpFromNotification = useCallback(async (
    /** @type {NotificationItem} */ notification,
    /** @type {'present' | 'absent'} */ answer,
  ) => {
    const payload = getNotificationPayload(notification);
    const eventId = String(payload?.eventId || '').trim();
    if (!eventId) {
      showActionError("Impossible de retrouver l'evenement associe a cette notification.");
      return;
    }

    try {
      await client.post(`/events/${eventId}/rsvp`, {
        answer,
        notificationId: payload.notificationId,
        source: 'in_app',
      });
      await markAsRead(String(notification.documentId || notification.id || ''));
      refreshNotifications();

      const successMessage = answer === 'present'
        ? 'Presence enregistree.'
        : 'Absence enregistree.';

      showActionMessage(successMessage);
    } catch (error) {
      showActionError("Impossible d'enregistrer votre reponse.", error);
    }
  }, [markAsRead, refreshNotifications, showActionError, showActionMessage]);

  const handlePressNotification = useCallback(async (/** @type {NotificationItem} */ notification) => {
    try {
      await markAsRead(String(notification.documentId || notification.id || ''));
    } catch (error) {
      showActionError('Impossible de marquer la notification comme lue.', error);
    }

    const payload = getNotificationPayload(notification);
    const destination = resolveNotificationDestination(payload);

    if (destination?.route) {
      console.log(`[NOTIF_OPENED] type=${notification.type || payload.type || 'unknown'} route=${destination.route} source=in_app_history`);
      nav.navigate(destination.route, destination.params || {});
      return;
    }

    console.log(`[NOTIF_OPENED] type=${notification.type || payload.type || 'unknown'} route=${RouteNames.NotificationList} source=in_app_history_fallback`);
    nav.navigate(RouteNames.NotificationList);
  }, [markAsRead, nav, showActionError]);

  const handleDelete = useCallback((/** @type {NotificationItem} */ notification) => {
    Alert.alert(
      'Supprimer',
      'Supprimer cette notification ?',
      [
        { style: 'cancel', text: 'Annuler' },
        {
          onPress: async () => {
            try {
              await deleteNotification(String(notification.documentId || notification.id || ''));
            } catch (error) {
              showActionError('Impossible de supprimer la notification.', error);
            }
          },
          style: 'destructive',
          text: 'Supprimer',
        },
      ],
    );
  }, [deleteNotification, showActionError]);

  const renderRightActions = useCallback((/** @type {NotificationItem} */ notification) => (
    <TouchableOpacity
      onPress={() => handleDelete(notification)}
      style={{
        alignItems: 'center',
        backgroundColor: Colors.error500 || '#EF4444',
        borderRadius: 12,
        justifyContent: 'center',
        marginBottom: 12,
        width: 80,
      }}
    >
      <Text style={{ color: '#FFF', fontWeight: '600' }}>{'\u{1F5D1}\u{FE0F}'}</Text>
    </TouchableOpacity>
  ), [Colors, handleDelete]);

  const renderLeftActions = useCallback((/** @type {NotificationItem} */ notification) => (
    <TouchableOpacity
      onPress={async () => {
        try {
          await markAsRead(String(notification.documentId || notification.id || ''));
        } catch (error) {
          showActionError('Impossible de marquer comme lu.', error);
        }
      }}
      style={{
        alignItems: 'center',
        backgroundColor: Colors.primary500,
        borderRadius: 12,
        justifyContent: 'center',
        marginBottom: 12,
        width: 80,
      }}
    >
      <Text style={{ color: '#FFF', fontWeight: '600' }}>
        {'\u2713'}
        {' '}
        Lu
      </Text>
    </TouchableOpacity>
  ), [Colors, markAsRead, showActionError]);

  const renderItem = useCallback((/** @type {{ item: NotificationSectionItem; index: number }} */ { index, item }) => {
    if (item.type === 'header') {
      return (
        <Animated.View
          entering={FadeInDown.delay(index * 50).duration(300)}
          style={[Spaces.marginTop[16], Spaces.marginBottom[8]]}
        >
          <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
            {item.title}
          </Text>
        </Animated.View>
      );
    }

    const notification = item.data;
    const icon = getNotificationIcon(notification.type);
    const isDeclinedParticipation = isDeclinedParticipationNotification(notification);
    const isRsvpReminder = isRsvpReminderNotification(notification);

    return (
      <Animated.View entering={FadeInDown.delay(index * 30).duration(200)}>
        <Swipeable
          overshootLeft={false}
          overshootRight={false}
          renderLeftActions={() => !notification.read && renderLeftActions(notification)}
          renderRightActions={() => renderRightActions(notification)}
        >
          <View
            style={[
              Spaces.padding[16],
              Spaces.marginBottom[12],
              {
                backgroundColor: notification.read
                  ? 'rgba(255, 255, 255, 0.03)'
                  : 'rgba(1, 179, 244, 0.12)',
                borderLeftColor: Colors.primary500,
                borderLeftWidth: notification.read ? 0 : 4,
                borderRadius: 12,
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => handlePressNotification(notification)}
              style={{
                alignItems: 'flex-start',
                flexDirection: 'row',
              }}
            >
              <View
                style={{
                  alignItems: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: 20,
                  height: 40,
                  justifyContent: 'center',
                  marginRight: 12,
                  width: 40,
                }}
              >
                <Text style={{ fontSize: 18 }}>{icon}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                  <Text
                    numberOfLines={1}
                    style={[
                      notification.read ? Fonts.p2 : Fonts.p2Bold,
                      { color: Colors.neutral00, flex: 1 },
                    ]}
                  >
                    {notification.title}
                  </Text>
                  <Text style={[Fonts.p3, { color: Colors.neutral300, marginLeft: 8 }]}>
                    {formatNotificationRelativeTime(notification.createdAt || new Date())}
                  </Text>
                </View>
                <Text
                  numberOfLines={2}
                  style={[Fonts.p3, { color: Colors.neutral200, lineHeight: 18 }]}
                >
                  {notification.body}
                </Text>
                {isDeclinedParticipation ? (
                  <Text
                    style={[
                      Fonts.p3Bold,
                      {
                        color: Colors.error500 || '#EF4444',
                        marginTop: 8,
                      },
                    ]}
                  >
                    {t('notifications.labels.participationDeclined')}
                  </Text>
                ) : null}
              </View>

              {!notification.read ? (
                <View
                  style={{
                    backgroundColor: Colors.primary500,
                    borderRadius: 4,
                    height: 8,
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    width: 8,
                  }}
                />
              ) : null}
            </TouchableOpacity>

            {isRsvpReminder ? (
              <View
                style={{
                  flexDirection: 'row',
                  gap: 10,
                  marginTop: 12,
                }}
              >
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => sendRsvpFromNotification(notification, 'present')}
                  style={{
                    backgroundColor: Colors.primary500,
                    borderRadius: 999,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>Je participe</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => sendRsvpFromNotification(notification, 'absent')}
                  style={{
                    backgroundColor: 'transparent',
                    borderColor: Colors.neutral300,
                    borderRadius: 999,
                    borderWidth: 1,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={[Fonts.p3Bold, { color: Colors.neutral100 }]}>Je suis absent</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </Swipeable>
      </Animated.View>
    );
  }, [Colors, Fonts, Spaces, handlePressNotification, isDeclinedParticipationNotification, isRsvpReminderNotification, renderRightActions, renderLeftActions, sendRsvpFromNotification, t]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      loadMore();
    }
  }, [hasNextPage, isFetchingNextPage, loadMore]);

  const handleBackPress = useCallback(() => {
    if (nav.canGoBack()) {
      nav.goBack();
      return;
    }

    nav.navigate(RouteNames.HomeTab);
  }, [nav]);

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[Spaces.padding[16]]}
    >
      <View style={[Alignments.row, Alignments.alignCenter, Spaces.marginBottom[16]]}>
        <View style={{ width: 48 }}>
          <HeaderBackButton
            onPress={handleBackPress}
            withDefaultMargin={false}
          />
        </View>
        <View style={[Alignments.alignCenter, { flex: 1 }]}>
          <Text style={[Fonts.h3Bold, { color: Colors.neutral00 }]}>Notifications</Text>
        </View>
        <View style={[Alignments.alignEnd, { minWidth: 72 }]}>
          {unreadCount > 0 ? (
            <TouchableOpacity
              onPress={async () => {
                try {
                  await markAllAsRead();
                } catch (error) {
                  showActionError('Impossible de marquer toutes les notifications comme lues.', error);
                }
              }}
            >
              <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>Tout lire</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      <FlatList
        contentContainerStyle={{ paddingBottom: 40 }}
        data={sections}
        keyExtractor={(item) => item.key}
        ListEmptyComponent={
          !isLoading ? (
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>{'\u{1F514}'}</Text>
              <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
                {NOTIFICATION_EMPTY_STATE_TITLE}
              </Text>
              <Text
                style={[
                  Fonts.p2,
                  {
                    color: Colors.neutral00,
                    marginTop: 8,
                    opacity: 0.7,
                    textAlign: 'center',
                  },
                ]}
              >
                {NOTIFICATION_EMPTY_STATE_BODY}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={{ alignItems: 'center', padding: 16 }}>
              <Text style={[Fonts.p3, { color: Colors.neutral400 }]}>Chargement...</Text>
            </View>
          ) : null
        }
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.3}
        onRefresh={refreshNotifications}
        refreshing={isLoading && !isFetchingNextPage}
        renderItem={renderItem}
      />
    </ScreenContainer>
  );
}

export default NotificationList;
