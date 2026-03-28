import { Linking } from 'react-native';

export const renderMap = () => null;

export const openExternalMap = async ({ label, latitude, longitude }) => {
  const query = encodeURIComponent(label || `${latitude},${longitude}`);
  return Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
};

export default {
  openExternalMap,
  renderMap,
};
