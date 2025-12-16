import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
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
 * High-Performance Draggable Player Token
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
  const elevation = useSharedValue(isOnField ? 12 : 4);
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
  const notifyDragStart = (absX, absY) => {
    onDragStart?.({ player, absoluteX: absX, absoluteY: absY, index });
  };

  const notifyDragEnd = () => {
    onDragEnd?.({ player, index });
  };

  const notifyDrop = (absX, absY) => {
    onDrop?.({ player, absoluteX: absX, absoluteY: absY, index });
  };

  // Pan Gesture
  const panGesture = useMemo(() => 
    Gesture.Pan()
      .activateAfterLongPress(0)
      .minDistance(0)
      .onStart((e) => {
        'worklet';
        isActive.value = 1;
        scale.value = withSpring(1.18, FAST_SPRING);
        elevation.value = withSpring(24, FAST_SPRING);
        opacity.value = 0.9;
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
        elevation.value = withSpring(isOnField ? 12 : 4, SPRING_CONFIG);
        opacity.value = 1;
        translateX.value = withSpring(0, SPRING_CONFIG);
        translateY.value = withSpring(0, SPRING_CONFIG);
        runOnJS(notifyDrop)(e.absoluteX, e.absoluteY);
      })
      .onFinalize(() => {
        'worklet';
        isActive.value = 0;
        scale.value = withSpring(1, SPRING_CONFIG);
        elevation.value = withSpring(isOnField ? 12 : 4, SPRING_CONFIG);
        opacity.value = 1;
        runOnJS(notifyDragEnd)();
      }),
    [player, index, isOnField]
  );

  // Animated style
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
      shadowOpacity: isActive.value === 1 ? 0.5 : 0.25,
      shadowRadius: isActive.value === 1 ? 15 : 6,
    };
  });

  if (isOnField) {
    // Field Token - Larger and more visible
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
          <View style={[styles.fieldAvatarRing, { borderColor: Colors.neutral00 }]}>
            {player?.avatar ? (
              <Image source={{ uri: player.avatar }} style={styles.fieldAvatar} />
            ) : (
              <View style={[styles.fieldInitialsContainer, { backgroundColor: Colors.primary700 || Colors.primary500 }]}>
                <Text style={styles.fieldInitials}>{initials}</Text>
              </View>
            )}
          </View>
          <View style={styles.fieldNameBadge}>
            <Text style={styles.fieldName} numberOfLines={1}>
              {player?.firstname || ''}
            </Text>
          </View>
        </Animated.View>
      </GestureDetector>
    );
  }

  // Bench Token
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
        <View style={[styles.benchAvatarCircle, { backgroundColor: Colors.neutral700 }]}>
          {player?.avatar ? (
            <Image source={{ uri: player.avatar }} style={styles.benchAvatar} />
          ) : (
            <Text style={[styles.benchInitials, { color: Colors.neutral00 }]}>{initials}</Text>
          )}
        </View>
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
  // === FIELD TOKEN (on terrain) ===
  fieldToken: {
    width: 64,
    height: 80,
    borderRadius: 14,
    borderWidth: 3,
    alignItems: 'center',
    paddingTop: 5,
    shadowOffset: { width: 0, height: 4 },
  },
  fieldAvatarRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
  fieldNameBadge: {
    marginTop: 3,
    paddingHorizontal: 6,
    width: '100%',
  },
  fieldName: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // === BENCH TOKEN ===
  benchToken: {
    width: 64,
    height: 80,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    paddingTop: 6,
    marginHorizontal: 4,
    shadowOffset: { width: 0, height: 3 },
  },
  benchAvatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  benchAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  benchInitials: {
    fontSize: 14,
    fontWeight: '700',
  },
  benchNameContainer: {
    alignItems: 'center',
    marginTop: 3,
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
