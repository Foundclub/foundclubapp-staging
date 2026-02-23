import React, { useMemo } from 'react';
import {
  Image, Platform, StyleSheet, Text, Vibration, View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import useTheme from '@/theme/themeContext';

// Spring configs
const SPRING_CONFIG = {
  damping: 15,
  mass: 0.8,
  stiffness: 180,
};

const FAST_SPRING = {
  damping: 20,
  mass: 0.5,
  stiffness: 300,
};

/**
 * @typedef {object} Player
 * @property {string} [id]
 * @property {string} [documentId]
 * @property {string} [firstname]
 * @property {string} [lastname]
 * @property {string|null} [avatar]
 * @property {number|string} [number] - Jersey number
 * @property {boolean} [isManual]
 */

/**
 * Trigger haptic feedback using Vibration API
 */
const triggerHaptic = () => {
  try {
    // Short vibration for tactile feedback (10ms)
    Vibration.vibrate(10);
  } catch (e) {
    // Vibration not available
  }
};

/**
 * High-Performance Draggable Player Token with Haptics
 * @param {object} props
 * @param {Player} props.player
 * @param {number} props.index
 * @param {Function} [props.onDragStart]
 * @param {Function} [props.onDragEnd]
 * @param {Function} [props.onDrop]
 * @param {boolean} [props.isOnField]
 */
function PlayerToken({
  index,
  isOnField = false,
  onDragEnd,
  onDragStart,
  onDrop,
  player,
}) {
  const { Colors } = useTheme();

  // Shared values for UI thread
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const elevation = useSharedValue(isOnField ? 12 : 6);
  const opacity = useSharedValue(1);
  const isActive = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  // Player initials
  const initials = useMemo(() => {
    const first = player?.firstname?.charAt(0)?.toUpperCase() || '';
    const last = player?.lastname?.charAt(0)?.toUpperCase() || '';
    return first + last || '?';
  }, [player]);

  // Callbacks for runOnJS
  const notifyDragStart = (/** @type {number} */ absX, /** @type {number} */ absY) => {
    triggerHaptic(); // Haptic feedback on grab
    onDragStart?.({
      absoluteX: absX, absoluteY: absY, index, player,
    });
  };

  const notifyDragEnd = () => {
    onDragEnd?.({ index, player });
  };

  const notifyDrop = (/** @type {number} */ absX, /** @type {number} */ absY) => {
    onDrop?.({
      absoluteX: absX, absoluteY: absY, index, player,
    });
  };

  // Pan Gesture with enhanced feedback
  const panGesture = useMemo(
    () => Gesture.Pan()
      .activateAfterLongPress(80) // Small delay to avoid scroll conflict
      .minDistance(5)
      .onStart((e) => {
        'worklet';

        isActive.value = 1;
        // Juicy lift effect
        scale.value = withSpring(1.25, FAST_SPRING);
        elevation.value = withSpring(30, FAST_SPRING);
        opacity.value = 0.95;
        startX.value = translateX.value;
        startY.value = translateY.value;
        runOnJS(notifyDragStart)(e.absoluteX, e.absoluteY);
      })
      .onUpdate((e) => {
        'worklet';

        translateX.value = startX.value + e.translationX;
        translateY.value = startY.value + e.translationY;
      })
      .onEnd((e) => {
        'worklet';

        isActive.value = 0;
        scale.value = withSpring(1, SPRING_CONFIG);
        elevation.value = withSpring(isOnField ? 12 : 6, SPRING_CONFIG);
        opacity.value = 1;
        // Smooth return animation
        translateX.value = withSpring(0, SPRING_CONFIG);
        translateY.value = withSpring(0, SPRING_CONFIG);
        runOnJS(notifyDrop)(e.absoluteX, e.absoluteY);
      })
      .onFinalize(() => {
        'worklet';

        isActive.value = 0;
        scale.value = withSpring(1, SPRING_CONFIG);
        elevation.value = withSpring(isOnField ? 12 : 6, SPRING_CONFIG);
        opacity.value = 1;
        runOnJS(notifyDragEnd)();
      }),
    [player, index, isOnField],
  );

  // Animated style with dynamic shadow
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';

    return {
      elevation: elevation.value,
      opacity: opacity.value,
      shadowOpacity: isActive.value === 1 ? 0.6 : 0.3,
      shadowRadius: isActive.value === 1 ? 20 : 8,
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
      zIndex: isActive.value === 1 ? 1000 : 1,
    };
  });

  // Jersey number badge
  const jerseyNumber = player?.number;

  if (isOnField) {
    // Field Token - Round "floating head" style for cleaner tactical view
    return (
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            styles.fieldToken,
            {
              backgroundColor: Colors.primary500,
              borderColor: Colors.neutral00,
              shadowColor: Colors.primary500,
            },
            animatedStyle,
          ]}
        >
          {/* Avatar */}
          <View style={styles.fieldAvatarContainer}>
            {player?.avatar ? (
              <Image source={{ uri: player.avatar }} style={styles.fieldAvatar} />
            ) : (
              <View style={[styles.fieldInitialsContainer, { backgroundColor: Colors.primary700 || '#0088CC' }]}>
                <Text style={styles.fieldInitials}>{initials}</Text>
              </View>
            )}
          </View>

          {/* Jersey Number Badge */}
          {jerseyNumber && (
            <View style={[styles.jerseyBadge, { backgroundColor: Colors.neutral900 }]}>
              <Text style={styles.jerseyNumber}>{jerseyNumber}</Text>
            </View>
          )}

          {/* Name label */}
          <View style={[styles.fieldNameBadge, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
            <Text numberOfLines={1} style={styles.fieldName}>
              {player?.firstname || ''}
            </Text>
          </View>
        </Animated.View>
      </GestureDetector>
    );
  }

  // Bench Token - Card style
  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[
          styles.benchToken,
          {
            backgroundColor: Colors.neutral800,
            borderColor: Colors.neutral200,
            shadowColor: '#000',
          },
          animatedStyle,
        ]}
      >
        {/* Avatar */}
        <View style={[styles.benchAvatarCircle, { backgroundColor: Colors.neutral700 }]}>
          {player?.avatar ? (
            <Image source={{ uri: player.avatar }} style={styles.benchAvatar} />
          ) : (
            <Text style={[styles.benchInitials, { color: Colors.neutral00 }]}>{initials}</Text>
          )}
        </View>

        {/* Jersey Number Badge on bench too */}
        {jerseyNumber && (
          <View style={[styles.benchJerseyBadge, { backgroundColor: Colors.primary500 }]}>
            <Text style={styles.benchJerseyNumber}>{jerseyNumber}</Text>
          </View>
        )}

        {/* Name */}
        <View style={styles.benchNameContainer}>
          <Text numberOfLines={1} style={[styles.benchFirstName, { color: Colors.neutral00 }]}>
            {player?.firstname || ''}
          </Text>
          <Text numberOfLines={1} style={[styles.benchLastName, { color: Colors.neutral300 }]}>
            {player?.lastname || ''}
          </Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  // === FIELD TOKEN (Floating head style) ===
  fieldAvatar: {
    borderRadius: 22,
    height: 44,
    width: 44,
  },
  fieldAvatarContainer: {
    borderColor: '#FFF',
    borderRadius: 24,
    borderWidth: 2,
    height: 48,
    overflow: 'hidden',
    width: 48,
  },
  fieldInitials: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  fieldInitialsContainer: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  fieldName: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },
  fieldNameBadge: {
    borderRadius: 8,
    marginTop: 2,
    maxWidth: 70,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  fieldToken: {
    alignItems: 'center',
    borderRadius: 30,
    borderWidth: 3,
    height: 74,
    paddingTop: 3,
    shadowOffset: { height: 6, width: 0 },
    width: 60,
  },
  jerseyBadge: {
    alignItems: 'center',
    borderColor: '#FFF',
    borderRadius: 11,
    borderWidth: 2,
    height: 22,
    justifyContent: 'center',
    position: 'absolute',
    right: -4,
    top: -4,
    width: 22,
  },
  jerseyNumber: {
    color: '#FFF',
    fontSize: 10,
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
    fontSize: 9,
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
    paddingHorizontal: 3,
    width: '100%',
  },
  benchToken: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 2,
    height: 82,
    marginHorizontal: 4,
    paddingTop: 8,
    shadowOffset: { height: 4, width: 0 },
    width: 66,
  },
});

export default PlayerToken;
