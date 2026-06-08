import { addDays, format, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import BookingConfigModal from '@/components/organisms/bookingConfigModal/BookingConfigModal';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { useGetFacility, useGetFacilityAvailability } from '@/services/facility/facilityQueries';

/**
 * BookingCalendar - Smart Slots booking screen
 * Shows available time slots for a facility on a selected date
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function BookingCalendar({ navigation, route }) {
  const { facilityId } = route.params || {};
  const {
    Alignments,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();

  // State
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Format date for API
  const dateString = format(selectedDate, 'yyyy-MM-dd');

  // Queries
  const { data: facility, isLoading: facilityLoading } = useGetFacility(facilityId);
  const {
    data: availability,
    isLoading: availabilityLoading,
    refetch: refetchAvailability,
  } = useGetFacilityAvailability(facilityId, dateString);

  // Generate date options (next 14 days)
  const dateOptions = useMemo(() => {
    const dates = [];
    for (let i = 0; i < 14; i += 1) {
      dates.push(addDays(startOfDay(new Date()), i));
    }
    return dates;
  }, []);

  // Handlers
  const handleDateSelect = useCallback((date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  }, []);

  const handleSlotPress = useCallback((slot) => {
    if (slot.remaining > 0 || slot.requiresApproval || slot.allowsImmediateConfirmation) {
      setSelectedSlot(slot);
      setIsModalVisible(true);
    }
  }, []);

  const handleModalClose = useCallback(() => {
    setIsModalVisible(false);
    setSelectedSlot(null);
    refetchAvailability();
  }, [refetchAvailability]);

  const handleBookingSuccess = useCallback(() => {
    handleModalClose();
    navigation.goBack();
  }, [handleModalClose, navigation]);

  // Render date chip
  const renderDateChip = (date) => {
    const isSelected = format(date, 'yyyy-MM-dd') === dateString;
    const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

    return (
      <Pressable
        key={date.toISOString()}
        onPress={() => handleDateSelect(date)}
        style={[
          styles.dateChip,
          isSelected && styles.dateChipSelected,
          { borderColor: isSelected ? Colors.primary500 : 'rgba(255,255,255,0.2)' },
        ]}
      >
        <Text style={[
          styles.dateDayName,
          isSelected && { color: Colors.primary500 },
        ]}
        >
          {format(date, 'EEE', { locale: fr })}
        </Text>
        <Text style={[
          styles.dateDay,
          isSelected && { color: Colors.primary500 },
        ]}
        >
          {format(date, 'd')}
        </Text>
        {isToday && (
          <View style={[styles.todayDot, { backgroundColor: Colors.primary500 }]} />
        )}
      </Pressable>
    );
  };

  // Render time slot chip
  const renderSlotChip = (slot) => {
    const isAvailable = slot.remaining > 0;
    const requiresApproval = Boolean(slot.requiresApproval);
    const allowsImmediateConfirmation = Boolean(slot.allowsImmediateConfirmation);
    const canOpenSlot = isAvailable || requiresApproval || allowsImmediateConfirmation;
    let borderColor = 'rgba(255,255,255,0.1)';
    let availabilityLabel = 'Complet';

    if (isAvailable) {
      borderColor = Colors.primary500;
      availabilityLabel = `${slot.remaining} dispo`;
    } else if (requiresApproval) {
      borderColor = Colors.warning500;
      availabilityLabel = 'Demande en attente';
    } else if (allowsImmediateConfirmation) {
      borderColor = Colors.primary500;
      availabilityLabel = 'Autorise et notifier';
    }

    return (
      <Pressable
        disabled={!canOpenSlot}
        key={slot.time}
        onPress={() => handleSlotPress(slot)}
        style={[
          styles.slotChip,
          !canOpenSlot && styles.slotChipDisabled,
          {
            borderColor,
          },
        ]}
      >
        <Text style={[
          styles.slotTime,
          !canOpenSlot && styles.slotTimeDisabled,
        ]}
        >
          {slot.time}
        </Text>
        {isAvailable ? (
          <Text style={[styles.slotRemaining, { color: Colors.success500 }]}>
            {availabilityLabel}
          </Text>
        ) : (
          <Text style={[styles.slotRemaining, styles.slotTimeDisabled]}>
            {availabilityLabel}
          </Text>
        )}
      </Pressable>
    );
  };

  // Loading state
  if (facilityLoading) {
    return (
      <ScreenContainer bgImage="bg2" title="Réservation">
        <View style={[Alignments.fill, Alignments.alignCenter, Alignments.justifyCenter]}>
          <ActivityIndicator color={Colors.primary500} size="large" />
        </View>
      </ScreenContainer>
    );
  }

  const facilityData = facility?.data || facility;
  let slotsContent = (
    <View style={[styles.emptyState, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
      <Text style={[Fonts.p1, Fonts.neutral300, Fonts.textCenter]}>
        Aucun créneau disponible pour cette date
      </Text>
    </View>
  );

  if (availabilityLoading) {
    slotsContent = (
      <View style={[Alignments.alignCenter, Spaces.padding[32]]}>
        <ActivityIndicator color={Colors.primary500} size="large" />
      </View>
    );
  } else if (availability?.slots?.length > 0) {
    slotsContent = (
      <View style={styles.slotsGrid}>
        {availability.slots.map(renderSlotChip)}
      </View>
    );
  }

  return (
    <ScreenContainer bgImage="bg2" title={facilityData?.name || 'Réservation'}>
      <ScrollView
        contentContainerStyle={[Spaces.padding[16]]}
        showsVerticalScrollIndicator={false}
        style={[Alignments.fill]}
      >
        {/* Facility Header */}
        <View style={[styles.header, Spaces.marginBottom[24]]}>
          <Text style={[Fonts.h2, Fonts.neutral00]}>
            {facilityData?.name}
          </Text>
          {facilityData?.activity?.name && (
            <Text style={[Fonts.p2, { color: Colors.primary500 }]}>
              {facilityData.activity.name}
              {' '}
              •
              {facilityData.pricePerSlot || 0}
              €/
              {facilityData.slotDuration || 30}
              min
            </Text>
          )}
        </View>

        {/* Date Selector */}
        <View style={Spaces.marginBottom[24]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00, Spaces.marginBottom[12]]}>
            Choisir une date
          </Text>
          <ScrollView
            contentContainerStyle={{ gap: 8 }}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {dateOptions.map(renderDateChip)}
          </ScrollView>
        </View>

        {/* Time Slots Grid */}
        <View>
          <Text style={[Fonts.p2Bold, Fonts.neutral00, Spaces.marginBottom[12]]}>
            Créneaux disponibles -
            {' '}
            {format(selectedDate, 'EEEE d MMMM', { locale: fr })}
          </Text>

          {slotsContent}
        </View>
      </ScrollView>

      {/* Booking Modal */}
      <BookingConfigModal
        availability={availability}
        date={dateString}
        facility={facilityData}
        isVisible={isModalVisible}
        onClose={handleModalClose}
        onSuccess={handleBookingSuccess}
        selectedSlot={selectedSlot}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  dateChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 60,
    padding: 12,
    paddingHorizontal: 16,
  },
  dateChipSelected: {
    backgroundColor: 'rgba(240, 85, 45, 0.15)',
  },
  dateDay: {
    color: '#FFFFFF',
    fontFamily: 'Montserrat-Bold',
    fontSize: 18,
    marginTop: 2,
  },
  dateDayName: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Montserrat-Medium',
    fontSize: 12,
    textTransform: 'capitalize',
  },
  emptyState: {
    alignItems: 'center',
    borderRadius: 16,
    padding: 32,
  },
  header: {
    gap: 4,
  },
  slotChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 80,
    padding: 12,
    paddingHorizontal: 16,
  },
  slotChipDisabled: {
    backgroundColor: 'rgba(255,255,255,0.02)',
    opacity: 0.5,
  },
  slotRemaining: {
    fontFamily: 'Montserrat-Medium',
    fontSize: 11,
    marginTop: 4,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  slotTime: {
    color: '#FFFFFF',
    fontFamily: 'Montserrat-Bold',
    fontSize: 16,
  },
  slotTimeDisabled: {
    color: 'rgba(255,255,255,0.4)',
  },
  todayDot: {
    borderRadius: 3,
    height: 6,
    marginTop: 4,
    width: 6,
  },
});

export default BookingCalendar;
