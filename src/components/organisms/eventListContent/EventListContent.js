import { useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isBefore, startOfDay } from 'date-fns';
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
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { USER_ROLES } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import {
  getParticipationErrorMessage,
  resolveParticipationFlow,
} from '@/domains/participation/participationFlow';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import EmptyState from '@/components/atoms/emptyState/EmptyState';
import DateSlider from '@/components/molecules/dateSlider/DateSlider';
import EventCardNew from '@/components/molecules/eventCard/EventCardNew';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import FeaturedEvents from '@/components/organisms/featuredEvents/FeaturedEvents';
import SearchComponent from '@/components/organisms/searchComponent/searchComponent';

import { navigateToStackScreenOrScreen } from '@/navigation/navigationAvailability';
import { openPublicAuthFlow } from '@/navigation/public/publicAuthNavigation';
import { RouteNames } from '@/navigation/routeNames';
import useBottomDockLayout from '@/navigation/useBottomDockLayout';

import { useGetEvents } from '@/services/event/eventQueries';
import { missingEvent, respondToEventRsvp } from '@/services/event/eventService';
import { createEventParticipation } from '@/services/eventParticipation/eventParticipationService';
import { joinReservation } from '@/services/reservation/reservationService';
import { useSearchEvents, useSearchEventsMap } from '@/services/search/searchQueries';
import { getMatchReasonLabel, mapSearchPayload } from '@/services/search/searchService';

import { createLogger } from '@/utils/logger/logger';
import { markSearchPerf } from '@/utils/performance/searchPerformance';

import JoinEventModal from '../joinEventModal/JoinEventModal';

const eventListLogger = createLogger('event-list');
const FEATURED_CLUB_SCOPES = ['SECTION', 'CM'];

const isApprovedFeaturedEvent = (event, scopes = []) => {
  if (!event?.isFeatured || event?.featuredRequestStatus !== 'approved') {
    return false;
  }

  if (!Array.isArray(scopes) || !scopes.length) {
    return true;
  }

  return scopes.includes(String(event?.featuredScope || '').toUpperCase());
};

const hasFiniteViewportBounds = (viewport) => (
  Number.isFinite(Number(viewport?.north))
  && Number.isFinite(Number(viewport?.south))
  && Number.isFinite(Number(viewport?.east))
  && Number.isFinite(Number(viewport?.west))
);

const buildViewportListQuery = (viewport, filters = {}) => {
  if (!viewport || !hasFiniteViewportBounds(viewport)) {
    return null;
  }

  const q = typeof filters?.q === 'string' ? filters.q.trim() : '';

  return {
    activity: filters?.activity,
    category: filters?.category,
    centerLat: viewport.lat,
    centerLon: viewport.lng,
    club: filters?.club?.value || filters?.club,
    east: viewport.east,
    excludeType: filters?.excludeType,
    level: filters?.level,
    north: viewport.north,
    pageSize: 30,
    q: q.length >= 2 ? q : undefined,
    sessionStatus: filters?.sessionStatus,
    south: viewport.south,
    startDateAfter: filters?.startDateAfter,
    startDateBefore: filters?.startDateBefore,
    teamIds: filters?.teamIds,
    type: filters?.type,
    view: 'list',
    west: viewport.west,
    zoom: viewport.zoom,
  };
};

function EventListSeparator() {
  return <View style={{ height: 16 }} />;
}

/** @typedef {import('@/domains/event/types').FCEvent} FCEvent */

/**
 * Event list content to be used in home page or dedicated event list screen
 * @param {object} props
 * @param {boolean} [props.showFilters] - Whether to hide the filters section
 * @param {{
 *   teamIds?: string[];
 *   participantId?: string;
 *   name?: string;
 *   type?: string;
 *   club?: {label: string, value: string};
 *   category?: string;
 *   level?: string;
 *   activity?: string;
 *   sessionStatus?: string;
 *   q?: string;
 *   useOrFilter?: boolean;
 * }} [props.additionalFilters] - Whether the event list is open
 * @param {any[]} [props.events] - External list of events (optional)
 * @param {Function} [props.onLoadMore] - Callback for loading more events (optional)
 * @param {boolean} [props.isLoading] - External loading state (optional)
 * @param {boolean} [props.isPlanning] - Whether the list is displayed in planning mode (optional)
 * @param {(key: 'filters' | 'card', layout: { x: number; y: number; width: number; height: number }) => void} [props.onTutorialLayout]
 * @param {boolean} [props.enableMapMode]
 * @param {number} [props.refreshSignal]
 * @param {boolean} [props.screenActive]
 * @returns {import('react').ReactElement} Event list content component
 */
function EventListContent({
  additionalFilters,
  enableMapMode = false,
  events: propEvents,
  isLoading: propIsLoading,
  isPlanning = false,
  onLoadMore,
  onTutorialLayout,
  refreshSignal = 0,
  screenActive = true,
  showFilters = false,
}) {
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [joinModalError, setJoinModalError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(/** @type {FCEvent | undefined} */(undefined));
  const [areFeaturedEventsEnabled, setAreFeaturedEventsEnabled] = useState(false);
  const filtersTargetRef = useRef(/** @type {import('react-native').View | null} */ (null));
  const firstCardTargetRef = useRef(/** @type {import('react-native').View | null} */ (null));
  const primaryQuerySignatureRef = useRef('');
  const firstResultsSignatureRef = useRef('');
  const secondaryQuerySignatureRef = useRef('');

  // Date Picker State
  // Date Picker State
  const [selectedDate, setSelectedDate] = useState(new Date());

  // hooks
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const [{ eventFilters, searchMapSessions }, appDispatch] = useAppContext();
  const { userData } = useAuth();
  const userDocumentId = userData?.documentId;
  const viewportSession = searchMapSessions?.events || {};
  const { sceneBottomInset } = useBottomDockLayout();

  const emitTutorialLayout = useCallback((key, ref) => {
    if (!onTutorialLayout || !ref?.current) return;
    requestAnimationFrame(() => {
      ref.current?.measureInWindow((x, y, width, height) => {
        if (!width || !height) return;
        onTutorialLayout(key, {
          height: Math.round(height),
          width: Math.round(width),
          x: Math.round(x),
          y: Math.round(y),
        });
      });
    });
  }, [onTutorialLayout]);

  const eventsConfig = useMemo(() => ({
    ...(showFilters ? eventFilters : {}),
    ...additionalFilters,
    pageSize: 15,
  }), [showFilters, eventFilters, additionalFilters]);
  const viewportExecutedQuery = viewportSession?.executedQuery || null;
  const viewportRegion = viewportSession?.searchedViewport
    || viewportSession?.executedViewport
    || null;
  const isViewportListMode = viewportExecutedQuery?.view === 'list'
    && hasFiniteViewportBounds(viewportRegion);
  const viewportListParams = useMemo(
    () => (isViewportListMode ? buildViewportListQuery(viewportRegion, eventsConfig) : null),
    [eventsConfig, isViewportListMode, viewportRegion],
  );
  const activeSearchText = useMemo(
    () => (typeof eventsConfig?.q === 'string' ? eventsConfig.q.trim() : ''),
    [eventsConfig?.q],
  );
  const isSmartSearchEnabled = !isViewportListMode && activeSearchText.length >= 2;

  // Get user's club and multisport club IDs for membership filtering
  const userClubId = userData?.club?.documentId;
  const userCmIds = useMemo(() => userData?.multisportClubs?.map((cm) => cm.documentId) || [], [userData?.multisportClubs]);
  // Also get CM from user's teams
  const teamCmIds = useMemo(() => userData?.trainedTeams?.map((team) => team.club?.parentMultisport?.documentId).filter(Boolean) || [], [userData?.trainedTeams]);
  const allCmIds = useMemo(() => [...new Set([...teamCmIds, ...userCmIds])], [userCmIds, teamCmIds]);

  const featuredEventsConfig = useMemo(() => {
    const config = /** @type {Record<string, any>} */ ({
      ...(showFilters ? eventFilters : {}),
      ...additionalFilters,
      featuredRequestStatus: 'approved',
      isFeatured: true,
      pageSize: 5,
      sessionStatus: 'open',
    });

    if (isPlanning) {
      // SECTION/CM featured events - filter by user's membership
      config.featuredScope = ['SECTION', 'CM'];
      // Add club filter to only show events from user's club/CM
      if (userClubId || allCmIds.length) {
        config.membershipClubIds = [userClubId, ...allCmIds].filter(Boolean);
      }
    } else {
      // PUBLIC featured - visible to everyone
      config.featuredScope = 'PUBLIC';
    }

    return config;
  }, [showFilters, eventFilters, additionalFilters, isPlanning, userClubId, allCmIds]);

  // Only fetch if no external events are provided
  const {
    data: requestPages,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isInternalLoading,
    refetch,
  } = useGetEvents(eventsConfig, {
    enabled: screenActive && !propEvents && !isViewportListMode && !isSmartSearchEnabled,
  });
  const {
    data: searchPages,
    error: searchError,
    fetchNextPage: fetchSearchNextPage,
    hasNextPage: hasSearchNextPage,
    isFetchingNextPage: isFetchingSearchNextPage,
    isLoading: isSearchLoading,
    refetch: refetchSearch,
  } = useSearchEvents({
    activity: eventsConfig?.activity,
    category: eventsConfig?.category,
    club: eventsConfig?.club?.value || eventsConfig?.club,
    excludeType: eventsConfig?.excludeType,
    lat: eventsConfig?.lat,
    level: eventsConfig?.level,
    lon: eventsConfig?.lon,
    pageSize: eventsConfig?.pageSize || 15,
    q: activeSearchText,
    radius: eventsConfig?.radius,
    sessionStatus: eventsConfig?.sessionStatus,
    startDateAfter: eventsConfig?.startDateAfter,
    startDateBefore: eventsConfig?.startDateBefore,
    teamIds: eventsConfig?.teamIds,
    type: eventsConfig?.type,
  }, {
    enabled: screenActive && !propEvents && !isViewportListMode && isSmartSearchEnabled,
  });
  const {
    data: viewportPages,
    error: viewportError,
    fetchNextPage: fetchViewportNextPage,
    hasNextPage: hasViewportNextPage,
    isFetchingNextPage: isFetchingViewportNextPage,
    isLoading: isViewportLoading,
    refetch: refetchViewport,
  } = useSearchEventsMap(viewportListParams || {}, {
    enabled: screenActive && !propEvents && isViewportListMode && Boolean(viewportListParams),
  });

  const {
    data: featuredPages,
    refetch: refetchFeatured,
  } = useGetEvents(featuredEventsConfig, {
    enabled: screenActive && !propEvents && areFeaturedEventsEnabled,
  });

  const selectedParticipationFlow = useMemo(
    () => resolveParticipationFlow(selectedEvent, { user: userData }),
    [selectedEvent, userData],
  );
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!screenActive || propEvents) {
      setAreFeaturedEventsEnabled(false);
      return undefined;
    }

    let cancelled = false;
    setAreFeaturedEventsEnabled(false);
    const task = InteractionManager.runAfterInteractions(() => {
      if (!cancelled) {
        setAreFeaturedEventsEnabled(true);
      }
    });

    return () => {
      cancelled = true;
      task.cancel?.();
    };
  }, [eventsConfig, propEvents, screenActive]);
  /**
   * Mutation to create an event participation
   * @type {import('@tanstack/react-query').UseMutationResult<EventParticipation,
   * Error, {user: string, event: string, reason?: string}, unknown>}
   */
  const createEventParticipationMutation = useMutation({
    mutationFn: createEventParticipation,
    onError: (mutationError) => {
      const message = getParticipationErrorMessage(mutationError, t('common.errorOccurred'));
      Alert.alert(t('common.error', 'Erreur'), message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['planning', 'personal'] });
      if (!propEvents) {
        if (isViewportListMode) {
          refetchViewport();
        } else if (isSmartSearchEnabled) {
          refetchSearch();
        } else {
          refetch();
        }
      }
      setIsJoinModalVisible(false);
      setJoinModalError('');
    },
  });
  const joinReservationMutation = useMutation({
    mutationFn: (reservationId) => joinReservation(reservationId),
    onError: (mutationError) => {
      const message = getParticipationErrorMessage(mutationError, t('common.errorOccurred'));
      Alert.alert(t('common.error', 'Erreur'), message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['planning', 'personal'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['featured-reservations'] });
      if (!propEvents) {
        if (isViewportListMode) {
          refetchViewport();
        } else if (isSmartSearchEnabled) {
          refetchSearch();
        } else {
          refetch();
        }
      }
      setIsJoinModalVisible(false);
      setJoinModalError('');
    },
  });

  // variables
  const internalEvents = useMemo(() => requestPages?.pages
    ?.reduce((/** @type {FCEvent[]} */ acc, page) => {
      const items = page?.data || [];
      return acc.concat(items);
    }, [])
    || [], [requestPages]);
  const smartEvents = useMemo(() => searchPages?.pages
    ?.reduce((/** @type {FCEvent[]} */ acc, page) => {
      const items = mapSearchPayload(page);
      return acc.concat(items);
    }, [])
    || [], [searchPages]);
  const viewportEvents = useMemo(() => viewportPages?.pages
    ?.reduce((/** @type {FCEvent[]} */ acc, page) => {
      const items = mapSearchPayload(page);
      return acc.concat(items);
    }, [])
    || [], [viewportPages]);

  const featuredEvents = useMemo(() => featuredPages?.pages
    ?.reduce((/** @type {FCEvent[]} */ acc, page) => {
      const items = page?.data || [];
      return acc.concat(items);
    }, [])
    .filter((event) => {
      if (!event.date) return false;
      if (isBefore(new Date(event.date), startOfDay(new Date()))) return false;
      return isApprovedFeaturedEvent(
        event,
        isPlanning ? FEATURED_CLUB_SCOPES : ['PUBLIC'],
      );
    })
    || [], [featuredPages, isPlanning]);

  const viewportMeta = viewportPages?.pages?.[0]?.meta || null;
  const viewportTotalInBounds = Number(viewportMeta?.totalInBounds);
  const viewportDisplayCount = Number.isFinite(viewportTotalInBounds) && viewportTotalInBounds > 0
    ? viewportTotalInBounds
    : viewportEvents.length;
  const isViewportTruncated = Boolean(viewportMeta?.truncated);
  let events = propEvents || internalEvents;
  if (isViewportListMode) {
    events = viewportEvents;
  } else if (isSmartSearchEnabled) {
    events = smartEvents;
  }

  let activeError = error;
  if (isViewportListMode) {
    activeError = viewportError;
  } else if (isSmartSearchEnabled) {
    activeError = searchError;
  }

  let isLoading = propIsLoading !== undefined ? propIsLoading : isInternalLoading;
  if (propIsLoading === undefined) {
    if (isViewportListMode) {
      isLoading = isViewportLoading;
    } else if (isSmartSearchEnabled) {
      isLoading = isSearchLoading;
    }
  }
  const shouldShowMapToggle = enableMapMode && events.length > 0;
  const listBottomPadding = sceneBottomInset;
  let isListFetchingNext = isFetchingNextPage;
  if (isViewportListMode) {
    isListFetchingNext = isFetchingViewportNextPage;
  } else if (isSmartSearchEnabled) {
    isListFetchingNext = isFetchingSearchNextPage;
  }
  let activeMode = 'default-list';
  if (isViewportListMode) {
    activeMode = 'viewport-list';
  } else if (isSmartSearchEnabled) {
    activeMode = 'smart-search';
  }

  useEffect(() => {
    if (!screenActive) return;

    const signature = JSON.stringify({
      mode: activeMode,
      q: activeSearchText,
      viewport: isViewportListMode ? viewportListParams : null,
    });
    if (primaryQuerySignatureRef.current === signature) return;
    primaryQuerySignatureRef.current = signature;
    markSearchPerf('search_primary_query_started', {
      fromCache: events.length > 0,
      mode: activeMode,
      networkCount: 1,
      type: 'events',
    });
  }, [activeMode, activeSearchText, events.length, isViewportListMode, screenActive, viewportListParams]);

  useEffect(() => {
    if (!screenActive || isLoading) return;

    const signature = JSON.stringify({
      count: events.length,
      mode: activeMode,
    });
    if (firstResultsSignatureRef.current === signature) return;
    firstResultsSignatureRef.current = signature;
    markSearchPerf('search_primary_query_completed', {
      fromCache: events.length > 0 && !isListFetchingNext,
      mode: activeMode,
      networkCount: 1,
      resultCount: events.length,
      type: 'events',
    });
    markSearchPerf('search_first_results_rendered', {
      fromCache: events.length > 0 && !isListFetchingNext,
      mode: activeMode,
      networkCount: 1,
      resultCount: events.length,
      type: 'events',
    });
  }, [activeMode, events.length, isListFetchingNext, isLoading, screenActive]);

  useEffect(() => {
    if (!screenActive || !areFeaturedEventsEnabled || propEvents) return;

    const signature = `${activeMode}:${featuredEvents.length}`;
    if (secondaryQuerySignatureRef.current === signature) return;
    secondaryQuerySignatureRef.current = signature;
    markSearchPerf('search_secondary_query_started', {
      fromCache: featuredEvents.length > 0,
      mode: activeMode,
      networkCount: 1,
      type: 'events',
    });
    markSearchPerf('search_secondary_query_completed', {
      fromCache: featuredEvents.length > 0,
      mode: activeMode,
      networkCount: 1,
      resultCount: featuredEvents.length,
      type: 'events',
    });
  }, [activeMode, areFeaturedEventsEnabled, featuredEvents.length, propEvents, screenActive]);

  const filterCount = useMemo(() => {
    if (!eventFilters) return 0;

    return Object.entries(eventFilters).reduce((/** @type {number} */ acc, [key, value]) => {
      // Skip date range filters completely
      if (key === 'startDateBefore' || key === 'startDateAfter') {
        return acc;
      }

      // Skip location-related filters (city, radius, geohash)
      if (key === 'radius' || key === 'city' || key === 'geohash') {
        return acc;
      }

      // Skip teamIds array filter
      if (key === 'teamIds') {
        return acc;
      }

      // Skip if the value is falsy or an empty array
      if (!value || (Array.isArray(value) && value.length === 0)) {
        return acc;
      }

      return acc + 1;
    }, 0);
  }, [eventFilters]);

  // handlers
  const handleEndReached = useCallback(() => {
    if (onLoadMore) {
      onLoadMore();
    } else if (isViewportListMode) {
      if (hasViewportNextPage && !isFetchingViewportNextPage) {
        fetchViewportNextPage();
      }
    } else if (isSmartSearchEnabled) {
      if (hasSearchNextPage && !isFetchingSearchNextPage) {
        fetchSearchNextPage();
      }
    } else if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [
    fetchNextPage,
    fetchViewportNextPage,
    fetchSearchNextPage,
    hasNextPage,
    hasViewportNextPage,
    hasSearchNextPage,
    isFetchingNextPage,
    isFetchingViewportNextPage,
    isFetchingSearchNextPage,
    isViewportListMode,
    isSmartSearchEnabled,
    onLoadMore,
  ]);

  /**
   * Mutation for marking an event as missing
   * @type {import('@tanstack/react-query').UseMutationResult<any, Error, string, unknown>}
   */
  const missingEventMutation = useMutation({
    mutationFn: missingEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['planning', 'personal'] });
      if (!propEvents) {
        if (isViewportListMode) {
          refetchViewport();
        } else if (isSmartSearchEnabled) {
          refetchSearch();
        } else {
          refetch();
        }
      }
    },
  });

  const respondToEventRsvpMutation = useMutation({
    mutationFn: ({ answer, eventId }) => respondToEventRsvp(eventId, answer),
    onError: (mutationError) => {
      Alert.alert(
        t('common.error', 'Erreur'),
        getParticipationErrorMessage(mutationError, t('common.errorOccurred')),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['planning', 'personal'] });
      if (!propEvents) {
        if (isViewportListMode) {
          refetchViewport();
        } else if (isSmartSearchEnabled) {
          refetchSearch();
        } else {
          refetch();
        }
      }
    },
  });

  const handleEventSelect = useCallback((/** @type {FCEvent} */ event) => {
    if (!event?.documentId) {
      eventListLogger.warn('Navigation blocked: missing event documentId');
      return;
    }
    eventListLogger.debug('Navigating to event details', { eventDocumentId: event.documentId });
    navigateToStackScreenOrScreen(/** @type {any} */ (navigation), {
      params: { eventId: event.documentId },
      screen: RouteNames.EventDetails,
      stack: RouteNames.EventStack,
    });
  }, [navigation]);

  const handleOpenFilters = useCallback(() => {
    navigateToStackScreenOrScreen(navigation, {
      screen: RouteNames.EventFilters,
      stack: RouteNames.EventStack,
    });
  }, [navigation]);

  const handleFindEvent = () => {
    // @ts-expect-error because of react navigation type definitions
    navigation.navigate(RouteNames.SearchEvents);
  };

  const handleSearchField = useCallback((/** @type {string} */ q) => {
    appDispatch({
      payload: {
        ...(eventFilters || {}),
        q,
      },
      type: 'SET_EVENT_FILTERS',
    });
  }, [appDispatch, eventFilters]);

  const handleJoinEvent = useCallback((/** @type {FCEvent} */ event) => {
    const participationFlow = resolveParticipationFlow(event, { user: userData });
    if (!participationFlow?.canAct) {
      Alert.alert(
        t('common.error', 'Erreur'),
        participationFlow?.blockedReason || t('common.errorOccurred'),
      );
      return;
    }

    if (participationFlow?.submitMode === 'redirect-parent' && event?.parentEvent?.documentId) {
      handleEventSelect(event.parentEvent);
      return;
    }

    if (participationFlow?.submitMode === 'detection-slot-picker') {
      handleEventSelect(event);
      return;
    }

    setJoinModalError('');
    setSelectedEvent(event);
    setIsJoinModalVisible(true);
  }, [handleEventSelect, t, userData]);

  const handleParticipateToEvent = useCallback(async (/** @type {FCEvent} */ event) => {
    const isStageDayEvent = String(event?.eventFormat || '').toLowerCase() === 'stage_day';
    if (isStageDayEvent && event?.documentId) {
      try {
        await respondToEventRsvpMutation.mutateAsync({
          answer: 'present',
          eventId: event.documentId,
        });
      } catch {
        // Error feedback is handled by the mutation.
      }
      return;
    }

    const participationFlow = resolveParticipationFlow(event, { user: userData });

    if (!participationFlow?.canAct) {
      Alert.alert(
        t('common.error', 'Erreur'),
        participationFlow?.blockedReason || t('common.errorOccurred'),
      );
      return;
    }

    if (participationFlow?.kind === 'reservation-recruiting') {
      handleJoinEvent(event);
      return;
    }

    if (participationFlow?.submitMode === 'redirect-parent' && event?.parentEvent?.documentId) {
      handleEventSelect(event.parentEvent);
      return;
    }

    if (!event?.documentId || !userDocumentId) {
      return;
    }

    try {
      await createEventParticipationMutation.mutateAsync({
        event: event.documentId,
        user: userDocumentId,
      });
    } catch (mutationError) {
      Alert.alert(
        t('common.error', 'Erreur'),
        getParticipationErrorMessage(mutationError, t('common.errorOccurred')),
      );
    }
  }, [
    createEventParticipationMutation,
    handleEventSelect,
    handleJoinEvent,
    respondToEventRsvpMutation,
    t,
    userData,
    userDocumentId,
  ]);

  const handleDeclineEvent = useCallback((/** @type {FCEvent} */ event) => {
    if (!event?.documentId) return;
    if (String(event?.eventFormat || '').toLowerCase() === 'stage_day') {
      respondToEventRsvpMutation.mutate({
        answer: 'absent',
        eventId: event.documentId,
      });
      return;
    }
    missingEventMutation.mutate(event.documentId);
  }, [missingEventMutation, respondToEventRsvpMutation]);

  const handleGoLogin = () => {
    openPublicAuthFlow(navigation, {
      origin: RouteNames.EventDetails,
      source: 'event-list-login',
    });
  };

  const handleCloseJoinModal = useCallback(() => {
    setIsJoinModalVisible(false);
    setJoinModalError('');
    setSelectedEvent(undefined);
  }, []);

  const handleConfirmJoinEvent = useCallback(async () => {
    if (!selectedEvent?.documentId) {
      return;
    }

    const participationFlow = resolveParticipationFlow(selectedEvent, { user: userData });

    try {
      if (participationFlow?.kind === 'reservation-recruiting') {
        await joinReservationMutation.mutateAsync(selectedEvent.documentId);
        return;
      }

      if (!userDocumentId) {
        return;
      }

      await createEventParticipationMutation.mutateAsync({
        event: selectedEvent.documentId,
        user: userDocumentId,
      });
    } catch (mutationError) {
      setJoinModalError(getParticipationErrorMessage(mutationError, t('common.errorOccurred')));
    }
  }, [
    createEventParticipationMutation,
    joinReservationMutation,
    selectedEvent,
    t,
    userData,
    userDocumentId,
  ]);

  // Date Picker Handlers
  const handleDateSelected = useCallback((/** @type {Date} */ date) => {
    setSelectedDate(date);
    const start = startOfDay(date).toISOString();

    appDispatch({
      payload: {
        ...(eventFilters || {}),
        startDateAfter: start,
      },
      type: 'SET_EVENT_FILTERS',
    });
  }, [appDispatch, eventFilters]);

  useEffect(() => {
    if (!screenActive || !refreshSignal || propEvents) return;

    if (isViewportListMode) {
      refetchViewport();
      return;
    }

    if (isSmartSearchEnabled) {
      refetchSearch();
      return;
    }

    refetch();
    if (areFeaturedEventsEnabled) {
      refetchFeatured();
    }
  }, [
    areFeaturedEventsEnabled,
    isSmartSearchEnabled,
    isViewportListMode,
    propEvents,
    refreshSignal,
    refetch,
    refetchFeatured,
    refetchSearch,
    refetchViewport,
    screenActive,
  ]);

  // renderers
  /**
   * Renders an individual event item
   * @param {object} param - The item to render
   * @param {FCEvent} param.item
   * @param param.index
   * @returns {import('react').ReactElement} The rendered event item
   */
  const renderItem = ({ index, item }) => {
    const isReservation = item?.type?.name === 'Réservation';
    const isManager = userData?.role?.name === USER_ROLES.coach || userData?.role?.name === USER_ROLES.president;
    const showAbout = isPlanning || isManager;
    const card = isReservation ? (
      <EventCardNew
        actionLabel={showAbout ? t('eventList.actions.about') : undefined}
        item={item}
        onDecline={() => {}}
        onJoin={() => {}}
        onLogin={handleGoLogin}
        onParticipate={() => (showAbout ? handleEventSelect(item) : handleParticipateToEvent(item))}
        onPress={() => handleEventSelect(item)}
      />
    ) : (
      <EventCardNew
        item={item}
        onDecline={() => handleDeclineEvent(item)}
        onJoin={() => handleJoinEvent(item)}
        onLogin={handleGoLogin}
        onParticipate={() => handleParticipateToEvent(item)}
        onPress={() => handleEventSelect(item)}
      />
    );

    const searchMeta = item ? Reflect.get(item, '__search') : null;
    const primaryReasonLabel = getMatchReasonLabel(searchMeta?.matchReasons?.[0]);
    const wrappedCard = primaryReasonLabel ? (
      <View style={[Spaces.gap[8]]}>
        <Text style={[Fonts.p3, Fonts.primary500]}>
          {`Tri pertinence: ${primaryReasonLabel}`}
        </Text>
        {card}
      </View>
    ) : card;

    if (!onTutorialLayout || index !== 0) return wrappedCard;

    return (
      <View
        onLayout={() => emitTutorialLayout('card', firstCardTargetRef)}
        ref={firstCardTargetRef}
      >
        {wrappedCard}
      </View>
    );
  };

  const emptyListContent = (
    <EmptyState
      actionLabel={!showFilters ? t('eventList.actions.findEvent') : undefined}
      description={!showFilters ? t('eventList.emptyDesc', 'Essayez de modifier vos filtres ou lancez une nouvelle recherche.') : undefined}
      icon={Images.search}
      onAction={!showFilters ? handleFindEvent : undefined}
      title={t('eventList.noData')}
    />
  );
  const listHeader = (
    <View style={[Spaces.gap[16], Spaces.marginBottom[16]]}>
      {!propEvents && featuredEvents.length > 0 ? (
        <FeaturedEvents events={featuredEvents} />
      ) : null}

      <View style={[Spaces.gap[8]]}>
        <View
          style={[
            Alignments.row,
            Alignments.alignCenter,
            Alignments.justifySpaceBetween,
            Spaces.gap[12],
          ]}
        >
          <Text style={[Fonts.p1, { color: Colors.neutral00, flex: 1 }]}>
            {'\u00C9v\u00E9nements \u00E0 partir de'}
          </Text>

          {shouldShowMapToggle ? (
            <TouchableOpacity
              accessibilityHint={'Ouvre la vue carte des \u00E9v\u00E9nements.'}
              accessibilityLabel="Passer en mode carte"
              activeOpacity={0.85}
              onPress={() => navigation.navigate(RouteNames.SearchMapScreen, { scope: 'events' })}
              style={[
                Alignments.alignCenter,
                Alignments.justifyCenter,
                ApplicationStyle.borderWidth1,
                {
                  backgroundColor: Colors.primary900,
                  borderColor: Colors.primary500,
                  borderRadius: 16,
                  height: 40,
                  width: 40,
                },
              ]}
            >
              <Image
                resizeMode="contain"
                source={Images.pin}
                style={{
                  height: 18,
                  tintColor: Colors.primary500,
                  width: 18,
                }}
              />
            </TouchableOpacity>
          ) : null}
        </View>

        <DateSlider
          onDateSelected={handleDateSelected}
          selectedDate={selectedDate}
        />
      </View>

      {showFilters ? (
        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[16]]}>
          <View
            onLayout={() => emitTutorialLayout('filters', filtersTargetRef)}
            ref={filtersTargetRef}
            style={{ flex: 1 }}
          >
            <SearchComponent
              filterNumber={filterCount}
              handleSearchField={handleSearchField}
              openFilters={handleOpenFilters}
              searchDefaultValue={eventFilters?.q}
            />
          </View>
        </View>
      ) : null}
      {isViewportListMode ? (
        <View style={[Spaces.gap[4]]}>
          <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
            {`${viewportDisplayCount} \u00E9v\u00E9nement${viewportDisplayCount > 1 ? 's' : ''} dans cette zone`}
          </Text>
          {isViewportTruncated ? (
            <Text style={[Fonts.p4, Fonts.neutral200]}>
              Zoomez sur la carte pour afficher tous les événements de cette zone.
            </Text>
          ) : null}
        </View>
      ) : null}
      {isSmartSearchEnabled ? (
        <Text style={[Fonts.p3, Fonts.primary500]}>
          Trie par pertinence
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={[Spaces.gap[24], Alignments.fill]}>
      <WithDataWrapper
        error={activeError?.message}
        isLoading={isLoading && !isListFetchingNext}
        wrapperStyle={[Alignments.fill]}
      >
        <View style={[Alignments.fill, ApplicationStyle.borderRadius2]}>
          <FlashList
            contentContainerStyle={{ paddingBottom: listBottomPadding }}
            data={/** @type {FCEvent[]} */ (events)}
            estimatedItemSize={200}
            ItemSeparatorComponent={EventListSeparator}
            keyExtractor={(item) => (item?.documentId || 'unknown').toString()}
            ListEmptyComponent={emptyListContent}
            ListHeaderComponent={listHeader}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            onRefresh={() => {
              if (isViewportListMode) {
                refetchViewport();
              } else if (isSmartSearchEnabled) {
                refetchSearch();
              } else {
                refetch();
              }
              if (areFeaturedEventsEnabled) {
                refetchFeatured();
              }
            }}
            refreshing={isLoading && !isListFetchingNext}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </WithDataWrapper>
      <JoinEventModal
        clubName={selectedEvent?.team?.club?.name || ''}
        confirmLabel={selectedParticipationFlow?.confirmLabel}
        errorMessage={joinModalError || null}
        isSubmitting={
          joinReservationMutation.isPending
          || createEventParticipationMutation.isPending
        }
        isVisible={isJoinModalVisible}
        onClose={handleCloseJoinModal}
        onConfirm={handleConfirmJoinEvent}
      />
    </View>
  );
}

export default EventListContent;
