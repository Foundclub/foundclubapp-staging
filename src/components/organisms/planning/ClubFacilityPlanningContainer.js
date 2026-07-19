import { useNavigation } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Loader from '@/components/atoms/loader/Loader';
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import PlanningFullscreenButton from '@/components/organisms/planning/PlanningFullscreenButton';

import { RouteNames } from '@/navigation/routeNames';

import { getClubPlanning } from '@/services/event/eventService';
import { useClubFacilityContext } from '@/services/facility/facilityQueries';
import { getClubSharedPlanning } from '@/services/multisportClub/multisportClubService';
import { keepPreviousPageData } from '@/services/queryOptions';

import {
  FACILITY_CONFLICT_MODES,
  getFacilityConflictMode,
} from '@/utils/facilityConflictMode';
import { resolveFacilityPlanningColor } from '@/utils/facilityPlanningColor';
import {
  getPlanningDefaultDate,
  getPlanningPeakOccupancy,
  getPlanningRange,
  normalizePlanningItems,
} from '@/utils/planning/planningSlots';

import PlanningCalendarView from '../planningCalendarView';
import PlanningWeekTimelineView from '../planningWeekTimelineView';

const getFacilityId = (facility) => facility?.documentId || facility?.id || null;

/**
 *
 * @param root0
 * @param root0.clubId
 * @param root0.cmId
 * @param root0.initialFacilityId
 * @param root0.initialScope
 * @param root0.initialSelectionKey
 * @param root0.allowSharedPlanning
 */
function ClubFacilityPlanningContainer({
  allowSharedPlanning = false,
  clubId,
  cmId = null,
  initialFacilityId = null,
  initialScope = 'club',
  initialSelectionKey = null,
}) {
  const navigation = useNavigation();
  const { t } = useTranslation();
  const {
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  } = useTheme();
  const { canManageTeam, USER_ROLES, userData } = useAuth();
  const [selectedFacilityId, setSelectedFacilityId] = useState(null); // null = All
  const [currentDate, setCurrentDate] = useState(getPlanningDefaultDate());
  const [viewMode, setViewMode] = useState('week'); // '3days' | 'week' | 'month'
  const [planningScope, setPlanningScope] = useState(initialScope);

  const {
    data: facilityContext,
    isLoading: isLoadingFacilities,
  } = useClubFacilityContext({ clubId, cmId });

  const resolvedCmId = facilityContext?.cmId || cmId || null;
  const clubFacilities = facilityContext?.clubFacilities || [];
  const sharedFacilities = facilityContext?.sharedFacilities || [];

  const isPresidentOfClub = useMemo(() => (
    userData?.role?.name === USER_ROLES.president
    && (userData?.club?.documentId || userData?.club?.id) === clubId
  ), [USER_ROLES.president, clubId, userData]);

  const isCoachOfClub = useMemo(() => (
    (userData?.trainedTeams || []).some((team) => (team?.club?.documentId || team?.club?.id) === clubId)
  ), [clubId, userData?.trainedTeams]);

  const isMultisportAdmin = useMemo(() => (
    (userData?.multisportClubs || []).some((multisportClub) => multisportClub?.documentId === resolvedCmId)
  ), [resolvedCmId, userData?.multisportClubs]);

  const canAccessSharedPlanning = Boolean(
    resolvedCmId
    && (allowSharedPlanning || (canManageTeam && (isPresidentOfClub || isCoachOfClub || isMultisportAdmin))),
  );
  const hasSharedScope = canAccessSharedPlanning && sharedFacilities.length > 0;

  const planningRange = useMemo(
    () => getPlanningRange(currentDate, viewMode),
    [currentDate, viewMode],
  );

  const { data: eventsData, isLoading: isLoadingEvents } = useQuery({
    enabled: !!clubId,
    placeholderData: keepPreviousPageData,
    queryFn: () => getClubPlanning(clubId, {
      facilityId: selectedFacilityId || undefined,
      from: planningRange.from,
      to: planningRange.to,
    }),
    queryKey: ['club-planning', clubId, planningRange.from, planningRange.to, selectedFacilityId],
    staleTime: 30_000,
  });

  const { data: sharedPlanningData, isLoading: isLoadingSharedPlanning } = useQuery({
    enabled: Boolean(clubId && resolvedCmId && canAccessSharedPlanning && planningScope === 'shared'),
    placeholderData: keepPreviousPageData,
    queryFn: () => getClubSharedPlanning(resolvedCmId, clubId, {
      from: planningRange.from,
      installationId: selectedFacilityId || undefined,
      to: planningRange.to,
    }),
    queryKey: [
      'club-shared-planning',
      clubId,
      resolvedCmId,
      planningRange.from,
      planningRange.to,
      selectedFacilityId,
      planningScope,
    ],
    staleTime: 30_000,
  });
  const sharedEvents = useMemo(
    () => normalizePlanningItems(sharedPlanningData?.data || []),
    [sharedPlanningData?.data],
  );

  const filteredClubEvents = useMemo(
    () => normalizePlanningItems(eventsData?.data || []),
    [eventsData?.data],
  );

  const displayedEvents = planningScope === 'shared' ? sharedEvents : filteredClubEvents;
  const displayedFacilities = planningScope === 'shared' ? sharedFacilities : clubFacilities;
  const selectedFacility = useMemo(
    () => displayedFacilities.find((facility) => getFacilityId(facility) === selectedFacilityId) || null,
    [displayedFacilities, selectedFacilityId],
  );

  const facilityPlanningSummary = useMemo(() => {
    if (!selectedFacility || !selectedFacilityId) return null;

    const facilityEvents = displayedEvents.filter(
      (event) => getFacilityId(event?.facility) === selectedFacilityId,
    );
    const occupancy = getPlanningPeakOccupancy(facilityEvents);
    const maxSlots = Math.max(1, Number(selectedFacility?.maxSlots || 1));
    const peakConcurrent = occupancy.maxConcurrent;
    const remainingAtPeak = Math.max(0, maxSlots - peakConcurrent);
    const conflictMode = getFacilityConflictMode(selectedFacility);

    return {
      allowsImmediateConfirmation: conflictMode === FACILITY_CONFLICT_MODES.ALLOW_AND_NOTIFY,
      conflictMode,
      eventCount: occupancy.itemCount,
      facilityColor: resolveFacilityPlanningColor(selectedFacility) || Colors.primary500,
      maxSlots,
      peakConcurrent,
      reachedCapacity: peakConcurrent >= maxSlots,
      remainingAtPeak,
      requiresApproval: conflictMode === FACILITY_CONFLICT_MODES.PENDING_VALIDATION,
    };
  }, [Colors.primary500, displayedEvents, selectedFacility, selectedFacilityId]);

  useEffect(() => {
    if (!hasSharedScope && planningScope === 'shared') {
      setPlanningScope('club');
    }
  }, [hasSharedScope, planningScope]);

  useEffect(() => {
    if (initialSelectionKey === null) return;
    const nextScope = hasSharedScope && initialScope === 'shared' ? 'shared' : 'club';
    setPlanningScope(nextScope);
    setSelectedFacilityId(initialFacilityId || null);
  }, [hasSharedScope, initialFacilityId, initialScope, initialSelectionKey]);

  useEffect(() => {
    if (isLoadingFacilities || !selectedFacilityId) return;
    const facilityExists = displayedFacilities.some(
      (facility) => getFacilityId(facility) === selectedFacilityId,
    );
    if (!facilityExists) {
      setSelectedFacilityId(null);
    }
  }, [displayedFacilities, isLoadingFacilities, selectedFacilityId]);

  const isLoadingPlanning = planningScope === 'shared'
    ? (isLoadingFacilities || isLoadingSharedPlanning)
    : isLoadingEvents;
  const viewOptions = useMemo(() => ([
    { label: t('planning.mode.weekShort', 'Semaine'), value: 'week' },
    { label: t('planning.mode.threeDaysShort', '3 jours'), value: '3days' },
    { label: t('planning.mode.monthShort', 'Mois'), value: 'month' },
  ]), [t]);

  const handleEventPress = (event) => {
    if (event?.documentId) {
      navigation.navigate(RouteNames.EventStack, {
        params: { eventId: event.documentId },
        screen: RouteNames.EventDetails,
      });
    }
  };

  const handleOpenFullscreen = () => {
    const activeFacility = displayedFacilities.find(
      (facility) => getFacilityId(facility) === selectedFacilityId,
    );
    let selectedFacilityLabel = null;
    if (activeFacility) {
      selectedFacilityLabel = activeFacility?.isShared
        ? `${activeFacility.name} - MS`
        : activeFacility.name;
    }
    const fullscreenContextLabel = planningScope === 'shared'
      ? t('planning.fullscreen.clubShared', 'Planning partage')
      : t('planning.fullscreen.club', 'Planning club');

    navigation.navigate(RouteNames.PlanningWeekFullscreen, {
      clubId,
      cmId: resolvedCmId,
      contextDetailLabel: selectedFacilityLabel || null,
      contextLabel: fullscreenContextLabel,
      date: currentDate.toISOString(),
      facilityId: selectedFacilityId,
      facilityMeta: activeFacility
        ? {
          capacityConflictMode: getFacilityConflictMode(activeFacility),
          maxSlots: Number(activeFacility?.maxSlots || 1),
          name: activeFacility?.name || null,
          planningColor: resolveFacilityPlanningColor(activeFacility) || Colors.primary500,
        }
        : null,
      sourceType: planningScope === 'shared' ? 'clubShared' : 'club',
    });
  };

  const facilitySummaryMessage = useMemo(() => {
    if (!facilityPlanningSummary) return '';

    if (facilityPlanningSummary.reachedCapacity) {
      if (facilityPlanningSummary.allowsImmediateConfirmation) {
        return t(
          'facilityList.planning.capacityReachedOverflow',
          'La capacité a déjà été atteinte sur cette période. Les nouveaux dépassements restent autorises et notifieront les dirigeants.',
        );
      }

      return t(
        'facilityList.planning.capacityReachedStrict',
        'La capacité a déjà été atteinte sur cette période. Les nouveaux dépassements passeront en demande en attente.',
      );
    }

    return t(
      'facilityList.planning.capacityAvailable',
      '{{count}} slot(s) restaient disponibles au pic de charge.',
      { count: facilityPlanningSummary.remainingAtPeak },
    );
  }, [facilityPlanningSummary, t]);

  return (
    <View style={{ flex: 1 }}>
      {hasSharedScope ? (
        <View style={[Spaces.paddingHorizontal[16], Spaces.marginBottom[12]]}>
          <SegmentedControl
            centerContent
            onChange={setPlanningScope}
            options={[
              { label: t('facilityList.planning.scopeClub', 'Mon club'), value: 'club' },
              { label: t('facilityList.planning.scopeShared', 'Partagees'), value: 'shared' },
            ]}
            value={planningScope}
          />
        </View>
      ) : null}

      <View style={[Spaces.paddingHorizontal[16], Spaces.marginBottom[12]]}>
        <View style={{ alignItems: 'center', flexDirection: 'row', gap: 12 }}>
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
      </View>

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
            <Text
              style={[
                Fonts.p3Bold,
                selectedFacilityId === null ? Fonts.neutral900 : Fonts.neutral500,
              ]}
            >
              {planningScope === 'shared'
                ? t('facilityList.planning.allSharedFacilities', 'Toutes partagées')
                : t('facilityList.planning.allClubFacilities', 'Toutes installations')}
            </Text>
          </TouchableOpacity>

          {displayedFacilities.map((facility) => {
            const facilityId = getFacilityId(facility);
            const label = facility?.isShared
              ? `${facility.name} - MS`
              : facility.name;
            const facilityColor = resolveFacilityPlanningColor(facility) || Colors.primary500;
            const isSelected = selectedFacilityId === facilityId;
            return (
              <TouchableOpacity
                key={facilityId}
                onPress={() => setSelectedFacilityId(facilityId)}
                style={[
                  Spaces.paddingVertical[8],
                  Spaces.paddingHorizontal[16],
                  { borderRadius: 20, borderWidth: 1 },
                  isSelected
                    ? { backgroundColor: `${facilityColor}22`, borderColor: facilityColor }
                    : { backgroundColor: Colors.neutral00, borderColor: Colors.neutral200 },
                ]}
              >
                <Text
                  style={[
                    Fonts.p3Bold,
                    isSelected ? { color: facilityColor } : Fonts.neutral500,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {facilityPlanningSummary ? (
        <View style={[Spaces.paddingHorizontal[16], Spaces.marginBottom[16]]}>
          <View
            style={[
              ApplicationStyle.borderRadius16,
              ApplicationStyle.borderWidth1,
              Spaces.padding[16],
              Spaces.gap[12],
              {
                backgroundColor: 'rgba(4, 31, 44, 0.88)',
                borderColor: `${facilityPlanningSummary.facilityColor}66`,
              },
            ]}
          >
            <View style={[Spaces.gap[4]]}>
              <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                {t('facilityList.planning.capacityTitle', 'Capacité installation')}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {selectedFacility?.name || t('facilityList.planning.selectedFacility', 'Installation sélectionnée')}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[
                `${facilityPlanningSummary.maxSlots} slot${facilityPlanningSummary.maxSlots > 1 ? 's' : ''}`,
                `Pic ${facilityPlanningSummary.peakConcurrent}/${facilityPlanningSummary.maxSlots}`,
                `${facilityPlanningSummary.eventCount} événement${facilityPlanningSummary.eventCount > 1 ? 's' : ''}`,
                facilityPlanningSummary.allowsImmediateConfirmation
                  ? t('facilityList.planning.overflowAllowed', 'Autorise et notifier')
                  : t('facilityList.planning.overflowBlocked', 'Demande en attente'),
              ].map((label, index) => (
                <View
                  key={`${label}-${index + 1}`}
                  style={[
                    ApplicationStyle.borderRadius100,
                    ApplicationStyle.borderWidth1,
                    Spaces.paddingHorizontal[10],
                    Spaces.paddingVertical[6],
                    {
                      backgroundColor: index === 1
                        ? `${facilityPlanningSummary.facilityColor}22`
                        : 'rgba(255,255,255,0.05)',
                      borderColor: index === 1
                        ? `${facilityPlanningSummary.facilityColor}66`
                        : `${Colors.primary500}33`,
                    },
                  ]}
                >
                  <Text
                    style={[
                      Fonts.p4Bold,
                      index === 1 ? { color: facilityPlanningSummary.facilityColor } : Fonts.primary100,
                    ]}
                  >
                    {label}
                  </Text>
                </View>
              ))}
            </View>

            <Text
              style={[
                Fonts.p3,
                facilityPlanningSummary.reachedCapacity
                  ? Fonts.warning500
                  : Fonts.neutral200,
              ]}
            >
              {facilitySummaryMessage}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Planning View */}
      {isLoadingPlanning ? (
        <Loader />
      ) : (
        <View style={{ flex: 1 }}>
          {planningScope === 'shared' && displayedFacilities.length === 0 ? (
            <View style={[Spaces.paddingHorizontal[16], Spaces.paddingVertical[8]]}>
              <Text style={[Fonts.p2, Fonts.primary100]}>
                {t('facilityList.planning.sharedEmpty', 'Aucune installation partagée disponible pour ce club.')}
              </Text>
            </View>
          ) : null}
          {viewMode === 'month' ? (
            <PlanningCalendarView
              currentDate={currentDate}
              events={displayedEvents}
              onDateSelect={setCurrentDate}
              onEventPress={handleEventPress}
            />
          ) : (
            <PlanningWeekTimelineView
              currentDate={currentDate}
              events={displayedEvents}
              mode={viewMode}
              onDateChange={setCurrentDate}
              onEventPress={handleEventPress}
              scrollEnabled
            />
          )}
        </View>
      )}
    </View>
  );
}

export default ClubFacilityPlanningContainer;
