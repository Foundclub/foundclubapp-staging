import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isBefore, startOfDay } from 'date-fns';
import {
  useCallback, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { USER_ROLES } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import EmptyState from '@/components/atoms/emptyState/EmptyState';
import SearchMapFab from '@/components/atoms/searchMapFab/SearchMapFab';
import DateSlider from '@/components/molecules/dateSlider/DateSlider';
import EventCardNew from '@/components/molecules/eventCard/EventCardNew';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import FeaturedEvents from '@/components/organisms/featuredEvents/FeaturedEvents';
import SearchComponent from '@/components/organisms/searchComponent/searchComponent';

import { openPublicAuthFlow } from '@/navigation/public/publicAuthNavigation';
import { RouteNames } from '@/navigation/routeNames';
import useBottomDockLayout from '@/navigation/useBottomDockLayout';

import { useGetEvents } from '@/services/event/eventQueries';
import { missingEvent } from '@/services/event/eventService';
import { createEventParticipation } from '@/services/eventParticipation/eventParticipationService';
import { useSearchEvents, useSearchEventsMap } from '@/services/search/searchQueries';
import { getMatchReasonLabel, mapSearchPayload } from '@/services/search/searchService';

import { createLogger } from '@/utils/logger/logger';

import JoinEventModal from '../joinEventModal/JoinEventModal';

const eventListLogger = createLogger('event-list');

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
  showFilters = false,
}) {
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(/** @type {FCEvent | undefined} */(undefined));
  const filtersTargetRef = useRef(/** @type {import('react-native').View | null} */ (null));
  const firstCardTargetRef = useRef(/** @type {import('react-native').View | null} */ (null));

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
  const { floatingActionBottomOffset, sceneBottomInset } = useBottomDockLayout();

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
  } = useGetEvents(eventsConfig, { enabled: !propEvents && !isViewportListMode && !isSmartSearchEnabled });
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
    enabled: !propEvents && !isViewportListMode && isSmartSearchEnabled,
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
    enabled: !propEvents && isViewportListMode && Boolean(viewportListParams),
  });

  const {
    data: featuredPages,
    refetch: refetchFeatured,
  } = useGetEvents(featuredEventsConfig, { enabled: !propEvents });

  const queryClient = useQueryClient();
  /**
   * Mutation to create an event participation
   * @type {import('@tanstack/react-query').UseMutationResult<EventParticipation,
   * Error, {user: string, event: string, reason?: string}, unknown>}
   */
  const createEventParticipationMutation = useMutation({
    mutationFn: createEventParticipation,
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
      return !isBefore(new Date(event.date), startOfDay(new Date()));
    })
    || [], [featuredPages]);

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
  const listBottomPadding = shouldShowMapToggle
    ? Math.max(sceneBottomInset, floatingActionBottomOffset + 84)
    : sceneBottomInset;
  let isListFetchingNext = isFetchingNextPage;
  if (isViewportListMode) {
    isListFetchingNext = isFetchingViewportNextPage;
  } else if (isSmartSearchEnabled) {
    isListFetchingNext = isFetchingSearchNextPage;
  }

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

  const handleEventSelect = useCallback((/** @type {FCEvent} */ event) => {
    if (!event?.documentId) {
      eventListLogger.warn('Navigation blocked: missing event documentId');
      return;
    }
    eventListLogger.debug('Navigating to event détails', { eventDocumentId: event.documentId });
    /** @type {any} */ (navigation).navigate(RouteNames.EventStack, {
      params: { eventId: event.documentId },
      screen: RouteNames.EventDetails,
    });
  }, [navigation]);

  const handleOpenFilters = useCallback(() => {
    // @ts-expect-error because of react navigation type definitions
    navigation.navigate(RouteNames.EventStack, { screen: RouteNames.EventFilters });
  }, [navigation]);

  const handleFindEvent = () => {
    // @ts-expect-error because of react navigation type definitions
    navigation.navigate(RouteNames.SearchEvents);
  };

  const handleSearchField = useCallback((/** @type {string} */ q) => {
    appDispatch({
      payload: Object.assign(eventFilters || {}, { q }),
      type: 'SET_EVENT_FILTERS',
    });
  }, [appDispatch, eventFilters]);

  const handleJoinEvent = useCallback((/** @type {FCEvent} */ event) => {
    setSelectedEvent(event);
    setIsJoinModalVisible(true);
  }, []);

  const handleParticipateToEvent = useCallback((/** @type {FCEvent} */ event) => {
    if (event?.documentId && userDocumentId) {
      createEventParticipationMutation.mutate({
        event: event.documentId,
        user: userDocumentId,
      });
    }
  }, [createEventParticipationMutation, userDocumentId]);

  const handleDeclineEvent = useCallback((/** @type {FCEvent} */ event) => {
    if (!event?.documentId) return;
    missingEventMutation.mutate(event.documentId);
  }, [missingEventMutation]);

  const handleGoLogin = () => {
    openPublicAuthFlow(navigation, {
      origin: RouteNames.EventDetails,
      source: 'event-list-login',
    });
  };

  const handleCloseJoinModal = useCallback(() => {
    setIsJoinModalVisible(false);
    setSelectedEvent(undefined);
  }, []);

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

  useFocusEffect(
    useCallback(() => {
      if (!propEvents) {
        if (isViewportListMode) {
          refetchViewport();
        } else if (isSmartSearchEnabled) {
          refetchSearch();
        } else {
          refetch();
        }
        refetchFeatured();
      }
    }, [isSmartSearchEnabled, isViewportListMode, propEvents, refetch, refetchFeatured, refetchSearch, refetchViewport]),
  );

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
        onLogin={() => {}}
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

      <View>
        <Text style={[Fonts.p1, { color: Colors.neutral00, marginBottom: 8 }]}>
          Événements à partir de
        </Text>
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
              refetchFeatured();
            }}
            refreshing={isLoading && !isListFetchingNext}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </WithDataWrapper>
      <JoinEventModal
        clubName={selectedEvent?.team?.club?.name || ''}
        createEventParticipationMutation={createEventParticipationMutation}
        eventId={selectedEvent?.documentId || ''}
        isVisible={isJoinModalVisible}
        onClose={handleCloseJoinModal}
      />
      {shouldShowMapToggle ? (
        <SearchMapFab
          mode="list"
          onPress={() => navigation.navigate(RouteNames.SearchMapScreen, { scope: 'events' })}
          scope="events"
        />
      ) : null}
    </View>
  );
}

export default EventListContent;
