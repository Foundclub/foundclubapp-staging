import React from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    TouchableWithoutFeedback,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import useTheme from '@/theme/themeContext';
import { useNavigation } from '@react-navigation/native';
import { RouteNames } from '@/navigation/routeNames';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Notification Popup Component
 * @param {object} props
 * @param {boolean} props.isVisible
 * @param {Function} props.onClose
 * @param {any[]} props.notifications
 * @param {Function} props.onMarkAsRead
 */
const NotificationPopup = ({ isVisible, onClose, notifications, onMarkAsRead }) => {
    const { Colors, Fonts, Spaces, ApplicationStyle } = useTheme();
    const { t } = useTranslation();
    const navigation = useNavigation();

    const recentNotifications = notifications.slice(0, 3);

    const handlePressNotification = (notification) => {
        onMarkAsRead(notification.id);
        onClose();

        if (notification.data && notification.data.route) {
            // @ts-ignore
            navigation.navigate(notification.data.route, notification.data.params);
        }
    };

    const handleViewAll = () => {
        onClose();
        // @ts-ignore
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
                                borderColor: Colors.primary100,
                                shadowColor: Colors.neutral900,
                            }
                        ]}>
                            <View style={[Spaces.padding[16]]}>
                                <Text style={[Fonts.h4Bold, { color: Colors.neutral00, marginBottom: 12 }]}>
                                    Notifications
                                </Text>

                                {recentNotifications.length === 0 ? (
                                    <Text style={[Fonts.p3, { color: Colors.neutral200, fontStyle: 'italic' }]}>
                                        Aucune notification récente
                                    </Text>
                                ) : (
                                    recentNotifications.map((notif) => (
                                        <TouchableOpacity
                                            key={notif.id}
                                            style={[
                                                Spaces.padding[12],
                                                Spaces.marginBottom[8],
                                                {
                                                    backgroundColor: notif.read ? 'transparent' : 'rgba(1, 179, 244, 0.1)',
                                                    borderRadius: 8,
                                                }
                                            ]}
                                            onPress={() => handlePressNotification(notif)}
                                        >
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <Text style={[Fonts.p2Bold, { color: Colors.neutral00, flex: 1 }]} numberOfLines={1}>
                                                    {notif.title}
                                                </Text>
                                                <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
                                                    {format(new Date(notif.createdAt), 'dd MMM', { locale: fr })}
                                                </Text>
                                            </View>
                                            <Text style={[Fonts.p3, { color: Colors.neutral100 }]} numberOfLines={2}>
                                                {notif.body}
                                            </Text>
                                        </TouchableOpacity>
                                    ))
                                )}

                                <TouchableOpacity
                                    style={[
                                        Spaces.marginTop[12],
                                        Spaces.padding[12],
                                        { alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.neutral700 }
                                    ]}
                                    onPress={handleViewAll}
                                >
                                    <Text style={[Fonts.p3Bold, { color: Colors.primary100 }]}>
                                        Voir toutes les notifications
                                    </Text>
                                </TouchableOpacity>
                            </View>
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
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        justifyContent: 'flex-start',
        alignItems: 'flex-end', // Align to right (near bell)
        paddingTop: 60, // Header height approx
        paddingRight: 16,
    },
    popup: {
        width: 300,
        borderRadius: 12,
        borderWidth: 1,
        elevation: 5,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
});

export default NotificationPopup;
