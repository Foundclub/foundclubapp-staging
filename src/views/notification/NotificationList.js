import React, { useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useTranslation } from 'react-i18next';
import useTheme from '@/theme/themeContext';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { useNotificationController } from '@/hooks/useNotificationController';
import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const NotificationList = () => {
    const { Colors, Fonts, Spaces, ApplicationStyle } = useTheme();
    const { t } = useTranslation();
    const navigation = useNavigation();
    const { notifications, isLoading, markAsRead, markAllAsRead, unreadCount } = useNotificationController();

    const handlePressNotification = (notification) => {
        markAsRead(notification.id);
        if (notification.data && notification.data.route) {
            // @ts-ignore
            navigation.navigate(notification.data.route, notification.data.params);
        }
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={[
                Spaces.padding[16],
                Spaces.marginBottom[12],
                {
                    backgroundColor: item.read ? 'rgba(255, 255, 255, 0.05)' : 'rgba(1, 179, 244, 0.1)',
                    borderRadius: 12,
                    borderLeftWidth: 4,
                    borderLeftColor: item.read ? 'transparent' : Colors.primary100,
                }
            ]}
            onPress={() => handlePressNotification(item)}
        >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={[Fonts.h4Bold, { color: Colors.neutral00, flex: 1 }]} numberOfLines={1}>
                    {item.title}
                </Text>
                <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
                    {format(new Date(item.createdAt), 'dd MMM HH:mm', { locale: fr })}
                </Text>
            </View>
            <Text style={[Fonts.p3, { color: Colors.neutral100, lineHeight: 20 }]}>
                {item.body}
            </Text>
        </TouchableOpacity>
    );

    return (
        <ScreenContainer
            bgImage="bg2"
            contentContainerStyle={[Spaces.padding[16]]}
            title="Notifications"
            onBack={() => navigation.goBack()}
            rightAction={
                unreadCount > 0 ? (
                    <TouchableOpacity onPress={() => markAllAsRead()}>
                        <Text style={[Fonts.p3Bold, { color: Colors.primary100 }]}>Tout lire</Text>
                    </TouchableOpacity>
                ) : null
            }
        >
            <FlatList
                data={notifications}
                renderItem={renderItem}
                keyExtractor={(item) => item.id.toString()}
                contentContainerStyle={{ paddingBottom: 20 }}
                refreshControl={
                    <RefreshControl refreshing={isLoading} tintColor={Colors.primary100} />
                }
                ListEmptyComponent={
                    !isLoading && (
                        <View style={{ alignItems: 'center', marginTop: 40 }}>
                            <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
                                Aucune notification
                            </Text>
                        </View>
                    )
                }
            />
        </ScreenContainer>
    );
};

export default NotificationList;
