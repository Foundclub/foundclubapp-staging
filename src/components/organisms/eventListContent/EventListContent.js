import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useMutation } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  useCallback, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image, Text, TouchableOpacity, View,
} from 'react-native';

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

import JoinEventModal from '../joinEventModal/JoinEventModal';

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
 * @returns {import('react').ReactElement} Event list content component
 */
function EventListContent({ additionalFilters, showFilters = false }) {
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(/** @type {FCEvent | undefined} */(undefined));

  // hooks
  const {
    Alignments,
    ApplicationStyle,
    Fonts,
    Images,
    Spaces,
  } = useTheme();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const [{ eventFilters }, appDispatch] = useAppContext();
  const { getClubInitials } = useClub();
  const { userData: { documentId: userDocumentId } = {} } = useAuth();

  const eventsConfig = useMemo(() => ({
    ...(showFilters ? eventFilters : {}),
    ...additionalFilters,
    pageSize: 7,
  }), [showFilters, eventFilters, additionalFilters]);

  const {
    data: requestPages,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useGetEvents(eventsConfig);

  /**
   * Mutation to create an event participation
   * @type {import('@tanstack/react-query').UseMutationResult<EventParticipation,
   * Error, {user: string, event: string, reason?: string}, unknown>}
   */
  const createEventParticipationMutation = useMutation({
    mutationFn: createEventParticipation,
    onSuccess: () => {
      refetch();
      setIsJoinModalVisible(false);
    },
  });

  // variables
  const events = useMemo(() => requestPages?.pages
    ?.reduce((/** @type {FCEvent[]} */ acc, page) => {
      const items = page?.data || [];
      return acc.concat(items);
    }, [])
    || [], [requestPages]);

  const filterCount = useMemo(() => {
    if (!eventFilters) return 0;

    return Object.entries(eventFilters).reduce((/** @type {number} */ acc, [key, value]) => {
      // Skip date range filters completely
      if (key === 'startDateBefore' || key === 'startDateAfter') {
        return acc;
      }

      // Skip if the value is falsy or an array
      if (!value || Array.isArray(value)) {
        return acc;
      }

      return acc + 1;
    }, 0);
  }, [eventFilters]);

  // handlers
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  /**
   * Mutation for marking an event as missing
   * @type {import('@tanstack/react-query').UseMutationResult<any, Error, string, unknown>}
   */
  const missingEventMutation = useMutation({
    mutationFn: missingEvent,
    onSuccess: () => {
      refetch();
    },
  });

  const handleEventSelect = useCallback((/** @type {FCEvent} */ event) => {
    // @ts-expect-error because of react navigation type definitions
    navigation.navigate(RouteNames.EventDetails, { eventId: event.documentId });
  }, [navigation]);

  const handleOpenFilters = useCallback(() => {
    // @ts-expect-error because of react navigation type definitions
    navigation.navigate(RouteNames.EventFilters);
  }, [navigation]);

  const handleFindEvent = () => {
    // @ts-expect-error because of react navigation type definitions
    navigation.navigate(RouteNames.Search);
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

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  // renderers
  /**
   * Renders an individual event item
   * @param {object} param - The item to render
   * @param {FCEvent} param.item
   * @returns {import('react').ReactElement} The rendered event item
   */
  const renderItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => handleEventSelect(item)}
      style={[
        Alignments.alignStart,
        Alignments.justifySpaceBetween,
        Spaces.padding[24],
        Spaces.marginVertical[12],
        Spaces.gap[24],
        ApplicationStyle.backgroundColor.primary700,
        ApplicationStyle.borderRadius24,
      ]}
    >
      <View style={[Alignments.fullWidth]}>
        <View style={[Alignments.fullWidth, Alignments.alignEnd]}>
          {item?.type ? (
            <Tag
              text={item?.type?.name || ''}
            />
          ) : null}
        </View>
        <View style={[
          Alignments.row,
          Alignments.fullWidth,
          Alignments.alignCenter,
          Spaces.gap[8]]}
        >
          <TeamShield
            initials={item?.team?.club?.name ? getClubInitials(item?.team?.club?.name) : ''}
            isSmall
          />
          <View style={[Spaces.gap[4], { maxWidth: '80%' }]}>
            <Text
              ellipsizeMode="tail"
              numberOfLines={2}
              style={[Fonts.p1Bold, Fonts.neutral00]}
            >
              {item?.team?.club?.name || ''}
            </Text>
          </View>

        </View>
      </View>
      <View style={[
        Alignments.alignCenter,
        Spaces.gap[8],
        Alignments.row,
        Alignments.wrap]}
      >
        {item?.team?.activities?.length ? (
          <View style={[Alignments.row, Spaces.gap[4], Spaces.marginRight[16]]}>
            <Image
              source={Images.running}
              style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.neutral00]}
            />
            <Text style={[Fonts.p2, Fonts.primary100]}>
              {item?.team?.activities?.map(({ name }) => name)?.join(', ') || ''}
            </Text>
          </View>
        ) : null}
        {item?.locationDetails ? (
          <View style={[Alignments.row, Spaces.gap[4], Spaces.marginRight[16]]}>
            <Image
              source={Images.pin}
              style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.neutral00]}
            />
            <Text style={[Fonts.p2, Fonts.primary100]}>
              {JSON.parse(item?.locationDetails)?.address || ''}
            </Text>
          </View>
        ) : null}
        {item?.date ? (
          <View style={[
            Alignments.row, Spaces.gap[4], Spaces.marginRight[16]]}
          >
            <Image
              source={Images.calendar}
              style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.neutral00]}
            />
            <Text
              numberOfLines={1}
              style={[Fonts.p2, Fonts.primary100]}
            >
              {format(item?.date, 'dd MMM yyyy')}
            </Text>
          </View>
        ) : null}
        {item?.date ? (
          <View style={[
            Alignments.row, Spaces.gap[4], Spaces.marginRight[16]]}
          >
            <Image
              source={Images.clock}
              style={[ApplicationStyle.icon20, ApplicationStyle.tintColor.neutral00]}
            />
            <Text
              numberOfLines={1}
              style={[Fonts.p2, Fonts.primary100]}
            >
              {format(item?.date, 'HH:mm')}
            </Text>
          </View>
        ) : null}
      </View>
      <EventAnswerButtons
        event={item}
        onAbout={() => handleEventSelect(item)}
        onDecline={() => handleDeclineEvent(item)}
        onJoin={() => handleJoinEvent(item)}
        onLogin={handleGoLogin}
        onParticipate={() => handleParticipateToEvent(item)}
      />
    </TouchableOpacity>
  );

  const renderEmptyList = () => (
    <View style={[
      ApplicationStyle.backgroundColor.primary900,
      ApplicationStyle.borderRadius16,
      Alignments.alignCenter,
      Spaces.gap[32],
      Spaces.padding[24],
      Spaces.marginVertical[24]]}
    >
      <Text style={[Fonts.p1Bold, Fonts.neutral00, Fonts.textCenter]}>
        {t('eventList.noData')}
      </Text>
      {
        !showFilters ? (
          <Button
            isOption
            onPress={handleFindEvent}
            title={t('eventList.actions.findEvent')}
            variant="SecondaryLight"
          />
        ) : null
      }
    </View>
  );

  return (
    <View style={[Spaces.gap[40], Alignments.fill]}>
      {showFilters ? (
        <SearchComponent
          filterNumber={filterCount}
          handleSearchField={handleSearchField}
          openFilters={handleOpenFilters}
          searchDefaultValue={eventFilters?.q}
        />
      ) : null}
      <WithDataWrapper
        error={error?.message}
        isLoading={isLoading && !isFetchingNextPage}
        wrapperStyle={[Alignments.fill]}
      >
        <View style={[
          Alignments.fill,
          ApplicationStyle.borderRadius2,
          { minHeight: 500 }]}
        >
          <FlashList
            contentContainerStyle={Spaces.paddingBottom[64]}
            data={events}
            estimatedItemSize={120}
            keyExtractor={(item) => item?.documentId || 'unknown'}
            ListEmptyComponent={renderEmptyList}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            onRefresh={refetch}
            refreshing={isLoading && !isFetchingNextPage}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </WithDataWrapper>
      <JoinEventModal
        createEventParticipationMutation={createEventParticipationMutation}
        eventId={selectedEvent?.documentId || ''}
        isVisible={isJoinModalVisible}
        onClose={handleCloseJoinModal}
      />
    </View>
  );
}

export default EventListContent;
