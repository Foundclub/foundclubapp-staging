import { useFocusEffect } from '@react-navigation/native';
import { format, isAfter, isSameDay, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import React, { useCallback, useMemo, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FlatList, Image, Modal, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';
import DateSlider from '@/components/molecules/dateSlider/DateSlider';

import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import EventCardNew from '@/components/molecules/eventCard/EventCardNew';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import ScreenContainer from '@/components/templates/ScreenContainer';
import EventListContent from '@/components/organisms/eventListContent/EventListContent';
import PersonalPlanningContainer from '@/components/organisms/planning/PersonalPlanningContainer';
import { useGetEvents } from '@/services/event/eventQueries';
import useTheme from '@/theme/themeContext';
import { images as Images } from '@/theme/images';
import { RouteNames } from '@/navigation/routeNames';
import useAuth from '@/domains/auth/useAuth';
import { USER_ROLES } from '@/domains/auth/authUseCases';

/**
 * My events list screen component that shows events where the user is a participant
 * @param {object} props
 * @param {object} props.navigation - Navigation object
 * @returns {React.ReactElement} MyEventList component
 */
function MyEventList({ navigation }) {
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
  const flatListRef = useRef(null);

  // Hooks

  const {
    data: eventsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useGetEvents({
    sort: 'date:asc',
    myTeams: true,
  });

  const events = useMemo(() => eventsData?.pages.flatMap((page) => page.data) || [], [eventsData]);

  // Filter events for the list (starting from listStartDate)
  const listEvents = useMemo(() => {
    return events.filter((event) => {
      if (!event || !event.date) return false;
      const eventDate = new Date(event.date);
      // Keep events that are same day or after listStartDate
      return isSameDay(eventDate, listStartDate) || isAfter(eventDate, listStartDate);
    });
  }, [events, listStartDate]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  /**
   * Handle event press
   * @param {import('@/services/event/eventService').FCEvent} event
   */
  const handleEventPress = (event) => {
    if (event.type?.name === 'Match') {
      // @ts-ignore
      navigation.navigate(RouteNames.MatchDetails, { matchId: event.documentId });
    } else if (event.type?.name === 'Entraînement') {
      // @ts-ignore
      navigation.navigate(RouteNames.TrainingDetails, { trainingId: event.documentId });
    } else {
      // @ts-ignore
      navigation.navigate(RouteNames.EventStack, { screen: RouteNames.EventDetails, params: { eventId: event.documentId } });
    }
  };

  const renderItem = ({ item }) => {
    if (item.reservation) {
      return (
        <View style={[Spaces.marginBottom[16]]}>
          <EventCardNew
            item={item.reservation}
            // @ts-ignore
            onPress={() => navigation.navigate(RouteNames.ReservationDetails, { reservationId: item.reservation.documentId })}
          />
        </View>
      );
    }
    return (
      <View style={[Spaces.marginBottom[16]]}>
        <EventCardNew
          item={item}
          onPress={() => handleEventPress(item)}
        />
      </View>
    );
  };

  const handleDateConfirm = (date) => {
    setListStartDate(date);
    setIsDatePickerVisible(false);
  };

  const openViewModal = () => setIsViewModalVisible(true);
  const closeViewModal = () => setIsViewModalVisible(false);

  const handleViewSelect = (mode) => {
    setCalendarViewMode(mode);
    closeViewModal();
  };

  const getViewLabel = (mode) => {
    switch (mode) {
      case 'month': return 'Vue : Mois';
      case 'week': return 'Vue : Semaine';
      case '3days': return 'Vue : 3 Jours';
      default: return 'Vue : Semaine';
    }
  };

  // ... (renderItem remains same)

  const handleSummaryPress = () => {
    flatListRef.current?.scrollToOffset({ offset: 500, animated: true });
  };

  const ListHeader = () => (
    <View style={[Spaces.gap[24], Spaces.marginBottom[16]]}>
      {/* Top Header */}
      <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
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

  return (
    <ScreenContainer bgImage="bg2">
      <FlatList
        ref={flatListRef}
        data={listEvents}
        renderItem={renderItem}
        keyExtractor={(item) => item.documentId}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={[Spaces.paddingBottom[80]]}
        showsVerticalScrollIndicator={false}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.5}
        extraData={userData}
      />

      {['Coach', 'Entraineur', 'President', 'Dirigeant'].includes(userData?.role?.name) && (
        <View style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          right: 20,
        }}>
          <TouchableOpacity
            onPress={() => navigation.navigate(RouteNames.EventEdit, { date: listStartDate ? listStartDate.toISOString() : undefined })}
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
    </ScreenContainer>
  );
}

export default MyEventList;
