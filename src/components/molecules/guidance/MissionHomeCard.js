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

function MissionHomeCard() {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const {
    currentMission,
    guidanceConfig,
    isHydrated,
    openMission,
    openMissionCenter,
    openMissionDetail,
    snapshot,
  } = useGuidance();
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    setIsExpanded(false);
  }, [currentMission?.id]);

  const summary = snapshot.programSummary;
  const missionIndex = useMemo(
    () => (currentMission ? snapshot.missions.findIndex((mission) => mission.id === currentMission.id) : -1),
    [currentMission, snapshot.missions],
  );

  const missionPreview = useMemo(() => {
    const completedBeforeCurrent = missionIndex >= 0
      ? snapshot.missions.slice(0, missionIndex).filter((mission) => mission.isCompleted)
      : snapshot.missions.filter((mission) => mission.isCompleted);
    const recentCompleted = isExpanded ? completedBeforeCurrent.slice(-2) : [];
    const upcomingMissions = isExpanded && missionIndex >= 0
      ? snapshot.missions
        .slice(missionIndex + 1)
        .filter((mission) => !mission.isCompleted && !mission.isLocked)
        .slice(0, 2)
      : [];

    return {
      recentCompleted,
      upcomingMissions,
    };
  }, [isExpanded, missionIndex, snapshot.missions]);

  if (!guidanceConfig.enabled || !isHydrated) {
    return null;
  }

  const isCompleted = !currentMission && summary.totalCount > 0 && summary.completedCount >= summary.totalCount;
  const expandedDescription = isCompleted
    ? 'Votre progression principale est a jour. Vous pouvez revoir toutes les missions, revisiter les etapes terminees et relancer un guide si besoin.'
    : currentMission?.rewardText || currentMission?.longDescription || 'Reprenez la mission en cours pour avancer vers les outils suivants.';

  return (
    <View
      style={[
        ApplicationStyle.borderRadius16,
        ApplicationStyle.borderWidth1,
        Spaces.padding[16],
        isExpanded ? Spaces.gap[12] : Spaces.gap[8],
        {
          backgroundColor: 'rgba(7, 26, 38, 0.96)',
          borderColor: `${Colors.primary500}66`,
        },
      ]}
    >
      <TouchableOpacity activeOpacity={0.9} onPress={() => setIsExpanded((value) => !value)}>
        <View style={[isExpanded ? Spaces.gap[12] : Spaces.gap[8]]}>
          <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
            <View style={[Spaces.gap[4], { flex: 1 }]}>
              <Text style={[Fonts.p4Bold, Fonts.primary200]}>MA PROGRESSION FOUNDCLUB</Text>
              <Text numberOfLines={1} style={[Fonts.h5Bold, Fonts.neutral00]}>
                {summary.title || 'Progression FoundClub'}
              </Text>
            </View>

            <View style={[Alignments.alignCenter, Spaces.gap[4]]}>
              <Text style={[Fonts.p4Bold, Fonts.primary100]}>
                {summary.completedCount}
                /
                {summary.totalCount || 1}
              </Text>
              <Text style={[Fonts.p4Bold, Fonts.neutral300]}>{isExpanded ? 'REDUIRE' : 'DEPLIER'}</Text>
            </View>
          </View>

          <ProgressLine
            color={Colors.primary500}
            completedCount={summary.completedCount}
            totalCount={summary.totalCount || 1}
          />
        </View>
      </TouchableOpacity>

      <View style={[isExpanded ? Spaces.gap[8] : Spaces.gap[4]]}>
        {missionPreview.recentCompleted.map((mission) => (
          <MissionStatusRow
            description={mission.shortDescription}
            isCompact={!isExpanded}
            key={mission.id}
            label="TERMINEE"
            onPress={() => openMissionDetail(mission.id)}
            title={mission.title}
            tone="completed"
          />
        ))}

        {currentMission ? (
          <MissionStatusRow
            description={currentMission.shortDescription}
            isCompact={!isExpanded}
            label="EN COURS"
            onPress={() => openMission(currentMission, { tutorialSource: 'home_card' })}
            title={currentMission.title}
            tone="current"
          />
        ) : (
          <MissionStatusRow
            description="La progression principale est terminee. Toutes les missions restent disponibles pour revoir chaque fonctionnalite."
            isCompact={!isExpanded}
            label="TERMINE"
            onPress={() => openMissionCenter({ initialTab: 'atlas' })}
            title="Progression principale complete"
            tone="completed"
          />
        )}

        {missionPreview.upcomingMissions.map((mission) => (
          <MissionStatusRow
            description={mission.shortDescription}
            isCompact={!isExpanded}
            key={mission.id}
            label="A VENIR"
            onPress={() => openMissionDetail(mission.id)}
            title={mission.title}
            tone="upcoming"
          />
        ))}
      </View>

      {isExpanded ? (
        <View style={[Spaces.gap[12]]}>
          <Text style={[Fonts.p3, Fonts.neutral200]}>{expandedDescription}</Text>

          <View style={[Alignments.row, Spaces.gap[12]]}>
            {currentMission ? (
              <View style={{ flex: 1 }}>
                <Button
                  onPress={() => openMission(currentMission, { tutorialSource: 'home_card' })}
                  size="small"
                  title="Ouvrir"
                  variant="Primary"
                />
              </View>
            ) : null}

            <View style={{ flex: 1 }}>
              <Button
                onPress={() => openMissionCenter({ initialTab: currentMission ? 'next' : 'atlas' })}
                size="small"
                title="Voir tout"
                variant={currentMission ? 'Secondary' : 'Primary'}
              />
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function MissionStatusRow({
  description,
  isCompact = false,
  label,
  onPress,
  title,
  tone = 'upcoming',
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  const isCompleted = tone === 'completed';
  const isCurrent = tone === 'current';
  let indicatorBorderColor = 'rgba(255,255,255,0.18)';
  let indicatorFillColor = 'transparent';
  let titleColor = Colors.neutral100;
  let labelColor = Colors.neutral200;
  let descriptionColor = Colors.neutral300;

  if (isCompleted) {
    indicatorBorderColor = Colors.neutral300;
    indicatorFillColor = Colors.neutral300;
    titleColor = Colors.neutral300;
    labelColor = Colors.neutral300;
  }

  if (isCurrent) {
    indicatorBorderColor = Colors.primary500;
    indicatorFillColor = Colors.primary500;
    titleColor = Colors.neutral00;
    labelColor = Colors.primary300;
    descriptionColor = Colors.neutral200;
  }

  let indicatorSize = 0;
  if (isCompleted) {
    indicatorSize = 8;
  } else if (isCurrent) {
    indicatorSize = 10;
  }

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.88 : 1}
      disabled={!onPress}
      onPress={onPress}
      style={[
        ApplicationStyle.borderRadius16,
        ApplicationStyle.borderWidth1,
        Spaces.paddingHorizontal[12],
        isCompact ? Spaces.paddingVertical[8] : Spaces.paddingVertical[12],
        isCompact ? Spaces.gap[4] : Spaces.gap[8],
        {
          backgroundColor: isCurrent ? 'rgba(1, 179, 244, 0.10)' : 'rgba(255,255,255,0.02)',
          borderColor: isCurrent ? `${Colors.primary500}52` : 'rgba(255,255,255,0.08)',
        },
      ]}
    >
      <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], { flex: 1 }]}>
          <View
            style={{
              alignItems: 'center',
              borderColor: indicatorBorderColor,
              borderRadius: 999,
              borderWidth: 1,
              height: 16,
              justifyContent: 'center',
              width: 16,
            }}
          >
            <View
              style={{
                backgroundColor: indicatorFillColor,
                borderRadius: 999,
                height: indicatorSize,
                width: indicatorSize,
              }}
            />
          </View>
          <Text
            numberOfLines={1}
            style={[
              Fonts.p2Bold,
              {
                color: titleColor,
                flex: 1,
                textDecorationLine: isCompleted ? 'line-through' : 'none',
              },
            ]}
          >
            {title}
          </Text>
        </View>
        <Text
          numberOfLines={1}
          style={[
            Fonts.p4Bold,
            {
              color: labelColor,
            },
          ]}
        >
          {label}
        </Text>
      </View>

      {!isCompact && description ? (
        <Text numberOfLines={2} style={[Fonts.p4, { color: descriptionColor }]}>
          {description}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

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

export default MissionHomeCard;
