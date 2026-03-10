import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import {
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

/**
 * Event share message bubble.
 *
 * @param {object} props
 * @param {any} props.composition
 * @param {boolean} [props.isMe]
 * @param {(eventDocumentId: string) => void} [props.onPressEvent]
 * @returns {import('react').ReactElement | null}
 */
function EventShareBubble({
  composition,
  isMe = false,
  onPressEvent,
}) {
  const { Colors, Fonts } = useTheme();
  if (!composition) return null;

  const eventDocumentId = typeof composition?.eventDocumentId === 'string'
    ? composition.eventDocumentId
    : '';
  const eventName = composition?.eventName || 'Evenement';
  const teamName = composition?.teamName || '';
  const locationLabel = composition?.locationLabel || '';
  const eventDate = composition?.eventDate ? dayjs(composition.eventDate).locale('fr').format('DD/MM/YYYY HH:mm') : '';

  const handlePress = () => {
    if (!eventDocumentId || typeof onPressEvent !== 'function') return;
    onPressEvent(eventDocumentId);
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
      <View style={{ gap: 6, paddingHorizontal: 14, paddingVertical: 12 }}>
        <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
          Evenement partage
        </Text>
        <Text numberOfLines={2} style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
          {eventName}
        </Text>
        {eventDate ? (
          <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>{eventDate}</Text>
        ) : null}
        {teamName ? (
          <Text style={[Fonts.p4, { color: Colors.neutral300 }]}>
            Equipe:
            {' '}
            {teamName}
          </Text>
        ) : null}
        {locationLabel ? (
          <Text numberOfLines={2} style={[Fonts.p4, { color: Colors.neutral300 }]}>
            {locationLabel}
          </Text>
        ) : null}
      </View>
      <TouchableOpacity
        disabled={!eventDocumentId}
        onPress={handlePress}
        style={{
          alignItems: 'center',
          borderTopColor: 'rgba(255,255,255,0.1)',
          borderTopWidth: 1,
          opacity: eventDocumentId ? 1 : 0.6,
          paddingVertical: 10,
        }}
      >
        <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>Ouvrir l evenement</Text>
      </TouchableOpacity>
    </View>
  );
}

export default EventShareBubble;
