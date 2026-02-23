import React, { useEffect } from 'react';
import {
  Pressable, StyleSheet, Text, View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import useTheme from '@/theme/themeContext';

const AUTO_HIDE_MS = 4000;

/**
 *
 * @param root0
 * @param root0.onDismiss
 * @param root0.onOpenDetails
 * @param root0.payload
 * @param root0.visible
 */
function MatchRecapBanner({
  onDismiss,
  onOpenDetails,
  payload,
  visible,
}) {
  const { Colors, Fonts } = useTheme();
  const translateY = useSharedValue(-110);
  const opacity = useSharedValue(0);
  const progress = useSharedValue(1);

  useEffect(() => {
    if (!visible || !payload) return undefined;
    translateY.value = withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) });
    opacity.value = withTiming(1, { duration: 220 });
    progress.value = 1;
    progress.value = withTiming(0, { duration: AUTO_HIDE_MS, easing: Easing.linear });

    const timer = setTimeout(() => {
      onDismiss?.();
    }, AUTO_HIDE_MS);

    return () => clearTimeout(timer);
  }, [visible, payload, onDismiss, opacity, progress, translateY]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, progress.value)) * 100}%`,
  }));

  if (!visible || !payload) return null;

  const recap = payload.recap || {};
  const resultLabel = recap.resultLabel || recap.result || 'Match terminé';
  const scoreLabel = typeof recap.scoreLabel === 'string'
    ? recap.scoreLabel
    : `${recap.myScore ?? '-'} - ${recap.opponentScore ?? '-'}`;

  return (
    <Animated.View style={[styles.wrapper, containerStyle]}>
      <Pressable
        onPress={onOpenDetails}
        style={[
          styles.card,
          {
            backgroundColor: 'rgba(10, 28, 43, 0.95)',
            borderColor: Colors.gold500,
          },
        ]}
      >
        <Text style={[Fonts.p3Bold, { color: Colors.gold500 }]}>Recap match</Text>
        <View style={styles.row}>
          <Text numberOfLines={1} style={[Fonts.h4, { color: Colors.neutral00 }]}>{resultLabel}</Text>
          <Text style={[Fonts.h4Bold, { color: Colors.primary500 }]}>{scoreLabel}</Text>
        </View>
        <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300 }]}>
          Touchez pour voir le detail complet.
        </Text>
        <View style={[styles.progressTrack, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
          <Animated.View style={[styles.progressFill, progressStyle, { backgroundColor: Colors.primary500 }]} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  progressFill: {
    borderRadius: 999,
    height: 4,
  },
  progressTrack: {
    borderRadius: 999,
    height: 4,
    marginTop: 2,
    overflow: 'hidden',
    width: '100%',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  wrapper: {
    left: 12,
    position: 'absolute',
    right: 12,
    top: 12,
    zIndex: 40,
  },
});

export default MatchRecapBanner;
