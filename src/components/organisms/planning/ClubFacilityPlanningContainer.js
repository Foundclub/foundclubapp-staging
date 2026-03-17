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

import { RouteNames } from '@/navigation/routeNames';

import { getClubPlanning } from '@/services/event/eventService';
import { useClubFacilityContext } from '@/services/facility/facilityQueries';
import { getClubSharedPlanning } from '@/services/multisportClub/multisportClubService';

import { resolveFacilityPlanningColor } from '@/utils/facilityPlanningColor';
import {
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
    Colors, Fonts, Spaces,
  } = useTheme();
  const { canManageTeam, USER_ROLES, userData } = useAuth();
  const [selectedFacilityId, setSelectedFacilityId] = useState(null); // null = All
  const [currentDate, setCurrentDate] = useState(new Date());
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
    queryFn: () => getClubPlanning(clubId, {
      facilityId: selectedFacilityId || undefined,
      from: planningRange.from,
      to: planningRange.to,
    }),
    queryKey: ['club-planning', clubId, planningRange.from, planningRange.to, selectedFacilityId],
  });

  const { data: sharedPlanningData, isLoading: isLoadingSharedPlanning } = useQuery({
    enabled: Boolean(clubId && resolvedCmId && canAccessSharedPlanning && planningScope === 'shared'),
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
    if (!selectedFacilityId) return;
    const facilityExists = displayedFacilities.some((facility) => getFacilityId(facility) === selectedFacilityId);
    if (!facilityExists) {
      setSelectedFacilityId(null);
    }
  }, [displayedFacilities, selectedFacilityId]);

  const isLoadingPlanning = isLoadingFacilities || (planningScope === 'shared' ? isLoadingSharedPlanning : isLoadingEvents);
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
        <SegmentedControl
          centerContent
          onChange={setViewMode}
          options={viewOptions}
          value={viewMode}
        />
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
