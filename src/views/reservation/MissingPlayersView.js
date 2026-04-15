import { FlashList } from '@shopify/flash-list';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { differenceInHours, isBefore, startOfDay } from 'date-fns';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator, Alert, StyleSheet, Text, View,
} from 'react-native';

import { getParticipationErrorMessage } from '@/domains/participation/participationFlow';
import useTheme from '@/theme/themeContext';

import EventCardNew from '@/components/molecules/eventCard/EventCardNew';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import JoinEventModal from '@/components/organisms/joinEventModal/JoinEventModal';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetReservations } from '@/services/reservation/reservationQueries';
import { joinReservation } from '@/services/reservation/reservationService';

/** @typedef {import('@/domains/event/types').FCEvent} FCEvent */
/** @typedef {{ pages?: Array<{ data?: FCEvent[] }> }} ReservationPages */

function ReservationListSeparator() {
  return <View style={{ height: 16 }} />;
}

/**
 * MissingPlayersView - Lists reservations that need players (bookingStatus === 'shared')
 * Prioritizes last-minute alerts and sorts by urgency
 */
/**
 * @param {{ navigation: import('@react-navigation/native').NavigationProp<any> }} props
 */
function MissingPlayersView({ navigation }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  // State for JoinEventModal
  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(/** @type {FCEvent | undefined} */ (undefined));

  // Fetch reservations with shared status
  const {
    data: requestPages,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useGetReservations({
    needsPlayers: true,
    pageSize: 20,
    startDateAfter: startOfDay(new Date()).toISOString(),
  });

  // Join mutation
  const joinReservationMutation = useMutation({
    mutationFn: (reservationId) => joinReservation(reservationId),
    onError: (mutationError) => {
      Alert.alert(
        t('common.error'),
        getParticipationErrorMessage(mutationError, t('reservation.joinError', 'Impossible de rejoindre cette reservation.')),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['planning', 'personal'] });
      refetch();
      setIsJoinModalVisible(false);
      setSelectedEvent(undefined);
      Alert.alert(
        t('reservation.joinSuccess.title', 'Participation confirmee'),
        t('reservation.joinSuccess.message', 'Vous participez maintenant a cette reservation.'),
      );
    },
  });

  // Filter and sort reservations by urgency
  const sharedReservations = useMemo(() => {
    const pages = /** @type {ReservationPages} */ (requestPages || {});
    const allReservations = pages?.pages
      ?.reduce((/** @type {FCEvent[]} */ acc, page) => {
        const items = page?.data || [];
        return acc.concat(items);
      }, [])
      || [];

    const shared = allReservations.filter((/** @type {FCEvent & { bookingStatus?: string; reservationMode?: string; missingPlayers?: number }} */ reservation) => {
      const isShared = reservation?.bookingStatus === 'shared' || reservation?.reservationMode === 'RECRUITING';
      const hasMissingPlayers = reservation?.missingPlayers > 0;
      const isFuture = reservation?.date && !isBefore(new Date(reservation.date), new Date());
      return isShared && hasMissingPlayers && isFuture;
    });

    // Sort by urgency: SOS first, then by date proximity
    return shared.sort((/** @type {any} */ a, /** @type {any} */ b) => {
      // SOS alerts first
      if (a.isLastMinuteAlert && !b.isLastMinuteAlert) return -1;
      if (!a.isLastMinuteAlert && b.isLastMinuteAlert) return 1;

      // Then by hours until event (closest first)
      const hoursA = differenceInHours(new Date(a.date), new Date());
      const hoursB = differenceInHours(new Date(b.date), new Date());
      return hoursA - hoursB;
    });
  }, [requestPages]);

  // Handlers
  const handleCardPress = useCallback((/** @type {FCEvent} */ item) => {
    if (item?.documentId) {
      navigation.navigate(RouteNames.EventStack, {
        params: { eventId: item.documentId },
        screen: RouteNames.EventDetails,
      });
    }
  }, [navigation]);

  const handleJoinEvent = useCallback((/** @type {FCEvent} */ event) => {
    setSelectedEvent(event);
    setIsJoinModalVisible(true);
  }, []);

  const handleCloseJoinModal = useCallback(() => {
    setIsJoinModalVisible(false);
    setSelectedEvent(undefined);
  }, []);

  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback((/** @type {{ item: FCEvent }} */ { item }) => (
    <EventCardNew
      item={item}
      onDecline={() => {}}
      onJoin={() => {}}
      onLogin={() => {}}
      onParticipate={() => handleJoinEvent(item)}
      onPress={handleCardPress}
    />
  ), [handleCardPress, handleJoinEvent]);

  const emptyListContent = (
    <View style={[
      ApplicationStyle.backgroundColor.primary900,
      ApplicationStyle.borderRadius16,
      Alignments.alignCenter,
      Spaces.gap[32],
      Spaces.padding[24],
      Spaces.marginVertical[24]]}
    >
      <Text style={[Fonts.h3, Fonts.neutral00, Fonts.textCenter]}>
        🎉
      </Text>
      <Text style={[Fonts.p1Bold, Fonts.neutral00, Fonts.textCenter]}>
        {t('reservation.noMissingPlayers', 'Aucune réservation ne cherche de joueurs pour le moment')}
      </Text>
      <Text style={[Fonts.p2, Fonts.neutral300, Fonts.textCenter]}>
        {t('reservation.noMissingPlayersHint', 'Revenez plus tard ou créez votre propre réservation !')}
      </Text>
    </View>
  );

  const listHeader = (
    <View style={[Spaces.marginBottom[24]]}>
      <Text style={[Fonts.h2, Fonts.neutral00, Spaces.marginBottom[8]]}>
        {t('reservation.missingPlayers.title', 'Joueurs recherchés')}
      </Text>
      <Text style={[Fonts.p2, Fonts.neutral300]}>
        {t('reservation.missingPlayers.subtitle', 'Rejoignez une réservation qui manque de joueurs')}
      </Text>

      {/* Stats */}
      <View style={[Alignments.row, Spaces.gap[12], Spaces.marginTop[16]]}>
        <View style={styles.statBadge}>
          <Text style={styles.statNumber}>{sharedReservations.length}</Text>
          <Text style={styles.statLabel}>Réservations ouvertes</Text>
        </View>
        <View style={[styles.statBadge, styles.sosBadge]}>
          <Text style={styles.statNumber}>
            {sharedReservations.filter((/** @type {any} */ r) => r.isLastMinuteAlert).length}
          </Text>
          <Text style={styles.statLabel}>🔥 SOS urgents</Text>
        </View>
      </View>
    </View>
  );
  const listFooter = isFetchingNextPage ? (
    <ActivityIndicator
      color={Colors.primary500}
      size="large"
      style={Spaces.marginVertical[16]}
    />
  ) : null;

  return (
    <ScreenContainer bgImage="bg2">
      <WithDataWrapper
        error={error?.message}
        isLoading={isLoading && !isFetchingNextPage}
        wrapperStyle={[Alignments.fill]}
      >
        <View style={[Alignments.fill, Spaces.padding[16]]}>
          <FlashList
            contentContainerStyle={{ paddingBottom: 100 }}
            data={sharedReservations}
            estimatedItemSize={220}
            ItemSeparatorComponent={ReservationListSeparator}
            keyExtractor={(item) => (item?.documentId || 'unknown').toString()}
            ListEmptyComponent={emptyListContent}
            ListFooterComponent={listFooter}
            ListHeaderComponent={listHeader}
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            onRefresh={refetch}
            refreshing={isLoading && !isFetchingNextPage}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </WithDataWrapper>

      {/* JoinEventModal */}
      <JoinEventModal
        clubName={selectedEvent?.team?.club?.name || selectedEvent?.club?.name || ''}
        confirmLabel="Reserver"
        isSubmitting={joinReservationMutation.isPending}
        isVisible={isJoinModalVisible}
        onClose={handleCloseJoinModal}
        onConfirm={() => joinReservationMutation.mutateAsync(selectedEvent?.documentId)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sosBadge: {
    backgroundColor: 'rgba(255, 107, 53, 0.2)',
  },
  statBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    flex: 1,
    padding: 16,
  },
  statLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: 'Montserrat-Medium',
    fontSize: 12,
    marginTop: 4,
  },
  statNumber: {
    color: '#FFFFFF',
    fontFamily: 'Montserrat-Bold',
    fontSize: 24,
  },
});

export default MissingPlayersView;
