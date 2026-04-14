import { useNavigation } from '@react-navigation/native';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import { RouteNames } from '@/navigation/routeNames';

import { getErrorMessage } from '@/utils/errors/displayError';
import { resolveNotificationDestination } from '@/utils/notifications/notificationNavigation';
import {
  formatNotificationRelativeTime,
  getNotificationIcon,
  NOTIFICATION_EMPTY_STATE_BODY,
  NOTIFICATION_EMPTY_STATE_TITLE,
} from '@/utils/notifications/notificationPresentation';

/**
 * @param {string | undefined | null} color
 * @param {number} alpha
 * @returns {string}
 */
const withAlpha = (color, alpha) => {
  if (typeof color !== 'string') return `rgba(1, 179, 244, ${alpha})`;

  const normalized = color.trim();
  const shortMatch = /^#([0-9a-fA-F]{3})$/.exec(normalized);
  if (shortMatch) {
    const [r, g, b] = shortMatch[1].split('').map((char) => Number.parseInt(char + char, 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  const longMatch = /^#([0-9a-fA-F]{6})$/.exec(normalized);
  if (longMatch) {
    const hex = longMatch[1];
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  return normalized;
};

/**
 * @param {NotificationPopupProps} props
 * @returns {import('react').ReactElement | null}
 */
function NotificationPopup({
  isLoading,
  isVisible,
  notifications,
  onClose,
  onMarkAllAsRead,
  onMarkAsRead,
}) {
  const { Colors, Fonts, Spaces } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const insets = useSafeAreaInsets();

  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const recentNotifications = safeNotifications.slice(0, 8);
  const unreadCount = safeNotifications.filter((n) => !n.read).length;
  const shouldShowLoading = Boolean(isLoading) && recentNotifications.length === 0;
  const shouldShowEmpty = !shouldShowLoading && recentNotifications.length === 0;

  const popupBackground = Colors?.neutral900 || '#121212';
  const popupBorder = Colors?.primary500 || '#01B3F4';
  const textPrimary = Colors?.neutral00 || '#FFFFFF';
  const textSecondary = Colors?.neutral100 || '#D1D5DB';
  const textMuted = Colors?.neutral200 || '#9CA3AF';

  const overlayColor = withAlpha(Colors?.neutral900 || '#000000', 0.6);
  const subtleBorder = withAlpha(textPrimary, 0.08);
  const itemDivider = withAlpha(textPrimary, 0.05);
  const iconBackground = Colors?.neutral800 || withAlpha(textPrimary, 0.1);
  const unreadItemBackground = withAlpha(popupBorder, 0.1);
  const unreadBackground = withAlpha(popupBorder, 0.08);

  const showFeedback = (/** @type {string} */ message) => {
    if (!message) return;
    if (Platform.OS === 'android' && ToastAndroid?.show) {
      ToastAndroid.show(message, ToastAndroid.SHORT);
      return;
    }
    console.warn(`[NotificationPopup] ${message}`);
  };

  if (!isVisible) return null;

  const handlePressNotification = async (/** @type {NotificationPopupItem} */ notification) => {
    const notificationId = String(notification.documentId || notification.id || '');
    if (onMarkAsRead && notificationId) {
      try {
        await onMarkAsRead(notificationId);
      } catch (error) {
        showFeedback(getErrorMessage(error, 'generic') || 'Impossible de marquer comme lu.');
      }
    }

    onClose();

    const payload = {
      ...(notification.data || {}),
      notificationKind: notification?.data?.type,
      type: notification.type,
    };

    try {
      const destination = resolveNotificationDestination(payload);
      if (destination?.route) {
        console.log(`[NOTIF_OPENED] type=${notification.type || payload.type || 'unknown'} route=${destination.route} source=in_app_popup`);
        navigation.navigate(destination.route, destination.params || {});
      } else {
        console.log(`[NOTIF_OPENED] type=${notification.type || payload.type || 'unknown'} route=${RouteNames.NotificationList} source=in_app_popup_fallback`);
        navigation.navigate(RouteNames.NotificationList);
      }
    } catch (_error) {
      console.log(`[NOTIF_OPENED] type=${notification.type || payload.type || 'unknown'} route=${RouteNames.NotificationList} source=in_app_popup_error_fallback`);
      navigation.navigate(RouteNames.NotificationList);
    }
  };

  const handleViewAll = () => {
    onClose();
    navigation.navigate(RouteNames.NotificationList);
  };

  const handleMarkAllAsRead = async () => {
    if (!onMarkAllAsRead) return;
    try {
      await onMarkAllAsRead();
    } catch (error) {
      showFeedback(getErrorMessage(error, 'generic') || 'Impossible de marquer toutes les notifications.');
    }
  };

  let popupContent = null;
  if (shouldShowLoading) {
    popupContent = (
      <View style={{ alignItems: 'center', padding: 24 }}>
        <Text style={[Fonts.p3 || { fontSize: 14 }, { color: textMuted, fontStyle: 'italic' }]}>
          Chargement des notifications...
        </Text>
      </View>
    );
  } else if (shouldShowEmpty) {
    popupContent = (
      <View style={{ alignItems: 'center', padding: 24 }}>
        <Text style={{
          color: textMuted, fontSize: 12, letterSpacing: 1, marginBottom: 8,
        }}
        >
          {'\u{1F514}'}
        </Text>
        <Text style={[Fonts.p3 || { fontSize: 14 }, { color: textMuted, fontStyle: 'italic' }]}>
          {NOTIFICATION_EMPTY_STATE_TITLE}
        </Text>
        <Text
          style={[
            Fonts.p3 || { fontSize: 14 },
            { color: textMuted, marginTop: 6, textAlign: 'center' },
          ]}
        >
          {NOTIFICATION_EMPTY_STATE_BODY}
        </Text>
      </View>
    );
  } else {
    popupContent = recentNotifications.map((notif, index) => {
      const icon = getNotificationIcon(notif.type);
      return (
        <TouchableOpacity
          key={notif.documentId || notif.id || index}
          onPress={() => handlePressNotification(notif)}
          style={[
            Spaces.padding[12],
            {
              backgroundColor: notif.read ? 'transparent' : unreadItemBackground,
              borderBottomColor: itemDivider,
              borderBottomWidth: 1,
              borderLeftColor: popupBorder,
              borderLeftWidth: notif.read ? 0 : 3,
              flexDirection: 'row',
            },
          ]}
        >
          <View
            style={{
              alignItems: 'center',
              backgroundColor: iconBackground,
              borderRadius: 16,
              height: 32,
              justifyContent: 'center',
              marginRight: 10,
              width: 32,
            }}
          >
            <Text style={{ fontSize: 14 }}>{icon}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text numberOfLines={1} style={[notif.read ? Fonts.p3 : Fonts.p3Bold, { color: textPrimary, flex: 1, fontSize: 14 }]}>
                {notif.title || 'Notification'}
              </Text>
              <Text style={{ color: textMuted, fontSize: 10, marginLeft: 8 }}>
                {formatNotificationRelativeTime(notif.createdAt)}
              </Text>
            </View>
            <Text numberOfLines={1} style={[Fonts.p3 || { fontSize: 14 }, { color: textSecondary }]}>
              {notif.body}
            </Text>
          </View>

          {!notif.read ? (
            <View
              style={{
                backgroundColor: popupBorder,
                borderRadius: 3,
                height: 6,
                marginLeft: 4,
                marginTop: 4,
                width: 6,
              }}
            />
          ) : null}
        </TouchableOpacity>
      );
    });
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      transparent
      visible={isVisible}
    >
      <View style={[styles.modalOverlay, { paddingTop: insets.top + 50 }]}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={onClose}
          style={[styles.touchableBackground, { backgroundColor: overlayColor }]}
        />

        <View
          style={[
            styles.popup,
            {
              backgroundColor: popupBackground,
              borderColor: popupBorder,
              marginRight: 16,
            },
          ]}
        >
          <View
            style={[
              Spaces.padding[16],
              {
                alignItems: 'center',
                borderBottomColor: subtleBorder,
                borderBottomWidth: 1,
                flexDirection: 'row',
                justifyContent: 'space-between',
              },
            ]}
          >
            <View style={{ alignItems: 'center', flexDirection: 'row' }}>
              <Text style={[Fonts.h4Bold || { fontSize: 16, fontWeight: 'bold' }, { color: textPrimary }]}>
                Notifications
              </Text>
              {unreadCount > 0 ? (
                <View
                  style={{
                    backgroundColor: popupBorder,
                    borderRadius: 10,
                    marginLeft: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                  }}
                >
                  <Text style={{ color: textPrimary, fontSize: 11, fontWeight: '600' }}>
                    {unreadCount}
                  </Text>
                </View>
              ) : null}
            </View>

            {unreadCount > 0 ? (
              <TouchableOpacity onPress={handleMarkAllAsRead}>
                <Text style={[Fonts.p3Bold || { fontWeight: '600' }, { color: popupBorder }]}>
                  Tout lire
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
            {popupContent}
          </ScrollView>

          <TouchableOpacity
            onPress={handleViewAll}
            style={{
              alignItems: 'center',
              backgroundColor: unreadBackground,
              borderTopColor: subtleBorder,
              borderTopWidth: 1,
              padding: 16,
            }}
          >
            <Text style={[Fonts.p2Bold || { fontWeight: 'bold' }, { color: popupBorder }]}>
              Voir toutes les notifications
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    alignItems: 'flex-end',
    flex: 1,
    justifyContent: 'flex-start',
    paddingRight: 0,
  },
  popup: {
    backgroundColor: '#121212',
    borderRadius: 16,
    borderWidth: 1,
    elevation: 10,
    maxWidth: '90%',
    overflow: 'hidden',
    width: 320,
  },
  touchableBackground: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});

export default NotificationPopup;
