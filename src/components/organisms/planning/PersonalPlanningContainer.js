import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import {
  memo, useEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform,
  Text,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Loader from '@/components/atoms/loader/Loader';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import PlanningFullscreenButton from '@/components/organisms/planning/PlanningFullscreenButton';
import PlanningCalendarView from '@/components/organisms/planningCalendarView';
import PlanningWeekTimelineView from '@/components/organisms/planningWeekTimelineView';

import { RouteNames } from '@/navigation/routeNames';

import { getMyPlanning } from '@/services/event/eventService';
import { keepPreviousPageData } from '@/services/queryOptions';

import {
  getPlanningDefaultDate,
  getPlanningRange,
  normalizePlanningItems,
} from '@/utils/planning/planningSlots';

const PERSONAL_PLANNING_STALE_MS = 60 * 1000;

/**
 * Personal planning content.
 * @param {{ onDataResolved?: () => void, onSummaryPress?: () => void }} props
 * @returns {import('react').ReactElement}
 */
function PersonalPlanningContainer({ onDataResolved, onSummaryPress }) {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const {
    Alignments,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const [currentDate, setCurrentDate] = useState(getPlanningDefaultDate());
  const [viewMode, setViewMode] = useState('3days');
  const hasEmittedReadyRef = useRef(false);
  const isWebPlanning = Platform.OS === 'web';

  const planningRange = useMemo(
    () => getPlanningRange(currentDate, viewMode),
    [currentDate, viewMode],
  );
  const { data: eventsData, isLoading } = useQuery({
    placeholderData: keepPreviousPageData,
    queryFn: () => getMyPlanning(planningRange),
    queryKey: ['planning', 'personal', planningRange.from, planningRange.to],
    staleTime: PERSONAL_PLANNING_STALE_MS,
  });

  useEffect(() => {
    if (!eventsData || hasEmittedReadyRef.current) {
      return;
    }

    hasEmittedReadyRef.current = true;
    onDataResolved?.();
  }, [eventsData, onDataResolved, hasEmittedReadyRef]);

  const viewOptions = useMemo(() => ([
    { label: 'Semaine', value: 'week' },
    { label: '3 Jours', value: '3days' },
    { label: 'Mois', value: 'month' },
  ]), []);

  const modeDescription = useMemo(() => {
    if (viewMode === 'month') {
      return t('planning.mode.monthDescription', 'Vue globale du mois');
    }

    if (viewMode === 'week') {
      return t('planning.mode.weekDescription', 'Vue détaillée de la semaine');
    }

    return t('planning.mode.threeDaysDescription', 'Vue condensée sur 3 jours');
  }, [t, viewMode]);

  if (isLoading && !eventsData) {
    return <Loader />;
  }

  const events = normalizePlanningItems(eventsData?.data || []);

  const handleEventPress = (event) => {
    if (!event?.documentId) return;

    navigation.navigate(RouteNames.EventStack, {
      params: { eventId: event.documentId },
      screen: RouteNames.EventDetails,
    });
  };

  const handleOpenFullscreen = () => {
    navigation.navigate(RouteNames.PlanningWeekFullscreen, {
      contextLabel: t('planning.fullscreen.personal', 'Mon planning'),
      date: currentDate.toISOString(),
      sourceType: 'personal',
    });
  };

  const planningView = viewMode === 'month' ? (
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
      expandToContent={isWebPlanning}
      mode={viewMode}
      onDateChange={setCurrentDate}
      onEventPress={handleEventPress}
      onSummaryPress={onSummaryPress}
      scrollEnabled={!isWebPlanning}
    />
  );

  return (
    <View style={{ width: '100%' }}>
      <View style={[Alignments.alignCenter, Spaces.marginBottom[16], { width: '100%' }]}>
        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12], { width: '100%' }]}>
          <View style={{ flex: 1 }}>
            <SegmentedControl
              centerContent
              onChange={setViewMode}
              options={viewOptions}
              value={viewMode}
            />
          </View>
          <PlanningFullscreenButton
            borderColor={`${Colors.primary500}66`}
            onPress={handleOpenFullscreen}
          />
        </View>
        <Text style={[Fonts.p3, Fonts.primary100, Fonts.textCenter, Spaces.marginTop[8]]}>
          {modeDescription}
        </Text>
      </View>

      <View style={{ width: '100%' }}>
        {planningView}
      </View>
    </View>
  );
}

export default memo(PersonalPlanningContainer);
