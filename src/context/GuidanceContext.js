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
const serializeConfig = (config) => JSON.stringify(normalizeGuidanceConfig(config || DEFAULT_GUIDANCE_CONFIG));
const GUIDANCE_SIGNAL_DEDUPE_MS = {
  action: 3000,
  interaction: 10000,
  route: 30000,
};
const GUIDANCE_SYNC_DELAYS_MS = {
  action: 2500,
  interaction: 8000,
  route: 15000,
};

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
    entitlementsSummary,
    freeUsageSummary,
    subscriptionAccessLevel,
    userData,
  } = useAuth();
  const { isGold } = useAppMode();
  const currentUserId = userData?.documentId || null;

  const [guidanceConfig, setGuidanceConfig] = useState(DEFAULT_GUIDANCE_CONFIG);
  const [missionState, setMissionState] = useState(() => createEmptyGuidanceState());
  const [activeCelebration, setActiveCelebration] = useState(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [needsSync, setNeedsSync] = useState(false);
  const [syncDelayMs, setSyncDelayMs] = useState(GUIDANCE_SYNC_DELAYS_MS.action);

  const guidanceConfigRef = useRef(DEFAULT_GUIDANCE_CONFIG);
  const guidanceConfigSignatureRef = useRef(serializeConfig(DEFAULT_GUIDANCE_CONFIG));
  const lastSyncedSignatureRef = useRef('');
  const missionStateRef = useRef(missionState);
  const previousCompletedMissionIdsRef = useRef(null);
  const remoteSyncDisabledRef = useRef(false);
  const syncInFlightRef = useRef(false);
  const syncWarningKeyRef = useRef('');
  const currentUserIdRef = useRef(currentUserId);
  const nextSyncModeRef = useRef('merge');

  const audienceContext = useMemo(() => buildGuidanceAudienceContext({
    canEditClub,
    canManageTeam,
    entitlementsSummary,
    freeUsageSummary,
    isGold,
    subscriptionAccessLevel,
    userData,
  }), [
    canEditClub,
    canManageTeam,
    entitlementsSummary,
    freeUsageSummary,
    isGold,
    subscriptionAccessLevel,
    userData,
  ]);

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

  const updateGuidanceConfig = useCallback((nextConfig) => {
    const normalizedConfig = normalizeGuidanceConfig(nextConfig || DEFAULT_GUIDANCE_CONFIG);
    const nextSignature = serializeConfig(normalizedConfig);
    guidanceConfigRef.current = normalizedConfig;
    if (guidanceConfigSignatureRef.current === nextSignature) {
      return normalizedConfig;
    }

    guidanceConfigSignatureRef.current = nextSignature;
    setGuidanceConfig(normalizedConfig);
    return normalizedConfig;
  }, []);

  const applyPreparedState = useCallback((candidateState, options = {}) => {
    const {
      markDirty = true,
      syncDelayMs: nextSyncDelayMs = GUIDANCE_SYNC_DELAYS_MS.action,
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
        missionStateRef.current = previousState;
        return previousState;
      }

      persistPreparedState(preparedState);
      missionStateRef.current = preparedState;
      shouldSync = markDirty;
      return preparedState;
    });

    if (typeof syncedSignature === 'string') {
      lastSyncedSignatureRef.current = syncedSignature;
      setNeedsSync(false);
      return resolvedPreparedState;
    }

    if (shouldSync) {
      setSyncDelayMs((previousDelayMs) => Math.min(previousDelayMs || nextSyncDelayMs, nextSyncDelayMs));
      setNeedsSync(true);
    }

    return resolvedPreparedState;
  }, [audienceContext, guidanceConfig, persistPreparedState]);

  useEffect(() => {
    updateGuidanceConfig(appBootstrapData?.guidanceConfig || DEFAULT_GUIDANCE_CONFIG);
  }, [appBootstrapData?.guidanceConfig, updateGuidanceConfig]);

  useEffect(() => {
    if (!currentUserId) {
      setMissionState(createEmptyGuidanceState(guidanceConfig.programVersion));
      setActiveCelebration(null);
      setIsHydrated(false);
      setNeedsSync(false);
      setSyncDelayMs(GUIDANCE_SYNC_DELAYS_MS.action);
      lastSyncedSignatureRef.current = '';
      previousCompletedMissionIdsRef.current = null;
      remoteSyncDisabledRef.current = false;
      syncWarningKeyRef.current = '';
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
    missionStateRef.current = nextState;
    lastSyncedSignatureRef.current = remoteSignature;
    remoteSyncDisabledRef.current = false;
    syncWarningKeyRef.current = '';
    setNeedsSync(nextSignature !== remoteSignature);
    setSyncDelayMs(GUIDANCE_SYNC_DELAYS_MS.action);
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

      const nextState = normalizeGuidanceState(
        missionStateRef.current,
        guidanceConfigRef.current.programVersion,
      );
      let existingTimestamp = nextState.actionSignals?.[signal.key];
      if (signal.kind === 'route') {
        existingTimestamp = nextState.routeVisits?.[signal.key];
      } else if (signal.kind === 'interaction') {
        existingTimestamp = nextState.interactionSignals?.[signal.key];
      }
      const dedupeWindowMs = GUIDANCE_SIGNAL_DEDUPE_MS[signal.kind] || 0;
      if (existingTimestamp && dedupeWindowMs > 0) {
        const elapsedMs = Math.abs(
          new Date(signal.occurredAt).getTime() - new Date(existingTimestamp).getTime(),
        );
        if (Number.isFinite(elapsedMs) && elapsedMs < dedupeWindowMs) {
          return;
        }
      }

      const nextSyncDelayMs = GUIDANCE_SYNC_DELAYS_MS[signal.kind] || GUIDANCE_SYNC_DELAYS_MS.action;

      applyPreparedState((previousState) => {
        const normalizedState = normalizeGuidanceState(
          previousState,
          guidanceConfigRef.current.programVersion,
        );
        if (signal.kind === 'route') {
          return {
            ...normalizedState,
            routeVisits: {
              ...normalizedState.routeVisits,
              [signal.key]: signal.occurredAt,
            },
            updatedAt: signal.occurredAt,
          };
        }

        if (signal.kind === 'interaction') {
          return {
            ...normalizedState,
            interactionSignals: {
              ...normalizedState.interactionSignals,
              [signal.key]: signal.occurredAt,
            },
            updatedAt: signal.occurredAt,
          };
        }

        return {
          ...normalizedState,
          actionSignals: {
            ...normalizedState.actionSignals,
            [signal.key]: signal.occurredAt,
          },
          updatedAt: signal.occurredAt,
        };
      }, { syncDelayMs: nextSyncDelayMs });
    });

    return unsubscribe;
  }, [applyPreparedState, isHydrated]);

  useEffect(() => {
    if (
      !currentUserId
      || !isHydrated
      || !needsSync
      || syncInFlightRef.current
      || remoteSyncDisabledRef.current
    ) {
      return undefined;
    }

    const timeoutId = setTimeout(async () => {
      if (syncInFlightRef.current) return;
      syncInFlightRef.current = true;
      try {
        const replace = nextSyncModeRef.current === 'replace';
        const stateToSync = missionStateRef.current;
        const currentSignature = serializeState(
          stateToSync,
          guidanceConfigRef.current.programVersion,
        );
        if (!replace && currentSignature === lastSyncedSignatureRef.current) {
          setNeedsSync(false);
          return;
        }
        const response = await patchGuidanceState(stateToSync, { replace });
        if (currentUserIdRef.current !== currentUserId) {
          return;
        }

        const responseConfig = updateGuidanceConfig(response?.guidanceConfig || guidanceConfigRef.current);
        const remoteState = normalizeGuidanceState(
          response?.guidanceState,
          responseConfig.programVersion,
        );
        const nextState = replace
          ? prepareGuidanceState({
            config: responseConfig,
            context: audienceContext,
            state: remoteState,
          })
          : hydrateGuidanceState({
            config: responseConfig,
            context: audienceContext,
            localState: stateToSync,
            remoteState,
          });
        const syncedSignature = serializeState(nextState, responseConfig.programVersion);
        remoteSyncDisabledRef.current = false;
        syncWarningKeyRef.current = '';
        nextSyncModeRef.current = 'merge';
        missionStateRef.current = nextState;
        applyPreparedState(nextState, {
          markDirty: false,
          syncedSignature,
        });
      } catch (error) {
        const status = Number(error?.status || error?.response?.status || 0);
        const errorName = String(error?.name || '');
        const isPermissionError = status === 401
          || status === 403
          || errorName === 'ForbiddenError'
          || errorName === 'UnauthorizedError';

        if (isPermissionError) {
          remoteSyncDisabledRef.current = true;
          setNeedsSync(false);
          if (syncWarningKeyRef.current !== 'guidance-sync-disabled') {
            syncWarningKeyRef.current = 'guidance-sync-disabled';
            console.info('[GuidanceContext] remote sync disabled for this session', {
              message: error?.message || 'Permission denied',
              name: errorName || null,
              status: status || null,
            });
          }
        } else if (syncWarningKeyRef.current !== `${status}:${error?.message || errorName}`) {
          syncWarningKeyRef.current = `${status}:${error?.message || errorName}`;
          console.warn('[GuidanceContext] sync failed', error);
        }
      } finally {
        syncInFlightRef.current = false;
      }
    }, Math.max(800, syncDelayMs));

    return () => clearTimeout(timeoutId);
  }, [
    applyPreparedState,
    audienceContext,
    currentUserId,
    guidanceConfig,
    isHydrated,
    missionState,
    needsSync,
    syncDelayMs,
    updateGuidanceConfig,
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

    nextSyncModeRef.current = 'replace';
    previousCompletedMissionIdsRef.current = [];
    setActiveCelebration(null);
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
