import { useNavigation } from '@react-navigation/native';
import dayjs from 'dayjs';
import React from 'react';
import {
  Dimensions, ImageBackground, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import 'dayjs/locale/fr';

import useTheme from '@/theme/themeContext';

import { RouteNames } from '@/navigation/routeNames';

import { getImageUrl } from '@/utils/imageUrl';

// Field images (same as TacticalBoard)
const FIELD_IMAGES = {
  basket: require('@/assets/fields/field_basket.png'),
  basketball: require('@/assets/fields/field_basket.png'),
  football: require('@/assets/fields/field_generic.png'),
  generic: require('@/assets/fields/field_generic.png'),
  handball: require('@/assets/fields/field_handball.png'),
  rugby: require('@/assets/fields/field_rugby.png'),
  volley: require('@/assets/fields/field_volley.png'),
  volleyball: require('@/assets/fields/field_volley.png'),
};

// Mini field dimensions
const MINI_FIELD_WIDTH = 220;
const MINI_FIELD_HEIGHT = 150;
const MINI_TOKEN_SIZE = 24;

/**
 * @typedef {{ id?: string; documentId?: string; firstname?: string; lastname?: string }} CompositionPlayer
 * @typedef {{ playerId?: string; positionX?: number; positionY?: number }} CompositionPlacement
 * @typedef {{
 *   eventId?: string;
 *   eventDate?: string;
 *   eventName?: string;
 *   sport?: string;
 *   sportContext?: string;
 *   placements?: CompositionPlacement[];
 *   manualPlayers?: CompositionPlayer[];
 *   teamPlayers?: CompositionPlayer[];
 * }} CompositionPayload
 */

/**
 * Mini composition preview for chat messages
 * @param {object} props
 * @param {CompositionPayload | null | undefined} props.composition - The composition data
 * @param {boolean} [props.isMe] - Whether sent by current user
 * @returns {import('react').ReactElement | null}
 */
function CompositionMessageBubble({ composition, isMe = false }) {
  const { Colors, Fonts, Spaces } = useTheme();
  const navigation = useNavigation();

  if (!composition) return null;

  const {
    eventDate,
    eventId,
    eventName,
    manualPlayers = [],
    placements = [],
    sport = 'football',
    sportContext,
    teamPlayers = [], // Team players for reconstruction
  } = composition;

  // Combine all players for lookup
  const allPlayers = [...teamPlayers, ...manualPlayers];

  const sportKey = /** @type {keyof typeof FIELD_IMAGES} */ ((sport || 'football').toLowerCase());
  const fieldImage = FIELD_IMAGES[sportKey] || FIELD_IMAGES.generic;
  const formattedDate = eventDate ? dayjs(eventDate).locale('fr').format('DD/MM/YYYY') : '';

  // Navigate to TacticalBoard in readonly mode
  const handlePress = () => {
    // @ts-ignore - navigation types
    navigation.navigate(RouteNames.EventStack, {
      params: {
        canEdit: false,
        eventId,
        existingComposition: {
          manualPlayers,
          placements,
          sportContext,
        },
        readOnly: true,
        sport,
        // Pass ALL players (team + manual) for lookup
        players: allPlayers,
      },
      screen: RouteNames.TacticalBoardV2,
    });
  };

  // Render mini tokens on the field
  const renderMiniTokens = () => placements.map((/** @type {CompositionPlacement} */ placement, /** @type {number} */ index) => {
    const { playerId, positionX, positionY } = placement;

    // Find player data from all players (team + manual)
    const player = allPlayers.find((/** @type {CompositionPlayer} */ p) => p.id === playerId || p.documentId === playerId);
    const initials = player
      ? `${player.firstname?.charAt(0) || ''}${player.lastname?.charAt(0) || ''}`.toUpperCase()
      : '?';

    // Convert percentage to actual position
    const left = ((positionX || 0) / 100) * MINI_FIELD_WIDTH - MINI_TOKEN_SIZE / 2;
    const top = ((positionY || 0) / 100) * MINI_FIELD_HEIGHT - MINI_TOKEN_SIZE / 2;

    return (
      <View
        key={`${playerId}-${index}`}
        style={[
          styles.miniToken,
          {
            backgroundColor: Colors.primary500,
            left,
            top,
          },
        ]}
      >
        <Text style={[styles.miniTokenText, { color: '#FFF' }]}>
          {initials}
        </Text>
      </View>
    );
  });

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handlePress}
      style={[
        styles.container,
        {
          alignSelf: isMe ? 'flex-end' : 'flex-start',
          backgroundColor: Colors.neutral800,
          borderColor: Colors.neutral700,
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
        imageStyle={styles.fieldImage}
        resizeMode="cover"
        source={fieldImage}
        style={styles.miniField}
      >
        {renderMiniTokens()}

        {/* Player count badge */}
        <View style={[styles.countBadge, { backgroundColor: Colors.primary500 }]}>
          <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>
            {placements.length}
            {' '}
            joueur
            {placements.length > 1 ? 's' : ''}
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
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 4,
    overflow: 'hidden',
    width: 250,
  },
  countBadge: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    position: 'absolute',
    right: 6,
    top: 6,
  },
  fieldImage: {
    borderRadius: 8,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  header: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  miniField: {
    alignSelf: 'center',
    borderRadius: 8,
    height: MINI_FIELD_HEIGHT,
    margin: 8,
    overflow: 'hidden',
    width: MINI_FIELD_WIDTH,
  },
  miniToken: {
    alignItems: 'center',
    borderColor: '#FFF',
    borderRadius: MINI_TOKEN_SIZE / 2,
    borderWidth: 2,
    height: MINI_TOKEN_SIZE,
    justifyContent: 'center',
    position: 'absolute',
    width: MINI_TOKEN_SIZE,
  },
  miniTokenText: {
    fontSize: 8,
    fontWeight: '700',
  },
});

export default CompositionMessageBubble;
