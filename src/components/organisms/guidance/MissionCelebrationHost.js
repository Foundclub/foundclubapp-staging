import { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import { useGuidance } from '@/context/GuidanceContext';

const SUCCESS_PHASE_MS = Platform.OS === 'web' ? 3600 : 2600;
const NEXT_PHASE_MS = Platform.OS === 'web' ? 2600 : 2200;
const EXIT_DURATION_MS = 220;
const IS_WEB = Platform.OS === 'web';

/**
 *
 */
function MissionCelebrationHost() {
  const { Colors, Fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    activeCelebration,
    dismissCelebration,
    openMission,
    snapshot,
  } = useGuidance();
  const [phase, setPhase] = useState('success');
  const [webProgressRatio, setWebProgressRatio] = useState(1);

  const opacity = useSharedValue(0);
  const progress = useSharedValue(1);
  const translateY = useSharedValue(-24);

  const nextMission = useMemo(
    () => (
      snapshot.missions.find((mission) => mission.id === activeCelebration?.nextMissionId) || null
    ),
    [activeCelebration?.nextMissionId, snapshot.missions],
  );

  useEffect(() => {
    if (!activeCelebration) {
      return undefined;
    }

    setPhase('success');

    if (IS_WEB) {
      setWebProgressRatio(1);

      let frameId = null;
      const getNow = () => (
        typeof window !== 'undefined' && typeof window.performance?.now === 'function'
          ? window.performance.now()
          : Date.now()
      );
      const requestFrame = typeof window !== 'undefined'
        ? window.requestAnimationFrame.bind(window)
        : (callback) => setTimeout(callback, 16);
      const cancelFrame = typeof window !== 'undefined'
        ? window.cancelAnimationFrame.bind(window)
        : clearTimeout;
      const startProgress = (durationMs) => {
        const startAt = getNow();

        const step = () => {
          const elapsed = getNow() - startAt;
          const nextRatio = Math.max(0, 1 - (elapsed / durationMs));
          setWebProgressRatio(nextRatio);

          if (nextRatio > 0) {
            frameId = requestFrame(step);
          }
        };

        frameId = requestFrame(step);
      };

      startProgress(SUCCESS_PHASE_MS);

      const phaseTimer = setTimeout(() => {
        if (frameId !== null) {
          cancelFrame(frameId);
          frameId = null;
        }

        setPhase('next');
        setWebProgressRatio(1);
        startProgress(NEXT_PHASE_MS);
      }, SUCCESS_PHASE_MS);

      const dismissTimer = setTimeout(() => {
        if (frameId !== null) {
          cancelFrame(frameId);
          frameId = null;
        }

        dismissCelebration();
      }, SUCCESS_PHASE_MS + NEXT_PHASE_MS);

      return () => {
        clearTimeout(phaseTimer);
        clearTimeout(dismissTimer);
        if (frameId !== null) {
          cancelFrame(frameId);
        }
      };
    }

    opacity.value = 0;
    progress.value = 1;
    translateY.value = -24;

    opacity.value = withTiming(1, { duration: 220 });
    translateY.value = withTiming(0, { duration: 260, easing: Easing.out(Easing.cubic) });
    progress.value = withTiming(0, { duration: SUCCESS_PHASE_MS, easing: Easing.linear });

    const phaseTimer = setTimeout(() => {
      setPhase('next');
      progress.value = 1;
      progress.value = withTiming(0, { duration: NEXT_PHASE_MS, easing: Easing.linear });
    }, SUCCESS_PHASE_MS);

    const dismissTimer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: EXIT_DURATION_MS });
      translateY.value = withTiming(-16, {
        duration: EXIT_DURATION_MS,
        easing: Easing.in(Easing.cubic),
      });
      setTimeout(() => dismissCelebration(), EXIT_DURATION_MS);
    }, SUCCESS_PHASE_MS + NEXT_PHASE_MS);

    return () => {
      clearTimeout(phaseTimer);
      clearTimeout(dismissTimer);
    };
  }, [
    activeCelebration,
    dismissCelebration,
    opacity,
    progress,
    translateY,
  ]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, progress.value)) * 100}%`,
  }));

  if (!activeCelebration) {
    return null;
  }

  const ContainerComponent = IS_WEB ? View : Animated.View;
  const ProgressFillComponent = IS_WEB ? View : Animated.View;

  const isSuccessPhase = phase === 'success';
  const eyebrow = isSuccessPhase ? 'MISSION Réussie' : 'MISSION SUIVANTE';
  const title = isSuccessPhase
    ? 'Bravo, mission validée'
    : (nextMission?.title || 'Parcours principal à jour');
  const body = isSuccessPhase
    ? activeCelebration.completedMissionTitle
    : (nextMission?.shortDescription || 'Le prochain objectif est prêt. Touche pour le lancer.');

  const handlePress = () => {
    if (nextMission) {
      openMission(nextMission, { tutorialSource: 'mission_celebration' });
      dismissCelebration();
      return;
    }

    // Centre de missions supprime (tour v2) : la celebration se ferme simplement.
    dismissCelebration();
  };

  return (
    <ContainerComponent
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        !IS_WEB && containerStyle,
        {
          left: 16,
          position: IS_WEB ? 'fixed' : 'absolute',
          right: 16,
          top: insets.top + 8,
        },
      ]}
    >
      <Pressable
        onPress={handlePress}
        style={[
          styles.card,
          {
            backgroundColor: 'rgba(10, 28, 43, 0.98)',
            borderColor: `${Colors.primary500}70`,
          },
        ]}
      >
        <View style={styles.content}>
          <Text numberOfLines={1} style={[Fonts.p4Bold, { color: Colors.primary300 }]}>
            {eyebrow}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
            {title}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p4, { color: Colors.neutral200 }]}>
            {body}
          </Text>
        </View>

        <View style={[styles.progressTrack, { backgroundColor: 'rgba(255,255,255,0.10)' }]}>
          <ProgressFillComponent
            style={[
              styles.progressFill,
              IS_WEB
                ? { width: `${Math.max(0, Math.min(1, webProgressRatio)) * 100}%` }
                : progressStyle,
              { backgroundColor: Colors.primary500 },
            ]}
          />
        </View>
      </Pressable>
    </ContainerComponent>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
    minHeight: 78,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  content: {
    gap: 4,
  },
  progressFill: {
    borderRadius: 999,
    height: 4,
  },
  progressTrack: {
    borderRadius: 999,
    height: 4,
    overflow: 'hidden',
    width: '100%',
  },
  wrapper: {
    zIndex: 1195,
  },
});

export default MissionCelebrationHost;
