import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import { tutorialDebugLog } from '@/utils/logger/tutorialDebug';

import { POPUP_IDS } from '@/constants/popupRegistry';
import { useBlockingOverlayPrompt } from '@/context/BlockingOverlayContext';
import { useOnboarding } from '@/context/OnboardingContext';
import { usePopupEligibility } from '@/context/PopupManagerContext';

const TOOLTIP_HORIZONTAL_MARGIN = 24;
const TOOLTIP_VERTICAL_MARGIN = 28;
const TOOLTIP_ESTIMATED_HEIGHT = 180;
const TOOLTIP_GAP = 20;
const ARROW_SIZE = 10;
const WEB_BOTTOM_SHELL_RESERVED_SPACE = 112;
const MIN_TOOLTIP_HEIGHT = 160;
const MIN_TOOLTIP_WIDTH = 240;
const MAX_TOOLTIP_WIDTH = 560;
const DEFAULT_OVERLAY_OPACITY = 0.5;
const MIN_OVERLAY_OPACITY = 0.2;
const MAX_OVERLAY_OPACITY = 0.85;

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

/**
 * @param {{ onVisible?: () => void }} [props]
 */
function OnboardingOverlay({ onVisible } = {}) {
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
  const [tooltipMeasuredHeight, setTooltipMeasuredHeight] = useState(0);
  const {
    canGoBack,
    currentStep,
    currentStepLayout,
    currentStepIndex,
    isActive,
    isStepReady,
    isTransitioning,
    nextStep,
    previousStep,
    refreshCurrentStep,
    skipOnboarding,
    totalSteps,
  } = useOnboarding();
  const refreshStepRef = useRef(refreshCurrentStep);
  const lastStepLogRef = useRef('');
  const lastShownStepRef = useRef('');

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

  const shouldShowOverlay = Boolean(
    isActive
    && currentStep
    && currentStepLayout
    && isStepReady
    && !isTransitioning
  );
  const onboardingPopup = usePopupEligibility(
    POPUP_IDS.ONBOARDING_OVERLAY,
    shouldShowOverlay,
  );
  const canShowOverlay = useBlockingOverlayPrompt(
    onboardingPopup.descriptor.id,
    onboardingPopup.canShow,
    onboardingPopup.descriptor.priority,
  );
  const isVisible = Boolean(shouldShowOverlay && onboardingPopup.canShow && canShowOverlay);

  useEffect(() => {
    if (!isVisible) {
      lastShownStepRef.current = '';
      return;
    }
    const shownStepKey = `${currentStep?.id || 'none'}:${currentStepIndex}`;
    if (lastShownStepRef.current !== shownStepKey) {
      lastShownStepRef.current = shownStepKey;
      onboardingPopup.markShown({
        currentStepId: currentStep?.id,
        currentStepIndex,
      });
    }
    onVisible?.();
  }, [currentStep?.id, currentStepIndex, isVisible, onboardingPopup, onVisible]);

  useEffect(() => {
    setTooltipMeasuredHeight(0);
  }, [currentStep?.id, safeViewportHeight, safeViewportWidth]);

  if (!isVisible) return null;

  const stepLogKey = `${currentStep?.id || 'none'}:${currentStepIndex}`;
  if (lastStepLogRef.current !== stepLogKey) {
    lastStepLogRef.current = stepLogKey;
    tutorialDebugLog('overlay.step', {
      currentStepId: currentStep?.id,
      currentStepIndex,
      totalSteps,
    });
  }

  const {
    description, spotlight, title,
  } = currentStep;
  const focusLayout = buildFocusLayout(currentStepLayout, spotlight, {
    height: safeViewportHeight,
    width: safeViewportWidth,
  });
  const hasRenderableFocus = focusLayout.width > 0 && focusLayout.height > 0;
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

  const tooltipWidth = clamp(
    safeViewportWidth - (TOOLTIP_HORIZONTAL_MARGIN * 2),
    MIN_TOOLTIP_WIDTH,
    MAX_TOOLTIP_WIDTH,
  );
  const tooltipLeft = clamp(
    (focusLayout.x + (focusLayout.width / 2)) - (tooltipWidth / 2),
    TOOLTIP_HORIZONTAL_MARGIN,
    Math.max(TOOLTIP_HORIZONTAL_MARGIN, safeViewportWidth - tooltipWidth - TOOLTIP_HORIZONTAL_MARGIN),
  );
  const bottomReservedInset = Platform.OS === 'web'
    ? Math.max(toSafeNumber(insets.bottom), WEB_BOTTOM_SHELL_RESERVED_SPACE)
    : toSafeNumber(insets.bottom);
  const minTooltipTop = TOOLTIP_VERTICAL_MARGIN + toSafeNumber(insets.top);
  const maxTooltipBottom = Math.max(
    minTooltipTop + MIN_TOOLTIP_HEIGHT,
    safeViewportHeight - TOOLTIP_VERTICAL_MARGIN - bottomReservedInset,
  );
  const availableTooltipHeight = Math.max(
    MIN_TOOLTIP_HEIGHT,
    maxTooltipBottom - minTooltipTop,
  );
  const effectiveTooltipHeight = clamp(
    tooltipMeasuredHeight || TOOLTIP_ESTIMATED_HEIGHT,
    MIN_TOOLTIP_HEIGHT,
    availableTooltipHeight,
  );
  const targetBottom = focusLayout.y + focusLayout.height;
  const spaceAbove = Math.max(focusLayout.y - TOOLTIP_GAP - minTooltipTop, 0);
  const spaceBelow = Math.max(maxTooltipBottom - (targetBottom + TOOLTIP_GAP), 0);
  const fitsAbove = spaceAbove >= effectiveTooltipHeight;
  const fitsBelow = spaceBelow >= effectiveTooltipHeight;
  const placeTooltipAboveTarget = fitsAbove
    ? (!fitsBelow || spaceAbove > spaceBelow)
    : (!fitsBelow && spaceAbove > spaceBelow);
  const rawTooltipTop = placeTooltipAboveTarget
    ? focusLayout.y - effectiveTooltipHeight - TOOLTIP_GAP
    : targetBottom + TOOLTIP_GAP;
  const maxTooltipTop = Math.max(
    minTooltipTop,
    maxTooltipBottom - effectiveTooltipHeight,
  );
  const tooltipTop = clamp(
    rawTooltipTop,
    minTooltipTop,
    maxTooltipTop,
  );

  const targetCenterX = focusLayout.x + (focusLayout.width / 2);
  const maxArrowLeft = tooltipWidth - (ARROW_SIZE * 2) - 12;
  const arrowLeft = clamp(
    targetCenterX - tooltipLeft - ARROW_SIZE,
    12,
    maxArrowLeft,
  );
  const isLastStep = currentStepIndex >= totalSteps - 1;
  const isScrollStep = currentStep?.nextAction === 'scrollDown';
  const tooltipShadowStyle = Platform.OS === 'web'
    ? { boxShadow: '0 12px 32px rgba(0, 0, 0, 0.24)' }
    : {
      elevation: 20,
      shadowColor: Colors.neutral900,
      shadowOffset: { height: 2, width: 0 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
    };
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

  if (Platform.OS === 'web' && !hasRenderableFocus) {
    return null;
  }

  const overlayContent = (
    <View style={[styles.container, styles.pointerBoxNone]}>
      <View
        style={[styles.overlayPart, styles.pointerNone, overlayStyle, {
          height: topHeight, left: 0, right: 0, top: 0,
        }]}
      />
      <View
        style={[styles.overlayPart, styles.pointerNone, overlayStyle, {
          bottom: 0, left: 0, right: 0, top: topHeight + focusLayout.height,
        }]}
      />
      <View
        style={[styles.overlayPart, styles.pointerNone, overlayStyle, {
          height: focusLayout.height, left: 0, top: topHeight, width: leftWidth,
        }]}
      />
      <View
        style={[styles.overlayPart, styles.pointerNone, overlayStyle, {
          height: focusLayout.height, right: 0, top: topHeight, width: rightWidth,
        }]}
      />

      <View
        style={[
          styles.spotlightFrame,
          styles.pointerNone,
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
        onLayout={(event) => {
          const nextTooltipHeight = Math.round(toSafeNumber(event?.nativeEvent?.layout?.height));
          if (!nextTooltipHeight || nextTooltipHeight === tooltipMeasuredHeight) return;
          setTooltipMeasuredHeight(nextTooltipHeight);
        }}
        style={[
          styles.tooltip,
          styles.pointerAuto,
          tooltipShadowStyle,
          {
            backgroundColor: Colors.neutral00,
            left: tooltipLeft,
            maxHeight: availableTooltipHeight,
            top: tooltipTop,
            width: tooltipWidth,
          },
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
        <ScrollView
          bounces={false}
          contentContainerStyle={[
            Spaces.padding[16],
            {
              flexGrow: 1,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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
                {currentStepIndex + 1}
                /
                {totalSteps}
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
                    <Image source={Images.chevronDown} style={{ height: 12, width: 12 }} tintColor={Colors.neutral00} />
                  ) : null}
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                    {nextButtonLabel}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );

  if (Platform.OS === 'web') {
    return (
      <View
        style={{
          bottom: 0,
          left: 0,
          position: 'fixed',
          right: 0,
          top: 0,
          zIndex: 1080,
        }}
      >
        {overlayContent}
      </View>
    );
  }

  return (
    <Modal
      animationType="fade"
      hardwareAccelerated
      onRequestClose={skipOnboarding}
      presentationStyle="overFullScreen"
      transparent
      visible={isVisible}
    >
      {overlayContent}
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
  pointerAuto: {
    pointerEvents: 'auto',
  },
  pointerBoxNone: {
    pointerEvents: 'box-none',
  },
  pointerNone: {
    pointerEvents: 'none',
  },
  spotlightFrame: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    position: 'absolute',
  },
  tooltip: {
    borderRadius: 12,
    position: 'absolute',
    zIndex: 1000,
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
