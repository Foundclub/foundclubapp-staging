import {
  Linking,
  Platform,
} from 'react-native';

export const renderMap = () => null;

export const openExternalMap = async ({ label, latitude, longitude }) => {
  const safeLabel = encodeURIComponent(label || `${latitude},${longitude}`);
  const safeLatitude = Number.isFinite(latitude) ? latitude : null;
  const safeLongitude = Number.isFinite(longitude) ? longitude : null;

  if (Platform.OS === 'ios') {
    const url = safeLatitude !== null && safeLongitude !== null
      ? `http://maps.apple.com/?ll=${safeLatitude},${safeLongitude}&q=${safeLabel}`
      : `http://maps.apple.com/?q=${safeLabel}`;

    if (await Linking.canOpenURL(url)) {
      return Linking.openURL(url);
    }
  }

  if (Platform.OS === 'android') {
    const url = safeLatitude !== null && safeLongitude !== null
      ? `geo:${safeLatitude},${safeLongitude}?q=${safeLatitude},${safeLongitude}(${safeLabel})`
      : `geo:0,0?q=${safeLabel}`;

    if (await Linking.canOpenURL(url)) {
      return Linking.openURL(url);
    }
  }

  return Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${safeLabel}`);
};

export default {
  openExternalMap,
  renderMap,
};
