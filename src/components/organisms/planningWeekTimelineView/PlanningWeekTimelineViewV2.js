import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  format,
  isSameDay,
  isWithinInterval,
  startOfDay,
  startOfWeek,
  subDays,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  useEffect, useMemo, useRef, useState,
} from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Directions, Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { images as Images } from '@/theme/images';
import useTheme from '@/theme/themeContext';

import { resolveFacilityPlanningColor } from '@/utils/facilityPlanningColor';
import {
  getPlanningDisplayTitle,
  getPlanningItemDate,
  getPlanningItemSecondaryLabel,
  getPlanningTypeLabel,
} from '@/utils/planning/planningSlots';

const HOUR_HEIGHT = 60;
const COLLAPSED_HEIGHT = 18;
const MIN_EVENT_HEIGHT = 28;
const TIME_COLUMN_WIDTH = 56;
const PALETTE = ['#FF4D4D', '#4D79FF', '#FFB34D', '#4DFFB3', '#9D4DFF', '#FF4D94'];

const hexToRgba = (hex, alpha) => {
  if (!hex || !hex.startsWith('#') || hex.length !== 7) {
    return `rgba(1, 179, 244, ${alpha})`;
  }

  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const getDayKey = (day) => format(day, 'yyyy-MM-dd');
const formatClock = (value) => String(value || '').split(':').slice(0, 2).join(':');

const extractTime = (event) => {
  const startParts = String(event?.startTime || '').split(':');
  const endParts = String(event?.endTime || '').split(':');
  return {
    endHour: Number.parseInt(endParts[0] || '0', 10) || 0,
    endMinute: Number.parseInt(endParts[1] || '0', 10) || 0,
    startHour: Number.parseInt(startParts[0] || '0', 10) || 0,
    startMinute: Number.parseInt(startParts[1] || '0', 10) || 0,
  };
};

const getEventColor = (event, fallbackColor) => {
  const facilityColor = resolveFacilityPlanningColor(event?.facility);
  if (facilityColor) return facilityColor;

  const typeLabel = getPlanningTypeLabel(event)
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (typeLabel?.includes('match')) return '#FF4D4D';
  if (typeLabel?.includes('reservation') || typeLabel?.includes('reunion')) return '#FFB34D';
  if (typeLabel?.includes('entrainement')) return '#4D79FF';

  const seed = event?.team?.name || getPlanningDisplayTitle(event) || 'planning';
  const hash = Array.from(seed).reduce(
    (value, character) => value * 31 + character.charCodeAt(0),
    11,
  );

  return PALETTE[Math.abs(hash) % PALETTE.length] || fallbackColor;
};

const getPrimaryPlanningLabel = (event) => (
  getPlanningTypeLabel(event)
  || getPlanningDisplayTitle(event)
  || 'Événement'
);

const getPlanningContextLabel = (event) => {
  const primaryLabel = getPrimaryPlanningLabel(event);
  const secondaryLabel = getPlanningItemSecondaryLabel(event);
  const titleLabel = getPlanningDisplayTitle(event);

  if (secondaryLabel && secondaryLabel !== primaryLabel) {
    return secondaryLabel;
  }

  if (titleLabel && titleLabel !== primaryLabel) {
    return titleLabel;
  }

  return null;
};

/**
 *
 * @param root0
 * @param root0.currentDate
 * @param root0.events
 * @param root0.mode
 * @param root0.onDateChange
 * @param root0.onEventPress
 * @param root0.onSummaryPress
 * @param root0.scrollEnabled
 */
function PlanningWeekTimelineView({
  currentDate: propDate,
  events = [],
  mode = '3days',
  onDateChange,
  onEventPress,
  onSummaryPress,
  scrollEnabled = true,
}) {
  const { Colors, Fonts } = useTheme();
  const [internalDate, setInternalDate] = useState(new Date());
  const currentDate = propDate || internalDate;
  const scrollViewRef = useRef(null);

  const weekDays = useMemo(() => {
    if (mode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, index) => addDays(start, index));
    }

    return [currentDate, addDays(currentDate, 1), addDays(currentDate, 2)];
  }, [currentDate, mode]);

  const weekEvents = useMemo(() => {
    if (!events.length) return [];

    const start = startOfDay(weekDays[0]);
    const end = endOfDay(weekDays[weekDays.length - 1]);
    return events.filter((event) => {
      const eventDate = getPlanningItemDate(event);
      return eventDate ? isWithinInterval(eventDate, { end, start }) : false;
    });
  }, [events, weekDays]);

  const untimedEvents = useMemo(
    () => weekEvents.filter((event) => !event?.hasExplicitTime),
    [weekEvents],
  );
  const timedEvents = useMemo(
    () => weekEvents.filter((event) => event?.hasExplicitTime),
    [weekEvents],
  );

  const displayStartHour = useMemo(() => {
    if (!timedEvents.length) return 8;
    return timedEvents.reduce((hour, event) => Math.min(hour, extractTime(event).startHour), 23);
  }, [timedEvents]);

  const activeHours = useMemo(() => {
    const values = new Set();

    timedEvents.forEach((event) => {
      const { endHour, endMinute, startHour } = extractTime(event);
      if (endHour < startHour) {
        for (let hour = startHour; hour <= 23; hour += 1) values.add(hour);
        const inclusiveEnd = endMinute > 0 ? endHour : endHour - 1;
        for (let hour = 0; hour <= inclusiveEnd; hour += 1) values.add(hour);
        return;
      }

      const inclusiveEnd = endMinute > 0 ? endHour : endHour - 1;
      for (let hour = startHour; hour <= inclusiveEnd; hour += 1) values.add(hour);
    });

    return values;
  }, [timedEvents]);

  const timelineBlocks = useMemo(() => {
    const blocks = [];
    let emptyStart = null;

    for (let hour = displayStartHour; hour <= 23; hour += 1) {
      if (activeHours.has(hour)) {
        if (emptyStart !== null) {
          blocks.push({
            end: hour - 1, id: `collapsed-${emptyStart}`, start: emptyStart, type: 'collapsed',
          });
          emptyStart = null;
        }
        blocks.push({ type: 'hour', value: hour });
      } else if (emptyStart === null) {
        emptyStart = hour;
      }
    }

    if (emptyStart !== null) {
      blocks.push({
        end: 23, id: `collapsed-${emptyStart}-23`, start: emptyStart, type: 'collapsed',
      });
    }

    return blocks;
  }, [activeHours, displayStartHour]);

  const { hourPositions, totalHeight } = useMemo(() => {
    const positions = {};
    let y = 0;

    timelineBlocks.forEach((block) => {
      if (block.type === 'hour') {
        positions[block.value] = y;
        y += HOUR_HEIGHT;
        return;
      }

      for (let hour = block.start; hour <= block.end; hour += 1) {
        positions[hour] = y;
      }
      y += COLLAPSED_HEIGHT;
    });

    return { hourPositions: positions, totalHeight: y };
  }, [timelineBlocks]);

  useEffect(() => {
    if (!scrollViewRef.current || hourPositions[displayStartHour] === undefined) return undefined;

    const timer = setTimeout(() => {
      scrollViewRef.current?.scrollTo({ animated: true, y: Math.max(0, hourPositions[displayStartHour] - 12) });
    }, 100);

    return () => clearTimeout(timer);
  }, [displayStartHour, hourPositions, weekDays]);

  const layoutEvents = useMemo(() => {
    const overflowLimit = mode === 'week' ? 2 : 3;
    const byDay = weekDays.map(() => []);

    timedEvents.forEach((event) => {
      const date = getPlanningItemDate(event);
      if (!date) return;

      const dayIndex = differenceInCalendarDays(date, weekDays[0]);
      if (dayIndex < 0 || dayIndex >= weekDays.length) return;

      const {
        endHour,
        endMinute,
        startHour,
        startMinute,
      } = extractTime(event);

      const startBase = hourPositions[startHour] ?? 0;
      const endBase = hourPositions[endHour] ?? totalHeight;
      const top = startBase + (
        activeHours.has(startHour) ? (startMinute / 60) * HOUR_HEIGHT : (startMinute / 60) * COLLAPSED_HEIGHT
      );

      let bottom = totalHeight;
      if (endHour >= startHour) {
        bottom = endBase + (
          activeHours.has(endHour) ? (endMinute / 60) * HOUR_HEIGHT : (endMinute / 60) * COLLAPSED_HEIGHT
        );
      }

      const positionedEvent = {
        ...event,
        bottom: Math.max(top + MIN_EVENT_HEIGHT, bottom),
        color: getEventColor(event, Colors.primary500),
        dayIndex,
        top,
      };

      byDay[dayIndex].push(positionedEvent);
    });

    return byDay.flatMap((dayEvents, dayIndex) => {
      const sortedEvents = dayEvents.sort((left, right) => {
        if (left.top === right.top) return left.bottom - right.bottom;
        return left.top - right.top;
      });

      const clusters = [];
      sortedEvents.forEach((event) => {
        const currentCluster = clusters[clusters.length - 1];
        if (currentCluster && event.top < currentCluster.end) {
          currentCluster.end = Math.max(currentCluster.end, event.bottom);
          currentCluster.events.push(event);
        } else {
          clusters.push({ end: event.bottom, events: [event], start: event.top });
        }
      });

      return clusters.flatMap((cluster) => {
        const columns = [];
        const laidOutEvents = [];

        cluster.events.forEach((event) => {
          let columnIndex = columns.findIndex((column) => (column[column.length - 1]?.bottom || 0) <= event.top);
          if (columnIndex === -1) {
            columnIndex = columns.length;
            columns.push([]);
          }

          const nextEvent = { ...event, colIndex: columnIndex };
          columns[columnIndex].push(nextEvent);
          laidOutEvents.push(nextEvent);
        });

        const hiddenEvents = laidOutEvents.filter((event) => event.colIndex >= overflowLimit);
        const visibleEvents = laidOutEvents.filter((event) => event.colIndex < overflowLimit);
        const columnsToRender = hiddenEvents.length > 0 ? overflowLimit + 1 : Math.max(columns.length, 1);

        const visibleLayout = visibleEvents.map((event) => ({
          ...event,
          displayType: 'event',
          height: event.bottom - event.top,
          leftPercent: event.colIndex * (100 / columnsToRender),
          widthPercent: 100 / columnsToRender,
        }));

        if (!hiddenEvents.length) {
          return visibleLayout;
        }

        return [
          ...visibleLayout,
          {
            count: hiddenEvents.length,
            dayDate: weekDays[dayIndex],
            dayIndex,
            displayType: 'overflow',
            height: Math.max(cluster.end - cluster.start, MIN_EVENT_HEIGHT),
            key: `overflow-${getDayKey(weekDays[dayIndex])}-${Math.round(cluster.start)}`,
            leftPercent: overflowLimit * (100 / columnsToRender),
            top: cluster.start,
            widthPercent: 100 / columnsToRender,
          },
        ];
      });
    });
  }, [Colors.primary500, activeHours, hourPositions, mode, timedEvents, totalHeight, weekDays]);

  const untimedByDay = useMemo(() => weekDays.map((day) => (
    untimedEvents.filter((event) => {
      const eventDate = getPlanningItemDate(event);
      return eventDate ? isSameDay(eventDate, day) : false;
    })
  )), [untimedEvents, weekDays]);

  const dayEventCounts = useMemo(() => {
    const counts = new Map();
    weekDays.forEach((day) => counts.set(getDayKey(day), 0));

    weekEvents.forEach((event) => {
      const eventDate = getPlanningItemDate(event);
      if (!eventDate) return;
      const key = getDayKey(eventDate);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return counts;
  }, [weekDays, weekEvents]);

  const dateRangeText = useMemo(() => {
    const start = format(weekDays[0], 'd MMM', { locale: fr });
    const end = format(weekDays[weekDays.length - 1], 'd MMM yyyy', { locale: fr });
    return `${start} - ${end}`;
  }, [weekDays]);

  const summaryText = useMemo(() => {
    if (weekEvents.length === 0) {
      return mode === 'week'
        ? 'Aucun événement sur cette semaine'
        : 'Aucun événement sur ces 3 jours';
    }

    const label = weekEvents.length > 1 ? 'événements' : 'événement';
    return `${weekEvents.length} ${label} sur ${weekDays.length} jours`;
  }, [mode, weekDays.length, weekEvents.length]);

  const nowLine = useMemo(() => {
    if (!timedEvents.length) return null;

    const todayIndex = weekDays.findIndex((day) => isSameDay(day, new Date()));
    if (todayIndex === -1) return null;

    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const base = hourPositions[hour];
    if (base === undefined) return null;

    return {
      dayIndex: todayIndex,
      top: base + (activeHours.has(hour) ? (minute / 60) * HOUR_HEIGHT : (minute / 60) * COLLAPSED_HEIGHT),
    };
  }, [activeHours, hourPositions, timedEvents.length, weekDays]);

  const handleDateUpdate = (nextDate) => {
    if (onDateChange) {
      onDateChange(nextDate);
      return;
    }

    setInternalDate(nextDate);
  };

  const handlePrevPage = () => handleDateUpdate(subDays(currentDate, mode === 'week' ? 7 : 3));
  const handleNextPage = () => handleDateUpdate(addDays(currentDate, mode === 'week' ? 7 : 3));
  const handleOverflowPress = (date) => {
    handleDateUpdate(date);
    onSummaryPress?.();
  };

  const flingLeft = Gesture.Fling().direction(Directions.LEFT).onEnd(() => {
    'worklet';

    runOnJS(handleNextPage)();
  });

  const flingRight = Gesture.Fling().direction(Directions.RIGHT).onEnd(() => {
    'worklet';

    runOnJS(handlePrevPage)();
  });

  const emptyTitle = weekEvents.length === 0
    ? 'Aucun événement sur cette période'
    : 'Aucun événement avec horaire';
  const emptyDescription = weekEvents.length === 0
    ? "Changez de période pour voir d'autres créneaux."
    : 'Les événements de cette période sont uniquement dans la section « Sans horaire ».';

  return (
    <GestureDetector gesture={Gesture.Simultaneous(flingLeft, flingRight)}>
      <View style={styles.container}>
        <View style={styles.headerSpacing}>
          <View style={[styles.headerCard, { backgroundColor: Colors.primary700, borderColor: `${Colors.primary500}33` }]}>
            <TouchableOpacity hitSlop={styles.hitSlop} onPress={handlePrevPage}>
              <Image resizeMode="contain" source={Images.arrowLeft} style={[styles.headerArrow, { tintColor: Colors.primary500 }]} />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <Text style={[styles.headerTitle, { color: Colors.primary200 }]}>Planning</Text>
              <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>{dateRangeText}</Text>
            </View>

            <TouchableOpacity hitSlop={styles.hitSlop} onPress={handleNextPage}>
              <Image resizeMode="contain" source={Images.arrowRight} style={[styles.headerArrow, { tintColor: Colors.primary500 }]} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.panel, { backgroundColor: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.10)' }]}>
          {onSummaryPress ? (
            <TouchableOpacity activeOpacity={0.75} onPress={onSummaryPress} style={styles.summaryRow}>
              <View style={[styles.summaryDot, { backgroundColor: Colors.primary500 }]} />
              <Text style={[Fonts.p3, styles.summaryText, { color: Colors.neutral00 }]}>{summaryText}</Text>
              <Image resizeMode="contain" source={Images.arrowRight} style={styles.summaryArrow} />
            </TouchableOpacity>
          ) : (
            <View style={styles.summaryRow}>
              <View style={[styles.summaryDot, { backgroundColor: Colors.primary500 }]} />
              <Text style={[Fonts.p3, styles.summaryText, { color: Colors.neutral00 }]}>{summaryText}</Text>
            </View>
          )}

          <View style={[styles.daysRow, { borderBottomColor: 'rgba(255,255,255,0.12)' }]}>
            <View style={{ width: TIME_COLUMN_WIDTH }} />
            {weekDays.map((day) => {
              const dayKey = getDayKey(day);
              const isTodayColumn = isSameDay(day, new Date());
              const eventCount = dayEventCounts.get(dayKey) || 0;
              let badgeBackground = 'transparent';

              if (isTodayColumn) {
                badgeBackground = Colors.primary500;
              } else if (eventCount > 0) {
                badgeBackground = Colors.neutral800;
              }

              return (
                <View key={dayKey} style={styles.dayColumnHeader}>
                  <Text style={[Fonts.p3, styles.dayLabel, { color: isTodayColumn ? Colors.primary500 : Colors.neutral300, fontWeight: isTodayColumn ? '700' : '400' }]}>
                    {format(day, 'EEE', { locale: fr }).replace('.', '')}
                  </Text>
                  <View style={styles.dayBadgeWrapper}>
                    <View style={[styles.dayBadge, { backgroundColor: badgeBackground }]}>
                      <Text style={[Fonts.h3, styles.dayBadgeText, { color: Colors.neutral00 }]}>{format(day, 'd')}</Text>
                      {eventCount > 0 && !isTodayColumn ? (
                        <View style={[styles.dayCountBadge, { backgroundColor: Colors.primary500, borderColor: Colors.neutral700 }]}>
                          <Text style={styles.dayCountText}>{eventCount}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>

          {untimedEvents.length > 0 ? (
            <View style={[styles.untimedSection, { borderBottomColor: 'rgba(255,255,255,0.10)' }]}>
              <View style={styles.untimedLabelColumn}>
                <Text style={[Fonts.p3Bold, styles.untimedLabel, { color: Colors.neutral200 }]}>Sans horaire</Text>
              </View>
              <View style={styles.untimedColumns}>
                {untimedByDay.map((dayEvents, index) => (
                  <View key={getDayKey(weekDays[index])} style={styles.untimedDayColumn}>
                    {dayEvents.slice(0, 2).map((event) => {
                      const color = getEventColor(event, Colors.primary500);
                      const primaryLabel = getPrimaryPlanningLabel(event);
                      const contextLabel = getPlanningContextLabel(event);
                      return (
                        <TouchableOpacity
                          key={event.documentId || `${getDayKey(weekDays[index])}-${getPlanningDisplayTitle(event)}`}
                          onPress={() => onEventPress?.(event)}
                          style={[styles.untimedCard, { backgroundColor: hexToRgba(color, 0.18), borderColor: hexToRgba(color, 0.32), borderLeftColor: color }]}
                        >
                          <Text
                            numberOfLines={1}
                            style={[Fonts.p4Bold, {
                              color,
                              fontSize: 10,
                              letterSpacing: 0.35,
                              marginBottom: contextLabel ? 2 : 0,
                              textTransform: getPlanningTypeLabel(event) ? 'uppercase' : 'none',
                            }]}
                          >
                            {primaryLabel}
                          </Text>
                          {contextLabel ? (
                            <Text numberOfLines={2} style={[Fonts.p3Bold, styles.untimedCardText, { color: Colors.neutral00 }]}>
                              {contextLabel}
                            </Text>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                    {dayEvents.length > 2 ? (
                      <TouchableOpacity onPress={() => handleOverflowPress(weekDays[index])} style={styles.untimedMoreButton}>
                        <Text style={[Fonts.p3Bold, { color: Colors.primary500, fontSize: 11 }]}>
                          +
                          {dayEvents.length - 2}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {timedEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginBottom: 6 }]}>{emptyTitle}</Text>
              <Text style={[Fonts.p3, { color: Colors.neutral300, textAlign: 'center' }]}>{emptyDescription}</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.scrollContent} ref={scrollViewRef} scrollEnabled={scrollEnabled} showsVerticalScrollIndicator={false}>
              <View style={styles.timelineRow}>
                <View style={{ width: TIME_COLUMN_WIDTH }}>
                  {timelineBlocks.map((block) => (
                    <View key={block.type === 'hour' ? `hour-${block.value}` : block.id} style={[styles.timeCell, { height: block.type === 'hour' ? HOUR_HEIGHT : COLLAPSED_HEIGHT }]}>
                      {block.type === 'hour' ? (
                        <Text style={[Fonts.p3, styles.hourText, { color: Colors.neutral300 }]}>{`${block.value}:00`}</Text>
                      ) : (
                        <Text style={styles.collapsedText}>ââ‚¬¦</Text>
                      )}
                    </View>
                  ))}
                </View>

                <View style={[styles.gridContainer, { borderRightColor: 'rgba(255,255,255,0.10)', borderTopColor: 'rgba(255,255,255,0.10)' }]}>
                  <View style={[StyleSheet.absoluteFillObject, styles.dayBackgroundRow]}>
                    {weekDays.map((day) => (
                      <View
                        key={`bg-${getDayKey(day)}`}
                        style={[styles.dayBackgroundColumn, {
                          backgroundColor: isSameDay(day, new Date()) ? hexToRgba(Colors.primary500, 0.05) : 'transparent',
                          borderLeftColor: 'rgba(255,255,255,0.10)',
                        }]}
                      />
                    ))}
                  </View>

                  {timelineBlocks.map((block) => (
                    <View
                      key={`grid-${block.type === 'hour' ? block.value : block.id}`}
                      style={[styles.gridLine, {
                        backgroundColor: block.type === 'collapsed' ? 'rgba(255,255,255,0.05)' : 'transparent',
                        borderBottomColor: 'rgba(255,255,255,0.10)',
                        height: block.type === 'hour' ? HOUR_HEIGHT : COLLAPSED_HEIGHT,
                      }]}
                    />
                  ))}

                  {nowLine ? (
                    <View style={[styles.nowLineContainer, { left: `${(nowLine.dayIndex * 100) / weekDays.length}%`, top: nowLine.top, width: `${100 / weekDays.length}%` }]}>
                      <View style={styles.nowLineTrack}>
                        <View style={[styles.nowDot, { backgroundColor: Colors.primary500 }]} />
                        <View style={[styles.nowLine, { backgroundColor: Colors.primary500 }]} />
                      </View>
                    </View>
                  ) : null}

                  {layoutEvents.map((event) => {
                    const dayWidth = 100 / weekDays.length;
                    const left = (event.dayIndex * dayWidth) + ((event.leftPercent || 0) * (dayWidth / 100));
                    const width = (event.widthPercent || 100) * (dayWidth / 100);

                    if (event.displayType === 'overflow') {
                      return (
                        <TouchableOpacity
                          key={event.key}
                          onPress={() => handleOverflowPress(event.dayDate)}
                          style={[styles.overflowCard, {
                            borderColor: 'rgba(255,255,255,0.12)', height: Math.max(event.height - 2, MIN_EVENT_HEIGHT), left: `${left}%`, top: event.top + 1, width: `${width}%`,
                          }]}
                        >
                          <Text style={[Fonts.p3Bold, { color: Colors.neutral00, fontSize: mode === 'week' ? 10 : 11 }]}>
                            +
                            {event.count}
                          </Text>
                          <Text style={[Fonts.p3, { color: Colors.neutral300, fontSize: 9, textAlign: 'center' }]}>plus</Text>
                        </TouchableOpacity>
                      );
                    }

                    const color = event.color || Colors.primary500;
                    const isCompact = event.height < 62;
                    const isTiny = event.height < 38;
                    const title = getPlanningDisplayTitle(event);
                    const primaryLabel = getPrimaryPlanningLabel(event);
                    const contextLabel = getPlanningContextLabel(event);
                    const facilityName = event.facility?.name || null;
                    const typeLabel = getPlanningTypeLabel(event);
                    const metaLabel = [title]
                      .filter((value) => value && value !== primaryLabel && value !== contextLabel && value !== facilityName)
                      .join(' - ');
                    const timeLabel = `${formatClock(event.startTime)} - ${formatClock(event.endTime)}`;
                    let primaryFontSize = 10;
                    if (mode === 'week') {
                      primaryFontSize = isTiny ? 8 : 9;
                    } else if (isTiny) {
                      primaryFontSize = 9;
                    }

                    const contextFontSize = mode === 'week' ? 10 : 11;
                    const showPrimaryAsType = Boolean(typeLabel);
                    const primaryMinimumFontScale = showPrimaryAsType
                      ? (mode === 'week' ? 0.52 : 0.58)
                      : 0.8;
                    const primaryPaddingHorizontal = showPrimaryAsType
                      ? (mode === 'week' ? 3 : 4)
                      : (mode === 'week' ? 4 : 6);

                    return (
                      <TouchableOpacity
                        key={event.documentId || `${event.dayIndex}-${event.top}`}
                        onPress={() => onEventPress?.(event)}
                        style={[styles.eventCard, {
                          backgroundColor: hexToRgba(color, 0.15),
                          borderColor: hexToRgba(color, 0.28),
                          borderLeftColor: color,
                          borderLeftWidth: mode === 'week' ? 2 : 3,
                          height: event.height - 2,
                          justifyContent: isTiny ? 'center' : 'flex-start',
                          left: `${left}%`,
                          paddingHorizontal: primaryPaddingHorizontal,
                          paddingVertical: mode === 'week' ? 4 : 6,
                          top: event.top + 1,
                          width: `${width}%`,
                        }]}
                      >
                        <Text
                          adjustsFontSizeToFit={showPrimaryAsType}
                          minimumFontScale={primaryMinimumFontScale}
                          numberOfLines={1}
                          style={[Fonts.p3Bold, {
                            color: showPrimaryAsType ? color : Colors.neutral00,
                            flexShrink: 1,
                            fontSize: primaryFontSize,
                            letterSpacing: showPrimaryAsType ? 0.35 : 0,
                            lineHeight: primaryFontSize + 2,
                            marginBottom: !isCompact && contextLabel ? 2 : 0,
                          }]}
                        >
                          {primaryLabel}
                        </Text>
                        {!isCompact && contextLabel ? (
                          <Text
                            numberOfLines={mode === 'week' ? 1 : 2}
                            style={[Fonts.p3Bold, {
                              color: Colors.neutral00,
                              fontSize: contextFontSize,
                              lineHeight: mode === 'week' ? 12 : 13,
                              marginTop: 2,
                            }]}
                          >
                            {contextLabel}
                          </Text>
                        ) : null}
                        {!isCompact && facilityName && facilityName !== contextLabel && facilityName !== primaryLabel ? (
                          <Text numberOfLines={1} style={[Fonts.p3Bold, { color, fontSize: 9, marginTop: 2 }]}>
                            {facilityName}
                          </Text>
                        ) : null}
                        {!isTiny ? (
                          <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300, fontSize: 9, marginTop: 2 }]}>
                            {timeLabel}
                          </Text>
                        ) : null}
                        {!isCompact && metaLabel ? (
                          <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300, fontSize: 8, marginTop: 2 }]}>
                            {metaLabel}
                          </Text>
                        ) : null}
                        {event.leagueMatch || event.league_match ? (
                          <View style={[styles.leagueDot, { backgroundColor: Colors.gold500 || '#D4AF37' }]} />
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  collapsedText: { color: '#6E7C84', fontSize: 10 },
  container: { backgroundColor: 'transparent', flex: 1 },
  dayBackgroundColumn: { borderLeftWidth: 1, flex: 1 },
  dayBackgroundRow: { flexDirection: 'row' },
  dayBadge: {
    alignItems: 'center', borderRadius: 999, height: 32, justifyContent: 'center', minWidth: 32, position: 'relative', width: 32,
  },
  dayBadgeText: { fontSize: 14, fontWeight: '700' },
  dayBadgeWrapper: { alignItems: 'center', justifyContent: 'center', minHeight: 32 },
  dayColumnHeader: { alignItems: 'center', flex: 1 },
  dayCountBadge: {
    alignItems: 'center', borderRadius: 6, borderWidth: 1, height: 14, justifyContent: 'center', position: 'absolute', right: -4, top: -4, width: 14,
  },
  dayCountText: { color: '#FFFFFF', fontSize: 8, fontWeight: '700' },
  dayLabel: { fontSize: 11, marginBottom: 6, textTransform: 'uppercase' },
  daysRow: {
    alignItems: 'flex-end', borderBottomWidth: 1, flexDirection: 'row', marginBottom: 8, paddingBottom: 8,
  },
  emptyState: { alignItems: 'center', paddingHorizontal: 16, paddingVertical: 28 },
  eventCard: {
    borderRadius: 8, borderWidth: 1, overflow: 'hidden', position: 'absolute',
  },
  gridContainer: {
    borderRightWidth: 1, borderTopWidth: 1, flex: 1, position: 'relative',
  },
  gridLine: { borderBottomWidth: 1 },
  headerArrow: { height: 18, width: 18 },
  headerCard: {
    alignItems: 'center', borderRadius: 22, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8,
  },
  headerCenter: { alignItems: 'center' },
  headerSpacing: { paddingBottom: 12, paddingTop: 8 },
  headerTitle: {
    fontSize: 13, fontWeight: '700', letterSpacing: 1, marginBottom: 2, textTransform: 'uppercase',
  },
  hitSlop: {
    bottom: 10, left: 10, right: 10, top: 10,
  },
  hourText: { fontSize: 11, fontWeight: '700', marginTop: -8 },
  leagueDot: {
    borderColor: 'rgba(0,18,24,0.8)', borderRadius: 999, borderWidth: 1, height: 10, position: 'absolute', right: 3, top: 3, width: 10,
  },
  nowDot: {
    borderRadius: 999, height: 8, marginRight: 4, width: 8,
  },
  nowLine: { flex: 1, height: 2 },
  nowLineContainer: { position: 'absolute' },
  nowLineTrack: { alignItems: 'center', flexDirection: 'row', paddingHorizontal: 2 },
  overflowCard: {
    alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 8, borderStyle: 'dashed', borderWidth: 1, justifyContent: 'center', paddingHorizontal: 4, position: 'absolute',
  },
  panel: {
    borderRadius: 18, borderWidth: 1, overflow: 'hidden', paddingHorizontal: 8,
  },
  scrollContent: { paddingBottom: 50, paddingTop: 6 },
  summaryArrow: {
    height: 12, marginLeft: 8, tintColor: '#FFFFFF', width: 12,
  },
  summaryDot: {
    borderRadius: 999, height: 6, marginRight: 8, width: 6,
  },
  summaryRow: {
    alignItems: 'center', flexDirection: 'row', justifyContent: 'center', paddingBottom: 6, paddingTop: 8,
  },
  summaryText: { fontWeight: '700' },
  timeCell: { alignItems: 'center', justifyContent: 'flex-start' },
  timelineRow: { flexDirection: 'row' },
  untimedCard: {
    borderLeftWidth: 3, borderRadius: 10, borderWidth: 1, marginBottom: 6, paddingHorizontal: 8, paddingVertical: 6,
  },
  untimedCardText: { fontSize: 11 },
  untimedColumns: { flex: 1, flexDirection: 'row' },
  untimedDayColumn: { flex: 1, paddingHorizontal: 4 },
  untimedLabel: { fontSize: 11 },
  untimedLabelColumn: { justifyContent: 'flex-start', paddingRight: 8, width: TIME_COLUMN_WIDTH },
  untimedMoreButton: {
    alignItems: 'center', borderColor: 'rgba(1,179,244,0.35)', borderRadius: 10, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 6,
  },
  untimedSection: {
    borderBottomWidth: 1, flexDirection: 'row', marginBottom: 8, paddingBottom: 8, paddingTop: 4,
  },
});

export default PlanningWeekTimelineView;
