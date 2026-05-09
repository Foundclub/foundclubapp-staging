import { useEffect, useMemo, useState } from 'react';
import {
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

const SUCCESS_PHASE_MS = 2600;
const NEXT_PHASE_MS = 2200;
const EXIT_DURATION_MS = 220;

function MissionCelebrationHost() {
  const { Colors, Fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    activeCelebration,
    dismissCelebration,
    openMission,
    openMissionCenter,
    snapshot,
  } = useGuidance();
  const [phase, setPhase] = useState('success');

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

  const isSuccessPhase = phase === 'success';
  const eyebrow = isSuccessPhase ? 'MISSION REUSSIE' : 'MISSION SUIVANTE';
  const title = isSuccessPhase
    ? 'Bravo, mission validee'
    : (nextMission?.title || 'Parcours principal a jour');
  const body = isSuccessPhase
    ? activeCelebration.completedMissionTitle
    : (nextMission?.shortDescription || 'Le prochain objectif est pret. Touchez pour le lancer.');

  const handlePress = () => {
    if (nextMission) {
      openMission(nextMission, { tutorialSource: 'mission_celebration' });
      dismissCelebration();
      return;
    }

    openMissionCenter({ initialTab: 'atlas' });
    dismissCelebration();
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        containerStyle,
        {
          left: 16,
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
          <Animated.View
            style={[
              styles.progressFill,
              progressStyle,
              { backgroundColor: Colors.primary500 },
            ]}
          />
        </View>
      </Pressable>
    </Animated.View>
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
    position: 'absolute',
    zIndex: 1195,
  },
});

export default MissionCelebrationHost;
