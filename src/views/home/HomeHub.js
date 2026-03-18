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
  Alert,
  Image,
  InteractionManager,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { USER_ROLES } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { navigateToRequestsHub } from '@/domains/requests/requestNavigation';
import { TutorialIds } from '@/domains/tutorial/tutorialIds';
import useFeatureTutorial from '@/domains/tutorial/useFeatureTutorial';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import LeagueHeaderSwitch from '@/components/molecules/header/LeagueHeaderSwitch';
import HomeActionCard from '@/components/molecules/homeActionCard/HomeActionCard';
import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import TutorialFlowBoundary from '@/components/molecules/tutorial/TutorialFlowBoundary';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { resolveLegacySearchTarget } from '@/views/search/searchRouteHelpers';

import { RouteNames } from '@/navigation/routeNames';

import { tutorialDebugLog } from '@/utils/logger/tutorialDebug';
import { useAppMode } from '@/context/AppModeContext';
import { useOnboarding } from '@/context/OnboardingContext';

/**
 * @typedef {{
 *  id: string;
 *  order: number;
 *  title: string;
 *  description: string;
 *  nextAction?: 'default' | 'scrollDown';
 *  nextLabel?: string;
 *  onNext?: () => void;
 * }} HomeCardTutorial
 */

/**
 * @typedef {{
 *  key: string;
 *  title: string;
 *  subtitle: string;
 *  onPress: () => void;
 *  disabled?: boolean;
 *  icon?: keyof import('@/theme/types').AllImages;
 *  accentColor?: string;
 *  layout?: 'half' | 'full';
 *  emphasis?: 'default' | 'primary';
 *  subtitleLines?: 1 | 2;
 *  tutorial?: HomeCardTutorial;
 * }} HomeCard
 */

/**
 * @param {{
 *  title: string;
 *  cards: HomeCard[];
 *  Fonts: import('@/theme/types').Fonts;
 *  Spaces: import('@/theme/types').Spaces;
 *  Alignments: import('@/theme/types').Alignments;
 * }} props
 */
function HomeSection({
  Alignments,
  cards,
  Fonts,
  Spaces,
  title,
}) {
  const { width: screenWidth } = useWindowDimensions();
  if (!cards.length) return null;
  const isSingleCardSection = cards.length === 1;
  const isCompactScreen = screenWidth <= 340;

  return (
    <View style={[Spaces.gap[12]]}>
      <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{title}</Text>
      <View style={[Alignments.row, Alignments.wrap, Alignments.justifySpaceBetween]}>
        {cards.map((card) => {
          const isFullCard = isCompactScreen || isSingleCardSection || card.layout === 'full';
          const cardContainerStyle = {
            flexBasis: isFullCard ? '100%' : '48.5%',
            marginBottom: 12,
            maxWidth: isFullCard ? '100%' : '48.5%',
            width: isFullCard ? '100%' : '48.5%',
          };

          const body = (
            <HomeActionCard
              accentColor={card.accentColor}
              disabled={card.disabled}
              emphasis={card.emphasis}
              icon={card.icon}
              layout={isFullCard ? 'full' : 'half'}
              onPress={card.onPress}
              subtitle={card.subtitle}
              subtitleLines={card.subtitleLines}
              title={card.title}
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
                onNext={card.tutorial.onNext}
                order={card.tutorial.order}
                spotlight={{
                  borderRadius: 16,
                  overlayOpacity: 0.42,
                  paddingX: 0,
                  paddingY: 0,
                }}
                style={{ width: '100%' }}
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
    isActive: isOnboardingActive,
    refreshCurrentStep,
    startOnboarding,
  } = useOnboarding();
  const { logoutMutation, userData } = auth;

  const homeHubTutorial = useFeatureTutorial({
    routeParams: route?.params,
    tutorialId: TutorialIds.HOME_HUB,
    userId: userData?.documentId,
  });

  const [activeTutorialModal, setActiveTutorialModal] = useState(/** @type {'center' | 'feature' | null} */ (null));
  const [isEntryGateVisible, setIsEntryGateVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const isFocused = useIsFocused();
  const scrollRef = useRef(/** @type {import('react-native').ScrollView | null} */ (null));
  const refreshCurrentStepRef = useRef(refreshCurrentStep);
  const pendingNavigationActionRef = useRef(/** @type {null | (() => void)} */ (null));
  const previousTutorialStepRef = useRef(/** @type {{ id?: string; index?: number } | null} */ (null));
  const sectionAnchorsRef = useRef({
    account: { height: 0, y: 0 },
    league: { height: 0, y: 0 },
    manage: { height: 0, y: 0 },
    profile: { height: 0, y: 0 },
    quick: { height: 0, y: 0 },
    search: { height: 0, y: 0 },
  });

  const roleName = userData?.role?.name;
  const isCoach = roleName === USER_ROLES.coach;
  const isPresident = roleName === USER_ROLES.president;
  const hasManageSection = isCoach || isPresident;
  const routeParams = route?.params;
  const scrollBottomPadding = tabBarHeight + insets.bottom + 16;

  const trainedTeamIds = useMemo(
    () => (userData?.trainedTeams || []).map((team) => team?.documentId).filter(Boolean),
    [userData?.trainedTeams],
  );
  const clubId = userData?.club?.documentId;
  const cmId = userData?.multisportClubs?.[0]?.documentId;
  const isTutorialCenterVisible = activeTutorialModal === 'center';
  const isFeatureTutorialPickerVisible = activeTutorialModal === 'feature';

  const legacySearchTarget = useMemo(() => resolveLegacySearchTarget(routeParams), [routeParams]);

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
    isFocused,
    isOnboardingActive,
    userData?.documentId,
  ]);

  const registerSectionAnchor = useCallback((sectionKey, event) => {
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

  const scrollToSection = useCallback((sectionKey) => {
    const SECTION_TARGET_TOP = 170;
    const REFRESH_DELAYS = [80, 180, 320];
    let attempts = 0;
    const maxAttempts = 5;

    const tryScroll = () => {
      attempts += 1;
      const sectionAnchor = sectionAnchorsRef.current[sectionKey];
      if (!(sectionAnchor?.height > 0)) {
        if (attempts < maxAttempts) {
          setTimeout(tryScroll, 120);
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

      REFRESH_DELAYS.forEach((delay) => {
        setTimeout(() => {
          refreshCurrentStepRef.current?.();
        }, delay);
      });
    };

    tryScroll();
  }, []);

  const scrollToTop = useCallback(() => {
    const REFRESH_DELAYS = [80, 180, 320];
    scrollRef.current?.scrollTo({
      animated: true,
      y: 0,
    });
    REFRESH_DELAYS.forEach((delay) => {
      setTimeout(() => {
        refreshCurrentStepRef.current?.();
      }, delay);
    });
  }, []);

  const scrollToSearchSection = useCallback(() => {
    scrollToSection('search');
  }, [scrollToSection]);

  const scrollToLeagueSection = useCallback(() => {
    scrollToSection('league');
  }, [scrollToSection]);

  const scrollToProfileSection = useCallback(() => {
    scrollToSection('profile');
  }, [scrollToSection]);

  const scrollToQuickSection = useCallback(() => {
    scrollToSection('quick');
  }, [scrollToSection]);

  const scrollToAccountSection = useCallback(() => {
    scrollToSection('account');
  }, [scrollToSection]);

  const getHomeHubSectionForStepId = useCallback((stepId) => {
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

    const hasPrevious = typeof previous?.index === 'number';
    const isBackward = hasPrevious && typeof currentIndex === 'number' && currentIndex < previous.index;

    if (isBackward) {
      const previousSection = getHomeHubSectionForStepId(previous?.id);
      const currentSection = getHomeHubSectionForStepId(currentId);

      if (currentSection && currentSection !== previousSection) {
        tutorialDebugLog('homehub.backwardScroll', {
          currentId,
          currentIndex,
          fromIndex: previous?.index,
          fromSection: previousSection,
          toSection: currentSection,
        });

        if (currentSection === 'top') {
          scrollToTop();
        } else {
          scrollToSection(currentSection);
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
    scrollToSection,
    scrollToTop,
  ]);

  const openTutorialCenterModal = useCallback(() => {
    setActiveTutorialModal('center');
  }, []);

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

  const runPendingNavigation = useCallback((delayMs) => {
    if (!isFocused) return;
    const navigateAction = pendingNavigationActionRef.current;
    if (!navigateAction) return;
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

  const navigateAfterClosingModals = useCallback((navigateAction) => {
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
      const didStart = startOnboarding({ forceFromStart: true });

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
    scrollRef.current?.scrollTo({ animated: false, y: 0 });
    InteractionManager.runAfterInteractions(() => {
      launchHomeTutorialFlow();
    });
  }, [closeTutorialModals, homeHubTutorial, launchHomeTutorialFlow]);

  const handleEntryStartTutorial = useCallback(() => {
    homeHubTutorial.setEntryChoice('start');
    homeHubTutorial.setAutoEnabled(true);
    setIsEntryGateVisible(false);
    closeTutorialModals();
    homeHubTutorial.resetTutorial();
    scrollRef.current?.scrollTo({ animated: false, y: 0 });
    InteractionManager.runAfterInteractions(() => {
      launchHomeTutorialFlow();
    });
  }, [closeTutorialModals, homeHubTutorial, launchHomeTutorialFlow]);

  const handleEntrySkipTutorial = useCallback(() => {
    homeHubTutorial.skipAllAuto();
    setIsEntryGateVisible(false);
    closeTutorialModals();
  }, [closeTutorialModals, homeHubTutorial]);

  const navigateToTutorial = useCallback((tutorialId) => {
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
          Alert.alert(
            t('homeHub.alerts.noClub.title', 'Club introuvable'),
            t('homeHub.alerts.noClub.description', 'Votre compte doit être rattache a un club pour gérer ces demandes.'),
          );
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
            initialRecruitmentTab: 'annonces',
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
          Alert.alert(
            t('homeHub.alerts.noTrainedTeams.title', 'Aucune équipe disponible'),
            t('homeHub.alerts.noTrainedTeams.description', 'Vous devez être entraîneur d\'au moins une équipe pour gérer les demandes d\'adhésion.'),
          );
          return;
        }
        navigateAfterClosingModals(() => {
          navigateToRequestsHub(navigation, {
            ...tutorialParams,
            initialFilter: 'team',
            source: 'home',
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

      default:
    }
  }, [clubId, cmId, navigateAfterClosingModals, navigation, t, trainedTeamIds]);

  const handleResetAllTutorials = useCallback(() => {
    Alert.alert(
      t('homeHubTutorial.reset.title', 'Réinitialiser les tutoriels'),
      t('homeHubTutorial.reset.description', 'Tous les tutoriels seront remis a zero pour ce compte.'),
      [
        { style: 'cancel', text: t('common.actions.cancel', 'Annuler') },
        {
          onPress: () => {
            homeHubTutorial.resetAllTutorials();
            closeTutorialModals();
            scrollRef.current?.scrollTo({ animated: false, y: 0 });
            InteractionManager.runAfterInteractions(() => {
              launchHomeTutorialFlow();
            });
          },
          style: 'destructive',
          text: t('homeHubTutorial.reset.confirm', 'Réinitialiser'),
        },
      ],
    );
  }, [closeTutorialModals, homeHubTutorial, launchHomeTutorialFlow, t]);

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
    navigation.navigate(RouteNames.EventStack, { screen: RouteNames.EventWizardType });
  }, [navigation]);

  const handleAddRecruitmentAd = useCallback(() => {
    navigation.navigate(RouteNames.AdWizardStack);
  }, [navigation]);

  const handleOpenRequestsHub = useCallback((initialFilter = 'all') => {
    const hasRequestsContext = Boolean(clubId || cmId || trainedTeamIds.length);
    if (!hasRequestsContext) {
      Alert.alert(
        t('homeHub.alerts.missingContext.title', 'Contexte manquant'),
        t('homeHub.alerts.missingContext.description', 'Aucun club disponible pour gérer les demandes à la une.'),
      );
      return;
    }

    navigateToRequestsHub(navigation, {
      initialFilter,
      source: 'home',
    });
  }, [clubId, cmId, navigation, t, trainedTeamIds.length]);

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

    Alert.alert(
      t('homeHub.alerts.missingContext.title', 'Contexte manquant'),
      t('homeHub.alerts.missingContext.description', 'Aucun club disponible pour gérer les demandes à la une.'),
    );
  }, [clubId, cmId, navigation, t]);

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
    Alert.alert(
      t('homeHub.account.logoutTitle', 'Déconnexion'),
      t('homeHub.account.logoutDescription', 'Voulez-vous vous déconnecter de votre compte ?'),
      [
        { style: 'cancel', text: t('common.actions.cancel', 'Annuler') },
        {
          onPress: () => logoutMutation.mutate(fcmToken || ''),
          style: 'destructive',
          text: t('profile.actions.logout', 'Déconnexion'),
        },
      ],
    );
  }, [fcmToken, logoutMutation, t]);

  const roleLabel = useMemo(() => {
    if (isCoach) return t('homeHub.roles.coach', 'Entraîneur');
    if (isPresident) return t('homeHub.roles.president', 'Dirigeant');
    return t('homeHub.roles.player', 'Joueur');
  }, [isCoach, isPresident, t]);

  const tutorialOptions = useMemo(() => {
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
  const makeTutorial = useCallback((id, order, fallbackTitle, fallbackDesc, options = {}) => ({
    description: t(`homeHubTutorial.steps.${id}.description`, fallbackDesc),
    id: `homehub-${id}`,
    nextAction: options.nextAction,
    nextLabel: options.nextLabel,
    onNext: options.onNext,
    order,
    title: t(`homeHubTutorial.steps.${id}.title`, fallbackTitle),
  }), [t]);

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
          subtitle: t('homeHub.cards.manage.manageClub.subtitle', 'Accédez à votre espace club et gérez votre organisation.'),
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
          icon: 'calendar',
          key: 'manage-add-event',
          onPress: handleAddEvent,
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
          icon: 'running',
          key: 'manage-add-ad',
          onPress: handleAddRecruitmentAd,
          subtitle: t('homeHub.cards.manage.addAd.subtitle', 'Publiez une annonce pour rechercher un profil précis.'),
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
          subtitle: t('homeHub.cards.manage.manageClub.subtitle', 'Accédez à votre espace club et gérez votre organisation.'),
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
          icon: 'calendar',
          key: 'manage-add-event',
          onPress: handleAddEvent,
          subtitle: t('homeHub.cards.manage.addEvent.subtitle'),
          subtitleLines: 2,
          title: t('homeHub.cards.manage.addEvent.title'),
          tutorial: makeTutorial('manageAddEvent', 4, 'Ajouter un événement', 'Créez un entraînement, match ou détection pour vos équipes.'),
        },
        {
          accentColor: Colors.primary500,
          icon: 'running',
          key: 'manage-add-ad',
          onPress: handleAddRecruitmentAd,
          subtitle: t('homeHub.cards.manage.addAd.subtitle', 'Publiez une annonce pour rechercher un profil précis.'),
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
              onNext: scrollToSearchSection,
            },
          ),
        },
      ];
    }

    return [];
  }, [
    Colors.primary500,
    handleAddEvent,
    handleAddRecruitmentAd,
    handleOpenManageClub,
    handleOpenRequestsHub,
    isCoach,
    isPresident,
    makeTutorial,
    scrollDownLabel,
    scrollToSearchSection,
    t,
  ]);

  /** @type {HomeCard[]} */
  const searchCards = useMemo(() => ([
    {
      accentColor: Colors.primary500,
      icon: 'calendar',
      key: 'search-events',
      onPress: () => navigation.navigate(RouteNames.SearchEvents),
      subtitle: t('homeHub.cards.search.events.subtitle'),
      title: t('homeHub.cards.search.events.title'),
      tutorial: makeTutorial('searchEvents', 10, 'Rechercher un événement', 'Trouvez des événements sportifs en utilisant les filtres de recherche.'),
    },
    {
      accentColor: Colors.primary500,
      icon: 'shield',
      key: 'search-clubs',
      onPress: () => navigation.navigate(RouteNames.SearchClubs),
      subtitle: t('homeHub.cards.search.clubs.subtitle'),
      title: t('homeHub.cards.search.clubs.title'),
      tutorial: makeTutorial('searchClubs', 11, 'Rechercher un club', 'Explorez les clubs et ouvrez leur fiche détaillée.'),
    },
    {
      accentColor: Colors.primary500,
      icon: 'stadium',
      key: 'search-reservations',
      onPress: () => navigation.navigate(RouteNames.SearchReservations),
      subtitle: t('homeHub.cards.search.reservations.subtitle'),
      title: t('homeHub.cards.search.reservations.title'),
      tutorial: makeTutorial('searchReservations', 12, 'Rechercher une réservation', 'Accédez aux réservations et filtrez selon votre activité.'),
    },
    {
      accentColor: Colors.primary500,
      icon: 'running',
      key: 'search-ads',
      onPress: () => navigation.navigate(RouteNames.SearchRecruitment, { initialRecruitmentTab: 'annonces' }),
      subtitle: t('homeHub.cards.search.ads.subtitle'),
      title: t('homeHub.cards.search.ads.title'),
      tutorial: makeTutorial(
        'searchAds',
        13,
        'Rechercher des annonces',
        'Consultez les annonces de recrutement et les profils disponibles.',
        {
          nextAction: 'scrollDown',
          nextLabel: scrollDownLabel,
          onNext: scrollToLeagueSection,
        },
      ),
    },
  ]), [Colors.primary500, makeTutorial, navigation, scrollDownLabel, scrollToLeagueSection, t]);

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
          onNext: scrollToProfileSection,
        },
      ),
    },
  ]), [Colors.gold500, handleOpenLeague, makeTutorial, scrollDownLabel, scrollToProfileSection, t]);

  /** @type {HomeCard[]} */
  const profileCards = useMemo(() => ([
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
          onNext: scrollToQuickSection,
        },
      ),
    },
  ]), [
    Colors.primary500,
    handleEditProfile,
    handleOpenHistory,
    handleOpenProfile,
    handleOpenSearchAlerts,
    makeTutorial,
    scrollDownLabel,
    scrollToQuickSection,
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
      icon: 'envelope',
      key: 'quick-chat',
      onPress: handleOpenMessaging,
      subtitle: t('homeHub.cards.quick.chat.subtitle'),
      title: t('homeHub.cards.quick.chat.title'),
      tutorial: makeTutorial(
        'quickChat',
        42,
        'Messagerie',
        'Ouvrez votre messagerie et suivez vos conversations.',
        {
          nextAction: 'scrollDown',
          nextLabel: scrollDownLabel,
          onNext: scrollToAccountSection,
        },
      ),
    },
  ]), [
    Colors.primary500,
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
      tutorial: makeTutorial('accountLogout', 51, 'Déconnexion', 'Déconnectez-vous proprement de l\'appareil actuel.'),
    },
    {
      accentColor: Colors.primary500,
      icon: 'search',
      key: 'account-tutorial-center',
      onPress: openTutorialCenterModal,
      subtitle: t('homeHub.cards.account.tutorial.subtitle', 'Relancer un tutoriel ou réinitialiser les guides.'),
      title: t('homeHub.cards.account.tutorial.title', 'Tutoriels et aide'),
      tutorial: makeTutorial('tutorialCenter', 52, 'Tutoriels et aide', 'Relancez un tutoriel quand vous voulez, ou remettez tout a zero.'),
    },
  ]), [
    Colors.error500,
    Colors.primary500,
    handleLogout,
    openTutorialCenterModal,
    handleOpenAccountSwitcher,
    logoutMutation.isPending,
    makeTutorial,
    t,
  ]);

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[Spaces.paddingBottom[24], Alignments.column, Alignments.fill]}
    >
      <View style={[Spaces.marginTop[16], Spaces.marginBottom[24], Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
        <LeagueHeaderSwitch />
        <View style={{ alignItems: 'center', flexDirection: 'row' }}>
          <NotificationBadge />
          <ProfileButton />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[Spaces.gap[24], { paddingBottom: scrollBottomPadding }]}
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
      >
        <OnboardingWrapper
          description={t('homeHubTutorial.steps.header.description', 'Cette page vous donne un accès rapide à toutes les fonctionnalités principales.')}
          id="homehub-header"
          nextAction={!hasManageSection ? 'scrollDown' : undefined}
          nextLabel={!hasManageSection ? scrollDownLabel : undefined}
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

        <View onLayout={(event) => registerSectionAnchor('manage', event)}>
          <HomeSection Alignments={Alignments} cards={manageSectionCards} Fonts={Fonts} Spaces={Spaces} title={t('homeHub.sections.manageClub')} />
        </View>
        <View onLayout={(event) => registerSectionAnchor('search', event)}>
          <HomeSection Alignments={Alignments} cards={searchCards} Fonts={Fonts} Spaces={Spaces} title={t('homeHub.sections.search')} />
        </View>
        <View onLayout={(event) => registerSectionAnchor('league', event)}>
          <HomeSection Alignments={Alignments} cards={leagueCards} Fonts={Fonts} Spaces={Spaces} title={t('homeHub.sections.league')} />
        </View>
        <View onLayout={(event) => registerSectionAnchor('profile', event)}>
          <HomeSection Alignments={Alignments} cards={profileCards} Fonts={Fonts} Spaces={Spaces} title={t('homeHub.sections.profile')} />
        </View>
        <View onLayout={(event) => registerSectionAnchor('quick', event)}>
          <HomeSection Alignments={Alignments} cards={quickNavCards} Fonts={Fonts} Spaces={Spaces} title={t('homeHub.sections.quickNav')} />
        </View>
        <View onLayout={(event) => registerSectionAnchor('account', event)}>
          <HomeSection Alignments={Alignments} cards={accountCards} Fonts={Fonts} Spaces={Spaces} title={t('homeHub.sections.account')} />
        </View>
      </ScrollView>

      {isFocused ? (
        <>
          <BottomModal close={closeTutorialCenterModal} isVisible={isTutorialCenterVisible} snapPoints={['48%']}>
            <View style={[Spaces.gap[12], Spaces.paddingBottom[24]]}>
              <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{t('homeHubTutorial.center.title', 'Tutoriels et aide')}</Text>
              <Text style={[Fonts.p2, Fonts.neutral200]}>{t('homeHubTutorial.center.subtitle', 'Relancez un tutoriel ou réinitialisez tous les guides.')}</Text>
              <Button onPress={startHomeTutorial} title={t('homeHubTutorial.center.actions.relaunchHome', 'Relancer le tutoriel Accueil')} variant="Primary" />
              <Button onPress={openFeatureTutorialPicker} title={t('homeHubTutorial.center.actions.pickFeature', 'Choisir un tutoriel de fonctionnalité')} variant="Secondary" />
              <Button onPress={handleResetAllTutorials} title={t('homeHubTutorial.center.actions.resetAll', 'Réinitialiser tous les tutoriels')} variant="Secondary" />
            </View>
          </BottomModal>

          <BottomModal close={closeFeatureTutorialPicker} isVisible={isFeatureTutorialPickerVisible} snapPoints={['75%']}>
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

      {isEntryGateVisible ? (
        <View
          style={[
            Alignments.absolute,
            Alignments.justifyCenter,
            Alignments.alignCenter,
            Spaces.paddingHorizontal[24],
            {
              backgroundColor: 'rgba(0, 18, 24, 0.88)',
              bottom: 0,
              left: 0,
              right: 0,
              top: 0,
              zIndex: 60,
            },
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
                'Vous pouvez lancer le tutoriel complet pour tout comprendre, ou explorer l\'application par vous même.',
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
    </ScreenContainer>
  );
}

/**
 *
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function HomeHub({ navigation, route }) {
  const auth = useAuth();
  const userId = auth?.userData?.documentId;

  const handleForceStartHandled = useCallback(() => {
    navigation.setParams({
      startTutorial: undefined,
      tutorialId: undefined,
      tutorialSource: undefined,
      tutorialStartToken: undefined,
    });
  }, [navigation]);

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
