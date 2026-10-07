import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
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

import { withAlpha } from '@/theme/colors';
import useTheme from '@/theme/themeContext';

import { SvgIcon } from '@/components/atoms/SvgIcon/SvgIcon';

import { navigate as navigateFromRoot } from '@/navigation/navigationService';
import { RouteNames } from '@/navigation/routeNames';

import { getErrorMessage } from '@/utils/errors/displayError';
import { resolveNotificationDestination } from '@/utils/notifications/notificationNavigation';
import {
  formatNotificationRelativeTime,
  getNotificationIcon,
  getNotificationTone,
} from '@/utils/notifications/notificationPresentation';

/**
 * @param {NotificationPopupProps} props
 * @returns {import('react').ReactElement | null}
 */
function NotificationPopup({
  isError = false,
  isLoading,
  isVisible,
  notifications,
  onClose,
  onMarkAllAsRead,
  onMarkAsRead,
  onRetry = undefined,
}) {
  const {
    ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const navigation = /** @type {any} */ (useNavigation());
  const insets = useSafeAreaInsets();

  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const recentNotifications = safeNotifications.slice(0, 8);
  const unreadCount = safeNotifications.filter((n) => !n.read).length;
  const shouldShowLoading = Boolean(isLoading) && recentNotifications.length === 0;
  // VILLE-NOTIFS (07/10) — une lecture en echec se dit : elle ne se deguise plus en « Aucune
  // notification » (la cloche disait 4, le panneau rien). Deja des notifications : on les garde.
  const nothingToShow = !shouldShowLoading && recentNotifications.length === 0;
  const shouldShowError = nothingToShow && Boolean(isError);
  const shouldShowEmpty = nothingToShow && !shouldShowError;

  const popupBackground = Colors?.neutral900 || '#121212';
  const popupBorder = Colors?.primary500 || '#01B3F4';
  const textPrimary = Colors?.neutral00 || '#FFFFFF';
  const textSecondary = Colors?.neutral100 || '#D1D5DB';
  const textMuted = Colors?.neutral200 || '#9CA3AF';
  const inkOnPrimary = Colors?.primary900 || '#001218';

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

  const handlePressNotification = (/** @type {NotificationPopupItem} */ notification) => {
    const notificationId = String(notification.documentId || notification.id || '');
    const payload = {
      ...(notification.data || {}),
      notificationKind: notification?.data?.type,
      type: notification.type,
    };

    /** @type {any} */
    let destination = null;
    try {
      destination = resolveNotificationDestination(payload);
    } catch (_error) {
      destination = null;
    }

    if (onMarkAsRead && notificationId) {
      Promise.resolve(onMarkAsRead(notificationId)).catch((error) => {
        const typedError = /** @type {any} */ (error);
        showFeedback(getErrorMessage(typedError, 'generic') || t(
          'notificationPopup.errors.markRead',
          'Impossible de marquer comme lu.',
        ));
      });
    }

    onClose();

    setTimeout(() => {
      if (destination?.route) {
        console.log(`[NOTIF_OPENED] type=${notification.type || payload.type || 'unknown'} route=${destination.route} source=in_app_popup`);
        const didNavigate = navigateFromRoot(destination.route, destination.params || {});
        if (!didNavigate) {
          navigation.navigate(destination.route, destination.params || {});
        }
        return;
      }

      console.log(`[NOTIF_OPENED] type=${notification.type || payload.type || 'unknown'} route=${RouteNames.NotificationList} source=in_app_popup_fallback`);
      const didNavigate = navigateFromRoot(RouteNames.NotificationList);
      if (!didNavigate) {
        navigation.navigate(RouteNames.NotificationList);
      }
    }, 0);
  };

  const handleViewAll = () => {
    onClose();
    setTimeout(() => {
      const didNavigate = navigateFromRoot(RouteNames.NotificationList);
      if (!didNavigate) {
        navigation.navigate(RouteNames.NotificationList);
      }
    }, 0);
  };

  const handleMarkAllAsRead = async () => {
    if (!onMarkAllAsRead) return;
    try {
      await onMarkAllAsRead();
    } catch (error) {
      showFeedback(getErrorMessage(error, 'generic') || t(
        'notificationPopup.errors.markAll',
        'Impossible de marquer toutes les notifications.',
      ));
    }
  };

  let popupContent = null;
  if (shouldShowLoading) {
    popupContent = (
      <View style={{ alignItems: 'center', padding: 24 }}>
        <Text style={[Fonts.p3 || { fontSize: 14 }, { color: textMuted, fontStyle: 'italic' }]}>
          {t('notificationPopup.loading', 'Chargement des notifications...')}
        </Text>
      </View>
    );
  } else if (shouldShowError) {
    popupContent = (
      <View style={{ alignItems: 'center', padding: 24 }}>
        <Text style={[Fonts.p3 || { fontSize: 14 }, { color: textSecondary, textAlign: 'center' }]}>
          {t('notificationPopup.errors.load', 'Impossible de charger les notifications.')}
        </Text>
        {onRetry ? (
          <TouchableOpacity
            accessibilityLabel={t('common.actions.retry', 'Réessayer')}
            accessibilityRole="button"
            hitSlop={ApplicationStyle.hitSlop.min44From24}
            onPress={onRetry}
            style={{ marginTop: 12 }}
          >
            <Text style={[Fonts.p3Bold || { fontWeight: '600' }, { color: popupBorder }]}>
              {t('common.actions.retry', 'Réessayer')}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  } else if (shouldShowEmpty) {
    popupContent = (
      <View style={{ alignItems: 'center', padding: 24 }}>
        <SvgIcon color={textMuted} height={14} name="bell" style={{ marginBottom: 8 }} width={14} />
        <Text style={[Fonts.p3 || { fontSize: 14 }, { color: textMuted, fontStyle: 'italic' }]}>
          {t('notificationPopup.empty.title', 'Aucune notification')}
        </Text>
        <Text
          style={[
            Fonts.p3 || { fontSize: 14 },
            { color: textMuted, marginTop: 6, textAlign: 'center' },
          ]}
        >
          {t('notificationPopup.empty.body', 'Les nouvelles notifications apparaîtront ici.')}
        </Text>
      </View>
    );
  } else {
    popupContent = recentNotifications.map((notif, index) => {
      // COLL-C3B-BIS (planche 35) : la même icône par famille que la liste, et sa couleur.
      const icon = getNotificationIcon(notif.type, notif.data);
      const ton = getNotificationTone(notif.type, notif.data);
      let couleurIcone = textPrimary;
      if (ton === 'succes') couleurIcone = Colors?.success500 || textPrimary;
      if (ton === 'refus') couleurIcone = Colors?.error300 || textPrimary;
      return (
        <TouchableOpacity
          accessibilityLabel={`${notif.title || t(
            'notificationPopup.defaultTitle',
            'Notification',
          )}. ${notif.body || ''}`.trim()}
          accessibilityRole="button"
          accessibilityState={{ selected: !notif.read }}
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
            <SvgIcon color={couleurIcone} height={16} name={icon} width={16} />
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text numberOfLines={1} style={[notif.read ? Fonts.p3 : Fonts.p3Bold, { color: textPrimary, flex: 1, fontSize: 14 }]}>
                {notif.title || t('notificationPopup.defaultTitle', 'Notification')}
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
          accessibilityLabel={t('notificationPopup.close', 'Fermer les notifications')}
          accessibilityRole="button"
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
                {t('notificationPopup.title', 'Notifications')}
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
                  <Text style={{ color: inkOnPrimary, fontSize: 11, fontWeight: '600' }}>
                    {unreadCount}
                  </Text>
                </View>
              ) : null}
            </View>

            {unreadCount > 0 ? (
              <TouchableOpacity
                accessibilityLabel={t('notificationPopup.markAll', 'Tout lire')}
                accessibilityRole="button"
                hitSlop={ApplicationStyle.hitSlop.min44From24}
                onPress={handleMarkAllAsRead}
              >
                <Text style={[Fonts.p3Bold || { fontWeight: '600' }, { color: popupBorder }]}>
                  {t('notificationPopup.markAll', 'Tout lire')}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 320 }}>
            {popupContent}
          </ScrollView>

          <TouchableOpacity
            accessibilityLabel={t('notificationPopup.viewAll', 'Voir toutes les notifications')}
            accessibilityRole="button"
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
              {t('notificationPopup.viewAll', 'Voir toutes les notifications')}
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
