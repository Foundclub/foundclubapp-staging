import { useNavigation } from '@react-navigation/native';
import { FlashList } from '@shopify/flash-list';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Dimensions, ScrollView, Text, View } from 'react-native';
import { startOfDay } from 'date-fns';

import useTheme from '@/theme/themeContext';

import SearchComponent from '@/components/organisms/searchComponent/searchComponent';
import EventCardNew from '@/components/molecules/eventCard/EventCardNew';
import ReservationModeModal from '@/components/organisms/reservationModeModal/ReservationModeModal';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import DateSlider from '@/components/molecules/dateSlider/DateSlider';

import { useAppContext } from '@/store/appContext';
import { RouteNames } from '@/navigation/routeNames';
import { useGetReservations, useGetFeaturedReservations } from '@/services/reservation/reservationQueries';
import { horizontalScale } from '@/theme/scaling';
import { USER_ROLES } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';

function ReservationListContent({ showFilters = false }) {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  const { userData } = useAuth();
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [{ reservationFilters }, appDispatch] = useAppContext();

  const renderItem = ({ item }) => {
    const isManager = userData?.role?.name === USER_ROLES.coach || userData?.role?.name === USER_ROLES.president;
    return (
      <EventCardNew
        actionLabel={isManager ? t('eventList.actions.about') : undefined}
        item={item}
        onParticipate={isManager ? handleCardPress : handleParticipate}
        onPress={handleCardPress}
      />
    );
  };

  const filterCount = useMemo(() => {
    if (!reservationFilters) return 0;

    return Object.entries(reservationFilters).reduce((/** @type {number} */ acc, [key, value]) => {
      // Skip if the value is falsy or an empty array
      if (!value || (Array.isArray(value) && value.length === 0)) {
        return acc;
      }
      return acc + 1;
    }, 0);
  }, [reservationFilters]);

  const {
    data: requestPages,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useGetReservations({ ...reservationFilters, pageSize: 15 });

  const {
    data: featuredData,
    isLoading: isFeaturedLoading,
    error: featuredError,
    refetch: refetchFeatured,
  } = useGetFeaturedReservations();

  // Tous les hooks doivent être appelés AVANT tout return conditionnel
  const featuredReservations = useMemo(() => {
    // Si erreur ou pas de données, retourner tableau vide (fallback sera géré côté backend)
    if (featuredError || !featuredData?.data) return [];

    try {
      const items = featuredData.data;
      if (!Array.isArray(items)) return [];

      console.log('Raw Featured Items:', items.length);

      // Determine if we need to unwrap (if items are FeaturedItem wrappers) or if they are already Events
      let events = [];
      if (items.length > 0 && items[0]?.event) {
        console.log('Unwrapping Featured Items to Events');
        events = items.map((item) => item.event);
      } else {
        console.log('Items are already Events');
        events = items;
      }

      // Validate events
      const validEvents = events.filter((event) => {
        // Strict validation: Must be an object and have a valid ID
        const isValid = event && typeof event === 'object' && (event.documentId || event.id);
        if (!isValid) {
          console.warn('Filtered out invalid featured event:', event);
        }
        return isValid;
      });

      console.log('Valid Featured Events:', validEvents.length);
      return validEvents;
    } catch (error) {
      console.error('Error parsing featured reservations:', error);
      return [];
    }
  }, [featuredData, featuredError]);

  // Tous les hooks doivent être appelés AVANT tout return conditionnel
  const reservations = useMemo(() => {
    const allReservations = requestPages?.pages
      ?.reduce((/** @type {any[]} */ acc, page) => {
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

  const handleCardPress = useCallback((item) => {
    if (item?.documentId) {
      navigation.navigate(RouteNames.EventDetails, { eventId: item.documentId });
    }
  }, [navigation]);

  const handleParticipate = useCallback((item) => {
    setSelectedReservation(item);
    setIsModalVisible(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsModalVisible(false);
    setSelectedReservation(null);
  }, []);

  const handleModalConfirm = useCallback((mode, playerCount) => {
    console.log('Participation confirmed:', mode, playerCount);
    // TODO: Call API to join reservation
    setIsModalVisible(false);
    setSelectedReservation(null);
  }, []);

  const handleCalendarPress = useCallback(() => {
    console.log('Calendar pressed');
    // TODO: Open calendar modal
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

  // Date Picker Handlers
  const handleDateSelected = useCallback((date) => {
    setSelectedDate(date);
    const start = startOfDay(date).toISOString();

    appDispatch({
      payload: Object.assign(reservationFilters || {}, {
        startDateAfter: start,
      }),
      type: 'SET_RESERVATION_FILTERS',
    });
  }, [appDispatch, reservationFilters]);

  const handleRefresh = useCallback(() => {
    refetch();
    refetchFeatured();
  }, [refetch, refetchFeatured]);

  // Early return APRÈS tous les hooks
  if (isLoading && !requestPages) {
    return (
      <View style={[Spaces.gap[40], Alignments.fill, Alignments.alignCenter, Alignments.justifyCenter]}>
        <Text style={[Fonts.p1, Fonts.neutral300]}>
          {t('common.loading', 'Chargement...')}
        </Text>
      </View>
    );
  }

  // Early return if error
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
      {/* Section À la une */}
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
              const cardWidth = Dimensions.get('window').width - horizontalScale(48); // Full width of container (Screen - 2*24 padding)
              return (
                <EventCardNew
                  key={item?.documentId || Math.random()}
                  actionLabel={isManager ? t('eventList.actions.about') : undefined}
                  item={item}
                  onParticipate={isManager ? handleCardPress : handleParticipate}
                  onPress={handleCardPress}
                  style={{ width: cardWidth }}
                />
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Titre Évènements */}
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

      {/* Barre de recherche + Filtres */}
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
        isLoading={isLoading && !isFetchingNextPage}
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

      {/* Modal de participation */}
      <ReservationModeModal
        isVisible={isModalVisible}
        onClose={handleModalClose}
        onConfirm={handleModalConfirm}
        reservation={selectedReservation}
      />
    </View>
  );
}

export default ReservationListContent;
