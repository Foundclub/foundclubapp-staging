import { FlashList } from '@shopify/flash-list';
import { format, isSameDay, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet, Text, View,
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';

import { USER_ROLES } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { horizontalScale } from '@/theme/scaling';
import useTheme from '@/theme/themeContext';

import EventCard from '@/components/molecules/eventCard/EventCard';
import FeaturedReservationCard from '@/components/molecules/featuredReservationCard/FeaturedReservationCard';

// Configure locale for French
LocaleConfig.locales.fr = {
  dayNames: ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'],
  dayNamesShort: ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'],
  monthNames: [
    'Janvier',
    'Février',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juillet',
    'Août',
    'Septembre',
    'Octobre',
    'Novembre',
    'Décembre',
  ],
  monthNamesShort: ['Janv.', 'Févr.', 'Mars', 'Avril', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'],
  today: "Aujourd'hui",
};
LocaleConfig.defaultLocale = 'fr';

/**
 * @typedef {{
 *   id?: string | number;
 *   documentId?: string;
 *   date?: string;
 *   type?: { name?: string };
 * }} PlanningEvent
 */
/**
 * PlanningCalendarView component
 * @param {object} props
 * @param {PlanningEvent[]} [props.events] - List of events to display
 * @param {(event: PlanningEvent) => void} [props.onEventPress] - Callback when an event is pressed
 * @param {(event: PlanningEvent) => void} [props.onParticipate] - Callback for participation
 * @param {Date} [props.currentDate] - Current selected date (controlled)
 * @param {(date: Date) => void} [props.onDateSelect] - Callback when date changes
 * @returns {React.ReactElement} PlanningCalendarView component
 */
function PlanningCalendarView({
  currentDate: propDate,
  events = [],
  onDateSelect,
  onEventPress,
  onParticipate,
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { userData } = useAuth();

  // Use prop date if available, otherwise internal state (although parent should control it)
  const [internalDate, setInternalDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const selectedDate = useMemo(() => {
    if (propDate) return format(propDate, 'yyyy-MM-dd');
    return internalDate;
  }, [propDate, internalDate]);

  const handleDateChange = (/** @type {string} */ dateString) => {
    if (onDateSelect) {
      onDateSelect(parseISO(dateString));
    } else {
      setInternalDate(dateString);
    }
  };

  // Group events by date for the calendar markers
  const markedDates = useMemo(() => {
    const markers = /** @type {Record<string, any>} */ ({});

    // Mark today
    const today = format(new Date(), 'yyyy-MM-dd');
    markers[today] = {
      customStyles: {
        container: {
          borderColor: Colors.primary500,
          borderWidth: 1,
        },
        text: {
          color: Colors.neutral00,
          fontWeight: 'bold',
        },
      },
    };

    // Mark event days
    events.forEach((/** @type {PlanningEvent} */ event) => {
      if (!event.date) return;

      const dateStr = format(new Date(event.date), 'yyyy-MM-dd');

      // Don't overwrite today's custom style completely, just add the dot
      if (markers[dateStr]) {
        markers[dateStr] = {
          ...markers[dateStr],
          dotColor: Colors.primary500,
          marked: true,
        };
      } else {
        markers[dateStr] = {
          customStyles: {
            text: {
              color: Colors.neutral00,
            },
          },
          dotColor: Colors.primary500,
          marked: true,
        };
      }
    });

    // Mark selected date
    if (markers[selectedDate]) {
      markers[selectedDate] = {
        ...markers[selectedDate],
        selected: true,
        selectedColor: Colors.primary500,
        selectedTextColor: Colors.neutral00,
      };
    } else {
      markers[selectedDate] = {
        customStyles: {
          text: {
            color: Colors.neutral00,
            fontWeight: 'bold',
          },
        },
        selected: true,
        selectedColor: Colors.primary500,
        selectedTextColor: Colors.neutral00,
      };
    }

    return markers;
  }, [events, selectedDate, Colors]);

  // Filter events for the selected date
  const selectedEvents = useMemo(() => events.filter((/** @type {PlanningEvent} */ event) => {
    if (!event.date) return false;
    return isSameDay(new Date(event.date), parseISO(selectedDate));
  }), [events, selectedDate]);

  const renderItem = (/** @type {{ item: PlanningEvent }} */ { item }) => {
    const isReservation = item?.type?.name === 'Réservation';
    const isManager = userData?.role?.name === USER_ROLES.coach || userData?.role?.name === USER_ROLES.president;
    // Always allow seeing details/about in planning view
    const showAbout = true;

    if (isReservation) {
      return (
        <FeaturedReservationCard
          actionLabel={showAbout ? t('eventList.actions.about') : undefined}
          item={item}
          onParticipate={() => (showAbout ? onEventPress?.(item) : onParticipate?.(item))}
          onPress={() => onEventPress?.(item)}
          style={{ marginRight: 0, marginVertical: 12, width: '100%' }}
        />
      );
    }

    return (
      <EventCard
        item={item}
        onDecline={() => {}}
        onJoin={() => {}}
        onLogin={() => {}}
        onParticipate={() => onParticipate?.(item)}
        onPress={() => onEventPress?.(item)}
      />
    );
  };

  const renderEmptyList = () => (
    <View style={[
      ApplicationStyle.backgroundColor.primary900,
      ApplicationStyle.borderRadius16,
      Alignments.alignCenter,
      Spaces.gap[16],
      Spaces.padding[24],
      Spaces.marginVertical[24]]}
    >
      <Text style={[Fonts.p1Bold, Fonts.neutral00, Fonts.textCenter]}>
        {t('planning.noEventsForDate', 'Aucun évènement ce jour-là')}
      </Text>
    </View>
  );

  return (
    <View style={[Alignments.fill]}>
      <Calendar
        current={selectedDate}
        enableSwipeMonths
        firstDay={1} // Monday
        markedDates={markedDates}
        markingType="custom"
        onDayPress={(day) => handleDateChange(day.dateString)}
        onMonthChange={(month) => handleDateChange(month.dateString)}
        theme={{
          arrowColor: Colors.primary500,
          calendarBackground: 'transparent',
          dayTextColor: Colors.neutral00,
          dotColor: Colors.primary500,
          indicatorColor: Colors.primary500,
          monthTextColor: Colors.neutral00,
          selectedDayBackgroundColor: Colors.primary500,
          selectedDayTextColor: Colors.neutral00,
          selectedDotColor: Colors.neutral00,
          textDayFontFamily: 'Montserrat-Regular',
          textDayFontSize: 14,
          textDayHeaderFontFamily: 'Montserrat-Regular',
          textDayHeaderFontSize: 12,
          textDisabledColor: Colors.neutral600,
          textMonthFontFamily: 'Montserrat-Bold',
          textMonthFontSize: 16,
          textSectionTitleColor: Colors.neutral400,
          todayTextColor: Colors.primary500,
        }}
      />

      <View style={[Spaces.paddingHorizontal[24], Spaces.marginTop[24], Alignments.fill]}>
        <Text style={[Fonts.h3, Fonts.neutral00, Fonts.textCenter, Spaces.marginBottom[16]]}>
          {format(parseISO(selectedDate), 'EEEE d MMMM yyyy', { locale: fr })}
        </Text>

        <View style={[Alignments.fill]}>
          <FlashList
            contentContainerStyle={{ paddingBottom: 100 }}
            data={selectedEvents}
            estimatedItemSize={200}
            keyExtractor={(item, index) => item?.documentId || String(item?.id || index)}
            ListEmptyComponent={renderEmptyList}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>
    </View>
  );
}

export default PlanningCalendarView;
