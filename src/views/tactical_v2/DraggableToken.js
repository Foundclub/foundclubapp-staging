import React, { useMemo } from 'react';
import {
  Image, StyleSheet, Text, View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
} from 'react-native-reanimated';

import useTheme from '@/theme/themeContext';

import { getImageUrl } from '@/utils/imageUrl';

/**
 * @typedef {import('./types').TacticalPlayer} TacticalPlayer
 */

/**
 * DraggableToken - Player token for tactical board
 * Stateless component - position controlled by parent via Animated style
 * @param {object} props
 * @param {TacticalPlayer} props.player
 * @param {boolean} [props.isOnField] - Different style for field vs bench
 * @param {boolean} [props.isGhost] - Ghost/Clone style for dragging
 * @param {import('react-native-reanimated').SharedValue<number>} [props.translateX]
 * @param {import('react-native-reanimated').SharedValue<number>} [props.translateY]
 * @param {import('react-native-reanimated').SharedValue<number>} [props.scale]
 * @param {import('react-native-reanimated').SharedValue<number>} [props.opacity]
 */
function DraggableToken({
  isGhost = false,
  isOnField = false,
  opacity,
  player,
  scale,
  translateX,
  translateY,
}) {
  const { Colors } = useTheme();

  // Initials
  const initials = useMemo(() => {
    const first = player?.firstname?.charAt(0)?.toUpperCase() || '';
    const last = player?.lastname?.charAt(0)?.toUpperCase() || '';
    return first + last || '?';
  }, [player]);

  // Check if player is manually added (no profile photo for manual players)
  const isManualPlayer = useMemo(() => player?.isManual || String(player?.id || '').startsWith('manual_'), [player]);

  // Handle avatar source (string vs object vs null)
  // Manual players always show initials, never a photo
  const avatarUri = useMemo(() => {
    if (isManualPlayer) return null; // Force initials for manual players
    if (!player?.avatar) return null;

    let rawUrl = null;
    if (typeof player.avatar === 'string') {
      rawUrl = player.avatar;
    } else if (player.avatar?.url && typeof player.avatar.url === 'string') {
      rawUrl = player.avatar.url;
    } else if (player.avatar?.formats?.thumbnail?.url && typeof player.avatar.formats.thumbnail.url === 'string') {
      rawUrl = player.avatar.formats.thumbnail.url;
    }

    // Use getImageUrl to properly prefix relative URLs
    return rawUrl ? getImageUrl(rawUrl) : null;
  }, [player?.avatar, isManualPlayer]);

  // Animated style for ghost token (follows finger)
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';

    if (!isGhost || !translateX || !translateY) return {};

    return {
      opacity: opacity?.value ?? 1,
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale?.value ?? 1 },
      ],
    };
  });

  // Ghost Token - Absolute positioned, follows finger
  if (isGhost) {
    return (
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ghostToken,
          {
            backgroundColor: Colors.primary500,
            borderColor: Colors.neutral00,
            shadowColor: Colors.primary500,
          },
          animatedStyle,
        ]}
      >
        <View style={styles.ghostAvatarContainer}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.ghostAvatar} />
          ) : (
            <Text style={styles.ghostInitials}>{initials}</Text>
          )}
        </View>
        <Text numberOfLines={1} style={styles.ghostName}>{player?.firstname || ''}</Text>
      </Animated.View>
    );
  }

  // Field Token - Round floating head style
  if (isOnField) {
    return (
      <View
        style={[
          styles.fieldToken,
          {
            backgroundColor: Colors.primary500,
            borderColor: Colors.neutral00,
            shadowColor: Colors.primary500,
          },
        ]}
      >
        <View style={styles.fieldAvatarContainer}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.fieldAvatar} />
          ) : (
            <View style={[styles.fieldInitialsContainer, { backgroundColor: '#0088CC' }]}>
              <Text style={styles.fieldInitials}>{initials}</Text>
            </View>
          )}
        </View>

        {player?.number && (
          <View style={[styles.jerseyBadge, { backgroundColor: Colors.neutral900 }]}>
            <Text style={styles.jerseyNumber}>{player.number}</Text>
          </View>
        )}

        <View style={styles.fieldNameBadge}>
          <Text numberOfLines={1} style={styles.fieldName}>
            {player?.firstname || ''}
          </Text>
        </View>
      </View>
    );
  }

  // Bench Token - Card style
  return (
    <View
      style={[
        styles.benchToken,
        {
          backgroundColor: Colors.neutral800,
          borderColor: Colors.neutral200,
        },
      ]}
    >
      <View style={[styles.benchAvatarCircle, { backgroundColor: Colors.neutral700 }]}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.benchAvatar} />
        ) : (
          <Text style={[styles.benchInitials, { color: Colors.neutral00 }]}>{initials}</Text>
        )}
      </View>

      {player?.number && (
        <View style={[styles.benchJerseyBadge, { backgroundColor: Colors.primary500 }]}>
          <Text style={styles.benchJerseyNumber}>{player.number}</Text>
        </View>
      )}

      <View style={styles.benchNameContainer}>
        <Text numberOfLines={1} style={[styles.benchFirstName, { color: Colors.neutral00 }]}>
          {player?.firstname || ''}
        </Text>
        <Text numberOfLines={1} style={[styles.benchLastName, { color: Colors.neutral300 }]}>
          {player?.lastname || ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // === GHOST TOKEN (Dragging overlay) ===
  ghostAvatar: {
    borderRadius: 26,
    height: 52,
    width: 52,
  },
  ghostAvatarContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 52,
  },
  ghostInitials: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
  },
  ghostName: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 4,
  },
  ghostToken: {
    alignItems: 'center',
    borderRadius: 35,
    borderWidth: 3,
    elevation: 30,
    height: 88,
    paddingTop: 6,
    position: 'absolute',
    shadowOffset: { height: 12, width: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    width: 70,
  },

  // === FIELD TOKEN (On pitch) ===
  fieldAvatar: {
    borderRadius: 20,
    height: 40,
    width: 40,
  },
  fieldAvatarContainer: {
    borderColor: '#FFF',
    borderRadius: 22,
    borderWidth: 2,
    height: 44,
    overflow: 'hidden',
    width: 44,
  },
  fieldInitials: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  fieldInitialsContainer: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  fieldName: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 2,
  },
  fieldNameBadge: {
    marginTop: 2,
    maxWidth: 65,
    paddingHorizontal: 6,
  },
  fieldToken: {
    alignItems: 'center',
    borderRadius: 29,
    borderWidth: 3,
    elevation: 12,
    height: 72,
    paddingTop: 4,
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    width: 58,
  },
  jerseyBadge: {
    alignItems: 'center',
    borderColor: '#FFF',
    borderRadius: 10,
    borderWidth: 2,
    height: 20,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    top: -2,
    width: 20,
  },
  jerseyNumber: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
  },

  // === BENCH TOKEN ===
  benchAvatar: {
    borderRadius: 22,
    height: 44,
    width: 44,
  },
  benchAvatarCircle: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 44,
  },
  benchFirstName: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  benchInitials: {
    fontSize: 14,
    fontWeight: '700',
  },
  benchJerseyBadge: {
    alignItems: 'center',
    borderRadius: 9,
    height: 18,
    justifyContent: 'center',
    position: 'absolute',
    right: 4,
    top: 4,
    width: 18,
  },
  benchJerseyNumber: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '700',
  },
  benchLastName: {
    fontSize: 8,
    fontWeight: '500',
    textAlign: 'center',
  },
  benchNameContainer: {
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 4,
    width: '100%',
  },
  benchToken: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 2,
    elevation: 6,
    height: 84,
    marginHorizontal: 4,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    width: 68,
  },
});

export default DraggableToken;
