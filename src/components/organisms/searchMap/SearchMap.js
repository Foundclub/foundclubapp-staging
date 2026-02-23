import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert, PermissionsAndroid, Platform, StyleSheet, Text, View,
} from 'react-native';
import ClusteredMapView from 'react-native-map-clustering';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import useTheme from '@/theme/themeContext';

const DEFAULT_REGION = {
  latitude: 43.2965, // Marseille
  latitudeDelta: 0.0922,
  longitude: 5.3698,
  longitudeDelta: 0.0421,
};

/**
 *
 * @param root0
 * @param root0.items
 * @param root0.onMarkerPress
 * @param root0.type
 */
function SearchMap({ items = [], onMarkerPress, type = 'event' }) {
  const { t } = useTranslation();
  const { Colors } = useTheme();
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
            buttonNegative: t('permissions.location.buttonNegative', 'Annuler'),
            buttonNeutral: t('permissions.location.buttonNeutral', 'Plus tard'),
            buttonPositive: t('permissions.location.buttonPositive', 'OK'),
            message: t('permissions.location.message', 'Nous avons besoin de votre position pour afficher les événements autour de vous.'),
            title: t('permissions.location.title', 'Permission de localisation'),
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
        coordinate={{ latitude: parseFloat(lat), longitude: parseFloat(lng) }}
        key={item.id || item.documentId}
        onPress={() => onMarkerPress && onMarkerPress(item)}
        pinColor={type === 'event' ? Colors.primary500 : Colors.warning500}
      >
        {/* Custom Marker View if needed */}
      </Marker>
    );
  };

  return (
    <View style={styles.container}>
      <ClusteredMapView
        clusterColor={Colors.primary500}
        initialRegion={DEFAULT_REGION}
        provider={PROVIDER_GOOGLE}
        showsMyLocationButton={hasPermission}
        showsUserLocation={hasPermission}
        style={styles.map}
      >
        {items.map(renderMarker)}
      </ClusteredMapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    flex: 1,
    overflow: 'hidden',
  },
  map: {
    height: '100%',
    width: '100%',
  },
});

export default SearchMap;
