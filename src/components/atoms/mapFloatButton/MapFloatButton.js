import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import useTheme from '@/theme/themeContext';

/**
 * Floating button to toggle between Map and List views
 * @param {object} props
 * @param {boolean} props.isMapView - Whether the current view is Map
 * @param {function} props.onPress - Handler for button press
 * @param {'event' | 'club'} [props.type='event'] - Type of content (affects List icon)
 * @returns {import('react').ReactElement}
 */
const MapFloatButton = ({ isMapView, onPress, type = 'event' }) => {
    const { Colors, Fonts, Images, ApplicationStyle } = useTheme();
    const { t } = useTranslation();

    const listIcon = type === 'club' ? Images.stadium : Images.calendar;
    const icon = isMapView ? listIcon : Images.pin;
    const label = isMapView ? t('common.list', 'Liste') : t('common.map', 'Carte');

    return (
        <View style={styles.container} pointerEvents="box-none">
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={onPress}
                style={[
                    styles.button,
                    { backgroundColor: Colors.primary500 }, // Primary Blue
                    ApplicationStyle.shadow200, // Shadow
                ]}
            >
                <Text style={[Fonts.p3Bold, { color: Colors.primary900, marginRight: 8 }]}>
                    {label}
                </Text>
                <Image
                    source={icon}
                    style={{ width: 16, height: 16, tintColor: Colors.primary900 }}
                    resizeMode="contain"
                />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 30,
    },
});

export default MapFloatButton;
