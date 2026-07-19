import { PermissionsAndroid, Platform } from 'react-native';

const DEFAULT_GEOLOCATION_OPTIONS = Object.freeze({
  enableHighAccuracy: true,
  maximumAge: 45000,
  timeout: 10000,
});

const getNavigatorGeolocation = () => {
  const candidates = [
    typeof navigator !== 'undefined' ? navigator : null,
    global?.navigator || null,
  ];

  return candidates.find(
    (candidate) => (
      candidate?.geolocation
      && typeof candidate.geolocation.getCurrentPosition === 'function'
    ),
  )?.geolocation || null;
};

const requestNativeLocationPermission = async () => {
  if (Platform.OS !== 'android') {
    return true;
  }

  const alreadyGranted = await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  if (alreadyGranted) {
    return true;
  }

  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      buttonNegative: 'Annuler',
      buttonNeutral: 'Plus tard',
      buttonPositive: 'Autoriser',
      message: 'Nous avons besoin de ta position pour afficher les résultats autour de toi.',
      title: 'Permission de localisation',
    },
  );

  return granted === PermissionsAndroid.RESULTS.GRANTED;
};

export const canUseSearchMapGeolocation = () => Boolean(getNavigatorGeolocation());

/**
 * Request the current device position for the search map.
 * Keeps the renderer detached from direct geolocation access details.
 * @returns {Promise<{ lat: number, lng: number } | null>}
 */
export const requestCurrentSearchMapLocation = async () => {
  try {
    const hasPermission = await requestNativeLocationPermission();
    if (!hasPermission) {
      return null;
    }

    const geolocationApi = getNavigatorGeolocation();
    if (!geolocationApi) {
      return null;
    }

    return await new Promise((resolve) => {
      geolocationApi.getCurrentPosition(
        (position) => {
          const lat = position?.coords?.latitude;
          const lng = position?.coords?.longitude;

          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            resolve(null);
            return;
          }

          resolve({ lat, lng });
        },
        () => {
          resolve(null);
        },
        DEFAULT_GEOLOCATION_OPTIONS,
      );
    });
  } catch (error) {
    return null;
  }
};

export default {
  canUseSearchMapGeolocation,
  requestCurrentSearchMapLocation,
};
