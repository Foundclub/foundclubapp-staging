import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, PermissionsAndroid, Platform, Alert } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import ClusteredMapView from 'react-native-map-clustering';
import { useTranslation } from 'react-i18next';
import useTheme from '@/theme/themeContext';

const DEFAULT_REGION = {
    latitude: 43.2965, // Marseille
    longitude: 5.3698,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
};

const SearchMap = ({ items = [], type = 'event', onMarkerPress }) => {
    const { t } = useTranslation();
    const { Colors, Spaces, Fonts } = useTheme();
    const [region, setRegion] = useState(DEFAULT_REGION);
    const [hasPermission, setHasPermission] = useState(false);

    useEffect(() => {
        requestLocationPermission();
    }, []);

    const requestLocationPermission = async () => {
        if (Platform.OS === 'android') {
            try {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                    {
                        title: t('permissions.location.title', 'Permission de localisation'),
                        message: t('permissions.location.message', 'Nous avons besoin de votre position pour afficher les événements autour de vous.'),
                        buttonNeutral: t('permissions.location.buttonNeutral', 'Plus tard'),
                        buttonNegative: t('permissions.location.buttonNegative', 'Annuler'),
                        buttonPositive: t('permissions.location.buttonPositive', 'OK'),
                    },
                );
                if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                    setHasPermission(true);
                    // TODO: Get actual user location here if needed, for now we let MapView showUserLocation handle it visually
                } else {
                    console.log('Location permission denied');
                }
            } catch (err) {
                console.warn(err);
            }
        } else {
            // iOS permission handling would go here (often handled by MapView or separate lib)
            setHasPermission(true); // Assuming true for now or handled by OS prompt
        }
    };

    const renderMarker = (item) => {
        // Ensure item has valid coordinates
        const lat = item.latitude || item.location?.latitude;
        const lng = item.longitude || item.location?.longitude;

        if (!lat || !lng) return null;

        return (
            <Marker
                key={item.id || item.documentId}
                coordinate={{ latitude: parseFloat(lat), longitude: parseFloat(lng) }}
                onPress={() => onMarkerPress && onMarkerPress(item)}
                pinColor={type === 'event' ? Colors.primary : Colors.secondary}
            >
                {/* Custom Marker View if needed */}
            </Marker>
        );
    };

    return (
        <View style={styles.container}>
            <ClusteredMapView
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                initialRegion={DEFAULT_REGION}
                showsUserLocation={hasPermission}
                showsMyLocationButton={hasPermission}
                clusterColor={Colors.primary}
            >
                {items.map(renderMarker)}
            </ClusteredMapView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        borderRadius: 16,
        overflow: 'hidden',
    },
    map: {
        width: '100%',
        height: '100%',
    },
});

export default SearchMap;
