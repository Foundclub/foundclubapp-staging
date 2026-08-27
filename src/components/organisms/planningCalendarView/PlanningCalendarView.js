import { FlashList } from '@shopify/flash-list';
import {
  format,
  parseISO,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';

import useTheme from '@/theme/themeContext';

import MarqueeText from '@/components/atoms/marqueeText/MarqueeText';

import { resolveFacilityPlanningColor } from '@/utils/facilityPlanningColor';
import {
  getPlanningDefaultDate,
  getPlanningDisplayTitle,
  getPlanningItemDate,
  getPlanningTimeLabel,
  getPlanningTypeLabel,
  isPlanningPendingParticipation,
} from '@/utils/planning/planningSlots';

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
  monthNamesShort: [
    'Janv.',
    'Févr.',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juil.',
    'Août',
    'Sept.',
    'Oct.',
    'Nov.',
    'Déc.',
  ],
  today: "Aujourd'hui",
};
LocaleConfig.defaultLocale = 'fr';

const hexToRgba = (hex, alpha) => {
  if (!hex || typeof hex !== 'string' || !hex.startsWith('#') || hex.length !== 7) {
    return `rgba(1, 179, 244, ${alpha})`;
  }

  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

/**
 *
 * @param root0
 * @param root0.colors
 * @param root0.date
 * @param root0.eventsByDate
 * @param root0.fonts
 * @param root0.onPress
 * @param root0.selectedDate
 * @param root0.state
 * @param root0.todayKey
 */
function PlanningCalendarDay({
  colors,
  date,
  eventsByDate,
  fonts,
  onPress,
  selectedDate,
  state,
  todayKey,
}) {
  const dateString = date?.dateString;
  if (!dateString) return null;

  const dayEvents = eventsByDate.get(dateString) || [];
  const hasPendingEvent = dayEvents.some((event) => isPlanningPendingParticipation(event));
  const uniqueColors = [...new Set(
    dayEvents
      .map((event) => resolveFacilityPlanningColor(event?.facility) || colors.primary500)
      .filter(Boolean),
  )].slice(0, 3);
  const extraCount = Math.max(0, dayEvents.length - 3);
  const isSelected = dateString === selectedDate;
  const isCurrentDay = dateString === todayKey;
  const isDisabled = state === 'disabled';

  let dayColor = colors.neutral00;
  if (isSelected) {
    dayColor = colors.neutral00;
  } else if (isCurrentDay) {
    dayColor = colors.primary500;
  }

  return (
    <TouchableOpacity onPress={() => onPress(dateString)} style={styles.dayCellTouch}>
      <View
        style={[
          styles.dayCell,
          {
            backgroundColor: isSelected ? colors.primary500 : 'transparent',
            borderColor: isCurrentDay ? colors.primary500 : 'transparent',
            opacity: isDisabled ? 0.4 : 1,
          },
        ]}
      >
        <Text
          style={[
            fonts.p3Bold,
            {
              color: dayColor,
              fontSize: 13,
            },
          ]}
        >
          {date.day}
        </Text>

        {hasPendingEvent ? (
          <View style={[styles.pendingDayBadge, { backgroundColor: colors.warning500 || colors.gold500 || '#F5A623' }]}>
            <Text style={styles.pendingDayBadgeText}>!</Text>
          </View>
        ) : null}

        <View style={styles.dayMarkersRow}>
          {uniqueColors.map((color) => (
            <View
              key={`${dateString}-${color}`}
              style={[styles.dayMarker, { backgroundColor: color }]}
            />
          ))}
          {extraCount > 0 ? (
            <Text
              style={[
                fonts.p3Bold,
                {
                  color: isSelected ? colors.neutral00 : colors.primary500,
                  fontSize: 9,
                },
              ]}
            >
              +
              {extraCount}
            </Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

/**
 * Monthly planning view with colored day markers and a daily event list.
 * @param {{
 *   currentDate?: Date;
 *   events?: Array<any>;
 *   onDateSelect?: (date: Date) => void;
 *   onEventPress?: (event: any) => void;
 * }} props
 * @returns {import('react').ReactElement}
 */
function PlanningCalendarView({
  currentDate: propDate,
  events = [],
  onDateSelect,
  onEventPress,
}) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const [internalDate, setInternalDate] = useState(format(getPlanningDefaultDate(), 'yyyy-MM-dd'));

  const selectedDate = useMemo(() => {
    if (propDate) return format(propDate, 'yyyy-MM-dd');
    return internalDate;
  }, [internalDate, propDate]);

  const handleDateChange = useCallback((dateString) => {
    if (onDateSelect) {
      onDateSelect(parseISO(dateString));
      return;
    }

    setInternalDate(dateString);
  }, [onDateSelect]);

  const eventsByDate = useMemo(() => {
    const map = new Map();

    events.forEach((event) => {
      const eventDate = getPlanningItemDate(event);
      if (!eventDate) return;

      const key = format(eventDate, 'yyyy-MM-dd');
      const currentItems = map.get(key) || [];
      map.set(key, [...currentItems, event]);
    });

    return map;
  }, [events]);

  const selectedEvents = useMemo(
    () => eventsByDate.get(selectedDate) || [],
    [eventsByDate, selectedDate],
  );

  const renderPlanningListCard = useCallback(({ item }) => {
    const accentColor = resolveFacilityPlanningColor(item?.facility) || Colors.primary500;
    const typeLabel = getPlanningTypeLabel(item);
    const facilityName = item?.facility?.name || null;
    const isPendingParticipation = isPlanningPendingParticipation(item);
    const pendingAccentColor = Colors.warning500 || Colors.gold500 || '#F5A623';
    const timeLabel = getPlanningTimeLabel(item) || t('planning.labels.noTime', 'Sans horaire');

    return (
      <TouchableOpacity
        onPress={() => onEventPress?.(item)}
        style={[
          ApplicationStyle.backgroundColor.primary700,
          ApplicationStyle.borderRadius24,
          Spaces.marginBottom[12],
          Spaces.padding[16],
          {
            borderColor: hexToRgba(accentColor, 0.45),
            borderLeftColor: accentColor,
            borderLeftWidth: 4,
            borderWidth: 1,
          },
        ]}
      >
        <Text numberOfLines={2} style={[Fonts.p1Bold, Fonts.neutral00]}>
          {getPlanningDisplayTitle(item)}
        </Text>

        {isPendingParticipation ? (
          <View
            style={[
              styles.pendingStatusPill,
              {
                backgroundColor: hexToRgba(pendingAccentColor, 0.16),
                borderColor: hexToRgba(pendingAccentColor, 0.4),
              },
            ]}
          >
            <Text style={[Fonts.p4Bold, { color: pendingAccentColor }]}>
              {t('planning.status.pendingParticipation', 'Demande en attente')}
            </Text>
          </View>
        ) : null}

        {typeLabel ? (
          <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300, marginTop: 6 }]}>
            {typeLabel}
          </Text>
        ) : null}

        {facilityName ? (
          <MarqueeText
            containerStyle={{ marginTop: 6 }}
            style={[Fonts.p3Bold, { color: accentColor }]}
            text={facilityName}
          />
        ) : null}

        <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300, marginTop: 6 }]}>
          {timeLabel}
        </Text>
      </TouchableOpacity>
    );
  }, [
    ApplicationStyle.backgroundColor.primary700,
    ApplicationStyle.borderRadius24,
    Colors.neutral300,
    Colors.gold500,
    Colors.primary500,
    Colors.warning500,
    Fonts.neutral00,
    Fonts.p1Bold,
    Fonts.p3,
    Fonts.p3Bold,
    Fonts.p4Bold,
    Spaces.marginBottom,
    Spaces.padding,
    onEventPress,
    t,
  ]);

  const renderEmptyList = useCallback(() => (
    <View
      style={[
        ApplicationStyle.backgroundColor.primary900,
        ApplicationStyle.borderRadius16,
        Alignments.alignCenter,
        Spaces.padding[24],
        Spaces.marginVertical[24],
      ]}
    >
      <Text style={[Fonts.p1Bold, Fonts.neutral00, Fonts.textCenter]}>
        {t('planning.noEventsForDate', 'Aucun événement ce jour-là')}
      </Text>
    </View>
  ), [
    Alignments.alignCenter,
    ApplicationStyle.backgroundColor.primary900,
    ApplicationStyle.borderRadius16,
    Fonts.neutral00,
    Fonts.p1Bold,
    Fonts.textCenter,
    Spaces.marginVertical,
    Spaces.padding,
    t,
  ]);

  const todayKey = format(getPlanningDefaultDate(), 'yyyy-MM-dd');

  const renderDayComponent = useCallback(({ date, state }) => (
    <PlanningCalendarDay
      colors={Colors}
      date={date}
      eventsByDate={eventsByDate}
      fonts={Fonts}
      onPress={handleDateChange}
      selectedDate={selectedDate}
      state={state}
      todayKey={todayKey}
    />
  ), [Colors, Fonts, eventsByDate, handleDateChange, selectedDate, todayKey]);

  return (
    <View style={Alignments.fill}>
      <View style={[Spaces.paddingHorizontal[24], Spaces.marginBottom[12], Alignments.alignEnd]}>
        <TouchableOpacity
          onPress={() => handleDateChange(todayKey)}
          style={[
            ApplicationStyle.borderRadius16,
            Spaces.paddingHorizontal[12],
            Spaces.paddingVertical[8],
            {
              backgroundColor: ApplicationStyle.backgroundColor.primary700.backgroundColor,
              borderColor: Colors.primary500,
              borderWidth: 1,
            },
          ]}
        >
          <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
            {t('planning.actions.today', "Aujourd'hui")}
          </Text>
        </TouchableOpacity>
      </View>

      <Calendar
        current={selectedDate}
        dayComponent={renderDayComponent}
        enableSwipeMonths
        firstDay={1}
        markingType="custom"
        onDayPress={(day) => handleDateChange(day.dateString)}
        onMonthChange={(month) => handleDateChange(month.dateString)}
        theme={{
          arrowColor: Colors.primary500,
          calendarBackground: 'transparent',
          dayTextColor: Colors.neutral00,
          indicatorColor: Colors.primary500,
          monthTextColor: Colors.neutral00,
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

        <View style={Alignments.fill}>
          <FlashList
            contentContainerStyle={{ paddingBottom: 100 }}
            data={selectedEvents}
            keyExtractor={(item, index) => item?.documentId || String(item?.id || index)}
            ListEmptyComponent={renderEmptyList}
            renderItem={renderPlanningListCard}
            showsVerticalScrollIndicator={false}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dayCell: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 38,
    paddingHorizontal: 2,
    paddingTop: 4,
  },
  dayCellTouch: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 32,
  },
  dayMarker: {
    borderRadius: 999,
    height: 4,
    marginHorizontal: 1.5,
    width: 4,
  },
  dayMarkersRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginTop: 3,
    minHeight: 10,
  },
  pendingDayBadge: {
    alignItems: 'center',
    borderRadius: 999,
    height: 12,
    justifyContent: 'center',
    position: 'absolute',
    right: -2,
    top: 0,
    width: 12,
  },
  pendingDayBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
    lineHeight: 8,
  },
  pendingStatusPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});

export default PlanningCalendarView;
