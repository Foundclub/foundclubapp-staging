import React, { useCallback, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import Animated, { FadeInDown } from 'react-native-reanimated';

import useTheme from '@/theme/themeContext';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { useNotificationController } from '@/hooks/useNotificationController';
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

// Group notifications by date period
const groupNotificationsByDate = (notifications) => {
    const groups = {
        today: [],
        yesterday: [],
        thisWeek: [],
        older: [],
    };

    notifications.forEach((notif) => {
        const date = new Date(notif.createdAt);
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

// Format relative time
const getRelativeTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "À l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return format(date, 'dd MMM', { locale: fr });
};

const NotificationList = () => {
    const { Colors, Fonts, Spaces, ApplicationStyle } = useTheme();
    const { t } = useTranslation();
    const navigation = useNavigation();
    const { 
        notifications, 
        isLoading, 
        isFetchingNextPage,
        hasNextPage,
        loadMore,
        refetch,
        markAsRead, 
        markAllAsRead, 
        deleteNotification,
        unreadCount 
    } = useNotificationController();

    // Group notifications by date
    const groupedNotifications = useMemo(() => {
        return groupNotificationsByDate(notifications);
    }, [notifications]);

    // Build sections for FlatList
    const sections = useMemo(() => {
        const result = [];
        
        if (groupedNotifications.today.length > 0) {
            result.push({ type: 'header', title: "Aujourd'hui", key: 'header-today' });
            groupedNotifications.today.forEach(n => result.push({ type: 'item', data: n, key: n.id }));
        }
        if (groupedNotifications.yesterday.length > 0) {
            result.push({ type: 'header', title: 'Hier', key: 'header-yesterday' });
            groupedNotifications.yesterday.forEach(n => result.push({ type: 'item', data: n, key: n.id }));
        }
        if (groupedNotifications.thisWeek.length > 0) {
            result.push({ type: 'header', title: 'Cette semaine', key: 'header-week' });
            groupedNotifications.thisWeek.forEach(n => result.push({ type: 'item', data: n, key: n.id }));
        }
        if (groupedNotifications.older.length > 0) {
            result.push({ type: 'header', title: 'Plus ancien', key: 'header-older' });
            groupedNotifications.older.forEach(n => result.push({ type: 'item', data: n, key: n.id }));
        }
        
        return result;
    }, [groupedNotifications]);

    const handlePressNotification = useCallback((notification) => {
        // Use documentId as the backend expects documentId, not internal id
        markAsRead(notification.documentId);
        
        const data = notification.data || {};
        const type = notification.type;
        
        // Navigate based on notification type
        switch (type) {
            case 'addToTeam':
            case 'teamRequest':
            case 'teamMembershipRequest':
                navigation.navigate(RouteNames.TeamStack, {
                    screen: RouteNames.TeamDetails,
                    params: { teamId: data.teamId },
                });
                break;
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
                navigation.navigate(RouteNames.EventStack, {
                    screen: RouteNames.EventDetails,
                    params: { eventId: data.eventId },
                });
                break;
            case 'newParticipation':
            case 'participationRequest':
                navigation.navigate(RouteNames.EventStack, {
                    screen: RouteNames.EventDetails,
                    params: { eventId: data.eventId },
                });
                break;
            case 'newWhisper':
            case 'newTeamMessage':
                // Navigate directly to Conversation (it's in PrivateNavigator, not nested)
                navigation.navigate(RouteNames.Conversation, {
                    chatId: data.conversationId || data.chatId,
                });
                break;
            default:
                // For unknown types, try to use any available route/params
                if (data.route) {
                    navigation.navigate(data.route, data.params || {});
                }
                break;
        }
    }, [markAsRead, navigation]);

    const handleDelete = useCallback((notification) => {
        Alert.alert(
            'Supprimer',
            'Supprimer cette notification ?',
            [
                { text: 'Annuler', style: 'cancel' },
                { 
                    text: 'Supprimer', 
                    style: 'destructive',
                    onPress: () => deleteNotification(notification.documentId)
                },
            ]
        );
    }, [deleteNotification]);

    const renderRightActions = useCallback((notification) => (
        <TouchableOpacity
            onPress={() => handleDelete(notification)}
            style={{
                backgroundColor: Colors.error500 || '#EF4444',
                justifyContent: 'center',
                alignItems: 'center',
                width: 80,
                marginBottom: 12,
                borderRadius: 12,
            }}
        >
            <Text style={{ color: '#FFF', fontWeight: '600' }}>🗑️</Text>
        </TouchableOpacity>
    ), [Colors, handleDelete]);

    const renderLeftActions = useCallback((notification) => (
        <TouchableOpacity
            onPress={() => markAsRead(notification.documentId)}
            style={{
                backgroundColor: Colors.primary500,
                justifyContent: 'center',
                alignItems: 'center',
                width: 80,
                marginBottom: 12,
                borderRadius: 12,
            }}
        >
            <Text style={{ color: '#FFF', fontWeight: '600' }}>✓ Lu</Text>
        </TouchableOpacity>
    ), [Colors, markAsRead]);

    const renderItem = useCallback(({ item, index }) => {
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

        return (
            <Animated.View entering={FadeInDown.delay(index * 30).duration(200)}>
                <Swipeable
                    renderRightActions={() => renderRightActions(notification)}
                    renderLeftActions={() => !notification.read && renderLeftActions(notification)}
                    overshootLeft={false}
                    overshootRight={false}
                >
                    <TouchableOpacity
                        style={[
                            Spaces.padding[16],
                            Spaces.marginBottom[12],
                            {
                                backgroundColor: notification.read 
                                    ? 'rgba(255, 255, 255, 0.03)' 
                                    : 'rgba(1, 179, 244, 0.12)',
                                borderRadius: 12,
                                borderLeftWidth: notification.read ? 0 : 4,
                                borderLeftColor: Colors.primary500,
                                flexDirection: 'row',
                                alignItems: 'flex-start',
                            }
                        ]}
                        onPress={() => handlePressNotification(notification)}
                        activeOpacity={0.7}
                    >
                        {/* Icon */}
                        <View style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                            justifyContent: 'center',
                            alignItems: 'center',
                            marginRight: 12,
                        }}>
                            <Text style={{ fontSize: 18 }}>{icon}</Text>
                        </View>

                        {/* Content */}
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                <Text 
                                    style={[
                                        notification.read ? Fonts.p2 : Fonts.p2Bold, 
                                        { color: Colors.neutral00, flex: 1 }
                                    ]} 
                                    numberOfLines={1}
                                >
                                    {notification.title}
                                </Text>
                                <Text style={[Fonts.p3, { color: Colors.neutral300, marginLeft: 8 }]}>
                                    {getRelativeTime(notification.createdAt)}
                                </Text>
                            </View>
                            <Text 
                                style={[Fonts.p3, { color: Colors.neutral200, lineHeight: 18 }]} 
                                numberOfLines={2}
                            >
                                {notification.body}
                            </Text>
                        </View>

                        {/* Unread indicator */}
                        {!notification.read && (
                            <View style={{
                                width: 8,
                                height: 8,
                                borderRadius: 4,
                                backgroundColor: Colors.primary500,
                                position: 'absolute',
                                top: 16,
                                right: 16,
                            }} />
                        )}
                    </TouchableOpacity>
                </Swipeable>
            </Animated.View>
        );
    }, [Colors, Fonts, Spaces, handlePressNotification, renderRightActions, renderLeftActions]);

    const handleEndReached = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            loadMore();
        }
    }, [hasNextPage, isFetchingNextPage, loadMore]);

    return (
        <ScreenContainer
            bgImage="bg2"
            contentContainerStyle={[Spaces.padding[16]]}
            title="Notifications"
            onBack={() => navigation.goBack()}
            rightAction={
                unreadCount > 0 ? (
                    <TouchableOpacity onPress={() => markAllAsRead()}>
                        <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>Tout lire</Text>
                    </TouchableOpacity>
                ) : null
            }
        >
            <FlatList
                data={sections}
                renderItem={renderItem}
                keyExtractor={(item) => item.key}
                contentContainerStyle={{ paddingBottom: 40 }}
                onRefresh={refetch}
                refreshing={isLoading && !isFetchingNextPage}
                onEndReached={handleEndReached}
                onEndReachedThreshold={0.3}
                ListEmptyComponent={
                    !isLoading && (
                        <View style={{ alignItems: 'center', marginTop: 60 }}>
                            <Text style={{ fontSize: 48, marginBottom: 16 }}>🔔</Text>
                            <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
                                Aucune notification
                            </Text>
                            <Text style={[Fonts.p2, { color: Colors.neutral00, marginTop: 8, textAlign: 'center', opacity: 0.7 }]}>
                                Les nouvelles notifications apparaîtront ici
                            </Text>
                        </View>
                    )
                }
                ListFooterComponent={
                    isFetchingNextPage ? (
                        <View style={{ padding: 16, alignItems: 'center' }}>
                            <Text style={[Fonts.p3, { color: Colors.neutral400 }]}>Chargement...</Text>
                        </View>
                    ) : null
                }
            />
        </ScreenContainer>
    );
};

export default NotificationList;
