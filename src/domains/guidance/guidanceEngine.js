/* eslint-disable max-len, comma-dangle, perfectionist/sort-array-includes, perfectionist/sort-imports, perfectionist/sort-sets, prefer-destructuring */
// @ts-nocheck
import { getUserRoleKey } from '@/domains/auth/authUseCases';
import {
  createEmptyGuidanceState,
  mergeGuidanceState,
  normalizeGuidanceConfig,
  normalizeGuidanceState,
} from '@/domains/guidance/guidanceState';
import { getAvailableRequestHubFilters } from '@/domains/requests/requestMappers';
import { guidanceCatalog, GuidanceProgramIds } from '@/domains/guidance/guidanceCatalog';

const isNonEmptyObject = (value) => value && typeof value === 'object' && !Array.isArray(value);

const getMissionSignalTimestamp = (state, signal) => {
  if (!signal || !signal.type) return null;

  if (signal.type === 'route') {
    return state?.routeVisits?.[signal.routeName] || null;
  }

  if (signal.type === 'interaction') {
    return state?.interactionSignals?.[signal.key] || null;
  }

  if (signal.type === 'action') {
    return state?.actionSignals?.[signal.key] || null;
  }

  return null;
};

const statePredicates = {
  hasClubAffiliation: (context) => Boolean(context?.hasClub),
  hasManagedClub: (context) => Boolean(context?.hasManagedClub),
  hasRequestsContext: (context) => Boolean(context?.hasRequestsContext),
  profileBasicsComplete: (context) => {
    const userData = context?.userData || {};
    const hasName = Boolean(userData.firstname && userData.lastname);
    const hasAvatar = Boolean(userData.avatar?.url || userData.avatar?.documentId);
    return hasName && hasAvatar;
  },
};

export const buildGuidanceAudienceContext = ({
  canEditClub,
  canManageTeam,
  isGold,
  userData,
}) => {
  const roleKey = getUserRoleKey(userData?.role?.type || userData?.role?.name);
  const clubId = userData?.club?.documentId || '';
  const cmId = userData?.multisportClubs?.[0]?.documentId || '';
  const trainedTeamIds = (userData?.trainedTeams || []).map((team) => team?.documentId).filter(Boolean);
  const hasTrainingTeam = Array.isArray(userData?.trainedTeams) && userData.trainedTeams.length > 0;
  const hasPlayerTeam = Array.isArray(userData?.myTeams) && userData.myTeams.length > 0;
  const hasTeam = hasTrainingTeam || hasPlayerTeam;
  const hasManagedClub = Boolean(clubId && typeof canEditClub === 'function' && canEditClub(clubId))
    || roleKey === 'president'
    || Boolean(cmId);
  const canManageInstallationRequests = Boolean(
    clubId
      && typeof canEditClub === 'function'
      && canEditClub(clubId),
  );
  const availableRequestFilters = getAvailableRequestHubFilters({
    canManageInstallationRequests,
    clubId,
    cmId,
    teamIds: trainedTeamIds,
  });

  return {
    availableRequestFilters,
    canManageInstallationRequests,
    canManageTeam: Boolean(canManageTeam),
    clubId,
    cmId,
    hasClub: Boolean(clubId || cmId),
    hasManagedClub,
    hasPlayerTeam,
    hasRequestsContext: availableRequestFilters.some((filterKey) => filterKey !== 'all'),
    hasTeamAffiliation: hasTeam,
    hasTrainingTeam,
    isGold: Boolean(isGold),
    roleKey,
    userData: userData || null,
  };
};

const isMissionVisible = (mission, context) => {
  const audience = mission?.audience || {};
  if (Array.isArray(audience.roleKeys) && audience.roleKeys.length > 0) {
    if (!audience.roleKeys.includes(context.roleKey)) {
      return false;
    }
  }

  if (audience.requiresClub && !context.hasClub) return false;
  if (audience.requiresManagedClub && !context.hasManagedClub) return false;
  if (audience.requiresTeamAffiliation && !context.hasTeamAffiliation) return false;
  if (audience.requiresTrainingTeam && !context.hasTrainingTeam) return false;
  if (audience.requiresRequestsContext && !context.hasRequestsContext) return false;
  if (
    typeof audience.requiresRequestFilter === 'string'
    && !context.availableRequestFilters?.includes(audience.requiresRequestFilter)
  ) {
    return false;
  }
  if (audience.requiresLeagueMode && !context.isGold) return false;
  return true;
};

const isMissionUnlocked = (mission, completedMissionIds, visibleMissionIdSet) => (
  (mission?.prerequisiteMissionIds || []).every((missionId) => (
    !visibleMissionIdSet.has(missionId) || completedMissionIds.includes(missionId)
  ))
);

const isMissionAutoCompleted = (mission, state, context) => {
  if (!mission?.completionSignal) return false;

  if (mission.completionSignal.type === 'state') {
    const predicate = statePredicates[mission.completionSignal.key];
    return typeof predicate === 'function' ? Boolean(predicate(context, state)) : false;
  }

  return Boolean(getMissionSignalTimestamp(state, mission.completionSignal));
};

const resolveProgramIds = (context, config) => {
  const configuredOrder = Array.isArray(config?.overrides?.programOrder)
    ? config.overrides.programOrder
    : [];
  const baseOrder = configuredOrder.length
    ? configuredOrder
    : [GuidanceProgramIds.player, GuidanceProgramIds.coach, GuidanceProgramIds.president];

  const programIds = [];

  if (baseOrder.includes(context.roleKey)) {
    programIds.push(context.roleKey);
  } else {
    const fallbackProgramId = [GuidanceProgramIds.player, GuidanceProgramIds.coach, GuidanceProgramIds.president]
      .includes(context.roleKey)
      ? context.roleKey
      : GuidanceProgramIds.player;
    programIds.push(fallbackProgramId);
  }

  if (context.isGold) {
    programIds.push(GuidanceProgramIds.leagueIntro);
  }

  return Array.from(new Set(programIds));
};

export const prepareGuidanceState = ({
  config,
  context,
  state,
}) => {
  const normalizedConfig = normalizeGuidanceConfig(config);
  const programVersion = normalizedConfig.programVersion;
  let nextState = normalizeGuidanceState(state, programVersion);

  const validMissionIds = new Set(guidanceCatalog.missions.map((item) => item.id));
  const validPackIds = new Set(guidanceCatalog.packs.map((item) => item.id));

  if (nextState.programVersionSeen !== programVersion) {
    nextState = {
      ...nextState,
      completedMissionIds: nextState.completedMissionIds.filter((missionId) => validMissionIds.has(missionId)),
      completedPackIds: nextState.completedPackIds.filter((packId) => validPackIds.has(packId)),
      manuallyConfirmedMissionIds: nextState.manuallyConfirmedMissionIds.filter((missionId) => validMissionIds.has(missionId)),
      programVersionSeen: programVersion,
      programVersionSeenAt: new Date().toISOString(),
    };
  }

  const disabledMissionIds = new Set(normalizedConfig.overrides?.disabledMissionIds || []);
  const activeProgramIds = resolveProgramIds(context, normalizedConfig);
  const visibleMissions = guidanceCatalog.missions.filter((item) => (
    activeProgramIds.includes(item.programId)
    && !disabledMissionIds.has(item.id)
    && isMissionVisible(item, context)
  ));

  const autoCompletedMissionIds = visibleMissions
    .filter((item) => isMissionAutoCompleted(item, nextState, context))
    .map((item) => item.id);
  const completedMissionIds = Array.from(new Set([
    ...nextState.completedMissionIds,
    ...nextState.manuallyConfirmedMissionIds,
    ...autoCompletedMissionIds,
  ]));

  const completedPackIds = guidanceCatalog.packs
    .filter((pack) => activeProgramIds.includes(pack.programId))
    .filter((pack) => {
      const packMissionIds = visibleMissions
        .filter((mission) => mission.packId === pack.id)
        .map((mission) => mission.id);
      return packMissionIds.length > 0 && packMissionIds.every((missionId) => completedMissionIds.includes(missionId));
    })
    .map((pack) => pack.id);

  return {
    ...nextState,
    completedMissionIds,
    completedPackIds: Array.from(new Set([...nextState.completedPackIds, ...completedPackIds])),
  };
};

const resolveNavTarget = (navTarget, context) => {
  if (!navTarget || !navTarget.routeName) return null;
  if (typeof navTarget.params === 'function') {
    return {
      params: navTarget.params(context),
      routeName: navTarget.routeName,
    };
  }

  return {
    params: navTarget.params,
    routeName: navTarget.routeName,
  };
};

export const buildGuidanceSnapshot = ({
  config,
  context,
  state,
}) => {
  const normalizedConfig = normalizeGuidanceConfig(config);
  const safeContext = isNonEmptyObject(context)
    ? context
    : buildGuidanceAudienceContext({
      canEditClub: () => false,
      canManageTeam: false,
      isGold: false,
      userData: null,
    });
  const preparedState = prepareGuidanceState({
    config: normalizedConfig,
    context: safeContext,
    state: state || createEmptyGuidanceState(normalizedConfig.programVersion),
  });
  const activeProgramIds = resolveProgramIds(safeContext, normalizedConfig);
  const disabledMissionIds = new Set(normalizedConfig.overrides?.disabledMissionIds || []);
  const completedMissionIds = preparedState.completedMissionIds;

  const visibleMissions = guidanceCatalog.missions
    .filter((item) => activeProgramIds.includes(item.programId))
    .filter((item) => !disabledMissionIds.has(item.id))
    .filter((item) => isMissionVisible(item, safeContext))
    .sort((left, right) => left.priority - right.priority);
  const visibleMissionIdSet = new Set(visibleMissions.map((item) => item.id));

  const missions = visibleMissions.map((item) => {
    const isCompleted = completedMissionIds.includes(item.id)
      || preparedState.manuallyConfirmedMissionIds.includes(item.id)
      || isMissionAutoCompleted(item, preparedState, safeContext);
    const unlocked = isMissionUnlocked(item, completedMissionIds, visibleMissionIdSet);

    return {
      ...item,
      isCompleted,
      isLocked: !unlocked && !isCompleted,
      navTargetResolved: resolveNavTarget(item.navTarget, safeContext),
      tutorialTargetResolved: resolveNavTarget(item.tutorialTarget, safeContext),
    };
  });

  const packs = guidanceCatalog.packs
    .filter((pack) => activeProgramIds.includes(pack.programId))
    .map((pack) => {
      const packMissions = missions.filter((item) => item.packId === pack.id);
      const completedCount = packMissions.filter((item) => item.isCompleted).length;
      const unlocked = packMissions.some((item) => !item.isLocked) || completedCount > 0;
      return {
        ...pack,
        completedCount,
        isCompleted: packMissions.length > 0 && completedCount === packMissions.length,
        isLocked: !unlocked,
        missions: packMissions,
        totalCount: packMissions.length,
      };
    })
    .filter((pack) => pack.totalCount > 0);

  const programs = guidanceCatalog.programs
    .filter((program) => activeProgramIds.includes(program.id))
    .map((program) => {
      const programPacks = packs.filter((pack) => pack.programId === program.id);
      const completedCount = programPacks.reduce((sum, pack) => sum + pack.completedCount, 0);
      const totalCount = programPacks.reduce((sum, pack) => sum + pack.totalCount, 0);
      return {
        ...program,
        completedCount,
        packs: programPacks,
        totalCount,
      };
    });

  const nextMission = missions.find((item) => !item.isCompleted && !item.isLocked) || null;

  return {
    config: normalizedConfig,
    currentMission: nextMission,
    missions,
    packs,
    preparedState,
    programs,
    programSummary: programs[0]
      ? {
        completedCount: programs[0].completedCount,
        programId: programs[0].id,
        title: programs[0].title,
        totalCount: programs[0].totalCount,
      }
      : {
        completedCount: 0,
        programId: null,
        title: '',
        totalCount: 0,
      },
  };
};

export const hydrateGuidanceState = ({
  config,
  context,
  localState,
  remoteState,
}) => {
  const normalizedConfig = normalizeGuidanceConfig(config);
  const mergedState = mergeGuidanceState(
    remoteState || createEmptyGuidanceState(normalizedConfig.programVersion),
    localState || createEmptyGuidanceState(normalizedConfig.programVersion),
    normalizedConfig.programVersion,
  );

  const snapshot = buildGuidanceSnapshot({
    config: normalizedConfig,
    context,
    state: mergedState,
  });

  return snapshot.preparedState;
};
