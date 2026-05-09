/* eslint-disable max-len, jsdoc/require-description, jsdoc/require-returns, jsdoc/require-param-type */
// @ts-nocheck
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import SectionHeader from '@/components/atoms/SectionHeader/SectionHeader';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGuidance } from '@/context/GuidanceContext';

const TAB_OPTIONS = [
  { key: 'next', label: 'En cours' },
  { key: 'packs', label: 'Etapes' },
  { key: 'atlas', label: 'Toutes les missions' },
];

const TAB_KEYS = new Set(TAB_OPTIONS.map((tab) => tab.key));

const normalizeTabKey = (value) => {
  if (typeof value !== 'string') {
    return 'next';
  }

  return TAB_KEYS.has(value) ? value : 'next';
};

const MISSION_STATUS_LABELS = {
  completed: 'Terminée',
  current: 'En cours',
  locked: 'À débloquer',
  ready: 'Prête',
};

const getMissionStatus = (mission, currentMissionId) => {
  if (mission.isCompleted) return 'completed';
  if (mission.id === currentMissionId) return 'current';
  if (mission.isLocked) return 'locked';
  return 'ready';
};

/**
 *
 * @param root0
 * @param root0.color
 * @param root0.label
 */
function MissionStatusPill({ color, label }) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: `${color}1A`,
        borderColor: `${color}55`,
        borderRadius: 999,
        borderWidth: 1,
        minHeight: 30,
        paddingHorizontal: 12,
        paddingVertical: 7,
      }}
    >
      <Text style={{ color, fontFamily: 'Montserrat-Bold', fontSize: 11 }}>{label.toUpperCase()}</Text>
    </View>
  );
}

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
        height: 8,
        overflow: 'hidden',
        width: '100%',
      }}
    >
      <View
        style={{
          backgroundColor: color,
          borderRadius: 999,
          height: '100%',
          minWidth: totalCount > 0 ? 12 : 0,
          width: `${ratio * 100}%`,
        }}
      />
    </View>
  );
}

/**
 *
 * @param root0
 * @param root0.activeTab
 * @param root0.onChange
 */
function SegmentedTabs({ activeTab, onChange }) {
  const {
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  return (
    <View style={[Spaces.gap[12]]}>
      <View style={[Spaces.gap[8]]}>
        {TAB_OPTIONS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => onChange(tab.key)}
              style={[
                ApplicationStyle.borderRadius16,
                ApplicationStyle.borderWidth1,
                Spaces.paddingHorizontal[16],
                Spaces.paddingVertical[16],
                {
                  backgroundColor: isActive ? Colors.primary500 : 'rgba(7, 26, 38, 0.7)',
                  borderColor: isActive ? Colors.primary500 : `${Colors.primary500}44`,
                  justifyContent: 'center',
                  minHeight: 50,
                },
              ]}
            >
              <Text style={[Fonts.p2Bold, isActive ? Fonts.neutral00 : Fonts.primary100]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/**
 *
 * @param root0
 * @param root0.currentMissionId
 * @param root0.mission
 * @param root0.onOpen
 */
function MissionCard({
  currentMissionId,
  mission,
  onOpen,
}) {
  const {
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  const missionStatus = getMissionStatus(mission, currentMissionId);
  let statusColor = Colors.primary500;
  if (missionStatus === 'completed') {
    statusColor = Colors.success500;
  } else if (missionStatus === 'locked') {
    statusColor = Colors.neutral400;
  } else if (missionStatus === 'current') {
    statusColor = Colors.primary500;
  } else {
    statusColor = Colors.primary200;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.88}
      onPress={() => onOpen(mission)}
      style={[
        ApplicationStyle.borderRadius16,
        ApplicationStyle.borderWidth1,
        Spaces.padding[16],
        Spaces.gap[12],
        {
          backgroundColor: 'rgba(7, 26, 38, 0.96)',
          borderColor: `${statusColor}${missionStatus === 'current' ? '70' : '55'}`,
          minHeight: 174,
        },
      ]}
    >
      <MissionStatusPill color={statusColor} label={MISSION_STATUS_LABELS[missionStatus]} />
      <View style={[Spaces.gap[12]]}>
        <Text style={[Fonts.p1Bold, Fonts.neutral00]}>{mission.title}</Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>{mission.shortDescription}</Text>
      </View>
      <Text style={[Fonts.p4, Fonts.primary100, { marginTop: 2 }]}>
        {mission.module}
        {' · '}
        {mission.completionMode === 'manual_fallback' ? 'validation assistée' : 'validation automatique'}
      </Text>
    </TouchableOpacity>
  );
}

/**
 *
 * @param root0
 * @param root0.currentMissionId
 * @param root0.onOpenMission
 * @param root0.pack
 */
function PackCard({
  currentMissionId,
  onOpenMission,
  pack,
}) {
  const {
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  return (
    <View
      style={[
        ApplicationStyle.borderRadius16,
        ApplicationStyle.borderWidth1,
        Spaces.padding[16],
        Spaces.gap[16],
        {
          backgroundColor: pack.isLocked ? 'rgba(255,255,255,0.03)' : 'rgba(7, 26, 38, 0.96)',
          borderColor: pack.isCompleted ? `${Colors.success500}55` : `${Colors.primary500}44`,
        },
      ]}
    >
      <View style={[Spaces.gap[8]]}>
        <Text style={[Fonts.p4Bold, pack.isLocked ? Fonts.neutral300 : Fonts.primary200]}>{pack.phase}</Text>
        <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{pack.title}</Text>
        <Text style={[Fonts.p3, Fonts.neutral200]}>{pack.teaser}</Text>
      </View>

      <View style={[Spaces.gap[8]]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={[Fonts.p4, Fonts.neutral200]}>Progression</Text>
          <Text style={[Fonts.p4Bold, Fonts.primary100]}>
            {pack.completedCount}
            /
            {pack.totalCount || 1}
          </Text>
        </View>
        <ProgressLine
          color={pack.isCompleted ? Colors.success500 : Colors.primary500}
          completedCount={pack.completedCount}
          totalCount={pack.totalCount || 1}
        />
      </View>

      <View style={[Spaces.gap[12]]}>
        {pack.missions.map((mission) => (
          <MissionCard
            currentMissionId={currentMissionId}
            key={mission.id}
            mission={mission}
            onOpen={onOpenMission}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function MissionCenter({ navigation, route }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const {
    confirmMissionManually,
    currentMission,
    markMissionViewed,
    openMission,
    programs,
    resetGuidanceProgress,
    snapshot,
  } = useGuidance();
  const [activeTab, setActiveTab] = useState(() => normalizeTabKey(route?.params?.initialTab));
  const [selectedMissionId, setSelectedMissionId] = useState('');

  const missionIndex = useMemo(
    () => snapshot.missions.reduce((accumulator, mission) => ({
      ...accumulator,
      [mission.id]: mission,
    }), {}),
    [snapshot.missions],
  );
  const selectedMission = selectedMissionId ? missionIndex[selectedMissionId] || null : null;
  const recommendedMissions = useMemo(
    () => snapshot.missions.filter((mission) => !mission.isCompleted && !mission.isLocked).slice(0, 5),
    [snapshot.missions],
  );

  const openMissionSheet = useCallback((mission) => {
    if (!mission?.id) return;
    markMissionViewed(mission.id);
    setSelectedMissionId(mission.id);
  }, [markMissionViewed]);

  const closeMissionSheet = useCallback(() => {
    setSelectedMissionId('');
  }, []);

  useEffect(() => {
    const nextTab = route?.params?.initialTab;
    if (typeof nextTab !== 'string') {
      return;
    }

    const normalizedTab = normalizeTabKey(nextTab);
    if (normalizedTab !== activeTab) {
      setActiveTab(normalizedTab);
    }

    navigation.setParams({
      initialTab: undefined,
    });
  }, [activeTab, navigation, route?.params?.initialTab]);

  useEffect(() => {
    const focusMissionId = route?.params?.focusMissionId;
    if (!focusMissionId || !missionIndex[focusMissionId]) {
      return;
    }

    if (route?.params?.openDetail) {
      openMissionSheet(missionIndex[focusMissionId]);
    }

    navigation.setParams({
      focusMissionId: undefined,
      initialTab: undefined,
      openDetail: undefined,
    });
  }, [missionIndex, navigation, openMissionSheet, route?.params?.focusMissionId, route?.params?.openDetail]);

  const currentProgram = programs[0] || null;
  const visiblePrograms = programs.length > 0 ? programs : snapshot.programs;
  const selectedMissionStatus = selectedMission
    ? getMissionStatus(selectedMission, currentMission?.id)
    : 'ready';
  let selectedMissionStatusColor = Colors.primary200;
  if (selectedMission?.isCompleted) {
    selectedMissionStatusColor = Colors.success500;
  } else if (selectedMission?.isLocked) {
    selectedMissionStatusColor = Colors.neutral400;
  } else if (selectedMission?.id === currentMission?.id) {
    selectedMissionStatusColor = Colors.primary500;
  }

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[Alignments.fill]}
      responsivePadding
    >
      <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.marginTop[12], Spaces.marginBottom[16]]}>
        <HeaderBackButton
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
              return;
            }
            navigation.navigate(RouteNames.HomeTab);
          }}
          withDefaultMargin={false}
        />
        <View style={[Alignments.alignCenter, Spaces.gap[8], { flex: 1 }]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>MISSIONS</Text>
          <View style={[ApplicationStyle.separator, ApplicationStyle.backgroundColor.neutral00, { width: 84 }]} />
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={[Spaces.gap[24], Spaces.paddingBottom[40]]} showsVerticalScrollIndicator={false}>
        <View
          style={[
            ApplicationStyle.borderRadius24,
            ApplicationStyle.borderWidth1,
            Spaces.padding[24],
            Spaces.gap[16],
            {
              backgroundColor: 'rgba(7, 26, 38, 0.96)',
              borderColor: `${Colors.primary500}70`,
            },
          ]}
        >
          <Text style={[Fonts.p4Bold, Fonts.primary200]}>PROGRESSION ACTIVE</Text>
          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
            {currentProgram?.title || snapshot.programSummary.title || 'Découvrir FoundClub'}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral200]}>
            {currentProgram?.description || 'Explorez l’ensemble des outils FoundClub, étape par étape.'}
          </Text>
          <View style={[Spaces.gap[8]]}>
            <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
              <Text style={[Fonts.p4, Fonts.neutral200]}>Progression</Text>
              <Text style={[Fonts.p4Bold, Fonts.primary100]}>
                {snapshot.programSummary.completedCount}
                /
                {snapshot.programSummary.totalCount || 1}
              </Text>
            </View>
            <ProgressLine
              color={Colors.primary500}
              completedCount={snapshot.programSummary.completedCount}
              totalCount={snapshot.programSummary.totalCount || 1}
            />
          </View>
        </View>

        <SegmentedTabs activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === 'next' ? (
          <View style={[Spaces.gap[16]]}>
            <SectionHeader subtitle="Ce que l’app vous recommande ensuite" title="Reprendre maintenant" />
            {currentMission ? (
              <MissionCard
                currentMissionId={currentMission?.id}
                mission={currentMission}
                onOpen={openMissionSheet}
              />
            ) : (
              <View
                style={[
                  ApplicationStyle.borderRadius16,
                  ApplicationStyle.borderWidth1,
                  Spaces.padding[16],
                  {
                    backgroundColor: 'rgba(7, 26, 38, 0.96)',
                    borderColor: `${Colors.success500}55`,
                  },
                ]}
              >
                <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Progression a jour</Text>
                <Text style={[Fonts.p2, Fonts.neutral200, Spaces.marginTop[8]]}>
                  Votre progression principale est terminee. Vous pouvez revoir toutes les missions ou relancer celles qui vous interessent.
                </Text>
              </View>
            )}

            {recommendedMissions.length > 1 ? (
              <View style={[Spaces.gap[12]]}>
                <SectionHeader subtitle="Les prochaines étapes déjà débloquées" title="À venir" />
                {recommendedMissions.slice(currentMission ? 1 : 0).map((mission) => (
                  <MissionCard
                    currentMissionId={currentMission?.id}
                    key={mission.id}
                    mission={mission}
                    onOpen={openMissionSheet}
                  />
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {activeTab === 'packs' ? (
          <View style={[Spaces.gap[16]]}>
            {visiblePrograms.map((program) => (
              <View key={program.id} style={[Spaces.gap[12]]}>
                <SectionHeader subtitle={program.description} title={program.title} />
                {program.packs.map((pack) => (
                  <PackCard
                    currentMissionId={currentMission?.id}
                    key={pack.id}
                    onOpenMission={openMissionSheet}
                    pack={pack}
                  />
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {activeTab === 'atlas' ? (
          <View style={[Spaces.gap[16]]}>
            <SectionHeader
              subtitle="Retrouvez toute la cartographie des missions disponibles, meme en dehors de la suite immediate."
              title="Toutes les missions"
            />
            {visiblePrograms.map((program) => (
              <View key={program.id} style={[Spaces.gap[12]]}>
                <SectionHeader subtitle={program.description} title={program.title} />
                {program.packs.map((pack) => (
                  <View key={pack.id} style={[Spaces.gap[8]]}>
                    <Text style={[Fonts.p3Bold, Fonts.primary200]}>
                      {pack.phase}
                      {' · '}
                      {pack.title}
                    </Text>
                    {pack.missions.map((mission) => (
                      <MissionCard
                        currentMissionId={currentMission?.id}
                        key={mission.id}
                        mission={mission}
                        onOpen={openMissionSheet}
                      />
                    ))}
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        <Button
          onPress={resetGuidanceProgress}
          title="Réinitialiser mes missions"
          variant="SecondaryLight"
        />
      </ScrollView>

      <BottomModal close={closeMissionSheet} isVisible={Boolean(selectedMission)}>
        {selectedMission ? (
          <View style={[Spaces.gap[16], Spaces.paddingBottom[20]]}>
            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{selectedMission.title}</Text>
              <MissionStatusPill
                color={selectedMissionStatusColor}
                label={MISSION_STATUS_LABELS[selectedMissionStatus]}
              />
              <Text style={[Fonts.p2, Fonts.neutral200]}>{selectedMission.longDescription}</Text>
            </View>

            {selectedMission.rewardText ? (
              <View
                style={[
                  ApplicationStyle.borderRadius16,
                  ApplicationStyle.borderWidth1,
                  Spaces.padding[16],
                  {
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    borderColor: `${Colors.primary500}44`,
                  },
                ]}
              >
                <Text style={[Fonts.p3Bold, Fonts.primary200]}>Bénéfice</Text>
                <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginTop[4]]}>{selectedMission.rewardText}</Text>
              </View>
            ) : null}

            {Array.isArray(selectedMission.actionsToTry) && selectedMission.actionsToTry.length > 0 ? (
              <View style={[Spaces.gap[8]]}>
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>À tester</Text>
                {selectedMission.actionsToTry.map((action) => (
                  <Text key={action} style={[Fonts.p3, Fonts.neutral200]}>
                    •
                    {' '}
                    {action}
                  </Text>
                ))}
              </View>
            ) : null}

            <View style={[Spaces.gap[12]]}>
              <Button
                disabled={selectedMission.isLocked}
                onPress={() => openMission(selectedMission, { tutorialSource: 'mission_center' })}
                title="Ouvrir l’écran"
                variant="Primary"
              />
              {selectedMission.tutorialTargetResolved?.tutorialId ? (
                <Button
                  disabled={selectedMission.isLocked}
                  onPress={() => openMission(selectedMission, {
                    startTutorial: true,
                    tutorialSource: 'mission_center',
                  })}
                  title="Lancer le guide"
                  variant="Secondary"
                />
              ) : null}
              {selectedMission.completionMode === 'manual_fallback' && !selectedMission.isCompleted ? (
                <Button
                  disabled={selectedMission.isLocked}
                  onPress={() => confirmMissionManually(selectedMission.id)}
                  title="J’ai compris cet outil"
                  variant="SecondaryLight"
                />
              ) : null}
            </View>
          </View>
        ) : null}
      </BottomModal>
    </ScreenContainer>
  );
}

export default MissionCenter;
