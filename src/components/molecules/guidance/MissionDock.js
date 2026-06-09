/* eslint-disable max-len, jsdoc/require-description, jsdoc/require-returns, jsdoc/require-param-type */
// @ts-nocheck
import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';

import { useGuidance } from '@/context/GuidanceContext';

const isDockDismissed = (dismissedDockUntil) => {
  if (!dismissedDockUntil) return false;
  return new Date(dismissedDockUntil).getTime() > Date.now();
};

/**
 *
 * @param root0
 * @param root0.color
 * @param root0.completedCount
 * @param root0.totalCount
 */
function ProgressLine({ color, completedCount, totalCount }) {
  const ratio = totalCount > 0 ? Math.min(1, completedCount / totalCount) : 0;

  return (
    <View
      style={{
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 999,
        height: 6,
        overflow: 'hidden',
        width: '100%',
      }}
    >
      <View
        style={{
          backgroundColor: color,
          borderRadius: 999,
          height: '100%',
          width: `${ratio * 100}%`,
        }}
      />
    </View>
  );
}

/**
 * @param {{ style?: import('react-native').ViewStyle | import('react-native').ViewStyle[] }} props
 * @returns {import('react').ReactElement | null}
 */
function MissionDock({ style }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const {
    currentMission,
    dismissDock,
    guidanceConfig,
    isHydrated,
    missionState,
    openMission,
    openMissionDetail,
    snapshot,
  } = useGuidance();
  const [isExpanded, setIsExpanded] = useState(false);

  const missionPack = useMemo(
    () => snapshot.packs.find((pack) => pack.id === currentMission?.packId) || null,
    [currentMission?.packId, snapshot.packs],
  );
  const missionProgram = useMemo(
    () => snapshot.programs.find((program) => program.id === currentMission?.programId) || null,
    [currentMission?.programId, snapshot.programs],
  );

  useEffect(() => {
    setIsExpanded(false);
  }, [currentMission?.id]);

  const {
    completedCount: programCompletedCountFromSummary = 0,
    totalCount: programTotalCountFromSummary = 0,
  } = snapshot.programSummary;
  const isProgramCompleted = programTotalCountFromSummary > 0
    && programCompletedCountFromSummary >= programTotalCountFromSummary;

  if (!guidanceConfig.enabled || !isHydrated || !currentMission || isProgramCompleted) {
    return null;
  }

  if (isDockDismissed(missionState.dismissedDockUntil)) {
    return null;
  }

  const packCompletedCount = missionPack?.completedCount || 0;
  const packTotalCount = missionPack?.totalCount || 0;
  const programCompletedCount = missionProgram?.completedCount || snapshot.programSummary.completedCount || 0;
  const programTotalCount = missionProgram?.totalCount || snapshot.programSummary.totalCount || 0;

  return (
    <View
      style={[
        ApplicationStyle.borderRadius16,
        ApplicationStyle.borderWidth1,
        Spaces.padding[16],
        Spaces.gap[16],
        {
          backgroundColor: 'rgba(7, 26, 38, 0.96)',
          borderColor: `${Colors.primary500}66`,
        },
        style,
      ]}
    >
      <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setIsExpanded((value) => !value)}
          style={{ flex: 1 }}
        >
          <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
            <View style={[Spaces.gap[8], { flex: 1 }]}>
              <Text style={[Fonts.p4Bold, Fonts.primary200]}>PROCHAINE MISSION</Text>
              <Text numberOfLines={isExpanded ? 2 : 1} style={[Fonts.p1Bold, Fonts.neutral00]}>
                {currentMission.title}
              </Text>
            </View>
            <Text style={[Fonts.p3Bold, Fonts.primary100]}>
              {isExpanded ? 'Réduire' : 'Déplier'}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityLabel="Masquer temporairement les missions"
          onPress={() => dismissDock(12)}
          style={{
            alignItems: 'center',
            borderColor: 'rgba(255,255,255,0.14)',
            borderRadius: 999,
            borderWidth: 1,
            height: 28,
            justifyContent: 'center',
            width: 28,
          }}
        >
          <Text style={[Fonts.p2Bold, Fonts.neutral200]}>×</Text>
        </TouchableOpacity>
      </View>

      <View style={[Spaces.gap[8]]}>
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
          <Text style={[Fonts.p4, Fonts.neutral200]}>
            {missionPack?.phase || 'Etapes'}
            {' · '}
            {missionPack?.title || missionProgram?.title || 'Mission'}
          </Text>
          <Text style={[Fonts.p4Bold, Fonts.primary100]}>
            {packCompletedCount}
            /
            {packTotalCount || 1}
          </Text>
        </View>
        <ProgressLine
          color={Colors.primary500}
          completedCount={packCompletedCount}
          totalCount={packTotalCount || 1}
        />
      </View>

      {isExpanded ? (
        <>
          <Text style={[Fonts.p2, Fonts.neutral100]}>{currentMission.longDescription || currentMission.shortDescription}</Text>

          {currentMission.rewardText ? (
            <View
              style={[
                ApplicationStyle.borderRadius12,
                ApplicationStyle.borderWidth1,
                Spaces.padding[16],
                {
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  borderColor: `${Colors.primary500}3D`,
                },
              ]}
            >
              <Text style={[Fonts.p3Bold, Fonts.primary200]}>Pourquoi maintenant</Text>
              <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginTop[4]]}>{currentMission.rewardText}</Text>
            </View>
          ) : null}

          <View style={[Alignments.row, Spaces.gap[12]]}>
            <View style={{ flex: 1 }}>
              <Button
                onPress={() => openMission(currentMission, { tutorialSource: 'mission_dock' })}
                size="small"
                title="Ouvrir"
                variant="Primary"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                onPress={() => openMissionDetail(currentMission.id)}
                size="small"
                title="Voir le détail"
                variant="Secondary"
              />
            </View>
          </View>

          <Text style={[Fonts.p4, Fonts.neutral300]}>
            Progression globale
            {' : '}
            {programCompletedCount}
            /
            {programTotalCount || 1}
          </Text>
        </>
      ) : (
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
          <Text numberOfLines={2} style={[Fonts.p3, Fonts.neutral200, { flex: 1 }]}>
            {currentMission.shortDescription}
          </Text>
          <Button
            onPress={() => openMission(currentMission, { tutorialSource: 'mission_dock' })}
            size="small"
            title="Ouvrir"
            variant="Primary"
          />
        </View>
      )}
    </View>
  );
}

export default MissionDock;
