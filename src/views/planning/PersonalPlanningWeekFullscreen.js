import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import {
  addDays,
  format,
  isSameDay,
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
  Linking,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getUserRoleKey } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Loader from '@/components/atoms/loader/Loader';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import PlanningWeekTimelineView from '@/components/organisms/planningWeekTimelineView';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import {
  useCollectiviteClubs,
  useManagingCollectiviteId,
} from '@/services/collectivite/collectiviteQueries';
import {
  getClubPlanning,
  getMyPlanning,
} from '@/services/event/eventService';
import { getFacilityPlanning } from '@/services/facility/facilityService';
import {
  getClubSharedPlanning,
  getCMPlanning,
} from '@/services/multisportClub/multisportClubService';

import {
  lockToPortrait,
  unlockAllOrientations,
} from '@/utils/device/orientation';
import {
  FACILITY_CONFLICT_MODES,
  getFacilityConflictMode,
} from '@/utils/facilityConflictMode';
import { assignClubPlanningColors } from '@/utils/facilityPlanningColor';
import {
  getPlanningDefaultDate,
  getPlanningItemDate,
  getPlanningPeakOccupancy,
  getPlanningRange,
  getPlanningTimeLabel,
  normalizePlanningItems,
} from '@/utils/planning/planningSlots';

const PERSONAL_PLANNING_STALE_MS = 60 * 1000;

// COLL1B (29/09) — `facility` : le planning d UNE installation, lu par tout membre d un
// club qui l utilise (route du lot 1b). Lecture seule : chaque bloc dit « club · equipe »,
// seuls ceux du club du lecteur s ouvrent (le serveur ne donne l id que de ceux-la).
const FULLSCREEN_SOURCE_TYPES = {
  club: 'club',
  clubShared: 'clubShared',
  cm: 'cm',
  facility: 'facility',
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
    case FULLSCREEN_SOURCE_TYPES.facility:
      return {
        enabled: Boolean(facilityId),
        queryFn: () => getFacilityPlanning(facilityId, {
          from: planningRange.from,
          to: planningRange.to,
        }),
        queryKey: [
          'planning', 'fullscreen', 'facility', facilityId, planningRange.from, planningRange.to,
        ],
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
  const facilityId = route?.params?.facilityId || null;
  const sectionId = route?.params?.sectionId || null;

  const [currentDate, setCurrentDate] = useState(getInitialDate(route?.params?.date));
  // PLANNING-PORTRAIT (01/10, decision d'Adel « D6 A ») : l'ecran SUIT le telephone.
  // Tenu droit, une semaine ne laissait que ~50 pt par jour (mesure FINITIONS5) : on y
  // montre UN jour ; tourne, la semaine, comme avant.
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;
  const pageDays = isLandscape ? 7 : 1;

  // L'orientation n'est plus FORCEE en paysage (V1803) : elle est LIBEREE, et l'app
  // revient en portrait en sortant. Le module natif savait deja le faire
  // (`unlockToUserPreference`) : aucune nouvelle construction de l'app n'est requise.
  useFocusEffect(useCallback(() => {
    const timer = setTimeout(() => {
      unlockAllOrientations();
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

  // COLL1D — sur le planning d'UNE installation, une couleur par club (SPEC §2 C) :
  // tous les blocs y partagent la meme installation, donc la meme couleur sans cela.
  const normalizedEvents = normalizePlanningItems(data?.data || []);
  const events = sourceType === FULLSCREEN_SOURCE_TYPES.facility
    ? assignClubPlanningColors(normalizedEvents)
    : normalizedEvents;
  const hasEvents = events.length > 0;
  // COLL1D — le texte de capacite parle a CELUI qui lit : les « depassements » et les
  // « demandes en attente » ne regardent que ceux qui posent des evenements (entraineur,
  // dirigeant) ; un joueur ou un parent lit ce qui est libre.
  // PLANNING-PORTRAIT (01/10) — ET celui qui GERE l'installation : un agent de mairie dont
  // le compte est « joueur » lisait le texte du membre. C'est le serveur qui dit qu'il la
  // gere (ses collectivites, puis leurs installations), jamais le role du compte.
  const { userData } = /** @type {any} */ (useAuth()) || {};
  const isFacilitySource = sourceType === FULLSCREEN_SOURCE_TYPES.facility;
  const managingCollectiviteId = useManagingCollectiviteId(facilityId, {
    enabled: isFacilitySource,
  });
  const readsAsOrganizer = Boolean(managingCollectiviteId)
    || ['coach', 'president', 'superAdmin'].includes(
      getUserRoleKey(userData?.role?.type || userData?.role?.name),
    );
  // SPEC Collectivites §2 C : la mairie touche le bloc d'un AUTRE club -> une fiche en
  // lecture (club, equipe, horaires, contact GENERAL du club, D15). Pour tout autre
  // lecteur, ce bloc reste inerte (FINITIONS2).
  const [readOnlyBlock, setReadOnlyBlock] = useState(/** @type {any} */ (null));
  const attachedClubs = useCollectiviteClubs(readOnlyBlock ? managingCollectiviteId : null);
  const readOnlyBlockContact = (attachedClubs.data || []).find(
    (club) => club?.documentId && club.documentId === readOnlyBlock?.club?.documentId,
  ) || null;
  const readOnlyBlockDate = readOnlyBlock ? getPlanningItemDate(readOnlyBlock) : null;
  const showsContact = !attachedClubs.isLoading;
  const hasContact = Boolean(readOnlyBlockContact?.email || readOnlyBlockContact?.phoneNumber);
  // COLL1B : ouvert par un lien du site (params reduits a l adresse), l ecran d une
  // installation retrouve son nom et sa capacite dans la reponse du serveur.
  const serverFacility = sourceType === FULLSCREEN_SOURCE_TYPES.facility
    ? data?.meta?.facility || null
    : null;
  const facilityMeta = route?.params?.facilityMeta || serverFacility;
  const contextDetailLabel = route?.params?.contextDetailLabel || serverFacility?.name || null;
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
  const pageLabel = isLandscape
    ? weekLabel
    : format(currentDate, 'EEEE d MMMM yyyy', { locale: fr });
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
      case FULLSCREEN_SOURCE_TYPES.facility:
        return t('planning.fullscreen.facility', 'Planning de l’installation');
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
  // « Aujourd'hui » ramene a la page du jour : la semaine en paysage, le jour en portrait.
  const isCurrentPage = isLandscape
    ? isCurrentWeek
    : isSameDay(currentDate, getPlanningDefaultDate());
  const facilitySummaryMessage = useMemo(() => {
    if (!facilityPlanningSummary) return '';

    // COLL1D — le texte du MEMBRE : ce qui est libre, sans les regles de reservation.
    if (!readsAsOrganizer) {
      return facilityPlanningSummary.reachedCapacity
        ? t(
          'facilityList.planning.member.full',
          'Complet au moment le plus chargé de la semaine : plus aucune place libre.',
        )
        : t('facilityList.planning.member.available', {
          count: facilityPlanningSummary.remainingAtPeak,
          defaultValue_one: '{{count}} place libre au moment le plus chargé de la semaine.',
          defaultValue_other: '{{count}} places libres au moment le plus chargé de la semaine.',
        });
    }

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
      'Places encore libres au moment le plus chargé : {{count}}.',
      { count: facilityPlanningSummary.remainingAtPeak },
    );
  }, [facilityPlanningSummary, readsAsOrganizer, t]);

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

  // Ne s'ouvre que sur le bloc d'un autre club, et seulement pour celui qui gere.
  const handleReadOnlyEventPress = useMemo(() => {
    if (!managingCollectiviteId) return undefined;
    return (/** @type {any} */ event) => setReadOnlyBlock(event);
  }, [managingCollectiviteId]);
  const handleCloseReadOnlyBlock = useCallback(() => setReadOnlyBlock(null), []);

  // Les fleches de l'en-tete : un jour en portrait, une semaine en paysage.
  const handlePrevPage = useCallback(() => {
    setCurrentDate((previousDate) => addDays(previousDate, -pageDays));
  }, [pageDays]);

  const handleNextPage = useCallback(() => {
    setCurrentDate((previousDate) => addDays(previousDate, pageDays));
  }, [pageDays]);

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
            {t(
              'personalPlanningWeekFullscreen.unableToLoadThePlanning',
              'Impossible de charger le planning',
            )}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral100, Fonts.textCenter, Spaces.marginBottom[16]]}>
            {t(
              'personalPlanningWeekFullscreen.weekPlanningLoadError',
              'Le planning de cette semaine n’a pas pu être récupère. Réessaie ou change de '
                + 'semaine.',
            )}
          </Text>
          <Button
            onPress={() => refetch()}
            title={t(
              'personalPlanningWeekFullscreen.tryAgain',
              'Reessayer',
            )}
            variant="Primary"
          />
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
            {t('personalPlanningWeekFullscreen.noSlotThisWeek', 'Aucun créneau cette semaine')}
          </Text>
          <Text style={[Fonts.p2, Fonts.neutral100, Fonts.textCenter, Spaces.marginBottom[16]]}>
            {t(
              'personalPlanningWeekFullscreen.changeWeekToExploreThe',
              'Change de semaine pour explorer le planning ou reviens à la semaine actuelle.',
            )}
          </Text>
          <View style={[Alignments.row, Spaces.gap[12]]}>
            {!isCurrentWeek ? (
              <Button
                onPress={handleBackToCurrentWeek}
                title={t(
                  'personalPlanningWeekFullscreen.today',
                  'Aujourd’hui',
                )}
                variant="Secondary"
              />
            ) : null}
            <Button
              onPress={handleNextWeek}
              title={t(
                'personalPlanningWeekFullscreen.nextWeek',
                'Semaine suivante',
              )}
              variant="Primary"
            />
          </View>
        </View>
      );
    }

    return (
      <PlanningWeekTimelineView
        // Planning d'une installation : chaque bloc dit son club, puis son equipe.
        cardDisplayProfile={isFacilitySource ? 'clubFocused' : 'default'}
        compactFullscreen
        currentDate={currentDate}
        events={events}
        mode={isLandscape ? 'week' : 'day'}
        onDateChange={setCurrentDate}
        onEventPress={handleEventPress}
        onReadOnlyEventPress={handleReadOnlyEventPress}
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
    handleReadOnlyEventPress,
    hasEvents,
    isCurrentWeek,
    isFacilitySource,
    isFetching,
    isLandscape,
    isLoading,
    refetch,
    setCurrentDate,
    t,
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
            accessibilityLabel={isLandscape
              ? t('personalPlanningWeekFullscreen.previousWeek', 'Semaine précédente')
              : t('personalPlanningWeekFullscreen.previousDay', 'Jour précédent')}
            accessibilityRole="button"
            hitSlop={8}
            onPress={handlePrevPage}
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
              {pageLabel}
            </Text>
          </View>

          <TouchableOpacity
            accessibilityLabel={isLandscape
              ? t('personalPlanningWeekFullscreen.nextWeek', 'Semaine suivante')
              : t('personalPlanningWeekFullscreen.nextDay', 'Jour suivant')}
            accessibilityRole="button"
            hitSlop={8}
            onPress={handleNextPage}
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
            accessibilityLabel={t(
              'personalPlanningWeekFullscreen.closeTheFullScreenPlanning',
              'Fermer le planning plein écran',
            )}
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
          {!isCurrentPage ? (
            <TouchableOpacity
              accessibilityLabel={isLandscape
                ? t(
                  'personalPlanningWeekFullscreen.backToTheCurrentWeek',
                  'Revenir à la semaine actuelle',
                )
                : t('personalPlanningWeekFullscreen.backToToday', 'Revenir à aujourd’hui')}
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
              <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
                {t('personalPlanningWeekFullscreen.today', 'Aujourd’hui')}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {!isLandscape ? (
          <Text style={[Fonts.p4, Fonts.neutral200, Fonts.textCenter, Spaces.marginBottom[8]]}>
            {t(
              'personalPlanningWeekFullscreen.rotateForWeek',
              'Téléphone à l’horizontale : toute la semaine.',
            )}
          </Text>
        ) : null}

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
                // PLANNING-PORTRAIT (01/10) — « 2 slots » et « Pic 2/2 » etaient du jargon
                // (COLL1D les cachait au seul membre) : des mots francais, pour tous, ceux
                // de la maquette de l'ecran 10 (« 2 equipes a la fois »).
                t(
                  'personalPlanningWeekFullscreen.slots',
                  {
                    count: facilityPlanningSummary.maxSlots,
                    defaultValue_one: '{{count}} équipe à la fois',
                    defaultValue_other: '{{count}} équipes à la fois',
                  },
                ),
                t(
                  'personalPlanningWeekFullscreen.peak',
                  'Au plus chargé : {{peak}} sur {{max}}',
                  {
                    max: facilityPlanningSummary.maxSlots,
                    peak: facilityPlanningSummary.peakConcurrent,
                  },
                ),
                t(
                  'personalPlanningWeekFullscreen.events',
                  {
                    count: facilityPlanningSummary.eventCount,
                    defaultValue_one: '{{count}} événement',
                    defaultValue_other: '{{count}} événements',
                  },
                ),
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

      <BottomModal close={handleCloseReadOnlyBlock} isVisible={Boolean(readOnlyBlock)}>
        {readOnlyBlock ? (
          <View style={[Spaces.gap[8], Spaces.paddingHorizontal[16], Spaces.paddingBottom[16]]}>
            <Text style={[Fonts.p4, Fonts.neutral200]}>
              {t('personalPlanningWeekFullscreen.blockSheet.title', 'Qui occupe l’installation')}
            </Text>
            <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{readOnlyBlock.club?.name || ''}</Text>
            {readOnlyBlock.team?.name ? (
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{readOnlyBlock.team.name}</Text>
            ) : null}
            <Text style={[Fonts.p3, Fonts.neutral100]}>
              {[
                readOnlyBlockDate ? format(readOnlyBlockDate, 'EEEE d MMMM', { locale: fr }) : null,
                getPlanningTimeLabel(readOnlyBlock),
              ].filter(Boolean).join(' · ')}
            </Text>
            <Text style={[Fonts.p2Bold, Fonts.neutral00, Spaces.marginTop[8]]}>
              {t('personalPlanningWeekFullscreen.blockSheet.contactTitle', 'Contact du club')}
            </Text>
            {showsContact ? null : <Loader />}
            {showsContact && readOnlyBlockContact?.email ? (
              <Text
                accessibilityRole="link"
                onPress={() => Linking.openURL(`mailto:${readOnlyBlockContact.email}`)}
                style={[Fonts.p3, Fonts.primary100]}
              >
                {t('personalPlanningWeekFullscreen.blockSheet.email', 'E-mail : {{email}}', {
                  email: readOnlyBlockContact.email,
                })}
              </Text>
            ) : null}
            {showsContact && readOnlyBlockContact?.phoneNumber ? (
              <Text
                accessibilityRole="link"
                onPress={() => Linking.openURL(`tel:${readOnlyBlockContact.phoneNumber}`)}
                style={[Fonts.p3, Fonts.primary100]}
              >
                {t('personalPlanningWeekFullscreen.blockSheet.phone', 'Téléphone : {{phone}}', {
                  phone: readOnlyBlockContact.phoneNumber,
                })}
              </Text>
            ) : null}
            {showsContact && !hasContact ? (
              <Text style={[Fonts.p3, Fonts.neutral200]}>
                {t(
                  'personalPlanningWeekFullscreen.blockSheet.noContact',
                  'Aucun contact renseigné par le club.',
                )}
              </Text>
            ) : null}
            <Button
              onPress={handleCloseReadOnlyBlock}
              title={t('personalPlanningWeekFullscreen.blockSheet.close', 'Fermer')}
              variant="Secondary"
            />
          </View>
        ) : null}
      </BottomModal>
    </ScreenContainer>
  );
}

export default PlanningWeekFullscreen;
