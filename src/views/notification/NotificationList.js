import React, { useCallback, useMemo } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { format, isToday, isYesterday, isThisWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import Animated, { FadeInDown } from 'react-native-reanimated';

import ScreenContainer from '@/components/templates/ScreenContainer';
import { useNotificationController } from '@/hooks/useNotificationController';
import { RouteNames } from '@/navigation/routeNames';
import useTheme from '@/theme/themeContext';
import { resolveNotificationDestination } from '@/utils/notifications/notificationNavigation';
import { getNotificationIcon } from '@/utils/notifications/notificationPresentation';

/**
 * @typedef {{ id?: string | number; documentId?: string; createdAt?: string; type?: string; title?: string; body?: string; read?: boolean; data?: Record<string, any> }} NotificationItem
 * @typedef {{ type: 'header'; title: string; key: string } | { type: 'item'; data: NotificationItem; key: string }} NotificationSectionItem
 */

const groupNotificationsByDate = (/** @type {NotificationItem[]} */ notifications) => {
    const groups = {
        today: /** @type {NotificationItem[]} */ ([]),
        yesterday: /** @type {NotificationItem[]} */ ([]),
        thisWeek: /** @type {NotificationItem[]} */ ([]),
        older: /** @type {NotificationItem[]} */ ([]),
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

const getRelativeTime = (/** @type {string | Date} */ dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "A l'instant";
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return format(date, 'dd MMM', { locale: fr });
};

const NotificationList = () => {
    const { Colors, Fonts, Spaces } = useTheme();
    const navigation = useNavigation();
    const nav = /** @type {any} */ (navigation);
    const {
        notifications,
        isLoading,
        isFetchingNextPage,
        hasNextPage,
        loadMore,
        refreshNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
        unreadCount,
    } = useNotificationController();

    const groupedNotifications = useMemo(
        () => groupNotificationsByDate(notifications),
        [notifications]
    );

    const sections = useMemo(() => {
        /** @type {NotificationSectionItem[]} */
        const result = [];

        if (groupedNotifications.today.length > 0) {
            result.push({ type: 'header', title: "Aujourd'hui", key: 'header-today' });
            groupedNotifications.today.forEach((n) => result.push({ type: 'item', data: n, key: String(n.documentId || n.id || Math.random()) }));
        }
        if (groupedNotifications.yesterday.length > 0) {
            result.push({ type: 'header', title: 'Hier', key: 'header-yesterday' });
            groupedNotifications.yesterday.forEach((n) => result.push({ type: 'item', data: n, key: String(n.documentId || n.id || Math.random()) }));
        }
        if (groupedNotifications.thisWeek.length > 0) {
            result.push({ type: 'header', title: 'Cette semaine', key: 'header-week' });
            groupedNotifications.thisWeek.forEach((n) => result.push({ type: 'item', data: n, key: String(n.documentId || n.id || Math.random()) }));
        }
        if (groupedNotifications.older.length > 0) {
            result.push({ type: 'header', title: 'Plus ancien', key: 'header-older' });
            groupedNotifications.older.forEach((n) => result.push({ type: 'item', data: n, key: String(n.documentId || n.id || Math.random()) }));
        }

        return result;
    }, [groupedNotifications]);

    const showActionError = (/** @type {string} */ fallbackMessage, /** @type {any} */ error) => {
        Alert.alert('Erreur', error?.response?.data?.error?.message || fallbackMessage);
    };

    const handlePressNotification = useCallback(async (/** @type {NotificationItem} */ notification) => {
        try {
            await markAsRead(String(notification.documentId || notification.id || ''));
        } catch (error) {
            showActionError("Impossible de marquer la notification comme lue.", error);
        }

        const payload = {
            ...(notification.data || {}),
            notificationKind: notification?.data?.type,
            type: notification.type,
        };
        const destination = resolveNotificationDestination(payload);

        if (destination?.route) {
            nav.navigate(destination.route, destination.params || {});
            return;
        }

        nav.navigate(RouteNames.NotificationList);
    }, [markAsRead, nav]);

    const handleDelete = useCallback((/** @type {NotificationItem} */ notification) => {
        Alert.alert(
            'Supprimer',
            'Supprimer cette notification ?',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteNotification(String(notification.documentId || notification.id || ''));
                        } catch (error) {
                            showActionError('Impossible de supprimer la notification.', error);
                        }
                    },
                },
            ]
        );
    }, [deleteNotification]);

    const renderRightActions = useCallback((/** @type {NotificationItem} */ notification) => (
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

    const renderItem = useCallback((/** @type {{ item: NotificationSectionItem; index: number }} */ { item, index }) => {
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
                            },
                        ]}
                        onPress={() => handlePressNotification(notification)}
                        activeOpacity={0.7}
                    >
                        <View
                            style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginRight: 12,
                            }}
                        >
                            <Text style={{ fontSize: 18 }}>{icon}</Text>
                        </View>

                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                <Text
                                    style={[
                                        notification.read ? Fonts.p2 : Fonts.p2Bold,
                                        { color: Colors.neutral00, flex: 1 },
                                    ]}
                                    numberOfLines={1}
                                >
                                    {notification.title}
                                </Text>
                                <Text style={[Fonts.p3, { color: Colors.neutral300, marginLeft: 8 }]}>
                                    {getRelativeTime(notification.createdAt || new Date())}
                                </Text>
                            </View>
                            <Text
                                style={[Fonts.p3, { color: Colors.neutral200, lineHeight: 18 }]}
                                numberOfLines={2}
                            >
                                {notification.body}
                            </Text>
                        </View>

                        {!notification.read ? (
                            <View
                                style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: 4,
                                    backgroundColor: Colors.primary500,
                                    position: 'absolute',
                                    top: 16,
                                    right: 16,
                                }}
                            />
                        ) : null}
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
        >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <TouchableOpacity onPress={() => nav.goBack()}>
                    <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>Retour</Text>
                </TouchableOpacity>
                <Text style={[Fonts.h3Bold, { color: Colors.neutral00 }]}>Notifications</Text>
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
                ) : <View style={{ width: 56 }} />}
            </View>
            <FlatList
                data={sections}
                renderItem={renderItem}
                keyExtractor={(item) => item.key}
                contentContainerStyle={{ paddingBottom: 40 }}
                onRefresh={refreshNotifications}
                refreshing={isLoading && !isFetchingNextPage}
                onEndReached={handleEndReached}
                onEndReachedThreshold={0.3}
                ListEmptyComponent={
                    !isLoading ? (
                        <View style={{ alignItems: 'center', marginTop: 60 }}>
                            <Text style={{ fontSize: 48, marginBottom: 16 }}>🔔</Text>
                            <Text style={[Fonts.h4Bold, { color: Colors.neutral00 }]}>
                                Aucune notification
                            </Text>
                            <Text style={[Fonts.p2, { color: Colors.neutral00, marginTop: 8, textAlign: 'center', opacity: 0.7 }]}>
                                Les nouvelles notifications apparaitront ici
                            </Text>
                        </View>
                    ) : null
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
