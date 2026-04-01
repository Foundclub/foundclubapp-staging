import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { MMKV } from 'react-native-mmkv';

import { setTutorialDebugState, tutorialDebugLog } from '@/utils/logger/tutorialDebug';

const defaultOnboardingContextValue = {
  canGoBack: false,
  currentStep: undefined,
  currentStepLayout: null,
  currentStepIndex: 0,
  getStepById: () => undefined,
  isActive: false,
  isStepReady: false,
  isTransitioning: false,
  nextStep: () => {},
  previousStep: () => {},
  refreshCurrentStep: () => {},
  registerStep: () => {},
  skipOnboarding: () => {},
  startOnboarding: () => {},
  totalSteps: 0,
  unregisterStep: () => {},
};

const OnboardingContext = createContext(defaultOnboardingContextValue);
const inMemoryStorageMap = new Map();
const fallbackStorage = {
  getString: (key) => {
    const value = inMemoryStorageMap.get(key);
    return typeof value === 'string' ? value : undefined;
  },
  set: (key, value) => inMemoryStorageMap.set(key, value),
};

let storageInstance = null;
const getOnboardingStorage = () => {
  if (storageInstance) return storageInstance;
  try {
    storageInstance = new MMKV();
  } catch (error) {
    console.warn('[OnboardingContext] MMKV unavailable, using in-memory fallback storage.', error);
    storageInstance = fallbackStorage;
  }
  return storageInstance;
};

const storage = {
  getString: (key) => getOnboardingStorage().getString(key),
  set: (key, value) => getOnboardingStorage().set(key, value),
};
const ONBOARDING_PROGRESS_PREFIX = 'onboarding-progress-v1';

const getCompletedStepsKey = (flowId) => `${ONBOARDING_PROGRESS_PREFIX}:${flowId}:completed`;

const parseCompletedSteps = (rawValue) => {
  if (!rawValue || typeof rawValue !== 'string') return [];
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id) => typeof id === 'string' && id.trim().length > 0);
  } catch (_error) {
    return [];
  }
};

const mergeStepIds = (existingStepIds, incomingStepIds) => {
  const merged = new Set(existingStepIds || []);
  (incomingStepIds || []).forEach((id) => {
    if (typeof id === 'string' && id.trim().length > 0) {
      merged.add(id);
    }
  });
  return Array.from(merged);
};

const isNearlyEqual = (left, right) => {
  const a = typeof left === 'number' && Number.isFinite(left) ? left : 0;
  const b = typeof right === 'number' && Number.isFinite(right) ? right : 0;
  return Math.abs(a - b) < 2;
};

const isSameLayout = (left, right) => (
  isNearlyEqual(left?.x, right?.x)
  && isNearlyEqual(left?.y, right?.y)
  && isNearlyEqual(left?.width, right?.width)
  && isNearlyEqual(left?.height, right?.height)
);

const isSameSpotlight = (left, right) => (
  (left?.paddingX ?? undefined) === (right?.paddingX ?? undefined)
  && (left?.paddingY ?? undefined) === (right?.paddingY ?? undefined)
  && (left?.borderRadius ?? undefined) === (right?.borderRadius ?? undefined)
  && (left?.maxHeight ?? undefined) === (right?.maxHeight ?? undefined)
  && (left?.maxWidth ?? undefined) === (right?.maxWidth ?? undefined)
  && (left?.minHeight ?? undefined) === (right?.minHeight ?? undefined)
  && (left?.minWidth ?? undefined) === (right?.minWidth ?? undefined)
  && (left?.offsetX ?? undefined) === (right?.offsetX ?? undefined)
  && (left?.offsetY ?? undefined) === (right?.offsetY ?? undefined)
  && (left?.overlayOpacity ?? undefined) === (right?.overlayOpacity ?? undefined)
);

/**
 *
 * @param root0
 * @param root0.children
 * @param root0.flowId
 */
export function OnboardingProvider({ children, flowId = 'default' }) {
  const [steps, setSteps] = useState({});
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [currentStepLayout, setCurrentStepLayout] = useState(null);
  const [isStepReady, setIsStepReady] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const registrationCounterRef = useRef(0);
  const nextStepTimerRef = useRef(0);
  const isAdvancingRef = useRef(false);
  const activeMeasureRequestRef = useRef(0);
  const prefetchedStepLayoutRef = useRef(null);
  const registerStatsRef = useRef({
    count: 0,
    lastWarnAt: 0,
    windowStart: 0,
  });
  const [completedStepIds, setCompletedStepIds] = useState(() => (
    parseCompletedSteps(storage.getString(getCompletedStepsKey(flowId)))
  ));

  const orderedSteps = useMemo(() => Object.values(steps).sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return (a.registrationIndex || 0) - (b.registrationIndex || 0);
  }), [steps]);

  useEffect(() => {
    setSteps({});
    setCurrentStepIndex(0);
    setIsActive(false);
    setCurrentStepLayout(null);
    setIsStepReady(false);
    setIsTransitioning(false);
    registrationCounterRef.current = 0;
    activeMeasureRequestRef.current = 0;
    prefetchedStepLayoutRef.current = null;
    isAdvancingRef.current = false;
    if (nextStepTimerRef.current) {
      clearTimeout(nextStepTimerRef.current);
      nextStepTimerRef.current = 0;
    }
    setCompletedStepIds(parseCompletedSteps(storage.getString(getCompletedStepsKey(flowId))));
  }, [flowId]);

  useEffect(() => () => {
    if (nextStepTimerRef.current) {
      clearTimeout(nextStepTimerRef.current);
      nextStepTimerRef.current = 0;
    }
    prefetchedStepLayoutRef.current = null;
    isAdvancingRef.current = false;
  }, []);

  useEffect(() => {
    if (!__DEV__) return;
    const orderUsage = new Map();
    orderedSteps.forEach((step) => {
      const used = orderUsage.get(step.order) || [];
      used.push(step.id);
      orderUsage.set(step.order, used);
    });

    const duplicates = Array.from(orderUsage.entries()).filter(([, ids]) => ids.length > 1);
    if (!duplicates.length) return;

    const details = duplicates
      .map(([order, ids]) => `order=${order} ids=[${ids.join(', ')}]`)
      .join(' | ');
    console.warn(`[OnboardingProvider] Duplicate step orders détectéd in flow "${flowId}": ${details}`);
  }, [flowId, orderedSteps]);

  const persistCompletedSteps = useCallback((nextCompletedStepIds) => {
    storage.set(getCompletedStepsKey(flowId), JSON.stringify(nextCompletedStepIds));
  }, [flowId]);

  const registerStep = useCallback((
    id,
    layout,
    order,
    title,
    description,
    spotlight = undefined,
    onNext = undefined,
    measure = undefined,
    getTargetNode = undefined,
    navigationMeta = undefined,
  ) => {
    const now = Date.now();
    const stats = registerStatsRef.current;
    if (!stats.windowStart || now - stats.windowStart > 1000) {
      stats.windowStart = now;
      stats.count = 0;
    }
    stats.count += 1;
    const shouldCircuitBreak = stats.count > 120;
    if (shouldCircuitBreak && now - stats.lastWarnAt > 1000) {
      stats.lastWarnAt = now;
      tutorialDebugLog('registerStep circuit-breaker', {
        countPerSec: stats.count,
        flowId,
        id,
      });
    }

    if (shouldCircuitBreak) {
      return;
    }

    setSteps((prev) => {
      const previousStep = prev[id];
      const nextStep = {
        description,
        id,
        layout,
        measure,
        nextAction: navigationMeta?.nextAction,
        nextLabel: navigationMeta?.nextLabel,
        nextTargetStepId: navigationMeta?.nextTargetStepId,
        onNext,
        order,
        registrationIndex: previousStep?.registrationIndex ?? (registrationCounterRef.current += 1),
        spotlight,
        title,
        getTargetNode,
      };
      if (
        previousStep
        && previousStep.id === nextStep.id
        && previousStep.order === nextStep.order
        && previousStep.title === nextStep.title
        && previousStep.description === nextStep.description
        && previousStep.nextAction === nextStep.nextAction
        && previousStep.nextLabel === nextStep.nextLabel
        && previousStep.nextTargetStepId === nextStep.nextTargetStepId
        && previousStep.measure === nextStep.measure
        && previousStep.getTargetNode === nextStep.getTargetNode
        && isSameLayout(previousStep.layout, nextStep.layout)
        && isSameSpotlight(previousStep.spotlight, nextStep.spotlight)
      ) {
        return prev;
      }

      return {
        ...prev,
        [id]: nextStep,
      };
    });

    if (stats.count === 1 || stats.count % 25 === 0) {
      tutorialDebugLog('registerStep', {
        countPerSec: stats.count,
        flowId,
        id,
        order,
      });
    }
  }, []);

  const getStepById = useCallback((id) => steps[id], [steps]);

  const resolveStepLayout = useCallback(async (step, reason = 'resolve') => {
    if (!step) return null;

    let nextLayout = step.layout || null;

    if (typeof step.measure === 'function') {
      try {
        nextLayout = await Promise.resolve(step.measure());
      } catch (error) {
        tutorialDebugLog('resolveStepLayout.error', {
          error: error instanceof Error ? error.message : String(error),
          flowId,
          reason,
          stepId: step.id,
        });
      }
    }

    if (!nextLayout?.width || !nextLayout?.height) {
      return null;
    }

    return {
      height: Math.round(nextLayout.height),
      width: Math.round(nextLayout.width),
      x: Math.round(nextLayout.x),
      y: Math.round(nextLayout.y),
    };
  }, [flowId]);

  const unregisterStep = useCallback((id) => {
    setSteps((prev) => {
      if (!Object.prototype.hasOwnProperty.call(prev, id)) {
        return prev;
      }
      const newSteps = { ...prev };
      delete newSteps[id];
      return newSteps;
    });
  }, []);

  const startOnboarding = useCallback((options = {}) => {
    const forceFromStart = Boolean(options?.forceFromStart);
    if (isActive || orderedSteps.length === 0) return;
    if (forceFromStart) {
      setCompletedStepIds([]);
      persistCompletedSteps([]);
    }
    const completedSet = forceFromStart ? new Set() : new Set(completedStepIds);
    const firstPendingIndex = orderedSteps.findIndex((step) => !completedSet.has(step.id));

    if (firstPendingIndex === -1) {
      setIsActive(false);
      return false;
    }

    setCurrentStepIndex(firstPendingIndex);
    setCurrentStepLayout(null);
    setIsStepReady(false);
    setIsTransitioning(true);
    setIsActive(true);
    tutorialDebugLog('startOnboarding', {
      firstPendingIndex,
      flowId,
      forceFromStart,
      totalSteps: orderedSteps.length,
    });
    return true;
  }, [completedStepIds, isActive, orderedSteps, persistCompletedSteps]);

  const stopOnboarding = useCallback(() => {
    if (nextStepTimerRef.current) {
      clearTimeout(nextStepTimerRef.current);
      nextStepTimerRef.current = 0;
    }
    isAdvancingRef.current = false;
    activeMeasureRequestRef.current += 1;
    prefetchedStepLayoutRef.current = null;
    setCurrentStepLayout(null);
    setIsStepReady(false);
    setIsTransitioning(false);
    setTutorialDebugState({
      currentStepId: null,
      currentStepIndex: 0,
      currentStepLayout: null,
      isStepReady: false,
      isTransitioning: false,
      lastAdvanceFromStepId: null,
      lastAdvancePhase: null,
      lastAdvanceToStepId: null,
      lastFailureReason: null,
      lastResolvedStepId: null,
      lastResolvedTargetId: null,
    });
    setIsActive(false);
  }, []);

  const nextStep = useCallback(() => {
    if (isAdvancingRef.current) {
      return;
    }

    if (!orderedSteps.length) {
      stopOnboarding();
      return;
    }

    const currentStep = orderedSteps[currentStepIndex];
    const finalizeStepProgression = (prefetchedLayout = null) => {
      const mergedCompletedStepIds = mergeStepIds(completedStepIds, [currentStep?.id]);
      const completedSet = new Set(mergedCompletedStepIds);

      setCompletedStepIds(mergedCompletedStepIds);
      persistCompletedSteps(mergedCompletedStepIds);

      const nextPendingIndex = orderedSteps.findIndex(
        (step, index) => index > currentStepIndex && !completedSet.has(step.id),
      );
      const isLastPending = nextPendingIndex === -1;

      if (isLastPending) {
        setTutorialDebugState({
          lastAdvanceFromStepId: currentStep?.id || null,
          lastAdvancePhase: 'finish-flow',
          lastAdvanceToStepId: null,
        });
        stopOnboarding();
      } else {
        const nextStep = orderedSteps[nextPendingIndex];
        setTutorialDebugState({
          lastAdvanceFromStepId: currentStep?.id || null,
          lastAdvancePhase: 'finalize',
          lastAdvanceToStepId: nextStep?.id || null,
        });
        prefetchedStepLayoutRef.current = (
          prefetchedLayout
          && nextStep?.id
          && currentStep?.nextTargetStepId === nextStep.id
        )
          ? {
            layout: prefetchedLayout,
            stepId: nextStep.id,
          }
          : null;
        setCurrentStepLayout(null);
        setIsStepReady(false);
        setIsTransitioning(true);
        setCurrentStepIndex(nextPendingIndex);
      }

      tutorialDebugLog('nextStep', {
        currentStepId: currentStep?.id,
        currentStepIndex,
        flowId,
        isLastPending,
        nextPendingIndex,
      });

      isAdvancingRef.current = false;
      nextStepTimerRef.current = 0;
    };

    let onNextResult;
    setTutorialDebugState({
      lastAdvanceFromStepId: currentStep?.id || null,
      lastAdvancePhase: 'start',
      lastAdvanceToStepId: currentStep?.nextTargetStepId || null,
    });
    if (typeof currentStep?.onNext === 'function') {
      try {
        onNextResult = currentStep.onNext();
      } catch (_error) {
        // Keep onboarding progression robust even if a side effect fails.
      }
    }

    if (onNextResult && typeof onNextResult.then === 'function') {
      isAdvancingRef.current = true;
      setCurrentStepLayout(null);
      setIsStepReady(false);
      setIsTransitioning(true);
      setTutorialDebugState({
        lastAdvanceFromStepId: currentStep?.id || null,
        lastAdvancePhase: 'await-onNext',
        lastAdvanceToStepId: currentStep?.nextTargetStepId || null,
      });
      Promise.resolve(onNextResult)
        .then((result) => {
          finalizeStepProgression(result || null);
        })
        .catch(() => {
          setTutorialDebugState({
            lastAdvanceFromStepId: currentStep?.id || null,
            lastAdvancePhase: 'onNext-error',
            lastAdvanceToStepId: currentStep?.nextTargetStepId || null,
          });
          finalizeStepProgression();
        });
      return;
    }

    if (currentStep?.nextAction === 'scrollDown') {
      isAdvancingRef.current = true;
      setCurrentStepLayout(null);
      setIsStepReady(false);
      setIsTransitioning(true);
      setTutorialDebugState({
        lastAdvanceFromStepId: currentStep?.id || null,
        lastAdvancePhase: 'scroll-fallback-timer',
        lastAdvanceToStepId: currentStep?.nextTargetStepId || null,
      });
      nextStepTimerRef.current = setTimeout(finalizeStepProgression, 120);
      return;
    }

    finalizeStepProgression();
  }, [
    completedStepIds,
    currentStepIndex,
    orderedSteps,
    persistCompletedSteps,
    stopOnboarding,
  ]);

  const previousStep = useCallback(() => {
    setCurrentStepLayout(null);
    setIsStepReady(false);
    setIsTransitioning(true);
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
    tutorialDebugLog('previousStep', { flowId });
  }, []);

  const refreshCurrentStep = useCallback(() => {
    const activeStep = orderedSteps[currentStepIndex];
    tutorialDebugLog('refreshCurrentStep', {
      activeStepId: activeStep?.id,
      currentStepIndex,
      flowId,
    });
    activeMeasureRequestRef.current += 1;
    const requestId = activeMeasureRequestRef.current;
    return resolveStepLayout(activeStep, 'refresh').then((nextLayout) => {
      if (requestId !== activeMeasureRequestRef.current) {
        return null;
      }

      setCurrentStepLayout(nextLayout);
      setIsStepReady(Boolean(nextLayout));
      setIsTransitioning(false);
      setTutorialDebugState({
        currentStepId: activeStep?.id || null,
        currentStepIndex,
        currentStepLayout: nextLayout,
        isStepReady: Boolean(nextLayout),
        isTransitioning: false,
        lastFailureReason: nextLayout ? null : 'refresh-measure-failed',
        lastResolvedStepId: activeStep?.id || null,
        lastResolvedTargetId: activeStep?.nextTargetStepId || null,
      });
      return nextLayout;
    });
  }, [currentStepIndex, flowId, orderedSteps, resolveStepLayout]);

  const skipOnboarding = useCallback(() => {
    const allStepIds = orderedSteps.map((step) => step.id);
    const mergedCompletedStepIds = mergeStepIds(completedStepIds, allStepIds);

    setCompletedStepIds(mergedCompletedStepIds);
    persistCompletedSteps(mergedCompletedStepIds);
    stopOnboarding();
  }, [completedStepIds, orderedSteps, persistCompletedSteps, stopOnboarding]);

  const activeStep = orderedSteps[currentStepIndex];
  const activeStepLayoutKey = [
    activeStep?.id || '',
    activeStep?.layout?.x ?? '',
    activeStep?.layout?.y ?? '',
    activeStep?.layout?.width ?? '',
    activeStep?.layout?.height ?? '',
  ].join('|');

  useEffect(() => {
    if (!isActive || !activeStep) {
      return undefined;
    }

    let cancelled = false;
    const requestId = activeMeasureRequestRef.current + 1;
    activeMeasureRequestRef.current = requestId;
    const prefetchedLayout = prefetchedStepLayoutRef.current?.stepId === activeStep.id
      ? prefetchedStepLayoutRef.current.layout
      : null;

    setIsTransitioning(true);
    setIsStepReady(false);
    setTutorialDebugState({
      currentStepId: activeStep.id,
      currentStepIndex,
      currentStepLayout: null,
      isStepReady: false,
      isTransitioning: true,
      lastFailureReason: null,
      lastResolvedStepId: null,
      lastResolvedTargetId: activeStep.nextTargetStepId || null,
    });

    if (prefetchedLayout) {
      prefetchedStepLayoutRef.current = null;
      setCurrentStepLayout(prefetchedLayout);
      setIsStepReady(true);
      setIsTransitioning(false);
      setTutorialDebugState({
        currentStepId: activeStep.id,
        currentStepIndex,
        currentStepLayout: prefetchedLayout,
        isStepReady: true,
        isTransitioning: false,
        lastFailureReason: null,
        lastResolvedStepId: activeStep.id,
        lastResolvedTargetId: activeStep.nextTargetStepId || null,
      });
    }

    resolveStepLayout(activeStep, 'activate')
      .then((nextLayout) => {
        if (cancelled || requestId !== activeMeasureRequestRef.current) {
          return;
        }

        const resolvedLayout = nextLayout || prefetchedLayout || null;
        setCurrentStepLayout(resolvedLayout);
        setIsStepReady(Boolean(resolvedLayout));
        setIsTransitioning(false);
        setTutorialDebugState({
          currentStepId: activeStep.id,
          currentStepIndex,
          currentStepLayout: resolvedLayout,
          isStepReady: Boolean(resolvedLayout),
          isTransitioning: false,
          lastFailureReason: resolvedLayout ? null : 'activate-measure-failed',
          lastResolvedStepId: activeStep.id,
          lastResolvedTargetId: activeStep.nextTargetStepId || null,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeStep?.id,
    activeStep?.measure,
    activeStepLayoutKey,
    currentStepIndex,
    isActive,
    resolveStepLayout,
  ]);

  const contextValue = useMemo(() => ({
    canGoBack: currentStepIndex > 0,
    currentStep: orderedSteps[currentStepIndex],
    currentStepLayout,
    currentStepIndex,
    getStepById,
    isActive,
    isStepReady,
    isTransitioning,
    nextStep,
    previousStep,
    refreshCurrentStep,
    registerStep,
    skipOnboarding,
    startOnboarding,
    totalSteps: orderedSteps.length,
    unregisterStep,
  }), [
    currentStepLayout,
    currentStepIndex,
    getStepById,
    isActive,
    isStepReady,
    isTransitioning,
    nextStep,
    orderedSteps,
    previousStep,
    refreshCurrentStep,
    registerStep,
    skipOnboarding,
    startOnboarding,
    unregisterStep,
  ]);

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
    </OnboardingContext.Provider>
  );
}

export const useOnboarding = () => useContext(OnboardingContext) || defaultOnboardingContextValue;
