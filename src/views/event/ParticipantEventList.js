import { useFocusEffect } from '@react-navigation/native';
import { format, isAfter, isSameDay, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import React, { useCallback, useMemo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createEventParticipation } from '@/services/eventParticipation/eventParticipationService';
import {
  FlatList, Image, Modal, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import DateSlider from '@/components/molecules/dateSlider/DateSlider';

import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import EventCardNew from '@/components/molecules/eventCard/EventCardNew';
import JoinEventModal from '@/components/organisms/joinEventModal/JoinEventModal';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import ScreenContainer from '@/components/templates/ScreenContainer';
import EventListContent from '@/components/organisms/eventListContent/EventListContent';
import FeaturedEvents from '@/components/organisms/featuredEvents/FeaturedEvents';
import PersonalPlanningContainer from '@/components/organisms/planning/PersonalPlanningContainer';
import { useGetEvents } from '@/services/event/eventQueries';
import useTheme from '@/theme/themeContext';
import { images as Images } from '@/theme/images';
import { RouteNames } from '@/navigation/routeNames';
import useAuth from '@/domains/auth/useAuth';

/**
 * Standard event list screen component for participants
 * @param {object} props
 * @param {object} props.navigation - Navigation object
 * @returns {React.ReactElement} ParticipantEventList component
 */
function ParticipantEventList({ navigation }) {
  const { t } = useTranslation();
  const {
    Alignments,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { userData, canManageEvents } = useAuth();
  
  // State
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);
  const [calendarViewMode, setCalendarViewMode] = useState('3days'); // '3days' | 'week' | 'month'
  const [isViewModalVisible, setIsViewModalVisible] = useState(false);
  const [listStartDate, setListStartDate] = useState(new Date());
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(undefined);
  const flatListRef = useRef(null);

  // Hooks

  // @ts-ignore
  const {
    data: eventsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useGetEvents({
    // @ts-ignore
    sort: 'date:asc',
    myTeams: true,
  });

  const events = useMemo(() => eventsData?.pages.flatMap((page) => page.data) || [], [eventsData]);

  // Get user's club and CM IDs for featured events membership filtering
  const userClubId = userData?.club?.documentId;
  const userCmId = userData?.club?.parentMultisport?.documentId;
  
  const trainedSectionIds = userData?.trainedTeams?.map(t => t.club?.documentId).filter(Boolean) || [];
  const trainedCmIds = userData?.trainedTeams?.map(t => t.club?.parentMultisport?.documentId).filter(Boolean) || [];
  
  const playerSectionIds = userData?.myTeams?.map(t => t.club?.documentId).filter(Boolean) || [];
  const playerCmIds = userData?.myTeams?.map(t => t.club?.parentMultisport?.documentId).filter(Boolean) || [];

  const allClubIds = [
    userClubId, 
    userCmId,
    ...trainedSectionIds, 
    ...trainedCmIds, 
    ...playerSectionIds, 
    ...playerCmIds
  ].filter((value, index, self) => Boolean(value) && self.indexOf(value) === index);

  // Fetch SECTION/CM featured events for Mon Planning
  const {
    data: featuredData,
    isLoading: isFeaturedLoading,
  } = useGetEvents({
    isFeatured: true,
    featuredScope: ['SECTION', 'CM'],
    membershipClubIds: allClubIds.length ? allClubIds : undefined,
    sessionStatus: 'open',
    pageSize: 5,
  }, { enabled: allClubIds.length > 0 });

  const featuredEvents = useMemo(() => 
    featuredData?.pages?.flatMap((page) => page.data) || [], 
    [featuredData]
  );

  // Filter events for the list (starting from listStartDate)
  const listEvents = useMemo(() => {
    const myTeamIds = [
      ...(userData?.myTeams || []), 
      ...(userData?.trainedTeams || [])
    ].map(t => t.documentId);

    return events.filter((event) => {
      if (!event || !event.date) return false;
      const eventDate = new Date(event.date);
      
      // Date Filter
      const isDateValid = isSameDay(eventDate, listStartDate) || isAfter(eventDate, listStartDate);
      if (!isDateValid) return false;

      // Filter out Featured Events (they appear in the carousel)
      // UNLESS they are events for my specific team.
      if (event.isFeatured) {
        const isMyTeamEvent = event.teams?.some(team => myTeamIds.includes(team.documentId));
        if (!isMyTeamEvent) {
            return false;
        }
      }

      return true;
    });
  }, [events, listStartDate, userData]);

  const queryClient = useQueryClient();

  /**
   * Mutation to create an event participation
   */
  const createEventParticipationMutation = useMutation({
    mutationFn: createEventParticipation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      refetch();
    },
  });

  const handleParticipateToEvent = useCallback((event) => {
    if (event?.documentId && userData?.documentId) {
      createEventParticipationMutation.mutate({
        event: event.documentId,
        user: userData.documentId,
      });
    }
  }, [createEventParticipationMutation, userData]);

  const handleJoinEvent = useCallback((event) => {
    setSelectedEvent(event);
    setIsJoinModalVisible(true);
  }, []);

  const handleCloseJoinModal = useCallback(() => {
    setIsJoinModalVisible(false);
    setSelectedEvent(undefined);
  }, []);


  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  /**
   * Handle event press
   * @param {import('@/domains/event/types').FCEvent} event
   */
  const handleEventPress = (event) => {
    if (!event?.documentId) {
      console.warn('MyEventList: missing eventId', event);
      return;
    }
    console.log('MyEventList: Navigating to', event.documentId);
    // @ts-ignore
    navigation.navigate('EventStack', { 
      screen: 'EventDetails', 
      params: { eventId: event.documentId } 
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
            onPress={() => navigation.navigate(RouteNames.ReservationDetails, { reservationId: item.reservation.documentId })}
            onJoin={() => handleJoinEvent(item.reservation)}
            onDecline={() => {}}
            onParticipate={() => handleParticipateToEvent(item.reservation)}
            onLogin={() => {}}
          />
        </View>
      );
    }
    return (
      <View style={[Spaces.marginBottom[16]]}>
        <EventCardNew
          item={item}
          onPress={() => handleEventPress(item)}
          onJoin={() => handleJoinEvent(item)}
          onDecline={() => {}}
          onParticipate={() => handleParticipateToEvent(item)}
          onLogin={() => {}}
        />
      </View>
    );
  };

  /**
   * @param {Date} date
   */
  const handleDateConfirm = (date) => {
    setListStartDate(date);
    setIsDatePickerVisible(false);
  };

  const openViewModal = () => setIsViewModalVisible(true);
  const closeViewModal = () => setIsViewModalVisible(false);

  /**
   * @param {string} mode
   */
  const handleViewSelect = (mode) => {
    setCalendarViewMode(mode);
    closeViewModal();
  };

  /**
   * @param {string} mode
   */
  const getViewLabel = (mode) => {
    switch (mode) {
      case 'month': return 'Vue : Mois';
      case 'week': return 'Vue : Semaine';
      case '3days': return 'Vue : 3 Jours';
      default: return 'Vue : Semaine';
    }
  };


  const handleSummaryPress = () => {
    // @ts-ignore
    flatListRef.current?.scrollToOffset({ offset: 500, animated: true });
  };

  const ListHeader = () => {
    return (
      <View style={[Spaces.gap[24], Spaces.marginBottom[16]]}>
        {/* Top Header */}
        <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
          {/* @ts-ignore */}
          <Image source={Images.logo} style={{ height: 30, resizeMode: 'contain', width: 222 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <NotificationBadge />
            <ProfileButton />
          </View>
        </View>

        {/* Calendar Section */}
        <View>
          <PersonalPlanningContainer onSummaryPress={handleSummaryPress} />
        </View>

        {/* Featured Events Carousel */}
        {featuredEvents.length > 0 && (
          <View style={[Spaces.marginTop[16]]}>
            <Text style={[Fonts.h3, Fonts.neutral00, Spaces.marginBottom[8]]}>
              ⭐ À la une dans mon club
            </Text>
            <FeaturedEvents events={featuredEvents} />
          </View>
        )}

        {/* List Header Section */}
        <View style={[Spaces.marginTop[16]]}>
          <Text style={[Fonts.h3, Fonts.neutral00, Spaces.marginBottom[8]]}>
            Évènements à partir de
          </Text>
          <DateSlider
            selectedDate={listStartDate}
            onDateSelected={handleDateConfirm}
          />
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer bgImage="bg2">
      <FlatList
        ref={flatListRef}
        data={listEvents}
        renderItem={renderItem}
        // @ts-ignore
        keyExtractor={(item) => item.documentId || Math.random().toString()}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={[Spaces.paddingBottom[80]]}
        showsVerticalScrollIndicator={false}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        extraData={userData}
      />

      {canManageEvents && (
        <View style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          right: 20,
        }}>
          <TouchableOpacity
            // @ts-ignore
            onPress={() => navigation.navigate('EventStack', { screen: 'EventWizardType' })}
            style={{
              backgroundColor: Colors.primary500,
              borderRadius: 25,
              paddingVertical: 16,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: "#000",
              shadowOffset: {
                width: 0,
                height: 2,
              },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
              elevation: 5,
            }}
          >
            <Text style={[Fonts.h4Bold, { color: Colors.neutral900 }]}>Ajouter un évènement</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* View Selection Modal */}
      <BottomModal
        isVisible={isViewModalVisible}
        close={closeViewModal}
        style={{ paddingBottom: 40 }}
      >
        <View style={[Spaces.gap[16]]}>
          <Text style={[Fonts.h3, Fonts.neutral00, { textAlign: 'center', marginBottom: 16 }]}>
            Choisir la vue
          </Text>

          <TouchableOpacity
            onPress={() => handleViewSelect('3days')}
            style={[
              Spaces.paddingVertical[16],
              Spaces.paddingHorizontal[24],
              { backgroundColor: calendarViewMode === '3days' ? Colors.primary500 : Colors.neutral800, borderRadius: 12 }
            ]}
          >
            <Text style={[Fonts.p2Bold, { color: calendarViewMode === '3days' ? Colors.neutral900 : Colors.neutral00, textAlign: 'center' }]}>
              Vue 3 Jours
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleViewSelect('week')}
            style={[
              Spaces.paddingVertical[16],
              Spaces.paddingHorizontal[24],
              { backgroundColor: calendarViewMode === 'week' ? Colors.primary500 : Colors.neutral800, borderRadius: 12 }
            ]}
          >
            <Text style={[Fonts.p2Bold, { color: calendarViewMode === 'week' ? Colors.neutral900 : Colors.neutral00, textAlign: 'center' }]}>
              Vue Semaine
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleViewSelect('month')}
            style={[
              Spaces.paddingVertical[16],
              Spaces.paddingHorizontal[24],
              { backgroundColor: calendarViewMode === 'month' ? Colors.primary500 : Colors.neutral800, borderRadius: 12 }
            ]}
          >
            <Text style={[Fonts.p2Bold, { color: calendarViewMode === 'month' ? Colors.neutral900 : Colors.neutral00, textAlign: 'center' }]}>
              Vue Mois
            </Text>
          </TouchableOpacity>
        </View>
      </BottomModal>
      <JoinEventModal
        clubName={selectedEvent?.team?.club?.name || ''}
        createEventParticipationMutation={createEventParticipationMutation}
        eventId={selectedEvent?.documentId || ''}
        isVisible={isJoinModalVisible}
        onClose={handleCloseJoinModal}
      />
    </ScreenContainer>
  );
}

export default ParticipantEventList;
