import {
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

const getInitials = (firstname, lastname) => {
  const firstInitial = String(firstname || '').trim().charAt(0);
  const lastInitial = String(lastname || '').trim().charAt(0);
  return `${firstInitial}${lastInitial}`.toUpperCase() || '?';
};

/**
 * Contact share message bubble.
 *
 * @param {object} props
 * @param {any} props.composition
 * @param {boolean} [props.isMe]
 * @param {(userDocumentId: string) => void} [props.onPressContact]
 * @returns {import('react').ReactElement | null}
 */
function ContactShareBubble({
  composition,
  isMe = false,
  onPressContact,
}) {
  const { Colors, Fonts } = useTheme();
  if (!composition) return null;

  const userDocumentId = typeof composition?.userDocumentId === 'string'
    ? composition.userDocumentId
    : '';
  const firstname = composition?.firstname || '';
  const lastname = composition?.lastname || '';
  const fullName = `${String(firstname).trim()} ${String(lastname).trim()}`.trim() || 'Membre';
  const roleLabel = typeof composition?.roleLabel === 'string' ? composition.roleLabel : '';

  const handlePress = () => {
    if (!userDocumentId || typeof onPressContact !== 'function') return;
    onPressContact(userDocumentId);
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
      <View style={{ gap: 10, paddingHorizontal: 14, paddingVertical: 12 }}>
        <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
          Contact partagé
        </Text>
        <View style={{ alignItems: 'center', flexDirection: 'row' }}>
          <View
            style={{
              alignItems: 'center',
              backgroundColor: 'rgba(1,179,244,0.2)',
              borderColor: 'rgba(1,179,244,0.35)',
              borderRadius: 24,
              borderWidth: 1,
              height: 48,
              justifyContent: 'center',
              width: 48,
            }}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.primary500 }]}>
              {getInitials(firstname, lastname)}
            </Text>
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text numberOfLines={1} style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
              {fullName}
            </Text>
            {roleLabel ? (
              <Text numberOfLines={1} style={[Fonts.p4, { color: Colors.neutral300 }]}>
                {roleLabel}
              </Text>
            ) : null}
          </View>
        </View>
      </View>
      <TouchableOpacity
        disabled={!userDocumentId}
        onPress={handlePress}
        style={{
          alignItems: 'center',
          borderTopColor: 'rgba(255,255,255,0.1)',
          borderTopWidth: 1,
          opacity: userDocumentId ? 1 : 0.6,
          paddingVertical: 10,
        }}
      >
        <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>Voir le profil</Text>
      </TouchableOpacity>
    </View>
  );
}

export default ContactShareBubble;
