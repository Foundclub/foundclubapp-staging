import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { getTutorialFlowId } from './tutorialIds';
import {
  CURRENT_TUTORIAL_PROGRAM_VERSION,
  getEntryGateChoice,
  getTutorialProgramVersion,
  getTutorialState,
  hasSeenHomeHubTutorial,
  isAutoTutorialEnabled,
  markTutorialCompleted,
  markTutorialSeen,
  resetAllTutorialsForUser,
  resetTutorialState,
  setAutoTutorialEnabled,
  setEntryGateChoice,
  setHomeHubTutorialSeen,
  setTutorialProgramVersion,
  skipAllAutoTutorials,
} from './tutorialStorage';

const programVersionHandledUsers = new Set();

/**
 * @param {{
 *  tutorialId: string;
 *  userId?: string;
 *  routeParams?: Record<string, unknown>;
 *  autoStart?: boolean;
 }} params
 */
function useFeatureTutorial({
  autoStart = true,
  routeParams,
  tutorialId,
  userId,
}) {
  const [, setRefreshTick] = useState(0);

  const flowId = useMemo(
    () => getTutorialFlowId(tutorialId, userId),
    [tutorialId, userId],
  );

  const tutorialState = getTutorialState(userId, tutorialId);
  const entryGateChoice = getEntryGateChoice(userId);
  const autoTutorialEnabled = isAutoTutorialEnabled(userId);

  const seenAt = tutorialState?.seenAt;
  const completedAt = tutorialState?.completedAt;
  const source = tutorialState?.source;

  const startRequested = Boolean(routeParams?.startTutorial);
  const tutorialStartToken = routeParams?.tutorialStartToken;
  const tutorialSource = /** @type {'auto' | 'manual' | 'homeHub'} */ (
    routeParams?.tutorialSource || 'auto'
  );
  const requestedTutorialId = typeof routeParams?.tutorialId === 'string'
    ? routeParams.tutorialId
    : undefined;
  const shouldForceStart = Boolean(userId) && startRequested
    && (!requestedTutorialId || requestedTutorialId === tutorialId);
  const forceStartKey = shouldForceStart
    ? `${requestedTutorialId || tutorialId}:${String(tutorialStartToken || 'legacy')}`
    : '';
  const shouldAutoStart = Boolean(
    autoStart
    && userId
    && !seenAt
    && !shouldForceStart
    && autoTutorialEnabled
    && entryGateChoice !== 'pending',
  );

  useEffect(() => {
    if (!userId) return;
    if (programVersionHandledUsers.has(userId)) return;

    const version = getTutorialProgramVersion(userId);
    if (version < CURRENT_TUTORIAL_PROGRAM_VERSION) {
      resetAllTutorialsForUser(userId);
      setTutorialProgramVersion(userId, CURRENT_TUTORIAL_PROGRAM_VERSION);
      setRefreshTick((value) => value + 1);
    }

    programVersionHandledUsers.add(userId);
  }, [userId]);

  const notifyUpdated = useCallback(() => {
    setRefreshTick((value) => value + 1);
  }, []);

  const markSeen = useCallback((nextSource = tutorialSource) => {
    if (!userId) return;
    markTutorialSeen(userId, tutorialId, nextSource);
    if (tutorialId === 'home_hub') {
      setHomeHubTutorialSeen(userId, true);
    }
    notifyUpdated();
  }, [notifyUpdated, tutorialId, tutorialSource, userId]);

  const markCompleted = useCallback((nextSource = tutorialSource) => {
    if (!userId) return;
    markTutorialCompleted(userId, tutorialId, nextSource);
    if (tutorialId === 'home_hub') {
      setHomeHubTutorialSeen(userId, true);
    }
    notifyUpdated();
  }, [notifyUpdated, tutorialId, tutorialSource, userId]);

  const resetTutorial = useCallback(() => {
    if (!userId) return;
    resetTutorialState(userId, tutorialId);
    if (tutorialId === 'home_hub') {
      setHomeHubTutorialSeen(userId, false);
    }
    notifyUpdated();
  }, [notifyUpdated, tutorialId, userId]);

  const resetAllTutorials = useCallback(() => {
    if (!userId) return 0;
    const deletedCount = resetAllTutorialsForUser(userId);
    notifyUpdated();
    return deletedCount;
  }, [notifyUpdated, userId]);

  const setEntryChoice = useCallback((choice) => {
    if (!userId) return;
    setEntryGateChoice(userId, choice);
    notifyUpdated();
  }, [notifyUpdated, userId]);

  const setAutoEnabled = useCallback((enabled) => {
    if (!userId) return;
    setAutoTutorialEnabled(userId, enabled);
    notifyUpdated();
  }, [notifyUpdated, userId]);

  const skipAllAuto = useCallback(() => {
    if (!userId) return;
    skipAllAutoTutorials(userId);
    notifyUpdated();
  }, [notifyUpdated, userId]);

  return {
    autoTutorialEnabled,
    completedAt,
    entryGateChoice,
    flowId,
    forceStartKey,
    hasSeen: Boolean(seenAt),
    hasSeenHomeHub: hasSeenHomeHubTutorial(userId),
    markCompleted,
    markSeen,
    requestedTutorialId,
    resetAllTutorials,
    resetTutorial,
    seenAt,
    setAutoEnabled,
    setEntryChoice,
    shouldAutoStart,
    shouldForceStart,
    skipAllAuto,
    source,
    tutorialSource,
  };
}

export default useFeatureTutorial;
