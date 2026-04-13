import { useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isBefore, startOfDay } from 'date-fns';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator, Dimensions, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';

import { USER_ROLES } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { useAppContext } from '@/store/appContext';
import { horizontalScale } from '@/theme/scaling';
import useTheme from '@/theme/themeContext';

import SearchMapFab from '@/components/atoms/searchMapFab/SearchMapFab';
import DateSlider from '@/components/molecules/dateSlider/DateSlider';
import EventCardNew from '@/components/molecules/eventCard/EventCardNew';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import JoinEventModal from '@/components/organisms/joinEventModal/JoinEventModal';
import SearchComponent from '@/components/organisms/searchComponent/searchComponent';

import { RouteNames } from '@/navigation/routeNames';
import useBottomDockLayout from '@/navigation/useBottomDockLayout';

import { createEventParticipation } from '@/services/eventParticipation/eventParticipationService';
import { useGetFeaturedReservations, useGetReservations } from '@/services/reservation/reservationQueries';
import { useSearchReservations } from '@/services/search/searchQueries';
import { getMatchReasonLabel, mapSearchPayload } from '@/services/search/searchService';

/** @typedef {import('@/domains/event/types').FCEvent} FCEvent */
/** @typedef {{ pages?: Array<{ data?: FCEvent[] }> }} ReservationPages */

function ReservationsListSeparator() {
  return <View style={{ height: 16 }} />;
}

/**
 * @param {{ enableMapMode?: boolean; showFilters?: boolean }} props
 */
function ReservationListContent({ enableMapMode = false, showFilters = false }) {
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

  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(/** @type {FCEvent | undefined} */ (undefined));
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [{ reservationFilters }, appDispatch] = useAppContext();
  const { floatingActionBottomOffset, sceneBottomInset } = useBottomDockLayout();
  const selectedActivity = reservationFilters?.activitySlug || null;
  const activeSearchText = useMemo(
    () => (typeof reservationFilters?.q === 'string' ? reservationFilters.q.trim() : ''),
    [reservationFilters?.q],
  );
  const isSmartSearchEnabled = activeSearchText.length >= 2;

  const activityOptions = [
    { id: 'all', label: 'Tous', slug: null },
    { id: 'padel', label: 'Padel', slug: 'padel' },
    { id: 'foot', label: 'Foot 5', slug: 'foot' },
    { id: 'tennis', label: 'Tennis', slug: 'tennis' },
    { id: 'basket', label: 'Basket', slug: 'basket' },
  ];

  const createEventParticipationMutation = useMutation({
    mutationFn: createEventParticipation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['featured-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['planning', 'personal'] });
      if (isSmartSearchEnabled) {
        refetchSmart();
      } else {
        refetch();
      }
      setIsJoinModalVisible(false);
    },
  });

  const activeFilters = useMemo(() => {
    const nextFilters = {
      ...(reservationFilters || {}),
    };

    if (!nextFilters.startDateAfter) {
      nextFilters.startDateAfter = startOfDay(new Date()).toISOString();
    }

    return nextFilters;
  }, [reservationFilters]);

  const {
    data: requestPages,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useGetReservations({ ...activeFilters, pageSize: 15 }, {
    enabled: !isSmartSearchEnabled,
  });
  const {
    data: smartPages,
    error: smartError,
    fetchNextPage: fetchSmartNextPage,
    hasNextPage: hasSmartNextPage,
    isFetchingNextPage: isFetchingSmartNextPage,
    isLoading: isSmartLoading,
    refetch: refetchSmart,
  } = useSearchReservations({
    activity: activeFilters?.activity || activeFilters?.activitySlug,
    category: activeFilters?.category,
    club: activeFilters?.club,
    lat: activeFilters?.lat,
    level: activeFilters?.level,
    lon: activeFilters?.lon,
    maxPricePerPerson: activeFilters?.maxPricePerPerson || activeFilters?.maxPrice,
    pageSize: 15,
    q: activeSearchText,
    radius: activeFilters?.radius,
    reservationMode: activeFilters?.reservationMode,
    startDateAfter: activeFilters?.startDateAfter,
    startDateBefore: activeFilters?.startDateBefore,
  }, {
    enabled: isSmartSearchEnabled,
  });

  const {
    data: featuredData,
    error: featuredError,
    isLoading: isFeaturedLoading,
    refetch: refetchFeatured,
  } = useGetFeaturedReservations();

  const featuredReservations = useMemo(() => {
    const typedFeaturedData = /** @type {{ data?: any[] }} */ (featuredData || {});
    if (featuredError || !typedFeaturedData.data) return [];

    try {
      const items = typedFeaturedData.data;
      if (!Array.isArray(items)) return [];

      const events = items.length > 0 && items[0]?.event
        ? items.map((item) => item.event)
        : items;

      return events
        .filter((/** @type {FCEvent} */ event) => event && typeof event === 'object' && (event.documentId || event.id))
        .filter((/** @type {FCEvent} */ event) => {
          if (!event.date) return false;
          return !isBefore(new Date(event.date), startOfDay(new Date()));
        });
    } catch (parseError) {
      console.error('Error parsing featured reservations:', parseError);
      return [];
    }
  }, [featuredData, featuredError]);

  const reservations = useMemo(() => {
    const pages = /** @type {ReservationPages} */ (requestPages || {});
    return pages?.pages?.reduce((/** @type {FCEvent[]} */ acc, page) => {
      const items = page?.data || [];
      return acc.concat(items);
    }, []) || [];
  }, [requestPages]);

  const smartReservations = useMemo(() => {
    const pages = /** @type {ReservationPages} */ (smartPages || {});
    return pages?.pages?.reduce((/** @type {FCEvent[]} */ acc, page) => {
      const items = mapSearchPayload(page);
      return acc.concat(items);
    }, []) || [];
  }, [smartPages]);

  const displayedReservations = isSmartSearchEnabled ? smartReservations : reservations;
  const activeError = isSmartSearchEnabled ? smartError : error;
  const activeLoading = isSmartSearchEnabled ? isSmartLoading : isLoading;
  const activeFetchingNext = isSmartSearchEnabled ? isFetchingSmartNextPage : isFetchingNextPage;
  const shouldShowMapToggle = enableMapMode && showFilters && displayedReservations.length > 0;
  const listBottomPadding = shouldShowMapToggle
    ? Math.max(sceneBottomInset, floatingActionBottomOffset + 84)
    : sceneBottomInset;

  const filterCount = useMemo(() => {
    if (!reservationFilters) return 0;
    return Object.entries(reservationFilters).reduce((acc, [, value]) => {
      if (!value || (Array.isArray(value) && value.length === 0)) {
        return acc;
      }
      return acc + 1;
    }, 0);
  }, [reservationFilters]);

  const handleEndReached = useCallback(() => {
    if (isSmartSearchEnabled) {
      if (hasSmartNextPage && !isFetchingSmartNextPage) {
        fetchSmartNextPage();
      }
      return;
    }

    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [
    fetchNextPage,
    fetchSmartNextPage,
    hasNextPage,
    hasSmartNextPage,
    isFetchingNextPage,
    isFetchingSmartNextPage,
    isSmartSearchEnabled,
  ]);

  const handleCardPress = useCallback((/** @type {FCEvent} */ item) => {
    if (!item?.documentId) return;

    navigation.navigate(RouteNames.EventStack, {
      params: { eventId: item.documentId },
      screen: RouteNames.EventDetails,
    });
  }, [navigation]);

  const handleJoinEvent = useCallback((/** @type {FCEvent} */ event) => {
    setSelectedEvent(event);
    setIsJoinModalVisible(true);
  }, []);

  const handleCloseJoinModal = useCallback(() => {
    setIsJoinModalVisible(false);
    setSelectedEvent(undefined);
  }, []);

  const handleFilterPress = useCallback(() => {
    navigation.navigate(RouteNames.ReservationFilters);
  }, [navigation]);

  const handleSearchField = useCallback((/** @type {string} */ q) => {
    appDispatch({
      payload: Object.assign(reservationFilters || {}, { q }),
      type: 'SET_RESERVATION_FILTERS',
    });
  }, [appDispatch, reservationFilters]);

  const handleDateSelected = useCallback((/** @type {Date} */ date) => {
    setSelectedDate(date);
    const start = startOfDay(date).toISOString();
    appDispatch({
      payload: Object.assign(reservationFilters || {}, { startDateAfter: start }),
      type: 'SET_RESERVATION_FILTERS',
    });
  }, [appDispatch, reservationFilters]);

  const handleRefresh = useCallback(() => {
    if (isSmartSearchEnabled) {
      refetchSmart();
    } else {
      refetch();
    }
    refetchFeatured();
  }, [isSmartSearchEnabled, refetch, refetchFeatured, refetchSmart]);

  const handleActivitySelect = useCallback((/** @type {string | null} */ activitySlug) => {
    appDispatch({
      payload: {
        ...(reservationFilters || {}),
        activitySlug: activitySlug || null,
      },
      type: 'SET_RESERVATION_FILTERS',
    });
  }, [appDispatch, reservationFilters]);

  /**
   * @param {{ item: FCEvent }} param
   */
  const renderItem = useCallback(({ item }) => {
    const isManager = userData?.role?.name === USER_ROLES.coach || userData?.role?.name === USER_ROLES.president;
    const primaryReasonLabel = getMatchReasonLabel(
      Reflect.get(item || {}, '__search')?.matchReasons?.[0],
    );

    return (
      <View style={[Spaces.gap[8]]}>
        {primaryReasonLabel ? (
          <Text style={[Fonts.p3, Fonts.primary500]}>
            {`Tri pertinence: ${primaryReasonLabel}`}
          </Text>
        ) : null}
        <EventCardNew
          actionLabel={isManager ? t('eventList.actions.about') : undefined}
          item={item}
          onDecline={() => {}}
          onJoin={() => {}}
          onLogin={() => {}}
          onParticipate={isManager ? handleCardPress : () => handleJoinEvent(item)}
          onPress={handleCardPress}
        />
      </View>
    );
  }, [Fonts, Spaces, handleCardPress, handleJoinEvent, t, userData?.role?.name]);

  if (activeLoading && !(isSmartSearchEnabled ? smartPages : requestPages)) {
    return (
      <View style={[Spaces.gap[40], Alignments.fill, Alignments.alignCenter, Alignments.justifyCenter]}>
        <Text style={[Fonts.p1, Fonts.neutral300]}>
          {t('common.loading', 'Chargement...')}
        </Text>
      </View>
    );
  }

  if (activeError && !(isSmartSearchEnabled ? smartPages : requestPages)) {
    return (
      <View style={[Spaces.gap[40], Alignments.fill, Alignments.alignCenter, Alignments.justifyCenter]}>
        <Text style={[Fonts.p1, Fonts.error500]}>
          {activeError?.message || 'Une erreur est survenue'}
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
      Spaces.marginVertical[24],
    ]}
    >
      <Text style={[Fonts.p1Bold, Fonts.neutral00, Fonts.textCenter]}>
        {t('reservation.noData')}
      </Text>
    </View>
  );

  const renderHeader = () => (
    <View style={[Spaces.gap[24], Spaces.marginBottom[24]]}>
      {!isFeaturedLoading && !featuredError && featuredReservations.length > 0 ? (
        <View style={[Spaces.gap[12]]}>
          <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
            {t('reservation.featured')}
          </Text>
          <ScrollView
            contentContainerStyle={[{ paddingVertical: 10 }, Spaces.gap[16]]}
            horizontal
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
                    onDecline={() => {}}
                    onJoin={() => {}}
                    onLogin={() => {}}
                    onParticipate={isManager ? handleCardPress : () => handleJoinEvent(item)}
                    onPress={handleCardPress}
                  />
                </View>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <View>
        <Text style={[Fonts.p1, { color: Colors.neutral00, marginBottom: 8 }]}>
          Réservations à partir de
        </Text>
        <DateSlider
          onDateSelected={handleDateSelected}
          selectedDate={selectedDate}
        />
      </View>

      <View>
        <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 8 }]}>
          Filtrer par activité
        </Text>
        <ScrollView
          contentContainerStyle={{ gap: 8 }}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {activityOptions.map((activity) => {
            const isSelected = selectedActivity === activity.slug
              || (activity.slug === null && selectedActivity === null);

            return (
              <Pressable
                key={activity.id}
                onPress={() => handleActivitySelect(activity.slug)}
                style={[
                  localStyles.activityChip,
                  isSelected && { backgroundColor: Colors.primary500 },
                ]}
              >
                <Text
                  style={[
                    localStyles.activityChipText,
                    isSelected && { color: Colors.neutral900 },
                  ]}
                >
                  {activity.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={[Alignments.alignCenter]}>
        <SearchComponent
          filterNumber={filterCount}
          handleSearchField={handleSearchField}
          openFilters={handleFilterPress}
          searchDefaultValue={reservationFilters?.q}
        />
      </View>

      {isSmartSearchEnabled ? (
        <Text style={[Fonts.p3, Fonts.primary500]}>
          Tri par pertinence
        </Text>
      ) : null}
    </View>
  );

  return (
    <View style={[Alignments.fill]}>
      <WithDataWrapper
        error={activeError?.message}
        isLoading={(activeLoading && !activeFetchingNext) || createEventParticipationMutation.isPending}
        wrapperStyle={[Alignments.fill]}
      >
        <FlashList
          contentContainerStyle={{ paddingBottom: listBottomPadding }}
          data={displayedReservations}
          estimatedItemSize={200}
          ItemSeparatorComponent={ReservationsListSeparator}
          keyExtractor={(item) => (item?.documentId || 'unknown').toString()}
          ListEmptyComponent={renderEmptyList}
          ListFooterComponent={activeFetchingNext ? (
            <ActivityIndicator
              color={Colors.primary500}
              size="large"
              style={Spaces.marginVertical[16]}
            />
          ) : null}
          ListHeaderComponent={renderHeader}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          onRefresh={handleRefresh}
          refreshing={activeLoading && !activeFetchingNext}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
        />
      </WithDataWrapper>

      <JoinEventModal
        clubName={selectedEvent?.team?.club?.name || selectedEvent?.club?.name || ''}
        createEventParticipationMutation={createEventParticipationMutation}
        eventId={selectedEvent?.documentId}
        isVisible={isJoinModalVisible}
        onClose={handleCloseJoinModal}
      />

      {shouldShowMapToggle ? (
        <SearchMapFab
          mode="list"
          onPress={() => navigation.navigate(RouteNames.SearchMapScreen, { scope: 'reservations' })}
          scope="reservations"
        />
      ) : null}
    </View>
  );
}

const localStyles = StyleSheet.create({
  activityChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  activityChipText: {
    color: '#FFFFFF',
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 13,
  },
});

export default ReservationListContent;
