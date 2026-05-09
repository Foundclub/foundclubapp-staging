/* eslint-disable max-len, no-console, jsdoc/require-description, jsdoc/require-returns, jsdoc/require-param-type */
// @ts-nocheck
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import useAuth from '@/domains/auth/useAuth';
import {
  buildGuidanceAudienceContext,
  buildGuidanceSnapshot,
  hydrateGuidanceState,
  prepareGuidanceState,
} from '@/domains/guidance/guidanceEngine';
import { subscribeToGuidanceSignals } from '@/domains/guidance/guidanceRuntime';
import {
  createEmptyGuidanceState,
  DEFAULT_GUIDANCE_CONFIG,
  normalizeGuidanceConfig,
  normalizeGuidanceState,
  serializeGuidanceState,
} from '@/domains/guidance/guidanceState';
import {
  clearStoredGuidanceState,
  persistGuidanceState,
  readStoredGuidanceState,
} from '@/domains/guidance/guidanceStorage';

import { navigate as navigateRoot } from '@/navigation/navigationService';
import { RouteNames } from '@/navigation/routeNames';

import { patchGuidanceState } from '@/services/guidance/guidanceService';

import { useAppMode } from '@/context/AppModeContext';

const GuidanceContext = createContext({
  activeCelebration: null,
  currentMission: null,
  dismissCelebration: () => {},
  dismissDock: () => {},
  guidanceConfig: DEFAULT_GUIDANCE_CONFIG,
  isHydrated: false,
  markMissionViewed: () => {},
  missionState: createEmptyGuidanceState(),
  openMission: () => false,
  openMissionCenter: () => false,
  openMissionDetail: () => false,
  programs: [],
  resetGuidanceProgress: () => {},
  snapshot: {
    currentMission: null,
    missions: [],
    packs: [],
    preparedState: createEmptyGuidanceState(),
    programs: [],
    programSummary: {
      completedCount: 0,
      programId: null,
      title: '',
      totalCount: 0,
    },
  },
});

const serializeState = (state, programVersion) => serializeGuidanceState(state, programVersion);

/**
 *
 * @param root0
 * @param root0.children
 */
export function GuidanceProvider({ children }) {
  const {
    appBootstrapData,
    canEditClub,
    canManageTeam,
    userData,
  } = useAuth();
  const { isGold } = useAppMode();
  const currentUserId = userData?.documentId || null;

  const [guidanceConfig, setGuidanceConfig] = useState(DEFAULT_GUIDANCE_CONFIG);
  const [missionState, setMissionState] = useState(() => createEmptyGuidanceState());
  const [activeCelebration, setActiveCelebration] = useState(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [needsSync, setNeedsSync] = useState(false);

  const lastSyncedSignatureRef = useRef('');
  const previousCompletedMissionIdsRef = useRef(null);
  const syncInFlightRef = useRef(false);
  const currentUserIdRef = useRef(currentUserId);

  const audienceContext = useMemo(() => buildGuidanceAudienceContext({
    canEditClub,
    canManageTeam,
    isGold,
    userData,
  }), [canEditClub, canManageTeam, isGold, userData]);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  const snapshot = useMemo(() => buildGuidanceSnapshot({
    config: guidanceConfig,
    context: audienceContext,
    state: missionState,
  }), [audienceContext, guidanceConfig, missionState]);

  const persistPreparedState = useCallback((nextState) => {
    if (!currentUserIdRef.current) return;
    persistGuidanceState(currentUserIdRef.current, nextState);
  }, []);

  const applyPreparedState = useCallback((candidateState, options = {}) => {
    const {
      markDirty = true,
      syncedSignature = null,
    } = options;
    /** @type {any} */
    let resolvedPreparedState = null;
    let shouldSync = false;

    setMissionState((previousState) => {
      const rawCandidateState = typeof candidateState === 'function'
        ? candidateState(previousState)
        : candidateState;
      const preparedState = prepareGuidanceState({
        config: guidanceConfig,
        context: audienceContext,
        state: rawCandidateState,
      });
      resolvedPreparedState = preparedState;
      const nextSignature = serializeState(preparedState, guidanceConfig.programVersion);
      const previousSignature = serializeState(previousState, guidanceConfig.programVersion);
      if (nextSignature === previousSignature) {
        if (typeof syncedSignature === 'string') {
          lastSyncedSignatureRef.current = syncedSignature;
          setNeedsSync(false);
        }
        return previousState;
      }

      persistPreparedState(preparedState);
      shouldSync = markDirty;
      return preparedState;
    });

    if (typeof syncedSignature === 'string') {
      lastSyncedSignatureRef.current = syncedSignature;
      setNeedsSync(false);
      return resolvedPreparedState;
    }

    if (shouldSync) {
      setNeedsSync(true);
    }

    return resolvedPreparedState;
  }, [audienceContext, guidanceConfig, persistPreparedState]);

  useEffect(() => {
    const normalizedConfig = normalizeGuidanceConfig(appBootstrapData?.guidanceConfig || DEFAULT_GUIDANCE_CONFIG);
    setGuidanceConfig(normalizedConfig);
  }, [appBootstrapData?.guidanceConfig]);

  useEffect(() => {
    if (!currentUserId) {
      setMissionState(createEmptyGuidanceState(guidanceConfig.programVersion));
      setActiveCelebration(null);
      setIsHydrated(false);
      setNeedsSync(false);
      lastSyncedSignatureRef.current = '';
      previousCompletedMissionIdsRef.current = null;
      return;
    }

    const localState = readStoredGuidanceState(currentUserId);
    const remoteState = normalizeGuidanceState(
      appBootstrapData?.guidanceState,
      guidanceConfig.programVersion,
    );
    const nextState = hydrateGuidanceState({
      config: guidanceConfig,
      context: audienceContext,
      localState,
      remoteState,
    });
    const remotePreparedState = prepareGuidanceState({
      config: guidanceConfig,
      context: audienceContext,
      state: remoteState,
    });
    const nextSignature = serializeState(nextState, guidanceConfig.programVersion);
    const remoteSignature = serializeState(remotePreparedState, guidanceConfig.programVersion);

    setMissionState(nextState);
    setActiveCelebration(null);
    persistGuidanceState(currentUserId, nextState);
    lastSyncedSignatureRef.current = remoteSignature;
    setNeedsSync(nextSignature !== remoteSignature);
    setIsHydrated(true);
    previousCompletedMissionIdsRef.current = nextState.completedMissionIds;
  }, [
    appBootstrapData?.guidanceState,
    audienceContext,
    currentUserId,
    guidanceConfig,
  ]);

  useEffect(() => {
    if (!isHydrated) return undefined;

    const unsubscribe = subscribeToGuidanceSignals((signal) => {
      if (!signal?.kind || !signal?.key) {
        return;
      }

      applyPreparedState((previousState) => {
        const nextState = normalizeGuidanceState(previousState, guidanceConfig.programVersion);
        if (signal.kind === 'route') {
          return {
            ...nextState,
            routeVisits: {
              ...nextState.routeVisits,
              [signal.key]: signal.occurredAt,
            },
            updatedAt: signal.occurredAt,
          };
        }

        if (signal.kind === 'interaction') {
          return {
            ...nextState,
            interactionSignals: {
              ...nextState.interactionSignals,
              [signal.key]: signal.occurredAt,
            },
            updatedAt: signal.occurredAt,
          };
        }

        return {
          ...nextState,
          actionSignals: {
            ...nextState.actionSignals,
            [signal.key]: signal.occurredAt,
          },
          updatedAt: signal.occurredAt,
        };
      });
    });

    return unsubscribe;
  }, [applyPreparedState, guidanceConfig.programVersion, isHydrated]);

  useEffect(() => {
    if (!currentUserId || !isHydrated || !needsSync || syncInFlightRef.current) {
      return undefined;
    }

    const timeoutId = setTimeout(async () => {
      if (syncInFlightRef.current) return;
      syncInFlightRef.current = true;
      try {
        const response = await patchGuidanceState(missionState);
        if (currentUserIdRef.current !== currentUserId) {
          return;
        }

        const responseConfig = normalizeGuidanceConfig(response?.guidanceConfig || guidanceConfig);
        setGuidanceConfig(responseConfig);
        const remoteState = normalizeGuidanceState(
          response?.guidanceState,
          responseConfig.programVersion,
        );
        const mergedState = hydrateGuidanceState({
          config: responseConfig,
          context: audienceContext,
          localState: missionState,
          remoteState,
        });
        const syncedSignature = serializeState(mergedState, responseConfig.programVersion);
        applyPreparedState(mergedState, {
          markDirty: false,
          syncedSignature,
        });
      } catch (error) {
        console.warn('[GuidanceContext] sync failed', error);
      } finally {
        syncInFlightRef.current = false;
      }
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [
    applyPreparedState,
    audienceContext,
    currentUserId,
    guidanceConfig,
    isHydrated,
    missionState,
    needsSync,
  ]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const completedMissionIds = snapshot.preparedState.completedMissionIds || [];
    const previousCompletedMissionIds = previousCompletedMissionIdsRef.current;

    if (!Array.isArray(previousCompletedMissionIds)) {
      previousCompletedMissionIdsRef.current = completedMissionIds;
      return;
    }

    const newlyCompletedMissionIds = completedMissionIds.filter((missionId) => !previousCompletedMissionIds.includes(missionId));
    previousCompletedMissionIdsRef.current = completedMissionIds;

    if (newlyCompletedMissionIds.length === 0) {
      return;
    }

    const missionsById = new Map(snapshot.missions.map((mission) => [mission.id, mission]));
    const newlyCompletedMission = snapshot.missions.find((mission) => newlyCompletedMissionIds.includes(mission.id))
      || missionsById.get(newlyCompletedMissionIds[0])
      || null;

    if (!newlyCompletedMission) {
      return;
    }

    const nextMission = snapshot.currentMission?.id && snapshot.currentMission.id !== newlyCompletedMission.id
      ? snapshot.currentMission
      : snapshot.missions.find((mission) => !mission.isCompleted && !mission.isLocked && mission.id !== newlyCompletedMission.id) || null;

    setActiveCelebration({
      completedMissionId: newlyCompletedMission.id,
      completedMissionTitle: newlyCompletedMission.title,
      id: `${newlyCompletedMission.id}:${Date.now()}`,
      nextMissionId: nextMission?.id || null,
      nextMissionTitle: nextMission?.title || null,
      occurredAt: new Date().toISOString(),
    });
  }, [
    isHydrated,
    snapshot.currentMission,
    snapshot.missions,
    snapshot.preparedState.completedMissionIds,
  ]);

  const markMissionViewed = useCallback((missionId) => {
    const viewedAt = new Date().toISOString();
    applyPreparedState((previousState) => ({
      ...normalizeGuidanceState(previousState, guidanceConfig.programVersion),
      lastViewedMissionAt: viewedAt,
      lastViewedMissionId: missionId,
      updatedAt: viewedAt,
    }));
  }, [applyPreparedState, guidanceConfig.programVersion]);

  const confirmMissionManually = useCallback((missionId) => {
    const confirmedAt = new Date().toISOString();
    applyPreparedState((previousState) => {
      const nextState = normalizeGuidanceState(previousState, guidanceConfig.programVersion);
      return {
        ...nextState,
        completedMissionIds: Array.from(new Set([missionId, ...nextState.completedMissionIds])),
        manuallyConfirmedMissionIds: Array.from(new Set([missionId, ...nextState.manuallyConfirmedMissionIds])),
        updatedAt: confirmedAt,
      };
    });
  }, [applyPreparedState, guidanceConfig.programVersion]);

  const dismissDock = useCallback((hours = 12) => {
    const now = new Date();
    const dismissedDockUntil = new Date(now.getTime() + (hours * 60 * 60 * 1000)).toISOString();
    applyPreparedState((previousState) => ({
      ...normalizeGuidanceState(previousState, guidanceConfig.programVersion),
      dismissedDockUntil,
      dismissedDockUpdatedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }));
  }, [applyPreparedState, guidanceConfig.programVersion]);

  const reopenDock = useCallback(() => {
    const now = new Date().toISOString();
    applyPreparedState((previousState) => ({
      ...normalizeGuidanceState(previousState, guidanceConfig.programVersion),
      dismissedDockUntil: null,
      dismissedDockUpdatedAt: now,
      updatedAt: now,
    }));
  }, [applyPreparedState, guidanceConfig.programVersion]);

  const dismissCelebration = useCallback(() => {
    setActiveCelebration(null);
  }, []);

  const openMission = useCallback((mission, options = {}) => {
    if (!mission?.navTargetResolved?.routeName) {
      return false;
    }

    const startTutorial = options.startTutorial === true;
    const { routeName } = mission.navTargetResolved;
    const routeParams = {
      ...(mission.navTargetResolved.params || {}),
    };

    if (startTutorial && mission?.tutorialTargetResolved?.tutorialId) {
      const tutorialParams = {
        startTutorial: true,
        tutorialId: mission.tutorialTargetResolved.tutorialId,
        tutorialSource: options.tutorialSource || 'manual',
        tutorialStartToken: `${mission.id}:${Date.now()}`,
      };

      if (routeParams.screen) {
        routeParams.params = {
          ...(routeParams.params || {}),
          ...tutorialParams,
        };
      } else {
        Object.assign(routeParams, tutorialParams);
      }
    }

    return navigateRoot(routeName, routeParams);
  }, []);

  const openMissionCenter = useCallback((params = {}) => navigateRoot(RouteNames.MissionCenter, params), []);

  const openMissionDetail = useCallback((missionId) => {
    if (!missionId) return false;
    markMissionViewed(missionId);
    return navigateRoot(RouteNames.MissionCenter, {
      focusMissionId: missionId,
      openDetail: true,
    });
  }, [markMissionViewed]);

  const resetGuidanceProgress = useCallback(() => {
    if (currentUserId) {
      clearStoredGuidanceState(currentUserId);
    }

    const now = new Date().toISOString();
    const resetState = {
      ...createEmptyGuidanceState(guidanceConfig.programVersion),
      programVersionSeen: guidanceConfig.programVersion,
      programVersionSeenAt: now,
      updatedAt: now,
    };

    applyPreparedState(resetState);
  }, [applyPreparedState, currentUserId, guidanceConfig.programVersion]);

  const value = useMemo(() => ({
    activeCelebration,
    confirmMissionManually,
    currentMission: snapshot.currentMission,
    dismissCelebration,
    dismissDock,
    guidanceConfig,
    isHydrated,
    markMissionViewed,
    missionState: snapshot.preparedState,
    openMission,
    openMissionCenter,
    openMissionDetail,
    programs: snapshot.programs,
    reopenDock,
    resetGuidanceProgress,
    snapshot,
  }), [
    activeCelebration,
    confirmMissionManually,
    dismissDock,
    dismissCelebration,
    guidanceConfig,
    isHydrated,
    markMissionViewed,
    openMission,
    openMissionCenter,
    openMissionDetail,
    reopenDock,
    resetGuidanceProgress,
    snapshot,
  ]);

  return (
    <GuidanceContext.Provider value={value}>
      {children}
    </GuidanceContext.Provider>
  );
}

export const useGuidance = () => useContext(GuidanceContext);
