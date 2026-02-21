import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { getTutorialFlowId } from './tutorialIds';
import {
  CURRENT_TUTORIAL_PROGRAM_VERSION,
  getTutorialProgramVersion,
  getTutorialState,
  hasSeenHomeHubTutorial,
  markTutorialCompleted,
  markTutorialSeen,
  resetAllTutorialsForUser,
  resetTutorialState,
  setHomeHubTutorialSeen,
  setTutorialProgramVersion,
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
  const shouldAutoStart = Boolean(autoStart && userId && !seenAt && !shouldForceStart);

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

  return {
    completedAt,
    flowId,
    hasSeen: Boolean(seenAt),
    hasSeenHomeHub: hasSeenHomeHubTutorial(userId),
    markCompleted,
    markSeen,
    requestedTutorialId,
    resetAllTutorials,
    resetTutorial,
    seenAt,
    shouldAutoStart,
    shouldForceStart,
    forceStartKey,
    source,
    tutorialSource,
  };
}

export default useFeatureTutorial;
