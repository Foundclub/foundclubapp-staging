import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { getEvents } from '@/services/event/eventService';
import useTheme from '@/theme/themeContext';

import Loader from '@/components/atoms/loader/Loader';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import PlanningCalendarView from '@/components/organisms/planningCalendarView/PlanningCalendarView';
import PlanningWeekTimelineView from '@/components/organisms/planningWeekTimelineView/PlanningWeekTimelineViewV2';

/**
 * Personal planning content.
 * @param {{ onSummaryPress?: () => void }} props
 * @returns {import('react').ReactElement}
 */
function PersonalPlanningContainer({ onSummaryPress }) {
  const navigation = useNavigation();
  const {
    Alignments, Fonts, Spaces,
  } = useTheme();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('3days'); // '3days' | 'week' | 'month'

  const { endDate, startDate } = useMemo(() => {
    const now = currentDate;
    if (viewMode === 'month') {
      return {
        endDate: endOfMonth(now),
        startDate: startOfMonth(now),
      };
    }
    if (viewMode === '3days') {
      return {
        endDate: endOfDay(addDays(now, 2)),
        startDate: startOfDay(now),
      };
    }
    return {
      endDate: endOfWeek(now, { weekStartsOn: 1 }),
      startDate: startOfWeek(now, { weekStartsOn: 1 }),
    };
  }, [currentDate, viewMode]);

  const { data: eventsData, isLoading } = useQuery({
    queryFn: () => getEvents({
      // @ts-ignore
      myTeams: true,
      pageSize: 100,
      sort: 'date:asc',
      startDateAfter: startDate,
      startDateBefore: endDate,
    }),
    queryKey: ['events', 'personal', startDate.toISOString(), endDate.toISOString()],
  });

  /**
   * @param {import('@/domains/event/types').FCEvent} event
   */
  const handleEventPress = (event) => {
    if (!event?.documentId) return;
    // @ts-ignore
    navigation.navigate('EventStack', {
      params: { eventId: event.documentId },
      screen: 'EventDetails',
    });
  };

  const viewOptions = useMemo(() => ([
    { label: 'Semaine', value: 'week' },
    { label: '3 Jours', value: '3days' },
    { label: 'Mois', value: 'month' },
  ]), []);

  if (isLoading) {
    return <Loader />;
  }

  const events = eventsData?.data || [];

  return (
    <View style={{ width: '100%' }}>
      <View style={[Alignments.alignCenter, Spaces.marginBottom[16], { width: '100%' }]}>
        <SegmentedControl
          centerContent
          onChange={setViewMode}
          options={viewOptions}
          value={viewMode}
        />
        <Text style={[Fonts.p3, Fonts.primary100, Fonts.textCenter, Spaces.marginTop[8]]}>
          {viewMode === 'month'
            ? 'Vue globale du mois'
            : viewMode === 'week'
              ? 'Vue detaillee de la semaine'
              : 'Vue condensee sur 3 jours'}
        </Text>
      </View>

      {viewMode === 'month' ? (
        <PlanningCalendarView
          compact
          currentDate={currentDate}
          // @ts-ignore
          events={events}
          onDateSelect={setCurrentDate}
          onEventPress={handleEventPress}
        />
      ) : (
        <PlanningWeekTimelineView
          currentDate={currentDate}
          // @ts-ignore
          events={events}
          mode={viewMode}
          onDateChange={setCurrentDate}
          onEventPress={handleEventPress}
          onSummaryPress={onSummaryPress}
          scrollEnabled={false}
        />
      )}
    </View>
  );
}

export default PersonalPlanningContainer;
