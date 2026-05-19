// @ts-nocheck
import { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

const DEFAULT_DURATION_MS = 3200;

const resolveBannerPalette = (tone, variant, Colors) => {
  if (variant === 'celebration' && tone === 'success') {
    return {
      accent: Colors.success500,
      background: 'rgba(8, 40, 33, 0.98)',
      border: 'rgba(39, 214, 163, 0.38)',
      progress: Colors.success500,
    };
  }

  if (tone === 'error') {
    return {
      accent: Colors.error500,
      background: 'rgba(54, 17, 24, 0.98)',
      border: 'rgba(255, 40, 79, 0.34)',
      progress: Colors.error500,
    };
  }

  if (tone === 'league' || variant === 'celebration') {
    return {
      accent: Colors.gold500,
      background: 'rgba(20, 33, 45, 0.98)',
      border: 'rgba(255, 215, 0, 0.34)',
      progress: tone === 'league' ? Colors.gold500 : Colors.primary500,
    };
  }

  if (tone === 'success') {
    return {
      accent: Colors.success500,
      background: 'rgba(8, 40, 33, 0.98)',
      border: 'rgba(39, 214, 163, 0.34)',
      progress: Colors.success500,
    };
  }

  return {
    accent: Colors.primary500,
    background: 'rgba(10, 28, 43, 0.98)',
    border: 'rgba(1, 179, 244, 0.34)',
    progress: Colors.primary500,
  };
};

/**
 *
 * @param root0
 * @param root0.actionLabel
 * @param root0.body
 * @param root0.durationMs
 * @param root0.eyebrow
 * @param root0.onAction
 * @param root0.onExited
 * @param root0.onPress
 * @param root0.progressBar
 * @param root0.title
 * @param root0.tone
 * @param root0.variant
 */
function AppCelebrationBanner({
  actionLabel,
  body,
  durationMs = DEFAULT_DURATION_MS,
  eyebrow,
  onAction,
  onExited,
  onPress,
  progressBar = true,
  title,
  tone = 'info',
  variant = 'banner',
}) {
  const { Colors, Fonts } = useTheme();
  const palette = useMemo(
    () => resolveBannerPalette(tone, variant, Colors),
    [Colors, tone, variant],
  );
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-18)).current;
  const progress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(-18);
    progress.setValue(1);

    Animated.parallel([
      Animated.timing(opacity, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.timing(progress, {
        duration: Number(durationMs) > 0 ? Number(durationMs) : DEFAULT_DURATION_MS,
        easing: Easing.linear,
        toValue: 0,
        useNativeDriver: false,
      }),
    ]).start();

    const timeoutMs = Number(durationMs) > 0 ? Number(durationMs) : DEFAULT_DURATION_MS;
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          duration: 180,
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          duration: 180,
          easing: Easing.in(Easing.cubic),
          toValue: -12,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          onExited?.();
        }
      });
    }, timeoutMs);

    return () => clearTimeout(timer);
  }, [durationMs, onExited, opacity, progress, translateY]);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Pressable
        onPress={onPress || undefined}
        style={[
          styles.banner,
          variant === 'celebration' ? styles.bannerCelebration : styles.bannerStandard,
          {
            backgroundColor: palette.background,
            borderColor: palette.border,
          },
        ]}
      >
        <View style={styles.content}>
          {eyebrow ? (
            <Text numberOfLines={1} style={[Fonts.p4Bold, { color: palette.accent }]}>
              {eyebrow}
            </Text>
          ) : null}
          <Text
            numberOfLines={1}
            style={[variant === 'celebration' ? Fonts.p2Bold : Fonts.p3Bold, { color: Colors.neutral00 }]}
          >
            {title}
          </Text>
          {body ? (
            <Text numberOfLines={2} style={[Fonts.p3, { color: Colors.neutral100 }]}>
              {body}
            </Text>
          ) : null}
        </View>

        {actionLabel && typeof onAction === 'function' ? (
          <Pressable onPress={onAction} style={styles.actionButton}>
            <Text style={[Fonts.p4Bold, { color: palette.accent }]}>{actionLabel}</Text>
          </Pressable>
        ) : null}

        {progressBar ? (
          <View style={[styles.progressTrack, { backgroundColor: 'rgba(255,255,255,0.10)' }]}>
            <Animated.View
              style={[
                styles.progressFill,
                { backgroundColor: palette.progress, width: progressWidth },
              ]}
            />
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  banner: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    minHeight: 78,
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  bannerCelebration: {
    minHeight: 88,
    paddingBottom: 12,
  },
  bannerStandard: {
    paddingBottom: 12,
  },
  content: {
    gap: 6,
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
  wrapper: {
    zIndex: Platform.OS === 'web' ? 1185 : 1180,
  },
});

export default AppCelebrationBanner;
