import { useEffect, useMemo, useState } from 'react';
import {
  Modal, Pressable, StyleSheet, Text, View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import DivisionBadge from '@/components/atoms/league/DivisionBadge';
import LeagueModalHeader from '@/components/molecules/header/LeagueModalHeader';

import {
  clampLeagueDivision,
  getDivisionProgressState,
  MAX_LEAGUE_DIVISION,
} from '@/utils/league/division';

const AUTO_HIDE_MS = 7600;
const ENTRY_ANIMATION_MS = 360;
const SEGMENT_GAP_MS = 300;
const SEGMENT_MIN_MS = 560;
const SEGMENT_MAX_MS = 1120;

const clampRatio = (value) => {
  'worklet';

  return Math.max(0, Math.min(1, value));
};

const asFiniteNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatElo = (value) => {
  const parsed = asFiniteNumber(value);
  return parsed === null ? '-' : String(Math.round(parsed));
};

const formatDelta = (value) => {
  const parsed = asFiniteNumber(value);
  if (parsed === null) return '-';
  const rounded = Math.round(parsed);
  return `${rounded >= 0 ? '+' : ''}${rounded}`;
};

const getStatusUi = (status, colors) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'valid') {
    return { chip: 'Résultat validé', color: colors.success500 };
  }
  if (normalized === 'forfeit') {
    return { chip: 'Forfait', color: colors.warning500 };
  }
  if (normalized === 'no_show') {
    return { chip: 'No-show', color: colors.error500 };
  }
  return { chip: 'Match annulé', color: colors.error500 };
};

const getStageLabels = (division) => {
  const progress = getDivisionProgressState(0, division);
  if (progress.maxDivisionReached) {
    return {
      floorLabel: 'D1',
      targetLabel: 'Division max',
    };
  }

  return {
    floorLabel: `${Math.round(progress.minElo)} pts`,
    targetLabel: `${Math.round(progress.targetElo)} pts - D${progress.nextDivision}`,
  };
};

const getSegmentDuration = (fromRatio, toRatio) => {
  const distance = Math.abs(toRatio - fromRatio);
  return Math.round(SEGMENT_MIN_MS + ((SEGMENT_MAX_MS - SEGMENT_MIN_MS) * Math.max(distance, 0.35)));
};

const buildSegment = ({
  banner,
  division,
  fromRatio,
  movement,
  toRatio,
}) => {
  const safeDivision = clampLeagueDivision(division);
  const from = clampRatio(fromRatio);
  const to = clampRatio(toRatio);

  return {
    banner,
    division: safeDivision,
    duration: getSegmentDuration(from, to),
    fromRatio: from,
    movement,
    toRatio: to,
    ...getStageLabels(safeDivision),
  };
};

const buildProgressSegments = ({
  afterProgress,
  beforeProgress,
  divisionAfter,
  divisionBefore,
}) => {
  const movement = afterProgress.elo >= beforeProgress.elo ? 'up' : 'down';
  if (divisionBefore === divisionAfter) {
    return [
      buildSegment({
        banner: movement === 'up' ? 'Progression ELO' : 'Perte ELO',
        division: divisionAfter,
        fromRatio: beforeProgress.progressRatio,
        movement,
        toRatio: afterProgress.progressRatio,
      }),
    ];
  }

  if (divisionAfter < divisionBefore) {
    const segments = [
      buildSegment({
        banner: 'Seuil de promotion atteint',
        division: divisionBefore,
        fromRatio: beforeProgress.progressRatio,
        movement: 'up',
        toRatio: 1,
      }),
    ];

    for (let division = divisionBefore - 1; division >= divisionAfter; division -= 1) {
      segments.push(buildSegment({
        banner: division === divisionAfter ? 'Promotion validée' : `Passage en D${division}`,
        division,
        fromRatio: 0,
        movement: 'up',
        toRatio: division === divisionAfter ? afterProgress.progressRatio : 1,
      }));
    }

    return segments;
  }

  const segments = [
    buildSegment({
      banner: 'Seuil de maintien perdu',
      division: divisionBefore,
      fromRatio: beforeProgress.progressRatio,
      movement: 'down',
      toRatio: 0,
    }),
  ];

  for (let division = divisionBefore + 1; division <= divisionAfter; division += 1) {
    segments.push(buildSegment({
      banner: division === divisionAfter ? 'Relégation appliquée' : `Passage en D${division}`,
      division,
      fromRatio: 1,
      movement: 'down',
      toRatio: division === divisionAfter ? afterProgress.progressRatio : 0,
    }));
  }

  return segments;
};

const getRecapFromPayload = (payload) => {
  if (payload?.recap && typeof payload.recap === 'object') return payload.recap;
  if (payload?.teamRecap && typeof payload.teamRecap === 'object') return payload.teamRecap;
  return {};
};

const buildAnimationModel = (payload) => {
  const recap = getRecapFromPayload(payload);
  const eloBefore = asFiniteNumber(recap?.eloBefore);
  const eloAfter = asFiniteNumber(recap?.eloAfter);
  const parsedDivisionBefore = asFiniteNumber(recap?.divisionBefore);
  const parsedDivisionAfter = asFiniteNumber(recap?.divisionAfter);
  const divisionBefore = parsedDivisionBefore !== null
    ? clampLeagueDivision(parsedDivisionBefore)
    : null;
  const divisionAfter = parsedDivisionAfter !== null
    ? clampLeagueDivision(parsedDivisionAfter)
    : divisionBefore;
  const hasEloRecap = eloBefore !== null && eloAfter !== null && divisionBefore !== null && divisionAfter !== null;

  if (!hasEloRecap) {
    const fallbackDivision = divisionAfter || divisionBefore || MAX_LEAGUE_DIVISION;
    return {
      afterProgress: null,
      beforeProgress: null,
      changeKind: 'none',
      divisionAfter: fallbackDivision,
      divisionBefore: fallbackDivision,
      divisionChanged: false,
      eloAfter,
      eloBefore,
      hasEloRecap: false,
      segments: [
        buildSegment({
          banner: 'Calcul des points en cours',
          division: fallbackDivision,
          fromRatio: 0,
          movement: 'neutral',
          toRatio: 0,
        }),
      ],
      totalDuration: 0,
    };
  }

  const beforeProgress = getDivisionProgressState(eloBefore, divisionBefore);
  const afterProgress = getDivisionProgressState(eloAfter, divisionAfter);
  const divisionChanged = Boolean(
    divisionBefore !== divisionAfter && recap?.divisionChanged !== false,
  );
  const segments = divisionChanged
    ? buildProgressSegments({
      afterProgress,
      beforeProgress,
      divisionAfter,
      divisionBefore,
    })
    : buildProgressSegments({
      afterProgress: {
        ...afterProgress,
        division: divisionBefore,
      },
      beforeProgress,
      divisionAfter: divisionBefore,
      divisionBefore,
    });
  const totalDuration = segments.reduce(
    (sum, segment, index) => sum + segment.duration + (index === 0 ? ENTRY_ANIMATION_MS : SEGMENT_GAP_MS),
    0,
  );
  let changeKind = 'none';
  if (divisionChanged) {
    changeKind = divisionAfter < divisionBefore ? 'promotion' : 'relegation';
  }

  return {
    afterProgress,
    beforeProgress,
    changeKind,
    divisionAfter,
    divisionBefore,
    divisionChanged,
    eloAfter,
    eloBefore,
    hasEloRecap: true,
    segments,
    totalDuration,
  };
};

/**
 * @param {{
 *  onClose?: () => void;
 *  onOpenDetails?: () => void;
 *  onRelaunchSearch?: () => void;
 *  payload?: any;
 *  visible: boolean;
 * }} props
 */
function MatchFinalPosterModal({
  onClose,
  onOpenDetails,
  onRelaunchSearch,
  payload,
  visible,
}) {
  const { Colors, Fonts } = useTheme();
  const entry = useSharedValue(0);
  const eloProgress = useSharedValue(0);
  const [stage, setStage] = useState(() => buildSegment({
    banner: 'Progression ELO',
    division: MAX_LEAGUE_DIVISION,
    fromRatio: 0,
    movement: 'neutral',
    toRatio: 0,
  }));
  const recap = getRecapFromPayload(payload);
  const finalStatus = String(payload?.finalStatus || recap?.finalStatus || payload?.phase || '').toLowerCase();
  const statusUi = useMemo(
    () => getStatusUi(finalStatus, Colors),
    [Colors, finalStatus],
  );
  const animationModel = useMemo(
    () => buildAnimationModel(payload),
    [payload],
  );

  useEffect(() => {
    if (!visible || !payload) return undefined;

    const timers = [];
    const firstSegment = animationModel.segments[0];

    entry.value = 0;
    entry.value = withTiming(1, { duration: ENTRY_ANIMATION_MS, easing: Easing.out(Easing.cubic) });
    eloProgress.value = firstSegment?.fromRatio || 0;
    if (firstSegment) setStage(firstSegment);

    if (animationModel.hasEloRecap) {
      let elapsed = ENTRY_ANIMATION_MS;
      animationModel.segments.forEach((segment, index) => {
        const segmentStartAt = index === 0 ? elapsed : elapsed + SEGMENT_GAP_MS;
        timers.push(setTimeout(() => {
          setStage(segment);
          eloProgress.value = segment.fromRatio;
          timers.push(setTimeout(() => {
            eloProgress.value = withTiming(segment.toRatio, {
              duration: segment.duration,
              easing: Easing.out(Easing.cubic),
            });
          }, 50));
        }, segmentStartAt));
        elapsed = segmentStartAt + segment.duration;
      });
    }

    const autoHideDelay = Math.max(
      AUTO_HIDE_MS,
      animationModel.totalDuration + 2200,
    );
    timers.push(setTimeout(() => {
      onClose?.();
    }, autoHideDelay));

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [animationModel, eloProgress, entry, onClose, payload, visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: entry.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: entry.value,
    transform: [{ translateY: 20 - (entry.value * 20) }, { scale: 0.94 + (entry.value * 0.06) }],
  }));

  const eloFillStyle = useAnimatedStyle(() => ({
    width: `${clampRatio(eloProgress.value) * 100}%`,
  }));

  if (!visible || !payload) return null;

  const scoreLabel = recap?.scoreLabel || `${recap?.myScore ?? '-'}-${recap?.opponentScore ?? '-'}`;
  const {
    afterProgress,
    changeKind,
    divisionAfter,
    divisionBefore,
    divisionChanged,
    eloAfter,
    eloBefore,
    hasEloRecap,
  } = animationModel;
  const computedDelta = eloBefore !== null && eloAfter !== null ? eloAfter - eloBefore : null;
  const deltaValue = asFiniteNumber(recap?.eloDelta) ?? computedDelta;
  const delta = formatDelta(deltaValue);
  const isNegativeDelta = Number(deltaValue) < 0;
  const divisionLabel = divisionChanged
    ? `Division ${divisionBefore} -> ${divisionAfter}`
    : `Division ${divisionAfter || MAX_LEAGUE_DIVISION}`;
  let divisionStatusLabel = 'Maintien';
  if (!hasEloRecap) {
    divisionStatusLabel = 'Calcul en cours';
  } else if (changeKind === 'promotion') {
    divisionStatusLabel = 'Promotion';
  } else if (changeKind === 'relegation') {
    divisionStatusLabel = 'Relégation';
  } else if (afterProgress?.maxDivisionReached) {
    divisionStatusLabel = 'Division max atteinte';
  }
  const progressHelper = (() => {
    if (!hasEloRecap) {
      return 'Les points sont en cours de synchronisation. Le récapitulatif sera mis à jour dès que le calcul League est prêt.';
    }
    if (afterProgress?.maxDivisionReached) {
      return 'Tu es déjà dans la division la plus haute.';
    }
    if (afterProgress?.pointsToPromotion <= 0) {
      return `Seuil D${afterProgress?.nextDivision} atteint.`;
    }
    return `${Math.round(afterProgress?.pointsToPromotion || 0)} pts avant la D${afterProgress?.nextDivision}.`;
  })();

  return (
    <Modal animationType="none" onRequestClose={onClose} transparent visible={visible}>
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <Animated.View
          style={[
            styles.poster,
            cardStyle,
            {
              backgroundColor: 'rgba(1, 36, 52, 0.96)',
              borderColor: Colors.gold500,
            },
          ]}
        >
          <LeagueModalHeader title="Fin de match" />

          <View style={styles.headerRow}>
            <View style={[styles.stageChip, { borderColor: Colors.gold500 }]}>
              <Text style={[Fonts.p3Bold, { color: Colors.gold500 }]}>{stage.banner}</Text>
            </View>
            <View style={[styles.statusChip, { backgroundColor: `${statusUi.color}2A`, borderColor: statusUi.color }]}>
              <Text style={[Fonts.p3Bold, { color: statusUi.color }]}>{statusUi.chip}</Text>
            </View>
          </View>

          <Text style={[Fonts.h1Bold, { color: Colors.gold500, marginTop: 12, textAlign: 'center' }]}>{scoreLabel}</Text>
          <Text style={[Fonts.p2, { color: Colors.neutral200, marginTop: 4, textAlign: 'center' }]}>
            {recap?.resultLabel || recap?.result || 'Résultat enregistré'}
          </Text>

          <View
            style={[
              styles.eloCard,
              {
                backgroundColor: 'rgba(1, 53, 75, 0.42)',
                borderColor: 'rgba(1, 179, 244, 0.35)',
              },
            ]}
          >
            <View style={styles.eloHeader}>
              <View>
                <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>ELO avant</Text>
                <Text style={[Fonts.h4Bold, { color: Colors.gold500 }]}>{formatElo(eloBefore)}</Text>
              </View>
              <View style={[styles.deltaPill, { backgroundColor: `${isNegativeDelta ? Colors.error500 : Colors.success500}24` }]}>
                <Text style={[Fonts.h4Bold, { color: isNegativeDelta ? Colors.error500 : Colors.success500 }]}>{delta}</Text>
              </View>
              <View style={styles.alignEnd}>
                <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>ELO après</Text>
                <Text style={[Fonts.h4Bold, { color: Colors.gold500 }]}>{formatElo(eloAfter)}</Text>
              </View>
            </View>

            <View style={styles.progressBounds}>
              <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>{stage.floorLabel}</Text>
              <Text style={[Fonts.p3Bold, { color: Colors.gold500 }]}>{stage.targetLabel}</Text>
            </View>
            <View style={[styles.eloTrack, { backgroundColor: 'rgba(255,255,255,0.12)' }]}>
              <Animated.View
                style={[
                  styles.eloFill,
                  eloFillStyle,
                  { backgroundColor: stage.movement === 'down' ? Colors.error500 : Colors.success500 },
                ]}
              />
            </View>
            <Text style={[Fonts.p3, { color: Colors.neutral200, marginTop: 8, textAlign: 'center' }]}>
              {progressHelper}
            </Text>
          </View>

          <View style={styles.divisionRow}>
            <DivisionBadge
              division={stage.division || divisionAfter || MAX_LEAGUE_DIVISION}
              showChrome={false}
              showLabel={false}
              size={72}
            />
            <View style={{ alignItems: 'center' }}>
              <Text style={[Fonts.p2Bold, { color: Colors.gold500 }]}>{divisionLabel}</Text>
              <Text style={[Fonts.p3, { color: Colors.neutral300, marginTop: 2 }]}>{divisionStatusLabel}</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Button onPress={onOpenDetails} title="Voir détails" variant="Primary" />
            <Button
              onPress={onRelaunchSearch}
              style={{ borderColor: Colors.gold500 }}
              textStyle={{ color: Colors.gold500 }}
              title="Relancer une recherche"
              variant="Secondary"
            />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 10,
    marginTop: 14,
  },
  alignEnd: {
    alignItems: 'flex-end',
  },
  deltaPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  divisionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginTop: 12,
  },
  eloCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    padding: 12,
  },
  eloFill: {
    borderRadius: 999,
    height: 8,
  },
  eloHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  eloTrack: {
    borderRadius: 999,
    height: 8,
    marginTop: 6,
    overflow: 'hidden',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  overlay: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  poster: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
  },
  progressBounds: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  stageChip: {
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusChip: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});

export default MatchFinalPosterModal;
