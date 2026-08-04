import { useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  addDays,
  isBefore,
  startOfDay,
  startOfMinute,
} from 'date-fns';
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
import Loader from '@/components/atoms/loader/Loader';
import DateSlider from '@/components/molecules/dateSlider/DateSlider';
import EventCardNew from '@/components/molecules/eventCard/EventCardNew';
import SearchResultsLoadingState from '@/components/molecules/searchResultsLoadingState/SearchResultsLoadingState';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import FeaturedEvents from '@/components/organisms/featuredEvents/FeaturedEvents';
import SearchComponent from '@/components/organisms/searchComponent/searchComponent';

import { navigateToStackScreenOrScreen } from '@/navigation/navigationAvailability';
import { openPublicAuthFlow } from '@/navigation/public/publicAuthNavigation';
import { RouteNames } from '@/navigation/routeNames';
import useBottomDockLayout from '@/navigation/useBottomDockLayout';

import { getEventsQueryKey, useGetEvents } from '@/services/event/eventQueries';
import { getEvents, missingEvent, respondToEventRsvp } from '@/services/event/eventService';
import { createEventParticipation } from '@/services/eventParticipation/eventParticipationService';
import { keepPreviousPageData } from '@/services/queryOptions';
import { joinReservation } from '@/services/reservation/reservationService';
import { useSearchEvents, useSearchEventsMap } from '@/services/search/searchQueries';
import { getMatchReasonLabel, mapSearchPayload } from '@/services/search/searchService';

import { createLogger } from '@/utils/logger/logger';
import { markSearchPerf } from '@/utils/performance/searchPerformance';

import JoinEventModal from '../joinEventModal/JoinEventModal';

const eventListLogger = createLogger('event-list');
const FEATURED_CLUB_SCOPES = ['SECTION', 'CM'];
const DATE_PREFETCH_OFFSETS = [-2, -1, 1, 2, 3, 4, 5, 6, 7];
const EVENT_LIST_STALE_MS = 60 * 1000;
const normalizeTypeName = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

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
 * @param {import('react').ReactElement | null} [props.customEmptyComponent] - Custom empty state (optional)
 * @param {number} [props.refreshSignal]
 * @param {boolean} [props.screenActive]
 * @returns {import('react').ReactElement} Event list content component
 */
function EventListContent({
  additionalFilters,
  customEmptyComponent = null,
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
  const [isDateRefreshPending, setIsDateRefreshPending] = useState(false);
  const [hasDateRefreshStarted, setHasDateRefreshStarted] = useState(false);
  const [hasDateRefreshMinimumElapsed, setHasDateRefreshMinimumElapsed] = useState(false);
  const [hasDateRefreshFallbackElapsed, setHasDateRefreshFallbackElapsed] = useState(false);
  const filtersTargetRef = useRef(/** @type {import('react-native').View | null} */ (null));
  const firstCardTargetRef = useRef(/** @type {import('react-native').View | null} */ (null));
  const primaryQuerySignatureRef = useRef('');
  const firstResultsSignatureRef = useRef('');
  const secondaryQuerySignatureRef = useRef('');
  const pendingDateAfterRef = useRef('');
  const dateRefreshTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));
  const dateRefreshFallbackTimerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null));

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
  const defaultFutureCutoffRef = useRef(startOfMinute(new Date()).toISOString());
  const explicitSearchText = useMemo(() => {
    let rawQuery = '';

    if (typeof additionalFilters?.q === 'string') {
      rawQuery = additionalFilters.q;
    } else if (showFilters && typeof eventFilters?.q === 'string') {
      rawQuery = eventFilters.q;
    }

    return typeof rawQuery === 'string' ? rawQuery.trim() : '';
  }, [additionalFilters?.q, eventFilters?.q, showFilters]);

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

  const eventsConfig = useMemo(() => {
    const config = {
      ...(showFilters ? eventFilters : {}),
      ...additionalFilters,
      compact: true,
      pageSize: 15,
      ...(userDocumentId ? { viewerDocumentId: userDocumentId } : {}),
    };

    if (explicitSearchText && !additionalFilters?.startDateAfter) {
      delete config.startDateAfter;
    }

    if (!config.startDateAfter && !config.startDateBefore && !explicitSearchText) {
      config.startDateAfter = defaultFutureCutoffRef.current;
    }

    return config;
  }, [
    showFilters,
    eventFilters,
    additionalFilters,
    explicitSearchText,
    userDocumentId,
  ]);
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
  const activeSearchText = explicitSearchText;
  const isSmartSearchEnabled = !isViewportListMode && activeSearchText.length >= 2;
  const hasExplicitListFilters = useMemo(() => Boolean(
    activeSearchText
    || eventsConfig?.club?.value
    || (typeof eventsConfig?.club === 'string' ? eventsConfig.club : null)
    || eventsConfig?.category
    || eventsConfig?.level
    || eventsConfig?.activity
    || eventsConfig?.type
    || eventsConfig?.excludeType
    || eventsConfig?.facility
    || eventsConfig?.lat
    || eventsConfig?.lon
    || eventsConfig?.radius
    || eventsConfig?.participantId
    || eventsConfig?.sessionStatus
    || eventsConfig?.startDateBefore
    || eventsConfig?.validationMode
    || (Array.isArray(eventsConfig?.teamIds) && eventsConfig.teamIds.length > 0),
  ), [
    activeSearchText,
    eventsConfig?.activity,
    eventsConfig?.category,
    eventsConfig?.club,
    eventsConfig?.excludeType,
    eventsConfig?.facility,
    eventsConfig?.lat,
    eventsConfig?.level,
    eventsConfig?.lon,
    eventsConfig?.participantId,
    eventsConfig?.radius,
    eventsConfig?.sessionStatus,
    eventsConfig?.startDateBefore,
    eventsConfig?.teamIds,
    eventsConfig?.type,
    eventsConfig?.validationMode,
  ]);
  const shouldPrefetchAdjacentDates = screenActive
    && !showFilters
    && !propEvents
    && !isViewportListMode
    && !isSmartSearchEnabled;

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
      compact: true,
      featuredRequestStatus: 'approved',
      isFeatured: true,
      pageSize: 5,
      sessionStatus: 'open',
      ...(userDocumentId ? { viewerDocumentId: userDocumentId } : {}),
    });

    if (!config.startDateAfter && !config.startDateBefore) {
      config.startDateAfter = defaultFutureCutoffRef.current;
    }

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
  }, [showFilters, eventFilters, additionalFilters, isPlanning, userClubId, allCmIds, userDocumentId]);
  const shouldLoadFeaturedEvents = areFeaturedEventsEnabled
    && !showFilters
    && !isPlanning
    && !isViewportListMode
    && !isSmartSearchEnabled
    && !hasExplicitListFilters;

  // Only fetch if no external events are provided
  const {
    data: requestPages,
    error,
    fetchNextPage,
    hasNextPage,
    isFetched: isInternalFetched,
    isFetching: isInternalFetching,
    isFetchingNextPage,
    isLoading: isInternalLoading,
    refetch,
  } = useGetEvents(eventsConfig, {
    enabled: screenActive && !propEvents && !isViewportListMode && !isSmartSearchEnabled,
    placeholderData: keepPreviousPageData,
  });
  const {
    data: searchPages,
    error: searchError,
    fetchNextPage: fetchSearchNextPage,
    hasNextPage: hasSearchNextPage,
    isFetched: isSearchFetched,
    isFetching: isSearchFetching,
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
    placeholderData: keepPreviousPageData,
  });
  const {
    data: viewportPages,
    error: viewportError,
    fetchNextPage: fetchViewportNextPage,
    hasNextPage: hasViewportNextPage,
    isFetched: isViewportFetched,
    isFetching: isViewportFetching,
    isFetchingNextPage: isFetchingViewportNextPage,
    isLoading: isViewportLoading,
    refetch: refetchViewport,
  } = useSearchEventsMap(viewportListParams || {}, {
    enabled: screenActive && !propEvents && isViewportListMode && Boolean(viewportListParams),
    placeholderData: keepPreviousPageData,
  });

  const {
    data: featuredPages,
    refetch: refetchFeatured,
  } = useGetEvents(featuredEventsConfig, {
    enabled: screenActive && !propEvents && shouldLoadFeaturedEvents,
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
  let activeHasFetched = isInternalFetched;
  if (isViewportListMode) {
    activeError = viewportError;
    activeHasFetched = isViewportFetched;
  } else if (isSmartSearchEnabled) {
    activeError = searchError;
    activeHasFetched = isSearchFetched;
  }

  let isLoading = propIsLoading !== undefined ? propIsLoading : isInternalLoading;
  let isFetching = propIsLoading !== undefined ? Boolean(propIsLoading) : isInternalFetching;
  if (propIsLoading === undefined) {
    if (isViewportListMode) {
      isLoading = isViewportLoading;
      isFetching = isViewportFetching;
    } else if (isSmartSearchEnabled) {
      isLoading = isSearchLoading;
      isFetching = isSearchFetching;
    }
  }
  let isListFetchingNext = isFetchingNextPage;
  if (isViewportListMode) {
    isListFetchingNext = isFetchingViewportNextPage;
  } else if (isSmartSearchEnabled) {
    isListFetchingNext = isFetchingSearchNextPage;
  }
  const lastStableDefaultEventsRef = useRef(/** @type {FCEvent[]} */ ([]));
  const canReusePreviousDefaultEvents = !propEvents && !isViewportListMode && !isSmartSearchEnabled;
  const hasResolvedActiveQuery = Boolean(propEvents) || activeHasFetched || Boolean(activeError);
  const isActiveQueryBusy = Boolean(isLoading || isFetching);

  useEffect(() => {
    if (!canReusePreviousDefaultEvents || isActiveQueryBusy || events.length === 0) {
      return;
    }

    lastStableDefaultEventsRef.current = events;
  }, [canReusePreviousDefaultEvents, events, isActiveQueryBusy]);

  const fallbackEvents = canReusePreviousDefaultEvents ? lastStableDefaultEventsRef.current : [];
  const displayEvents = canReusePreviousDefaultEvents
    && isActiveQueryBusy
    && events.length === 0
    && fallbackEvents.length > 0
    ? fallbackEvents
    : events;
  const visibleEvents = useMemo(() => {
    if (
      !canReusePreviousDefaultEvents
      || !isDateRefreshPending
      || displayEvents.length === 0
      || !pendingDateAfterRef.current
    ) {
      return displayEvents;
    }

    const pendingTimestamp = Date.parse(pendingDateAfterRef.current);
    if (Number.isNaN(pendingTimestamp)) {
      return displayEvents;
    }

    const filteredEvents = displayEvents.filter((event) => {
      const rawDate = event?.stageStartDate || event?.date;
      const eventTimestamp = Date.parse(String(rawDate || ''));
      return !Number.isNaN(eventTimestamp) && eventTimestamp >= pendingTimestamp;
    });

    return filteredEvents.length > 0 ? filteredEvents : displayEvents;
  }, [
    canReusePreviousDefaultEvents,
    displayEvents,
    isDateRefreshPending,
  ]);
  const shouldShowMapToggle = enableMapMode && visibleEvents.length > 0;
  const listBottomPadding = sceneBottomInset;
  const showLoadingPlaceholder = !hasResolvedActiveQuery
    || (isActiveQueryBusy && visibleEvents.length === 0);
  const showInlineLoadingHint = hasResolvedActiveQuery
    && (isActiveQueryBusy || isDateRefreshPending)
    && visibleEvents.length > 0
    && !isListFetchingNext;
  const showDateRefreshBanner = isDateRefreshPending;
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
    if (!screenActive || !shouldLoadFeaturedEvents || propEvents) return;

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
  }, [activeMode, featuredEvents.length, propEvents, screenActive, shouldLoadFeaturedEvents]);

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
    eventListLogger.debug('Navigating to event détails', { eventDocumentId: event.documentId });
    navigation.navigate(RouteNames.EventStack, {
      params: { eventId: event.documentId },
      screen: RouteNames.EventDetails,
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
    const normalizedNextQ = typeof q === 'string' ? q.trim() : '';
    const currentNormalizedQ = typeof eventFilters?.q === 'string'
      ? eventFilters.q.trim()
      : '';

    if (normalizedNextQ === currentNormalizedQ) {
      return;
    }

    const nextFilters = {
      ...(eventFilters || {}),
    };

    if (normalizedNextQ) {
      nextFilters.q = normalizedNextQ;
    } else {
      delete nextFilters.q;
    }

    appDispatch({
      payload: nextFilters,
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

  const prefetchDateEvents = useCallback((/** @type {Date} */ date) => {
    if (!shouldPrefetchAdjacentDates) {
      return Promise.resolve();
    }

    const start = startOfDay(date).toISOString();
    const nextParams = {
      ...eventsConfig,
      startDateAfter: start,
    };

    return queryClient.prefetchInfiniteQuery({
      getNextPageParam: (lastPage) => {
        if (!lastPage) return undefined;
        const { meta: { pagination } = {} } = lastPage;
        if (!pagination) return undefined;
        return pagination.page < pagination.pageCount ? pagination.page + 1 : undefined;
      },
      initialPageParam: 1,
      queryFn: ({ pageParam = 1, signal }) => getEvents(
        { ...nextParams, page: pageParam },
        { signal },
      ),
      queryKey: getEventsQueryKey(nextParams),
      staleTime: EVENT_LIST_STALE_MS,
    }).catch(() => {
      // Let the main query own the error UX. Prefetch is best-effort only.
    });
  }, [
    eventsConfig,
    queryClient,
    shouldPrefetchAdjacentDates,
  ]);

  // Date Picker Handlers
  const handleDateSelected = useCallback((/** @type {Date} */ date) => {
    setSelectedDate(date);
    const start = startOfDay(date).toISOString();
    pendingDateAfterRef.current = start;
    setIsDateRefreshPending(true);
    setHasDateRefreshStarted(false);
    setHasDateRefreshMinimumElapsed(false);
    setHasDateRefreshFallbackElapsed(false);

    if (dateRefreshTimerRef.current) {
      clearTimeout(dateRefreshTimerRef.current);
    }
    if (dateRefreshFallbackTimerRef.current) {
      clearTimeout(dateRefreshFallbackTimerRef.current);
    }

    dateRefreshTimerRef.current = setTimeout(() => {
      setHasDateRefreshMinimumElapsed(true);
    }, 900);
    dateRefreshFallbackTimerRef.current = setTimeout(() => {
      setHasDateRefreshFallbackElapsed(true);
    }, 2200);

    queryClient.cancelQueries({ queryKey: ['events'] }).catch(() => {});
    queryClient.cancelQueries({ queryKey: ['search', 'events'] }).catch(() => {});
    prefetchDateEvents(date);

    appDispatch({
      payload: {
        ...(eventFilters || {}),
        startDateAfter: start,
      },
      type: 'SET_EVENT_FILTERS',
    });
  }, [
    appDispatch,
    eventFilters,
    queryClient,
    prefetchDateEvents,
  ]);

  useEffect(() => {
    if (!isDateRefreshPending) {
      return;
    }

    const pendingDateAfter = pendingDateAfterRef.current;
    const activeStartDateAfter = eventFilters?.startDateAfter;
    const hasPendingDateApplied = pendingDateAfter && activeStartDateAfter === pendingDateAfter;

    if (hasPendingDateApplied && isActiveQueryBusy && !hasDateRefreshStarted) {
      setHasDateRefreshStarted(true);
      return;
    }

    if (!hasPendingDateApplied || !hasDateRefreshMinimumElapsed || !hasResolvedActiveQuery) {
      return;
    }

    if (hasDateRefreshStarted && isActiveQueryBusy) {
      return;
    }

    if (!hasDateRefreshStarted && !hasDateRefreshFallbackElapsed) {
      return;
    }

    setIsDateRefreshPending(false);
    setHasDateRefreshStarted(false);
    setHasDateRefreshMinimumElapsed(false);
    setHasDateRefreshFallbackElapsed(false);
    pendingDateAfterRef.current = '';
  }, [
    eventFilters?.startDateAfter,
    hasDateRefreshFallbackElapsed,
    hasDateRefreshMinimumElapsed,
    hasDateRefreshStarted,
    hasResolvedActiveQuery,
    isActiveQueryBusy,
    isDateRefreshPending,
  ]);

  useEffect(() => () => {
    if (dateRefreshTimerRef.current) {
      clearTimeout(dateRefreshTimerRef.current);
    }
    if (dateRefreshFallbackTimerRef.current) {
      clearTimeout(dateRefreshFallbackTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!shouldPrefetchAdjacentDates) {
      return;
    }

    if (isActiveQueryBusy || !hasResolvedActiveQuery) {
      return;
    }

    const selectedDay = startOfDay(selectedDate);
    DATE_PREFETCH_OFFSETS.map((offset) => addDays(selectedDay, offset)).forEach((candidateDate) => {
      prefetchDateEvents(candidateDate);
    });
  }, [
    hasResolvedActiveQuery,
    isActiveQueryBusy,
    prefetchDateEvents,
    selectedDate,
    shouldPrefetchAdjacentDates,
  ]);

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
    if (shouldLoadFeaturedEvents) {
      refetchFeatured();
    }
  }, [
    isSmartSearchEnabled,
    isViewportListMode,
    propEvents,
    refreshSignal,
    refetch,
    refetchFeatured,
    refetchSearch,
    refetchViewport,
    screenActive,
    shouldLoadFeaturedEvents,
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
    const isReservation = normalizeTypeName(item?.type?.name).includes('reservation');
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
    showLoadingPlaceholder ? (
      <SearchResultsLoadingState
        description={t('eventList.loadingDesc', 'Nous chargeons les événements correspondant à ta recherche.')}
        title={t('eventList.loadingTitle', 'Chargement des événements')}
      />
    ) : (
      customEmptyComponent || (
        <EmptyState
          actionLabel={!showFilters ? t('eventList.actions.findEvent') : undefined}
          description={!showFilters ? t('eventList.emptyDesc', 'Essaie de modifier tes filtres ou lance une nouvelle recherche.') : undefined}
          icon={Images.search}
          onAction={!showFilters ? handleFindEvent : undefined}
          title={t('eventList.noData')}
        />
      )
    )
  );
  const renderLoadingHint = (label, fullWidth = false) => (
    <View
      style={[
        Alignments.row,
        Alignments.alignCenter,
        ApplicationStyle.borderRadius1,
        Spaces.gap[8],
        Spaces.paddingHorizontal[12],
        Spaces.paddingVertical[8],
        {
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          backgroundColor: Colors.primary900,
          borderColor: Colors.primary500,
          borderWidth: 1,
        },
      ]}
    >
      <Loader color={Colors.primary500} size="small" />
      <Text style={[Fonts.p4, Fonts.neutral200, fullWidth ? { flex: 1 } : null]}>
        {label}
      </Text>
    </View>
  );
  const listHeader = (
    <View style={[Spaces.gap[16], Spaces.marginBottom[16]]}>
      {!propEvents && !showFilters && featuredEvents.length > 0 ? (
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
            Événements à partir de
          </Text>

          {shouldShowMapToggle ? (
            <TouchableOpacity
              accessibilityHint="Ouvre la vue carte des événements."
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
          isRefreshing={Boolean(isDateRefreshPending || (isFetching && displayEvents.length > 0))}
          onDateSelected={handleDateSelected}
          refreshLabel={t('eventList.loadingUpdating', 'Actualisation des événements...')}
          selectedDate={selectedDate}
        />
        {showDateRefreshBanner ? renderLoadingHint(
          t('eventList.loadingUpdating', 'Actualisation des événements...'),
          true,
        ) : null}
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
              placeholder={t('eventList.searchPlaceholder', 'Rechercher un événement')}
              searchDefaultValue={eventFilters?.q}
            />
          </View>
        </View>
      ) : null}
      {isViewportListMode ? (
        <View style={[Spaces.gap[4]]}>
          <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
            {`${viewportDisplayCount} événement${viewportDisplayCount > 1 ? 's' : ''} dans cette zone`}
          </Text>
          {isViewportTruncated ? (
            <Text style={[Fonts.p4, Fonts.neutral200]}>
              Zoome sur la carte pour afficher tous les événements de cette zone.
            </Text>
          ) : null}
        </View>
      ) : null}
      {isSmartSearchEnabled ? (
        <Text style={[Fonts.p3, Fonts.primary500]}>
          Trie par pertinence
        </Text>
      ) : null}
      {showInlineLoadingHint ? renderLoadingHint(
        t('eventList.loadingUpdating', 'Actualisation des événements...'),
        false,
      ) : null}
    </View>
  );

  return (
    <View style={[Spaces.gap[24], Alignments.fill]}>
      <WithDataWrapper
        error={activeError?.message}
        isLoading={false}
        wrapperStyle={[Alignments.fill]}
      >
        <View style={[Alignments.fill, ApplicationStyle.borderRadius2]}>
          <FlashList
            contentContainerStyle={{ paddingBottom: listBottomPadding }}
            data={/** @type {FCEvent[]} */ (visibleEvents)}
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
            refreshing={isActiveQueryBusy && !isListFetchingNext}
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
