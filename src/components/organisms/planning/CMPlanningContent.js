import { useQuery } from '@tanstack/react-query';
import { endOfWeek, startOfWeek } from 'date-fns';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  RefreshControl, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import PlanningWeekTimelineView from '@/components/organisms/planningWeekTimelineView/PlanningWeekTimelineViewV2';

import { getCMFacilities } from '@/services/facility/facilityService';
import { getCMClubs, getCMPlanning } from '@/services/multisportClub/multisportClubService';

/** @typedef {{ documentId?: string; name?: string }} NamedEntity */

/**
 * CM Planning Content - Reusable component for multisport planning
 * @param {object} props
 * @param {string} props.cmId - ID of the multisport club
 * @param {import('@react-navigation/native').NavigationProp<any>} props.navigation - Navigation object
 */
function CMPlanningContent({ cmId, navigation }) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  // Filter states
  const [selectedSectionId, setSelectedSectionId] = useState(/** @type {string | null} */ (null));
  const [selectedFacilityId, setSelectedFacilityId] = useState(/** @type {string | null} */ (null));

  // Fetch sections (for filter)
  const { data: sectionsData } = useQuery({
    enabled: !!cmId,
    queryFn: () => getCMClubs(cmId),
    queryKey: ['cm-clubs-list', cmId],
  });
  const typedSectionsData = /** @type {{ data?: NamedEntity[] } | undefined} */ (sectionsData);
  const sections = typedSectionsData?.data || [];

  // Fetch facilities (for filter)
  const { data: facilitiesData } = useQuery({
    enabled: !!cmId,
    queryFn: () => getCMFacilities(cmId),
    queryKey: ['cm-facilities-list', cmId],
  });
  const typedFacilitiesData = /** @type {{ data?: NamedEntity[] } | undefined} */ (facilitiesData);
  const facilities = typedFacilitiesData?.data || [];

  // Date state
  const [currentDate, setCurrentDate] = useState(new Date());

  // Calculate week range for API
  const from = useMemo(() => startOfWeek(currentDate, { weekStartsOn: 1 }).toISOString().split('T')[0], [currentDate]);
  const to = useMemo(() => endOfWeek(currentDate, { weekStartsOn: 1 }).toISOString().split('T')[0], [currentDate]);

  // Fetch planning
  const {
    data: planningData,
    error,
    isLoading,
    refetch,
  } = useQuery({
    enabled: !!cmId && !!from && !!to,
    queryFn: () => getCMPlanning(cmId, {
      from,
      installationId: selectedFacilityId || undefined,
      sectionId: selectedSectionId || undefined,
      to,
    }),
    queryKey: ['cm-planning', cmId, from, to, selectedSectionId, selectedFacilityId],
  });

  const typedPlanningData = /** @type {{ data?: any[] } | undefined} */ (planningData);
  const rawSlots = typedPlanningData?.data || [];

  // Map slots to component format
  const events = useMemo(() => rawSlots.map((/** @type {any} */ slot) => ({
    date: slot.startAt, // Ensure ISO string
    endTime: slot.endTime, // HH:mm
    facility: slot.installation ? { name: slot.installation.name } : null,
    id: slot.eventId,
    startTime: slot.startTime, // HH:mm
    title: slot.title,
    type: 'Entrainement', // Default or derive from data if available
    // You might want to map color or other props here if your API provides them
    team: { name: slot.title }, // Fallback for title display logic in component
    // We need original event ID for navigation
    documentId: slot.eventId,
    league_match: slot.leagueMatch,
  })), [rawSlots]);

  const handleEventPress = (/** @type {{ documentId?: string }} */ event) => {
    // Always navigate to generic EventDetails via EventStack
    // @ts-ignore
    if (event?.documentId) {
      navigation.navigate('EventStack', {
        params: { eventId: event.documentId },
        screen: 'EventDetails',
      });
    }
  };

  /**
   *
   * @param root0
   * @param root0.isSelected
   * @param root0.label
   * @param root0.onPress
   */
  function RenderFilterChip({ isSelected, label, onPress }) {
    return (
      <TouchableOpacity
        onPress={onPress}
        style={[
          ApplicationStyle.borderRadius16,
          Spaces.paddingHorizontal[12],
          Spaces.paddingVertical[8],
          {
            backgroundColor: isSelected ? '#01b3f4' : ApplicationStyle.backgroundColor.primary700.backgroundColor,
            borderColor: isSelected ? '#01b3f4' : '#2A3C55',
            borderWidth: 1,
          },
        ]}
      >
        <Text style={[
          Fonts.p3Bold,
          { color: isSelected ? '#FFFFFF' : '#9CA3AF' },
        ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[Alignments.fill, Spaces.paddingVertical[24]]}>
      <View style={[Spaces.paddingHorizontal[16], Spaces.marginBottom[16], Spaces.gap[12]]}>
        {/* Section Filters */}
        <ScrollView contentContainerStyle={[Spaces.gap[8]]} horizontal showsHorizontalScrollIndicator={false}>
          <RenderFilterChip
            isSelected={!selectedSectionId}
            label="Toutes sections"
            onPress={() => setSelectedSectionId(null)}
          />
          {sections.map((/** @type {NamedEntity} */ section) => (
            <RenderFilterChip
              isSelected={selectedSectionId === section.documentId}
              key={section.documentId}
              label={section.name || ''}
              onPress={() => setSelectedSectionId(section.documentId || null)}
            />
          ))}
        </ScrollView>

        {/* Facility Filters */}
        <ScrollView contentContainerStyle={[Spaces.gap[8]]} horizontal showsHorizontalScrollIndicator={false}>
          <RenderFilterChip
            isSelected={!selectedFacilityId}
            label="Toutes installations"
            onPress={() => setSelectedFacilityId(null)}
          />
          {facilities.map((/** @type {NamedEntity} */ facility) => (
            <RenderFilterChip
              isSelected={selectedFacilityId === facility.documentId}
              key={facility.documentId}
              label={facility.name || ''}
              onPress={() => setSelectedFacilityId(facility.documentId || null)}
            />
          ))}
        </ScrollView>
      </View>

      <WithDataWrapper
        error={error?.message}
        isLoading={isLoading}
        wrapperStyle={[{ flex: 1 }]}
      >
        <PlanningWeekTimelineView
          currentDate={currentDate}
          events={events}
          mode="week" // CM Planning is typically detailed week view
          onDateChange={setCurrentDate}
          onEventPress={handleEventPress}
        />
      </WithDataWrapper>
    </View>
  );
}

export default CMPlanningContent;
