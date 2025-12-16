import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, Image, Text, StyleSheet, Vibration, Animated, Easing } from 'react-native';
import useTheme from '@/theme/themeContext';
import { useNotificationController } from '@/hooks/useNotificationController';
import NotificationPopup from '@/components/organisms/notificationPopup/NotificationPopup';

/**
 * Notification Badge Component
 * Displays a bell icon with a red dot if there are unread notifications.
 * Features a pulse animation when new notifications arrive.
 */
const NotificationBadge = () => {
    const { Images, Colors } = useTheme();
    const { unreadCount, notifications, markAsRead } = useNotificationController();
    const [isPopupVisible, setIsPopupVisible] = useState(false);
    const [prevUnreadCount, setPrevUnreadCount] = useState(0);

    // Animation values
    const scaleValue = useRef(new Animated.Value(1)).current;
    const pulseValue = useRef(new Animated.Value(1)).current;
    const rotateValue = useRef(new Animated.Value(0)).current;

    // Pulse animation when unread count increases
    useEffect(() => {
        if (unreadCount > prevUnreadCount && prevUnreadCount !== 0) {
            // New notification arrived - trigger pulse and shake
            Vibration.vibrate(50);
            
            // Shake animation
            Animated.sequence([
                Animated.timing(rotateValue, { toValue: 1, duration: 50, useNativeDriver: true }),
                Animated.timing(rotateValue, { toValue: -1, duration: 100, useNativeDriver: true }),
                Animated.timing(rotateValue, { toValue: 0.5, duration: 50, useNativeDriver: true }),
                Animated.timing(rotateValue, { toValue: 0, duration: 50, useNativeDriver: true }),
            ]).start();

            // Pulse animation on badge
            Animated.sequence([
                Animated.timing(pulseValue, { toValue: 1.3, duration: 150, useNativeDriver: true }),
                Animated.timing(pulseValue, { toValue: 1, duration: 150, useNativeDriver: true }),
            ]).start();
        }
        setPrevUnreadCount(unreadCount);
    }, [unreadCount, prevUnreadCount]);

    const handlePressIn = () => {
        Animated.spring(scaleValue, {
            toValue: 0.85,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleValue, {
            toValue: 1,
            friction: 3,
            tension: 40,
            useNativeDriver: true,
        }).start();
    };

    const handlePress = () => {
        Vibration.vibrate(10);
        setIsPopupVisible(true);
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
                onPress={handlePress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={1}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                style={{ marginRight: 12 }}
            >
                <Animated.View style={{ 
                    transform: [
                        { scale: scaleValue },
                        { rotate: rotation },
                    ] 
                }}>
                    <Image
                        source={Images.bell}
                        style={{ 
                            width: 26, 
                            height: 26, 
                            tintColor: unreadCount > 0 ? Colors.neutral00 : Colors.neutral200 
                        }}
                        resizeMode="contain"
                    />

                    {unreadCount > 0 && (
                        <Animated.View 
                            style={[
                                styles.badge, 
                                { 
                                    borderColor: Colors.neutral800,
                                    transform: [{ scale: pulseValue }],
                                }
                            ]}
                        >
                            <Text style={styles.badgeText}>
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </Text>
                        </Animated.View>
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
        top: -4,
        right: -6,
        backgroundColor: '#EF4444',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
    },
    badgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
    },
});

export default NotificationBadge;

