import React, {
  useEffect,
  useRef,
} from 'react';
import {
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOnboarding } from '@/context/OnboardingContext';
import useTheme from '@/theme/themeContext';

const TOOLTIP_HORIZONTAL_MARGIN = 24;
const TOOLTIP_VERTICAL_MARGIN = 28;
const TOOLTIP_ESTIMATED_HEIGHT = 180;
const TOOLTIP_GAP = 20;
const ARROW_SIZE = 10;
const DEFAULT_OVERLAY_OPACITY = 0.5;
const MIN_OVERLAY_OPACITY = 0.2;
const MAX_OVERLAY_OPACITY = 0.85;
const isTutorialDebugEnabled = () => __DEV__ && global.__FC_TUTORIAL_DEBUG__ !== false;
const tutorialDebugLog = (...args) => {
  if (!isTutorialDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.log('[tutorial-debug]', ...args);
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const toSafeNumber = (value, fallback = 0) => (
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
);

const buildFocusLayout = (layout, spotlight = {}, viewport = {}) => {
  const viewportWidth = Math.max(toSafeNumber(viewport.width), 0);
  const viewportHeight = Math.max(toSafeNumber(viewport.height), 0);
  const rawX = toSafeNumber(layout?.x);
  const rawY = toSafeNumber(layout?.y);
  const rawWidth = Math.max(toSafeNumber(layout?.width), 0);
  const rawHeight = Math.max(toSafeNumber(layout?.height), 0);

  const paddingX = toSafeNumber(spotlight?.paddingX, 8);
  const paddingY = toSafeNumber(spotlight?.paddingY, 8);
  const offsetX = toSafeNumber(spotlight?.offsetX, 0);
  const offsetY = toSafeNumber(spotlight?.offsetY, 0);
  const minWidth = Math.max(toSafeNumber(spotlight?.minWidth, 0), 0);
  const minHeight = Math.max(toSafeNumber(spotlight?.minHeight, 0), 0);
  const maxWidth = Math.max(toSafeNumber(spotlight?.maxWidth, viewportWidth), 0);
  const maxHeight = Math.max(toSafeNumber(spotlight?.maxHeight, viewportHeight), 0);

  const width = Math.min(
    Math.max(rawWidth + (paddingX * 2), minWidth),
    maxWidth,
    viewportWidth,
  );
  const height = Math.min(
    Math.max(rawHeight + (paddingY * 2), minHeight),
    maxHeight,
    viewportHeight,
  );

  const x = clamp(rawX - paddingX + offsetX, 0, Math.max(viewportWidth - width, 0));
  const y = clamp(rawY - paddingY + offsetY, 0, Math.max(viewportHeight - height, 0));
  const borderRadius = Math.max(toSafeNumber(spotlight?.borderRadius, 16), 0);

  return {
    borderRadius,
    height,
    width,
    x,
    y,
  };
};

function OnboardingOverlay() {
  const { t } = useTranslation();
  const {
    Alignments,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: viewportHeight, width: viewportWidth } = useWindowDimensions();
  const safeViewportHeight = Math.max(toSafeNumber(viewportHeight), 1);
  const safeViewportWidth = Math.max(toSafeNumber(viewportWidth), 1);
  const {
    canGoBack,
    currentStep,
    currentStepIndex,
    isActive,
    nextStep,
    previousStep,
    refreshCurrentStep,
    skipOnboarding,
    totalSteps,
  } = useOnboarding();
  const refreshStepRef = useRef(refreshCurrentStep);
  const lastStepLogRef = useRef('');

  useEffect(() => {
    refreshStepRef.current = refreshCurrentStep;
  }, [refreshCurrentStep]);

  useEffect(() => {
    if (!isActive) return undefined;
    const settleTimer = setTimeout(() => {
      refreshStepRef.current?.();
    }, 80);
    return () => {
      clearTimeout(settleTimer);
    };
  }, [currentStep?.id, isActive, viewportHeight, viewportWidth]);

  if (!isActive || !currentStep) return null;

  const stepLogKey = `${currentStep?.id || 'none'}:${currentStepIndex}`;
  if (lastStepLogRef.current !== stepLogKey) {
    lastStepLogRef.current = stepLogKey;
    tutorialDebugLog('overlay.step', {
      currentStepId: currentStep?.id,
      currentStepIndex,
      totalSteps,
    });
  }

  const { description, layout, spotlight, title } = currentStep;
  const focusLayout = buildFocusLayout(layout, spotlight, {
    height: safeViewportHeight,
    width: safeViewportWidth,
  });
  const effectiveTooltipHeight = TOOLTIP_ESTIMATED_HEIGHT;
  const overlayOpacity = clamp(
    toSafeNumber(spotlight?.overlayOpacity, DEFAULT_OVERLAY_OPACITY),
    MIN_OVERLAY_OPACITY,
    MAX_OVERLAY_OPACITY,
  );
  const overlayStyle = {
    backgroundColor: Colors.neutral900,
    opacity: overlayOpacity,
  };

  const topHeight = focusLayout.y;
  const leftWidth = focusLayout.x;
  const rightWidth = Math.max(
    0,
    safeViewportWidth - (focusLayout.x + focusLayout.width),
  );

  const placeTooltipAboveTarget = focusLayout.y > safeViewportHeight / 2;
  const rawTooltipTop = placeTooltipAboveTarget
    ? focusLayout.y - effectiveTooltipHeight - TOOLTIP_GAP
    : focusLayout.y + focusLayout.height + TOOLTIP_GAP;
  const minTooltipTop = TOOLTIP_VERTICAL_MARGIN + (insets.top || 0);
  const maxTooltipTop = Math.max(
    minTooltipTop,
    safeViewportHeight - effectiveTooltipHeight - TOOLTIP_VERTICAL_MARGIN - (insets.bottom || 0),
  );
  const tooltipTop = clamp(
    rawTooltipTop,
    minTooltipTop,
    maxTooltipTop,
  );

  const targetCenterX = focusLayout.x + (focusLayout.width / 2);
  const tooltipWidth = clamp(
    safeViewportWidth - (TOOLTIP_HORIZONTAL_MARGIN * 2),
    240,
    560,
  );
  const tooltipLeft = clamp(
    (safeViewportWidth - tooltipWidth) / 2,
    12,
    Math.max(12, safeViewportWidth - tooltipWidth - 12),
  );
  const maxArrowLeft = tooltipWidth - (ARROW_SIZE * 2) - 12;
  const arrowLeft = clamp(
    targetCenterX - tooltipLeft - ARROW_SIZE,
    12,
    maxArrowLeft,
  );
  const isLastStep = currentStepIndex >= totalSteps - 1;
  const isScrollStep = currentStep?.nextAction === 'scrollDown';
  const nextButtonLabel = isLastStep
    ? t('common.finish')
    : (currentStep?.nextLabel || (isScrollStep ? t('homeHubTutorial.actions.scrollDown', 'Descendre') : t('common.next')));

  const handleSkipPress = () => {
    tutorialDebugLog('overlay.press.skip', {
      currentStepId: currentStep?.id,
      currentStepIndex,
    });
    skipOnboarding();
  };

  const handlePreviousPress = () => {
    tutorialDebugLog('overlay.press.previous', {
      currentStepId: currentStep?.id,
      currentStepIndex,
    });
    previousStep();
  };

  const handleNextPress = () => {
    tutorialDebugLog('overlay.press.next', {
      currentStepId: currentStep?.id,
      currentStepIndex,
    });
    nextStep();
  };

  return (
    <Modal
      animationType="fade"
      hardwareAccelerated
      onRequestClose={skipOnboarding}
      presentationStyle="overFullScreen"
      transparent
      visible={isActive}
    >
      <View pointerEvents="box-none" style={styles.container}>
        <View pointerEvents="none" style={[styles.overlayPart, overlayStyle, { height: topHeight, left: 0, right: 0, top: 0 }]} />
        <View pointerEvents="none" style={[styles.overlayPart, overlayStyle, { bottom: 0, left: 0, right: 0, top: topHeight + focusLayout.height }]} />
        <View pointerEvents="none" style={[styles.overlayPart, overlayStyle, { height: focusLayout.height, left: 0, top: topHeight, width: leftWidth }]} />
        <View pointerEvents="none" style={[styles.overlayPart, overlayStyle, { height: focusLayout.height, right: 0, top: topHeight, width: rightWidth }]} />

        <View
          pointerEvents="none"
          style={[
            styles.spotlightFrame,
            {
              borderColor: Colors.primary500,
              borderRadius: focusLayout.borderRadius,
              height: focusLayout.height,
              left: focusLayout.x,
              top: focusLayout.y,
              width: focusLayout.width,
            },
          ]}
        />

        <View
          pointerEvents="auto"
          style={[
            styles.tooltip,
            {
              backgroundColor: Colors.neutral00,
              left: tooltipLeft,
              shadowColor: Colors.neutral900,
              top: tooltipTop,
              width: tooltipWidth,
            },
            Spaces.padding[16],
          ]}
        >
          <View
            style={[
              styles.tooltipArrow,
              placeTooltipAboveTarget ? styles.tooltipArrowBottom : styles.tooltipArrowTop,
              {
                borderBottomColor: !placeTooltipAboveTarget ? Colors.neutral00 : 'transparent',
                borderTopColor: placeTooltipAboveTarget ? Colors.neutral00 : 'transparent',
                left: arrowLeft,
              },
            ]}
          />
          <Text style={[Fonts.h3Bold, Fonts.neutral900, Spaces.marginBottom[8]]}>
            {title}
          </Text>
          <Text style={[Fonts.p1, Fonts.neutral500, Spaces.marginBottom[16]]}>
            {description}
          </Text>

          <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}>
            <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[16]]}>
              <Pressable
                accessibilityHint={t('onboardingAffiliation.a11y.tooltipSkipHint')}
                accessibilityLabel={t('common.skip')}
                accessibilityRole="button"
                hitSlop={8}
                onPress={handleSkipPress}
              >
                <Text style={[Fonts.p2Bold, Fonts.neutral500]}>
                  {t('common.skip')}
                </Text>
              </Pressable>

              {canGoBack ? (
                <Pressable
                  accessibilityHint={t('onboardingAffiliation.a11y.tooltipPreviousHint')}
                  accessibilityLabel={t('common.previous')}
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={handlePreviousPress}
                >
                  <Text style={[Fonts.p2Bold, Fonts.neutral500]}>
                    {t('common.previous')}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
              <Text style={[Fonts.p3, Fonts.neutral400]}>
                {currentStepIndex + 1}/{totalSteps}
              </Text>
              <Pressable
                accessibilityHint={t('onboardingAffiliation.a11y.tooltipNextHint')}
                accessibilityLabel={nextButtonLabel}
                accessibilityRole="button"
                hitSlop={8}
                onPress={handleNextPress}
                style={[styles.nextButton, { backgroundColor: Colors.primary500 }]}
              >
                <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[6]]}>
                  {isScrollStep && !isLastStep ? (
                    <Image source={Images.chevronDown} style={{ height: 12, tintColor: Colors.neutral00, width: 12 }} />
                  ) : null}
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                    {nextButtonLabel}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  nextButton: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  overlayPart: {
    position: 'absolute',
  },
  spotlightFrame: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    position: 'absolute',
  },
  tooltip: {
    borderRadius: 12,
    elevation: 20,
    position: 'absolute',
    zIndex: 1000,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  tooltipArrow: {
    borderLeftColor: 'transparent',
    borderLeftWidth: ARROW_SIZE,
    borderRightColor: 'transparent',
    borderRightWidth: ARROW_SIZE,
    height: 0,
    position: 'absolute',
    width: 0,
  },
  tooltipArrowBottom: {
    borderBottomWidth: 0,
    borderTopWidth: ARROW_SIZE,
    bottom: -ARROW_SIZE,
  },
  tooltipArrowTop: {
    borderBottomWidth: ARROW_SIZE,
    borderTopWidth: 0,
    top: -ARROW_SIZE,
  },
});

export default OnboardingOverlay;
