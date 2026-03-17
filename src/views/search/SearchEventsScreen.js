import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useAuth from '@/domains/auth/useAuth';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';
import useFeatureTutorial from '@/domains/tutorial/useFeatureTutorial';
import useTheme from '@/theme/themeContext';

import EventListContent from '@/components/organisms/eventListContent/EventListContent';

import SearchScreenShell from './components/SearchScreenShell';

const TOOLTIP_HORIZONTAL_MARGIN = 24;
const TOOLTIP_VERTICAL_MARGIN = 28;
const TOOLTIP_ESTIMATED_HEIGHT = 188;
const TOOLTIP_GAP = 18;
const ARROW_SIZE = 10;
const TOOLTIP_BOTTOM_GUARD = 72;

const EVENT_TUTORIAL_STEPS = [
  {
    description: 'Cet ?cran vous permet de trouver les événements selon vos crit?res.',
    id: 'intro',
    target: 'header',
    title: 'Recherche événement',
  },
  {
    description: 'Les chips en haut servent à changer rapidement de type de recherche.',
    id: 'types',
    target: 'switcher',
    title: 'Types de recherche',
  },
  {
    description: 'Utilisez la recherche texte et les filtres avancés pour affiner.',
    id: 'filters',
    target: 'filters',
    title: 'Filtres événement',
  },
  {
    description: 'Chaque carte affiche les détails. Appuyez sur "À propos" pour ouvrir la fiche.',
    id: 'cards',
    target: 'card',
    title: 'R?sultats',
  },
];

const TUTORIAL_TARGET_STYLE = {
  card: { borderRadius: 16, paddingX: 6, paddingY: 6 },
  filters: { borderRadius: 14, paddingX: 4, paddingY: 4 },
  header: { borderRadius: 14, paddingX: 6, paddingY: 4 },
  switcher: { borderRadius: 14, paddingX: 4, paddingY: 4 },
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const isCloseLayout = (a, b) => {
  if (!a || !b) return false;
  const dx = Math.abs((a.x || 0) - (b.x || 0));
  const dy = Math.abs((a.y || 0) - (b.y || 0));
  const dw = Math.abs((a.width || 0) - (b.width || 0));
  const dh = Math.abs((a.height || 0) - (b.height || 0));
  return dx < 3 && dy < 3 && dw < 3 && dh < 3;
};

const getFallbackAnchor = (target, viewportWidth, viewportHeight) => {
  const width = Math.max(120, viewportWidth - 56);
  if (target === 'header') {
    return {
      height: 42, width: Math.min(260, width), x: (viewportWidth - Math.min(260, width)) / 2, y: 150,
    };
  }
  if (target === 'switcher') {
    return {
      height: 44, width: Math.min(viewportWidth - 28, 360), x: 14, y: 206,
    };
  }
  if (target === 'filters') {
    return {
      height: 56, width: viewportWidth - 40, x: 20, y: 414,
    };
  }
  return {
    height: 208, width: viewportWidth - 30, x: 15, y: Math.round(viewportHeight * 0.56),
  };
};

const getFocusLayout = (target, anchor, viewportWidth, viewportHeight) => {
  const targetStyle = TUTORIAL_TARGET_STYLE[target] || TUTORIAL_TARGET_STYLE.header;
  const baseAnchor = anchor || getFallbackAnchor(target, viewportWidth, viewportHeight);
  const width = clamp(
    baseAnchor.width + (targetStyle.paddingX * 2),
    80,
    viewportWidth - 8,
  );
  const height = clamp(
    baseAnchor.height + (targetStyle.paddingY * 2),
    28,
    viewportHeight - 8,
  );

  return {
    borderRadius: targetStyle.borderRadius,
    height,
    width,
    x: clamp(baseAnchor.x - targetStyle.paddingX, 0, Math.max(viewportWidth - width, 0)),
    y: clamp(baseAnchor.y - targetStyle.paddingY, 0, Math.max(viewportHeight - height, 0)),
  };
};

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any>} props
 * @returns {import('react').ReactElement}
 */
function SearchEventsScreen({ navigation, route }) {
  const {
    Alignments,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: viewportHeight, width: viewportWidth } = useWindowDimensions();
  const { userData } = useAuth();
  const tutorial = useFeatureTutorial({
    routeParams: route?.params,
    tutorialId: TutorialIds.SEARCH_EVENTS,
    userId: userData?.documentId,
  });

  const [isTutorialVisible, setIsTutorialVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [anchors, setAnchors] = useState({});

  const handledForceStartKeyRef = useRef('');
  const hasAutoStartedRef = useRef(false);

  const eventFiltersProps = useMemo(
    () => ({
      excludeType: 'R\u00E9servation',
      sessionStatus: 'open',
    }),
    [],
  );

  const handleTutorialLayout = useCallback((key, layout) => {
    setAnchors((previousAnchors) => {
      if (isCloseLayout(previousAnchors[key], layout)) {
        return previousAnchors;
      }
      return {
        ...previousAnchors,
        [key]: layout,
      };
    });
  }, []);

  const openTutorial = useCallback((source) => {
    setStepIndex(0);
    setIsTutorialVisible(true);
    tutorial.markSeen(source || 'auto');
  }, [tutorial]);

  useEffect(() => {
    if (!userData?.documentId) return;

    if (tutorial.shouldForceStart) {
      const forceStartKey = tutorial.forceStartKey || 'legacy';
      if (handledForceStartKeyRef.current === forceStartKey) return;
      handledForceStartKeyRef.current = forceStartKey;
      openTutorial(tutorial.tutorialSource || 'manual');
      navigation.setParams({
        startTutorial: undefined,
        tutorialId: undefined,
        tutorialSource: undefined,
        tutorialStartToken: undefined,
      });
      return;
    }

    if (!tutorial.shouldAutoStart || hasAutoStartedRef.current) return;
    hasAutoStartedRef.current = true;
    openTutorial('auto');
  }, [
    navigation,
    openTutorial,
    tutorial.forceStartKey,
    tutorial.shouldAutoStart,
    tutorial.shouldForceStart,
    tutorial.tutorialSource,
    userData?.documentId,
  ]);

  const currentStep = EVENT_TUTORIAL_STEPS[stepIndex];
  const isLastStep = stepIndex >= EVENT_TUTORIAL_STEPS.length - 1;

  const focusLayout = getFocusLayout(
    currentStep?.target || 'header',
    anchors[currentStep?.target || 'header'],
    viewportWidth,
    viewportHeight,
  );

  const topHeight = focusLayout.y;
  const leftWidth = focusLayout.x;
  const rightWidth = Math.max(0, viewportWidth - (focusLayout.x + focusLayout.width));

  const tooltipWidth = clamp(
    viewportWidth - (TOOLTIP_HORIZONTAL_MARGIN * 2),
    250,
    380,
  );
  const tooltipLeft = clamp(
    (viewportWidth - tooltipWidth) / 2,
    12,
    Math.max(12, viewportWidth - tooltipWidth - 12),
  );

  const availableSpaceAbove = focusLayout.y
    - TOOLTIP_GAP
    - TOOLTIP_VERTICAL_MARGIN
    - (insets.top || 0);
  const availableSpaceBelow = viewportHeight
    - (focusLayout.y + focusLayout.height)
    - TOOLTIP_GAP
    - TOOLTIP_VERTICAL_MARGIN
    - (insets.bottom || 0)
    - TOOLTIP_BOTTOM_GUARD;
  const placeTooltipAbove = availableSpaceBelow < TOOLTIP_ESTIMATED_HEIGHT
    && availableSpaceAbove > availableSpaceBelow;
  const rawTooltipTop = placeTooltipAbove
    ? focusLayout.y - TOOLTIP_ESTIMATED_HEIGHT - TOOLTIP_GAP
    : focusLayout.y + focusLayout.height + TOOLTIP_GAP;
  const minTooltipTop = TOOLTIP_VERTICAL_MARGIN + (insets.top || 0);
  const maxTooltipTop = Math.max(
    minTooltipTop,
    viewportHeight
      - TOOLTIP_ESTIMATED_HEIGHT
      - TOOLTIP_VERTICAL_MARGIN
      - (insets.bottom || 0)
      - TOOLTIP_BOTTOM_GUARD,
  );
  const tooltipTop = clamp(
    rawTooltipTop,
    minTooltipTop,
    maxTooltipTop,
  );

  const targetCenterX = focusLayout.x + (focusLayout.width / 2);
  const arrowLeft = clamp(
    targetCenterX - tooltipLeft - ARROW_SIZE,
    12,
    tooltipWidth - (ARROW_SIZE * 2) - 12,
  );

  const handleSkipTutorial = useCallback(() => {
    setIsTutorialVisible(false);
  }, []);

  const handlePreviousStep = useCallback(() => {
    setStepIndex((previousIndex) => Math.max(previousIndex - 1, 0));
  }, []);

  const handleNextStep = useCallback(() => {
    if (isLastStep) {
      setIsTutorialVisible(false);
      tutorial.markCompleted(tutorial.tutorialSource || 'manual');
      return;
    }
    setStepIndex((previousIndex) => Math.min(previousIndex + 1, EVENT_TUTORIAL_STEPS.length - 1));
  }, [isLastStep, tutorial]);

  return (
    <>
      <SearchScreenShell
        activeType="events"
        navigation={navigation}
        onTutorialLayout={handleTutorialLayout}
      >
        <EventListContent
          additionalFilters={eventFiltersProps}
          onTutorialLayout={handleTutorialLayout}
          showFilters
        />
      </SearchScreenShell>

      <Modal
        animationType="fade"
        onRequestClose={handleSkipTutorial}
        transparent
        visible={isTutorialVisible}
      >
        <View style={styles.modalRoot}>
          <View
            pointerEvents="none"
            style={[styles.overlayPart, {
              backgroundColor: Colors.neutral900, height: topHeight, left: 0, opacity: 0.5, right: 0, top: 0,
            }]}
          />
          <View
            pointerEvents="none"
            style={[styles.overlayPart, {
              backgroundColor: Colors.neutral900, bottom: 0, left: 0, opacity: 0.5, right: 0, top: topHeight + focusLayout.height,
            }]}
          />
          <View
            pointerEvents="none"
            style={[styles.overlayPart, {
              backgroundColor: Colors.neutral900, height: focusLayout.height, left: 0, opacity: 0.5, top: topHeight, width: leftWidth,
            }]}
          />
          <View
            pointerEvents="none"
            style={[styles.overlayPart, {
              backgroundColor: Colors.neutral900, height: focusLayout.height, opacity: 0.5, right: 0, top: topHeight, width: rightWidth,
            }]}
          />

          <View
            pointerEvents="none"
            style={[
              styles.focusFrame,
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
            style={[
              styles.tooltip,
              {
                backgroundColor: Colors.neutral00,
                left: tooltipLeft,
                top: tooltipTop,
                width: tooltipWidth,
              },
              Spaces.padding[16],
            ]}
          >
            <View
              style={[
                styles.tooltipArrow,
                placeTooltipAbove ? styles.tooltipArrowBottom : styles.tooltipArrowTop,
                {
                  borderBottomColor: !placeTooltipAbove ? Colors.neutral00 : 'transparent',
                  borderTopColor: placeTooltipAbove ? Colors.neutral00 : 'transparent',
                  left: arrowLeft,
                },
              ]}
            />

            <Text style={[Fonts.h3Bold, Fonts.neutral900, Spaces.marginBottom[8]]}>
              {currentStep?.title}
            </Text>
            <Text style={[Fonts.p1, Fonts.neutral500, Spaces.marginBottom[16]]}>
              {currentStep?.description}
            </Text>

            <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
              <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[16]]}>
                <Pressable onPress={handleSkipTutorial}>
                  <Text style={[Fonts.p2Bold, Fonts.neutral500]}>Passer</Text>
                </Pressable>
                {stepIndex > 0 ? (
                  <Pressable onPress={handlePreviousStep}>
                    <Text style={[Fonts.p2Bold, Fonts.neutral500]}>Precedent</Text>
                  </Pressable>
                ) : null}
              </View>

              <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[8]]}>
                <Text style={[Fonts.p3, Fonts.neutral400]}>
                  {stepIndex + 1}
                  /
                  {EVENT_TUTORIAL_STEPS.length}
                </Text>
                <Pressable
                  onPress={handleNextStep}
                  style={[
                    Spaces.paddingHorizontal[16],
                    Spaces.paddingVertical[8],
                    { backgroundColor: Colors.primary500, borderRadius: 20 },
                  ]}
                >
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                    {isLastStep ? 'Terminer' : 'Suivant'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  focusFrame: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    position: 'absolute',
  },
  modalRoot: {
    flex: 1,
  },
  overlayPart: {
    position: 'absolute',
  },
  tooltip: {
    borderRadius: 12,
    elevation: 20,
    position: 'absolute',
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
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

export default SearchEventsScreen;
