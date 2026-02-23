import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import React, { useMemo, useState } from 'react';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Loader from '@/components/atoms/loader/Loader';

import { RouteNames } from '@/navigation/routeNames';

import { getClubEvents } from '@/services/event/eventService';
import { getFacilities } from '@/services/facility/facilityService';

import PlanningCalendarView from '../planningCalendarView/PlanningCalendarView';
import PlanningWeekTimelineView from '../planningWeekTimelineView/PlanningWeekTimelineViewV2';

/**
 *
 * @param root0
 * @param root0.clubId
 */
function ClubFacilityPlanningContainer({ clubId }) {
  const navigation = useNavigation();
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const [selectedFacilityId, setSelectedFacilityId] = useState(null); // null = All
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('week'); // '3days' | 'week' | 'month'

  // Fetch Facilities
  const { data: facilitiesData } = useQuery({
    enabled: !!clubId,
    queryFn: () => getFacilities(clubId),
    queryKey: ['facilities', clubId],
  });
  const facilities = facilitiesData?.data || [];

  // Fetch Events
  const { data: eventsData, isLoading: isLoadingEvents } = useQuery({
    enabled: !!clubId,
    queryFn: () => getClubEvents(clubId),
    queryKey: ['clubEvents', clubId],
  });
  const events = eventsData?.data || [];

  // Filter Events
  const filteredEvents = useMemo(() => {
    let result = events;
    if (selectedFacilityId) {
      result = events.filter((e) => e.facility?.documentId === selectedFacilityId || e.facility?.id === selectedFacilityId);
    }
    return result;
  }, [events, selectedFacilityId]);

  // Get current facility capacity
  const currentFacility = facilities.find((f) => f.documentId === selectedFacilityId || f.id === selectedFacilityId);
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
          contentContainerStyle={[Spaces.paddingHorizontal[16], Spaces.gap[8]]}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          <TouchableOpacity
            onPress={() => setSelectedFacilityId(null)}
            style={[
              Spaces.paddingVertical[8],
              Spaces.paddingHorizontal[16],
              { borderRadius: 20, borderWidth: 1 },
              selectedFacilityId === null
                ? { backgroundColor: Colors.primary500, borderColor: Colors.primary500 }
                : { backgroundColor: Colors.neutral00, borderColor: Colors.neutral200 },
            ]}
          >
            <Text style={[
              Fonts.p3Bold,
              selectedFacilityId === null ? Fonts.neutral900 : Fonts.neutral500,
            ]}
            >
              Tout
            </Text>
          </TouchableOpacity>

          {facilities.map((facility) => (
            <TouchableOpacity
              key={facility.documentId || facility.id}
              onPress={() => setSelectedFacilityId(facility.documentId || facility.id)}
              style={[
                Spaces.paddingVertical[8],
                Spaces.paddingHorizontal[16],
                { borderRadius: 20, borderWidth: 1 },
                selectedFacilityId === (facility.documentId || facility.id)
                  ? { backgroundColor: Colors.primary500, borderColor: Colors.primary500 }
                  : { backgroundColor: Colors.neutral00, borderColor: Colors.neutral200 },
              ]}
            >
              <Text style={[
                Fonts.p3Bold,
                selectedFacilityId === (facility.documentId || facility.id) ? Fonts.neutral900 : Fonts.neutral500,
              ]}
              >
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
                        compact
                        currentDate={currentDate}
                        events={filteredEvents}
                        onDateSelect={setCurrentDate}
                        onEventPress={handleEventPress}
                      />
                    ) : (
                      <PlanningWeekTimelineView
                        currentDate={currentDate}
                        events={filteredEvents}
                        isInfiniteScroll
                        maxSlots={selectedFacilityId ? maxSlots : null}
                        mode={viewMode}
                        onDateChange={setCurrentDate}
                        onEventPress={handleEventPress}
                        scrollEnabled
                      />
                    )}
                  </View>
                )
            }
    </View>
  );
}

export default ClubFacilityPlanningContainer;
