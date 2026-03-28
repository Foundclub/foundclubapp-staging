import { Text, View } from 'react-native';

export const renderMap = ({ height = 240, message = 'Carte web a brancher' } = {}) => (
  <View
    style={{
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.06)',
      borderColor: 'rgba(255,255,255,0.08)',
      borderRadius: 18,
      borderWidth: 1,
      height,
      justifyContent: 'center',
      padding: 16,
    }}
  >
    <Text style={{ color: '#e9f2ff', textAlign: 'center' }}>{message}</Text>
  </View>
);

export const openExternalMap = async ({ label, latitude, longitude }) => {
  if (typeof window === 'undefined') return;
  const query = encodeURIComponent(label || `${latitude},${longitude}`);
  window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank', 'noopener,noreferrer');
};

export default {
  openExternalMap,
  renderMap,
};
