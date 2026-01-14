import React from 'react';
import { View, Text, TouchableOpacity, ImageBackground, StyleSheet, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';

import useTheme from '@/theme/themeContext';
import { RouteNames } from '@/navigation/routeNames';
import { getImageUrl } from '@/utils/imageUrl';

// Field images (same as TacticalBoard)
const FIELD_IMAGES = {
  football: require('@/assets/fields/field_generic.png'),
  rugby: require('@/assets/fields/field_rugby.png'),
  basket: require('@/assets/fields/field_basket.png'),
  basketball: require('@/assets/fields/field_basket.png'),
  handball: require('@/assets/fields/field_handball.png'),
  volley: require('@/assets/fields/field_volley.png'),
  volleyball: require('@/assets/fields/field_volley.png'),
  generic: require('@/assets/fields/field_generic.png'),
};

// Mini field dimensions
const MINI_FIELD_WIDTH = 220;
const MINI_FIELD_HEIGHT = 150;
const MINI_TOKEN_SIZE = 24;

/**
 * Mini composition preview for chat messages
 * @param {object} props
 * @param {object} props.composition - The composition data {eventId, eventDate, sportContext, placements, manualPlayers, sport, eventName}
 * @param {boolean} [props.isMe] - Whether sent by current user
 * @returns {import('react').ReactElement}
 */
const CompositionMessageBubble = ({ composition, isMe = false }) => {
  const { Colors, Fonts, Spaces } = useTheme();
  const navigation = useNavigation();

  if (!composition) return null;

  const {
    eventId,
    eventDate,
    eventName,
    sport = 'football',
    sportContext,
    placements = [],
    manualPlayers = [],
    teamPlayers = [], // Team players for reconstruction
  } = composition;

  // Combine all players for lookup
  const allPlayers = [...teamPlayers, ...manualPlayers];

  const fieldImage = FIELD_IMAGES[sport?.toLowerCase()] || FIELD_IMAGES.generic;
  const formattedDate = eventDate ? dayjs(eventDate).locale('fr').format('DD/MM/YYYY') : '';

  // Navigate to TacticalBoard in readonly mode
  const handlePress = () => {
    // @ts-ignore - navigation types
    navigation.navigate(RouteNames.EventStack, {
      screen: RouteNames.TacticalBoardV2,
      params: {
        eventId,
        sport,
        readOnly: true,
        canEdit: false,
        existingComposition: {
          sportContext,
          placements,
          manualPlayers,
        },
        // Pass ALL players (team + manual) for lookup
        players: allPlayers,
      },
    });
  };

  // Render mini tokens on the field
  const renderMiniTokens = () => {
    return placements.map((placement, index) => {
      const { playerId, positionX, positionY } = placement;
      
      // Find player data from all players (team + manual)
      const player = allPlayers.find(p => p.id === playerId || p.documentId === playerId);
      const initials = player 
        ? `${player.firstname?.charAt(0) || ''}${player.lastname?.charAt(0) || ''}`.toUpperCase()
        : '?';
      
      // Convert percentage to actual position
      const left = (positionX / 100) * MINI_FIELD_WIDTH - MINI_TOKEN_SIZE / 2;
      const top = (positionY / 100) * MINI_FIELD_HEIGHT - MINI_TOKEN_SIZE / 2;

      return (
        <View
          key={`${playerId}-${index}`}
          style={[
            styles.miniToken,
            {
              left,
              top,
              backgroundColor: Colors.primary500,
            },
          ]}
        >
          <Text style={[styles.miniTokenText, { color: '#FFF' }]}>
            {initials}
          </Text>
        </View>
      );
    });
  };

  return (
    <TouchableOpacity 
      onPress={handlePress}
      activeOpacity={0.85}
      style={[
        styles.container,
        {
          backgroundColor: Colors.neutral800,
          borderColor: Colors.neutral700,
          alignSelf: isMe ? 'flex-end' : 'flex-start',
        },
      ]}
    >
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: Colors.neutral700 }]}>
        <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
          🏆 Compo du match
        </Text>
        {formattedDate && (
          <Text style={[Fonts.p3, { color: Colors.neutral00 }]}>
            {formattedDate}
          </Text>
        )}
      </View>

      {/* Mini Field */}
      <ImageBackground
        source={fieldImage}
        style={styles.miniField}
        imageStyle={styles.fieldImage}
        resizeMode="cover"
      >
        {renderMiniTokens()}
        
        {/* Player count badge */}
        <View style={[styles.countBadge, { backgroundColor: Colors.primary500 }]}>
          <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>
            {placements.length} joueur{placements.length > 1 ? 's' : ''}
          </Text>
        </View>
      </ImageBackground>

      {/* Footer hint */}
      <View style={[styles.footer, { backgroundColor: Colors.neutral900 }]}>
        <Text style={[Fonts.p4, { color: Colors.primary500 }]}>
          Appuyer pour voir la composition
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 250,
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
  miniField: {
    width: MINI_FIELD_WIDTH,
    height: MINI_FIELD_HEIGHT,
    alignSelf: 'center',
    margin: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  fieldImage: {
    borderRadius: 8,
  },
  miniToken: {
    position: 'absolute',
    width: MINI_TOKEN_SIZE,
    height: MINI_TOKEN_SIZE,
    borderRadius: MINI_TOKEN_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  miniTokenText: {
    fontSize: 8,
    fontWeight: '700',
  },
  countBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
});

export default CompositionMessageBubble;
