import React from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    TouchableWithoutFeedback,
    ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import useTheme from '@/theme/themeContext';
import { useNavigation } from '@react-navigation/native';
import { RouteNames } from '@/navigation/routeNames';

// Icons for different notification types
const getNotificationIcon = (type) => {
    switch (type) {
        case 'event': return '📅';
        case 'team': return '👥';
        case 'club': return '🏛️';
        case 'chat': return '💬';
        case 'membership': return '🎫';
        default: return '🔔';
    }
};

// Format relative time
const getRelativeTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `${diffMins} min`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}j`;
    return `${diffDays}j`;
};

/**
 * Notification Popup Component
 * @param {object} props
 * @param {boolean} props.isVisible
 * @param {Function} props.onClose
 * @param {any[]} props.notifications
 * @param {Function} props.onMarkAsRead
 */
const NotificationPopup = ({ isVisible, onClose, notifications, onMarkAsRead }) => {
    const { Colors, Fonts, Spaces } = useTheme();
    const { t } = useTranslation();
    const navigation = useNavigation();

    // Show up to 5 recent notifications
    const recentNotifications = notifications.slice(0, 5);
    const unreadCount = notifications.filter(n => !n.read).length;

    const handlePressNotification = (notification) => {
        onMarkAsRead(notification.id || notification.documentId);
        onClose();

        if (notification.data?.route) {
            const route = notification.data.route;
            const params = notification.data.params || {};
            
            // Handle nested navigation properly
            if (route === 'EventDetails') {
                navigation.navigate(RouteNames.EventStack, { screen: RouteNames.EventDetails, params });
            } else if (route === 'TeamDetails') {
                navigation.navigate(RouteNames.TeamStack, { screen: RouteNames.TeamDetails, params });
            } else if (route === 'ClubDetails' || route === 'Club') {
                navigation.navigate(RouteNames.ClubStack, { screen: RouteNames.Club, params });
            } else if (route === 'Conversation') {
                navigation.navigate(RouteNames.ChatStack, { screen: RouteNames.Conversation, params });
            } else {
                navigation.navigate(route, params);
            }
        }
    };

    const handleViewAll = () => {
        onClose();
        navigation.navigate(RouteNames.NotificationList);
    };

    return (
        <Modal
            transparent
            visible={isVisible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableWithoutFeedback onPress={onClose}>
                <View style={styles.overlay}>
                    <TouchableWithoutFeedback>
                        <View style={[
                            styles.popup,
                            {
                                backgroundColor: Colors.neutral800,
                                borderColor: Colors.primary500 + '40',
                            }
                        ]}>
                            {/* Header */}
                            <View style={[
                                Spaces.padding[16], 
                                { 
                                    borderBottomWidth: 1, 
                                    borderBottomColor: 'rgba(255,255,255,0.1)',
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }
                            ]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
                                        Notifications
                                    </Text>
                                    {unreadCount > 0 && (
                                        <View style={{
                                            backgroundColor: Colors.primary500,
                                            paddingHorizontal: 8,
                                            paddingVertical: 2,
                                            borderRadius: 10,
                                            marginLeft: 8,
                                        }}>
                                            <Text style={{ color: '#FFF', fontSize: 11, fontWeight: '600' }}>
                                                {unreadCount}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>

                            {/* Notifications List */}
                            <ScrollView 
                                style={{ maxHeight: 320 }}
                                showsVerticalScrollIndicator={false}
                            >
                                {recentNotifications.length === 0 ? (
                                    <View style={[Spaces.padding[24], { alignItems: 'center' }]}>
                                        <Text style={{ fontSize: 32, marginBottom: 8 }}>🔔</Text>
                                        <Text style={[Fonts.p3, { color: Colors.neutral300, fontStyle: 'italic' }]}>
                                            Aucune notification
                                        </Text>
                                    </View>
                                ) : (
                                    recentNotifications.map((notif) => {
                                        const icon = getNotificationIcon(notif.type);
                                        return (
                                            <TouchableOpacity
                                                key={notif.id || notif.documentId}
                                                style={[
                                                    Spaces.padding[12],
                                                    {
                                                        backgroundColor: notif.read 
                                                            ? 'transparent' 
                                                            : 'rgba(1, 179, 244, 0.08)',
                                                        borderBottomWidth: 1,
                                                        borderBottomColor: 'rgba(255,255,255,0.05)',
                                                        flexDirection: 'row',
                                                        alignItems: 'flex-start',
                                                    }
                                                ]}
                                                onPress={() => handlePressNotification(notif)}
                                            >
                                                {/* Icon */}
                                                <View style={{
                                                    width: 32,
                                                    height: 32,
                                                    borderRadius: 16,
                                                    backgroundColor: 'rgba(255,255,255,0.1)',
                                                    justifyContent: 'center',
                                                    alignItems: 'center',
                                                    marginRight: 10,
                                                }}>
                                                    <Text style={{ fontSize: 14 }}>{icon}</Text>
                                                </View>
                                                
                                                {/* Content */}
                                                <View style={{ flex: 1 }}>
                                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                                                        <Text 
                                                            style={[
                                                                notif.read ? Fonts.p3 : Fonts.p3Bold, 
                                                                { color: Colors.neutral00, flex: 1 }
                                                            ]} 
                                                            numberOfLines={1}
                                                        >
                                                            {notif.title}
                                                        </Text>
                                                        <Text style={[Fonts.p4 || Fonts.p3, { color: Colors.neutral400, marginLeft: 8, fontSize: 10 }]}>
                                                            {getRelativeTime(notif.createdAt)}
                                                        </Text>
                                                    </View>
                                                    <Text style={[Fonts.p3, { color: Colors.neutral300 }]} numberOfLines={1}>
                                                        {notif.body}
                                                    </Text>
                                                </View>

                                                {/* Unread dot */}
                                                {!notif.read && (
                                                    <View style={{
                                                        width: 6,
                                                        height: 6,
                                                        borderRadius: 3,
                                                        backgroundColor: Colors.primary500,
                                                        marginLeft: 4,
                                                        marginTop: 4,
                                                    }} />
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })
                                )}
                            </ScrollView>

                            {/* View All Button */}
                            <TouchableOpacity
                                style={[
                                    Spaces.padding[14],
                                    { 
                                        alignItems: 'center', 
                                        borderTopWidth: 1, 
                                        borderTopColor: 'rgba(255,255,255,0.1)',
                                        backgroundColor: 'rgba(1, 179, 244, 0.05)',
                                    }
                                ]}
                                onPress={handleViewAll}
                            >
                                <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
                                    Voir toutes les notifications
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        paddingTop: 56,
        paddingRight: 12,
    },
    popup: {
        width: 320,
        borderRadius: 16,
        borderWidth: 1,
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        overflow: 'hidden',
    },
});

export default NotificationPopup;

