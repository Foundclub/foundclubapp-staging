import { useEffect, useMemo, useRef } from 'react';

import useFeatureTutorial from '@/domains/tutorial/useFeatureTutorial';

import OnboardingOverlay from '@/components/molecules/onboardingOverlay/OnboardingOverlay';

import { OnboardingProvider, useOnboarding } from '@/context/OnboardingContext';

/**
 * @param {{
 *  autoStart?: boolean;
 *  children: import('react').ReactNode;
 *  enableOverlay?: boolean;
 *  onForceStartHandled?: () => void;
 *  routeParams?: Record<string, unknown>;
 *  startDelayMs?: number;
 *  tutorialId: string;
 *  userId?: string;
 }} props
 */
function TutorialFlowBoundaryInner({
  children,
  enableOverlay = true,
  onForceStartHandled,
  startDelayMs = 460,
  tutorial,
}) {
  const {
    forceStartKey,
    markCompleted,
    markSeen,
    shouldAutoStart,
    shouldForceStart,
    tutorialSource,
  } = tutorial;
  const {
    currentStepIndex,
    isActive,
    startOnboarding,
    totalSteps,
  } = useOnboarding();
  const wasActiveRef = useRef(false);
  const hasStartedRef = useRef(false);
  const handledForceStartKeyRef = useRef('');

  useEffect(() => {
    if (!totalSteps || isActive || hasStartedRef.current) return undefined;
    if (!shouldAutoStart && !shouldForceStart) return undefined;
    if (shouldForceStart && forceStartKey && handledForceStartKeyRef.current === forceStartKey) {
      return undefined;
    }

    const source = shouldForceStart
      ? tutorialSource || 'manual'
      : 'auto';

    const timer = setTimeout(() => {
      if (hasStartedRef.current) {
        return;
      }

      const didStart = startOnboarding(shouldForceStart ? { forceFromStart: true } : undefined);
      if (!didStart) {
        return;
      }

      hasStartedRef.current = true;
      markSeen(source);
      if (shouldForceStart) {
        if (forceStartKey) {
          handledForceStartKeyRef.current = forceStartKey;
        }
        onForceStartHandled?.();
      }
    }, startDelayMs);

    return () => clearTimeout(timer);
  }, [
    forceStartKey,
    isActive,
    markSeen,
    onForceStartHandled,
    shouldAutoStart,
    shouldForceStart,
    startDelayMs,
    startOnboarding,
    totalSteps,
    tutorialSource,
  ]);

  useEffect(() => {
    if (wasActiveRef.current && !isActive) {
      const isLastStepReached = totalSteps > 0
        && currentStepIndex >= totalSteps - 1;
      if (isLastStepReached) {
        markCompleted(tutorialSource || 'auto');
      }
      hasStartedRef.current = false;
    }
    wasActiveRef.current = isActive;
  }, [
    currentStepIndex,
    isActive,
    markCompleted,
    totalSteps,
    tutorialSource,
  ]);

  return (
    <>
      {children}
      {enableOverlay ? <OnboardingOverlay /> : null}
    </>
  );
}

/**
 * @param {{
 *  autoStart?: boolean;
 *  children: import('react').ReactNode;
 *  enableOverlay?: boolean;
 *  onForceStartHandled?: () => void;
 *  routeParams?: Record<string, unknown>;
 *  startDelayMs?: number;
 *  tutorialId: string;
 *  userId?: string;
 }} props
 * @returns {import('react').ReactElement}
 */
function TutorialFlowBoundary({
  autoStart = true,
  children,
  enableOverlay = true,
  onForceStartHandled,
  routeParams,
  startDelayMs = 460,
  tutorialId,
  userId,
}) {
  const tutorial = useFeatureTutorial({
    autoStart,
    routeParams,
    tutorialId,
    userId,
  });

  const flowId = useMemo(() => tutorial.flowId, [tutorial.flowId]);

  return (
    <OnboardingProvider flowId={flowId}>
      <TutorialFlowBoundaryInner
        enableOverlay={enableOverlay}
        onForceStartHandled={onForceStartHandled}
        startDelayMs={startDelayMs}
        tutorial={tutorial}
      >
        {children}
      </TutorialFlowBoundaryInner>
    </OnboardingProvider>
  );
}

export default TutorialFlowBoundary;
