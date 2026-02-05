import React, { useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Modal,
    Dimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import useTheme from '@/theme/themeContext';
import { RouteNames } from '@/navigation/routeNames';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

const getRelativeTime = (dateStr) => {
    if (!dateStr) return '';
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

const NotificationPopup = ({ isVisible, onClose, notifications, onMarkAsRead }) => {
    const { Colors, Fonts, Spaces } = useTheme();
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();
    const { width, height } = Dimensions.get('window');

    // Debug log
    useEffect(() => {
        if (isVisible) {
            console.log('[NotificationPopup] JS Modal Became Visible (No Native Modal)');
        }
    }, [isVisible]);

    const safeNotifications = Array.isArray(notifications) ? notifications : [];
    const recentNotifications = safeNotifications.slice(0, 5);
    const unreadCount = safeNotifications.filter(n => !n.read).length;

    if (!isVisible) return null;

    const handlePressNotification = (notification) => {
        if (onMarkAsRead) onMarkAsRead(notification.documentId);
        onClose();

        const data = notification.data || {};
        const type = notification.type;

        try {
            switch (type) {
                case 'addToTeam':
                case 'teamRequest':
                case 'teamMembershipRequest':
                case 'newTeam':
                    navigation.navigate(RouteNames.TeamStack, {
                        screen: RouteNames.TeamDetails,
                        params: { teamId: data.teamId },
                    });
                    break;
                case 'clubMembershipRequest':
                    navigation.navigate(RouteNames.ClubStack, {
                        screen: RouteNames.ClubMembershipRequests,
                    });
                    break;
                case 'clubRequest':
                    navigation.navigate(RouteNames.ClubStack, {
                        screen: RouteNames.Club,
                        params: { clubId: data.clubId },
                    });
                    break;
                case 'eventCancellation':
                case 'eventReminder':
                case 'newParticipation':
                case 'participationRequest':
                    navigation.navigate(RouteNames.EventStack, {
                        screen: RouteNames.EventDetails,
                        params: { eventId: data.eventId },
                    });
                    break;
                case 'newWhisper':
                case 'newTeamMessage':
                    navigation.navigate(RouteNames.Conversation, {
                        chatId: data.conversationId || data.chatId,
                    });
                    break;
                case 'searchAlertMatch':
                    if (data.type === 'event' && data.eventId) {
                        navigation.navigate(RouteNames.EventStack, {
                            screen: RouteNames.EventDetails,
                            params: { eventId: data.eventId },
                        });
                    }
                    break;
                default:
                    if (data.route) {
                        navigation.navigate(data.route, data.params || {});
                    } else {
                        navigation.navigate(RouteNames.NotificationList);
                    }
                    break;
            }
        } catch (e) {
            console.error('Navigation error', e);
            navigation.navigate(RouteNames.NotificationList);
        }
    };

    const handleViewAll = () => {
        onClose();
        navigation.navigate(RouteNames.NotificationList);
    };

    // REPLACEMENT: USING NATIVE MODAL TO FIX Z-INDEX/POSITION ISSUES
    return (
        <Modal
            visible={isVisible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={[styles.modalOverlay, { paddingTop: insets.top + 50 }]}>
                {/* Backdrop - Click to close */}
                <TouchableOpacity 
                    style={styles.touchableBackground} 
                    activeOpacity={1} 
                    onPress={onClose}
                />
                
                {/* Popup Content */}
                <View style={[
                    styles.popup,
                    {
                        backgroundColor: '#1E1E1E',
                        borderColor: '#01B3F4',
                        marginRight: 16, // Standard margin from right edge
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
                            <Text style={[Fonts.h4Bold || { fontSize: 16, fontWeight: 'bold' }, { color: '#FFFFFF' }]}>
                                Notifications
                            </Text>
                            {unreadCount > 0 && (
                                <View style={{
                                    backgroundColor: '#01B3F4',
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

                    {/* Content */}
                    <ScrollView 
                        style={{ maxHeight: 320 }}
                        showsVerticalScrollIndicator={false}
                    >
                        {recentNotifications.length === 0 ? (
                            <View style={{ padding: 24, alignItems: 'center' }}>
                                <Text style={{ fontSize: 32, marginBottom: 8 }}>🔔</Text>
                                <Text style={[Fonts.p3 || { fontSize: 14 }, { color: '#9CA3AF', fontStyle: 'italic' }]}>
                                    Aucune notification
                                </Text>
                            </View>
                        ) : (
                            recentNotifications.map((notif, index) => {
                                const icon = getNotificationIcon(notif.type);
                                return (
                                    <TouchableOpacity
                                        key={notif.id || index}
                                        style={[
                                            Spaces.padding[12],
                                            {
                                                backgroundColor: notif.read ? 'transparent' : 'rgba(1, 179, 244, 0.08)',
                                                borderBottomWidth: 1,
                                                borderBottomColor: 'rgba(255,255,255,0.05)',
                                                flexDirection: 'row',
                                            }
                                        ]}
                                        onPress={() => handlePressNotification(notif)}
                                    >
                                        <View style={{
                                            width: 32, height: 32, borderRadius: 16,
                                            backgroundColor: 'rgba(255,255,255,0.1)',
                                            justifyContent: 'center', alignItems: 'center',
                                            marginRight: 10,
                                        }}>
                                            <Text style={{ fontSize: 14 }}>{icon}</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                <Text style={[notif.read ? Fonts.p3 : Fonts.p3Bold, { color: '#FFF', flex: 1, fontSize: 14 }]} numberOfLines={1}>
                                                    {notif.title || 'Notification'}
                                                </Text>
                                                <Text style={{ color: '#9CA3AF', fontSize: 10, marginLeft: 8 }}>
                                                    {getRelativeTime(notif.createdAt)}
                                                </Text>
                                            </View>
                                            <Text style={[Fonts.p3 || { fontSize: 14 }, { color: '#D1D5DB' }]} numberOfLines={1}>
                                                {notif.body}
                                            </Text>
                                        </View>
                                        {!notif.read && (
                                            <View style={{
                                                width: 6, height: 6, borderRadius: 3,
                                                backgroundColor: '#01B3F4', marginLeft: 4, marginTop: 4
                                            }} />
                                        )}
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </ScrollView>

                    {/* Footer */}
                    <TouchableOpacity
                        style={{
                            padding: 16,
                            alignItems: 'center',
                            borderTopWidth: 1,
                            borderTopColor: 'rgba(255,255,255,0.1)',
                            backgroundColor: 'rgba(1, 179, 244, 0.05)',
                        }}
                        onPress={handleViewAll}
                    >
                        <Text style={[Fonts.p2Bold || { fontWeight: 'bold' }, { color: '#01B3F4' }]}>
                            Voir toutes les notifications
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'flex-end',
        paddingRight: 0, 
    },
    touchableBackground: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)', 
    },
    popup: {
        width: 320,
        maxWidth: '90%',
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
        elevation: 10,
        backgroundColor: '#1E1E1E', 
    },
});

export default NotificationPopup;
