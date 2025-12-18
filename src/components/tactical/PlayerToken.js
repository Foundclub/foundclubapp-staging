import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet, Platform, Vibration } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import useTheme from '@/theme/themeContext';

// Spring configs
const SPRING_CONFIG = {
  damping: 15,
  stiffness: 180,
  mass: 0.8,
};

const FAST_SPRING = {
  damping: 20,
  stiffness: 300,
  mass: 0.5,
};

/**
 * @typedef {Object} Player
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
 * @param {Object} props
 * @param {Player} props.player
 * @param {number} props.index
 * @param {Function} [props.onDragStart]
 * @param {Function} [props.onDragEnd]
 * @param {Function} [props.onDrop]
 * @param {boolean} [props.isOnField]
 */
const PlayerToken = ({
  player,
  index,
  onDragStart,
  onDragEnd,
  onDrop,
  isOnField = false,
}) => {
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
    onDragStart?.({ player, absoluteX: absX, absoluteY: absY, index });
  };

  const notifyDragEnd = () => {
    onDragEnd?.({ player, index });
  };

  const notifyDrop = (/** @type {number} */ absX, /** @type {number} */ absY) => {
    onDrop?.({ player, absoluteX: absX, absoluteY: absY, index });
  };

  // Pan Gesture with enhanced feedback
  const panGesture = useMemo(() => 
    Gesture.Pan()
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
    [player, index, isOnField]
  );

  // Animated style with dynamic shadow
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
      opacity: opacity.value,
      zIndex: isActive.value === 1 ? 1000 : 1,
      elevation: elevation.value,
      shadowOpacity: isActive.value === 1 ? 0.6 : 0.3,
      shadowRadius: isActive.value === 1 ? 20 : 8,
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
            <Text style={styles.fieldName} numberOfLines={1}>
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
          <Text style={[styles.benchFirstName, { color: Colors.neutral00 }]} numberOfLines={1}>
            {player?.firstname || ''}
          </Text>
          <Text style={[styles.benchLastName, { color: Colors.neutral300 }]} numberOfLines={1}>
            {player?.lastname || ''}
          </Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

const styles = StyleSheet.create({
  // === FIELD TOKEN (Floating head style) ===
  fieldToken: {
    width: 60,
    height: 74,
    borderRadius: 30,
    borderWidth: 3,
    alignItems: 'center',
    paddingTop: 3,
    shadowOffset: { width: 0, height: 6 },
  },
  fieldAvatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  fieldAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  fieldInitialsContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldInitials: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  jerseyBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  jerseyNumber: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  fieldNameBadge: {
    marginTop: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    maxWidth: 70,
  },
  fieldName: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },

  // === BENCH TOKEN ===
  benchToken: {
    width: 66,
    height: 82,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    paddingTop: 8,
    marginHorizontal: 4,
    shadowOffset: { width: 0, height: 4 },
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
    paddingHorizontal: 3,
    width: '100%',
  },
  benchFirstName: {
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },
  benchLastName: {
    fontSize: 8,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default PlayerToken;
