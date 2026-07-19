import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import {
  addDays,
  format,
  isSameWeek,
  parseISO,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  useCallback, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import PlanningWeekTimelineView from '@/components/organisms/planningWeekTimelineView';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  getClubPlanning,
  getMyPlanning,
} from '@/services/event/eventService';
import {
  getClubSharedPlanning,
  getCMPlanning,
} from '@/services/multisportClub/multisportClubService';

import {
  lockToLandscape,
  lockToPortrait,
} from '@/utils/device/orientation';
import {
  FACILITY_CONFLICT_MODES,
  getFacilityConflictMode,
} from '@/utils/facilityConflictMode';
import {
  getPlanningDefaultDate,
  getPlanningPeakOccupancy,
  getPlanningRange,
  normalizePlanningItems,
} from '@/utils/planning/planningSlots';

const PERSONAL_PLANNING_STALE_MS = 60 * 1000;

const FULLSCREEN_SOURCE_TYPES = {
  club: 'club',
  clubShared: 'clubShared',
  cm: 'cm',
  personal: 'personal',
};

const getInitialDate = (rawDate) => {
  if (typeof rawDate === 'string') {
    const parsedDate = new Date(rawDate);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate;
    }
  }

  return getPlanningDefaultDate();
};

const getPlanningQuery = ({
  clubId,
  cmId,
  facilityId,
  planningRange,
  sectionId,
  sourceType,
}) => {
  switch (sourceType) {
    case FULLSCREEN_SOURCE_TYPES.club:
      return {
        enabled: Boolean(clubId),
        queryFn: () => getClubPlanning(clubId, {
          facilityId: facilityId || undefined,
          from: planningRange.from,
          to: planningRange.to,
        }),
        queryKey: ['planning', 'fullscreen', 'club', clubId, planningRange.from, planningRange.to, facilityId || 'all'],
      };
    case FULLSCREEN_SOURCE_TYPES.clubShared:
      return {
        enabled: Boolean(clubId && cmId),
        queryFn: () => getClubSharedPlanning(cmId, clubId, {
          from: planningRange.from,
          installationId: facilityId || undefined,
          to: planningRange.to,
        }),
        queryKey: ['planning', 'fullscreen', 'club-shared', cmId, clubId, planningRange.from, planningRange.to, facilityId || 'all'],
      };
    case FULLSCREEN_SOURCE_TYPES.cm:
      return {
        enabled: Boolean(cmId),
        queryFn: () => getCMPlanning(cmId, {
          from: planningRange.from,
          installationId: facilityId || undefined,
          sectionId: sectionId || undefined,
          to: planningRange.to,
        }),
        queryKey: ['planning', 'fullscreen', 'cm', cmId, planningRange.from, planningRange.to, facilityId || 'all', sectionId || 'all'],
      };
    case FULLSCREEN_SOURCE_TYPES.personal:
    default:
      return {
        enabled: true,
        queryFn: () => getMyPlanning(planningRange),
        queryKey: ['planning', 'fullscreen', 'personal', planningRange.from, planningRange.to],
      };
  }
};

/**
 * Dedicated fullscreen week-planning screen.
 * @returns {import('react').ReactElement}
 */
function PlanningWeekFullscreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const {
    Alignments,
    ApplicationStyle,
    Colors,
    Fonts,
    Images,
    Spaces,
  } = useTheme();

  const sourceType = route?.params?.sourceType || FULLSCREEN_SOURCE_TYPES.personal;
  const clubId = route?.params?.clubId || null;
  const cmId = route?.params?.cmId || null;
  const contextLabel = route?.params?.contextLabel || null;
  const contextDetailLabel = route?.params?.contextDetailLabel || null;
  const facilityId = route?.params?.facilityId || null;
  const facilityMeta = route?.params?.facilityMeta || null;
  const sectionId = route?.params?.sectionId || null;

  const [currentDate, setCurrentDate] = useState(getInitialDate(route?.params?.date));

  useFocusEffect(useCallback(() => {
    const timer = setTimeout(() => {
      lockToLandscape();
    }, 10);

    return () => {
      clearTimeout(timer);
      lockToPortrait();
    };
  }, []));

  const planningRange = useMemo(
    () => getPlanningRange(currentDate, 'week'),
    [currentDate],
  );
  const planningQuery = useMemo(() => getPlanningQuery({
    clubId,
    cmId,
    facilityId,
    planningRange,
    sectionId,
    sourceType,
  }), [clubId, cmId, facilityId, planningRange, sectionId, sourceType]);
  const {
    data,
    error,
    isFetching,
    isLoading,
    refetch,
  } = useQuery({
    staleTime: PERSONAL_PLANNING_STALE_MS,
    ...planningQuery,
  });

  const events = normalizePlanningItems(data?.data || []);
  const hasEvents = events.length > 0;
  const facilityPlanningSummary = useMemo(() => {
    if (!facilityId || !facilityMeta) return null;

    const occupancy = getPlanningPeakOccupancy(events);
    const maxSlots = Math.max(1, Number(facilityMeta?.maxSlots || 1));
    const peakConcurrent = occupancy.maxConcurrent;
    const remainingAtPeak = Math.max(0, maxSlots - peakConcurrent);

    return {
      allowsImmediateConfirmation: getFacilityConflictMode(facilityMeta) === FACILITY_CONFLICT_MODES.ALLOW_AND_NOTIFY,
      eventCount: occupancy.itemCount,
      facilityColor: facilityMeta?.planningColor || Colors.primary500,
      maxSlots,
      peakConcurrent,
      reachedCapacity: peakConcurrent >= maxSlots,
      remainingAtPeak,
      requiresApproval: getFacilityConflictMode(facilityMeta) === FACILITY_CONFLICT_MODES.PENDING_VALIDATION,
    };
  }, [Colors.primary500, events, facilityId, facilityMeta]);
  const weekLabel = useMemo(() => {
    const fromDate = parseISO(planningRange.from);
    const toDate = parseISO(planningRange.to);
    return `${format(fromDate, 'd MMM', { locale: fr })} - ${format(toDate, 'd MMM yyyy', { locale: fr })}`;
  }, [planningRange.from, planningRange.to]);
  const planningContextLabel = useMemo(() => {
    if (contextLabel) {
      return contextLabel;
    }

    switch (sourceType) {
      case FULLSCREEN_SOURCE_TYPES.club:
        return t('planning.fullscreen.club', 'Planning club');
      case FULLSCREEN_SOURCE_TYPES.clubShared:
        return t('planning.fullscreen.clubShared', 'Planning partage');
      case FULLSCREEN_SOURCE_TYPES.cm:
        return t('planning.fullscreen.cm', 'Planning omnisport');
      case FULLSCREEN_SOURCE_TYPES.personal:
      default:
        return t('planning.fullscreen.personal', 'Mon planning');
    }
  }, [contextLabel, sourceType, t]);
  const planningContextDisplayLabel = useMemo(() => {
    if (!contextDetailLabel) {
      return planningContextLabel;
    }

    return `${planningContextLabel} - ${contextDetailLabel}`;
  }, [contextDetailLabel, planningContextLabel]);
  const isCurrentWeek = useMemo(
    () => isSameWeek(currentDate, getPlanningDefaultDate(), { weekStartsOn: 1 }),
    [currentDate],
  );
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

  const handleClose = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleEventPress = useCallback((event) => {
    if (!event?.documentId) return;

    navigation.navigate(RouteNames.EventStack, {
      params: { eventId: event.documentId },
      screen: RouteNames.EventDetails,
    });
  }, [navigation]);

  const handlePrevWeek = useCallback(() => {
    setCurrentDate((previousDate) => addDays(previousDate, -7));
  }, []);

  const handleNextWeek = useCallback(() => {
    setCurrentDate((previousDate) => addDays(previousDate, 7));
  }, []);

  const handleBackToCurrentWeek = useCallback(() => {
    setCurrentDate(getPlanningDefaultDate());
  }, []);
  const planningContent = useMemo(() => {
    if (isLoading || isFetching) {
      return <Loader />;
    }

    if (error) {
      return (
        <View
          style={{
            alignItems: 'center',
            alignSelf: 'center',
            backgroundColor: 'rgba(10, 23, 34, 0.84)',
            borderColor: 'rgba(255,255,255,0.08)',
            borderRadius: 24,
            borderWidth: 1,
            justifyContent: 'center',
            maxWidth: 520,
            padding: 24,
            width: '100%',
          }}
        >
          <Text style={[Fonts.h4Bold, Fonts.neutral00, Fonts.textCenter, Spaces.marginBottom[8]]}>
            Impossible de charger le planning
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral100, Fonts.textCenter, Spaces.marginBottom[16]]}>
            Le planning de cette semaine n’a pas pu être récupère. Réessaie ou change de semaine.
          </Text>
          <Button onPress={() => refetch()} title="Reessayer" variant="Primary" />
        </View>
      );
    }

    if (!hasEvents) {
      return (
        <View
          style={{
            alignItems: 'center',
            alignSelf: 'center',
            backgroundColor: 'rgba(10, 23, 34, 0.84)',
            borderColor: 'rgba(255,255,255,0.08)',
            borderRadius: 24,
            borderWidth: 1,
            justifyContent: 'center',
            maxWidth: 520,
            padding: 24,
            width: '100%',
          }}
        >
          <Text style={[Fonts.h4Bold, Fonts.neutral00, Fonts.textCenter, Spaces.marginBottom[8]]}>
            Aucun créneau cette semaine
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral100, Fonts.textCenter, Spaces.marginBottom[16]]}>
            Change de semaine pour explorer le planning ou reviens à la semaine actuelle.
          </Text>
          <View style={[Alignments.row, Spaces.gap[12]]}>
            {!isCurrentWeek ? (
              <Button onPress={handleBackToCurrentWeek} title="Aujourd’hui" variant="Secondary" />
            ) : null}
            <Button onPress={handleNextWeek} title="Semaine suivante" variant="Primary" />
          </View>
        </View>
      );
    }

    return (
      <PlanningWeekTimelineView
        compactFullscreen
        currentDate={currentDate}
        events={events}
        mode="week"
        onDateChange={setCurrentDate}
        onEventPress={handleEventPress}
        scrollEnabled
        showHeader={false}
        showUntimedSection={false}
      />
    );
  }, [
    Alignments.row,
    Fonts.h4Bold,
    Fonts.neutral00,
    Fonts.neutral100,
    Fonts.p2,
    Fonts.textCenter,
    Spaces.gap,
    Spaces.marginBottom,
    currentDate,
    error,
    events,
    handleBackToCurrentWeek,
    handleEventPress,
    handleNextWeek,
    hasEvents,
    isCurrentWeek,
    isFetching,
    isLoading,
    refetch,
    setCurrentDate,
  ]);

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[{ paddingBottom: Math.max(insets.bottom, 8) }]}
      contentWidth="wide"
      responsivePadding
      style={[{ paddingHorizontal: 8 }]}
      withHeaderPadding={false}
    >
      <View style={{ flex: 1, paddingTop: Math.max(insets.top, 4) }}>
        <View
          style={[
            Alignments.row,
            Alignments.alignCenter,
            Alignments.justifySpaceBetween,
            Spaces.marginBottom[8],
            {
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderColor: `${Colors.primary500}26`,
              borderRadius: 16,
              borderWidth: 1,
              minHeight: 40,
              paddingHorizontal: 6,
              width: '100%',
            },
          ]}
        >
          <TouchableOpacity
            accessibilityLabel="Semaine précédente"
            accessibilityRole="button"
            hitSlop={8}
            onPress={handlePrevWeek}
            style={{
              alignItems: 'center',
              borderRadius: 10,
              height: 30,
              justifyContent: 'center',
              width: 30,
            }}
          >
            <Image
              resizeMode="contain"
              source={Images.arrowLeft}
              style={{ height: 12, tintColor: Colors.primary500, width: 12 }}
            />
          </TouchableOpacity>

          <View style={{ flex: 1, paddingHorizontal: 6 }}>
            <Text
              numberOfLines={1}
              style={[{
                color: Colors.primary500,
                fontFamily: Fonts?.p3Bold?.fontFamily,
                fontSize: 10,
                letterSpacing: 0.3,
                marginBottom: 1,
                textAlign: 'center',
                textTransform: 'uppercase',
              }]}
            >
              {planningContextDisplayLabel}
            </Text>
            <Text
              numberOfLines={1}
              style={[Fonts.p2Bold, Fonts.neutral00, Fonts.textCenter, { fontSize: 13 }]}
            >
              {weekLabel}
            </Text>
          </View>

          <TouchableOpacity
            accessibilityLabel="Semaine suivante"
            accessibilityRole="button"
            hitSlop={8}
            onPress={handleNextWeek}
            style={{
              alignItems: 'center',
              borderRadius: 10,
              height: 30,
              justifyContent: 'center',
              width: 30,
            }}
          >
            <Image
              resizeMode="contain"
              source={Images.arrowRight}
              style={{ height: 12, tintColor: Colors.primary500, width: 12 }}
            />
          </TouchableOpacity>

          <TouchableOpacity
            accessibilityLabel="Fermer le planning plein écran"
            accessibilityRole="button"
            hitSlop={8}
            onPress={handleClose}
            style={{
              alignItems: 'center',
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderColor: `${Colors.primary500}66`,
              borderRadius: 12,
              borderWidth: 1,
              height: 30,
              justifyContent: 'center',
              marginLeft: 6,
              width: 30,
            }}
          >
            <Image
              source={Images.close}
              style={{ height: 12, tintColor: Colors.neutral00, width: 12 }}
            />
          </TouchableOpacity>
          {!isCurrentWeek ? (
            <TouchableOpacity
              accessibilityLabel="Revenir à la semaine actuelle"
              accessibilityRole="button"
              hitSlop={8}
              onPress={handleBackToCurrentWeek}
              style={{
                alignItems: 'center',
                backgroundColor: 'rgba(1,179,244,0.14)',
                borderColor: `${Colors.primary500}66`,
                borderRadius: 12,
                borderWidth: 1,
                height: 30,
                justifyContent: 'center',
                marginLeft: 6,
                minWidth: 86,
                paddingHorizontal: 10,
              }}
            >
              <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>Aujourd’hui</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {facilityPlanningSummary ? (
          <View
            style={[
              ApplicationStyle.borderRadius16,
              ApplicationStyle.borderWidth1,
              Spaces.padding[12],
              Spaces.marginBottom[8],
              Spaces.gap[8],
              {
                backgroundColor: 'rgba(4, 31, 44, 0.88)',
                borderColor: `${facilityPlanningSummary.facilityColor}66`,
              },
            ]}
          >
            <View>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {t('facilityList.planning.capacityTitle', 'Capacité installation')}
              </Text>
              <Text style={[Fonts.p4, Fonts.neutral200]}>
                {facilityMeta?.name || t('facilityList.planning.selectedFacility', 'Installation sélectionnée')}
              </Text>
            </View>

            <View style={[Alignments.row, Alignments.wrap, Spaces.gap[8]]}>
              {[
                `${facilityPlanningSummary.maxSlots} slot${facilityPlanningSummary.maxSlots > 1 ? 's' : ''}`,
                `Pic ${facilityPlanningSummary.peakConcurrent}/${facilityPlanningSummary.maxSlots}`,
                `${facilityPlanningSummary.eventCount} événement${facilityPlanningSummary.eventCount > 1 ? 's' : ''}`,
              ].map((label, index) => (
                <View
                  key={`${label}-${index + 1}`}
                  style={[
                    ApplicationStyle.borderRadius100,
                    ApplicationStyle.borderWidth1,
                    Spaces.paddingHorizontal[8],
                    Spaces.paddingVertical[4],
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
                Fonts.p4,
                facilityPlanningSummary.reachedCapacity ? Fonts.warning500 : Fonts.neutral200,
              ]}
            >
              {facilitySummaryMessage}
            </Text>
          </View>
        ) : null}

        <View style={{ flex: 1 }}>
          {planningContent}
        </View>
      </View>
    </ScreenContainer>
  );
}

export default PlanningWeekFullscreen;
