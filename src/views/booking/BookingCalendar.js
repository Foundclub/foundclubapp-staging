import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { format, addDays, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';

import useTheme from '@/theme/themeContext';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { useGetFacility } from '@/services/facility/facilityQueries';
import { useGetFacilityAvailability } from '@/services/facility/facilityQueries';

import BookingConfigModal from '@/components/organisms/bookingConfigModal/BookingConfigModal';

/**
 * BookingCalendar - Smart Slots booking screen
 * Shows available time slots for a facility on a selected date
 */
function BookingCalendar({ route, navigation }) {
  const { facilityId } = route.params || {};
  const { t } = useTranslation();
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
    for (let i = 0; i < 14; i++) {
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
    if (slot.remaining > 0) {
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
        ]}>
          {format(date, 'EEE', { locale: fr })}
        </Text>
        <Text style={[
          styles.dateDay,
          isSelected && { color: Colors.primary500 },
        ]}>
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
    
    return (
      <Pressable
        key={slot.time}
        onPress={() => handleSlotPress(slot)}
        disabled={!isAvailable}
        style={[
          styles.slotChip,
          !isAvailable && styles.slotChipDisabled,
          { borderColor: isAvailable ? Colors.primary500 : 'rgba(255,255,255,0.1)' },
        ]}
      >
        <Text style={[
          styles.slotTime,
          !isAvailable && styles.slotTimeDisabled,
        ]}>
          {slot.time}
        </Text>
        {isAvailable ? (
          <Text style={[styles.slotRemaining, { color: Colors.success500 }]}>
            {slot.remaining} dispo
          </Text>
        ) : (
          <Text style={[styles.slotRemaining, styles.slotTimeDisabled]}>
            Complet
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

  return (
    <ScreenContainer bgImage="bg2" title={facilityData?.name || 'Réservation'}>
      <ScrollView 
        style={[Alignments.fill]}
        contentContainerStyle={[Spaces.padding[16]]}
        showsVerticalScrollIndicator={false}
      >
        {/* Facility Header */}
        <View style={[styles.header, Spaces.marginBottom[24]]}>
          <Text style={[Fonts.h2, Fonts.neutral00]}>
            {facilityData?.name}
          </Text>
          {facilityData?.activity?.name && (
            <Text style={[Fonts.p2, { color: Colors.primary500 }]}>
              {facilityData.activity.name} • {facilityData.pricePerSlot || 0}€/{facilityData.slotDuration || 30}min
            </Text>
          )}
        </View>

        {/* Date Selector */}
        <View style={Spaces.marginBottom[24]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00, Spaces.marginBottom[12]]}>
            Choisir une date
          </Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
          >
            {dateOptions.map(renderDateChip)}
          </ScrollView>
        </View>

        {/* Time Slots Grid */}
        <View>
          <Text style={[Fonts.p2Bold, Fonts.neutral00, Spaces.marginBottom[12]]}>
            Créneaux disponibles - {format(selectedDate, 'EEEE d MMMM', { locale: fr })}
          </Text>
          
          {availabilityLoading ? (
            <View style={[Alignments.alignCenter, Spaces.padding[32]]}>
              <ActivityIndicator color={Colors.primary500} size="large" />
            </View>
          ) : availability?.slots?.length > 0 ? (
            <View style={styles.slotsGrid}>
              {availability.slots.map(renderSlotChip)}
            </View>
          ) : (
            <View style={[styles.emptyState, { backgroundColor: 'rgba(255,255,255,0.05)' }]}>
              <Text style={[Fonts.p1, Fonts.neutral300, Fonts.textCenter]}>
                Aucun créneau disponible pour cette date
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Booking Modal */}
      <BookingConfigModal
        isVisible={isModalVisible}
        onClose={handleModalClose}
        onSuccess={handleBookingSuccess}
        facility={facilityData}
        date={dateString}
        selectedSlot={selectedSlot}
        availability={availability}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 4,
  },
  dateChip: {
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    minWidth: 60,
  },
  dateChipSelected: {
    backgroundColor: 'rgba(240, 85, 45, 0.15)',
  },
  dateDayName: {
    fontFamily: 'Montserrat-Medium',
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'capitalize',
  },
  dateDay: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 18,
    color: '#FFFFFF',
    marginTop: 2,
  },
  todayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  slotChip: {
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    minWidth: 80,
  },
  slotChipDisabled: {
    opacity: 0.5,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  slotTime: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  slotTimeDisabled: {
    color: 'rgba(255,255,255,0.4)',
  },
  slotRemaining: {
    fontFamily: 'Montserrat-Medium',
    fontSize: 11,
    marginTop: 4,
  },
  emptyState: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
  },
});

export default BookingCalendar;
