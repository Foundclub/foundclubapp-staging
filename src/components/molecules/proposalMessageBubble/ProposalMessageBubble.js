import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Linking, Platform } from 'react-native';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';

import useTheme from '@/theme/themeContext';

/**
 * Bubble to display a Match Proposal in a chat
 * @param {object} props
 * @param {object} props.proposal - The proposal data { venue, address, date, endDate, status }
 * @param {boolean} [props.isMe] - Whether sent by current user
 * @param {function} [props.onAccept] - Function called when accepted
 * @param {function} [props.onDecline] - Function called when declined
 * @returns {import('react').ReactElement}
 */
const ProposalMessageBubble = ({ proposal, isMe = false, onAccept, onDecline }) => {
  const { Colors, Fonts, Spaces } = useTheme();
  const [loading, setLoading] = useState(false);

  if (!proposal) return null;

  const {
    venue = "Lieu à définir",
    address,
    date,
    endDate,
    status = 'pending' // pending, accepted, declined
  } = proposal;

  const formattedDate = date ? dayjs(date).locale('fr').format('dddd D MMMM') : 'Date à définir';
  const formattedStartTime = date ? dayjs(date).format('HH:mm') : '--:--';
  const formattedEndTime = endDate ? dayjs(endDate).format('HH:mm') : '--:--';
  const timeRange = `${formattedStartTime} → ${formattedEndTime}`;

  const handleAction = async (actionFn) => {
    if (!actionFn) return;
    setLoading(true);
    await actionFn();
    setLoading(false);
  };

  const openMaps = () => {
    const addressToOpen = address || venue;
    if (!addressToOpen) return;
    
    const encodedAddress = encodeURIComponent(addressToOpen);
    const url = Platform.select({
      ios: `maps:0,0?q=${encodedAddress}`,
      android: `geo:0,0?q=${encodedAddress}`,
    });
    
    // Try native maps first, fallback to Google Maps web
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`);
      }
    });
  };

  const renderStatus = () => {
    if (status === 'accepted') {
      return (
        <View style={[styles.statusBadge, { backgroundColor: Colors.success500 }]}>
          <Text style={[Fonts.p4Bold, { color: Colors.neutral00 }]}>ACCEPTÉ ✅</Text>
        </View>
      );
    }
    if (status === 'declined') {
      return (
        <View style={[styles.statusBadge, { backgroundColor: Colors.error500 }]}>
          <Text style={[Fonts.p4Bold, { color: Colors.neutral00 }]}>REFUSÉ ❌</Text>
        </View>
      );
    }
    return (
        <View style={[styles.statusBadge, { backgroundColor: Colors.warning500 }]}>
          <Text style={[Fonts.p4Bold, { color: Colors.neutral00 }]}>EN ATTENTE ⏳</Text>
        </View>
    );
  };

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: Colors.neutral800,
        borderColor: Colors.gold500,
        alignSelf: isMe ? 'flex-end' : 'flex-start',
      },
    ]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: Colors.neutral700 }]}>
        <Text style={[Fonts.p2Bold, { color: Colors.gold500 }]}>
          🤝 Proposition de Match
        </Text>
        {renderStatus()}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.row}>
            <Text style={{ fontSize: 16 }}>📅</Text>
            <Text style={[Fonts.h3, { color: Colors.neutral00, marginLeft: 8 }]}>
                {formattedDate}
            </Text>
        </View>
        <View style={styles.row}>
            <Text style={{ fontSize: 16 }}>⏰</Text>
            <Text style={[Fonts.h3, { color: Colors.primary500, marginLeft: 8 }]}>
                {timeRange}
            </Text>
        </View>
        
        {/* Venue Name */}
        <View style={styles.row}>
            <Text style={{ fontSize: 16 }}>🏟️</Text>
            <Text style={[Fonts.p1Bold, { color: Colors.neutral00, marginLeft: 8, flex: 1 }]} numberOfLines={1}>
                {venue}
            </Text>
        </View>
        
        {/* Address - Clickable */}
        {address && (
          <TouchableOpacity onPress={openMaps} style={styles.addressRow}>
            <Text style={{ fontSize: 16 }}>📍</Text>
            <Text style={[Fonts.p2, { color: Colors.primary400, marginLeft: 8, flex: 1, textDecorationLine: 'underline' }]} numberOfLines={2}>
                {address}
            </Text>
            <Text style={{ fontSize: 12, marginLeft: 4 }}>🗺️</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Actions (Only if Pending and NOT ME) */}
      {status === 'pending' && !isMe && (
        <View style={[styles.footer, { borderTopColor: Colors.neutral700 }]}>
            {loading ? (
                <ActivityIndicator color={Colors.primary500} />
            ) : (
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity 
                        onPress={() => handleAction(onDecline)}
                        style={[styles.button, { backgroundColor: Colors.error500 }]}
                    >
                        <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>REFUSER</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => handleAction(onAccept)}
                        style={[styles.button, { backgroundColor: Colors.success500 }]}
                    >
                        <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>ACCEPTER</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
      )}
      
      {/* Message for sender */}
      {status === 'pending' && isMe && (
           <View style={[styles.footer, { borderTopColor: Colors.neutral700 }]}>
                <Text style={[Fonts.p4, { color: Colors.neutral00, fontStyle: 'italic' }]}>
                    En attente de la réponse adverse...
                </Text>
           </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 280,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    marginVertical: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  content: {
    padding: 16,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(1, 179, 244, 0.1)',
    padding: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  footer: {
    padding: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  button: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      minWidth: 100,
      alignItems: 'center',
  }
});

export default ProposalMessageBubble;
