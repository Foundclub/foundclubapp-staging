import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { Platform, View } from 'react-native';

import { measureTutorialTargetOnWeb } from '@/domains/tutorial/tutorialWebRuntime';

import { tutorialDebugLog } from '@/utils/logger/tutorialDebug';

import { useOnboarding } from '@/context/OnboardingContext';

/**
 * @param {{
 *   id: string;
 *   order: number;
 *   title: string;
 *   description: string;
 *   onNext?: () => void;
 *   nextLabel?: string;
 *   nextAction?: 'default' | 'scrollDown';
 *   nextTargetStepId?: string;
 *   targetNodeResolver?: () => any;
 *   spotlight?: {
 *     paddingX?: number;
 *     paddingY?: number;
 *     borderRadius?: number;
 *     minHeight?: number;
 *     minWidth?: number;
 *     maxHeight?: number;
 *     maxWidth?: number;
 *     offsetX?: number;
 *     offsetY?: number;
 *     overlayOpacity?: number;
 *   };
 *   children?: import('react').ReactNode;
 *   style?: import('react-native').StyleProp<import('react-native').ViewStyle>;
 * }} props
 * @returns {import('react').ReactElement}
 */
function OnboardingWrapper({
  children,
  description,
  id,
  nextAction,
  nextLabel,
  nextTargetStepId,
  onNext,
  order,
  spotlight,
  style,
  targetNodeResolver,
  title,
}) {
  const onboardingContext = useOnboarding() || {};
  const {
    currentStep,
    isActive = false,
    registerStep: registerStepFromContext,
    unregisterStep: unregisterStepFromContext,
  } = onboardingContext;
  const registerStep = registerStepFromContext;
  const unregisterStep = unregisterStepFromContext;
  const viewRef = useRef(/** @type {import('react-native').View | null} */ (null));
  const hasInitialRegistrationRef = useRef(false);
  const lastRegistrationKeyRef = useRef('');
  const measureRafRef = useRef(0);
  const isMeasureScheduledRef = useRef(false);
  const lastMeasureAtRef = useRef(0);
  const lastDebugLogAtRef = useRef(0);
  const wasCurrentStepRef = useRef(false);
  const remeasureTimersRef = useRef(/** @type {ReturnType<typeof setTimeout>[]} */ ([]));
  const resizeObserverRef = useRef(/** @type {{ disconnect: () => void; observe: (node: any) => void } | null} */ (null));

  const getTargetNode = useCallback(() => (
    (typeof targetNodeResolver === 'function' && targetNodeResolver()) || viewRef.current
  ), [targetNodeResolver]);

  const measureTarget = useCallback(() => {
    if (Platform.OS === 'web') {
      return measureTutorialTargetOnWeb(getTargetNode, {
        allowOffscreenFallback: true,
        requireVisible: false,
        stabilityFrames: 2,
        timeoutMs: 1200,
      });
    }

    return new Promise((resolve) => {
      if (!viewRef.current) {
        resolve(null);
        return;
      }

      viewRef.current.measureInWindow((measuredX, measuredY, width, height) => {
        if (!width || !height) {
          resolve(null);
          return;
        }

        resolve({
          height: Math.round(height),
          width: Math.round(width),
          x: Math.round(measuredX),
          y: Math.round(measuredY),
        });
      });
    });
  }, [getTargetNode]);

  const normalizedSpotlight = useMemo(() => ({
    borderRadius: spotlight?.borderRadius,
    maxHeight: spotlight?.maxHeight,
    maxWidth: spotlight?.maxWidth,
    minHeight: spotlight?.minHeight,
    minWidth: spotlight?.minWidth,
    offsetX: spotlight?.offsetX,
    offsetY: spotlight?.offsetY,
    overlayOpacity: spotlight?.overlayOpacity,
    paddingX: spotlight?.paddingX,
    paddingY: spotlight?.paddingY,
  }), [
    spotlight?.borderRadius,
    spotlight?.maxHeight,
    spotlight?.maxWidth,
    spotlight?.minHeight,
    spotlight?.minWidth,
    spotlight?.offsetX,
    spotlight?.offsetY,
    spotlight?.overlayOpacity,
    spotlight?.paddingX,
    spotlight?.paddingY,
  ]);

  const registerStepOptions = useMemo(() => ({
    nextAction,
    nextLabel,
    nextTargetStepId,
  }), [nextAction, nextLabel, nextTargetStepId]);

  const commitStepRegistration = useCallback((layout) => {
    if (typeof registerStep !== 'function') return;

    registerStep(
      id,
      layout,
      order,
      title,
      description,
      normalizedSpotlight,
      onNext,
      measureTarget,
      getTargetNode,
      registerStepOptions,
    );
  }, [
    description,
    getTargetNode,
    id,
    measureTarget,
    normalizedSpotlight,
    onNext,
    order,
    registerStep,
    registerStepOptions,
    title,
  ]);

  const registerPlaceholderStep = useCallback(() => {
    commitStepRegistration(null);
  }, [
    commitStepRegistration,
  ]);

  const measureAndRegister = useCallback(() => {
    if (!viewRef.current) return;

    const targetNode = getTargetNode();
    let measurableNode = viewRef.current;

    if (Platform.OS === 'web') {
      if (typeof targetNode?.getBoundingClientRect === 'function') {
        measurableNode = targetNode;
      } else if (typeof viewRef.current?.getBoundingClientRect !== 'function') {
        measurableNode = null;
      }
    }

    if (Platform.OS === 'web' && measurableNode) {
      const rect = measurableNode.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const layout = {
        height: Math.round(rect.height),
        width: Math.round(rect.width),
        x: Math.round(rect.left),
        y: Math.round(rect.top),
      };

      const registrationKey = [
        id,
        order,
        title,
        description,
        nextAction || '',
        nextLabel || '',
        nextTargetStepId || '',
        layout.x,
        layout.y,
        layout.width,
        layout.height,
        normalizedSpotlight?.paddingX ?? '',
        normalizedSpotlight?.paddingY ?? '',
        normalizedSpotlight?.borderRadius ?? '',
        normalizedSpotlight?.minHeight ?? '',
        normalizedSpotlight?.minWidth ?? '',
        normalizedSpotlight?.maxHeight ?? '',
        normalizedSpotlight?.maxWidth ?? '',
        normalizedSpotlight?.offsetX ?? '',
        normalizedSpotlight?.offsetY ?? '',
        normalizedSpotlight?.overlayOpacity ?? '',
      ].join('|');

      if (lastRegistrationKeyRef.current === registrationKey) return;
      lastRegistrationKeyRef.current = registrationKey;
      tutorialDebugLog('wrapper.register', { id, layout, order });

      commitStepRegistration(layout);
      return;
    }

    if (!measurableNode) return;

    measurableNode.measureInWindow((
      /** @type {number} */ measuredX,
      /** @type {number} */ measuredY,
      /** @type {number} */ width,
      /** @type {number} */ height,
    ) => {
      if (!width || !height) return;

      const layout = {
        height: Math.round(height),
        width: Math.round(width),
        x: Math.round(measuredX),
        y: Math.round(measuredY),
      };

      const registrationKey = [
        id,
        order,
        title,
        description,
        nextAction || '',
        nextLabel || '',
        nextTargetStepId || '',
        layout.x,
        layout.y,
        layout.width,
        layout.height,
        normalizedSpotlight?.paddingX ?? '',
        normalizedSpotlight?.paddingY ?? '',
        normalizedSpotlight?.borderRadius ?? '',
        normalizedSpotlight?.minHeight ?? '',
        normalizedSpotlight?.minWidth ?? '',
        normalizedSpotlight?.maxHeight ?? '',
        normalizedSpotlight?.maxWidth ?? '',
        normalizedSpotlight?.offsetX ?? '',
        normalizedSpotlight?.offsetY ?? '',
        normalizedSpotlight?.overlayOpacity ?? '',
      ].join('|');

      if (lastRegistrationKeyRef.current === registrationKey) return;
      lastRegistrationKeyRef.current = registrationKey;
      tutorialDebugLog('wrapper.register', { id, layout, order });

      commitStepRegistration(layout);
    });
  }, [
    commitStepRegistration,
    description,
    getTargetNode,
    id,
    normalizedSpotlight,
    nextAction,
    nextLabel,
    nextTargetStepId,
    order,
    title,
  ]);

  const scheduleMeasure = useCallback(() => {
    if (isMeasureScheduledRef.current) return;

    const MIN_MEASURE_INTERVAL_MS = 120;
    const now = Date.now();
    if (hasInitialRegistrationRef.current && (now - lastMeasureAtRef.current) < MIN_MEASURE_INTERVAL_MS) {
      return;
    }

    isMeasureScheduledRef.current = true;
    if (now - lastDebugLogAtRef.current > 500) {
      lastDebugLogAtRef.current = now;
      tutorialDebugLog('wrapper.scheduleMeasure', {
        id,
        isActive,
        isCurrent: currentStep?.id === id,
      });
    }
    measureRafRef.current = requestAnimationFrame(() => {
      isMeasureScheduledRef.current = false;
      lastMeasureAtRef.current = Date.now();
      measureAndRegister();
    });
  }, [currentStep?.id, id, isActive, measureAndRegister]);

  useEffect(() => {
    const isCurrentStep = Boolean(isActive && currentStep?.id === id);
    if (isCurrentStep && !wasCurrentStepRef.current) {
      scheduleMeasure();
      if (Platform.OS === 'web') {
        remeasureTimersRef.current.forEach((timer) => clearTimeout(timer));
        remeasureTimersRef.current = [120, 280, 520].map((delay) => setTimeout(() => {
          measureAndRegister();
        }, delay));
      }
    }
    if (!isCurrentStep) {
      remeasureTimersRef.current.forEach((timer) => clearTimeout(timer));
      remeasureTimersRef.current = [];
    }
    wasCurrentStepRef.current = isCurrentStep;
  }, [currentStep?.id, id, isActive, measureAndRegister, scheduleMeasure]);

  useEffect(() => {
    if (Platform.OS !== 'web') return undefined;
    if (!isActive || currentStep?.id !== id) return undefined;
    const node = viewRef.current;
    if (!node) return undefined;

    const WebResizeObserver = window.ResizeObserver;
    if (typeof WebResizeObserver === 'function' && typeof node?.getBoundingClientRect === 'function') {
      resizeObserverRef.current = new WebResizeObserver(() => {
        scheduleMeasure();
      });
      resizeObserverRef.current.observe(node);
    }

    const handleResize = () => {
      scheduleMeasure();
    };

    const handleScroll = () => {
      if (isActive && currentStep?.id === id) {
        scheduleMeasure();
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [currentStep?.id, id, isActive, scheduleMeasure]);

  useEffect(() => () => {
    if (measureRafRef.current) {
      cancelAnimationFrame(measureRafRef.current);
      measureRafRef.current = 0;
    }
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;
    remeasureTimersRef.current.forEach((timer) => clearTimeout(timer));
    remeasureTimersRef.current = [];
    isMeasureScheduledRef.current = false;
    lastRegistrationKeyRef.current = '';
    if (typeof unregisterStep === 'function') {
      unregisterStep(id);
    }
  }, [id, unregisterStep]);

  return (
    <View
      collapsable={false}
      onLayout={() => {
        if (!hasInitialRegistrationRef.current) {
          hasInitialRegistrationRef.current = true;
          registerPlaceholderStep();
        }

        if (isActive && currentStep?.id === id) {
          scheduleMeasure();
        }
      }}
      ref={viewRef}
      style={style}
    >
      {children}
    </View>
  );
}

export default OnboardingWrapper;
