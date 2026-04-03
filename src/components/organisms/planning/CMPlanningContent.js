import { useQuery } from '@tanstack/react-query';
import {
  isAfter,
  isSameDay,
  startOfDay,
} from 'date-fns';
import {
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import DateSlider from '@/components/molecules/dateSlider/DateSlider';
import EventCardNew from '@/components/molecules/eventCard/EventCardNew';
import LeagueHeaderSwitch from '@/components/molecules/header/LeagueHeaderSwitch';
import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import PlanningFullscreenButton from '@/components/organisms/planning/PlanningFullscreenButton';
import PlanningCalendarView from '@/components/organisms/planningCalendarView';
import PlanningWeekTimelineView from '@/components/organisms/planningWeekTimelineView';

import { RouteNames } from '@/navigation/routeNames';

import { getCMFacilities } from '@/services/facility/facilityService';
import { getCMClubs, getCMPlanning } from '@/services/multisportClub/multisportClubService';

import { resolveFacilityPlanningColor } from '@/utils/facilityPlanningColor';
import {
  getPlanningDefaultDate,
  getPlanningItemDate,
  getPlanningRange,
  normalizePlanningItems,
} from '@/utils/planning/planningSlots';

/** @typedef {{ documentId?: string; name?: string; planningColor?: string }} NamedEntity */

/**
 * CM planning screen content with timeline and event list.
 *
 * @param {object} props
 * @param {string} props.cmId
 * @param {import('@react-navigation/native').NavigationProp<any>} props.navigation
 * @param {boolean} [props.showTopHeader]
 * @returns {import('react').ReactElement}
 */
function CMPlanningContent({ cmId, navigation, showTopHeader = false }) {
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { t } = useTranslation();

  const [selectedSectionId, setSelectedSectionId] = useState(/** @type {string | null} */ (null));
  const [selectedFacilityId, setSelectedFacilityId] = useState(/** @type {string | null} */ (null));
  const [viewMode, setViewMode] = useState('week');
  const [currentDate, setCurrentDate] = useState(getPlanningDefaultDate());
  const [listStartDate, setListStartDate] = useState(getPlanningDefaultDate());
  const [listAnchorY, setListAnchorY] = useState(0);
  const scrollRef = useRef(null);

  const planningRange = useMemo(
    () => getPlanningRange(currentDate, viewMode),
    [currentDate, viewMode],
  );

  const {
    data: sectionsData,
    error: sectionsError,
    refetch: refetchSections,
  } = useQuery({
    enabled: !!cmId,
    queryFn: () => getCMClubs(cmId),
    queryKey: ['cm-clubs-list', cmId],
  });
  const sections = sectionsData?.data || [];

  const {
    data: facilitiesData,
    error: facilitiesError,
    refetch: refetchFacilities,
  } = useQuery({
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
    queryKey: [
      'cm-planning',
      cmId,
      planningRange.from,
      planningRange.to,
      viewMode,
      selectedSectionId,
      selectedFacilityId,
    ],
  });

  const events = useMemo(
    () => normalizePlanningItems(planningData?.data || []),
    [planningData?.data],
  );

  const sortedListEvents = useMemo(() => {
    const compareDate = startOfDay(listStartDate);

    return [...events]
      .filter((event) => {
        const eventDate = getPlanningItemDate(event);
        if (!eventDate) return false;
        return isSameDay(eventDate, compareDate) || isAfter(eventDate, compareDate);
      })
      .sort((left, right) => {
        const leftDate = getPlanningItemDate(left);
        const rightDate = getPlanningItemDate(right);

        if (!leftDate || !rightDate) return 0;

        if (leftDate.getTime() !== rightDate.getTime()) {
          return leftDate.getTime() - rightDate.getTime();
        }

        const leftStart = String(left?.startTime || '');
        const rightStart = String(right?.startTime || '');
        return leftStart.localeCompare(rightStart, 'fr');
      });
  }, [events, listStartDate]);

  const viewOptions = useMemo(() => ([
    { label: t('planning.mode.weekShort', 'Semaine'), value: 'week' },
    { label: t('planning.mode.threeDaysShort', '3 jours'), value: '3days' },
    { label: t('planning.mode.monthShort', 'Mois'), value: 'month' },
  ]), [t]);
  const filtersError = sectionsError || facilitiesError;

  const handleEventPress = (event) => {
    if (!event?.documentId) return;

    navigation.navigate(RouteNames.EventStack, {
      params: { eventId: event.documentId },
      screen: RouteNames.EventDetails,
    });
  };

  const handleOpenFullscreen = () => {
    const selectedSection = sections.find((section) => section.documentId === selectedSectionId);
    const selectedFacility = facilities.find((facility) => facility.documentId === selectedFacilityId);
    const contextDetailParts = [
      selectedSection?.name || null,
      selectedFacility?.name || null,
    ].filter(Boolean);

    navigation.navigate(RouteNames.PlanningWeekFullscreen, {
      cmId,
      contextDetailLabel: contextDetailParts.join(' - ') || null,
      contextLabel: t('planning.fullscreen.cm', 'Planning omnisport'),
      date: currentDate.toISOString(),
      facilityId: selectedFacilityId,
      facilityMeta: selectedFacility
        ? {
          allowOverflowRequests: selectedFacility?.allowOverflowRequests !== false,
          maxSlots: Number(selectedFacility?.maxSlots || 1),
          name: selectedFacility?.name || null,
          planningColor: resolveFacilityPlanningColor(selectedFacility) || Colors.primary500,
        }
        : null,
      sectionId: selectedSectionId,
      sourceType: 'cm',
    });
  };

  const handleSummaryPress = () => {
    scrollRef.current?.scrollTo({
      animated: true,
      y: Math.max(0, listAnchorY - 16),
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
      expandToContent
      mode={viewMode}
      onDateChange={setCurrentDate}
      onEventPress={handleEventPress}
      onSummaryPress={handleSummaryPress}
      scrollEnabled={false}
    />
  );

  return (
    <ScrollView
      contentContainerStyle={[Spaces.paddingVertical[24], Spaces.paddingBottom[40], Spaces.gap[24]]}
      ref={scrollRef}
      showsVerticalScrollIndicator={false}
    >
      <View style={[Spaces.paddingHorizontal[16], Spaces.gap[12]]}>
        {showTopHeader ? (
          <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.marginBottom[4]]}>
            <LeagueHeaderSwitch />
            <View style={[Alignments.row, Alignments.alignCenter]}>
              <NotificationBadge />
              <ProfileButton />
            </View>
          </View>
        ) : null}

        <View style={[Spaces.gap[4]]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
            {t('planning.cm.title', 'Mon planning')}
          </Text>
          <Text style={[Fonts.p3, Fonts.primary100]}>
            {t(
              'planning.cm.description',
              'Retrouvez le planning des sections et la liste des événements de votre club.',
            )}
          </Text>
        </View>

        {filtersError ? (
          <View
            style={[
              ApplicationStyle.backgroundColor.primary700,
              ApplicationStyle.borderRadius16,
              ApplicationStyle.borderWidth1,
              Spaces.padding[16],
              Spaces.gap[8],
              { borderColor: `${Colors.gold500}55` },
            ]}
          >
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
              {t('planning.cm.filtersErrorTitle', 'Certains filtres du planning sont indisponibles')}
            </Text>
            <Text style={[Fonts.p3, Fonts.neutral100]}>
              {t(
                'planning.cm.filtersErrorDescription',
                "Le planning reste accessible, mais nous n'avons pas pu charger toutes les sections ou installations.",
              )}
            </Text>
            <Button
              onPress={() => {
                refetchSections();
                refetchFacilities();
              }}
              title={t('common.retry', 'R\u00E9essayer')}
              variant="Secondary"
            />
          </View>
        ) : null}

        <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
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
        wrapperStyle={[Spaces.paddingHorizontal[16], Spaces.gap[24]]}
      >
        <View style={[Spaces.gap[24]]}>
          {planningView}

          <View
            onLayout={(event) => setListAnchorY(event.nativeEvent.layout.y)}
            style={[Spaces.gap[12]]}
          >
            <View style={[Spaces.gap[8]]}>
              <Text style={[Fonts.h3, Fonts.neutral00]}>
                {t('planning.eventsFrom', 'Évènements à partir de')}
              </Text>
              <DateSlider
                onDateSelected={setListStartDate}
                selectedDate={listStartDate}
              />
            </View>

            {sortedListEvents.length ? (
              <View style={[Spaces.gap[16]]}>
                {sortedListEvents.map((event) => (
                  <EventCardNew
                    item={event}
                    key={event.documentId || `${event.id || 'event'}-${event.startAt || event.date || ''}`}
                    onDecline={() => {}}
                    onJoin={() => {}}
                    onLogin={() => {}}
                    onParticipate={() => {}}
                    onPress={() => handleEventPress(event)}
                    useFacilityAccentColor
                  />
                ))}
              </View>
            ) : (
              <View
                style={[
                  ApplicationStyle.backgroundColor.primary700,
                  ApplicationStyle.borderRadius24,
                  Spaces.padding[16],
                  Spaces.gap[6],
                ]}
              >
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                  {t('planning.cm.emptyListTitle', 'Aucun événement dans cette liste')}
                </Text>
                <Text style={[Fonts.p3, Fonts.primary100]}>
                  {t(
                    'planning.cm.emptyListDescription',
                    'Changez la date ou les filtres pour afficher d’autres événements.',
                  )}
                </Text>
              </View>
            )}
          </View>
        </View>
      </WithDataWrapper>
    </ScrollView>
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
