import { useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { startOfDay, isBefore } from 'date-fns';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import useTheme from '@/theme/themeContext';

import SearchComponent from '@/components/organisms/searchComponent/searchComponent';
import EventCardNew from '@/components/molecules/eventCard/EventCardNew';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import DateSlider from '@/components/molecules/dateSlider/DateSlider';
import JoinEventModal from '@/components/organisms/joinEventModal/JoinEventModal';

import { useAppContext } from '@/store/appContext';
import { RouteNames } from '@/navigation/routeNames';
import { useGetReservations, useGetFeaturedReservations } from '@/services/reservation/reservationQueries';
import { createEventParticipation } from '@/services/eventParticipation/eventParticipationService';
import { horizontalScale } from '@/theme/scaling';
import { USER_ROLES } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';

function ReservationListContent({ showFilters = false }) {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  const { userData } = useAuth();
  const userDocumentId = userData?.documentId;
  
  // State for JoinEventModal - SAME as EventListContent
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(undefined);
  
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedActivity, setSelectedActivity] = useState(null); // Activity quick filter
  const [{ reservationFilters }, appDispatch] = useAppContext();

  // Activity options for quick filters
  const activityOptions = [
    { id: 'all', label: 'Tous', emoji: '🎯', slug: null },
    { id: 'padel', label: 'Padel', emoji: '🎾', slug: 'padel' },
    { id: 'foot', label: 'Foot 5', emoji: '⚽', slug: 'foot' },
    { id: 'tennis', label: 'Tennis', emoji: '🎾', slug: 'tennis' },
    { id: 'basket', label: 'Basket', emoji: '🏀', slug: 'basket' },
  ];

  // SAME mutation as EventListContent
  const createEventParticipationMutation = useMutation({
    mutationFn: createEventParticipation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['featured-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      refetch();
      setIsJoinModalVisible(false);
    },
  });

  // Handlers - SAME as EventListContent
  const handleCardPress = useCallback((item) => {
    if (item?.documentId) {
      navigation.navigate('EventStack', { screen: 'EventDetails', params: { eventId: item.documentId } });
    }
  }, [navigation]);

  // SAME as handleJoinEvent in EventListContent - opens the modal
  const handleJoinEvent = useCallback((event) => {
    setSelectedEvent(event);
    setIsJoinModalVisible(true);
  }, []);

  const handleCloseJoinModal = useCallback(() => {
    setIsJoinModalVisible(false);
    setSelectedEvent(undefined);
  }, []);

  const filterCount = useMemo(() => {
    if (!reservationFilters) return 0;
    return Object.entries(reservationFilters).reduce((acc, [key, value]) => {
      if (!value || (Array.isArray(value) && value.length === 0)) {
        return acc;
      }
      return acc + 1;
    }, 0);
  }, [reservationFilters]);

  const activeFilters = useMemo(() => {
    const filters = { ...reservationFilters };
    if (!filters.startDateAfter) {
      filters.startDateAfter = startOfDay(new Date()).toISOString();
    }
    // Apply activity filter if selected
    if (selectedActivity && selectedActivity !== 'all') {
      filters.activitySlug = selectedActivity;
    }
    return filters;
  }, [reservationFilters, selectedActivity]);

  const {
    data: requestPages,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useGetReservations({ ...activeFilters, pageSize: 15 });

  const {
    data: featuredData,
    isLoading: isFeaturedLoading,
    error: featuredError,
    refetch: refetchFeatured,
  } = useGetFeaturedReservations();

  const featuredReservations = useMemo(() => {
    if (featuredError || !featuredData?.data) return [];
    try {
      const items = featuredData.data;
      if (!Array.isArray(items)) return [];

      let events = [];
      if (items.length > 0 && items[0]?.event) {
        events = items.map((item) => item.event);
      } else {
        events = items;
      }

      const validEvents = events.filter((event) => {
        return event && typeof event === 'object' && (event.documentId || event.id);
      });

      const futureEvents = validEvents.filter((event) => {
        if (!event.date) return false;
        return !isBefore(new Date(event.date), startOfDay(new Date()));
      });

      return futureEvents;
    } catch (err) {
      console.error('Error parsing featured reservations:', err);
      return [];
    }
  }, [featuredData, featuredError]);

  const reservations = useMemo(() => {
    const allReservations = requestPages?.pages
      ?.reduce((acc, page) => {
        const items = page?.data || [];
        return acc.concat(items);
      }, [])
      || [];
    return allReservations;
  }, [requestPages]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleFilterPress = useCallback(() => {
    navigation.navigate(RouteNames.ReservationFilters);
  }, [navigation]);

  const handleSearchField = useCallback((q) => {
    appDispatch({
      payload: Object.assign(reservationFilters || {}, { q }),
      type: 'SET_RESERVATION_FILTERS',
    });
  }, [appDispatch, reservationFilters]);

  const handleDateSelected = useCallback((date) => {
    setSelectedDate(date);
    const start = startOfDay(date).toISOString();
    appDispatch({
      payload: Object.assign(reservationFilters || {}, { startDateAfter: start }),
      type: 'SET_RESERVATION_FILTERS',
    });
  }, [appDispatch, reservationFilters]);

  const handleRefresh = useCallback(() => {
    refetch();
    refetchFeatured();
  }, [refetch, refetchFeatured]);

  const handleActivitySelect = useCallback((activitySlug) => {
    setSelectedActivity(activitySlug);
  }, []);

  const renderItem = useCallback(({ item }) => {
    const isManager = userData?.role?.name === USER_ROLES.coach || userData?.role?.name === USER_ROLES.president;
    
    return (
      <EventCardNew
        actionLabel={isManager ? t('eventList.actions.about') : undefined}
        item={item}
        onParticipate={isManager ? handleCardPress : () => handleJoinEvent(item)}
        onPress={handleCardPress}
      />
    );
  }, [userData?.role?.name, t, handleCardPress, handleJoinEvent]);

  // Loading state
  if (isLoading && !requestPages) {
    return (
      <View style={[Spaces.gap[40], Alignments.fill, Alignments.alignCenter, Alignments.justifyCenter]}>
        <Text style={[Fonts.p1, Fonts.neutral300]}>
          {t('common.loading', 'Chargement...')}
        </Text>
      </View>
    );
  }

  // Error state
  if (error && !requestPages) {
    return (
      <View style={[Spaces.gap[40], Alignments.fill, Alignments.alignCenter, Alignments.justifyCenter]}>
        <Text style={[Fonts.p1, Fonts.error500]}>
          {error?.message || 'Une erreur est survenue'}
        </Text>
      </View>
    );
  }

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
        {t('reservation.noData')}
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View style={[Spaces.gap[24], Spaces.marginBottom[24]]}>
      {/* Featured Section */}
      {!isFeaturedLoading && !featuredError && featuredReservations.length > 0 && (
        <View style={[Spaces.gap[12]]}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
            {t('reservation.featured')}
          </Text>
          <ScrollView
            horizontal
            contentContainerStyle={[{ paddingVertical: 10 }, Spaces.gap[16]]}
            showsHorizontalScrollIndicator={false}
          >
            {featuredReservations.map((item) => {
              const isManager = userData?.role?.name === USER_ROLES.coach || userData?.role?.name === USER_ROLES.president;
              const cardWidth = Dimensions.get('window').width - horizontalScale(48);
              return (
                <View key={item?.documentId || Math.random()} style={{ width: cardWidth }}>
                  <EventCardNew
                    actionLabel={isManager ? t('eventList.actions.about') : undefined}
                    item={item}
                    onParticipate={isManager ? handleCardPress : () => handleJoinEvent(item)}
                    onPress={handleCardPress}
                  />
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Date Header */}
      <View>
        <Text style={[Fonts.p1, { color: Colors.neutral00, marginBottom: 8 }]}>
          Réservation à partir de
        </Text>
        <DateSlider
          selectedDate={selectedDate}
          onDateSelected={handleDateSelected}
        />
      </View>

      {/* Activity Quick Filters */}
      <View>
        <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 8 }]}>
          Filtrer par activité
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {activityOptions.map((activity) => {
            const isSelected = selectedActivity === activity.slug || 
              (activity.slug === null && selectedActivity === null);
            return (
              <Pressable
                key={activity.id}
                onPress={() => handleActivitySelect(activity.slug)}
                style={[
                  localStyles.activityChip,
                  isSelected && { backgroundColor: Colors.primary500 },
                ]}
              >
                <Text style={[
                  localStyles.activityChipText,
                  isSelected && { color: Colors.neutral900 },
                ]}>
                  {activity.emoji} {activity.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Search + Filters */}
      <View style={[Alignments.alignCenter]}>
        <SearchComponent
          filterNumber={filterCount}
          handleSearchField={handleSearchField}
          openFilters={handleFilterPress}
          searchDefaultValue={reservationFilters?.q}
        />
      </View>
    </View>
  );

  return (
    <View style={[Alignments.fill]}>
      <WithDataWrapper
        error={error?.message}
        isLoading={(isLoading && !isFetchingNextPage) || createEventParticipationMutation.isPending}
        wrapperStyle={[Alignments.fill]}
      >
        <View style={[Alignments.fill]}>
          <FlashList
            data={reservations}
            estimatedItemSize={200}
            keyExtractor={(item) => item?.documentId || 'unknown'}
            ListEmptyComponent={renderEmptyList}
            ListHeaderComponent={renderHeader}
            ListFooterComponent={isFetchingNextPage ? (
              <ActivityIndicator
                color={Colors.primary500}
                size="large"
                style={Spaces.marginVertical[16]}
              />
            ) : null}
            ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            onRefresh={handleRefresh}
            refreshing={isLoading && !isFetchingNextPage}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
          />
        </View>
      </WithDataWrapper>

      {/* JoinEventModal - SAME as EventListContent */}
      <JoinEventModal
        clubName={selectedEvent?.team?.club?.name || selectedEvent?.club?.name || ''}
        createEventParticipationMutation={createEventParticipationMutation}
        eventId={selectedEvent?.documentId}
        isVisible={isJoinModalVisible}
        onClose={handleCloseJoinModal}
      />
    </View>
  );
}

const localStyles = StyleSheet.create({
  activityChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  activityChipText: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 13,
    color: '#FFFFFF',
  },
});

export default ReservationListContent;
