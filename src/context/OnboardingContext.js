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

import { tutorialDebugLog } from '@/utils/logger/tutorialDebug';

const defaultOnboardingContextValue = {
  canGoBack: false,
  currentStep: undefined,
  currentStepIndex: 0,
  isActive: false,
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
  const registrationCounterRef = useRef(0);
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
    registrationCounterRef.current = 0;
    setCompletedStepIds(parseCompletedSteps(storage.getString(getCompletedStepsKey(flowId))));
  }, [flowId]);

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
        onNext,
        order,
        registrationIndex: previousStep?.registrationIndex ?? (registrationCounterRef.current += 1),
        spotlight,
        title,
      };
      if (
        previousStep
        && previousStep.id === nextStep.id
        && previousStep.order === nextStep.order
        && previousStep.title === nextStep.title
        && previousStep.description === nextStep.description
        && previousStep.nextAction === nextStep.nextAction
        && previousStep.nextLabel === nextStep.nextLabel
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
    setIsActive(false);
  }, []);

  const nextStep = useCallback(() => {
    if (!orderedSteps.length) {
      stopOnboarding();
      return;
    }

    const currentStep = orderedSteps[currentStepIndex];
    const mergedCompletedStepIds = mergeStepIds(completedStepIds, [currentStep?.id]);
    const completedSet = new Set(mergedCompletedStepIds);

    setCompletedStepIds(mergedCompletedStepIds);
    persistCompletedSteps(mergedCompletedStepIds);

    const nextPendingIndex = orderedSteps.findIndex(
      (step, index) => index > currentStepIndex && !completedSet.has(step.id),
    );
    const isLastPending = nextPendingIndex === -1;

    if (isLastPending) {
      stopOnboarding();
    } else {
      setCurrentStepIndex(nextPendingIndex);
    }

    tutorialDebugLog('nextStep', {
      currentStepId: currentStep?.id,
      currentStepIndex,
      flowId,
      isLastPending,
      nextPendingIndex,
    });

    if (typeof currentStep?.onNext === 'function') {
      try {
        currentStep.onNext();
      } catch (_error) {
        // Keep onboarding progression robust even if a side effect fails.
      }
    }
  }, [
    completedStepIds,
    currentStepIndex,
    orderedSteps,
    persistCompletedSteps,
    stopOnboarding,
  ]);

  const previousStep = useCallback(() => {
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
    if (typeof activeStep?.measure === 'function') {
      activeStep.measure();
    }
  }, [currentStepIndex, orderedSteps]);

  const skipOnboarding = useCallback(() => {
    const allStepIds = orderedSteps.map((step) => step.id);
    const mergedCompletedStepIds = mergeStepIds(completedStepIds, allStepIds);

    setCompletedStepIds(mergedCompletedStepIds);
    persistCompletedSteps(mergedCompletedStepIds);
    stopOnboarding();
  }, [completedStepIds, orderedSteps, persistCompletedSteps, stopOnboarding]);

  const contextValue = useMemo(() => ({
    canGoBack: currentStepIndex > 0,
    currentStep: orderedSteps[currentStepIndex],
    currentStepIndex,
    isActive,
    nextStep,
    previousStep,
    refreshCurrentStep,
    registerStep,
    skipOnboarding,
    startOnboarding,
    totalSteps: orderedSteps.length,
    unregisterStep,
  }), [
    currentStepIndex,
    isActive,
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
