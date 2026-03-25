import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { addDays, format, parseISO } from 'date-fns';
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
  getPlanningDefaultDate,
  getPlanningRange,
  normalizePlanningItems,
} from '@/utils/planning/planningSlots';

const PERSONAL_PLANNING_STALE_MS = 15 * 1000;

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
  const { data, isFetching, isLoading } = useQuery({
    staleTime: PERSONAL_PLANNING_STALE_MS,
    ...planningQuery,
  });

  const events = normalizePlanningItems(data?.data || []);
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

  return (
    <ScreenContainer
      bgImage="bg2"
      contentContainerStyle={[{ paddingBottom: Math.max(insets.bottom, 8) }]}
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
            accessibilityLabel="Semaine precedente"
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
            accessibilityLabel="Fermer le planning plein ecran"
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
        </View>

        <View style={{ flex: 1 }}>
          {isLoading || isFetching ? (
            <Loader />
          ) : (
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
          )}
        </View>
      </View>
    </ScreenContainer>
  );
}

export default PlanningWeekFullscreen;
