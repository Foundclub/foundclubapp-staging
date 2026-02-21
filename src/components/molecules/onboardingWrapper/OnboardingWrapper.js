import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { View } from 'react-native';
import { useOnboarding } from '@/context/OnboardingContext';

const isTutorialDebugEnabled = () => __DEV__ && global.__FC_TUTORIAL_DEBUG__ !== false;
const tutorialDebugLog = (...args) => {
  if (!isTutorialDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.log('[tutorial-debug]', ...args);
};

/**
 * @param {{
 *   id: string;
 *   order: number;
 *   title: string;
 *   description: string;
 *   onNext?: () => void;
 *   nextLabel?: string;
 *   nextAction?: 'default' | 'scrollDown';
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
const OnboardingWrapper = ({
  id,
  order,
  title,
  description,
  onNext,
  nextLabel,
  nextAction,
  spotlight,
  children,
  style,
}) => {
  const onboardingContext = useOnboarding() || {};
  const currentStep = onboardingContext.currentStep;
  const isActive = onboardingContext.isActive;
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

    viewRef.current.measureInWindow((
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
        measureAndRegister,
        {
          nextAction,
          nextLabel,
        },
      );
    });
  }, [
    description,
    id,
    normalizedSpotlight,
    nextAction,
    nextLabel,
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
    }
    wasCurrentStepRef.current = isCurrentStep;
  }, [currentStep?.id, id, isActive, scheduleMeasure]);

  useEffect(() => () => {
    if (measureRafRef.current) {
      cancelAnimationFrame(measureRafRef.current);
      measureRafRef.current = 0;
    }
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
};

export default OnboardingWrapper;
