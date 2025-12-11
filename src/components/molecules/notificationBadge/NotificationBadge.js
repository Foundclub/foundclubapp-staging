import React, { useState, useRef } from 'react';
import { View, TouchableOpacity, Image, Text, StyleSheet, Vibration, Animated } from 'react-native';
import useTheme from '@/theme/themeContext';
import { useNotificationController } from '@/hooks/useNotificationController';
import NotificationPopup from '@/components/organisms/notificationPopup/NotificationPopup';

/**
 * Notification Badge Component
 * Displays a bell icon with a red dot if there are unread notifications.
 * Opens a popup on press.
 */
const NotificationBadge = () => {
    const { Images, Colors } = useTheme();
    const { unreadCount, notifications, markAsRead } = useNotificationController();
    const [isPopupVisible, setIsPopupVisible] = useState(false);

    // Animation value for scale using standard Animated
    const scaleValue = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scaleValue, {
            toValue: 0.9,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleValue, {
            toValue: 1,
            useNativeDriver: true,
        }).start();
    };

    const handlePress = () => {
        // Haptic feedback (light vibration)
        Vibration.vibrate(10);
        setIsPopupVisible(true);
    };

    const handleClose = () => {
        setIsPopupVisible(false);
    };

    return (
        <>
            <TouchableOpacity
                onPress={handlePress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={1}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{ marginRight: 12 }}
            >
                <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
                    <Image
                        source={Images.bell}
                        style={{ width: 28, height: 28, tintColor: Colors.neutral00 }}
                        resizeMode="contain"
                    />

                    {unreadCount > 0 && (
                        <View style={[styles.badge, { borderColor: Colors.primary900 }]}>
                            <Text style={styles.badgeText}>
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </Text>
                        </View>
                    )}
                </Animated.View>
            </TouchableOpacity>

            <NotificationPopup
                isVisible={isPopupVisible}
                onClose={handleClose}
                notifications={notifications}
                onMarkAsRead={markAsRead}
            />
        </>
    );
};

const styles = StyleSheet.create({
    badge: {
        position: 'absolute',
        top: -2,
        right: -2,
        backgroundColor: '#EF4444', // Red 500
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        borderWidth: 2, // Thicker border for cutout effect
    },
    badgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },
});

export default NotificationBadge;
