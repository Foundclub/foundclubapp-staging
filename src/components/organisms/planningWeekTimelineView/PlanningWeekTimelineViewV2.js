import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Dimensions, Image } from 'react-native';
import PropTypes from 'prop-types';
import {
    format,
    addDays,
    startOfWeek,
    endOfWeek,
    isSameDay,
    isWithinInterval,
    startOfDay,
    endOfDay,
    subDays,
    differenceInCalendarDays
} from 'date-fns';
import { fr } from 'date-fns/locale';
import useTheme from '@/theme/themeContext';
import Fonts from '@/theme/fonts';
import Spaces from '@/theme/spaces';
import Alignments from '@/theme/alignements';
import Colors from '@/theme/colors';
import { images as Images } from '@/theme/images';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Directions } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

// Constants
const HOUR_HEIGHT = 60;
const COLLAPSED_HEIGHT = 15; // Height for empty blocks
const MIN_EVENT_HEIGHT = 20;

const PlanningWeekTimelineView = ({
    events = [],
    onEventPress,
    onSummaryPress,
    scrollEnabled = true,
    currentDate: propDate,
    onDateChange,
    mode = '3days', // '3days' or 'week'
    isInfiniteScroll = false, // Not fully implemented in this V2 rewrite to keep it simple first
    maxSlots // Optional prop for capacity calculation
}) => {
    const { Colors, Fonts, Spaces } = useTheme();
    const [internalDate, setInternalDate] = useState(new Date());
    const currentDate = propDate || internalDate;
    const scrollViewRef = React.useRef(null);

    // Helpers
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

    const getEventColor = (event) => {
        const type = event.type?.name || event.type;
        if (type) {
            switch (type) {
                case 'Match': return '#FF4D4D'; // Red
                case 'Entrainement': return '#4D79FF'; // Blue
                case 'Réunion': return '#FFB34D'; // Orange
                case 'Autre': return '#4DFFB3'; // Green
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
            addDays(currentDate, 2)
        ];
    }, [currentDate, mode]);

    // 2. Filter Events for the Current Interval
    const weekEvents = useMemo(() => {
        if (!events || events.length === 0) return [];

        const start = startOfDay(weekDays[0]);
        const end = endOfDay(weekDays[weekDays.length - 1]);

        return events.filter((event) => {
            if (!event || !event.date) return false;
            const eventDate = new Date(event.date);
            return isWithinInterval(eventDate, { start, end });
        });
    }, [events, weekDays]);

    // 3. Calculate Active Hours (Accordion Logic)
    // STRICT: Only hours that actually have events are active. No padding.
    const activeHours = useMemo(() => {
        const active = new Set();
        if (!weekEvents || weekEvents.length === 0) return active;

        weekEvents.forEach(event => {
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
        weekEvents.forEach(e => {
            if (e.startTime) {
                const h = parseInt(e.startTime.split(':')[0], 10);
                if (h < min) min = h;
            }
        });
        return min === 24 ? 8 : Math.max(0, min - 1); // Scroll to 1 hour before first event
    }, [weekEvents]);

    // Scroll to minStartHour on mount or week change
    useEffect(() => {
        if (scrollViewRef.current && hourPositions[minStartHour] !== undefined) {
            // Small timeout to ensure layout is ready
            setTimeout(() => {
                if (scrollViewRef.current) {
                    scrollViewRef.current.scrollTo({
                        y: hourPositions[minStartHour],
                        animated: true
                    });
                }
            }, 100);
        }
    }, [minStartHour, hourPositions, weekDays]);

    // 4. Build Timeline Structure (The "Map" of the vertical axis)
    const timelineStructure = useMemo(() => {
        const structure = [];
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
                    currentEmptyBlock = { start: h, end: h, id: `empty-${h}` };
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
        const positions = {};
        let currentY = 0;
        timelineStructure.forEach(block => {
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

    // 6. Process Events for Layout (Calculate Top, Height, DayIndex)
    const processedEvents = useMemo(() => {
        return weekEvents.map(event => {
            if (!event.startTime || !event.endTime) return null;

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
            let calculatedHeight = 0;
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
                const lastBlockEndY = lastBlock.type === 'hour'
                    ? hourPositions[lastBlock.value] + HOUR_HEIGHT
                    : hourPositions[lastBlock.end] + COLLAPSED_HEIGHT;

                realBottom = lastBlockEndY;
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
                dayIndex,
                top,
                height,
                color: getEventColor(event),
            };
        }).filter(Boolean);
    }, [weekEvents, hourPositions, activeHours, weekDays, timelineStructure]);

    // 7. Handle Overlaps (Columns)
    const eventsWithLayout = useMemo(() => {
        const daysCount = mode === 'week' ? 7 : 3;
        const eventsByDay = Array.from({ length: daysCount }, () => []);

        processedEvents.forEach(event => {
            if (event.dayIndex >= 0 && event.dayIndex < daysCount) {
                eventsByDay[event.dayIndex].push(event);
            }
        });

        const result = [];
        eventsByDay.forEach((dayEvents) => {
            dayEvents.sort((a, b) => a.top - b.top);

            const columns = [];
            dayEvents.forEach(event => {
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
            dayEvents.forEach(event => {
                event.widthPercent = 100 / totalColumns;
                event.leftPercent = event.colIndex * event.widthPercent;
                event.concurrentCount = totalColumns;
                result.push(event);
            });
        });

        return result;
    }, [processedEvents, mode]);

    // Helpers
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
        return `${startStr}. - ${endStr}`;
    }, [weekDays]);

    // Render
    return (
        <GestureDetector gesture={Gesture.Simultaneous(flingLeft, flingRight)}>
            <View style={{ flex: 1, backgroundColor: 'transparent' }}>

                {/* 1. HEADER & NAVIGATION (Date Selector) */}
                <View style={{ paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8 }}>
                    <View style={{
                        backgroundColor: Colors.neutral800,
                        borderRadius: 16,
                        paddingVertical: 8,
                        paddingHorizontal: 16,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <TouchableOpacity onPress={handlePrevPage} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Image
                                source={Images.arrowLeft}
                                style={{ width: 16, height: 16, tintColor: Colors.primary500 }}
                                resizeMode="contain"
                            />
                        </TouchableOpacity>

                        <View style={{ alignItems: 'center' }}>
                            <Text style={{
                                color: Colors.neutral100,
                                textTransform: 'uppercase',
                                fontSize: 16,
                                fontWeight: '700',
                                letterSpacing: 1,
                                marginBottom: 4
                            }}>
                                PLANNING
                            </Text>
                            <Text style={[Fonts.h4, { color: Colors.neutral00 }]}>
                                {dateRangeText}
                            </Text>
                        </View>

                        <TouchableOpacity onPress={handleNextPage} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Image
                                source={Images.arrowRight}
                                style={{ width: 16, height: 16, tintColor: Colors.primary500 }}
                                resizeMode="contain"
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Days Row */}
                <View style={{ flexDirection: 'row', paddingBottom: 10 }}>
                    <View style={{ width: 50 }} />
                    {weekDays.map((day, index) => {
                        const isToday = isSameDay(day, new Date());
                        // Calculate event count for this day
                        const dayEventsCount = weekEvents.filter(e => {
                            if (!e.date) return false;
                            return isSameDay(new Date(e.date), day);
                        }).length;

                        const hasEvents = dayEventsCount > 0;

                        return (
                            <View key={index} style={{ flex: 1, alignItems: 'center' }}>
                                {/* Day Name (LUN, MAR...) */}
                                <Text style={[Fonts.p3, {
                                    color: isToday ? Colors.primary500 : Colors.neutral300,
                                    marginBottom: 8,
                                    textTransform: 'uppercase',
                                    fontSize: 10,
                                    fontWeight: isToday ? 'bold' : 'normal'
                                }]}>
                                    {format(day, 'EEE', { locale: fr }).replace('.', '')}
                                </Text>

                                {/* Date Number Container */}
                                <View style={{ alignItems: 'center' }}>
                                    <View style={{
                                        width: 32,
                                        height: 32,
                                        borderRadius: 999,
                                        backgroundColor: isToday ? Colors.primary500 : (hasEvents ? Colors.neutral800 : 'transparent'),
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        position: 'relative'
                                    }}>
                                        <Text style={[Fonts.h3, {
                                            color: isToday ? Colors.neutral900 : Colors.neutral00,
                                            fontWeight: 'bold',
                                            fontSize: 14
                                        }]}>
                                            {format(day, 'd')}
                                        </Text>

                                        {/* Event Count Badge */}
                                        {dayEventsCount > 0 && !isToday && (
                                            <View style={{
                                                position: 'absolute',
                                                top: -4,
                                                right: -4,
                                                backgroundColor: Colors.primary500,
                                                borderRadius: 6,
                                                width: 14,
                                                height: 14,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                borderWidth: 1,
                                                borderColor: Colors.neutral900
                                            }}>
                                                <Text style={{ color: Colors.neutral00, fontSize: 8, fontWeight: 'bold' }}>
                                                    {dayEventsCount}
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* AUJ Pill (Only for Today) */}
                                    {isToday && (
                                        <View style={{
                                            marginTop: 4,
                                            backgroundColor: Colors.neutral800,
                                            paddingHorizontal: 6,
                                            paddingVertical: 2,
                                            borderRadius: 8
                                        }}>
                                            <Text style={{
                                                color: Colors.primary500,
                                                fontSize: 8,
                                                fontWeight: 'bold',
                                                textTransform: 'uppercase'
                                            }}>
                                                AUJ
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* Summary Button */}
                {weekEvents.length > 0 && (
                    <TouchableOpacity
                        onPress={onSummaryPress}
                        activeOpacity={0.7}
                        style={{
                            alignItems: 'center',
                            paddingVertical: 8,
                            backgroundColor: 'transparent',
                            borderBottomWidth: 1,
                            borderBottomColor: 'rgba(255,255,255,0.05)'
                        }}>
                        <Text style={[Fonts.p3, { color: Colors.primary500, fontWeight: '600' }]}>
                            {weekEvents.length} événements cette semaine ⬇
                        </Text>
                    </TouchableOpacity>
                )}

                {/* Timeline ScrollView */}
                <ScrollView
                    ref={scrollViewRef}
                    scrollEnabled={scrollEnabled}
                    contentContainerStyle={{ paddingBottom: 50, paddingTop: 24 }}
                >
                    <View style={{ flexDirection: 'row' }}>
                        {/* Time Column */}
                        <View style={{ width: 50 }}>
                            {timelineStructure.map((block, index) => (
                                <View key={index} style={{
                                    height: block.type === 'hour' ? HOUR_HEIGHT : COLLAPSED_HEIGHT,
                                    justifyContent: 'flex-start',
                                    alignItems: 'center',
                                    borderBottomWidth: 0,
                                }}>
                                    {block.type === 'hour' && (
                                        <Text style={[Fonts.p3, {
                                            color: Colors.neutral300,
                                            marginTop: -8,
                                            backgroundColor: 'transparent',
                                            fontSize: 10,
                                            fontWeight: 'bold'
                                        }]}>
                                            {`${block.value}:00`}
                                        </Text>
                                    )}
                                    {block.type === 'collapsed' && (
                                        <Text style={{ fontSize: 10, color: Colors.neutral700 }}>...</Text>
                                    )}
                                </View>
                            ))}
                        </View>

                        {/* Events Grid */}
                        <View style={{
                            flex: 1,
                            position: 'relative',
                            borderTopWidth: 1,
                            borderTopColor: 'rgba(255,255,255, 0.1)',
                            borderRightWidth: 1,
                            borderRightColor: 'rgba(255,255,255, 0.1)'
                        }}>
                            {/* Grid Lines & Day Columns Background */}
                            <View style={{ ...StyleSheet.absoluteFillObject, flexDirection: 'row' }}>
                                {weekDays.map((day, i) => {
                                    const isToday = isSameDay(day, new Date());
                                    return (
                                        <View key={`bg-col-${i}`} style={{
                                            flex: 1,
                                            borderLeftWidth: 1,
                                            borderLeftColor: 'rgba(255,255,255, 0.1)',
                                            backgroundColor: isToday ? `rgba(${parseInt(Colors.primary500.slice(1, 3), 16)}, ${parseInt(Colors.primary500.slice(3, 5), 16)}, ${parseInt(Colors.primary500.slice(5, 7), 16)}, 0.05)` : 'transparent'
                                        }} />
                                    );
                                })}
                            </View>

                            {/* Horizontal Grid Lines */}
                            {timelineStructure.map((block, index) => (
                                <View key={`grid-${index}`} style={{
                                    height: block.type === 'hour' ? HOUR_HEIGHT : COLLAPSED_HEIGHT,
                                    borderBottomWidth: 1,
                                    borderBottomColor: 'rgba(255,255,255, 0.1)',
                                    backgroundColor: block.type === 'collapsed' ? 'rgba(255,255,255, 0.05)' : 'transparent'
                                }} />
                            ))}

                            {/* Events */}
                            {eventsWithLayout.map((event) => {
                                const dayWidth = 100 / weekDays.length;
                                const left = (event.dayIndex * dayWidth) + (event.leftPercent * (dayWidth / 100));
                                const width = event.widthPercent * (dayWidth / 100);

                                const eventColor = event.color || Colors.primary500;
                                const isHex = eventColor.startsWith('#');
                                const bgOpacity = isHex ? `${eventColor}40` : 'rgba(1, 179, 244, 0.25)';
                                const borderOpacity = isHex ? `${eventColor}4D` : 'rgba(1, 179, 244, 0.3)';

                                // Content Data
                                const mainTitle = event.team?.name || event.category?.name || event.title || event.name || 'Event';
                                const eventType = event.type?.name || event.type;
                                const facilityName = event.facility?.name;

                                // Layout Constraints
                                const isWeekMode = mode === 'week';
                                const isTinyEvent = event.height < 25;
                                const isSmallEvent = event.height < 45;

                                // In Week Mode, we have very narrow columns.
                                // Strategy: Wrap text, smaller fonts, hide time if needed.
                                const titleLines = isWeekMode ? 2 : 1;
                                const showType = !isSmallEvent && eventType;
                                const showFacility = !isSmallEvent && facilityName;
                                const showTime = !isTinyEvent && (!isWeekMode || event.height > 60); // Hide time in week mode unless event is tall

                                return (
                                    <TouchableOpacity
                                        key={event.id}
                                        onPress={() => onEventPress?.(event)}
                                        style={{
                                            position: 'absolute',
                                            top: event.top + 1,
                                            height: event.height - 2,
                                            left: `${left}%`,
                                            width: `${width}%`,
                                            backgroundColor: bgOpacity,
                                            borderLeftWidth: isWeekMode ? 2 : 3, // Save 1px in week mode
                                            borderLeftColor: eventColor,
                                            borderWidth: 1,
                                            borderColor: borderOpacity,
                                            borderRadius: 4,
                                            padding: isWeekMode ? 1 : 2, // Save padding in week mode
                                            overflow: 'hidden',
                                            justifyContent: isTinyEvent ? 'center' : 'flex-start'
                                        }}
                                    >
                                        {/* Main Title (Team Name) */}
                                        <Text numberOfLines={titleLines} style={[Fonts.p3Bold, {
                                            color: Colors.neutral00,
                                            fontSize: isWeekMode ? 8 : (isTinyEvent ? 9 : 10),
                                            marginBottom: 0,
                                            lineHeight: isWeekMode ? 10 : (isTinyEvent ? 10 : 12)
                                        }]}>
                                            {mainTitle}
                                        </Text>

                                        {/* Event Type (e.g. Match, Entraînement) */}
                                        {showType && (
                                            <Text numberOfLines={1} style={{
                                                color: Colors.neutral300,
                                                fontSize: isWeekMode ? 7 : 9,
                                                fontFamily: Fonts.p3?.fontFamily,
                                                marginBottom: 0,
                                                marginTop: isWeekMode ? 1 : 0
                                            }}>
                                                {eventType}
                                            </Text>
                                        )}

                                        {/* Facility Name */}
                                        {showFacility && (
                                            <Text numberOfLines={1} style={{
                                                color: Colors.primary500,
                                                fontSize: isWeekMode ? 7 : 8,
                                                fontFamily: Fonts.p3?.fontFamily,
                                                marginTop: 0,
                                                fontWeight: 'bold'
                                            }}>
                                                {facilityName}
                                            </Text>
                                        )}

                                        {/* Time Range */}
                                        {showTime && (
                                            <Text numberOfLines={1} style={{
                                                color: Colors.neutral300,
                                                fontSize: isWeekMode ? 7 : 8,
                                                fontFamily: Fonts.p3?.fontFamily,
                                                marginTop: 0
                                            }}>
                                                {formatTime(event.startTime)} - {formatTime(event.endTime)}
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                </ScrollView >
            </View >
        </GestureDetector >
    );
};

PlanningWeekTimelineView.propTypes = {
    events: PropTypes.array,
    onEventPress: PropTypes.func,
    scrollEnabled: PropTypes.bool,
    currentDate: PropTypes.instanceOf(Date),
    onDateChange: PropTypes.func,
    mode: PropTypes.oneOf(['3days', 'week']),
    isInfiniteScroll: PropTypes.bool,
    maxSlots: PropTypes.number
};

export default PlanningWeekTimelineView;
