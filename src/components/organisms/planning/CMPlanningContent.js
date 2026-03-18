import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import PlanningCalendarView from '@/components/organisms/planningCalendarView';
import PlanningWeekTimelineView from '@/components/organisms/planningWeekTimelineView';

import { getCMFacilities } from '@/services/facility/facilityService';
import { getCMClubs, getCMPlanning } from '@/services/multisportClub/multisportClubService';

import { resolveFacilityPlanningColor } from '@/utils/facilityPlanningColor';
import {
  getPlanningDefaultDate,
  getPlanningRange,
  normalizePlanningItems,
} from '@/utils/planning/planningSlots';

/** @typedef {{ documentId?: string; name?: string; planningColor?: string }} NamedEntity */

function CMPlanningContent({ cmId, navigation }) {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();

  const [selectedSectionId, setSelectedSectionId] = useState(/** @type {string | null} */ (null));
  const [selectedFacilityId, setSelectedFacilityId] = useState(/** @type {string | null} */ (null));
  const [viewMode, setViewMode] = useState('week');
  const [currentDate, setCurrentDate] = useState(getPlanningDefaultDate());

  const planningRange = useMemo(
    () => getPlanningRange(currentDate, viewMode),
    [currentDate, viewMode],
  );

  const { data: sectionsData } = useQuery({
    enabled: !!cmId,
    queryFn: () => getCMClubs(cmId),
    queryKey: ['cm-clubs-list', cmId],
  });
  const sections = sectionsData?.data || [];

  const { data: facilitiesData } = useQuery({
    enabled: !!cmId,
    queryFn: () => getCMFacilities(cmId),
    queryKey: ['cm-facilities-list', cmId],
  });
  const facilities = facilitiesData?.data || [];

  const {
    data: planningData,
    error,
    isLoading,
  } = useQuery({
    enabled: !!cmId && !!planningRange.from && !!planningRange.to,
    queryFn: () => getCMPlanning(cmId, {
      from: planningRange.from,
      installationId: selectedFacilityId || undefined,
      sectionId: selectedSectionId || undefined,
      to: planningRange.to,
    }),
    queryKey: ['cm-planning', cmId, planningRange.from, planningRange.to, viewMode, selectedSectionId, selectedFacilityId],
  });

  const events = useMemo(
    () => normalizePlanningItems(planningData?.data || []),
    [planningData?.data],
  );

  const viewOptions = useMemo(() => ([
    { label: t('planning.mode.weekShort', 'Semaine'), value: 'week' },
    { label: t('planning.mode.threeDaysShort', '3 jours'), value: '3days' },
    { label: t('planning.mode.monthShort', 'Mois'), value: 'month' },
  ]), [t]);

  const handleEventPress = (event) => {
    if (!event?.documentId) return;
    navigation.navigate('EventStack', {
      params: { eventId: event.documentId },
      screen: 'EventDetails',
    });
  };

  return (
    <View style={[Alignments.fill, Spaces.paddingVertical[24]]}>
      <View style={[Spaces.paddingHorizontal[16], Spaces.marginBottom[16], Spaces.gap[12]]}>
        <SegmentedControl
          centerContent
          onChange={setViewMode}
          options={viewOptions}
          value={viewMode}
        />

        <ScrollView contentContainerStyle={[Spaces.gap[8]]} horizontal showsHorizontalScrollIndicator={false}>
          <PlanningFilterChip
            applicationStyle={ApplicationStyle}
            fonts={Fonts}
            isSelected={!selectedSectionId}
            label={t('planning.filters.allSections', 'Toutes sections')}
            onPress={() => setSelectedSectionId(null)}
            spaces={Spaces}
          />
          {sections.map((/** @type {NamedEntity} */ section) => (
            <PlanningFilterChip
              applicationStyle={ApplicationStyle}
              fonts={Fonts}
              isSelected={selectedSectionId === section.documentId}
              key={section.documentId}
              label={section.name || ''}
              onPress={() => setSelectedSectionId(section.documentId || null)}
              spaces={Spaces}
            />
          ))}
        </ScrollView>

        <ScrollView contentContainerStyle={[Spaces.gap[8]]} horizontal showsHorizontalScrollIndicator={false}>
          <PlanningFilterChip
            applicationStyle={ApplicationStyle}
            fonts={Fonts}
            isSelected={!selectedFacilityId}
            label={t('planning.filters.allFacilities', 'Toutes installations')}
            onPress={() => setSelectedFacilityId(null)}
            spaces={Spaces}
          />
          {facilities.map((/** @type {NamedEntity} */ facility) => (
            <PlanningFilterChip
              accentColor={resolveFacilityPlanningColor(facility) || Colors.primary500}
              applicationStyle={ApplicationStyle}
              fonts={Fonts}
              isSelected={selectedFacilityId === facility.documentId}
              key={facility.documentId}
              label={facility.name || ''}
              onPress={() => setSelectedFacilityId(facility.documentId || null)}
              spaces={Spaces}
            />
          ))}
        </ScrollView>
      </View>

      <WithDataWrapper
        error={error?.message}
        isLoading={isLoading}
        wrapperStyle={[{ flex: 1 }]}
      >
        {viewMode === 'month' ? (
          <PlanningCalendarView
            currentDate={currentDate}
            events={events}
            onDateSelect={setCurrentDate}
            onEventPress={handleEventPress}
          />
        ) : (
          <PlanningWeekTimelineView
            currentDate={currentDate}
            events={events}
            mode={viewMode}
            onDateChange={setCurrentDate}
            onEventPress={handleEventPress}
          />
        )}
      </WithDataWrapper>
    </View>
  );
}

function PlanningFilterChip({
  accentColor = '#01b3f4',
  applicationStyle,
  fonts,
  isSelected,
  label,
  onPress,
  spaces,
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        applicationStyle.borderRadius16,
        spaces.paddingHorizontal[12],
        spaces.paddingVertical[8],
        {
          backgroundColor: isSelected
            ? `${accentColor}22`
            : applicationStyle.backgroundColor.primary700.backgroundColor,
          borderColor: isSelected ? accentColor : '#2A3C55',
          borderWidth: 1,
        },
      ]}
    >
      <Text
        style={[
          fonts.p3Bold,
          { color: isSelected ? accentColor : '#9CA3AF' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default CMPlanningContent;
