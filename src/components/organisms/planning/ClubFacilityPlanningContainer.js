import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import PlanningWeekTimelineView from '../planningWeekTimelineView/PlanningWeekTimelineViewV2';
import { getFacilities } from '@/services/facility/facilityService';
import { getClubEvents } from '@/services/event/eventService';
import Loader from '@/components/atoms/loader/Loader';
import { RouteNames } from '@/navigation/routeNames';
import useTheme from '@/theme/themeContext';

import PlanningCalendarView from '../planningCalendarView/PlanningCalendarView';

const ClubFacilityPlanningContainer = ({ clubId }) => {
    const navigation = useNavigation();
    const { Spaces, Fonts, Colors, Alignments } = useTheme();
    const [selectedFacilityId, setSelectedFacilityId] = useState(null); // null = All
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState('week'); // '3days' | 'week' | 'month'

    // Fetch Facilities
    const { data: facilitiesData } = useQuery({
        queryKey: ['facilities', clubId],
        queryFn: () => getFacilities(clubId),
        enabled: !!clubId,
    });
    const facilities = facilitiesData?.data || [];

    // Fetch Events
    const { data: eventsData, isLoading: isLoadingEvents } = useQuery({
        queryKey: ['clubEvents', clubId],
        queryFn: () => getClubEvents(clubId),
        enabled: !!clubId,
    });
    const events = eventsData?.data || [];

    // Filter Events
    const filteredEvents = useMemo(() => {
        let result = events;
        if (selectedFacilityId) {
            result = events.filter(e => e.facility?.documentId === selectedFacilityId || e.facility?.id === selectedFacilityId);
        }
        return result;
    }, [events, selectedFacilityId]);

    // Get current facility capacity
    const currentFacility = facilities.find(f => f.documentId === selectedFacilityId || f.id === selectedFacilityId);
    const maxSlots = currentFacility?.maxSlots || 1;

    const handleEventPress = (event) => {
        if (event?.documentId) {
            navigation.navigate(RouteNames.EventDetails, { eventId: event.documentId });
        }
    };

    return (
        <View style={{ flex: 1 }}>
            {/* Filters */}
            <View style={{ marginBottom: 16 }}>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={[Spaces.paddingHorizontal[16], Spaces.gap[8]]}
                >
                    <TouchableOpacity
                        onPress={() => setSelectedFacilityId(null)}
                        style={[
                            Spaces.paddingVertical[8],
                            Spaces.paddingHorizontal[16],
                            { borderRadius: 20, borderWidth: 1 },
                            selectedFacilityId === null
                                ? { backgroundColor: Colors.primary500, borderColor: Colors.primary500 }
                                : { backgroundColor: Colors.neutral00, borderColor: Colors.neutral200 }
                        ]}
                    >
                        <Text style={[
                            Fonts.p3Bold,
                            selectedFacilityId === null ? Fonts.neutral900 : Fonts.neutral500
                        ]}>
                            Tout
                        </Text>
                    </TouchableOpacity>

                    {facilities.map(facility => (
                        <TouchableOpacity
                            key={facility.documentId || facility.id}
                            onPress={() => setSelectedFacilityId(facility.documentId || facility.id)}
                            style={[
                                Spaces.paddingVertical[8],
                                Spaces.paddingHorizontal[16],
                                { borderRadius: 20, borderWidth: 1 },
                                selectedFacilityId === (facility.documentId || facility.id)
                                    ? { backgroundColor: Colors.primary500, borderColor: Colors.primary500 }
                                    : { backgroundColor: Colors.neutral00, borderColor: Colors.neutral200 }
                            ]}
                        >
                            <Text style={[
                                Fonts.p3Bold,
                                selectedFacilityId === (facility.documentId || facility.id) ? Fonts.neutral900 : Fonts.neutral500
                            ]}>
                                {facility.name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Planning View */}
            {
                isLoadingEvents ? (
                    <Loader />
                ) : (
                    <View style={{ flex: 1 }}>
                        {viewMode === 'month' ? (
                            <PlanningCalendarView
                                events={filteredEvents}
                                onEventPress={handleEventPress}
                                compact={true}
                                currentDate={currentDate}
                                onDateSelect={setCurrentDate}
                            />
                        ) : (
                            <PlanningWeekTimelineView
                                events={filteredEvents}
                                scrollEnabled={true}
                                maxSlots={selectedFacilityId ? maxSlots : null}
                                onEventPress={handleEventPress}
                                isInfiniteScroll={true}
                                mode={viewMode}
                                currentDate={currentDate}
                                onDateChange={setCurrentDate}
                            />
                        )}
                    </View>
                )
            }
        </View>
    );
};

export default ClubFacilityPlanningContainer;
