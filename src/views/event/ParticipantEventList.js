import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isAfter, isSameDay } from 'date-fns';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Alert, FlatList, Image, InteractionManager, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import {
  getParticipationErrorMessage,
  resolveParticipationFlow,
} from '@/domains/participation/participationFlow';
import useTheme from '@/theme/themeContext';

import DateSlider from '@/components/molecules/dateSlider/DateSlider';
import EventCardNew from '@/components/molecules/eventCard/EventCardNew';
import LeagueHeaderSwitch from '@/components/molecules/header/LeagueHeaderSwitch';
import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import OnboardingWrapper from '@/components/molecules/onboardingWrapper/OnboardingWrapper';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import FeaturedEvents from '@/components/organisms/featuredEvents/FeaturedEvents';
import JoinEventModal from '@/components/organisms/joinEventModal/JoinEventModal';
import PersonalPlanningContainer from '@/components/organisms/planning/PersonalPlanningContainer';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';
import useBottomDockLayout from '@/navigation/useBottomDockLayout';

import { useGetEvents } from '@/services/event/eventQueries';
import { createEventParticipation } from '@/services/eventParticipation/eventParticipationService';
import { joinReservation } from '@/services/reservation/reservationService';

import { createLogger } from '@/utils/logger/logger';

const participantEventListLogger = createLogger('participant-event-list');
const FEATURED_PLANNING_SCOPES = ['SECTION', 'CM'];

const isApprovedPlanningFeaturedEvent = (event) => (
  Boolean(event?.isFeatured)
  && event?.featuredRequestStatus === 'approved'
  && FEATURED_PLANNING_SCOPES.includes(String(event?.featuredScope || '').toUpperCase())
);

const mergeUniqueEvents = (...collections) => {
  const seen = new Set();

  return collections
    .flat()
    .filter((event) => {
      const eventId = String(event?.documentId || event?.id || '').trim();
      if (!eventId || seen.has(eventId)) return false;
      seen.add(eventId);
      return true;
    });
};

/**
 * Standard event list screen component for participants
 * @param {object} props
 * @param {object} props.navigation - Navigation object
 * @returns {React.ReactElement} ParticipantEventList component
 */
function ParticipantEventList({ navigation }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();
  const { canManageEvents, userData } = useAuth();
  const { floatingActionBottomOffset, sceneBottomInset } = useBottomDockLayout();

  // State
  const [listStartDate, setListStartDate] = useState(new Date());
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [joinModalError, setJoinModalError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(undefined);
  const [shouldLoadEventFeed, setShouldLoadEventFeed] = useState(false);
  const flatListRef = useRef(null);

  // Hooks

  const myEventsQueryConfig = useMemo(() => ({
    compact: true,
    // @ts-ignore
    myTeams: true,
    sort: 'date:asc',
  }), []);

  // @ts-ignore
  const {
    data: eventsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isEventsLoading,
  } = useGetEvents(myEventsQueryConfig, {
    enabled: shouldLoadEventFeed,
  });

  const events = useMemo(() => eventsData?.pages.flatMap((page) => page.data) || [], [eventsData]);

  // Get user's club and CM IDs for featured events membership filtering
  const userClubId = userData?.club?.documentId;
  const userCmId = userData?.club?.parentMultisport?.documentId;

  const trainedSectionIds = userData?.trainedTeams?.map((t) => t.club?.documentId).filter(Boolean) || [];
  const trainedCmIds = userData?.trainedTeams?.map((t) => t.club?.parentMultisport?.documentId).filter(Boolean) || [];

  const playerSectionIds = userData?.myTeams?.map((t) => t.club?.documentId).filter(Boolean) || [];
  const playerCmIds = userData?.myTeams?.map((t) => t.club?.parentMultisport?.documentId).filter(Boolean) || [];

  const allClubIds = [
    userClubId,
    userCmId,
    ...trainedSectionIds,
    ...trainedCmIds,
    ...playerSectionIds,
    ...playerCmIds,
  ].filter((value, index, self) => Boolean(value) && self.indexOf(value) === index);

  // Fetch SECTION/CM featured events for Mon Planning
  const featuredEventsQueryConfig = useMemo(() => ({
    compact: true,
    featuredRequestStatus: 'approved',
    featuredScope: ['SECTION', 'CM'],
    isFeatured: true,
    membershipClubIds: allClubIds.length ? allClubIds : undefined,
    pageSize: 5,
    sessionStatus: 'open',
  }), [allClubIds]);

  const {
    data: featuredData,
    isLoading: isFeaturedLoading,
  } = useGetEvents(featuredEventsQueryConfig, {
    enabled: allClubIds.length > 0 && shouldLoadEventFeed,
  });

  const featuredEvents = useMemo(
    () => (featuredData?.pages?.flatMap((page) => page.data) || []).filter(isApprovedPlanningFeaturedEvent),
    [featuredData],
  );
  const selectedParticipationFlow = useMemo(
    () => resolveParticipationFlow(selectedEvent, { user: userData }),
    [selectedEvent, userData],
  );

  useEffect(() => {
    const interactions = InteractionManager.runAfterInteractions(() => {
      setShouldLoadEventFeed(true);
    });

    return () => {
      interactions.cancel?.();
    };
  }, []);

  // Filter events for the list (starting from listStartDate)
  const listEvents = useMemo(() => (
    mergeUniqueEvents(featuredEvents, events)
      .filter((event) => {
        if (!event || !event.date) return false;
        const eventDate = new Date(event.date);

        // Date Filter
        const isDateValid = isSameDay(eventDate, listStartDate) || isAfter(eventDate, listStartDate);
        if (!isDateValid) return false;

        return true;
      })
      .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
  ), [events, featuredEvents, listStartDate]);

  const queryClient = useQueryClient();

  /**
   * Mutation to create an event participation
   */
  const createEventParticipationMutation = useMutation({
    mutationFn: createEventParticipation,
    onError: (error) => {
      const message = getParticipationErrorMessage(error, 'Une erreur est survenue.');
      Alert.alert('Erreur', message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['planning', 'personal'] });
      setIsJoinModalVisible(false);
      setJoinModalError('');
    },
  });
  const joinReservationMutation = useMutation({
    mutationFn: (reservationId) => joinReservation(reservationId),
    onError: (error) => {
      const message = getParticipationErrorMessage(error, 'Une erreur est survenue.');
      Alert.alert('Erreur', message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['planning', 'personal'] });
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['featured-reservations'] });
      setIsJoinModalVisible(false);
      setJoinModalError('');
    },
  });

  const handleParticipateToEvent = useCallback(async (event) => {
    const participationFlow = resolveParticipationFlow(event, { user: userData });

    if (!participationFlow?.canAct) {
      Alert.alert('Erreur', participationFlow?.blockedReason || 'Cette action est indisponible.');
      return;
    }

    if (participationFlow?.kind === 'reservation-recruiting') {
      setJoinModalError('');
      setSelectedEvent(event);
      setIsJoinModalVisible(true);
      return;
    }

    if (participationFlow?.submitMode === 'redirect-parent' && event?.parentEvent?.documentId) {
      navigation.navigate(RouteNames.EventStack, {
        params: { eventId: event.parentEvent.documentId },
        screen: RouteNames.EventDetails,
      });
      return;
    }

    if (event?.documentId && userData?.documentId) {
      try {
        await createEventParticipationMutation.mutateAsync({
          event: event.documentId,
          user: userData.documentId,
        });
      } catch (error) {
        Alert.alert('Erreur', getParticipationErrorMessage(error, 'Une erreur est survenue.'));
      }
    }
  }, [createEventParticipationMutation, navigation, userData]);

  const handleJoinEvent = useCallback((event) => {
    const participationFlow = resolveParticipationFlow(event, { user: userData });
    if (!participationFlow?.canAct) {
      Alert.alert('Erreur', participationFlow?.blockedReason || 'Cette action est indisponible.');
      return;
    }

    if (participationFlow?.submitMode === 'redirect-parent' && event?.parentEvent?.documentId) {
      navigation.navigate(RouteNames.EventStack, {
        params: { eventId: event.parentEvent.documentId },
        screen: RouteNames.EventDetails,
      });
      return;
    }

    if (participationFlow?.submitMode === 'detection-slot-picker') {
      if (event?.documentId) {
        navigation.navigate(RouteNames.EventStack, {
          params: { eventId: event.documentId },
          screen: RouteNames.EventDetails,
        });
      }
      return;
    }

    setJoinModalError('');
    setSelectedEvent(event);
    setIsJoinModalVisible(true);
  }, [navigation, userData]);

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

      if (!userData?.documentId) {
        return;
      }

      await createEventParticipationMutation.mutateAsync({
        event: selectedEvent.documentId,
        user: userData.documentId,
      });
    } catch (error) {
      setJoinModalError(getParticipationErrorMessage(error, 'Une erreur est survenue.'));
    }
  }, [
    createEventParticipationMutation,
    joinReservationMutation,
    selectedEvent,
    userData,
  ]);

  /**
   * Handle event press
   * @param {import('@/domains/event/types').FCEvent} event
   */
  const handleEventPress = (event) => {
    if (!event?.documentId) {
      participantEventListLogger.warn('Navigation blocked: missing event documentId');
      return;
    }
    participantEventListLogger.debug('Navigating to event détails', { eventDocumentId: event.documentId });
    // @ts-ignore
    navigation.navigate(RouteNames.EventStack, {
      params: { eventId: event.documentId },
      screen: RouteNames.EventDetails,
    });
  };

  /**
   * @param {{ item: import('@/domains/event/types').FCEvent }} props
   */
  const renderItem = ({ item }) => {
    if (item.reservation) {
      return (
        <View style={[Spaces.marginBottom[16]]}>
          <EventCardNew
            item={item.reservation}
            // @ts-ignore
            onDecline={() => {}}
            onJoin={() => handleJoinEvent(item.reservation)}
            onLogin={() => {}}
            onParticipate={() => handleParticipateToEvent(item.reservation)}
            onPress={() => navigation.navigate(RouteNames.ReservationDetails, { reservationId: item.reservation.documentId })}
            useFacilityAccentColor
          />
        </View>
      );
    }
    return (
      <View style={[Spaces.marginBottom[16]]}>
        <EventCardNew
          displayProfile="teamFocused"
          item={item}
          onDecline={() => {}}
          onJoin={() => handleJoinEvent(item)}
          onLogin={() => {}}
          onParticipate={() => handleParticipateToEvent(item)}
          onPress={() => handleEventPress(item)}
          useFacilityAccentColor
        />
      </View>
    );
  };

  /**
   * @param {Date} date
   */
  const handleDateConfirm = (date) => {
    setListStartDate(date);
  };

  const handleSummaryPress = () => {
    // @ts-ignore
    flatListRef.current?.scrollToOffset({ animated: true, offset: 500 });
  };

  const handleCreateEventPress = useCallback(() => {
    // @ts-ignore
    navigation.navigate(RouteNames.EventStack, { screen: RouteNames.EventWizardType });
  }, [navigation]);

  const handleListEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);
  const keyExtractor = useCallback(
    (item, index) => item.documentId
      || item.id
      || `${item?.date || 'event'}-${item?.name || item?.title || index}`,
    [],
  );

  const floatingCtaBottom = floatingActionBottomOffset;
  const listBottomPadding = canManageEvents
    ? Math.max(sceneBottomInset, floatingCtaBottom + 84)
    : sceneBottomInset;

  /**
   *
   */
  // eslint-disable-next-line react/no-unstable-nested-components
  function ListHeader() {
    return (
      <View style={[Spaces.gap[24], Spaces.marginBottom[16]]}>
        {/* Top Header */}
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
          <LeagueHeaderSwitch />
          <View style={{ alignItems: 'center', flexDirection: 'row' }}>
            <NotificationBadge />
            <ProfileButton />
          </View>
        </View>

        {/* Calendar Section */}
        <View>
          <OnboardingWrapper
            description="Retrouvez vos événements, votre calendrier et les actions de planning."
            id="planning-main-content"
            order={1}
            spotlight={{
              borderRadius: 16,
              overlayOpacity: 0.4,
              paddingX: 2,
              paddingY: 2,
            }}
            title="Mon planning"
          >
            <PersonalPlanningContainer onSummaryPress={handleSummaryPress} />
          </OnboardingWrapper>
        </View>

        {/* Featured Events Carousel */}
        {featuredEvents.length > 0 && (
          <View style={[Spaces.marginTop[16]]}>
            <Text style={[Fonts.h3, Fonts.neutral00, Spaces.marginBottom[8]]}>
              ⭐ À la une dans mon club
            </Text>
            <FeaturedEvents events={featuredEvents} useFacilityAccentColorForPublic />
          </View>
        )}

        {/* List Header Section */}
        <View style={[Spaces.marginTop[16]]}>
          <Text style={[Fonts.h3, Fonts.neutral00, Spaces.marginBottom[8]]}>
            Évènements à partir de
          </Text>
          <DateSlider
            onDateSelected={handleDateConfirm}
            selectedDate={listStartDate}
          />
          {(!shouldLoadEventFeed || isEventsLoading || isFeaturedLoading) && (
            <Text style={[Fonts.body4, Fonts.neutral300, Spaces.marginTop[8]]}>
              Mise a jour des evenements...
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <ScreenContainer bgImage="bg2">
      <FlatList
        data={listEvents}
        ref={flatListRef}
        renderItem={renderItem}
        // @ts-ignore
        contentContainerStyle={{ paddingBottom: listBottomPadding }}
        extraData={userData}
        initialNumToRender={6}
        keyExtractor={keyExtractor}
        ListHeaderComponent={<ListHeader />}
        maxToRenderPerBatch={8}
        onEndReached={handleListEndReached}
        onEndReachedThreshold={0.5}
        showsVerticalScrollIndicator={false}
        updateCellsBatchingPeriod={50}
        windowSize={7}
      />
      {canManageEvents && (
        <View style={{
          bottom: floatingCtaBottom,
          position: 'absolute',
          right: 20,
        }}
        >
          <TouchableOpacity
            accessibilityLabel="Ajouter un evenement"
            activeOpacity={0.85}
            onPress={handleCreateEventPress}
            style={[
              ApplicationStyle.shadow200,
              {
                alignItems: 'center',
                backgroundColor: Colors.primary500,
                borderColor: 'rgba(255,255,255,0.18)',
                borderRadius: 32,
                borderWidth: 1,
                elevation: 8,
                height: 64,
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOffset: {
                  height: 6,
                  width: 0,
                },
                shadowOpacity: 0.32,
                shadowRadius: 12,
                width: 64,
              },
            ]}
          >
            <Image
              resizeMode="contain"
              source={Images.calendar}
              style={{
                height: 24,
                tintColor: Colors.neutral00,
                width: 24,
              }}
            />
            <View
              style={{
                alignItems: 'center',
                backgroundColor: Colors.primary200,
                borderColor: 'rgba(255,255,255,0.36)',
                borderRadius: 999,
                borderWidth: 1,
                height: 20,
                justifyContent: 'center',
                position: 'absolute',
                right: 8,
                top: 8,
                width: 20,
              }}
            >
              <Image
                resizeMode="contain"
                source={Images.plus}
                style={{
                  height: 10,
                  tintColor: Colors.primary900,
                  width: 10,
                }}
              />
            </View>
          </TouchableOpacity>
        </View>
      )}
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
    </ScreenContainer>
  );
}

export default ParticipantEventList;
