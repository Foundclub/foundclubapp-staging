import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated, Image, InteractionManager, Platform, StyleSheet, Text, TouchableOpacity, Vibration,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import NotificationPopup from '@/components/organisms/notificationPopup/NotificationPopup';

import {
  getWebUnreadBadgeDelayMs,
  getWebUnreadPollMs,
} from '@/utils/webRuntime';

import { useNotificationController } from '@/hooks/useNotificationController';

/**
 * Notification Badge Component
 * Displays a bell icon with a red dot if there are unread notifications.
 * Features a pulse animation when new notifications arrive.
 * @param {{
 *   onPress?: () => void;
 *   style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
 *   withDefaultMargin?: boolean;
 * }} [props]
 * @returns {import('react').ReactElement}
 */
function NotificationBadge({
  onPress,
  style = undefined,
  withDefaultMargin = true,
} = {}) {
  const { Colors, Images } = useTheme();
  const { t } = useTranslation();
  const { isBootstrapResolved } = useAuth();
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [isUnreadCountReady, setIsUnreadCountReady] = useState(false);
  const [allowUnreadFallbackFetch, setAllowUnreadFallbackFetch] = useState(false);
  const [prevUnreadCount, setPrevUnreadCount] = useState(0);
  const shouldLoadNotifications = !onPress && isPopupVisible;
  const unreadBadgeDelayMs = Platform.OS === 'web' ? getWebUnreadBadgeDelayMs() : 0;
  const unreadPollMs = Platform.OS === 'web' ? getWebUnreadPollMs() : undefined;

  useEffect(() => {
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timeoutId;
    const task = InteractionManager.runAfterInteractions(() => {
      if (Platform.OS === 'web') {
        timeoutId = setTimeout(() => {
          setIsUnreadCountReady(true);
        }, unreadBadgeDelayMs);
        return;
      }

      setIsUnreadCountReady(true);
    });

    return () => {
      task?.cancel?.();
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [unreadBadgeDelayMs]);

  useEffect(() => {
    if (isBootstrapResolved) {
      setAllowUnreadFallbackFetch(false);
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      setAllowUnreadFallbackFetch(true);
    }, 2500);

    return () => clearTimeout(timeoutId);
  }, [isBootstrapResolved]);

  const shouldEnableUnreadCount = isUnreadCountReady
    && (isBootstrapResolved || allowUnreadFallbackFetch);

  const {
    isLoading,
    markAllAsRead,
    markAsRead,
    notifications,
    unreadCount,
  } = useNotificationController({
    notificationsEnabled: shouldLoadNotifications,
    skipInitialFocusRefresh: true,
    unreadCountEnabled: shouldEnableUnreadCount,
    unreadPollMs,
  });

  // Animation values
  const scaleValue = useRef(new Animated.Value(1)).current;
  const pulseValue = useRef(new Animated.Value(1)).current;
  const rotateValue = useRef(new Animated.Value(0)).current;

  // Pulse animation when unread count increases
  useEffect(() => {
    if (unreadCount > prevUnreadCount && prevUnreadCount !== 0) {
      Vibration.vibrate(50);
      Animated.sequence([
        Animated.timing(rotateValue, { duration: 50, toValue: 1, useNativeDriver: true }),
        Animated.timing(rotateValue, { duration: 100, toValue: -1, useNativeDriver: true }),
        Animated.timing(rotateValue, { duration: 50, toValue: 0.5, useNativeDriver: true }),
        Animated.timing(rotateValue, { duration: 50, toValue: 0, useNativeDriver: true }),
      ]).start();
      Animated.sequence([
        Animated.timing(pulseValue, { duration: 150, toValue: 1.3, useNativeDriver: true }),
        Animated.timing(pulseValue, { duration: 150, toValue: 1, useNativeDriver: true }),
      ]).start();
    }
    setPrevUnreadCount(unreadCount);
  }, [pulseValue, rotateValue, unreadCount, prevUnreadCount]);

  const handlePressIn = () => {
    Animated.spring(scaleValue, { toValue: 0.85, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleValue, {
      friction: 3, tension: 40, toValue: 1, useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    Vibration.vibrate(10);
    if (onPress) {
      onPress();
    } else {
      setIsPopupVisible(true);
    }
  };

  const handleClose = () => {
    setIsPopupVisible(false);
  };

  const rotation = rotateValue.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-10deg', '10deg'],
  });

  return (
    <>
      <TouchableOpacity
        accessibilityLabel={t('notifications.title', 'Notifications')}
        accessibilityRole="button"
        accessibilityState={{ expanded: isPopupVisible }}
        accessibilityValue={{ text: String(unreadCount) }}
        activeOpacity={1}
        hitSlop={{
          bottom: 12, left: 12, right: 12, top: 12,
        }}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          withDefaultMargin ? { marginRight: 12 } : null,
          style,
        ]}
      >
        <Animated.View style={{
          transform: [
            { scale: scaleValue },
            { rotate: rotation },
          ],
        }}
        >
          <Image
            resizeMode="contain"
            source={Images.bell}
            style={{
              height: 26,
              tintColor: unreadCount > 0 ? Colors.neutral00 : Colors.neutral200,
              width: 26,
            }}
          />

          {unreadCount > 0 && (
          <Animated.View
            style={[
              styles.badge,
              {
                backgroundColor: Colors.error700,
                borderColor: Colors.neutral800,
                transform: [{ scale: pulseValue }],
              },
            ]}
          >
            <Text style={[styles.badgeText, { color: Colors.neutral00 }]}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </Text>
          </Animated.View>
          )}
        </Animated.View>
      </TouchableOpacity>

      {!onPress && (
      <NotificationPopup
        isLoading={isLoading}
        isVisible={isPopupVisible}
        notifications={notifications}
        onClose={handleClose}
        onMarkAllAsRead={markAllAsRead}
        onMarkAsRead={markAsRead}
      />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 2,
    height: 18,
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: 4,
    position: 'absolute',
    right: -6,
    top: -4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default NotificationBadge;
