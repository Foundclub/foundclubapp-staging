import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  startOfDay,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import DateSlider from '@/components/molecules/dateSlider/DateSlider';

import { USER_ROLES } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useClub from '@/domains/club/useClub';
import { useAppContext } from '@/store/appContext';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Tag from '@/components/atoms/tag/Tag';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import EventAnswerButtons from '@/components/molecules/eventAnswerButtons/EventAnswerButtons';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import SearchComponent from '@/components/organisms/searchComponent/searchComponent';

import { RouteNames } from '@/navigation/routeNames';

import { useGetEvents } from '@/services/event/eventQueries';
import { missingEvent } from '@/services/event/eventService';
import { createEventParticipation } from '@/services/eventParticipation/eventParticipationService';
import Input from '@/components/molecules/input/Input';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';

import JoinEventModal from '../joinEventModal/JoinEventModal';
import EventCardNew from '@/components/molecules/eventCard/EventCardNew';
import FeaturedEvents from '@/components/organisms/featuredEvents/FeaturedEvents';
import SearchMap from '@/components/organisms/searchMap/SearchMap';
import EmptyState from '@/components/atoms/emptyState/EmptyState';
import MapFloatButton from '@/components/atoms/mapFloatButton/MapFloatButton';

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
 * @returns {import('react').ReactElement} Event list content component
 */
function EventListContent({
  additionalFilters,
  showFilters = false,
  isPlanning = false,
  events: propEvents,
  onLoadMore,
  isLoading: propIsLoading,
}) {
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(/** @type {FCEvent | undefined} */(undefined));
  const [isMapView, setIsMapView] = useState(false);

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
  const [{ eventFilters }, appDispatch] = useAppContext();
  const { getClubInitials } = useClub();
  const { userData } = useAuth();
  const userDocumentId = userData?.documentId;

  const eventsConfig = useMemo(() => ({
    ...(showFilters ? eventFilters : {}),
    ...additionalFilters,
    pageSize: 15,
  }), [showFilters, eventFilters, additionalFilters]);

  const featuredEventsConfig = useMemo(() => ({
    ...(showFilters ? eventFilters : {}),
    ...additionalFilters,
    isFeatured: true,
    sessionStatus: 'open',
    pageSize: 5,
  }), [showFilters, eventFilters, additionalFilters]);

  // Only fetch if no external events are provided
  const {
    data: requestPages,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isInternalLoading,
    refetch,
  } = useGetEvents(eventsConfig, { enabled: !propEvents });

  const {
    data: featuredPages,
    isLoading: isFeaturedLoading,
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
      if (!propEvents) refetch(); // Keep local refetch for Safety
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

  const featuredEvents = useMemo(() => featuredPages?.pages
    ?.reduce((/** @type {FCEvent[]} */ acc, page) => {
      const items = page?.data || [];
      return acc.concat(items);
    }, [])
    || [], [featuredPages]);

  const events = propEvents || internalEvents;
  const isLoading = propIsLoading !== undefined ? propIsLoading : isInternalLoading;

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
    } else if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, onLoadMore]);

  /**
   * Mutation for marking an event as missing
   * @type {import('@tanstack/react-query').UseMutationResult<any, Error, string, unknown>}
   */
  const missingEventMutation = useMutation({
    mutationFn: missingEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      if (!propEvents) refetch();
    },
  });

  const handleEventSelect = useCallback((/** @type {FCEvent} */ event) => {
    // @ts-expect-error because of react navigation type definitions
    if (!event?.documentId) {
      console.warn('Navigation blocked: missing event documentId', event);
      return;
    }
    console.log('Navigating to event:', event.documentId);
    navigation.navigate('EventStack', { screen: 'EventDetails', params: { eventId: event.documentId } });
  }, [navigation]);

  const handleOpenFilters = useCallback(() => {
    // @ts-expect-error because of react navigation type definitions
    navigation.navigate(RouteNames.EventStack, { screen: RouteNames.EventFilters });
  }, [navigation]);

  const handleFindEvent = () => {
    // @ts-expect-error because of react navigation type definitions
    navigation.navigate(RouteNames.HomeTab, { screen: RouteNames.Search });
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
    // @ts-expect-error because of react navigation type definitions
    navigation.navigate(RouteNames.HomeTab, { screen: RouteNames.AuthStackAccount });
  };

  const handleCloseJoinModal = useCallback(() => {
    setIsJoinModalVisible(false);
    setSelectedEvent(undefined);
  }, []);

  // Date Picker Handlers
  const handleDateSelected = useCallback((date) => {
    setSelectedDate(date);
    const start = startOfDay(date).toISOString();

    appDispatch({
      payload: Object.assign(eventFilters || {}, {
        startDateAfter: start,
      }),
      type: 'SET_EVENT_FILTERS',
    });
  }, [appDispatch, eventFilters]);

  useFocusEffect(
    useCallback(() => {
      if (!propEvents) {
        refetch();
        refetchFeatured();
      }
    }, [refetch, refetchFeatured, propEvents]),
  );

  // renderers
  /**
   * Renders an individual event item
   * @param {object} param - The item to render
   * @param {FCEvent} param.item
   * @returns {import('react').ReactElement} The rendered event item
   */
  const renderItem = ({ item }) => {
    const isReservation = item?.type?.name === 'Réservation';
    const isManager = userData?.role?.name === USER_ROLES.coach || userData?.role?.name === USER_ROLES.president;
    const showAbout = isPlanning || isManager;

    if (isReservation) {
      return (
        <EventCardNew
          actionLabel={showAbout ? t('eventList.actions.about') : undefined}
          item={item}
          onParticipate={() => (showAbout ? handleEventSelect(item) : handleParticipateToEvent(item))}
          onPress={() => handleEventSelect(item)}
        />
      );
    }

    return (
      <EventCardNew
        item={item}
        onDecline={() => handleDeclineEvent(item)}
        onJoin={() => handleJoinEvent(item)}
        onLogin={handleGoLogin}
        onParticipate={() => handleParticipateToEvent(item)}
        onPress={() => handleEventSelect(item)}
      />
    );
  };

  const renderEmptyList = () => (
    <EmptyState
      title={t('eventList.noData')}
      description={!showFilters ? t('eventList.emptyDesc', 'Essayez de modifier vos filtres ou lancez une nouvelle recherche.') : undefined}
      actionLabel={!showFilters ? t('eventList.actions.findEvent') : undefined}
      onAction={!showFilters ? handleFindEvent : undefined}
    />
  );

  // useEffect to log the filters select and use in the request
  useEffect(() => {
    console.log('Event filters updated:', eventFilters);
  }, [eventFilters, refetch, showFilters]);

  return (
    <View style={[Spaces.gap[40], Alignments.fill]}>


      {isMapView ? (
        <SearchMap
          items={events}
          onMarkerPress={handleEventSelect}
          type="event"
        />
      ) : (
        <WithDataWrapper
          error={error?.message}
          isLoading={isLoading && !isFetchingNextPage}
          wrapperStyle={[Alignments.fill]}
        >
          <View style={[
            Alignments.fill,
            ApplicationStyle.borderRadius2]}
          >
            <FlashList
              data={events}
              estimatedItemSize={200}
              keyExtractor={(item) => item?.documentId || 'unknown'}
              ListEmptyComponent={renderEmptyList}
              onEndReached={handleEndReached}
              onEndReachedThreshold={0.5}
              onRefresh={() => {
                refetch();
                refetchFeatured();
              }}
              refreshing={isLoading && !isFetchingNextPage}
              renderItem={renderItem}
              ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
              ListHeaderComponent={
                <View style={[Spaces.gap[24], Spaces.marginBottom[24]]}>
                  {!propEvents && featuredEvents.length > 0 ? (
                    <FeaturedEvents events={featuredEvents} />
                  ) : null}

                  {/* Date Header */}
                  <View>
                    <Text style={[Fonts.p1, { color: Colors.neutral00, marginBottom: 8 }]}>
                      Événements à partir de
                    </Text>
                    <DateSlider
                      selectedDate={selectedDate}
                      onDateSelected={handleDateSelected}
                    />
                  </View>

                  {showFilters ? (
                    <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[16]]}>
                      <View style={{ flex: 1 }}>
                        <OnboardingWrapper
                          description="Recherchez par mot-clé ou utilisez les filtres avancés."
                          id="search-filters"
                          order={2}
                          title="Filtres"
                        >
                          <SearchComponent
                            filterNumber={filterCount}
                            handleSearchField={handleSearchField}
                            openFilters={handleOpenFilters}
                            searchDefaultValue={eventFilters?.q}
                          />
                        </OnboardingWrapper>
                      </View>
                    </View>
                  ) : null}
                </View>
              }
              showsVerticalScrollIndicator={false}
            />
          </View>
        </WithDataWrapper>
      )}
      <JoinEventModal
        clubName={selectedEvent?.team?.club?.name || ''}
        createEventParticipationMutation={createEventParticipationMutation}
        eventId={selectedEvent?.documentId || ''}
        isVisible={isJoinModalVisible}
        onClose={handleCloseJoinModal}
      />

      {/* Floating Map Button */}
      {showFilters && (
        <OnboardingWrapper
          description="Basculez entre la vue liste et la carte interactive."
          id="map-toggle"
          order={4}
          style={{ position: 'absolute', bottom: 20, right: 20 }} // Ensure wrapper has position
          title="Carte"
        >
          <MapFloatButton
            isMapView={isMapView}
            onPress={() => setIsMapView(!isMapView)}
            type="event"
          />
        </OnboardingWrapper>
      )}
    </View>
  );
}

export default EventListContent;
