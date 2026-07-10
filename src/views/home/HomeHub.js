import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useIsFocused } from '@react-navigation/native';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  InteractionManager,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { navigateToRequestsHub } from '@/domains/requests/requestNavigation';
import { getDefaultRecruitmentTab } from '@/domains/search/recruitmentFlow';
import {
  getSubscriptionQuotaItem,
  getSubscriptionStatusMeta,
} from '@/domains/subscription/subscriptionDecision';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';
import { scrollTutorialTargetIntoViewOnWeb } from '@/domains/tutorial/tutorialWebRuntime';
import useFeatureTutorial from '@/domains/tutorial/useFeatureTutorial';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import LeagueHeaderSwitch from '@/components/molecules/header/LeagueHeaderSwitch';
import HomeActionCard from '@/components/molecules/homeActionCard/HomeActionCard';
import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import ExternalCompetitionPromptGate from '@/components/organisms/externalCompetitionPromptGate/ExternalCompetitionPromptGate';
import GlobalPromptModal from '@/components/organisms/popup/GlobalPromptModal';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { resolveLegacySearchTarget } from '@/views/search/searchRouteHelpers';

import { RouteNames } from '@/navigation/routeNames';

import { setTutorialDebugState, tutorialDebugLog } from '@/utils/logger/tutorialDebug';
import { markBootStep } from '@/utils/performance/bootPerformance';

import { POPUP_IDS } from '@/constants/popupRegistry';
import { ENABLE_STARTUP_TUTORIALS } from '@/constants/runtimeFlags';
import { useAppFeedback } from '@/context/AppFeedbackContext';
import { useAppMode } from '@/context/AppModeContext';
import {
  useBlockingOverlayLifecycle,
} from '@/context/BlockingOverlayContext';
import { useClubScope } from '@/context/ClubScopeContext';
import { useOnboarding } from '@/context/OnboardingContext';
import { usePopupEligibility } from '@/context/PopupManagerContext';
import { useStartupPhase } from '@/context/StartupPhaseContext';
import { useTour } from '@/context/TourContext';

const ScreenContainerView = /** @type {any} */ (ScreenContainer);

/**
 * @typedef {{
 *  id: string;
 *  order: number;
 *  title: any;
 *  description: any;
 *  nextAction?: any;
 *  nextLabel?: any;
 *  nextTargetStepId?: any;
 *  onNext?: any;
 * }} HomeCardTutorial
 */

/**
 * @typedef {{
 *  key: string;
 *  title: any;
 *  subtitle: any;
 *  onPress: () => void;
 *  disabled?: boolean;
 *  icon?: any;
 *  accentColor?: string;
 *  illustration?: import('react-native').ImageSourcePropType;
 *  illustrationPlacement?: { bottom?: number; height?: number; right?: number; width?: number };
 *  layout?: 'half' | 'full';
 *  emphasis?: 'default' | 'primary';
 *  tone?: 'default' | 'destructive';
 *  highlighted?: boolean;
 *  premiumScope?: 'club' | 'team';
 *  subtitleLines?: 1 | 2;
 *  tutorial?: any;
 * }} HomeCard
 */

/**
 * @param {{
 *  title: any;
 *  cards: HomeCard[];
 *  Fonts: any;
 *  Spaces: import('@/theme/types').Spaces;
 *  Alignments: any;
 *  registerTutorialTargetNode?: (stepId: string, node: any) => void;
 * }} props
 */

/**
 *
 * @param root0
 * @param root0.Alignments
 * @param root0.cards
 * @param root0.Fonts
 * @param root0.registerTutorialTargetNode
 * @param root0.Spaces
 * @param root0.title
 */
function HomeSection({
  Alignments,
  cards,
  Fonts,
  registerTutorialTargetNode,
  Spaces,
  title,
}) {
  const { width: screenWidth } = useWindowDimensions();
  const tutorialTargetRefs = useRef(/** @type {Record<string, any>} */ ({}));
  if (!cards.length) return null;
  const isSingleCardSection = cards.length === 1;
  const isCompactScreen = screenWidth <= 340;

  return (
    <View style={[Spaces.gap[12]]}>
      <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{title}</Text>
      <View style={[Alignments.row, Alignments.wrap, Alignments.justifySpaceBetween]}>
        {cards.map((card) => {
          const isFullCard = isCompactScreen || isSingleCardSection || card.layout === 'full';
          const cardContainerStyle = /** @type {import('react-native').ViewStyle} */ ({
            flexBasis: isFullCard ? '100%' : '48.5%',
            marginBottom: 14,
            maxWidth: isFullCard ? '100%' : '48.5%',
            width: isFullCard ? '100%' : '48.5%',
          });
          const assignTutorialTargetRef = (/** @type {any} */ node) => {
            tutorialTargetRefs.current[card.key] = node;
            if (typeof registerTutorialTargetNode === 'function' && card.tutorial?.id) {
              registerTutorialTargetNode(card.tutorial.id, node);
            }
          };

          const body = (
            <HomeActionCard
              accentColor={card.accentColor}
              disabled={card.disabled}
              emphasis={card.emphasis}
              highlighted={card.highlighted}
              icon={card.icon}
              illustration={card.illustration}
              illustrationPlacement={card.illustrationPlacement}
              onPress={card.onPress}
              premiumScope={card.premiumScope}
              subtitle={card.subtitle}
              subtitleLines={card.subtitleLines}
              title={card.title}
              tone={card.tone}
              tutorialTargetRef={card.tutorial ? assignTutorialTargetRef : undefined}
            />
          );

          if (!card.tutorial) {
            return (
              <View key={card.key} style={cardContainerStyle}>
                {body}
              </View>
            );
          }

          return (
            <View key={card.key} style={cardContainerStyle}>
              <OnboardingWrapper
                description={card.tutorial.description}
                id={card.tutorial.id}
                nextAction={card.tutorial.nextAction}
                nextLabel={card.tutorial.nextLabel}
                nextTargetStepId={card.tutorial.nextTargetStepId}
                onNext={card.tutorial.onNext}
                order={card.tutorial.order}
                spotlight={{
                  borderRadius: 16,
                  overlayOpacity: 0.42,
                  paddingX: 0,
                  paddingY: 0,
                }}
                style={{
                  alignSelf: 'flex-start',
                  width: '100%',
                }}
                targetNodeResolver={() => tutorialTargetRefs.current[card.key] || null}
                title={card.tutorial.title}
              >
                {body}
              </OnboardingWrapper>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/**
 * @param {{
 *  actionLabel?: string;
 *  description: any;
 *  isLoading?: boolean;
 *  onAction?: () => void;
 *  title: any;
 * }} props
 */
function HomeHubStateView({
  actionLabel,
  description,
  isLoading = false,
  onAction,
  title,
}) {
  const {
    Alignments,
    ApplicationStyle,
    Fonts,
    Spaces,
  } = useTheme();

  return (
    <ScreenContainerView
      bgImage="bg2"
      contentContainerStyle={[
        Alignments.fill,
        Alignments.justifyCenter,
      ]}
      contentWidth="readable"
      responsivePadding
      withHeaderPadding={false}
    >
      <View
        style={[
          ApplicationStyle.borderRadius24,
          ApplicationStyle.borderWidth1,
          Spaces.padding[24],
          Spaces.gap[16],
          {
            alignSelf: 'center',
            backgroundColor: 'rgba(9, 24, 35, 0.88)',
            borderColor: 'rgba(255,255,255,0.08)',
            maxWidth: 560,
            width: '100%',
          },
        ]}
      >
        <Text style={[Fonts.h2, Fonts.neutral00]}>{title}</Text>
        <Text style={[Fonts.p1, Fonts.neutral100]}>{description}</Text>
        {isLoading ? (
          <View style={[Alignments.alignCenter, Spaces.paddingVertical[8]]}>
            <Loader />
          </View>
        ) : null}
        {onAction && actionLabel ? (
          <Button
            onPress={onAction}
            title={actionLabel}
            variant="Primary"
          />
        ) : null}
      </View>
    </ScreenContainerView>
  );
}

/**
 * @param {import('@react-navigation/stack').StackScreenProps<any> & { auth: ReturnType<typeof useAuth> }} props
 */
function HomeHubContent({ auth, navigation, route }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const [{ fcmToken }] = useAppContext();
  const { isGold, toggleMode } = useAppMode();
  const {
    currentStep,
    currentStepIndex,
    getStepById,
    isActive: isOnboardingActive,
    refreshCurrentStep,
    startOnboarding,
  } = /** @type {any} */ (useOnboarding());
  const {
    canShowLocalScreenPrompt,
    hasRecentStartupPrompt,
    isStartupStable,
  } = useStartupPhase();
  const {
    canPublishGovernedClubContent,
    freeUsageSummary,
    governedPublishingBlockReason,
    logoutMutation,
    nonPartnerCoachPublishingAccess,
    subscriptionAccessLevel,
    userData,
  } = auth;
  const clubScope = useClubScope() || {};
  const { showBanner } = useAppFeedback();

  const homeHubTutorial = useFeatureTutorial({
    routeParams: route?.params,
    tutorialId: TutorialIds.HOME_HUB,
    userId: userData?.documentId,
  });

  const [activeTutorialModal, setActiveTutorialModal] = useState(/** @type {'center' | 'feature' | null} */ (null));
  const [contextualPrompt, setContextualPrompt] = useState(/** @type {any | null} */ (null));
  const [isEntryGateVisible, setIsEntryGateVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { height: viewportHeight } = useWindowDimensions();
  const isFocused = useIsFocused();
  const scrollRef = useRef(/** @type {import('react-native').ScrollView | null} */ (null));
  const tutorialTargetNodesRef = useRef(/** @type {Record<string, any>} */ ({}));
  const refreshCurrentStepRef = useRef(refreshCurrentStep);
  const pendingNavigationActionRef = useRef(/** @type {null | (() => void)} */ (null));
  const previousTutorialStepRef = useRef(/** @type {{ id?: string; index?: number } | null} */ (null));
  const sectionAnchorsRef = useRef(/** @type {Record<string, { height: number; y: number }>} */ ({
    account: { height: 0, y: 0 },
    league: { height: 0, y: 0 },
    manage: { height: 0, y: 0 },
    profile: { height: 0, y: 0 },
    quick: { height: 0, y: 0 },
    search: { height: 0, y: 0 },
  }));
  const sectionViewRefs = useRef(/** @type {Record<string, any>} */ ({
    account: null,
    league: null,
    manage: null,
    profile: null,
    quick: null,
    search: null,
  }));

  const roleName = userData?.role?.name;
  const roleKey = getUserRoleKey(roleName);
  const isCoach = roleKey === 'coach';
  const isPresident = roleKey === 'president';
  const canShowSubscriptionExperience = isCoach || isPresident || roleKey === 'superAdmin';
  const hasManageSection = isCoach || isPresident;
  const isGovernedNonPartnerCoach = nonPartnerCoachPublishingAccess?.isNonPartnerCoach === true;
  const isPublishingGovernedBlocked = isGovernedNonPartnerCoach
    && canPublishGovernedClubContent !== true;
  const routeParams = route?.params;
  const scrollBottomPadding = tabBarHeight + insets.bottom + 16;
  const entryGateTopInset = Math.max(insets.top, 20) + 16;
  const entryGateBottomInset = Platform.OS === 'web'
    ? Math.max(tabBarHeight + insets.bottom, 112)
    : tabBarHeight + insets.bottom + 20;
  const entryGateMaxHeight = Math.max(260, viewportHeight - entryGateTopInset - entryGateBottomInset);

  const trainedTeamIds = useMemo(
    () => (userData?.trainedTeams || [])
      .map((/** @type {any} */ team) => team?.documentId)
      .filter(Boolean),
    [userData?.trainedTeams],
  );
  const clubId = userData?.club?.documentId;
  const cmId = clubScope.activeMultisportClubId || userData?.multisportClubs?.[0]?.documentId;
  const isTutorialCenterVisible = false;
  const isFeatureTutorialPickerVisible = false;
  const closeContextualPrompt = useCallback(() => {
    setContextualPrompt(null);
  }, []);
  const openContextualPrompt = useCallback((/** @type {any} */ promptConfig) => {
    setContextualPrompt(promptConfig);
  }, []);
  const homeHubEntryPopup = usePopupEligibility(
    POPUP_IDS.HOME_HUB_ENTRY_GATE,
    Boolean(isFocused && isEntryGateVisible),
    {
      cooldownKey: userData?.documentId || 'anonymous',
    },
  );
  const isHomeHubEntryGateVisible = false;
  useBlockingOverlayLifecycle(homeHubEntryPopup.descriptor.id, isHomeHubEntryGateVisible, {
    releaseDelayMs: 320,
  });
  const shouldRenderLegacyEntryGate = Platform.OS !== 'web' && isHomeHubEntryGateVisible;
  const isExternalCompetitionPromptEnabled = isFocused
    && isStartupStable
    && canShowLocalScreenPrompt
    && !hasRecentStartupPrompt
    && !isOnboardingActive
    && !homeHubTutorial.shouldForceStart
    && activeTutorialModal === null
    && !isHomeHubEntryGateVisible;

  const legacySearchTarget = useMemo(() => resolveLegacySearchTarget(routeParams, userData), [routeParams, userData]);
  const subscriptionStatusMeta = useMemo(
    () => getSubscriptionStatusMeta(subscriptionAccessLevel),
    [subscriptionAccessLevel],
  );
  const eventPublishQuotaItem = useMemo(
    () => getSubscriptionQuotaItem(freeUsageSummary, 'EVENT_PUBLISH', subscriptionAccessLevel),
    [freeUsageSummary, subscriptionAccessLevel],
  );

  const lastLegacyRedirectRef = useRef('');
  useEffect(() => {
    refreshCurrentStepRef.current = refreshCurrentStep;
  }, [refreshCurrentStep]);

  useEffect(() => {
    if (!legacySearchTarget) return;
    const redirectKey = JSON.stringify(legacySearchTarget);
    if (redirectKey === lastLegacyRedirectRef.current) return;
    lastLegacyRedirectRef.current = redirectKey;

    navigation.navigate(legacySearchTarget.routeName, legacySearchTarget.params);
    navigation.setParams({
      initialRecruitmentTab: undefined,
      initialSearchType: undefined,
      initialTab: undefined,
      timestamp: undefined,
    });
  }, [legacySearchTarget, navigation]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      tutorialDebugLog('homehub.blur.closeModals');
      setActiveTutorialModal(null);
      pendingNavigationActionRef.current = null;
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (isFocused) return;
    tutorialDebugLog('homehub.unfocused.resetModals');
    setActiveTutorialModal(null);
    setIsEntryGateVisible(false);
    pendingNavigationActionRef.current = null;
  }, [isFocused]);

  useEffect(() => {
    if (!isOnboardingActive) return;
    setActiveTutorialModal(null);
    setIsEntryGateVisible(false);
  }, [isOnboardingActive]);

  useEffect(() => {
    if (!isFocused || !userData?.documentId) {
      setIsEntryGateVisible(false);
      return;
    }
    if (!ENABLE_STARTUP_TUTORIALS || !isStartupStable || !canShowLocalScreenPrompt || hasRecentStartupPrompt) {
      setIsEntryGateVisible(false);
      return;
    }
    if (isOnboardingActive || homeHubTutorial.shouldForceStart) {
      setIsEntryGateVisible(false);
      return;
    }
    const shouldShowEntryGate = homeHubTutorial.entryGateChoice === 'pending';
    setIsEntryGateVisible((previousValue) => (
      previousValue === shouldShowEntryGate ? previousValue : shouldShowEntryGate
    ));
  }, [
    homeHubTutorial.entryGateChoice,
    homeHubTutorial.shouldForceStart,
    canShowLocalScreenPrompt,
    hasRecentStartupPrompt,
    isStartupStable,
    isFocused,
    isOnboardingActive,
    userData?.documentId,
  ]);

  useEffect(() => {
    if (!isHomeHubEntryGateVisible) return;
    homeHubEntryPopup.markShown(/** @type {any} */ ({
      userId: userData?.documentId || 'anonymous',
    }));
  }, [homeHubEntryPopup, isHomeHubEntryGateVisible, userData?.documentId]);

  const registerSectionAnchor = useCallback((/** @type {string} */ sectionKey, /** @type {any} */ event) => {
    const nextY = event?.nativeEvent?.layout?.y ?? 0;
    const nextHeight = event?.nativeEvent?.layout?.height ?? 0;
    const previous = sectionAnchorsRef.current[sectionKey];
    if (
      Math.abs((previous?.y || 0) - nextY) < 1
      && Math.abs((previous?.height || 0) - nextHeight) < 1
    ) {
      return;
    }
    sectionAnchorsRef.current[sectionKey] = {
      height: nextHeight,
      y: nextY,
    };
  }, []);

  const registerSectionViewRef = useCallback((/** @type {string} */ sectionKey, /** @type {any} */ node) => {
    sectionViewRefs.current[sectionKey] = node;
  }, []);

  const registerTutorialTargetNode = useCallback((/** @type {string} */ stepId, /** @type {any} */ node) => {
    if (!stepId) return;
    if (node) {
      tutorialTargetNodesRef.current[stepId] = node;
      return;
    }
    delete tutorialTargetNodesRef.current[stepId];
  }, []);

  const waitForWebScrollSettle = useCallback((/** @type {number} */ targetTop) => new Promise((resolve) => {
    if (Platform.OS !== 'web') {
      resolve(undefined);
      return;
    }

    const startTime = Date.now();
    const maxWaitMs = 1400;
    let lastScrollY = window.scrollY;
    let stableFrameCount = 0;

    const checkScroll = () => {
      const currentScrollY = window.scrollY;
      const hasReachedTarget = Math.abs(currentScrollY - targetTop) <= 2;
      const isStable = Math.abs(currentScrollY - lastScrollY) <= 1;

      if (hasReachedTarget && isStable) {
        stableFrameCount += 1;
      } else if (isStable) {
        stableFrameCount += 0.5;
      } else {
        stableFrameCount = 0;
      }

      if (stableFrameCount >= 2 || (Date.now() - startTime) >= maxWaitMs) {
        resolve(undefined);
        return;
      }

      lastScrollY = currentScrollY;
      requestAnimationFrame(checkScroll);
    };

    requestAnimationFrame(checkScroll);
  }), []);

  const scrollToSection = useCallback((/** @type {string} */ sectionKey) => {
    const SECTION_TARGET_TOP = 170;
    const REFRESH_DELAYS = Platform.OS === 'web'
      ? [140, 320, 560]
      : [80, 180, 320];
    const FINAL_REFRESH_DELAY = REFRESH_DELAYS[REFRESH_DELAYS.length - 1] || 0;

    return new Promise((resolve) => {
      let attempts = 0;
      const maxAttempts = 5;

      const resolveAfterRefresh = () => {
        REFRESH_DELAYS.forEach((delay) => {
          setTimeout(() => {
            refreshCurrentStepRef.current?.();
          }, delay);
        });
        setTimeout(() => resolve(undefined), FINAL_REFRESH_DELAY + 40);
      };

      const tryScroll = () => {
        attempts += 1;
        if (Platform.OS === 'web') {
          const sectionView = sectionViewRefs.current[sectionKey];
          if (typeof sectionView?.getBoundingClientRect === 'function') {
            const rect = sectionView.getBoundingClientRect();
            if (!rect.width || !rect.height) {
              if (attempts < maxAttempts) {
                setTimeout(tryScroll, 120);
              } else {
                resolve(undefined);
              }
              return;
            }

            const nextTop = Math.max(
              0,
              window.scrollY + rect.top - SECTION_TARGET_TOP,
            );
            window.scrollTo({
              behavior: 'smooth',
              top: nextTop,
            });
            waitForWebScrollSettle(nextTop).then(resolveAfterRefresh);
            return;
          }

          if (typeof sectionView?.measureInWindow === 'function') {
            sectionView.measureInWindow((
              /** @type {number} */ _measuredX,
              /** @type {number} */ measuredY,
              /** @type {number} */ width,
              /** @type {number} */ height,
            ) => {
              if (!width || !height) {
                if (attempts < maxAttempts) {
                  setTimeout(tryScroll, 120);
                } else {
                  resolve(undefined);
                }
                return;
              }

              const nextTop = Math.max(
                0,
                window.scrollY + measuredY - SECTION_TARGET_TOP,
              );
              window.scrollTo({
                behavior: 'smooth',
                top: nextTop,
              });
              waitForWebScrollSettle(nextTop).then(resolveAfterRefresh);
            });
            return;
          }
        }

        const sectionAnchor = sectionAnchorsRef.current[sectionKey];
        if (!(sectionAnchor?.height > 0)) {
          if (attempts < maxAttempts) {
            setTimeout(tryScroll, 120);
          } else {
            resolve(undefined);
          }
          return;
        }

        const targetY = Math.max(
          0,
          (sectionAnchor.y || 0) - SECTION_TARGET_TOP,
        );

        scrollRef.current?.scrollTo({
          animated: true,
          y: targetY,
        });

        resolveAfterRefresh();
      };

      tryScroll();
    });
  }, [waitForWebScrollSettle]);

  const scrollToTop = useCallback(() => {
    const REFRESH_DELAYS = Platform.OS === 'web'
      ? [140, 320, 560]
      : [80, 180, 320];
    const FINAL_REFRESH_DELAY = REFRESH_DELAYS[REFRESH_DELAYS.length - 1] || 0;

    return new Promise((resolve) => {
      if (Platform.OS === 'web') {
        const targetTop = 0;
        window.scrollTo({
          behavior: 'smooth',
          top: targetTop,
        });
        waitForWebScrollSettle(targetTop).then(() => {
          REFRESH_DELAYS.forEach((delay) => {
            setTimeout(() => {
              refreshCurrentStepRef.current?.();
            }, delay);
          });
          setTimeout(() => resolve(undefined), FINAL_REFRESH_DELAY + 40);
        });
        return;
      }
      scrollRef.current?.scrollTo({
        animated: true,
        y: 0,
      });
      REFRESH_DELAYS.forEach((delay) => {
        setTimeout(() => {
          refreshCurrentStepRef.current?.();
        }, delay);
      });
      setTimeout(() => resolve(undefined), FINAL_REFRESH_DELAY + 40);
    });
  }, [waitForWebScrollSettle]);

  const scrollToTutorialTarget = useCallback((
    /** @type {string} */ targetStepId,
    /** @type {string | null} */ fallbackSectionKey = null,
  ) => {
    const runFallbackScroll = () => (
      fallbackSectionKey ? scrollToSection(fallbackSectionKey) : Promise.resolve(null)
    );

    const targetStep = /** @type {any} */ (getStepById(targetStepId));
    const getTargetNode = targetStep?.getTargetNode;
    const resolveTargetNode = () => (
      tutorialTargetNodesRef.current[targetStepId]
      || (typeof getTargetNode === 'function' ? getTargetNode() : null)
    );
    const targetNode = resolveTargetNode();
    let targetNodeSource = 'unresolved';
    if (tutorialTargetNodesRef.current[targetStepId]) {
      targetNodeSource = 'homehub-registry';
    } else if (typeof getTargetNode === 'function') {
      targetNodeSource = 'step-registry';
    }

    tutorialDebugLog('homehub.scrollToTutorialTarget', {
      fallbackSectionKey,
      targetStepId,
    });
    setTutorialDebugState({
      lastRequestedFallbackSection: fallbackSectionKey,
      lastRequestedTargetId: targetStepId,
      lastScrollMode: null,
      targetNodeFound: Boolean(targetNode),
      targetNodeSource,
      targetStepFound: Boolean(targetStep),
      windowScrollY: Platform.OS === 'web' && typeof window !== 'undefined' ? window.scrollY : null,
    });

    if (Platform.OS !== 'web') {
      setTutorialDebugState({
        lastFailureReason: 'homehub-scroll-non-web',
        lastScrollMode: 'fallback',
      });
      return runFallbackScroll();
    }

    if (!targetNode && typeof getTargetNode !== 'function') {
      setTutorialDebugState({
        lastFailureReason: 'homehub-scroll-target-missing',
        lastScrollMode: 'fallback',
      });
      return runFallbackScroll();
    }

    return scrollTutorialTargetIntoViewOnWeb(resolveTargetNode, {
      bottomInset: Math.max(tabBarHeight + insets.bottom, 112) + 16,
      preferredPlacement: 'above',
      tooltipGap: 24,
      tooltipHeight: 220,
      topInset: Math.max(insets.top, 16) + 88,
    }).then((resolvedLayout) => {
      if (!resolvedLayout) {
        setTutorialDebugState({
          lastFailureReason: 'homehub-scroll-target-unresolved',
          lastScrollMode: 'fallback',
          windowScrollY: Platform.OS === 'web' && typeof window !== 'undefined' ? window.scrollY : null,
        });
        return runFallbackScroll();
      }

      setTutorialDebugState({
        lastFailureReason: null,
        lastResolvedStepId: targetStepId,
        lastResolvedTargetId: targetStepId,
        lastScrollMode: 'target',
        windowScrollY: Platform.OS === 'web' && typeof window !== 'undefined' ? window.scrollY : null,
      });
      return resolvedLayout;
    });
  }, [getStepById, insets.bottom, insets.top, scrollToSection, tabBarHeight]);

  const scrollToSearchSection = useCallback(() => (
    scrollToTutorialTarget('homehub-searchEvents', 'search')
  ), [scrollToTutorialTarget]);

  const scrollToLeagueSection = useCallback(() => (
    scrollToTutorialTarget('homehub-league', 'league')
  ), [scrollToTutorialTarget]);

  const scrollToProfileSection = useCallback(() => (
    scrollToTutorialTarget('homehub-profileView', 'profile')
  ), [scrollToTutorialTarget]);

  const scrollToQuickSection = useCallback(() => (
    scrollToTutorialTarget('homehub-quickPlanning', 'quick')
  ), [scrollToTutorialTarget]);

  const scrollToAccountSection = useCallback(() => (
    scrollToTutorialTarget('homehub-accountSwitch', 'account')
  ), [scrollToTutorialTarget]);

  const getHomeHubSectionForStepId = useCallback((/** @type {string | undefined | null} */ stepId) => {
    if (!stepId || typeof stepId !== 'string') return null;
    if (!stepId.startsWith('homehub-')) return null;
    if (stepId === 'homehub-header') return 'top';

    const normalized = stepId.replace('homehub-', '');

    if (normalized.startsWith('manage')) return 'manage';
    if (normalized.startsWith('search')) return 'search';
    if (normalized === 'league') return 'league';
    if (normalized.startsWith('profile')) return 'profile';
    if (normalized.startsWith('quick')) return 'quick';
    if (normalized.startsWith('account') || normalized === 'tutorialCenter') return 'account';

    return null;
  }, []);

  useEffect(() => {
    if (!isOnboardingActive) {
      previousTutorialStepRef.current = null;
      return;
    }

    const currentId = currentStep?.id;
    const currentIndex = currentStepIndex;
    const previous = previousTutorialStepRef.current;

    const previousIndex = typeof previous?.index === 'number' ? previous.index : null;
    const isBackward = previousIndex !== null && typeof currentIndex === 'number' && currentIndex < previousIndex;

    if (isBackward) {
      const previousSection = getHomeHubSectionForStepId(previous?.id);
      const currentSection = getHomeHubSectionForStepId(currentId);

      if (currentSection && currentSection !== previousSection) {
        tutorialDebugLog('homehub.backwardScroll', {
          currentId,
          currentIndex,
          fromIndex: previousIndex,
          fromSection: previousSection,
          toSection: currentSection,
        });

        if (currentSection === 'top') {
          scrollToTop();
        } else {
          scrollToTutorialTarget(currentId, currentSection);
        }
      }
    }

    previousTutorialStepRef.current = {
      id: currentId,
      index: currentIndex,
    };
  }, [
    currentStep?.id,
    currentStepIndex,
    getHomeHubSectionForStepId,
    isOnboardingActive,
    scrollToTutorialTarget,
    scrollToTop,
  ]);

  const openFeatureTutorialPicker = useCallback(() => {
    setActiveTutorialModal('feature');
  }, []);

  const closeTutorialCenterModal = useCallback(() => {
    setActiveTutorialModal((previousModal) => (
      previousModal === 'center' ? null : previousModal
    ));
  }, []);

  const closeFeatureTutorialPicker = useCallback(() => {
    setActiveTutorialModal((previousModal) => (
      previousModal === 'feature' ? null : previousModal
    ));
  }, []);

  const closeTutorialModals = useCallback(() => {
    setActiveTutorialModal(null);
  }, []);

  const runPendingNavigation = useCallback((/** @type {number} */ delayMs) => {
    if (!isFocused) return undefined;
    const navigateAction = pendingNavigationActionRef.current;
    if (!navigateAction) return undefined;
    pendingNavigationActionRef.current = null;
    tutorialDebugLog('homehub.runPendingNavigation', { delayMs });

    const timer = setTimeout(() => {
      InteractionManager.runAfterInteractions(() => {
        requestAnimationFrame(() => {
          tutorialDebugLog('homehub.executePendingNavigation');
          navigateAction();
        });
      });
    }, delayMs);

    return () => clearTimeout(timer);
  }, [isFocused]);

  const navigateAfterClosingModals = useCallback((/** @type {() => void} */ navigateAction) => {
    pendingNavigationActionRef.current = navigateAction;
    tutorialDebugLog('homehub.navigateAfterClosingModals', {
      activeTutorialModal,
    });
    if (activeTutorialModal === null) {
      runPendingNavigation(0);
      return;
    }
    closeTutorialModals();
  }, [activeTutorialModal, closeTutorialModals, runPendingNavigation]);

  useEffect(() => {
    if (!isFocused) return undefined;
    if (activeTutorialModal !== null) return undefined;
    const MODAL_DISMISS_DELAY_MS = 320;
    return runPendingNavigation(MODAL_DISMISS_DELAY_MS);
  }, [activeTutorialModal, isFocused, runPendingNavigation]);

  const launchHomeTutorialFlow = useCallback(() => {
    let attempts = 0;
    const maxAttempts = 10;

    const tryStart = () => {
      attempts += 1;
      const didStart = /** @type {any} */ (startOnboarding)({ forceFromStart: true });

      if (didStart) {
        homeHubTutorial.markSeen('manual');
        return;
      }

      if (attempts < maxAttempts) {
        setTimeout(tryStart, 110);
      }
    };

    requestAnimationFrame(tryStart);
  }, [homeHubTutorial, startOnboarding]);

  const startHomeTutorial = useCallback(() => {
    closeTutorialModals();
    homeHubTutorial.resetTutorial();
    scrollToTop().finally(() => {
      InteractionManager.runAfterInteractions(() => {
        launchHomeTutorialFlow();
      });
    });
  }, [closeTutorialModals, homeHubTutorial, launchHomeTutorialFlow, scrollToTop]);

  const handleEntryStartTutorial = useCallback(() => {
    homeHubEntryPopup.trackEvent('accepted', /** @type {any} */ ({ action: 'start_tutorial' }));
    homeHubTutorial.setEntryChoice('start');
    homeHubTutorial.setAutoEnabled(true);
    setIsEntryGateVisible(false);
    closeTutorialModals();
    homeHubTutorial.resetTutorial();
    scrollToTop().finally(() => {
      InteractionManager.runAfterInteractions(() => {
        launchHomeTutorialFlow();
      });
    });
  }, [closeTutorialModals, homeHubEntryPopup, homeHubTutorial, launchHomeTutorialFlow, scrollToTop]);

  const handleEntrySkipTutorial = useCallback(() => {
    homeHubEntryPopup.dismiss();
    homeHubTutorial.skipAllAuto();
    setIsEntryGateVisible(false);
    closeTutorialModals();
  }, [closeTutorialModals, homeHubEntryPopup, homeHubTutorial]);

  const navigateToTutorial = useCallback((/** @type {string} */ tutorialId) => {
    const tutorialParams = {
      startTutorial: true,
      tutorialId,
      tutorialSource: 'homeHub',
      tutorialStartToken: Date.now(),
    };

    switch (tutorialId) {
      case TutorialIds.ACCOUNT_SWITCHER_MODAL:
        navigateAfterClosingModals(() => {
          navigation.navigate(RouteNames.ProfileStack, {
            params: { ...tutorialParams, openAccountModal: true },
            screen: RouteNames.Profile,
          });
        });
        return;
      case TutorialIds.CLUB_MEMBERSHIP_REQUESTS:
        if (!clubId) {
          showBanner({
            body: t('homeHub.alerts.noClub.description', 'Votre compte doit être rattaché à un club pour gérer ces demandes.'),
            title: t('homeHub.alerts.noClub.title', 'Club introuvable'),
            tone: 'error',
          });
          return;
        }
        navigateAfterClosingModals(() => {
          navigateToRequestsHub(navigation, {
            ...tutorialParams,
            initialFilter: 'club',
            source: 'home',
          });
        });
        return;
      case TutorialIds.EVENT_WIZARD_TYPE:
        navigateAfterClosingModals(() => {
          navigation.navigate(RouteNames.EventStack, {
            params: tutorialParams,
            screen: RouteNames.EventWizardType,
          });
        });
        return;
      case TutorialIds.FEATURED_REQUESTS:
        if (cmId) {
          navigateAfterClosingModals(() => {
            navigateToRequestsHub(navigation, {
              ...tutorialParams,
              initialFilter: 'featured',
              source: 'home',
            });
          });
          return;
        }
        if (clubId) {
          navigateAfterClosingModals(() => {
            navigateToRequestsHub(navigation, {
              ...tutorialParams,
              initialFilter: 'event',
              source: 'home',
            });
          });
        }
        return;
      case TutorialIds.HISTORY_WIZARD:
        navigateAfterClosingModals(() => {
          navigation.navigate(RouteNames.ProfileStack, {
            params: { ...tutorialParams, resetContext: true, returnRoute: RouteNames.HomeTab },
            screen: RouteNames.HistoryWizardCategory,
          });
        });
        return;
      case TutorialIds.LOGOUT_CONFIRMATION:
        navigateAfterClosingModals(() => {
          navigation.navigate(RouteNames.ProfileStack, {
            params: tutorialParams,
            screen: RouteNames.Profile,
          });
        });
        return;
      case TutorialIds.MESSAGING:
        navigateAfterClosingModals(() => {
          navigation.navigate(RouteNames.HomeTab, { params: tutorialParams, screen: RouteNames.Chat });
        });
        return;
      case TutorialIds.MY_TEAMS:
        navigateAfterClosingModals(() => {
          navigation.navigate(RouteNames.HomeTab, { params: tutorialParams, screen: RouteNames.MyTeamList });
        });
        return;
      case TutorialIds.PLANNING:
        navigateAfterClosingModals(() => {
          navigation.navigate(RouteNames.HomeTab, { params: tutorialParams, screen: RouteNames.MyEventList });
        });
        return;
      case TutorialIds.PROFILE_EDIT:
        navigateAfterClosingModals(() => {
          navigation.navigate(RouteNames.ProfileStack, { params: tutorialParams, screen: RouteNames.ProfileEdit });
        });
        return;
      case TutorialIds.PROFILE_MAIN:
        navigateAfterClosingModals(() => {
          navigation.navigate(RouteNames.ProfileStack, { params: tutorialParams, screen: RouteNames.Profile });
        });
        return;
      case TutorialIds.REQUESTS_DASHBOARD:
        navigateAfterClosingModals(() => {
          navigateToRequestsHub(navigation, {
            ...tutorialParams,
            initialFilter: 'all',
            source: 'home',
          });
        });
        return;
      case TutorialIds.SEARCH_CLUBS:
        navigateAfterClosingModals(() => {
          navigation.navigate(RouteNames.SearchClubs, tutorialParams);
        });
        return;
      case TutorialIds.SEARCH_EVENTS:
        navigateAfterClosingModals(() => {
          navigation.navigate(RouteNames.SearchEvents, tutorialParams);
        });
        return;
      case TutorialIds.SEARCH_RECRUITMENT:
        navigateAfterClosingModals(() => {
          navigation.navigate(RouteNames.SearchRecruitment, {
            ...tutorialParams,
            initialRecruitmentTab: getDefaultRecruitmentTab(userData),
          });
        });
        return;
      case TutorialIds.SEARCH_RESERVATIONS:
        navigateAfterClosingModals(() => {
          navigation.navigate(RouteNames.SearchReservations, tutorialParams);
        });
        return;
      case TutorialIds.TEAM_MEMBERSHIP_REQUESTS:
        if (!trainedTeamIds.length) {
          showBanner({
            body: t('homeHub.alerts.noTrainedTeams.description', 'Vous devez être entraîneur d\'au moins une équipe pour gérer les demandes d\'adhésion.'),
            title: t('homeHub.alerts.noTrainedTeams.title', 'Aucune équipe disponible'),
            tone: 'error',
          });
          return;
        }
        navigateAfterClosingModals(() => {
          navigateToRequestsHub(navigation, {
            ...tutorialParams,
            initialFilter: 'team',
            source: 'home',
          });
        });
        break;

      default:
    }
  }, [clubId, cmId, navigateAfterClosingModals, navigation, showBanner, t, trainedTeamIds, userData]);

  const handleResetAllTutorials = useCallback(() => {
    openContextualPrompt({
      body: t('homeHubTutorial.reset.description', 'Tous les tutoriels seront remis a zero pour ce compte.'),
      primaryAction: {
        label: t('homeHubTutorial.reset.confirm', 'Réinitialiser'),
        onPress: () => {
          closeContextualPrompt();
          homeHubTutorial.resetAllTutorials();
          closeTutorialModals();
          scrollRef.current?.scrollTo({ animated: false, y: 0 });
          InteractionManager.runAfterInteractions(() => {
            launchHomeTutorialFlow();
          });
        },
        variant: 'Primary',
      },
      secondaryAction: {
        label: t('common.actions.cancel', 'Annuler'),
        onPress: closeContextualPrompt,
        variant: 'Secondary',
      },
      title: t('homeHubTutorial.reset.title', 'Réinitialiser les tutoriels'),
      tone: 'critical',
    });
  }, [closeContextualPrompt, closeTutorialModals, homeHubTutorial, launchHomeTutorialFlow, openContextualPrompt, t]);

  const handleOpenLeague = useCallback(() => {
    const targetRoute = RouteNames.LeagueHomeTab;
    if (!isGold) toggleMode();

    const currentRouteNames = navigation?.getState?.()?.routeNames || [];
    if (currentRouteNames.includes(targetRoute)) {
      navigation.navigate(targetRoute);
      return;
    }

    const parentNavigation = navigation?.getParent?.();
    const parentRouteNames = parentNavigation?.getState?.()?.routeNames || [];
    if (parentNavigation && parentRouteNames.includes(targetRoute)) {
      parentNavigation.navigate(targetRoute);
      return;
    }

    navigation.navigate(targetRoute);
  }, [isGold, navigation, toggleMode]);

  const handleAddEvent = useCallback(() => {
    if (isPublishingGovernedBlocked) {
      showBanner({
        body: t(
          'homeHub.alerts.nonPartnerCoachPublishingBlocked.description',
          "Ton club n'est pas encore certifié sur FoundClub. Un superadmin doit autoriser la publication avant de créer un événement.",
        ),
        title: t(
          'homeHub.alerts.nonPartnerCoachPublishingBlocked.title',
          'Publication en attente d autorisation',
        ),
        tone: 'warning',
      });
      return;
    }

    navigation.navigate(RouteNames.EventStack, { screen: RouteNames.EventWizardType });
  }, [isPublishingGovernedBlocked, navigation, showBanner, t]);

  const handleAddRecruitmentAd = useCallback(() => {
    if (isPublishingGovernedBlocked) {
      showBanner({
        body: t(
          'homeHub.alerts.nonPartnerCoachPublishingBlocked.adDescription',
          "Ton club n'est pas encore certifié sur FoundClub. Un superadmin doit autoriser la publication avant de créer une annonce.",
        ),
        title: t(
          'homeHub.alerts.nonPartnerCoachPublishingBlocked.title',
          'Publication en attente d autorisation',
        ),
        tone: 'warning',
      });
      return;
    }

    navigation.navigate(RouteNames.AdWizardStack);
  }, [isPublishingGovernedBlocked, navigation, showBanner, t]);

  const handleOpenMyRecruitmentAds = useCallback(() => {
    navigation.navigate(RouteNames.SearchRecruitment, {
      initialRecruitmentTab: 'annonces',
    });
  }, [navigation]);

  const handleOpenClubLicenses = useCallback(() => {
    if (!clubId) {
      showBanner({
        body: t('homeHub.alerts.missingContext.description', 'Aucun club disponible pour cette action.'),
        title: t('homeHub.alerts.missingContext.title', 'Contexte manquant'),
        tone: 'error',
      });
      return;
    }

    navigation.navigate(RouteNames.ClubStack, {
      params: { clubId },
      screen: RouteNames.ClubLicenses,
    });
  }, [clubId, navigation, showBanner, t]);

  const handleOpenMyLicense = useCallback(() => {
    navigation.navigate(RouteNames.MyLicense);
  }, [navigation]);

  const handleOpenRequestsHub = useCallback((/** @type {any} */ initialFilter = 'all') => {
    const hasRequestsContext = Boolean(clubId || cmId || trainedTeamIds.length);
    if (!hasRequestsContext) {
      showBanner({
        body: t('homeHub.alerts.missingContext.description', 'Aucun club disponible pour gérer les demandes à la une.'),
        title: t('homeHub.alerts.missingContext.title', 'Contexte manquant'),
        tone: 'error',
      });
      return;
    }

    navigateToRequestsHub(navigation, {
      initialFilter,
      source: 'home',
    });
  }, [clubId, cmId, navigation, showBanner, t, trainedTeamIds.length]);

  const handleOpenManageClub = useCallback(() => {
    if (clubId) {
      navigation.navigate(RouteNames.ClubStack, {
        params: { clubId },
        screen: RouteNames.Club,
      });
      return;
    }

    if (cmId) {
      navigation.navigate(RouteNames.CMDashboard, { cmId });
      return;
    }

    showBanner({
      body: t('homeHub.alerts.missingContext.description', 'Aucun club disponible pour gérer les demandes à la une.'),
      title: t('homeHub.alerts.missingContext.title', 'Contexte manquant'),
      tone: 'error',
    });
  }, [clubId, cmId, navigation, showBanner, t]);

  const handleOpenProfile = useCallback(() => {
    const currentUserId = userData?.documentId || userData?.id;
    if (!currentUserId) {
      navigation.navigate(RouteNames.ProfileStack, { screen: RouteNames.Profile });
      return;
    }

    navigation.navigate(RouteNames.ProfileStack, {
      params: { userId: currentUserId },
      screen: RouteNames.UserDetails,
    });
  }, [navigation, userData?.documentId, userData?.id]);

  const handleOpenSubscriptionOverview = useCallback(() => {
    navigation.navigate(RouteNames.ProfileStack, {
      screen: RouteNames.SubscriptionOverview,
    });
  }, [navigation]);

  const handleEditProfile = useCallback(() => {
    navigation.navigate(RouteNames.ProfileStack, { screen: RouteNames.ProfileEdit });
  }, [navigation]);

  const handleOpenHistory = useCallback(() => {
    navigation.navigate(RouteNames.ProfileStack, {
      params: { resetContext: true, returnRoute: RouteNames.HomeTab },
      screen: RouteNames.HistoryWizardCategory,
    });
  }, [navigation]);

  const handleOpenSearchAlerts = useCallback(() => {
    navigation.navigate(RouteNames.SearchAlerts);
  }, [navigation]);

  const handleOpenPlanning = useCallback(() => {
    navigation.navigate(RouteNames.HomeTab, { screen: RouteNames.MyEventList });
  }, [navigation]);

  const handleOpenMyTeams = useCallback(() => {
    navigation.navigate(RouteNames.HomeTab, { screen: RouteNames.MyTeamList });
  }, [navigation]);

  const handleOpenMessaging = useCallback(() => {
    navigation.navigate(RouteNames.HomeTab, { screen: RouteNames.Chat });
  }, [navigation]);

  const handleOpenAccountSwitcher = useCallback(() => {
    navigation.navigate(RouteNames.ProfileStack, {
      params: { openAccountModal: true },
      screen: RouteNames.Profile,
    });
  }, [navigation]);

  const handleLogout = useCallback(() => {
    openContextualPrompt({
      body: t('homeHub.account.logoutDescription', 'Voulez-vous vous déconnecter de votre compte ?'),
      primaryAction: {
        label: t('profile.actions.logout', 'Déconnexion'),
        onPress: () => {
          closeContextualPrompt();
          logoutMutation.mutate(fcmToken || '');
        },
        variant: 'Primary',
      },
      secondaryAction: {
        label: t('common.actions.cancel', 'Annuler'),
        onPress: closeContextualPrompt,
        variant: 'Secondary',
      },
      title: t('homeHub.account.logoutTitle', 'Déconnexion'),
      tone: 'critical',
    });
  }, [closeContextualPrompt, fcmToken, logoutMutation, openContextualPrompt, t]);

  const roleLabel = useMemo(() => {
    if (isCoach) return t('homeHub.roles.coach', 'Entraîneur');
    if (isPresident) return t('homeHub.roles.president', 'Dirigeant');
    return t('homeHub.roles.player', 'Joueur');
  }, [isCoach, isPresident, t]);

  const tutorialOptions = useMemo(() => {
    /** @type {{ id: any; label: any }[]} */
    const options = [
      { id: TutorialIds.SEARCH_EVENTS, label: t('homeHub.cards.search.events.title', 'Événement') },
      { id: TutorialIds.SEARCH_CLUBS, label: t('homeHub.cards.search.clubs.title', 'Club') },
      { id: TutorialIds.SEARCH_RESERVATIONS, label: t('homeHub.cards.search.reservations.title', 'Réservations') },
      { id: TutorialIds.SEARCH_RECRUITMENT, label: t('homeHub.cards.search.ads.title', 'Annonces') },
      { id: TutorialIds.PROFILE_MAIN, label: t('homeHub.cards.profile.view.title', 'Voir mon profil') },
      { id: TutorialIds.PROFILE_EDIT, label: t('homeHub.cards.profile.edit.title', 'Modifier mon profil') },
      { id: TutorialIds.HISTORY_WIZARD, label: t('homeHub.cards.profile.history.title', 'Historique sportif') },
      { id: TutorialIds.PLANNING, label: t('homeHub.cards.quick.planning.title', 'Mon planning') },
      { id: TutorialIds.MY_TEAMS, label: t('homeHub.cards.quick.teams.title', 'Mes équipes') },
      { id: TutorialIds.MESSAGING, label: t('homeHub.cards.quick.chat.title', 'Messagerie') },
      { id: TutorialIds.ACCOUNT_SWITCHER_MODAL, label: t('homeHub.cards.account.switch.title', 'Changer de compte') },
      { id: TutorialIds.LOGOUT_CONFIRMATION, label: t('homeHub.cards.account.logout.title', 'Déconnexion') },
    ];

    if (isCoach || isPresident) {
      options.push(
        { id: TutorialIds.EVENT_WIZARD_TYPE, label: t('homeHub.cards.manage.addEvent.title', 'Ajouter un événement') },
        { id: TutorialIds.REQUESTS_DASHBOARD, label: t('homeHub.cards.manage.requests.title', 'Demandes') },
      );
    }

    return options;
  }, [isCoach, isPresident, t]);

  const scrollDownLabel = t('homeHubTutorial.actions.scrollDown', 'Descendre');
  const makeTutorial = useCallback((
    /** @type {string} */ id,
    /** @type {number} */ order,
    /** @type {any} */ fallbackTitle,
    /** @type {any} */ fallbackDesc,
    /** @type {any} */ options = {},
  ) => ({
    description: t(`homeHubTutorial.steps.${id}.description`, fallbackDesc),
    id: `homehub-${id}`,
    nextAction: options.nextAction,
    nextLabel: options.nextLabel,
    nextTargetStepId: options.nextTargetStepId,
    onNext: options.onNext,
    order,
    title: t(`homeHubTutorial.steps.${id}.title`, fallbackTitle),
  }), [t]);

  // Surbrillance de la carte « Ajouter un événement » pendant la semi-étape du tour.
  const { currentStep: tourCurrentStep } = useTour();
  const highlightAddEventCard = tourCurrentStep?.id === 'coach_find_event_card';

  // Badges d'offre informatifs sur les cartes du hub (handoff 12).
  const teamCardPremiumScope = (subscriptionAccessLevel === 'TEAM' || subscriptionAccessLevel === 'CLUB')
    ? undefined
    : /** @type {'team'} */ ('team');
  const clubCardPremiumScope = subscriptionAccessLevel === 'CLUB'
    ? undefined
    : /** @type {'club'} */ ('club');

  /** @type {HomeCard[]} */
  const manageSectionCards = useMemo(() => {
    if (isPresident) {
      return [
        {
          accentColor: Colors.primary500,
          emphasis: 'primary',
          icon: 'users',
          key: 'manage-club',
          onPress: handleOpenManageClub,
          subtitle: t('homeHub.cards.manage.manageClub.subtitle', 'Ton espace club pour tout piloter.'),
          subtitleLines: 2,
          title: t('homeHub.cards.manage.manageClub.title', 'Gérer mon club'),
          tutorial: makeTutorial('manageClub', 2, 'Gérer mon club', 'Accédez à votre espace club pour piloter votre organisation.'),
        },
        {
          accentColor: Colors.primary500,
          icon: 'bell',
          key: 'manage-requests',
          onPress: () => handleOpenRequestsHub('all'),
          subtitle: t('homeHub.cards.manage.requests.subtitle'),
          title: t('homeHub.cards.manage.requests.title'),
          tutorial: makeTutorial(
            'manageRequests',
            3,
            'Demandes',
            'Regroupez et traitez toutes les demandes depuis un seul écran.',
          ),
        },
        {
          accentColor: Colors.primary500,
          disabled: isPublishingGovernedBlocked,
          highlighted: highlightAddEventCard,
          icon: 'calendar',
          key: 'manage-add-event',
          onPress: handleAddEvent,
          premiumScope: teamCardPremiumScope,
          subtitle: t('homeHub.cards.manage.addEvent.subtitle'),
          subtitleLines: 2,
          title: t('homeHub.cards.manage.addEvent.title'),
          tutorial: makeTutorial(
            'manageAddEvent',
            4,
            'Ajouter un événement',
            'Créez un entraînement, match ou détection pour vos équipes.',
          ),
        },
        {
          accentColor: Colors.primary500,
          disabled: isPublishingGovernedBlocked,
          icon: 'running',
          key: 'manage-add-ad',
          onPress: handleAddRecruitmentAd,
          premiumScope: teamCardPremiumScope,
          subtitle: t('homeHub.cards.manage.addAd.subtitle', 'Publie une annonce de recrutement.'),
          subtitleLines: 2,
          title: t('homeHub.cards.manage.addAd.title', 'Ajouter une annonce'),
          tutorial: makeTutorial(
            'manageAddAd',
            5,
            'Ajouter une annonce',
            'Publiez une annonce de recrutement pour cibler des profils précis.',
            {
              nextAction: 'scrollDown',
              nextLabel: scrollDownLabel,
              nextTargetStepId: 'homehub-searchEvents',
              onNext: scrollToSearchSection,
            },
          ),
        },
        {
          accentColor: Colors.primary500,
          icon: 'running',
          key: 'manage-my-ads',
          onPress: handleOpenMyRecruitmentAds,
          subtitle: t('homeHub.cards.manage.myAds.subtitle', 'Consulte et gère tes annonces.'),
          subtitleLines: 2,
          title: t('homeHub.cards.manage.myAds.title', 'Mes annonces'),
          tutorial: makeTutorial(
            'manageMyAds',
            6,
            'Mes annonces',
            'Retrouvez rapidement les annonces déjà publiées pour vos équipes.',
            {
              nextAction: 'scrollDown',
              nextLabel: scrollDownLabel,
              nextTargetStepId: 'homehub-searchEvents',
              onNext: scrollToSearchSection,
            },
          ),
        },
        {
          accentColor: Colors.primary500,
          icon: 'euroCircle',
          key: 'manage-licenses',
          onPress: handleOpenClubLicenses,
          premiumScope: clubCardPremiumScope,
          subtitle: t('homeHub.cards.manage.licenses.subtitle', 'Suis les statuts de tes membres.'),
          subtitleLines: 2,
          title: t('homeHub.cards.manage.licenses.title', 'Cotisations'),
          tutorial: makeTutorial(
            'manageLicenses',
            7,
            'Cotisations',
            'Pilotez les cotisations et relances depuis un tableau dedie.',
            {
              nextAction: 'scrollDown',
              nextLabel: scrollDownLabel,
              nextTargetStepId: 'homehub-searchEvents',
              onNext: scrollToSearchSection,
            },
          ),
        },
      ];
    }

    if (isCoach) {
      return [
        {
          accentColor: Colors.primary500,
          emphasis: 'primary',
          icon: 'users',
          key: 'manage-club',
          onPress: handleOpenManageClub,
          subtitle: t('homeHub.cards.manage.manageClub.subtitle', 'Ton espace club pour tout piloter.'),
          subtitleLines: 2,
          title: t('homeHub.cards.manage.manageClub.title', 'Gérer mon club'),
          tutorial: makeTutorial('manageClub', 2, 'Gérer mon club', 'Accédez à votre espace club pour piloter votre organisation.'),
        },
        {
          accentColor: Colors.primary500,
          icon: 'bell',
          key: 'manage-requests',
          onPress: () => handleOpenRequestsHub('all'),
          subtitle: t('homeHub.cards.manage.requests.subtitle'),
          title: t('homeHub.cards.manage.requests.title'),
          tutorial: makeTutorial(
            'manageRequests',
            3,
            'Demandes',
            'Regroupez et traitez toutes les demandes depuis un seul écran.',
          ),
        },
        {
          accentColor: Colors.primary500,
          disabled: isPublishingGovernedBlocked,
          highlighted: highlightAddEventCard,
          icon: 'calendar',
          key: 'manage-add-event',
          onPress: handleAddEvent,
          premiumScope: teamCardPremiumScope,
          subtitle: t('homeHub.cards.manage.addEvent.subtitle'),
          subtitleLines: 2,
          title: t('homeHub.cards.manage.addEvent.title'),
          tutorial: makeTutorial('manageAddEvent', 4, 'Ajouter un événement', 'Créez un entraînement, match ou détection pour vos équipes.'),
        },
        {
          accentColor: Colors.primary500,
          disabled: isPublishingGovernedBlocked,
          icon: 'running',
          key: 'manage-add-ad',
          onPress: handleAddRecruitmentAd,
          premiumScope: teamCardPremiumScope,
          subtitle: t('homeHub.cards.manage.addAd.subtitle', 'Publie une annonce de recrutement.'),
          subtitleLines: 2,
          title: t('homeHub.cards.manage.addAd.title', 'Ajouter une annonce'),
          tutorial: makeTutorial(
            'manageAddAd',
            5,
            'Ajouter une annonce',
            'Publiez une annonce de recrutement pour cibler des profils précis.',
            {
              nextAction: 'scrollDown',
              nextLabel: scrollDownLabel,
              nextTargetStepId: 'homehub-searchEvents',
              onNext: scrollToSearchSection,
            },
          ),
        },
        {
          accentColor: Colors.primary500,
          icon: 'running',
          key: 'manage-my-ads',
          onPress: handleOpenMyRecruitmentAds,
          subtitle: t('homeHub.cards.manage.myAds.subtitle', 'Consulte et gère tes annonces.'),
          subtitleLines: 2,
          title: t('homeHub.cards.manage.myAds.title', 'Mes annonces'),
          tutorial: makeTutorial(
            'manageMyAds',
            6,
            'Mes annonces',
            'Retrouvez rapidement les annonces déjà publiées pour vos équipes.',
            {
              nextAction: 'scrollDown',
              nextLabel: scrollDownLabel,
              nextTargetStepId: 'homehub-searchEvents',
              onNext: scrollToSearchSection,
            },
          ),
        },
        {
          accentColor: Colors.primary500,
          icon: 'euroCircle',
          key: 'manage-licenses',
          onPress: handleOpenClubLicenses,
          premiumScope: clubCardPremiumScope,
          subtitle: t('homeHub.cards.manage.licenses.subtitle', 'Suis les statuts de tes membres.'),
          subtitleLines: 2,
          title: t('homeHub.cards.manage.licenses.title', 'Cotisations'),
          tutorial: makeTutorial(
            'manageLicenses',
            7,
            'Cotisations',
            'Consultez les statuts de cotisation de vos equipes.',
            {
              nextAction: 'scrollDown',
              nextLabel: scrollDownLabel,
              nextTargetStepId: 'homehub-searchEvents',
              onNext: scrollToSearchSection,
            },
          ),
        },
      ];
    }

    return [];
  }, [
    clubCardPremiumScope,
    highlightAddEventCard,
    Colors.primary500,
    handleAddEvent,
    handleAddRecruitmentAd,
    handleOpenClubLicenses,
    handleOpenMyRecruitmentAds,
    handleOpenManageClub,
    handleOpenRequestsHub,
    isPublishingGovernedBlocked,
    isCoach,
    isPresident,
    makeTutorial,
    scrollDownLabel,
    scrollToSearchSection,
    t,
    teamCardPremiumScope,
  ]);

  /** @type {HomeCard[]} */
  const searchCards = useMemo(() => {
    const cards = [
      {
        accentColor: Colors.primary500,
        icon: 'calendar',
        key: 'search-events',
        onPress: () => navigation.navigate(RouteNames.SearchEvents),
        subtitle: t('homeHub.cards.search.events.subtitle'),
        title: t('homeHub.cards.search.events.title'),
        tutorial: makeTutorial('searchEvents', 10, 'Rechercher un evenement', 'Trouvez des evenements sportifs en utilisant les filtres de recherche.'),
      },
      {
        accentColor: Colors.primary500,
        icon: 'shield',
        key: 'search-clubs',
        onPress: () => navigation.navigate(RouteNames.SearchClubs),
        subtitle: t('homeHub.cards.search.clubs.subtitle'),
        title: t('homeHub.cards.search.clubs.title'),
        tutorial: makeTutorial('searchClubs', 11, 'Rechercher un club', 'Explorez les clubs et ouvrez leur fiche detaillee.'),
      },
      {
        accentColor: Colors.primary500,
        icon: 'stadium',
        key: 'search-reservations',
        onPress: () => navigation.navigate(RouteNames.SearchReservations),
        subtitle: t('homeHub.cards.search.reservations.subtitle'),
        title: t('homeHub.cards.search.reservations.title'),
        tutorial: makeTutorial('searchReservations', 12, 'Rechercher une reservation', 'Accedez aux reservations et filtrez selon votre activite.'),
      },
    ];

    if (hasManageSection) {
      cards.push({
        accentColor: Colors.primary500,
        icon: 'users',
        key: 'search-profiles',
        onPress: () => navigation.navigate(RouteNames.SearchRecruitment, {
          initialRecruitmentTab: 'profils',
        }),
        subtitle: t(
          'homeHub.cards.search.profiles.subtitle',
          'Trouve des profils ouverts.',
        ),
        title: t('homeHub.cards.search.profiles.title', 'Profils'),
        tutorial: makeTutorial(
          'searchProfiles',
          13,
          'Rechercher des profils',
          'Accedez directement aux profils ouverts au recrutement pour vos equipes.',
          {
            nextAction: 'scrollDown',
            nextLabel: scrollDownLabel,
            nextTargetStepId: 'homehub-league',
            onNext: scrollToLeagueSection,
          },
        ),
      });
    }

    if (!hasManageSection) {
      cards.push({
        accentColor: Colors.primary500,
        icon: 'running',
        key: 'search-ads',
        onPress: () => navigation.navigate(RouteNames.SearchRecruitment, {
          initialRecruitmentTab: getDefaultRecruitmentTab(userData),
        }),
        subtitle: t('homeHub.cards.search.ads.subtitle'),
        title: t('homeHub.cards.search.ads.title'),
        tutorial: makeTutorial(
          'searchAds',
          14,
          'Rechercher des annonces',
          'Consultez les annonces de recrutement et les profils disponibles.',
          {
            nextAction: 'scrollDown',
            nextLabel: scrollDownLabel,
            nextTargetStepId: 'homehub-league',
            onNext: scrollToLeagueSection,
          },
        ),
      });
    }

    return cards;
  }, [Colors.primary500, hasManageSection, makeTutorial, navigation, scrollDownLabel, scrollToLeagueSection, t, userData]);

  /** @type {HomeCard[]} */
  const leagueCards = useMemo(() => ([
    {
      accentColor: Colors.gold500,
      icon: 'trophy',
      key: 'league-entry',
      layout: 'full',
      onPress: handleOpenLeague,
      subtitle: t('homeHub.cards.league.subtitle'),
      title: t('homeHub.cards.league.title'),
      tutorial: makeTutorial(
        'league',
        20,
        'FoundClub League',
        'Basculez vers FoundClub League pour les fonctionnalités compétitives.',
        {
          nextAction: 'scrollDown',
          nextLabel: scrollDownLabel,
          nextTargetStepId: 'homehub-profileView',
          onNext: scrollToProfileSection,
        },
      ),
    },
  ]), [Colors.gold500, handleOpenLeague, makeTutorial, scrollDownLabel, scrollToProfileSection, t]);

  /** @type {HomeCard[]} */
  const profileCards = useMemo(() => {
    const cards = [
      {
        accentColor: Colors.primary500,
        icon: 'users',
        key: 'profile-view',
        onPress: handleOpenProfile,
        subtitle: t('homeHub.cards.profile.view.subtitle'),
        title: t('homeHub.cards.profile.view.title'),
        tutorial: makeTutorial('profileView', 30, 'Voir mon profil', 'Consultez votre page profil complete.'),
      },
      {
        accentColor: Colors.primary500,
        icon: 'edit',
        key: 'profile-edit',
        onPress: handleEditProfile,
        subtitle: t('homeHub.cards.profile.edit.subtitle'),
        title: t('homeHub.cards.profile.edit.title'),
        tutorial: makeTutorial('profileEdit', 31, 'Modifier mon profil', 'Modifiez vos informations personnelles et sportives.'),
      },
      {
        accentColor: Colors.primary500,
        icon: 'clock',
        key: 'profile-history',
        onPress: handleOpenHistory,
        subtitle: t('homeHub.cards.profile.history.subtitle'),
        title: t('homeHub.cards.profile.history.title'),
        tutorial: makeTutorial('profileHistory', 32, 'Historique sportif', 'Ajoutez vos experiences via le wizard historique.'),
      },
      {
        accentColor: Colors.primary500,
        icon: 'bell',
        key: 'profile-alerts',
        onPress: handleOpenSearchAlerts,
        subtitle: t('homeHub.cards.profile.alerts.subtitle'),
        title: t('homeHub.cards.profile.alerts.title'),
        tutorial: makeTutorial(
          'profileAlerts',
          33,
          'Gérer mes alertes',
          'Configurez des alertes personnalisees selon vos recherches.',
          {
            nextAction: 'scrollDown',
            nextLabel: scrollDownLabel,
            nextTargetStepId: 'homehub-quickPlanning',
            onNext: scrollToQuickSection,
          },
        ),
      },
    ];

    if (canShowSubscriptionExperience) {
      const remainingFreeEvents = eventPublishQuotaItem?.remaining ?? 0;
      const quotaPlural = remainingFreeEvents > 1 ? 's' : '';
      cards.unshift({
        accentColor: Colors.primary500,
        icon: 'euroCircle',
        key: 'profile-subscription',
        layout: 'full',
        onPress: handleOpenSubscriptionOverview,
        subtitle: eventPublishQuotaItem
          ? `${subscriptionStatusMeta.label} · ${remainingFreeEvents} événement${quotaPlural} offert${quotaPlural} restant${quotaPlural}`
          : t('homeHub.cards.profile.subscription.fallbackSubtitle', 'Consulte tes offres, quotas gratuits et équipes couvertes.'),
        subtitleLines: 1,
        title: t('homeHub.cards.profile.subscription.title', 'Mon abonnement'),
      });
    }

    return cards;
  }, [
    Colors.primary500,
    canShowSubscriptionExperience,
    eventPublishQuotaItem,
    handleEditProfile,
    handleOpenHistory,
    handleOpenProfile,
    handleOpenSearchAlerts,
    handleOpenSubscriptionOverview,
    makeTutorial,
    scrollDownLabel,
    scrollToQuickSection,
    subscriptionStatusMeta.label,
    t,
  ]);

  /** @type {HomeCard[]} */
  const quickNavCards = useMemo(() => ([
    {
      accentColor: Colors.primary500,
      icon: 'calendar',
      key: 'quick-planning',
      onPress: handleOpenPlanning,
      subtitle: t('homeHub.cards.quick.planning.subtitle'),
      title: t('homeHub.cards.quick.planning.title'),
      tutorial: makeTutorial('quickPlanning', 40, 'Mon planning', 'Accédez rapidement à votre planning personnel.'),
    },
    {
      accentColor: Colors.primary500,
      icon: 'strokeShield',
      key: 'quick-teams',
      onPress: handleOpenMyTeams,
      subtitle: t('homeHub.cards.quick.teams.subtitle'),
      title: t('homeHub.cards.quick.teams.title'),
      tutorial: makeTutorial('quickTeams', 41, 'Mes équipes', 'Retrouvez toutes vos équipes et leurs pages.'),
    },
    {
      accentColor: Colors.primary500,
      icon: 'euroCircle',
      key: 'quick-license',
      onPress: handleOpenMyLicense,
      subtitle: t('homeHub.cards.quick.license.subtitle', 'Ton statut et ton reste à payer.'),
      title: t('homeHub.cards.quick.license.title', 'Ma cotisation'),
      tutorial: makeTutorial('quickLicense', 42, 'Ma cotisation', 'Suivez votre cotisation et vos paiements depuis l accueil.'),
    },
    {
      accentColor: Colors.primary500,
      icon: 'envelope',
      key: 'quick-chat',
      onPress: handleOpenMessaging,
      subtitle: t('homeHub.cards.quick.chat.subtitle'),
      title: t('homeHub.cards.quick.chat.title'),
      tutorial: makeTutorial(
        'quickChat',
        43,
        'Messagerie',
        'Ouvrez votre messagerie et suivez vos conversations.',
        {
          nextAction: 'scrollDown',
          nextLabel: scrollDownLabel,
          nextTargetStepId: 'homehub-accountSwitch',
          onNext: scrollToAccountSection,
        },
      ),
    },
  ]), [
    Colors.primary500,
    handleOpenMyLicense,
    handleOpenMessaging,
    handleOpenMyTeams,
    handleOpenPlanning,
    makeTutorial,
    scrollDownLabel,
    scrollToAccountSection,
    t,
  ]);

  /** @type {HomeCard[]} */
  const accountCards = useMemo(() => ([
    {
      accentColor: Colors.primary500,
      icon: 'users',
      key: 'account-switch',
      onPress: handleOpenAccountSwitcher,
      subtitle: t('homeHub.cards.account.switch.subtitle'),
      title: t('homeHub.cards.account.switch.title'),
      tutorial: makeTutorial('accountSwitch', 50, 'Changer de compte', 'Ouvrez la modal pour changer ou ajouter un compte.'),
    },
    {
      accentColor: Colors.error500,
      disabled: logoutMutation.isPending,
      icon: 'close',
      key: 'account-logout',
      onPress: handleLogout,
      subtitle: t('homeHub.cards.account.logout.subtitle'),
      title: t('homeHub.cards.account.logout.title'),
      tone: 'destructive',
      tutorial: makeTutorial('accountLogout', 51, 'Déconnexion', 'Déconnectez-vous proprement de l\'appareil actuel.'),
    },
  ]), [
    Colors.error500,
    Colors.primary500,
    handleLogout,
    handleOpenAccountSwitcher,
    logoutMutation.isPending,
    makeTutorial,
    t,
  ]);

  return (
    <ScreenContainerView
      bgImage="bg2"
      contentContainerStyle={[Spaces.paddingBottom[24], Alignments.column, Alignments.fill]}
      contentWidth="wide"
      responsivePadding
    >
      <View style={[Spaces.marginTop[16], Spaces.marginBottom[24], Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
        <LeagueHeaderSwitch />
        <View style={{ alignItems: 'center', flexDirection: 'row' }}>
          <NotificationBadge />
          <ProfileButton />
        </View>
      </View>

      <ScrollView
        bounces={false}
        contentContainerStyle={[Spaces.gap[24], { paddingBottom: scrollBottomPadding }]}
        overScrollMode="never"
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
      >
        <OnboardingWrapper
          description={t('homeHubTutorial.steps.header.description', 'Cette page vous donne un accès rapide à toutes les fonctionnalités principales.')}
          id="homehub-header"
          nextAction={!hasManageSection ? 'scrollDown' : undefined}
          nextLabel={!hasManageSection ? scrollDownLabel : undefined}
          nextTargetStepId={!hasManageSection ? 'homehub-searchEvents' : undefined}
          onNext={!hasManageSection ? scrollToSearchSection : undefined}
          order={1}
          spotlight={{
            borderRadius: 14, overlayOpacity: 0.42, paddingX: 6, paddingY: 4,
          }}
          style={{ alignSelf: 'center' }}
          title={t('homeHubTutorial.steps.header.title', 'Accueil FoundClub')}
        >
          <View style={[Alignments.alignCenter, Spaces.gap[8], { minWidth: 220 }]}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{t('homeHub.title', 'Accueil').toUpperCase()}</Text>
            <View style={[ApplicationStyle.separator, ApplicationStyle.backgroundColor.neutral00, { width: 96 }]} />
            <Text style={[Fonts.p2Bold, Fonts.primary500]}>{roleLabel.toUpperCase()}</Text>
          </View>
        </OnboardingWrapper>

        <View onLayout={(event) => registerSectionAnchor('manage', event)} ref={(node) => registerSectionViewRef('manage', node)}>
          {isPublishingGovernedBlocked ? (
            <View
              style={[
                ApplicationStyle.borderRadius24,
                Spaces.padding[16],
                Spaces.marginBottom[16],
                Spaces.gap[8],
                {
                  backgroundColor: 'rgba(163, 163, 163, 0.10)',
                  borderColor: 'rgba(163, 163, 163, 0.26)',
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                Publication réservée aux clubs certifiés
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {governedPublishingBlockReason === 'requires_superadmin_authorization'
                  ? "Ton club n'est pas encore certifié. Tu peux gérer ton organisation, mais un superadmin doit encore autoriser la publication des événements et des annonces."
                  : 'La publication est temporairement bloquée pour ce club non certifié.'}
              </Text>
            </View>
          ) : null}
          <HomeSection Alignments={Alignments} cards={manageSectionCards} Fonts={Fonts} registerTutorialTargetNode={registerTutorialTargetNode} Spaces={Spaces} title={t('homeHub.sections.manageClub')} />
        </View>
        <View onLayout={(event) => registerSectionAnchor('search', event)} ref={(node) => registerSectionViewRef('search', node)}>
          <HomeSection Alignments={Alignments} cards={searchCards} Fonts={Fonts} registerTutorialTargetNode={registerTutorialTargetNode} Spaces={Spaces} title={t('homeHub.sections.search')} />
        </View>
        <View onLayout={(event) => registerSectionAnchor('league', event)} ref={(node) => registerSectionViewRef('league', node)}>
          <HomeSection Alignments={Alignments} cards={leagueCards} Fonts={Fonts} registerTutorialTargetNode={registerTutorialTargetNode} Spaces={Spaces} title={t('homeHub.sections.league')} />
        </View>
        <View onLayout={(event) => registerSectionAnchor('profile', event)} ref={(node) => registerSectionViewRef('profile', node)}>
          <HomeSection Alignments={Alignments} cards={profileCards} Fonts={Fonts} registerTutorialTargetNode={registerTutorialTargetNode} Spaces={Spaces} title={t('homeHub.sections.profile')} />
        </View>
        <View onLayout={(event) => registerSectionAnchor('quick', event)} ref={(node) => registerSectionViewRef('quick', node)}>
          <HomeSection Alignments={Alignments} cards={quickNavCards} Fonts={Fonts} registerTutorialTargetNode={registerTutorialTargetNode} Spaces={Spaces} title={t('homeHub.sections.quickNav')} />
        </View>
        <View onLayout={(event) => registerSectionAnchor('account', event)} ref={(node) => registerSectionViewRef('account', node)}>
          <HomeSection Alignments={Alignments} cards={accountCards} Fonts={Fonts} registerTutorialTargetNode={registerTutorialTargetNode} Spaces={Spaces} title={t('homeHub.sections.account')} />
        </View>
      </ScrollView>

      {isFocused ? (
        <>
          <BottomModal
            close={closeTutorialCenterModal}
            hideCloseButton={false}
            isVisible={isTutorialCenterVisible}
            scrollable={false}
            webPresentation="dialog"
          >
            <View style={[Spaces.gap[12], Spaces.paddingBottom[24]]}>
              <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{t('homeHubTutorial.center.title', 'Tutoriels et aide')}</Text>
              <Text style={[Fonts.p2, Fonts.neutral200]}>{t('homeHubTutorial.center.subtitle', 'Relancez un tutoriel ou réinitialisez tous les guides.')}</Text>
              <Button onPress={startHomeTutorial} title={t('homeHubTutorial.center.actions.relaunchHome', 'Relancer le tutoriel Accueil')} variant="Primary" />
              <Button onPress={openFeatureTutorialPicker} title={t('homeHubTutorial.center.actions.pickFeature', 'Choisir un tutoriel de fonctionnalité')} variant="Secondary" />
              <Button onPress={handleResetAllTutorials} title={t('homeHubTutorial.center.actions.resetAll', 'Réinitialiser tous les tutoriels')} variant="Secondary" />
            </View>
          </BottomModal>

          <BottomModal
            close={closeFeatureTutorialPicker}
            hideCloseButton={false}
            isVisible={isFeatureTutorialPickerVisible}
            webPresentation="dialog"
          >
            <View style={[Spaces.gap[12], Spaces.paddingBottom[24]]}>
              <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{t('homeHubTutorial.featurePicker.title', 'Choisir un tutoriel')}</Text>
              <Text style={[Fonts.p2, Fonts.neutral200]}>{t('homeHubTutorial.featurePicker.subtitle', 'Sélectionnez une fonctionnalité à découvrir.')}</Text>
              {tutorialOptions.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  onPress={() => navigateToTutorial(option.id)}
                  style={[ApplicationStyle.borderRadius12, ApplicationStyle.borderWidth1, {
                    backgroundColor: 'rgba(23,56,68,0.94)', borderColor: `${Colors.primary500}66`, paddingHorizontal: 14, paddingVertical: 12,
                  }]}
                >
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </BottomModal>
        </>
      ) : null}

      {shouldRenderLegacyEntryGate ? (
        <View
          style={[
            Platform.OS === 'web' ? null : Alignments.absolute,
            Alignments.justifyCenter,
            Alignments.alignCenter,
            Spaces.paddingHorizontal[24],
            /** @type {any} */ ({
              backgroundColor: 'rgba(0, 18, 24, 0.88)',
              bottom: 0,
              left: 0,
              paddingBottom: entryGateBottomInset,
              paddingTop: entryGateTopInset,
              position: Platform.OS === 'web' ? 'fixed' : 'absolute',
              right: 0,
              top: 0,
              zIndex: 60,
            }),
          ]}
        >
          <View
            style={[
              ApplicationStyle.backgroundColor.primary700,
              ApplicationStyle.borderRadius24,
              ApplicationStyle.borderWidth1,
              Spaces.padding[24],
              Spaces.gap[12],
              {
                alignSelf: 'center',
                borderColor: `${Colors.primary500}66`,
                maxHeight: entryGateMaxHeight,
                maxWidth: 380,
                width: '100%',
              },
            ]}
          >
            <Image
              resizeMode="contain"
              source={Images.logo}
              style={{
                alignSelf: 'center',
                height: 20,
                maxWidth: 186,
                minWidth: 140,
                width: '62%',
              }}
            />
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
              {t('homeHubTutorial.entry.title', 'Bienvenue sur FoundClub')}
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {t(
                'homeHubTutorial.entry.subtitle',
                'FoundClub est un outil concu pour vous accompagner dans toute votre aventure sportive, peu importe votre sport.',
              )}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              {t(
                'homeHubTutorial.entry.description',
                'Vous pouvez lancer le tutoriel complet pour tout comprendre, ou explorer l\'application par vous-même.',
              )}
            </Text>
            <View style={[Spaces.gap[8], Spaces.marginTop[4]]}>
              <Button
                onPress={handleEntryStartTutorial}
                title={t('homeHubTutorial.entry.actions.start', 'Lancer le tutoriel complet')}
                variant="Primary"
              />
              <Button
                onPress={handleEntrySkipTutorial}
                title={t('homeHubTutorial.entry.actions.skip', 'Passer')}
                variant="Secondary"
              />
            </View>
          </View>
        </View>
      ) : null}

      <GlobalPromptModal
        body={t(
          'homeHubTutorial.entry.subtitle',
          'FoundClub est un outil conçu pour vous accompagner dans toute votre aventure sportive, peu importe votre sport.',
        )}
        headerContent={(
          <Image
            resizeMode="contain"
            source={Images.logo}
            style={{
              alignSelf: 'center',
              height: 20,
              maxWidth: 186,
              minWidth: 140,
              width: '62%',
            }}
          />
        )}
        onRequestClose={handleEntrySkipTutorial}
        primaryAction={{
          label: t('homeHubTutorial.entry.actions.start', 'Lancer le tutoriel complet'),
          onPress: handleEntryStartTutorial,
        }}
        secondaryAction={{
          label: t('homeHubTutorial.entry.actions.skip', 'Plus tard'),
          onPress: handleEntrySkipTutorial,
        }}
        supportingText={t(
          'homeHubTutorial.entry.description',
          "Vous pouvez lancer le tutoriel complet pour tout comprendre, ou explorer l'application par vous-même.",
        )}
        title={t('homeHubTutorial.entry.title', 'Bienvenue sur FoundClub')}
        visible={Platform.OS === 'web' && isHomeHubEntryGateVisible}
      />
      <GlobalPromptModal
        body={contextualPrompt?.body}
        inlineOnAndroid
        onRequestClose={closeContextualPrompt}
        primaryAction={contextualPrompt?.primaryAction}
        secondaryAction={contextualPrompt?.secondaryAction}
        title={contextualPrompt?.title || ''}
        tone={contextualPrompt?.tone || 'primary'}
        visible={Boolean(contextualPrompt)}
      />

      <ExternalCompetitionPromptGate
        enabled={isExternalCompetitionPromptEnabled}
        userData={userData}
      />
    </ScreenContainerView>
  );
}

/**
 * @param {{ navigation: any; route: any }} props
 */
function HomeHub({ navigation, route }) {
  const auth = useAuth();
  const userId = auth?.userData?.documentId;

  useEffect(() => {
    if (auth?.userData?.documentId) {
      markBootStep('home_hub_mounted', {
        userDocumentId: auth.userData.documentId,
      });
    }
  }, [auth?.userData?.documentId]);

  const handleForceStartHandled = useCallback(() => {
    navigation.setParams({
      startTutorial: undefined,
      tutorialId: undefined,
      tutorialSource: undefined,
      tutorialStartToken: undefined,
    });
  }, [navigation]);

  if (auth?.userDataLoading) {
    return (
      <HomeHubStateView
        description="Nous préparons votre espace FoundClub."
        isLoading
        title="Chargement de l'accueil"
      />
    );
  }

  if (auth?.userDataError) {
    return (
      <HomeHubStateView
        actionLabel="Réessayer"
        description="Impossible de charger votre espace pour le moment. Vérifiez votre connexion puis relancez le chargement."
        onAction={() => {
          auth.refetchUserData?.();
        }}
        title="Accueil indisponible"
      />
    );
  }

  if (!auth?.userData) {
    return (
      <HomeHubStateView
        actionLabel="Actualiser"
        description="Votre compte n'a pas encore été chargé. Relancez le chargement pour afficher votre accueil personnalisé."
        onAction={() => {
          auth.refetchUserData?.();
        }}
        title="Compte introuvable"
      />
    );
  }

  return (
    <TutorialFlowBoundary
      autoStart={false}
      onForceStartHandled={handleForceStartHandled}
      routeParams={route?.params}
      tutorialId={TutorialIds.HOME_HUB}
      userId={userId}
    >
      <HomeHubContent auth={auth} navigation={navigation} route={route} />
    </TutorialFlowBoundary>
  );
}

export default HomeHub;
