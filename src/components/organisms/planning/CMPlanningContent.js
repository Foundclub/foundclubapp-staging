import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Text, View, ScrollView, RefreshControl, TouchableOpacity,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';

import useTheme from '@/theme/themeContext';

import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';

import { getCMPlanning, getCMClubs } from '@/services/multisportClub/multisportClubService';
import { getCMFacilities } from '@/services/facility/facilityService';
import PlanningWeekTimelineView from '@/components/organisms/planningWeekTimelineView/PlanningWeekTimelineViewV2';
import { startOfWeek, endOfWeek } from 'date-fns';

/** @typedef {{ documentId?: string; name?: string }} NamedEntity */

/**
 * CM Planning Content - Reusable component for multisport planning
 * @param {object} props
 * @param {string} props.cmId - ID of the multisport club
 * @param {import('@react-navigation/native').NavigationProp<any>} props.navigation - Navigation object
 */
function CMPlanningContent({ cmId, navigation }) {
    const {
        Alignments, ApplicationStyle, Fonts, Spaces, Colors,
    } = useTheme();
    const { t } = useTranslation();

    // Filter states
    const [selectedSectionId, setSelectedSectionId] = useState(/** @type {string | null} */ (null));
    const [selectedFacilityId, setSelectedFacilityId] = useState(/** @type {string | null} */ (null));

    // Fetch sections (for filter)
    const { data: sectionsData } = useQuery({
        queryKey: ['cm-clubs-list', cmId],
        queryFn: () => getCMClubs(cmId),
        enabled: !!cmId,
    });
    const typedSectionsData = /** @type {{ data?: NamedEntity[] } | undefined} */ (sectionsData);
    const sections = typedSectionsData?.data || [];

    // Fetch facilities (for filter)
    const { data: facilitiesData } = useQuery({
        queryKey: ['cm-facilities-list', cmId],
        queryFn: () => getCMFacilities(cmId),
        enabled: !!cmId,
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
        queryKey: ['cm-planning', cmId, from, to, selectedSectionId, selectedFacilityId],
        queryFn: () => getCMPlanning(cmId, {
            from,
            to,
            sectionId: selectedSectionId || undefined,
            installationId: selectedFacilityId || undefined,
        }),
        enabled: !!cmId && !!from && !!to,
    });

    const typedPlanningData = /** @type {{ data?: any[] } | undefined} */ (planningData);
    const rawSlots = typedPlanningData?.data || [];

    // Map slots to component format
    const events = useMemo(() => {
        return rawSlots.map((/** @type {any} */ slot) => ({
            id: slot.eventId,
            title: slot.title,
            date: slot.startAt, // Ensure ISO string
            startTime: slot.startTime, // HH:mm
            endTime: slot.endTime, // HH:mm
            facility: slot.installation ? { name: slot.installation.name } : null,
            type: 'Entrainement', // Default or derive from data if available
            // You might want to map color or other props here if your API provides them
            team: { name: slot.title }, // Fallback for title display logic in component
            // We need original event ID for navigation
            documentId: slot.eventId, 
            league_match: slot.leagueMatch,
        }));
    }, [rawSlots]);

    const handleEventPress = (/** @type {{ documentId?: string }} */ event) => {
        // Always navigate to generic EventDetails via EventStack
        // @ts-ignore
        if (event?.documentId) {
             navigation.navigate('EventStack', { 
                screen: 'EventDetails', 
                params: { eventId: event.documentId } 
            });
        }
    };

    const RenderFilterChip = (
        /** @type {{ label: string; isSelected: boolean; onPress: () => void }} */
        { label, isSelected, onPress }
    ) => (
        <TouchableOpacity
            onPress={onPress}
            style={[
                ApplicationStyle.borderRadius16,
                Spaces.paddingHorizontal[12],
                Spaces.paddingVertical[8],
                {
                    backgroundColor: isSelected ? '#01b3f4' : ApplicationStyle.backgroundColor.primary700.backgroundColor,
                    borderWidth: 1,
                    borderColor: isSelected ? '#01b3f4' : '#2A3C55',
                }
            ]}
        >
            <Text style={[
                Fonts.p3Bold,
                { color: isSelected ? '#FFFFFF' : '#9CA3AF' }
            ]}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    return (
        <View style={[Alignments.fill, Spaces.paddingVertical[24]]}>
            <View style={[Spaces.paddingHorizontal[16], Spaces.marginBottom[16], Spaces.gap[12]]}>
                {/* Section Filters */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[Spaces.gap[8]]}>
                    <RenderFilterChip
                        label="Toutes sections"
                        isSelected={!selectedSectionId}
                        onPress={() => setSelectedSectionId(null)}
                    />
                    {sections.map((/** @type {NamedEntity} */ section) => (
                        <RenderFilterChip
                            key={section.documentId}
                            label={section.name || ''}
                            isSelected={selectedSectionId === section.documentId}
                            onPress={() => setSelectedSectionId(section.documentId || null)}
                        />
                    ))}
                </ScrollView>

                {/* Facility Filters */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[Spaces.gap[8]]}>
                    <RenderFilterChip
                        label="Toutes installations"
                        isSelected={!selectedFacilityId}
                        onPress={() => setSelectedFacilityId(null)}
                    />
                    {facilities.map((/** @type {NamedEntity} */ facility) => (
                        <RenderFilterChip
                            key={facility.documentId}
                            label={facility.name || ''}
                            isSelected={selectedFacilityId === facility.documentId}
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
                    events={events}
                    currentDate={currentDate}
                    onDateChange={setCurrentDate}
                    onEventPress={handleEventPress}
                    mode="week" // CM Planning is typically detailed week view
                />
            </WithDataWrapper>
        </View>
    );
}

export default CMPlanningContent;
