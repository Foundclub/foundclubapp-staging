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
  targetNodeResolver,
  onNext,
  order,
  spotlight,
  style,
  title,
}) {
  const onboardingContext = useOnboarding() || {};
  const { currentStep } = onboardingContext;
  const { isActive } = onboardingContext;
  const registerStep = onboardingContext.registerStep || (() => {});
  const unregisterStep = onboardingContext.unregisterStep || (() => {});
  const viewRef = useRef(/** @type {import('react-native').View | null} */ (null));
  const hasInitialRegistrationRef = useRef(false);
  const lastRegistrationKeyRef = useRef('');
  const measureRafRef = useRef(0);
  const isMeasureScheduledRef = useRef(false);
  const lastMeasureAtRef = useRef(0);
  const lastDebugLogAtRef = useRef(0);
  const wasCurrentStepRef = useRef(false);
  const remeasureTimersRef = useRef(/** @type {ReturnType<typeof setTimeout>[]} */ ([]));
  const resizeObserverRef = useRef(/** @type {ResizeObserver | null} */ (null));

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

  const measureAndRegister = useCallback(() => {
    if (!viewRef.current) return;

    const targetNode = getTargetNode();
    const measurableNode = Platform.OS === 'web'
      ? (
        typeof targetNode?.getBoundingClientRect === 'function'
          ? targetNode
          : (typeof viewRef.current?.getBoundingClientRect === 'function' ? viewRef.current : null)
      )
      : viewRef.current;

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
        {
          nextAction,
          nextLabel,
          nextTargetStepId,
        },
      );
      return;
    }

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
        {
          nextAction,
          nextLabel,
          nextTargetStepId,
        },
      );
    });
  }, [
    description,
    getTargetNode,
    id,
    measureTarget,
    normalizedSpotlight,
    nextAction,
    nextLabel,
    nextTargetStepId,
    onNext,
    order,
    registerStep,
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
    const node = viewRef.current;
    if (!node) return undefined;

    if (typeof ResizeObserver !== 'undefined' && typeof node?.getBoundingClientRect === 'function') {
      resizeObserverRef.current = new ResizeObserver(() => {
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
    unregisterStep(id);
  }, [id, unregisterStep]);

  return (
    <View
      collapsable={false}
      onLayout={() => {
        if (!hasInitialRegistrationRef.current) {
          hasInitialRegistrationRef.current = true;
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
