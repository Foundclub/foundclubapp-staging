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
import React, { useEffect, useMemo, useState } from 'react';
import {
  Image, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Directions, Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { images as Images } from '@/theme/images';
import useTheme from '@/theme/themeContext';
import { resolveFacilityPlanningColor } from '@/utils/facilityPlanningColor';

// Constants
const HOUR_HEIGHT = 60;
const COLLAPSED_HEIGHT = 15; // Height for empty blocks
const MIN_EVENT_HEIGHT = 24;
const TIME_COLUMN_WIDTH = 44;

/**
 * @typedef {{
 *   id?: string | number;
 *   date?: string | Date;
 *   startTime?: string;
 *   endTime?: string;
 *   type?: string | { name?: string };
 *   team?: { name?: string };
 *   category?: { name?: string };
 *   facility?: { name?: string; planningColor?: string; color?: string };
 *   title?: string;
 *   name?: string;
 *   league_match?: unknown;
 * }} TimelineEvent
 */

/**
 * @typedef {{ type: 'hour'; value: number } | { type: 'collapsed'; start: number; end: number; id: string }} TimelineBlock
 */

/**
 * @typedef {TimelineEvent & {
 *   dayIndex: number;
 *   top: number;
 *   height: number;
 *   color: string;
 *   colIndex?: number;
 *   widthPercent?: number;
 *   leftPercent?: number;
 *   concurrentCount?: number;
 * }} PositionedEvent
 */

/**
 * @typedef {{
 *   events?: TimelineEvent[];
 *   onEventPress?: (event: PositionedEvent) => void;
 *   onSummaryPress?: () => void;
 *   scrollEnabled?: boolean;
 *   currentDate?: Date;
 *   onDateChange?: (date: Date) => void;
 *   mode?: '3days' | 'week';
 *   isInfiniteScroll?: boolean;
 *   maxSlots?: number;
 * }} PlanningWeekTimelineViewProps
 */

/**
 * @param {PlanningWeekTimelineViewProps} props
 */
function PlanningWeekTimelineView({
  currentDate: propDate,
  events = [],
  mode = '3days', // '3days' or 'week'
  onDateChange,
  onEventPress,
  onSummaryPress,
  scrollEnabled = true,
}) {
  const { Colors, Fonts } = useTheme();
  const [internalDate, setInternalDate] = useState(new Date());
  const currentDate = propDate || internalDate;
  const scrollViewRef = React.useRef(/** @type {any} */ (null));

  // Helpers
  /**
   * @param {string | undefined} t
   * @returns {string | undefined}
   */
  const formatTime = (t) => t?.split(':').slice(0, 2).join(':');

  const PALETTE = [
    '#FF4D4D', // Red
    '#4D79FF', // Blue
    '#FFB34D', // Orange
    '#4DFFB3', // Green
    '#9D4DFF', // Purple
    '#FF4D94', // Pink
    '#4DB3FF', // Light Blue
    '#FFD94D', // Yellow
  ];

  /**
   * @param {TimelineEvent} event
   * @returns {string}
   */
  const getEventColor = (event) => {
    const facilityColor = resolveFacilityPlanningColor(event?.facility);
    if (facilityColor) {
      return facilityColor;
    }

    const rawType = typeof event.type === 'string' ? event.type : event.type?.name;
    const normalizedType = rawType?.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (normalizedType) {
      switch (normalizedType) {
        case 'Autre': return '#4DFFB3'; // Green
        case 'Entrainement': return '#4D79FF'; // Blue
        case 'Match': return '#FF4D4D'; // Red
        case 'Reunion': return '#FFB34D'; // Orange
      }
    }
    // Fallback to team name or category
    const seed = event.team?.name || event.category?.name || event.title || 'default';
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % PALETTE.length;
    return PALETTE[index];
  };

  // 1. Calculate Week Days based on Mode
  const weekDays = useMemo(() => {
    if (mode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday start
      return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
    }
    // Default '3days'
    return [
      currentDate,
      addDays(currentDate, 1),
      addDays(currentDate, 2),
    ];
  }, [currentDate, mode]);

  // 2. Filter Events for the Current Interval
  const weekEvents = useMemo(() => {
    if (!events || events.length === 0) return [];

    const start = startOfDay(weekDays[0]);
    const end = endOfDay(weekDays[weekDays.length - 1]);

    return events.filter((/** @type {TimelineEvent} */ event) => {
      if (!event || !event.date) return false;
      const eventDate = new Date(event.date);
      return isWithinInterval(eventDate, { end, start });
    });
  }, [events, weekDays]);

  // 3. Calculate Active Hours (Accordion Logic)
  // STRICT: Only hours that actually have events are active. No padding.
  const activeHours = useMemo(() => {
    const active = new Set();
    if (!weekEvents || weekEvents.length === 0) return active;

    weekEvents.forEach((/** @type {TimelineEvent} */ event) => {
      let startH = 0;
      let endH = 0;
      let endM = 0;

      if (event.startTime && event.endTime) {
        startH = parseInt(event.startTime.split(':')[0], 10);
        const endParts = event.endTime.split(':');
        endH = parseInt(endParts[0], 10);
        endM = parseInt(endParts[1], 10);
      } else if (event.date) {
        const d = new Date(event.date);
        startH = d.getHours();
        endH = startH + 1;
      }

      // Handle midnight crossing (rare but possible)
      if (endH < startH) {
        for (let h = startH; h <= 23; h++) active.add(h);

        // Only add next day hours if it goes BEYOND 00:00
        // If endH is 0 and endM is 0, it stops exactly at midnight. Don't add 0.
        const effectiveEndH = endM > 0 ? endH : endH - 1;
        if (effectiveEndH >= 0) {
          for (let h = 0; h <= effectiveEndH; h++) active.add(h);
        }
      } else {
        // If end minute is 0, the event ends exactly at the start of endH, so endH is NOT occupied
        const effectiveEndH = endM > 0 ? endH : endH - 1;
        for (let h = startH; h <= effectiveEndH; h++) {
          active.add(h);
        }
      }
    });
    return active;
  }, [weekEvents]);

  // Calculate minStartHour for Smart Scroll
  const minStartHour = useMemo(() => {
    if (!weekEvents || weekEvents.length === 0) return 8; // Default to 8am if no events
    let min = 24;
    weekEvents.forEach((/** @type {TimelineEvent} */ e) => {
      if (e.startTime) {
        const h = parseInt(e.startTime.split(':')[0], 10);
        if (h < min) min = h;
      }
    });
    return min === 24 ? 8 : Math.max(0, min - 1); // Scroll to 1 hour before first event
  }, [weekEvents]);

  // 4. Build Timeline Structure (The "Map" of the vertical axis)
  const timelineStructure = useMemo(() => {
    /** @type {TimelineBlock[]} */
    const structure = [];
    /** @type {{ start: number; end: number; id: string } | null} */
    let currentEmptyBlock = null;

    for (let h = 0; h <= 23; h++) {
      const isActive = activeHours.has(h);

      if (isActive) {
        // If we were tracking an empty block, push it now
        if (currentEmptyBlock) {
          structure.push({ type: 'collapsed', ...currentEmptyBlock });
          currentEmptyBlock = null;
        }
        structure.push({ type: 'hour', value: h });
      } else {
        // Empty hour
        if (!currentEmptyBlock) {
          currentEmptyBlock = { end: h, id: `empty-${h}`, start: h };
        } else {
          currentEmptyBlock.end = h;
        }
      }
    }
    // Push remaining empty block
    if (currentEmptyBlock) {
      structure.push({ type: 'collapsed', ...currentEmptyBlock });
    }
    return structure;
  }, [activeHours]);

  // 5. Calculate Y-Positions (Top) for each hour
  const hourPositions = useMemo(() => {
    /** @type {Record<number, number>} */
    const positions = {};
    let currentY = 0;
    timelineStructure.forEach((/** @type {TimelineBlock} */ block) => {
      if (block.type === 'hour') {
        positions[block.value] = currentY;
        currentY += HOUR_HEIGHT;
      } else {
        // Collapsed block
        // Map all hours in this block to the same collapsed Y start
        for (let h = block.start; h <= block.end; h++) {
          positions[h] = currentY; // Simplified: they all map to the start of the collapsed block
        }
        currentY += COLLAPSED_HEIGHT;
      }
    });
    return positions;
  }, [timelineStructure]);

  // Scroll to minStartHour on mount or week change
  useEffect(() => {
    if (scrollViewRef.current && hourPositions[minStartHour] !== undefined) {
      // Small timeout to ensure layout is ready
      setTimeout(() => {
        const scroll = scrollViewRef.current;
        if (scroll && typeof scroll.scrollTo === 'function') {
          scroll.scrollTo({
            animated: true,
            y: hourPositions[minStartHour],
          });
        }
      }, 100);
    }
  }, [minStartHour, hourPositions, weekDays]);

  // 6. Process Events for Layout (Calculate Top, Height, DayIndex)
  const processedEvents = useMemo(() => {
    const mapped = weekEvents.map((/** @type {TimelineEvent} */ event) => {
      if (!event.startTime || !event.endTime || !event.date) return null;

      const startH = parseInt(event.startTime.split(':')[0], 10);
      const startM = parseInt(event.startTime.split(':')[1], 10);
      const endH = parseInt(event.endTime.split(':')[0], 10);
      const endM = parseInt(event.endTime.split(':')[1], 10);

      const eventDate = new Date(event.date);
      const dayIndex = differenceInCalendarDays(eventDate, weekDays[0]);

      // Calculate Top
      // If start hour is collapsed, it starts at the collapsed block's Y
      // If start hour is active, it starts at hourPositions[startH] + (startM / 60) * HOUR_HEIGHT
      const startY = hourPositions[startH] !== undefined ? hourPositions[startH] : 0;
      const top = activeHours.has(startH)
        ? startY + (startM / 60) * HOUR_HEIGHT
        : startY;

      // Calculate Bottom
      // Similar logic for end time
      const endYBase = hourPositions[endH] !== undefined ? hourPositions[endH] : 0;
      const bottom = activeHours.has(endH)
        ? endYBase + (endM / 60) * HOUR_HEIGHT
        : endYBase; // If end hour is collapsed, it ends at the start of that block (effectively 0 height in that block)

      // Adjust for collapsed blocks in between?
      // The simple logic above works if start and end are in the same or adjacent blocks.
      // For robust calculation across mixed blocks:
      // Height = Sum of heights of all covered segments.
      // Simplified approach: Use the Y difference from our pre-calculated positions.

      // Correction: If endH is active, endYBase is the top of that hour.
      // If endH is collapsed, endYBase is the top of that collapsed block.

      // Let's refine height calculation:
      const calculatedHeight = 0;
      // This is complex with variable row heights.
      // Easier: We have Y coordinates for every hour start.
      // We just need to handle the minutes offset.

      // Re-evaluating Top/Bottom strategy:
      // Top is correct.
      // Bottom needs to be: Position of (EndHour) + Minutes offset.
      // If EndHour is collapsed, Minutes offset is ignored (or scaled to collapsed height).

      // Handle day crossing (endH < startH) or midnight (00:00)
      // If endH < startH, it means it ends the next day (e.g. 22:00 -> 00:00 or 22:00 -> 01:00)
      // For this view, we clamp to the end of the current day's timeline.

      let realBottom = 0;

      if (endH < startH) {
        // It crosses midnight.
        // We want to extend it to the bottom of the last active block of the day.
        // Or simpler: just calculate height until 24:00?
        // But 24:00 isn't in hourPositions.
        // We need to find the Y position of the "end" of the timeline.

        const lastBlock = timelineStructure[timelineStructure.length - 1];
        if (!lastBlock) {
          realBottom = top + MIN_EVENT_HEIGHT;
        } else {
          const lastBlockEndY = lastBlock.type === 'hour'
            ? (hourPositions[lastBlock.value] ?? 0) + HOUR_HEIGHT
            : (hourPositions[lastBlock.end] ?? 0) + COLLAPSED_HEIGHT;

          realBottom = lastBlockEndY;
        }
      } else {
        // Normal case
        const endYBase = hourPositions[endH] !== undefined ? hourPositions[endH] : 0;

        if (activeHours.has(endH)) {
          realBottom = endYBase + (endM / 60) * HOUR_HEIGHT;
        } else {
          // If it ends in a collapsed block
          realBottom = endYBase + (endM / 60) * COLLAPSED_HEIGHT;
        }
      }

      let height = realBottom - top;
      height = Math.max(height, MIN_EVENT_HEIGHT);

      return {
        ...event,
        color: getEventColor(event),
        dayIndex,
        height,
        top,
      };
    }).filter((event) => event !== null);
    return /** @type {PositionedEvent[]} */ (mapped);
  }, [weekEvents, hourPositions, activeHours, weekDays, timelineStructure]);

  // 7. Handle Overlaps (Columns)
  const eventsWithLayout = useMemo(() => {
    const daysCount = mode === 'week' ? 7 : 3;
    const eventsByDay = Array.from({ length: daysCount }, () => /** @type {PositionedEvent[]} */ ([]));

    processedEvents.forEach((event) => {
      if (event.dayIndex >= 0 && event.dayIndex < daysCount) {
        eventsByDay[event.dayIndex].push(event);
      }
    });

    /** @type {PositionedEvent[]} */
    const result = [];
    eventsByDay.forEach((dayEvents) => {
      dayEvents.sort((a, b) => a.top - b.top);

      /** @type {PositionedEvent[][]} */
      const columns = [];
      dayEvents.forEach((event) => {
        let placed = false;
        for (let i = 0; i < columns.length; i++) {
          const lastEventInColumn = columns[i][columns[i].length - 1];
          if (lastEventInColumn.top + lastEventInColumn.height <= event.top) {
            columns[i].push(event);
            event.colIndex = i;
            placed = true;
            break;
          }
        }
        if (!placed) {
          columns.push([event]);
          event.colIndex = columns.length - 1;
        }
      });

      const totalColumns = columns.length;
      dayEvents.forEach((event) => {
        event.widthPercent = 100 / totalColumns;
        const colIndex = event.colIndex ?? 0;
        event.leftPercent = colIndex * event.widthPercent;
        event.concurrentCount = totalColumns;
        result.push(event);
      });
    });

    return result;
  }, [processedEvents, mode]);

  // Helpers
  /**
   * @param {Date} newDate
   */
  const handleDateUpdate = (newDate) => {
    if (onDateChange) onDateChange(newDate);
    else setInternalDate(newDate);
  };

  const handlePrevPage = () => {
    const days = mode === 'week' ? 7 : 3;
    handleDateUpdate(subDays(currentDate, days));
  };

  const handleNextPage = () => {
    const days = mode === 'week' ? 7 : 3;
    handleDateUpdate(addDays(currentDate, days));
  };

  const flingLeft = Gesture.Fling().direction(Directions.LEFT).onEnd(() => {
    'worklet';

    runOnJS(handleNextPage)();
  });
  const flingRight = Gesture.Fling().direction(Directions.RIGHT).onEnd(() => {
    'worklet';

    runOnJS(handlePrevPage)();
  });

  const dateRangeText = useMemo(() => {
    if (!weekDays.length) return '';
    const start = weekDays[0];
    const end = weekDays[weekDays.length - 1];
    const startStr = format(start, 'd MMM', { locale: fr });
    const endStr = format(end, 'd MMM yyyy', { locale: fr });
    return `${startStr} - ${endStr}`;
  }, [weekDays]);

  const summaryText = useMemo(() => {
    const count = weekEvents.length;
    const unit = count > 1 ? 'evenements' : 'evenement';
    const period = mode === 'week' ? 'cette semaine' : 'sur 3 jours';
    return `${count} ${unit} ${period}`;
  }, [weekEvents.length, mode]);

  // Render
  return (
    <GestureDetector gesture={Gesture.Simultaneous(flingLeft, flingRight)}>
      <View style={{ backgroundColor: 'transparent', flex: 1 }}>

        {/* 1. HEADER & NAVIGATION (Date Selector) */}
        <View style={{ paddingBottom: 12, paddingTop: 8 }}>
          <View style={{
            alignItems: 'center',
            backgroundColor: Colors.primary700,
            borderColor: `${Colors.primary500}33`,
            borderRadius: 22,
            borderWidth: 1,
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 8,
          }}
          >
            <TouchableOpacity
              hitSlop={{
                bottom: 10, left: 10, right: 10, top: 10,
              }}
              onPress={handlePrevPage}
            >
              <Image
                resizeMode="contain"
                source={/** @type {any} */ (Images.arrowLeft)}
                style={{ height: 18, tintColor: Colors.primary500, width: 18 }}
              />
            </TouchableOpacity>

            <View style={{ alignItems: 'center' }}>
              <Text style={{
                color: Colors.primary200,
                fontSize: 13,
                fontWeight: '700',
                letterSpacing: 1,
                marginBottom: 2,
                textTransform: 'uppercase',
              }}
              >
                      PLANNING
              </Text>
              <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
                {dateRangeText}
              </Text>
            </View>

            <TouchableOpacity
              hitSlop={{
                bottom: 10, left: 10, right: 10, top: 10,
              }}
              onPress={handleNextPage}
            >
              <Image
                resizeMode="contain"
                source={/** @type {any} */ (Images.arrowRight)}
                style={{ height: 18, tintColor: Colors.primary500, width: 18 }}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View>
          <View style={{
            backgroundColor: 'rgba(255,255,255,0.03)',
            borderColor: 'rgba(255,255,255,0.10)',
            borderRadius: 18,
            borderWidth: 1,
            overflow: 'hidden',
            paddingHorizontal: 8,
          }}
          >
            {/* Summary Button */}
            {weekEvents.length > 0 && (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={onSummaryPress}
              style={{
                    alignItems: 'center',
                    backgroundColor: 'transparent',
                    flexDirection: 'row',
                    justifyContent: 'center',
                    paddingBottom: 6,
                    paddingTop: 8,
                  }}
            >
              <View style={{
                    backgroundColor: Colors.primary500,
                    borderRadius: 999,
                    height: 6,
                    marginRight: 8,
                    width: 6,
                  }}
                  />
              <Text style={[Fonts.p3, { color: Colors.neutral00, fontWeight: '700' }]}>
                    {summaryText}
                  </Text>
              <Image
                    resizeMode="contain"
                    source={/** @type {any} */ (Images.arrowRight)}
                    style={{
                      height: 12,
                      marginLeft: 8,
                      tintColor: Colors.neutral00,
                      width: 12,
                    }}
                  />
            </TouchableOpacity>
            )}

            {/* Days Row */}
            <View style={{
              alignItems: 'flex-end',
              borderBottomColor: 'rgba(255,255,255,0.12)',
              borderBottomWidth: 1,
              flexDirection: 'row',
              marginBottom: 8,
              paddingBottom: 8,
            }}
            >
              <View style={{ width: TIME_COLUMN_WIDTH }} />
              {weekDays.map((day, index) => {
                const isToday = isSameDay(day, new Date());
                const dayEventsCount = weekEvents.filter((e) => {
                  if (!e.date) return false;
                  return isSameDay(new Date(e.date), day);
                }).length;

                const hasEvents = dayEventsCount > 0;

                return (
                    <View key={index} style={{ alignItems: 'center', flex: 1 }}>
                        <Text style={[Fonts.p3, {
                            color: isToday ? Colors.primary500 : Colors.neutral300,
                            fontSize: 11,
                            fontWeight: isToday ? 'bold' : 'normal',
                            marginBottom: 6,
                            textTransform: 'uppercase',
                          }]}
                          >
                            {format(day, 'EEE', { locale: fr }).replace('.', '')}
                          </Text>

                        <View style={{
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: 32,
                          }}
                          >
                            <View style={{
                                alignItems: 'center',
                                backgroundColor: isToday ? Colors.primary500 : (hasEvents ? Colors.neutral800 : 'transparent'),
                                borderRadius: 999,
                                height: 32,
                                justifyContent: 'center',
                                position: 'relative',
                                width: 32,
                              }}
                              >
                                <Text style={[Fonts.h3, {
                                  color: Colors.neutral00,
                                  fontWeight: 'bold',
                                  fontSize: 14,
                                }]}
                                >
                                  {format(day, 'd')}
                                </Text>

                                {dayEventsCount > 0 && !isToday && (
                                <View style={{
                                      alignItems: 'center',
                                      backgroundColor: Colors.primary500,
                                      borderColor: Colors.neutral700,
                                      borderRadius: 6,
                                      borderWidth: 1,
                                      height: 14,
                                      justifyContent: 'center',
                                      position: 'absolute',
                                      right: -4,
                                      top: -4,
                                      width: 14,
                                    }}
                                    >
                                      <Text style={{ color: Colors.neutral00, fontSize: 8, fontWeight: 'bold' }}>
                                        {dayEventsCount}
                                      </Text>
                                    </View>
                                )}
                              </View>
                          </View>
                      </View>
                );
              })}
            </View>

            {/* Timeline ScrollView */}
            <ScrollView
              contentContainerStyle={{ paddingBottom: 50, paddingTop: 6 }}
              ref={scrollViewRef}
              scrollEnabled={scrollEnabled}
            >
              <View style={{ flexDirection: 'row' }}>
                {/* Time Column */}
                <View style={{ width: TIME_COLUMN_WIDTH }}>
                    {timelineStructure.map((block, index) => (
                        <View
                            key={index}
                            style={{
  alignItems: 'center',
  borderBottomWidth: 0,
  height: block.type === 'hour' ? HOUR_HEIGHT : COLLAPSED_HEIGHT,
  justifyContent: 'flex-start',
}}
                          >
                            {block.type === 'hour' && (
                              <Text style={[Fonts.p3, {
                                backgroundColor: 'transparent',
                                color: Colors.neutral300,
                                fontSize: 11,
                                fontWeight: 'bold',
                                marginTop: -8,
                              }]}
                              >
                                {`${block.value}:00`}
                              </Text>
                              )}
                            {block.type === 'collapsed' && (
                              <Text style={{ color: Colors.neutral700, fontSize: 10 }}>...</Text>
                              )}
                          </View>
                      ))}
                  </View>

                {/* Events Grid */}
                <View style={{
                    borderRightColor: 'rgba(255,255,255, 0.1)',
                    borderRightWidth: 1,
                    borderTopColor: 'rgba(255,255,255, 0.1)',
                    borderTopWidth: 1,
                    flex: 1,
                    position: 'relative',
                  }}
                  >
                    {/* Grid Lines & Day Columns Background */}
                    <View style={{ ...StyleSheet.absoluteFillObject, flexDirection: 'row' }}>
                        {weekDays.map((day, i) => {
                            const isToday = isSameDay(day, new Date());
                            return (
                                <View
                                  key={`bg-col-${i}`} style={{
                                      backgroundColor: isToday ? `rgba(${parseInt(Colors.primary500.slice(1, 3), 16)}, ${parseInt(Colors.primary500.slice(3, 5), 16)}, ${parseInt(Colors.primary500.slice(5, 7), 16)}, 0.05)` : 'transparent',
                                      borderLeftColor: 'rgba(255,255,255, 0.1)',
                                      borderLeftWidth: 1,
                                      flex: 1,
                                    }}
                                />
                            );
                          })}
                      </View>

                    {/* Horizontal Grid Lines */}
                    {timelineStructure.map((block, index) => (
                        <View
                            key={`grid-${index}`}
                            style={{
  backgroundColor: block.type === 'collapsed' ? 'rgba(255,255,255, 0.05)' : 'transparent',
  borderBottomColor: 'rgba(255,255,255, 0.1)',
  borderBottomWidth: 1,
  height: block.type === 'hour' ? HOUR_HEIGHT : COLLAPSED_HEIGHT,
}}
                          />
                      ))}

                    {/* Events */}
                    {eventsWithLayout.map((event) => {
                        const dayWidth = 100 / weekDays.length;
                        const leftPercent = event.leftPercent ?? 0;
                        const widthPercent = event.widthPercent ?? 100;
                        const left = (event.dayIndex * dayWidth) + (leftPercent * (dayWidth / 100));
                        const width = widthPercent * (dayWidth / 100);

                        const eventColor = event.color || Colors.primary500;
                        const isHex = eventColor.startsWith('#');
                        const bgOpacity = isHex ? `${eventColor}40` : 'rgba(1, 179, 244, 0.25)';
                        const borderOpacity = isHex ? `${eventColor}4D` : 'rgba(1, 179, 244, 0.3)';

                        // Content Data
                        const mainTitle = event.team?.name || event.category?.name || event.title || event.name || 'Event';
                        const eventType = typeof event.type === 'string' ? event.type : event.type?.name;
                        const facilityName = event.facility?.name;

                        // Layout Constraints
                        const isWeekMode = mode === 'week';
                        const isTinyEvent = event.height < 32;
                        const isSmallEvent = event.height < 56;

                        // In Week Mode, we have very narrow columns.
                        // Strategy: Wrap text, smaller fonts, hide time if needed.
                        const titleLines = isWeekMode && !isTinyEvent ? 2 : 1;
                        const showType = !isSmallEvent && eventType;
                        const showFacility = !isSmallEvent && facilityName;
                        const showTime = !isTinyEvent && (!isWeekMode || event.height > 52);
                        const showLeagueBadge = !!event.league_match;

                        return (
                            <TouchableOpacity
                                key={event.id}
                                onPress={() => onEventPress?.(event)}
                                style={{
                                  backgroundColor: bgOpacity,
                                  borderColor: borderOpacity,
                                  borderLeftColor: eventColor,
                                  borderLeftWidth: isWeekMode ? 2 : 3, // Save 1px in week mode
                                  borderRadius: 8,
                                  borderWidth: 1,
                                  height: event.height - 2,
                                  justifyContent: isTinyEvent ? 'center' : 'flex-start',
                                  left: `${left}%`,
                                  overflow: 'hidden',
                                  padding: isWeekMode ? 3 : 4,
                                  position: 'absolute',
                                  top: event.top + 1,
                                  width: `${width}%`,
                                }}
                              >
                                {/* Main Title (Team Name) */}
                                <Text
                                  numberOfLines={titleLines}
                                  style={[Fonts.p3Bold, {
                                      color: Colors.neutral00,
                                      fontSize: isWeekMode ? (isTinyEvent ? 9 : 10) : (isTinyEvent ? 10 : 11),
                                      lineHeight: isWeekMode ? 12 : 13,
                                      marginBottom: 1,
                                    }]}
                                >
                                  {mainTitle}
                                </Text>

                                {/* Event Type (e.g. Match, Entrainement) */}
                                {showType && (
                                <Text
                                      numberOfLines={1}
                                      style={[Fonts.p3, {
                                        color: Colors.neutral300,
                                        fontSize: isWeekMode ? 8 : 9,
                                        marginBottom: 1,
                                        marginTop: isWeekMode ? 1 : 0,
                                      }]}
                                    >
                                      {eventType}
                                    </Text>
                                )}

                                {/* Facility Name */}
                                {showFacility && (
                                <Text
                                      numberOfLines={1}
                                      style={[Fonts.p3, {
                                        color: Colors.primary500,
                                        fontSize: isWeekMode ? 8 : 9,
                                        fontWeight: 'bold',
                                        marginTop: 0,
                                      }]}
                                    >
                                      {facilityName}
                                    </Text>
                                )}

                                {/* Time Range */}
                                {showTime && (
                                <Text
                                      numberOfLines={1}
                                      style={[Fonts.p3, {
                                        color: Colors.neutral300,
                                        fontSize: isWeekMode ? 8 : 9,
                                        marginTop: 0,
                                      }]}
                                    >
                                      {formatTime(event.startTime)}
                                      {' '}
                                      -
                                      {formatTime(event.endTime)}
                                    </Text>
                                )}

                                {showLeagueBadge ? (
                                  <View
                                    style={{
                                      backgroundColor: Colors.gold500,
                                      borderColor: 'rgba(0,18,24,0.8)',
                                      borderRadius: 999,
                                      borderWidth: 1,
                                      height: isWeekMode ? 8 : 10,
                                      position: 'absolute',
                                      right: 3,
                                      top: 3,
                                      width: isWeekMode ? 8 : 10,
                                    }}
                                  />
                                ) : null}
                              </TouchableOpacity>
                        );
                      })}
                  </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </View>
    </GestureDetector>
  );
}

export default PlanningWeekTimelineView;
