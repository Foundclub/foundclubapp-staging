import {
  Linking,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

const resolveLabel = (composition) => {
  const label = composition?.label
    || composition?.address
    || composition?.title
    || composition?.name;
  return typeof label === 'string' ? label.trim() : '';
};

const resolveCoordinates = (composition) => {
  const lat = Number(composition?.lat);
  const lng = Number(composition?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

/**
 * Location share message bubble.
 *
 * @param {object} props
 * @param {any} props.composition
 * @param {boolean} [props.isMe]
 * @returns {import('react').ReactElement | null}
 */
function LocationShareBubble({ composition, isMe = false }) {
  const { Colors, Fonts } = useTheme();
  if (!composition) return null;

  const label = resolveLabel(composition);
  const coordinates = resolveCoordinates(composition);
  if (!label && !coordinates) return null;

  const openInMaps = async () => {
    const targetLabel = label || `${coordinates?.lat || ''},${coordinates?.lng || ''}`;
    const encoded = encodeURIComponent(targetLabel);
    const url = coordinates
      ? Platform.select({
        android: `geo:${coordinates.lat},${coordinates.lng}?q=${encoded}`,
        default: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
        ios: `maps:${coordinates.lat},${coordinates.lng}?q=${encoded}`,
      })
      : Platform.select({
        android: `geo:0,0?q=${encoded}`,
        default: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
        ios: `maps:0,0?q=${encoded}`,
      });

    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch (_error) {
      await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encoded}`);
    }
  };

  return (
    <View
      style={{
        alignSelf: isMe ? 'flex-end' : 'flex-start',
        backgroundColor: 'rgba(20, 39, 52, 0.92)',
        borderColor: 'rgba(1,179,244,0.35)',
        borderRadius: 14,
        borderWidth: 1,
        marginVertical: 6,
        maxWidth: '90%',
        minWidth: 260,
        overflow: 'hidden',
      }}
    >
      <View style={{ gap: 8, paddingHorizontal: 14, paddingVertical: 12 }}>
        <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
          Position partagee
        </Text>
        <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>{label || 'Position'}</Text>
        {coordinates ? (
          <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>
            {coordinates.lat.toFixed(5)}
            {' , '}
            {coordinates.lng.toFixed(5)}
          </Text>
        ) : null}
      </View>
      <TouchableOpacity
        onPress={openInMaps}
        style={{
          alignItems: 'center',
          borderTopColor: 'rgba(255,255,255,0.1)',
          borderTopWidth: 1,
          paddingVertical: 10,
        }}
      >
        <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>Ouvrir dans le GPS</Text>
      </TouchableOpacity>
    </View>
  );
}

export default LocationShareBubble;
