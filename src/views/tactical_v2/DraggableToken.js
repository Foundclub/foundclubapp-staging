import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
} from 'react-native-reanimated';

import useTheme from '@/theme/themeContext';

/**
 * @typedef {import('./types').TacticalPlayer} TacticalPlayer
 */

/**
 * DraggableToken - Player token for tactical board
 * Stateless component - position controlled by parent via Animated style
 * 
 * @param {Object} props
 * @param {TacticalPlayer} props.player
 * @param {boolean} [props.isOnField] - Different style for field vs bench
 * @param {boolean} [props.isGhost] - Ghost/Clone style for dragging
 * @param {import('react-native-reanimated').SharedValue<number>} [props.translateX]
 * @param {import('react-native-reanimated').SharedValue<number>} [props.translateY]
 * @param {import('react-native-reanimated').SharedValue<number>} [props.scale]
 * @param {import('react-native-reanimated').SharedValue<number>} [props.opacity]
 */
const DraggableToken = ({
  player,
  isOnField = false,
  isGhost = false,
  translateX,
  translateY,
  scale,
  opacity,
}) => {
  const { Colors } = useTheme();

  // Initials
  const initials = useMemo(() => {
    const first = player?.firstname?.charAt(0)?.toUpperCase() || '';
    const last = player?.lastname?.charAt(0)?.toUpperCase() || '';
    return first + last || '?';
  }, [player]);

  // Animated style for ghost token (follows finger)
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    if (!isGhost || !translateX || !translateY) return {};
    
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale?.value ?? 1 },
      ],
      opacity: opacity?.value ?? 1,
    };
  });

  // Ghost Token - Absolute positioned, follows finger
  if (isGhost) {
    return (
      <Animated.View
        style={[
          styles.ghostToken,
          { 
            backgroundColor: Colors.primary500,
            borderColor: Colors.neutral00,
            shadowColor: Colors.primary500,
          },
          animatedStyle,
        ]}
        pointerEvents="none"
      >
        <View style={styles.ghostAvatarContainer}>
          {player?.avatar ? (
            <Image source={{ uri: player.avatar }} style={styles.ghostAvatar} />
          ) : (
            <Text style={styles.ghostInitials}>{initials}</Text>
          )}
        </View>
        <Text style={styles.ghostName} numberOfLines={1}>{player?.firstname || ''}</Text>
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
          {player?.avatar ? (
            <Image source={{ uri: player.avatar }} style={styles.fieldAvatar} />
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
          <Text style={styles.fieldName} numberOfLines={1}>
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
        {player?.avatar ? (
          <Image source={{ uri: player.avatar }} style={styles.benchAvatar} />
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
        <Text style={[styles.benchFirstName, { color: Colors.neutral00 }]} numberOfLines={1}>
          {player?.firstname || ''}
        </Text>
        <Text style={[styles.benchLastName, { color: Colors.neutral300 }]} numberOfLines={1}>
          {player?.lastname || ''}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // === GHOST TOKEN (Dragging overlay) ===
  ghostToken: {
    position: 'absolute',
    width: 70,
    height: 88,
    borderRadius: 35,
    borderWidth: 3,
    alignItems: 'center',
    paddingTop: 6,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 30,
  },
  ghostAvatarContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  ghostAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
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
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },

  // === FIELD TOKEN (On pitch) ===
  fieldToken: {
    width: 58,
    height: 72,
    borderRadius: 29,
    borderWidth: 3,
    alignItems: 'center',
    paddingTop: 4,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  fieldAvatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  fieldAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  fieldInitialsContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldInitials: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  jerseyBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  jerseyNumber: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
  },
  fieldNameBadge: {
    marginTop: 2,
    paddingHorizontal: 6,
    maxWidth: 65,
  },
  fieldName: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // === BENCH TOKEN ===
  benchToken: {
    width: 68,
    height: 84,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    paddingTop: 8,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  benchAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  benchAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  benchInitials: {
    fontSize: 14,
    fontWeight: '700',
  },
  benchJerseyBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benchJerseyNumber: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '700',
  },
  benchNameContainer: {
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 4,
    width: '100%',
  },
  benchFirstName: {
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  benchLastName: {
    fontSize: 8,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default DraggableToken;
