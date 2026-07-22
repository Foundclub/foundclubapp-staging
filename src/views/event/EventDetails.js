// @ts-nocheck
import { useFocusEffect } from '@react-navigation/native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  InteractionManager,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

import { USER_ROLES } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import { resolveTrainingOpenConfig } from '@/domains/event/eventUseCases';
import { getCurrentUserEventParticipationState } from '@/domains/event/participationState';
import useMessaging from '@/domains/messaging/useMessaging';
import {
  getParticipationErrorMessage,
  resolveParticipationFlow,
} from '@/domains/participation/participationFlow';
import { getSubscriptionQuotaItem } from '@/domains/subscription/subscriptionDecision';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import Checkbox from '@/components/atoms/checkbox/Checkbox';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import Tag from '@/components/atoms/tag/Tag';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import EventAnswerButtons from '@/components/molecules/eventAnswerButtons/EventAnswerButtons';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import JoinEventModal from '@/components/organisms/joinEventModal/JoinEventModal';
import RefuseParticipationModal from '@/components/organisms/refuseParticipationModal/RefuseParticipationModal';
import ReportEventModal from '@/components/organisms/reportEventModal/ReportEventModal';
import ShareEventModal from '@/components/organisms/shareEventModal/ShareEventModal';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { openPublicAuthFlow } from '@/navigation/public/publicAuthNavigation';
import { RouteNames } from '@/navigation/routeNames';

import { celebrate } from '@/services/celebrations/celebrationRuntime';
import {
  useGetEvent,
  useGetEventAttendance,
  useGetEventConvocation,
  useGetEventTeamComposition,
} from '@/services/event/eventQueries';
import {
  approveFeatured,
  exportEventParticipants,
  rejectFeatured,
} from '@/services/event/eventService';
import { useGetEventParticipations } from '@/services/eventParticipation/eventParticipationQueries';
import { useLicenseCampaigns } from '@/services/license/licenseQueries';
import {
  useGetEventMatchStats,
  useGetEventMyMatchResponse,
} from '@/services/matchStats/matchStatsQueries';
import { applyToRecruitmentAd } from '@/services/recruitment/recruitmentService';
import {
  createCustomTournamentTeam,
  registerClubTeamToTournament,
  requestJoinTournamentTeam,
  respondToTournamentTeam,
  reviewTournamentTeamRegistration,
} from '@/services/tournamentTeam/tournamentTeamService';

import { resolveExternalMatchDisplay } from '@/utils/externalMatchDisplay';
import {
  dismissMatchStatsPromptForSession,
  isMatchStatsPromptDismissedForSession,
} from '@/utils/matchStatsPromptSession';
import { markEventDetailsPerf } from '@/utils/performance/eventDetailsPerformance';

import EventDetectionSlots from './components/EventDetectionSlots';
import EventHeader from './components/EventHeader';
import EventParticipants from './components/EventParticipants';
import EventReservationActions from './components/EventReservationActions';
import EventTasksSection from './components/EventTasksSection';
import EventTeamAudiencesSection from './components/EventTeamAudiencesSection';
import { resolveEventAttendanceGate } from './eventAttendanceGate';
import { useEventMutations } from './hooks/useEventMutations';
import { createTournamentDesignSystem } from './tournamentDesignSystem';
import {
  getTournamentPendingMembershipForUser,
  getTournamentRosterSummary,
  getTournamentStatusCounters,
  isTournamentActiveMemberStatus,
  isTournamentTeamNonCompliant,
  normalizeTournamentText,
} from './tournamentUtils';

// import statique (pas require) : require n'existe pas sur le rendu web ESM.
import SharePlatform from '@/platform/share';

const EVENT_DETAILS_STALE_MS = 30_000;
const MIN_PARTICIPANTS = 1;
const MAX_PARTICIPANTS = 200;
const DEFAULT_EXTERNAL_PARTICIPANT_LIMIT = 3;
/**
 * @param {number | string | null | undefined} amountCents
 * @param {string} currency
 * @returns {string}
 */
const formatCampaignAmount = (amountCents, currency = 'EUR') => {
  try {
    return new Intl.NumberFormat('fr-FR', { currency, style: 'currency' }).format((Number(amountCents) || 0) / 100);
  } catch (_) {
    return `${((Number(amountCents) || 0) / 100).toFixed(2)} ${currency}`;
  }
};

/**
 * @param {number} value
 * @returns {number}
 */
const clampParticipants = (value) => (
  Math.min(MAX_PARTICIPANTS, Math.max(MIN_PARTICIPANTS, value))
);

/**
 * @param {object} props
 * @param {any} props.Alignments
 * @param {any} props.ApplicationStyle
 * @param {any} props.Colors
 * @param {any} props.Fonts
 * @param {any} props.Spaces
 * @param {number | null | undefined} props.initialLimit
 * @param {'auto' | 'manual' | null | undefined} props.initialValidationMode
 * @param {boolean} props.isSubmitting
 * @param {boolean} props.isVisible
 * @param {() => void} props.onClose
 * @param {(payload: { externalParticipantLimit: number; externalParticipantValidationMode: 'auto' | 'manual' }) => void} props.onSubmit
 * @returns {import('react').ReactElement}
 */
function TrainingOpenBottomSheet({
  Alignments,
  ApplicationStyle,
  Colors,
  Fonts,
  initialLimit,
  initialValidationMode,
  isSubmitting,
  isVisible,
  onClose,
  onSubmit,
  Spaces,
}) {
  const resolveInitialLimit = useCallback(
    () => clampParticipants(Number(initialLimit) || DEFAULT_EXTERNAL_PARTICIPANT_LIMIT),
    [initialLimit],
  );
  const [limitValue, setLimitValue] = useState(resolveInitialLimit);
  const [validationMode, setValidationMode] = useState(
    initialValidationMode === 'auto' ? 'auto' : 'manual',
  );

  useEffect(() => {
    if (!isVisible) return;
    setLimitValue(resolveInitialLimit());
    setValidationMode(initialValidationMode === 'auto' ? 'auto' : 'manual');
  }, [initialValidationMode, isVisible, resolveInitialLimit]);

  const canDecreaseLimit = limitValue > MIN_PARTICIPANTS;
  const canIncreaseLimit = limitValue < MAX_PARTICIPANTS;
  const counterButtonStyle = (isEnabled) => ([
    ApplicationStyle.card,
    Alignments.alignCenter,
    Alignments.justifyCenter,
    {
      backgroundColor: isEnabled ? 'rgba(1, 179, 244, 0.12)' : 'rgba(1, 179, 244, 0.06)',
      borderColor: 'rgba(1, 179, 244, 0.28)',
      borderRadius: 16,
      height: 56,
      opacity: isEnabled ? 1 : 0.45,
      width: 56,
    },
  ]);

  return (
    <BottomModal
      close={onClose}
      isVisible={isVisible}
      snapPoints={['60%']}
    >
      <View style={[Spaces.gap[16], Spaces.paddingBottom[12]]}>
        <View style={[Spaces.gap[4]]}>
          <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Ouvrir l entraînement</Text>
          <Text style={[Fonts.p2, Fonts.neutral100]}>
            Définis combien de joueurs externes peuvent rejoindre cet entraînement, puis choisis leur mode de validation.
          </Text>
        </View>

        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.p3Bold, Fonts.neutral00]}>Places externes</Text>
          <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween]}>
            <TouchableOpacity
              disabled={!canDecreaseLimit}
              onPress={() => setLimitValue((value) => clampParticipants(value - 1))}
              style={counterButtonStyle(canDecreaseLimit)}
            >
              <Text style={[Fonts.h3, Fonts.primary500]}>-</Text>
            </TouchableOpacity>

            <View style={[Spaces.paddingHorizontal[12]]}>
              <Text style={[Fonts.h1, Fonts.neutral00, { textAlign: 'center' }]}>
                {limitValue}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200, { textAlign: 'center' }]}>
                joueurs externes max
              </Text>
            </View>

            <TouchableOpacity
              disabled={!canIncreaseLimit}
              onPress={() => setLimitValue((value) => clampParticipants(value + 1))}
              style={counterButtonStyle(canIncreaseLimit)}
            >
              <Text style={[Fonts.h3, Fonts.primary500]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[Spaces.gap[8]]}>
          <Text style={[Fonts.p3Bold, Fonts.neutral00]}>Validation des joueurs externes</Text>
          <View style={[Alignments.row, Spaces.gap[8]]}>
            {[
              { key: 'auto', label: 'Automatique' },
              { key: 'manual', label: 'Manuelle' },
            ].map((option) => {
              const selected = validationMode === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => setValidationMode(option.key)}
                  style={[
                    ApplicationStyle.card,
                    Spaces.paddingHorizontal[16],
                    Spaces.paddingVertical[12],
                    {
                      backgroundColor: selected ? `${Colors.primary500}18` : 'transparent',
                      borderColor: selected ? Colors.primary500 : `${Colors.primary500}44`,
                      borderRadius: 999,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text style={[Fonts.p2Bold, selected ? Fonts.primary500 : Fonts.neutral100]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={[Spaces.gap[12], Spaces.marginTop[8]]}>
          <Button
            disabled={isSubmitting}
            isLoading={isSubmitting}
            onPress={() => onSubmit({
              externalParticipantLimit: limitValue,
              externalParticipantValidationMode: validationMode,
            })}
            title="Confirmer l ouverture"
            variant="Primary"
          />
          <Button
            disabled={isSubmitting}
            onPress={onClose}
            title="Annuler"
            variant="Secondary"
          />
        </View>
      </View>
    </BottomModal>
  );
}

/** @typedef {import('@/domains/event/types').FCEvent} FCEvent */
/**
 * @typedef {{
 *   id?: string | number;
 *   documentId?: string;
 *   firstname?: string;
 *   lastname?: string;
 *   avatar?: { url?: string };
 * }} User
 */
/** @typedef {{ documentId?: string; updatedAt?: string; participationStatus?: string; isActive?: boolean; sourceTeam?: { documentId?: string; name?: string }; user: User }} EventParticipation */

const START_TIME_RE = /^(\d{1,2}):(\d{2})/;
const normalizeEventTypeLabel = (value = '') => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

// @ts-ignore: FIXME: Baseline TS regression
const getActiveParticipationRequests = (event) => (
  Array.isArray(event?.participationRequests)
    // @ts-ignore: FIXME: Baseline TS regression
    ? event.participationRequests.filter((request) => request?.isActive !== false)
    : []
);

// @ts-ignore: FIXME: Baseline TS regression
const getStageDayStatusSummary = (stageDay) => {
  const requests = getActiveParticipationRequests(stageDay);
  // @ts-ignore: FIXME: Baseline TS regression
  return requests.reduce((summary, request) => {
    const status = String(request?.participationStatus || '').toLowerCase();
    if (status === 'accepted') return { ...summary, present: summary.present + 1 };
    if (status === 'missing' || status === 'declined') {
      return { ...summary, absent: summary.absent + 1 };
    }
    if (status === 'pending') return { ...summary, pending: summary.pending + 1 };
    return summary;
  }, { absent: 0, pending: 0, present: 0 });
};

// @ts-ignore: FIXME: Baseline TS regression
const getFeaturedScopeStatusLabel = (status) => {
  if (status === 'pending') return 'Demande en attente';
  if (status === 'approved') return 'Déjà à la une';
  if (status === 'rejected') return 'Refusée, tu peux redemander';
  return 'Disponible';
};

/**
 * @param {User | null | undefined} user
 * @returns {string | null}
 */
const getUserKey = (user) => {
  if (user?.documentId) return `doc:${user.documentId}`;
  if (user?.id) return `id:${String(user.id)}`;
  return null;
};

/**
 * @param {User[]} [users]
 * @returns {User[]}
 */
const uniqueUsers = (users = []) => {
  const map = new Map();
  users.forEach((user) => {
    const key = getUserKey(user);
    if (!key || map.has(key)) return;
    map.set(key, user);
  });
  return Array.from(map.values());
};

// @ts-ignore: FIXME: Baseline TS regression
const getTrainerKeySet = (team) => new Set(
  (team?.trainers || [])
    // @ts-ignore: FIXME: Baseline TS regression
    .map((trainer) => getUserKey(trainer))
    .filter(Boolean),
);

// @ts-ignore: FIXME: Baseline TS regression
const getEligibleTeamPlayers = (team) => {
  const trainerKeys = getTrainerKeySet(team);
  return uniqueUsers(
    // @ts-ignore: FIXME: Baseline TS regression
    (team?.players || []).filter((player) => {
      const playerKey = getUserKey(player);
      return Boolean(playerKey) && !trainerKeys.has(playerKey);
    }),
  );
};

const getDetectionCandidatePlayers = (event, team) => {
  const excludedKeys = new Set([
    ...Array.from(getTrainerKeySet(team)),
    ...getEligibleTeamPlayers(team).map((player) => getUserKey(player)).filter(Boolean),
  ]);

  // On garde le POSTE POSTULÉ (appliedPosition) sur chaque candidat : le poste de
  // l'annonce pour un candidat d'annonce, la position de la participation sinon.
  // Sert à l'affichage « a postulé X » et au pré-placement au bon poste.
  const adCandidates = Array.isArray(event?.recruitmentAds)
    ? event.recruitmentAds.flatMap((recruitmentAd) => (recruitmentAd?.candidates || [])
      .map((candidate) => ({ ...candidate, appliedPosition: recruitmentAd?.position || null })))
    : [];
  const acceptedRequests = getActiveParticipationRequests(event)
    .filter((participation) => ['accepted', 'missing'].includes(String(participation?.participationStatus || '').toLowerCase()))
    .map((participation) => (participation?.user
      ? { ...participation.user, appliedPosition: participation?.position || null }
      : null))
    .filter(Boolean);
  const acceptedParticipations = Array.isArray(event?.participations) ? event.participations : [];

  return filterUsersByExcludedKeys(
    [
      ...adCandidates,
      ...acceptedParticipations,
      ...acceptedRequests,
    ],
    excludedKeys,
  );
};

const getCompositionPlayersForEvent = (event, team, detectionEnabled) => {
  const teamPlayers = getEligibleTeamPlayers(team);
  if (!detectionEnabled) return teamPlayers;
  return uniqueUsers([
    ...teamPlayers,
    ...getDetectionCandidatePlayers(event, team),
  ]);
};

// @ts-ignore: FIXME: Baseline TS regression
const filterUsersByExcludedKeys = (users = [], excludedKeys = new Set()) => uniqueUsers(
  users.filter((user) => {
    const key = getUserKey(user);
    return Boolean(key) && !excludedKeys.has(key);
  }),
);

/**
 * @param {FCEvent | null | undefined} event
 * @returns {Date | null}
 */
const resolveEventStartAt = (event) => {
  const eventDate = event?.date ? new Date(event.date) : null;
  if (!eventDate || Number.isNaN(eventDate.getTime())) return null;

  const startTime = String(event?.startTime || '');
  const match = startTime.match(START_TIME_RE);
  if (!match) return eventDate;

  const isMidnight = eventDate.getUTCHours() === 0
    && eventDate.getUTCMinutes() === 0
    && eventDate.getUTCSeconds() === 0;
  if (!isMidnight) return eventDate;

  const withTime = new Date(eventDate);
  withTime.setUTCHours(Number(match[1]), Number(match[2]), 0, 0);
  return withTime;
};

/**
 * @param {{ navigation: import('@react-navigation/native').NavigationProp<any>; route: { params?: { eventId?: string, fromEventCreation?: boolean, eventCampaignCreationSuggested?: boolean, creationCelebration?: { actionKey?: string, payload?: Record<string, any> }, subscriptionFollowUp?: { beforeRemaining?: number, consumedCount?: number, quotaType?: string, total?: number } | null } } }} props
 */
function EventDetails({ navigation, route }) {
  const { eventId } = route?.params ?? {};
  const fromEventCreation = Boolean(route?.params?.fromEventCreation);
  const eventCampaignCreationSuggested = Boolean(route?.params?.eventCampaignCreationSuggested);
  const creationCelebration = route?.params?.creationCelebration || null;
  const subscriptionFollowUp = route?.params?.subscriptionFollowUp || null;
  // @ts-ignore: FIXME: Baseline TS regression
  const highlightedSection = route?.params?.focusSection || null;

  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [joinModalError, setJoinModalError] = useState('');
  const [isDetectionSlotPickerVisible, setIsDetectionSlotPickerVisible] = useState(false);
  const [pendingDetectionSlot, setPendingDetectionSlot] = useState(null);
  const [isRefuseModalVisible, setIsRefuseModalVisible] = useState(false);
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [isFeaturedModalVisible, setIsFeaturedModalVisible] = useState(false);
  const [isTournamentParticipationModalVisible, setIsTournamentParticipationModalVisible] = useState(false);
  const [isTournamentCreateModalVisible, setIsTournamentCreateModalVisible] = useState(false);
  const [isTournamentJoinSelectorVisible, setIsTournamentJoinSelectorVisible] = useState(false);
  const [isTournamentRegisterModalVisible, setIsTournamentRegisterModalVisible] = useState(false);
  const [selectedFeaturedScopes, setSelectedFeaturedScopes] = useState({
    CM: false,
    PUBLIC: false,
    SECTION: false,
  });
  const [tournamentTeamNameDraft, setTournamentTeamNameDraft] = useState('');
  const [pendingTournamentAction, setPendingTournamentAction] = useState(null);
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [isTrainingOpenModalVisible, setIsTrainingOpenModalVisible] = useState(false);
  const [selectedParticipationId, setSelectedParticipationId] = useState('');
  const [stageDetailsTab, setStageDetailsTab] = useState('overview');
  const [isEventActionsOpen, setIsEventActionsOpen] = useState(true);
  const [isTournamentActionsOpen, setIsTournamentActionsOpen] = useState(true);
  const [isMatchStatsPromptVisible, setIsMatchStatsPromptVisible] = useState(false);
  const [dismissedMatchStatsPromptKey, setDismissedMatchStatsPromptKey] = useState(null);
  const [areDeferredQueriesEnabled, setAreDeferredQueriesEnabled] = useState(false);
  const [isSubscriptionFollowUpVisible, setIsSubscriptionFollowUpVisible] = useState(false);
  const firstFocusRefreshRef = useRef(true);
  const lastFocusRefreshAtRef = useRef(0);
  const openedEventIdRef = useRef('');
  const primaryCompletedEventIdRef = useRef('');
  const firstRenderedEventIdRef = useRef('');
  const secondaryCompletedEventIdRef = useRef('');
  const creationCelebrationShownRef = useRef(false);
  const subscriptionFollowUpShownRef = useRef(false);

  const [isLateModalVisible, setIsLateModalVisible] = useState(false);
  const [lateModalMode, setLateModalMode] = useState(/** @type {'coach_mark' | 'coach_edit' | 'player_declare' | 'player_update'} */ ('coach_mark'));
  const [lateModalUser, setLateModalUser] = useState(/** @type {User | null} */ (null));
  const [lateModalMinutes, setLateModalMinutes] = useState('0');
  const [lateModalArrivedAt, setLateModalArrivedAt] = useState(/** @type {string | null} */ (null));
  const [lateModalNote, setLateModalNote] = useState('');
  const [elapsedSinceServerNowMs, setElapsedSinceServerNowMs] = useState(0);
  const [selfArrivalMarkedLocal, setSelfArrivalMarkedLocal] = useState(false);

  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const tournamentDs = createTournamentDesignSystem({
    ApplicationStyle,
    Colors,
    Fonts,
    Spaces,
  });
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    canEditClub,
    canEditEvent,
    canManageEvent,
    freeUsageSummary,
    subscriptionAccessLevel,
    userData,
  } = useAuth();
  const { sendMessage } = useMessaging();
  const currentEventPublishQuotaItem = useMemo(
    () => getSubscriptionQuotaItem(freeUsageSummary, 'EVENT_PUBLISH', subscriptionAccessLevel),
    [freeUsageSummary, subscriptionAccessLevel],
  );
  const remainingEventPublishQuota = useMemo(() => {
    if (currentEventPublishQuotaItem) {
      return currentEventPublishQuotaItem.remaining;
    }

    return Math.max(
      0,
      Number(subscriptionFollowUp?.beforeRemaining || 0) - Number(subscriptionFollowUp?.consumedCount || 1),
    );
  }, [
    currentEventPublishQuotaItem,
    subscriptionFollowUp?.beforeRemaining,
    subscriptionFollowUp?.consumedCount,
  ]);
  const totalEventPublishQuota = currentEventPublishQuotaItem?.total
    || Number(subscriptionFollowUp?.total || 0);
  const shouldSuggestSubscriptionAfterCreate = Boolean(
    fromEventCreation
    && subscriptionFollowUp
    && subscriptionAccessLevel === 'FREE',
  );

  const {
    data: event,
    dataUpdatedAt: eventDataUpdatedAt,
    error,
    isFetching: isEventFetching,
    isLoading,
    refetch,
  } = useGetEvent(eventId || '', {
    refetchOnMount: fromEventCreation ? 'always' : false,
    staleTime: fromEventCreation ? 0 : EVENT_DETAILS_STALE_MS,
  });
  const hasLoadedEvent = Boolean(event);

  useEffect(() => {
    if (!fromEventCreation || !eventId) return undefined;

    const refreshTimeout = setTimeout(() => {
      refetch();
    }, 450);

    return () => clearTimeout(refreshTimeout);
  }, [eventId, fromEventCreation, refetch]);

  useEffect(() => {
    const resolvedCreationCelebration = creationCelebration || (
      event
        ? {
          actionKey: 'event_created',
          payload: {
            eventId,
            eventName: event?.name || event?.description || '',
            teamId: event?.team?.documentId || null,
          },
        }
        : null
    );

    if (!fromEventCreation || !resolvedCreationCelebration || creationCelebrationShownRef.current) {
      return undefined;
    }

    let celebrationDelay = null;
    const task = InteractionManager.runAfterInteractions(() => {
      celebrationDelay = setTimeout(() => {
        celebrate(
          resolvedCreationCelebration?.actionKey || 'event_created',
          resolvedCreationCelebration?.payload || {},
        );
        creationCelebrationShownRef.current = true;
      }, 220);
    });

    return () => {
      task?.cancel?.();
      if (celebrationDelay) {
        clearTimeout(celebrationDelay);
      }
    };
  }, [creationCelebration, event, eventId, fromEventCreation]);

  useEffect(() => {
    if (!shouldSuggestSubscriptionAfterCreate || subscriptionFollowUpShownRef.current) {
      return undefined;
    }

    let openDelay = null;
    const task = InteractionManager.runAfterInteractions(() => {
      openDelay = setTimeout(() => {
        setIsSubscriptionFollowUpVisible(true);
        subscriptionFollowUpShownRef.current = true;
        if (typeof navigation?.setParams === 'function') {
          navigation.setParams({ subscriptionFollowUp: undefined });
        }
      }, 620);
    });

    return () => {
      task?.cancel?.();
      if (openDelay) {
        clearTimeout(openDelay);
      }
    };
  }, [navigation, shouldSuggestSubscriptionAfterCreate]);

  const handleOpenSubscriptionOverview = useCallback(() => {
    setIsSubscriptionFollowUpVisible(false);
    navigation.navigate(RouteNames.ProfileStack, {
      screen: RouteNames.SubscriptionOverview,
    });
  }, [navigation]);

  useEffect(() => {
    const safeEventId = String(eventId || '');
    if (!safeEventId || openedEventIdRef.current === safeEventId) return;
    openedEventIdRef.current = safeEventId;
    primaryCompletedEventIdRef.current = '';
    firstRenderedEventIdRef.current = '';
    secondaryCompletedEventIdRef.current = '';
    firstFocusRefreshRef.current = true;
    markEventDetailsPerf('event_detail_open_started', {
      eventId: safeEventId,
    });
  }, [eventId]);

  useEffect(() => {
    const safeEventId = String(eventId || '');
    if (!safeEventId || !hasLoadedEvent || isLoading || primaryCompletedEventIdRef.current === safeEventId) return;
    primaryCompletedEventIdRef.current = safeEventId;
    markEventDetailsPerf('event_detail_primary_query_completed', {
      eventId: safeEventId,
      fromCache: !isEventFetching,
      hasEvent: hasLoadedEvent,
    });
  }, [eventId, hasLoadedEvent, isEventFetching, isLoading]);

  useEffect(() => {
    const safeEventId = String(eventId || '');
    if (!safeEventId || !hasLoadedEvent || isLoading || firstRenderedEventIdRef.current === safeEventId) return undefined;

    const frameId = requestAnimationFrame(() => {
      firstRenderedEventIdRef.current = safeEventId;
      markEventDetailsPerf('event_detail_first_content_rendered', {
        eventId: safeEventId,
      });
    });

    return () => cancelAnimationFrame(frameId);
  }, [eventId, hasLoadedEvent, isLoading]);

  useEffect(() => {
    const safeEventId = String(eventId || '');
    setAreDeferredQueriesEnabled(false);
    if (!safeEventId || !hasLoadedEvent || isLoading) return undefined;

    const task = InteractionManager.runAfterInteractions(() => {
      setAreDeferredQueriesEnabled(true);
      markEventDetailsPerf('event_detail_secondary_queries_enabled', {
        eventId: safeEventId,
      });
    });

    return () => task.cancel?.();
  }, [event?.documentId, eventId, hasLoadedEvent, isLoading]);
  const externalMatchDisplay = useMemo(() => resolveExternalMatchDisplay(event), [event]);
  const isStageParentEvent = String(event?.eventFormat || '').toLowerCase() === 'stage_parent';
  const isStageDayEvent = String(event?.eventFormat || '').toLowerCase() === 'stage_day';
  const stageChildDays = useMemo(
    () => (Array.isArray(event?.childStageEvents) ? [...event.childStageEvents] : [])
      // @ts-ignore: FIXME: Baseline TS regression
      .sort((left, right) => new Date(left?.date || 0) - new Date(right?.date || 0)),
    [event?.childStageEvents],
  );
  const stagePeriodSummary = useMemo(() => {
    if (!isStageParentEvent || !event?.stageStartDate || !event?.stageEndDate) return '';
    const start = new Date(event.stageStartDate);
    const end = new Date(event.stageEndDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';
    return `${start.toLocaleDateString('fr-FR')} - ${end.toLocaleDateString('fr-FR')}`;
  }, [event?.stageEndDate, event?.stageStartDate, isStageParentEvent]);
  const stageHoursSummary = useMemo(() => {
    if (!isStageParentEvent) return '';
    const defaultStart = String(event?.stageDefaultStartTime || '').slice(0, 5);
    const defaultEnd = String(event?.stageDefaultEndTime || '').slice(0, 5);
    const activeDays = stageChildDays.filter((day) => day?.isActive !== false);
    const hasVariableHours = activeDays.some((day) => (
      String(day?.startTime || '').slice(0, 5) !== defaultStart
      || String(day?.endTime || '').slice(0, 5) !== defaultEnd
    ));
    if (hasVariableHours) return 'Horaires variables';
    if (defaultStart && defaultEnd) return `${defaultStart} - ${defaultEnd}`;
    return '';
  }, [event?.stageDefaultEndTime, event?.stageDefaultStartTime, isStageParentEvent, stageChildDays]);
  const isTournamentEvent = normalizeEventTypeLabel(event?.type?.name).includes('tournoi');
  const tournamentTeams = useMemo(
    () => (Array.isArray(event?.tournamentTeams) ? [...event.tournamentTeams] : [])
      .sort((left, right) => String(left?.name || '').localeCompare(String(right?.name || ''))),
    [event?.tournamentTeams],
  );
  const tournamentConfig = useMemo(
    () => (event?.tournamentConfig && typeof event.tournamentConfig === 'object' ? event.tournamentConfig : {}),
    [event?.tournamentConfig],
  );
  const tournamentTeamCounters = useMemo(
    () => getTournamentStatusCounters(tournamentTeams, tournamentConfig),
    [tournamentConfig, tournamentTeams],
  );
  const currentUserTournamentTeam = useMemo(() => {
    const currentUserId = userData?.documentId;
    if (!currentUserId) return null;

    return tournamentTeams.find((team) => (
      Array.isArray(team?.members)
      // @ts-ignore: FIXME: Baseline TS regression
      && team.members.some((member) => (
        member?.user?.documentId === currentUserId
        && isTournamentActiveMemberStatus(member?.responseStatus)
      ))
    )) || null;
  }, [tournamentTeams, userData?.documentId]);
  const currentUserTournamentMember = useMemo(() => {
    const currentUserId = userData?.documentId;
    if (!currentUserId || !currentUserTournamentTeam?.members) return null;

    // @ts-ignore: FIXME: Baseline TS regression
    return currentUserTournamentTeam.members.find((member) => (
      member?.user?.documentId === currentUserId
      && isTournamentActiveMemberStatus(member?.responseStatus)
    )) || null;
  }, [currentUserTournamentTeam, userData?.documentId]);
  const currentUserTournamentStatus = normalizeTournamentText(currentUserTournamentMember?.responseStatus);
  const currentUserPendingTournamentTeam = useMemo(
    () => getTournamentPendingMembershipForUser(tournamentTeams, userData?.documentId || ''),
    [tournamentTeams, userData?.documentId],
  );
  const managedTournamentTeam = useMemo(() => {
    const currentUserId = userData?.documentId;
    if (!currentUserId) return null;

    return tournamentTeams.find((team) => (
      team?.captainUser?.documentId === currentUserId
      // @ts-ignore: FIXME: Baseline TS regression
      || (team?.adminUsers || []).some((adminUser) => adminUser?.documentId === currentUserId)
    )) || null;
  }, [tournamentTeams, userData?.documentId]);
  const registeredTournamentSourceTeamIds = useMemo(
    () => new Set(
      tournamentTeams
        .map((team) => team?.sourceTeam?.documentId)
        .filter(Boolean),
    ),
    [tournamentTeams],
  );
  const availableTournamentSourceTeams = useMemo(
    () => (userData?.trainedTeams || [])
      // @ts-ignore: FIXME: Baseline TS regression
      .filter((team) => team?.documentId && !registeredTournamentSourceTeamIds.has(team.documentId)),
    [registeredTournamentSourceTeamIds, userData?.trainedTeams],
  );
  const canCreateCustomTournamentTeam = Boolean(
    isTournamentEvent
    && !isStageDayEvent
    && event?.tournamentConfig?.allowCustomTeams !== false
    && userData?.documentId
    && !currentUserTournamentTeam
    && !currentUserPendingTournamentTeam,
  );
  const canRegisterTournamentSourceTeam = Boolean(
    isTournamentEvent
    && !isStageDayEvent
    && !currentUserTournamentTeam
    && !currentUserPendingTournamentTeam
    && availableTournamentSourceTeams.length > 0,
  );
  const joinableTournamentTeams = useMemo(
    () => tournamentTeams.filter((team) => {
      const normalizedSourceType = normalizeTournamentText(team?.sourceType);
      const normalizedStatus = normalizeTournamentText(team?.status);
      if (!team?.documentId) return false;
      if (normalizedSourceType !== 'custom_team') return false;
      if (team?.isOpenToJoinRequests !== true) return false;
      if (normalizedStatus === 'declined' || normalizedStatus === 'archived') return false;
      return true;
    }),
    [tournamentTeams],
  );
  useEffect(() => {
    setStageDetailsTab('overview');
  }, [event?.documentId]);
  const eventDescriptionText = useMemo(() => {
    const rawDescription = event?.description;
    let resolvedDescription = '';
    if (typeof rawDescription === 'string') {
      resolvedDescription = rawDescription.trim();
    } else if (typeof rawDescription === 'number') {
      resolvedDescription = String(rawDescription);
    } else if (rawDescription && typeof rawDescription === 'object') {
      if (typeof rawDescription.description === 'string') {
        resolvedDescription = rawDescription.description.trim();
      } else if (typeof rawDescription.label === 'string') {
        resolvedDescription = rawDescription.label.trim();
      } else if (typeof rawDescription.address === 'string') {
        resolvedDescription = rawDescription.address.trim();
      }
    }

    const normalizedDescription = String(resolvedDescription || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (
      externalMatchDisplay?.title
      && normalizedDescription.includes('match externe synchron')
      && !/\bvs\b/i.test(resolvedDescription)
    ) {
      return [
        resolvedDescription,
        externalMatchDisplay.contextLabel,
        externalMatchDisplay.title,
      ]
        .filter(Boolean)
        .join(' - ');
    }

    return resolvedDescription;
  }, [event?.description, externalMatchDisplay?.contextLabel, externalMatchDisplay?.title]);
  const canEdit = Boolean(canManageEvent(event));
  const trainingOpenConfig = useMemo(() => resolveTrainingOpenConfig(event || {}), [event]);
  const canManageTrainingVisibility = Boolean(canEdit && trainingOpenConfig.isTraining);
  const eventClubId = event?.team?.club?.documentId || event?.club?.documentId || '';
  const eventMultisportId = event?.team?.club?.parentMultisport?.documentId || event?.club?.parentMultisport?.documentId || '';
  const userClubId = userData?.club?.documentId || '';
  const userMultisportIds = useMemo(
    // @ts-ignore: FIXME: Baseline TS regression
    () => (userData?.multisportClubs || []).map((club) => club?.documentId).filter(Boolean),
    [userData?.multisportClubs],
  );
  const isClubManagerForEvent = Boolean(
    userData?.role?.name === USER_ROLES.president
    && userClubId
    && eventClubId
    && userClubId === eventClubId,
  );
  const canApprovePendingRequests = Boolean(
    canEditEvent(event?.team?.documentId || '')
    || isClubManagerForEvent,
  );
  const isMultisportAdminForEvent = Boolean(
    eventMultisportId
    && userMultisportIds.includes(eventMultisportId),
  );
  const canManageFeatured = Boolean(
    canEdit
    || isClubManagerForEvent
    || isMultisportAdminForEvent
    || userData?.role?.name === USER_ROLES.superAdmin,
  );
  const licenseCampaignEventId = isStageDayEvent && event?.parentEvent?.documentId
    ? event.parentEvent.documentId
    : (event?.documentId || eventId || '');
  const licenseCampaignEvent = useMemo(() => (
    isStageDayEvent && event?.parentEvent?.documentId
      ? {
        ...event.parentEvent,
        club: event?.club,
        date: event?.parentEvent?.date || event?.date,
        eventFormat: 'stage_parent',
        name: event?.parentEvent?.name || event?.name,
        stageEndDate: event?.parentEvent?.stageEndDate || event?.stageEndDate,
        stageStartDate: event?.parentEvent?.stageStartDate || event?.stageStartDate,
        team: event?.parentEvent?.team || event?.team,
        type: event?.parentEvent?.type || event?.type,
      }
      : event
  ), [
    event,
    isStageDayEvent,
  ]);
  const canManageEventLicenseCampaigns = Boolean(
    eventClubId
    && (
      canEditClub(eventClubId)
      || userData?.role?.name === USER_ROLES.superAdmin
    ),
  );
  const eventLicenseCampaignsQueryParams = useMemo(() => ({
    clubId: eventClubId,
    eventId: licenseCampaignEventId,
  }), [eventClubId, licenseCampaignEventId]);
  const eventLicenseCampaignsQuery = useLicenseCampaigns(eventLicenseCampaignsQueryParams, {
    enabled: Boolean(canManageEventLicenseCampaigns && eventClubId && licenseCampaignEventId),
  });
  const eventLicenseCampaigns = useMemo(() => {
    const queriedCampaigns = eventLicenseCampaignsQuery.data?.data;
    if (Array.isArray(queriedCampaigns)) return queriedCampaigns;
    return Array.isArray(event?.licenseCampaigns) ? event.licenseCampaigns : [];
  }, [event?.licenseCampaigns, eventLicenseCampaignsQuery.data]);
  const featuredRequestsSummary = useMemo(() => ({
    CM: {
      requestId: null,
      scopeLabel: 'Multisport',
      status: 'none',
      ...(event?.featuredRequestsSummary?.CM || {}),
    },
    PUBLIC: {
      requestId: null,
      scopeLabel: 'Public',
      status: 'none',
      ...(event?.featuredRequestsSummary?.PUBLIC || {}),
    },
    SECTION: {
      requestId: null,
      scopeLabel: 'Club',
      status: 'none',
      ...(event?.featuredRequestsSummary?.SECTION || {}),
    },
  }), [event?.featuredRequestsSummary]);

  const isTeamMember = useMemo(() => {
    const userDocId = userData?.documentId;
    if (!userDocId) return false;
    const teams = [event?.team, ...(event?.invitedTeams || [])].filter(Boolean);
    const players = teams.flatMap((team) => team?.players || []);
    const trainers = teams.flatMap((team) => team?.trainers || []);
    return players.some((player) => player?.documentId === userDocId)
      || trainers.some((trainer) => trainer?.documentId === userDocId);
  }, [event?.invitedTeams, event?.team, userData?.documentId]);
  const trainerKeysForEvent = useMemo(() => {
    const teams = [event?.team, ...(event?.invitedTeams || [])].filter(Boolean);
    return new Set(
      teams
        .flatMap((team) => team?.trainers || [])
        .map((trainer) => getUserKey(trainer))
        .filter(Boolean),
    );
  }, [event?.invitedTeams, event?.team]);

  const isCurrentUserParticipating = useMemo(() => {
    const currentUserId = userData?.documentId;
    if (!currentUserId) return false;
    return (event?.participations || []).some(
      (/** @type {User} */ participant) => participant?.documentId === currentUserId
        && !trainerKeysForEvent.has(getUserKey(participant)),
    );
  }, [event?.participations, trainerKeysForEvent, userData?.documentId]);

  const { canAccessAttendance, canSelfMarkArrival } = useMemo(
    () => resolveEventAttendanceGate({
      canEdit,
      isCurrentUserParticipating,
      isTeamMember,
    }),
    [canEdit, isCurrentUserParticipating, isTeamMember],
  );

  const {
    data: attendancePayload,
    isFetching: isAttendanceFetching,
    refetch: refetchAttendance,
  } = useGetEventAttendance(
    eventId || '',
    {
      enabled: Boolean(eventId && canAccessAttendance && areDeferredQueriesEnabled),
    },
  );

  const eventStartAt = useMemo(() => {
    const backendStart = attendancePayload?.data?.eventStartAt;
    if (backendStart) {
      const parsed = new Date(backendStart);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return resolveEventStartAt(event);
  }, [attendancePayload?.data?.eventStartAt, event]);

  const eventEndedAt = useMemo(() => {
    if (event?.endDate) {
      const parsed = new Date(event.endDate);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }

    if (!eventStartAt) return null;
    return new Date(eventStartAt.getTime() + (120 * 60 * 1000));
  }, [event?.endDate, eventStartAt]);

  const isMatchFinished = useMemo(() => {
    if (!eventEndedAt) return false;
    return eventEndedAt.getTime() <= Date.now();
  }, [eventEndedAt]);

  const serverNowMs = useMemo(() => {
    const backendNowRaw = attendancePayload?.data?.serverNow;
    const backendNowMs = backendNowRaw ? new Date(backendNowRaw).getTime() : Date.now();
    const baseMs = Number.isNaN(backendNowMs) ? Date.now() : backendNowMs;
    return baseMs + elapsedSinceServerNowMs;
  }, [attendancePayload?.data?.serverNow, elapsedSinceServerNowMs]);

  useEffect(() => {
    setElapsedSinceServerNowMs(0);
  }, [attendancePayload?.data?.serverNow]);

  useEffect(() => {
    const timerId = setInterval(() => {
      setElapsedSinceServerNowMs((previous) => previous + 30000);
    }, 30000);

    return () => clearInterval(timerId);
  }, []);

  useEffect(() => {
    setSelfArrivalMarkedLocal(false);
  }, [eventId]);

  const {
    data: eventParticipations,
    isFetching: isParticipationsFetching,
    refetch: refetchParticipations,
  } = useGetEventParticipations(eventId || '', undefined, {
    includeInactive: true,
    pageSize: 100,
  }, {
    enabled: Boolean(eventId && areDeferredQueriesEnabled),
  });

  const mutations = useEventMutations(eventId, refetch, refetchParticipations);
  const handleSubmitTrainingOpenConfig = useCallback(async ({
    externalParticipantLimit,
    externalParticipantValidationMode,
  }) => {
    if (!eventId) return;

    if (!Number.isFinite(externalParticipantLimit) || externalParticipantLimit < 1) {
      Alert.alert(
        t('common.error', 'Erreur'),
        'Indique combien de places externes tu veux ouvrir pour cet entraînement.',
      );
      return;
    }

    try {
      await mutations.updateEventNoNavMutation.mutateAsync({
        documentId: eventId,
        eventData: {
          externalParticipantLimit,
          externalParticipantValidationMode,
          sessionStatus: 'open',
        },
      });
      setIsTrainingOpenModalVisible(false);
    } catch (trainingOpenError) {
      Alert.alert(
        t('common.error', 'Erreur'),
        trainingOpenError?.message || 'Impossible d\'ouvrir cet entraînement pour le moment.',
      );
    }
  }, [
    eventId,
    mutations.updateEventNoNavMutation,
    t,
  ]);
  const handleCloseTraining = useCallback(async () => {
    if (!eventId) return;

    try {
      await mutations.updateEventNoNavMutation.mutateAsync({
        documentId: eventId,
        eventData: {
          sessionStatus: 'closed',
        },
      });
    } catch (trainingCloseError) {
      Alert.alert(
        t('common.error', 'Erreur'),
        trainingCloseError?.message || 'Impossible de fermer cet entraînement pour le moment.',
      );
    }
  }, [eventId, mutations.updateEventNoNavMutation, t]);
  const approveFeaturedRequestMutation = useMutation({
    mutationFn: approveFeatured,
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible de valider cette demande.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['requestsHub'] });
      queryClient.invalidateQueries({ queryKey: ['pending-featured-requests'] });
      queryClient.invalidateQueries({ queryKey: ['planning', 'personal'] });
      refetch();
    },
  });
  const rejectFeaturedRequestMutation = useMutation({
    mutationFn: rejectFeatured,
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible de refuser cette demande.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['requestsHub'] });
      queryClient.invalidateQueries({ queryKey: ['pending-featured-requests'] });
      queryClient.invalidateQueries({ queryKey: ['planning', 'personal'] });
      refetch();
    },
  });
  const registerTournamentTeamMutation = useMutation({
    // @ts-ignore: FIXME: Baseline TS regression
    mutationFn: ({ sourceTeamId }) => registerClubTeamToTournament(eventId, sourceTeamId),
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible d inscrire cette équipe au tournoi.');
    },
    onSuccess: () => {
      setIsTournamentRegisterModalVisible(false);
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      refetch();
    },
  });
  const createTournamentTeamMutation = useMutation({
    // @ts-ignore: FIXME: Baseline TS regression
    mutationFn: ({ acceptRiskDeclaration, name }) => createCustomTournamentTeam(eventId, { acceptRiskDeclaration, name }),
    onError: (mutationError) => {
      setJoinModalError(mutationError?.message || 'Impossible de créer cette équipe de tournoi.');
    },
    onSuccess: (createdTeam) => {
      setIsJoinModalVisible(false);
      setIsTournamentParticipationModalVisible(false);
      setIsTournamentCreateModalVisible(false);
      setIsTournamentJoinSelectorVisible(false);
      setPendingTournamentAction(null);
      setJoinModalError('');
      setTournamentTeamNameDraft('');
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      refetch();
      if (createdTeam?.documentId) {
        navigation.navigate(RouteNames.TournamentTeamDetails, {
          eventId,
          teamId: createdTeam.documentId,
        });
      }
    },
  });
  const requestJoinTournamentTeamMutation = useMutation({
    // @ts-ignore: FIXME: Baseline TS regression
    mutationFn: ({ acceptRiskDeclaration, teamDocumentId }) => requestJoinTournamentTeam(teamDocumentId, { acceptRiskDeclaration }),
    onError: (mutationError) => {
      setJoinModalError(mutationError?.message || 'Impossible d envoyer cette demande pour le moment.');
    },
    onSuccess: (updatedTeam) => {
      setIsJoinModalVisible(false);
      setIsTournamentParticipationModalVisible(false);
      setIsTournamentJoinSelectorVisible(false);
      setPendingTournamentAction(null);
      setJoinModalError('');
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      refetch();
      if (updatedTeam?.documentId) {
        navigation.navigate(RouteNames.TournamentTeamDetails, {
          eventId,
          teamId: updatedTeam.documentId,
        });
      }
    },
  });
  const reviewTournamentTeamMutation = useMutation({
    // @ts-ignore: FIXME: Baseline TS regression
    mutationFn: ({ status, teamDocumentId }) => reviewTournamentTeamRegistration(teamDocumentId, status),
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible de mettre à jour cette inscription.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      refetch();
    },
  });
  const respondTournamentPresenceMutation = useMutation({
    // @ts-ignore: FIXME: Baseline TS regression
    mutationFn: ({ status, teamDocumentId }) => respondToTournamentTeam(teamDocumentId, status),
    onError: (mutationError) => {
      Alert.alert('Erreur', mutationError?.message || 'Impossible d enregistrer ta réponse tournoi.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['planning', 'personal'] });
      refetch();
    },
  });

  const attendanceByUserId = useMemo(() => {
    const items = /** @type {any[]} */ (attendancePayload?.data?.items || []);
    /**
     * @type {Record<string, {
     * arrivedAt?: string | null,
     * attendanceStatus?: string | null,
     * countsInTeamStats?: {
     *   absence?: boolean,
     *   attendance?: boolean,
     *   late?: boolean,
     *   rsvpYes?: boolean,
     * } | null,
     * declaredAt?: string | null,
     * declaredLateMinutes?: number | null,
     * declarationSource?: string | null,
     * finalOperationalStatus?: string | null,
     * finalizedAt?: string | null,
     * finalState?: string | null,
     * lateMinutes?: number | null,
     * rsvpStatus?: string | null,
     * source?: string | null,
     * manualOverride?: boolean,
     * note?: string | null,
     * updatedAt?: string | null,
     * updatedBy?: { firstname?: string, lastname?: string } | null
      }>} */
    const map = {};
    items.forEach((item) => {
      const userDocId = item?.user?.documentId;
      if (!userDocId) return;
      map[userDocId] = {
        arrivedAt: item?.attendance?.arrivedAt || null,
        attendanceStatus: item?.attendanceStatus || item?.attendance?.finalState || null,
        countsInTeamStats: item?.countsInTeamStats || null,
        declarationSource: item?.attendance?.declarationSource || null,
        declaredAt: item?.attendance?.declaredAt || null,
        declaredLateMinutes: item?.attendance?.declaredLateMinutes || 0,
        finalizedAt: item?.attendance?.finalizedAt || null,
        finalOperationalStatus: item?.finalOperationalStatus || null,
        finalState: item?.attendance?.finalState || null,
        lateMinutes: item?.attendance?.lateMinutes || 0,
        manualOverride: Boolean(item?.attendance?.manualOverride),
        note: item?.attendance?.note || null,
        rsvpStatus: item?.rsvpStatus || null,
        source: item?.attendance?.source || null,
        updatedAt: item?.attendance?.updatedAt || null,
        updatedBy: item?.attendance?.updatedBy || null,
      };
    });
    return map;
  }, [attendancePayload]);

  const myAttendance = useMemo(() => {
    const currentUserId = userData?.documentId;
    if (!currentUserId) return null;
    return attendanceByUserId[currentUserId] || null;
  }, [attendanceByUserId, userData?.documentId]);

  const hasSelfArrived = Boolean(myAttendance?.arrivedAt || selfArrivalMarkedLocal);

  const selfAttendanceStatus = useMemo(() => {
    if (!canSelfMarkArrival || !eventStartAt) {
      return null;
    }

    const eventStartMs = eventStartAt.getTime();
    if (Number.isNaN(eventStartMs)) return null;
    const normalizedAttendanceStatus = String(
      myAttendance?.attendanceStatus || myAttendance?.finalState || '',
    ).trim().toLowerCase();

    if (normalizedAttendanceStatus === 'no_show') {
      return {
        accentColor: Colors.error500 || 'rgb(248, 113, 113)',
        badgeBackgroundColor: `${Colors.error500 || 'rgb(248, 113, 113)'}22`,
        badgeBorderColor: `${Colors.error500 || 'rgb(248, 113, 113)'}38`,
        badgeLabel: 'Absence enregistrée',
        badgeTextColor: Colors.error500 || 'rgb(248, 113, 113)',
        badgeValue: null,
        description: "L'événement est terminé et aucune arrivée n'a été confirmée. Un coach doit corriger le pointage si besoin.",
        hasArrived: false,
        primaryAction: null,
        secondaryAction: null,
      };
    }

    if (myAttendance?.arrivedAt) {
      const arrivedAtMs = new Date(myAttendance.arrivedAt).getTime();
      const hasValidArrival = !Number.isNaN(arrivedAtMs);

      if (hasValidArrival && arrivedAtMs < eventStartMs) {
        const earlyMinutes = Math.max(1, Math.floor((eventStartMs - arrivedAtMs) / 60000));
        return {
          accentColor: Colors.success500 || 'rgb(34, 197, 94)',
          badgeBackgroundColor: `${Colors.success500 || 'rgb(34, 197, 94)'}22`,
          badgeBorderColor: `${Colors.success500 || 'rgb(34, 197, 94)'}38`,
          badgeLabel: 'Arrive',
          badgeTextColor: Colors.success500 || 'rgb(34, 197, 94)',
          badgeValue: null,
          description: `${earlyMinutes} min avant le début de l'événement.`,
          hasArrived: true,
          primaryAction: null,
          secondaryAction: null,
        };
      }

      const lateMinutesFromRecord = Math.max(0, Number(myAttendance.lateMinutes || 0));
      const lateMinutesFromDiff = hasValidArrival && arrivedAtMs > eventStartMs
        ? Math.max(0, Math.floor((arrivedAtMs - eventStartMs) / 60000))
        : 0;
      const lateMinutes = Math.max(lateMinutesFromRecord, lateMinutesFromDiff);

      if (lateMinutes > 0) {
        return {
          accentColor: Colors.warning500 || 'rgb(245, 158, 11)',
          badgeBackgroundColor: `${Colors.warning500 || 'rgb(245, 158, 11)'}22`,
          badgeBorderColor: `${Colors.warning500 || 'rgb(245, 158, 11)'}38`,
          badgeLabel: 'Arrive',
          badgeTextColor: Colors.warning500 || 'rgb(245, 158, 11)',
          badgeValue: `+${lateMinutes} min`,
          description: 'Ton arrivée réelle a bien été enregistrée.',
          hasArrived: true,
          primaryAction: null,
          secondaryAction: null,
        };
      }

      return {
        accentColor: Colors.success500 || 'rgb(34, 197, 94)',
        badgeBackgroundColor: `${Colors.success500 || 'rgb(34, 197, 94)'}22`,
        badgeBorderColor: `${Colors.success500 || 'rgb(34, 197, 94)'}38`,
        badgeLabel: 'Arrive',
        badgeTextColor: Colors.success500 || 'rgb(34, 197, 94)',
        badgeValue: null,
        description: 'Tu es signale present a l\'heure.',
        hasArrived: true,
        primaryAction: null,
        secondaryAction: null,
      };
    }

    const declaredLateMinutes = Math.max(0, Number(myAttendance?.declaredLateMinutes || 0));
    if (declaredLateMinutes > 0) {
      return {
        accentColor: Colors.warning500 || 'rgb(245, 158, 11)',
        badgeBackgroundColor: `${Colors.warning500 || 'rgb(245, 158, 11)'}22`,
        badgeBorderColor: `${Colors.warning500 || 'rgb(245, 158, 11)'}38`,
        badgeLabel: 'Retard annonce',
        badgeTextColor: Colors.warning500 || 'rgb(245, 158, 11)',
        badgeValue: `+${declaredLateMinutes} min`,
        description: `Retard signale : +${declaredLateMinutes} min. Confirme ton arrivée une fois sur place.`,
        hasArrived: false,
        primaryAction: {
          title: 'Mettre à jour',
          type: 'declare-late',
        },
        secondaryAction: {
          title: 'Je suis arrive',
          type: 'arrived',
        },
      };
    }

    const diffMs = eventStartMs - serverNowMs;
    if (diffMs > 0) {
      const minutesLeft = Math.max(1, Math.ceil(diffMs / 60000));
      return {
        accentColor: Colors.primary500,
        badgeBackgroundColor: `${Colors.primary500}22`,
        badgeBorderColor: `${Colors.primary500}38`,
        badgeLabel: 'Aucun signalement',
        badgeTextColor: Colors.primary500,
        badgeValue: null,
        description: `Il te reste ${minutesLeft} min pour signaler ton arrivée ou ton retard.`,
        hasArrived: false,
        primaryAction: {
          title: 'Je suis arrive',
          type: 'arrived',
        },
        secondaryAction: {
          title: 'Je serai en retard',
          type: 'declare-late',
        },
      };
    }

    const liveLateMinutes = Math.max(0, Math.floor(Math.abs(diffMs) / 60000));
    return {
      accentColor: Colors.error500 || 'rgb(248, 113, 113)',
      badgeBackgroundColor: `${Colors.error500 || 'rgb(248, 113, 113)'}22`,
      badgeBorderColor: `${Colors.error500 || 'rgb(248, 113, 113)'}38`,
      badgeLabel: 'En attente',
      badgeTextColor: Colors.error500 || 'rgb(248, 113, 113)',
      badgeValue: liveLateMinutes > 0 ? `+${liveLateMinutes} min` : null,
      description: 'Le début est passé. Signale ton retard ou confirme ton arrivée.',
      hasArrived: false,
      primaryAction: {
        title: 'Je suis arrive',
        type: 'arrived',
      },
      secondaryAction: {
        title: 'Je serai en retard',
        type: 'declare-late',
      },
    };
  }, [
    canSelfMarkArrival,
    Colors.error500,
    Colors.primary500,
    Colors.success500,
    Colors.warning500,
    eventStartAt,
    myAttendance?.arrivedAt,
    myAttendance?.attendanceStatus,
    myAttendance?.declaredLateMinutes,
    myAttendance?.finalState,
    myAttendance?.lateMinutes,
    serverNowMs,
  ]);

  const allEventParticipations = useMemo(() => {
    const pages = /** @type {any[]} */ (eventParticipations?.pages || []);
    const embeddedRequests = /** @type {EventParticipation[]} */ (
      Array.isArray(event?.participationRequests) ? event.participationRequests : []
    );
    /** @type {Map<string, EventParticipation>} */
    const deduped = new Map();
    embeddedRequests.forEach((/** @type {EventParticipation} */ participation) => {
      const key = participation?.documentId
        || `${getUserKey(participation?.user) || 'user'}:${participation?.participationStatus || 'status'}:${participation?.updatedAt || ''}:${participation?.isActive === false ? 'inactive' : 'active'}`;
      if (!key || deduped.has(key)) return;
      deduped.set(key, participation);
    });
    pages.forEach((page) => {
      (page?.data || []).forEach((/** @type {EventParticipation} */ participation) => {
        const key = participation?.documentId
          || `${getUserKey(participation?.user) || 'user'}:${participation?.participationStatus || 'status'}:${participation?.updatedAt || ''}:${participation?.isActive === false ? 'inactive' : 'active'}`;
        if (!key || deduped.has(key)) return;
        deduped.set(key, participation);
      });
    });
    return /** @type {EventParticipation[]} */ (Array.from(deduped.values()));
  }, [event?.participationRequests, eventParticipations?.pages]);

  const activeEventParticipations = useMemo(
    () => allEventParticipations.filter((participation) => participation?.isActive !== false),
    [allEventParticipations],
  );

  const currentUserParticipationState = useMemo(
    () => getCurrentUserEventParticipationState({
      missings: event?.missings,
      participationRequests: activeEventParticipations,
      participations: event?.participations,
      user: userData,
    }),
    [activeEventParticipations, event?.missings, event?.participations, userData],
  );
  const canViewPublishedComposition = useMemo(() => {
    const effectiveStatus = String(currentUserParticipationState?.effectiveStatus || '').trim().toLowerCase();
    return canEdit || isTeamMember || effectiveStatus === 'accepted' || effectiveStatus === 'missing';
  }, [canEdit, currentUserParticipationState?.effectiveStatus, isTeamMember]);

  const { hasAcceptedRequest, hasPendingRequest } = currentUserParticipationState;
  const isDetectionEvent = useMemo(
    () => normalizeEventTypeLabel(event?.type?.name).includes('detection'),
    [event?.type?.name],
  );
  const detectionRecruitmentAds = useMemo(() => {
    if (!isDetectionEvent || !Array.isArray(event?.recruitmentAds)) return [];
    // @ts-ignore: FIXME: Baseline TS regression
    return event.recruitmentAds.filter((recruitmentAd) => {
      if (!recruitmentAd?.position) return false;
      if (!recruitmentAd?.event?.documentId) return true;
      return recruitmentAd.event.documentId === event?.documentId;
    });
  }, [event?.documentId, event?.recruitmentAds, isDetectionEvent]);
  const currentUserDetectionParticipation = useMemo(() => {
    const currentUserDocumentId = userData?.documentId;
    if (!currentUserDocumentId) return null;

    return activeEventParticipations.find((participation) => (
      participation?.user?.documentId === currentUserDocumentId
      // @ts-ignore: FIXME: Baseline TS regression
      && participation?.recruitmentAd?.documentId
      && ['accepted', 'pending'].includes(String(participation?.participationStatus || '').toLowerCase())
    )) || null;
  }, [activeEventParticipations, userData?.documentId]);
  const detectionSlots = useMemo(() => (
    // @ts-ignore: FIXME: Baseline TS regression
    detectionRecruitmentAds.map((slot) => {
      const relatedParticipations = activeEventParticipations.filter(
        // @ts-ignore: FIXME: Baseline TS regression
        (participation) => participation?.recruitmentAd?.documentId === slot?.documentId,
      );
      const acceptedCount = relatedParticipations.filter(
        (participation) => participation?.participationStatus === 'accepted',
      ).length;
      const pendingCount = relatedParticipations.filter(
        (participation) => participation?.participationStatus === 'pending',
      ).length;
      const candidatesCount = Math.max(
        Array.isArray(slot?.candidates) ? slot.candidates.length : 0,
        acceptedCount + pendingCount,
      );
      const quantity = Math.max(1, Number(slot?.quantity || 1));
      const remaining = Math.max(0, quantity - acceptedCount);

      return {
        ...slot,
        acceptedCount,
        candidatesCount,
        isComplete: remaining <= 0,
        pendingCount,
        quantity,
        remaining,
      };
    })
  ), [activeEventParticipations, detectionRecruitmentAds]);
  const detectionSlotsSummary = useMemo(() => {
    // @ts-ignore: FIXME: Baseline TS regression
    const totalOpen = detectionSlots.reduce((sum, slot) => sum + (slot?.isComplete ? 0 : 1), 0);
    // @ts-ignore: FIXME: Baseline TS regression
    const totalRequested = detectionSlots.reduce((sum, slot) => sum + Number(slot?.quantity || 0), 0);

    return {
      totalOpen,
      totalRequested,
    };
  }, [detectionSlots]);
  const currentParticipationFlow = useMemo(() => resolveParticipationFlow(event, {
    detectionSlotsCount: detectionSlots.length,
    participationState: currentUserParticipationState,
    user: userData,
  }), [currentUserParticipationState, detectionSlots.length, event, userData]);
  const tournamentAwareParticipationFlow = useMemo(() => {
    if (!isTournamentEvent || isStageDayEvent || userData?.role?.name !== USER_ROLES.player) {
      return currentParticipationFlow;
    }

    if (managedTournamentTeam?.documentId) {
      return {
        ...currentParticipationFlow,
        actionLabel: 'Gérer mon équipe tournoi',
        confirmLabel: 'Gérer mon équipe tournoi',
      };
    }

    if (currentUserTournamentTeam?.documentId) {
      return {
        ...currentParticipationFlow,
        actionLabel: 'Voir mon équipe tournoi',
        confirmLabel: 'Voir mon équipe tournoi',
      };
    }

    if (currentUserPendingTournamentTeam?.documentId) {
      return {
        ...currentParticipationFlow,
        actionLabel: 'Suivre ma demande',
        confirmLabel: 'Suivre ma demande',
      };
    }

    return {
      ...currentParticipationFlow,
      actionLabel: 'Participer',
      confirmLabel: 'Participer',
    };
  }, [
    currentParticipationFlow,
    currentUserPendingTournamentTeam?.documentId,
    currentUserTournamentTeam?.documentId,
    isStageDayEvent,
    isTournamentEvent,
    managedTournamentTeam?.documentId,
    userData?.role?.name,
  ]);

  const pendingParticipations = useMemo(
    () => /** @type {EventParticipation[]} */ (
      activeEventParticipations.filter((participation) => participation.participationStatus === 'pending')
    ),
    [activeEventParticipations],
  );

  const inactiveEventParticipations = useMemo(
    () => allEventParticipations.filter((participation) => participation?.isActive === false),
    [allEventParticipations],
  );

  const {
    externalParticipationSection,
    participantsSummary,
    teamParticipationSections,
  } = useMemo(() => {
    if (!event) {
      return {
        externalParticipationSection: null,
        participantsSummary: {
          capacity: 0,
          participatingCount: 0,
        },
        teamParticipationSections: [],
      };
    }

    const teamBuckets = [
      event?.team ? {
        isHome: true,
        key: event.team.documentId || 'home-team',
        players: getEligibleTeamPlayers(event.team),
        teamName: event.team.name || 'Équipe organisatrice',
      } : null,
      ...((event?.invitedTeams || []).map((/** @type {any} */ team) => ({
        isHome: false,
        key: team?.documentId || `invited-${team?.name || 'team'}`,
        players: getEligibleTeamPlayers(team),
        teamName: team?.name || 'Équipe invitée',
      }))),
    ].filter(Boolean);

    const knownTeamPlayerKeys = new Set(
      teamBuckets
        .flatMap((bucket) => bucket.players || [])
        .map((/** @type {User} */ player) => getUserKey(player))
        .filter(Boolean),
    );
    const knownTeamSectionKeys = new Set(teamBuckets.map((bucket) => bucket.key));
    const teamKeyByUserKey = new Map();
    const teamNameByUserKey = new Map();
    teamBuckets.forEach((bucket) => {
      (bucket.players || []).forEach((/** @type {User} */ player) => {
        const userKey = getUserKey(player);
        if (!userKey || teamKeyByUserKey.has(userKey)) return;
        teamKeyByUserKey.set(userKey, bucket.key);
        teamNameByUserKey.set(userKey, bucket.teamName);
      });
    });

    const participatingUsers = filterUsersByExcludedKeys(event?.participations || [], trainerKeysForEvent);
    const missingUsers = filterUsersByExcludedKeys(event?.missings || [], trainerKeysForEvent);
    const participatingKeys = new Set(participatingUsers.map((/** @type {User} */ participant) => getUserKey(participant)).filter(Boolean));
    const missingKeys = new Set(missingUsers.map((/** @type {User} */ missing) => getUserKey(missing)).filter(Boolean));

    const pendingByUserKey = new Map();
    pendingParticipations.forEach((participation) => {
      const key = getUserKey(participation?.user);
      if (!key || trainerKeysForEvent.has(key)) return;
      pendingByUserKey.set(key, participation);
    });

    /** @type {Map<string, any>} */
    const historicalByTeam = new Map();
    const historicalExternal = /** @type {{ missing: User[]; participating: User[]; pending: EventParticipation[] }} */ ({
      missing: [],
      participating: [],
      pending: [],
    });
    inactiveEventParticipations
      .filter((participation) => participation?.user)
      .forEach((participation) => {
        const userKey = getUserKey(participation?.user);
        if (!userKey || trainerKeysForEvent.has(userKey)) return;
        const sourceTeamId = participation?.sourceTeam?.documentId;
        const sourceTeamKnown = Boolean(
          sourceTeamId && knownTeamSectionKeys.has(sourceTeamId),
        );
        const fallbackTeamKey = userKey ? teamKeyByUserKey.get(userKey) : null;
        const resolvedTeamKey = sourceTeamKnown ? sourceTeamId : fallbackTeamKey;
        let resolvedTeamName = null;
        if (sourceTeamKnown) {
          resolvedTeamName = participation?.sourceTeam?.name || null;
        } else if (userKey) {
          resolvedTeamName = teamNameByUserKey.get(userKey) || null;
        }
        const isExternal = !resolvedTeamKey;

        if (isExternal) {
          if (participation.participationStatus === 'missing') {
            historicalExternal.missing.push(participation.user);
          } else if (participation.participationStatus === 'accepted') {
            historicalExternal.participating.push(participation.user);
          } else if (participation.participationStatus === 'pending') {
            historicalExternal.pending.push(participation);
          }
          return;
        }

        const teamKey = resolvedTeamKey;
        const teamName = resolvedTeamName || 'Équipe retirée';
        const current = historicalByTeam.get(teamKey) || {
          key: teamKey,
          missing: [],
          participating: [],
          pending: [],
          teamName,
        };
        if (participation.participationStatus === 'missing') {
          current.missing.push(participation.user);
        } else if (participation.participationStatus === 'accepted') {
          current.participating.push(participation.user);
        } else if (participation.participationStatus === 'pending') {
          current.pending.push(participation);
        }
        historicalByTeam.set(teamKey, current);
      });

    const sections = teamBuckets.map((bucket) => {
      const participating = bucket.players.filter((/** @type {User} */ player) => participatingKeys.has(getUserKey(player)));
      const missing = bucket.players.filter((/** @type {User} */ player) => missingKeys.has(getUserKey(player)));
      const pending = bucket.players
        .map((/** @type {User} */ player) => pendingByUserKey.get(getUserKey(player)))
        .filter(Boolean);
      const notAnswered = bucket.players.filter((/** @type {User} */ player) => {
        const key = getUserKey(player);
        return !participatingKeys.has(key) && !missingKeys.has(key) && !pendingByUserKey.has(key);
      });

      const historical = historicalByTeam.get(bucket.key) || {
        missing: [],
        participating: [],
        pending: [],
      };

      return {
        ...bucket,
        allowCoachActions: canEdit,
        historical: {
          missing: uniqueUsers(historical.missing || []),
          participating: uniqueUsers(historical.participating || []),
          pending: historical.pending || [],
        },
        missing: uniqueUsers(missing),
        notAnswered: uniqueUsers(notAnswered),
        participating: uniqueUsers(participating),
        pending,
      };
    });

    const existingSectionKeys = new Set(sections.map((section) => section.key));
    historicalByTeam.forEach((historicalSection, key) => {
      if (existingSectionKeys.has(key)) return;
      sections.push({
        allowCoachActions: false,
        historical: {
          missing: uniqueUsers(historicalSection.missing || []),
          participating: uniqueUsers(historicalSection.participating || []),
          pending: historicalSection.pending || [],
        },
        isHome: false,
        key,
        missing: [],
        notAnswered: [],
        participating: [],
        pending: [],
        players: [],
        teamName: historicalSection.teamName,
      });
    });

    const externalParticipating = uniqueUsers(
      participatingUsers.filter((/** @type {User} */ user) => !knownTeamPlayerKeys.has(getUserKey(user))),
    );
    const externalMissing = uniqueUsers(
      missingUsers.filter((/** @type {User} */ user) => !knownTeamPlayerKeys.has(getUserKey(user))),
    );
    const externalPending = pendingParticipations.filter(
      (participation) => !knownTeamPlayerKeys.has(getUserKey(participation?.user)),
    );
    const externalHistorical = {
      missing: uniqueUsers(historicalExternal.missing || []),
      participating: uniqueUsers(historicalExternal.participating || []),
      pending: historicalExternal.pending || [],
    };

    const hasExternalData = externalParticipating.length > 0
      || externalMissing.length > 0
      || externalPending.length > 0
      || externalHistorical.participating.length > 0
      || externalHistorical.missing.length > 0
      || externalHistorical.pending.length > 0;

    const visibleParticipating = uniqueUsers([
      ...sections.flatMap((section) => section.participating || []),
      ...externalParticipating,
    ]);

    return {
      externalParticipationSection: hasExternalData
        ? {
          allowCoachActions: canEdit,
          historical: externalHistorical,
          isExternal: true,
          key: 'external-participants',
          missing: externalMissing,
          notAnswered: [],
          participating: externalParticipating,
          pending: externalPending,
          players: [],
          teamName: 'Participants externes',
        }
        : null,
      participantsSummary: {
        capacity: Number(event?.capacity || 0),
        participatingCount: visibleParticipating.length,
      },
      teamParticipationSections: sections,
    };
  }, [canEdit, event, inactiveEventParticipations, pendingParticipations, trainerKeysForEvent]);

  const participationsByStatus = useMemo(() => {
    if (!canEdit) {
      return {
        missing: [],
        notAnswered: [],
        participating: filterUsersByExcludedKeys(event?.participations || [], trainerKeysForEvent),
      };
    }

    const teamPlayers = uniqueUsers([
      ...getEligibleTeamPlayers(event?.team),
      ...((event?.invitedTeams || []).flatMap((/** @type {any} */ team) => getEligibleTeamPlayers(team))),
    ]);
    const participatingPlayers = filterUsersByExcludedKeys(event?.participations || [], trainerKeysForEvent);
    const missingPlayers = filterUsersByExcludedKeys(event?.missings || [], trainerKeysForEvent);
    const pendingKeys = new Set(
      (pendingParticipations || [])
        .map((participation) => getUserKey(participation?.user))
        .filter((key) => Boolean(key) && !trainerKeysForEvent.has(key)),
    );

    const notAnsweredPlayers = teamPlayers.filter((player) => {
      const key = getUserKey(player);
      return !participatingPlayers.some((/** @type {User} */ participant) => getUserKey(participant) === key)
        && !missingPlayers.some((/** @type {User} */ missing) => getUserKey(missing) === key)
        && !pendingKeys.has(key);
    });

    return {
      missing: missingPlayers,
      notAnswered: notAnsweredPlayers,
      participating: participatingPlayers,
    };
  }, [canEdit, event, pendingParticipations, trainerKeysForEvent]);
  const applyToDetectionSlotMutation = useMutation({
    // @ts-ignore: FIXME: Baseline TS regression
    mutationFn: ({ payload = {}, slotDocumentId }) => applyToRecruitmentAd(slotDocumentId, payload),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
      queryClient.invalidateQueries({ queryKey: ['eventParticipations', eventId] });
      queryClient.invalidateQueries({ queryKey: ['recruitmentAds'] });
      // @ts-ignore: FIXME: Baseline TS regression
      queryClient.invalidateQueries({ queryKey: ['recruitmentAd', variables?.slotDocumentId] });
      queryClient.invalidateQueries({ queryKey: ['myApplications'] });
      Alert.alert(
        'Detection',
        // @ts-ignore: FIXME: Baseline TS regression
        result?.message || 'Ta participation a bien été envoyée sur ce poste.',
      );
    },
  });

  const featuredScopeOptions = useMemo(() => ([
    {
      kind: 'PUBLIC',
      label: 'À la une publique',
      status: featuredRequestsSummary.PUBLIC.status,
      summary: featuredRequestsSummary.PUBLIC,
      visible: canManageFeatured,
    },
    {
      kind: 'SECTION',
      label: 'À la une dans mon club',
      status: featuredRequestsSummary.SECTION.status,
      summary: featuredRequestsSummary.SECTION,
      visible: canManageFeatured && Boolean(eventClubId),
    },
    {
      kind: 'CM',
      label: 'À la une dans le club multisport',
      status: featuredRequestsSummary.CM.status,
      summary: featuredRequestsSummary.CM,
      visible: canManageFeatured && Boolean(eventMultisportId),
    },
  ].filter((option) => option.visible)), [
    canManageFeatured,
    eventClubId,
    eventMultisportId,
    featuredRequestsSummary.CM,
    featuredRequestsSummary.PUBLIC,
    featuredRequestsSummary.SECTION,
  ]);

  const canRequestFeatured = useMemo(
    () => featuredScopeOptions.some((option) => option.status === 'none' || option.status === 'rejected'),
    [featuredScopeOptions],
  );

  const hasPendingFeaturedScope = useMemo(
    () => featuredScopeOptions.some((option) => option.status === 'pending'),
    [featuredScopeOptions],
  );

  const hasApprovedFeaturedScope = useMemo(
    () => featuredScopeOptions.some((option) => option.status === 'approved'),
    [featuredScopeOptions],
  );

  const selectedFeaturedScopeKinds = useMemo(
    () => Object.entries(selectedFeaturedScopes)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([kind]) => kind),
    [selectedFeaturedScopes],
  );

  const pendingFeaturedApproval = useMemo(() => {
    if (userData?.role?.name === USER_ROLES.superAdmin && featuredRequestsSummary.PUBLIC.status === 'pending') {
      return {
        requestId: featuredRequestsSummary.PUBLIC.requestId,
        scopeLabel: featuredRequestsSummary.PUBLIC.scopeLabel,
      };
    }

    if (isClubManagerForEvent && featuredRequestsSummary.SECTION.status === 'pending') {
      return {
        requestId: featuredRequestsSummary.SECTION.requestId,
        scopeLabel: featuredRequestsSummary.SECTION.scopeLabel,
      };
    }

    if (isMultisportAdminForEvent && featuredRequestsSummary.CM.status === 'pending') {
      return {
        requestId: featuredRequestsSummary.CM.requestId,
        scopeLabel: featuredRequestsSummary.CM.scopeLabel,
      };
    }

    return null;
  }, [
    featuredRequestsSummary.CM.requestId,
    featuredRequestsSummary.CM.scopeLabel,
    featuredRequestsSummary.CM.status,
    featuredRequestsSummary.PUBLIC.requestId,
    featuredRequestsSummary.PUBLIC.scopeLabel,
    featuredRequestsSummary.PUBLIC.status,
    featuredRequestsSummary.SECTION.requestId,
    featuredRequestsSummary.SECTION.scopeLabel,
    featuredRequestsSummary.SECTION.status,
    isClubManagerForEvent,
    isMultisportAdminForEvent,
    userData?.role?.name,
  ]);

  useEffect(() => {
    if (isFeaturedModalVisible) return;
    setSelectedFeaturedScopes({
      CM: false,
      PUBLIC: false,
      SECTION: false,
    });
  }, [isFeaturedModalVisible]);

  const computeLateMinutes = useCallback((/** @type {string | null | undefined} */ arrivedAtIso) => {
    const eventStart = eventStartAt;
    const arrivedAt = arrivedAtIso ? new Date(arrivedAtIso) : null;
    if (!eventStart || !arrivedAt || Number.isNaN(arrivedAt.getTime())) return 0;
    const diffMs = arrivedAt.getTime() - eventStart.getTime();
    if (diffMs <= 0) return 0;
    return Math.floor(diffMs / 60000);
  }, [eventStartAt]);

  const handleEditEvent = useCallback(() => {
    navigation.navigate(RouteNames.EventStack, {
      params: { eventId },
      screen: RouteNames.EventEdit,
    });
  }, [eventId, navigation]);

  // @ts-ignore: FIXME: Baseline TS regression
  const handleOpenTournamentTeam = useCallback((teamDocumentId) => {
    if (!teamDocumentId) return;
    navigation.navigate(RouteNames.TournamentTeamDetails, {
      eventId,
      teamId: teamDocumentId,
    });
  }, [eventId, navigation]);

  const handleOpenTournamentManagement = useCallback(() => {
    if (!eventId) return;
    navigation.navigate(RouteNames.TournamentManagement, { eventId });
  }, [eventId, navigation]);

  const handleOpenTournamentSettings = useCallback(() => {
    if (!eventId) return;
    navigation.navigate(RouteNames.TournamentSettingsEdit, { eventId });
  }, [eventId, navigation]);

  // @ts-ignore: FIXME: Baseline TS regression
  const handleRespondTournamentPresence = useCallback((status) => {
    if (!currentUserTournamentTeam?.documentId) return;
    // @ts-ignore: FIXME: Baseline TS regression
    respondTournamentPresenceMutation.mutate({
      status,
      teamDocumentId: currentUserTournamentTeam.documentId,
    });
  }, [currentUserTournamentTeam?.documentId, respondTournamentPresenceMutation]);

  const closeTournamentParticipationFlow = useCallback(() => {
    setIsTournamentParticipationModalVisible(false);
    setIsTournamentCreateModalVisible(false);
    setIsTournamentJoinSelectorVisible(false);
    setPendingTournamentAction(null);
    setJoinModalError('');
  }, []);

  const handleOpenTournamentParticipationOptions = useCallback(() => {
    if (userData?.role?.name !== USER_ROLES.player) return;

    if (!canCreateCustomTournamentTeam && joinableTournamentTeams.length === 0) {
      Alert.alert(
        'Tournoi',
        'Aucune équipe tournoi ouverte ne peut être rejointe pour le moment.',
      );
      return;
    }

    setPendingDetectionSlot(null);
    setJoinModalError('');
    setPendingTournamentAction(null);
    setIsTournamentCreateModalVisible(false);
    setIsTournamentJoinSelectorVisible(false);
    setIsTournamentParticipationModalVisible(true);
  }, [
    canCreateCustomTournamentTeam,
    joinableTournamentTeams.length,
    userData?.role?.name,
  ]);

  // @ts-ignore: FIXME: Baseline TS regression
  const handleSelectExistingTournamentTeam = useCallback((team) => {
    if (!team?.documentId) return;
    setPendingTournamentAction({
      // @ts-ignore: FIXME: Baseline TS regression
      mode: 'join_existing',
      teamDocumentId: team.documentId,
      teamName: team?.name || 'Équipe tournoi',
    });
    setIsTournamentJoinSelectorVisible(false);
    setJoinModalError('');
    setIsJoinModalVisible(true);
  }, []);

  const handleCreateTournamentTeam = useCallback(() => {
    const trimmedName = String(tournamentTeamNameDraft || '').trim();
    if (!trimmedName) {
      Alert.alert('Équipe tournoi', 'Ajoute un nom d équipe avant de continuer.');
      return;
    }

    setPendingTournamentAction({
      // @ts-ignore: FIXME: Baseline TS regression
      mode: 'create_custom',
      teamName: trimmedName,
    });
    setIsTournamentParticipationModalVisible(false);
    setIsTournamentCreateModalVisible(false);
    setJoinModalError('');
    setIsJoinModalVisible(true);
  }, [tournamentTeamNameDraft]);

  // @ts-ignore: FIXME: Baseline TS regression
  const handleReviewTournamentTeam = useCallback((teamDocumentId, status) => {
    // @ts-ignore: FIXME: Baseline TS regression
    reviewTournamentTeamMutation.mutate({ status, teamDocumentId });
  }, [reviewTournamentTeamMutation]);

  // @ts-ignore: FIXME: Baseline TS regression
  const toggleFeaturedScope = useCallback((kind) => {
    setSelectedFeaturedScopes((previous) => ({
      ...previous,
      // @ts-ignore: FIXME: Baseline TS regression
      [kind]: !previous[kind],
    }));
  }, []);

  const handleSubmitFeaturedScopes = useCallback(() => {
    if (!selectedFeaturedScopeKinds.length || !eventId) return;
    setIsFeaturedModalVisible(false);
    mutations.requestFeaturedMutation.mutate({
      eventId,
      scopes: selectedFeaturedScopeKinds,
    });
  }, [eventId, mutations.requestFeaturedMutation, selectedFeaturedScopeKinds]);

  const handleRejectFeaturedApproval = useCallback(() => {
    if (!pendingFeaturedApproval?.requestId) return;
    Alert.alert(
      'Refuser la demande ?',
      'Le demandeur sera notifié du refus.',
      [
        { style: 'cancel', text: 'Annuler' },
        {
          onPress: () => rejectFeaturedRequestMutation.mutate({ requestId: pendingFeaturedApproval.requestId }),
          style: 'destructive',
          text: 'Refuser',
        },
      ],
    );
  }, [pendingFeaturedApproval?.requestId, rejectFeaturedRequestMutation]);

  // @ts-ignore: FIXME: Baseline TS regression
  const handleApplyToDetectionSlot = useCallback((slot) => {
    const slotDocumentId = slot?.documentId;
    if (!slotDocumentId || applyToDetectionSlotMutation.isPending) return;
    setPendingDetectionSlot(slot);
    setJoinModalError('');
    setIsJoinModalVisible(true);
  }, [applyToDetectionSlotMutation.isPending]);

  // @ts-ignore: FIXME: Baseline TS regression
  const handleOpenDetectionSlot = useCallback((slot) => {
    if (!slot?.documentId) return;
    navigation.navigate(RouteNames.RecruitmentAdDetails, {
      ad: slot,
      adId: slot.documentId,
    });
  }, [navigation]);

  // @ts-ignore: FIXME: Baseline TS regression
  const handleBlockedParticipationFlow = useCallback((flow) => {
    if (!flow?.blockedReason) return;
    Alert.alert('Participation', flow.blockedReason);
  }, []);

  const handleJoinEvent = useCallback(() => {
    if (isTournamentEvent && !isStageDayEvent && userData?.role?.name === USER_ROLES.player) {
      if (managedTournamentTeam?.documentId) {
        handleOpenTournamentTeam(managedTournamentTeam.documentId);
        return;
      }
      if (currentUserTournamentTeam?.documentId) {
        handleOpenTournamentTeam(currentUserTournamentTeam.documentId);
        return;
      }
      if (currentUserPendingTournamentTeam?.documentId) {
        handleOpenTournamentTeam(currentUserPendingTournamentTeam.documentId);
        return;
      }
      handleOpenTournamentParticipationOptions();
      return;
    }

    if (currentParticipationFlow?.submitMode === 'redirect-parent') {
      const parentEventId = event?.parentEvent?.documentId;
      if (parentEventId) {
        navigation.navigate(RouteNames.EventDetails, { eventId: parentEventId });
      }
      return;
    }

    if (currentParticipationFlow?.submitMode === 'detection-slot-picker') {
      setIsJoinModalVisible(false);
      setIsDetectionSlotPickerVisible(true);
      return;
    }

    if (!currentParticipationFlow?.canAct) {
      handleBlockedParticipationFlow(currentParticipationFlow);
      return;
    }

    setJoinModalError('');
    setIsJoinModalVisible(true);
  }, [
    currentParticipationFlow,
    event?.parentEvent?.documentId,
    handleBlockedParticipationFlow,
    handleOpenTournamentParticipationOptions,
    handleOpenTournamentTeam,
    currentUserPendingTournamentTeam?.documentId,
    currentUserTournamentTeam?.documentId,
    isStageDayEvent,
    isTournamentEvent,
    managedTournamentTeam?.documentId,
    navigation,
    userData?.role?.name,
  ]);

  const handleParticipateToEvent = useCallback((eventToParticipate = event) => {
    const targetEventId = eventToParticipate?.documentId;
    const targetIsStageDay = String(eventToParticipate?.eventFormat || '').toLowerCase() === 'stage_day';
    if (targetIsStageDay && targetEventId) {
      // @ts-ignore: FIXME: Baseline TS regression
      mutations.respondToEventRsvpMutation.mutate({
        answer: 'present',
        eventId: targetEventId,
      });
      return;
    }

    handleJoinEvent();
  }, [event, handleJoinEvent, mutations.respondToEventRsvpMutation]);

  const handleConfirmParticipation = useCallback(async () => {
    if (!event?.documentId) return;

    if (!currentParticipationFlow?.canAct) {
      handleBlockedParticipationFlow(currentParticipationFlow);
      return;
    }

    setJoinModalError('');

    try {
      if (currentParticipationFlow.submitMode === 'joinReservation') {
        await mutations.joinReservationMutation.mutateAsync(event.documentId);
      } else {
        if (!userData?.documentId) return;
        await mutations.createEventParticipationMutation.mutateAsync({
          event: event.documentId,
          user: userData.documentId,
        });
      }

      setIsJoinModalVisible(false);
      setPendingDetectionSlot(null);
    } catch (mutationError) {
      setJoinModalError(
        getParticipationErrorMessage(mutationError, 'Impossible de confirmer ta participation pour le moment.'),
      );
    }
  }, [
    currentParticipationFlow,
    event?.documentId,
    handleBlockedParticipationFlow,
    mutations.createEventParticipationMutation,
    mutations.joinReservationMutation,
    userData?.documentId,
  ]);

  // @ts-ignore: FIXME: Baseline TS regression
  const handleApplyToDetectionSlotFromPicker = useCallback((slot) => {
    const slotDocumentId = String(slot?.documentId || '').trim();
    if (!slotDocumentId || applyToDetectionSlotMutation.isPending) return;
    setIsDetectionSlotPickerVisible(false);
    setPendingDetectionSlot(slot);
    setJoinModalError('');
    setIsJoinModalVisible(true);
  }, [applyToDetectionSlotMutation.isPending]);

  const handleDeclineEvent = (/** @type {any} */ eventToDecline) => {
    if (!eventToDecline?.documentId) return;
    if (String(eventToDecline?.eventFormat || '').toLowerCase() === 'stage_day') {
      // @ts-ignore: FIXME: Baseline TS regression
      mutations.respondToEventRsvpMutation.mutate({
        answer: 'absent',
        eventId: eventToDecline.documentId,
      });
      return;
    }
    mutations.missingEventMutation.mutate(eventToDecline.documentId);
  };

  const handleRemindPlayers = () => {
    if (!eventId) return;
    mutations.remindEventMutation.mutate(eventId);
  };

  const handleUserPress = (/** @type {User | null | undefined} */ user) => {
    if (!user?.documentId) return;
    navigation.navigate(RouteNames.ProfileStack, {
      params: { userId: user.documentId },
      screen: RouteNames.UserDetails,
    });
  };

  const handleUpdateParticipation = (
    /** @type {string | undefined} */ participationId,
    /** @type {string | undefined} */ status,
  ) => {
    if (!participationId) return;
    setSelectedParticipationId(participationId);

    if (status === 'accepted') {
      Alert.alert(t('eventDetails.modals.accept.title'), '', [
        { onPress: () => setSelectedParticipationId(''), style: 'cancel', text: t('eventDetails.modals.actions.cancel') },
        {
          onPress: () => {
            mutations.acceptParticipationMutation.mutate(participationId);
            setSelectedParticipationId('');
          },
          text: t('eventDetails.modals.actions.confirm'),
        },
      ]);
      return;
    }

    if (status === 'declined') {
      setIsRefuseModalVisible(true);
    }
  };

  const handleBackAfterCreation = useCallback(() => {
    const parentNavigation = navigation.getParent();
    if (parentNavigation?.canGoBack?.()) {
      parentNavigation.goBack();
      return;
    }

    navigation.navigate(RouteNames.HomeTab, { screen: RouteNames.MyEventList });
  }, [navigation]);

  const handleDeleteParticipation = useCallback(() => {
    const currentUserKey = getUserKey(userData);
    if (!currentUserKey) return;

    const myParticipation = activeEventParticipations.find(
      (participation) => participation?.documentId
        && getUserKey(participation?.user) === currentUserKey,
    );

    if (myParticipation?.documentId) {
      Alert.alert(
        t('eventDetails.modals.deleteParticipation.title'),
        t('eventDetails.modals.deleteParticipation.description'),
        [
          { style: 'cancel', text: t('eventDetails.modals.deleteParticipation.actions.cancel') },
          {
            onPress: () => mutations.deleteParticipationMutation.mutate(String(myParticipation.documentId)),
            style: 'destructive',
            text: t('eventDetails.modals.deleteParticipation.actions.confirm'),
          },
        ],
      );
      return;
    }

    if (event?.missings?.some((/** @type {User} */ missing) => getUserKey(missing) === currentUserKey)) {
      Alert.alert(
        t('eventDetails.modals.editResponse.title'),
        t('eventDetails.modals.editResponse.description'),
        [
          { style: 'cancel', text: t('eventDetails.modals.actions.cancel') },
          {
            onPress: () => {
              if (!event?.documentId || !userData?.documentId) return;
              mutations.createEventParticipationMutation.mutate({
                event: event.documentId,
                user: userData.documentId,
              });
              setIsJoinModalVisible(false);
            },
            text: t('eventDetails.modals.actions.confirm'),
          },
        ],
      );
      return;
    }

    const isListedAsParticipant = (event?.participations || []).some(
      (/** @type {User} */ participant) => getUserKey(participant) === currentUserKey,
    );

    if (isListedAsParticipant && event?.documentId) {
      Alert.alert(
        t('eventDetails.modals.deleteParticipation.title'),
        t('eventDetails.modals.deleteParticipation.description'),
        [
          { style: 'cancel', text: t('eventDetails.modals.deleteParticipation.actions.cancel') },
          {
            onPress: () => mutations.missingEventMutation.mutate(event.documentId),
            style: 'destructive',
            text: t('eventDetails.modals.deleteParticipation.actions.confirm'),
          },
        ],
      );
      return;
    }

    Alert.alert(
      t('common.error'),
      'Impossible de retrouver ta réponse pour cet événement. Recharge la page et réessaie.',
    );
  }, [
    activeEventParticipations,
    event,
    mutations,
    t,
    userData,
  ]);

  const handleExportParticipants = useCallback(async () => {
    if (!eventId) return;
    Alert.alert(t('common.loading'), t('eventDetails.exporting'));
    try {
      const path = await exportEventParticipants(eventId, event?.name || 'participants');
      if (Platform.OS === 'ios') {
        setTimeout(() => {
          SharePlatform.share({ title: 'Participants', url: path }).catch(() => undefined);
        }, 500);
      } else {
        ReactNativeBlobUtil.android
          .actionViewIntent(path, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
          .catch(() => Alert.alert(t('common.success'), t('eventDetails.exportSuccess')));
      }
    } catch (exportError) {
      Alert.alert(t('common.error'), t('eventDetails.exportError'));
    }
  }, [event?.name, eventId, t]);

  const handleShareEventInChat = useCallback((/** @type {string} */ chatId) => {
    const sentMessageId = sendMessage(chatId, 'Partage', { event: eventId || '' });

    if (!sentMessageId) {
      Alert.alert(
        t('common.error'),
        t('event.shareInChatError', 'Impossible de partager l\'événement pour le moment.'),
      );
      return;
    }

    setIsShareModalVisible(false);
    setTimeout(() => {
      Alert.alert(
        t('event.shareInChatSuccessTitle', 'Événement partage'),
        t(
          'event.shareInChatSuccessDescription',
          'Ton événement a bien été partage. Appuie sur OK pour ouvrir la conversation.',
        ),
        [
          {
            onPress: () => navigation.navigate(RouteNames.Conversation, { chatId }),
            text: 'OK',
          },
        ],
      );
    }, 120);
  }, [eventId, navigation, sendMessage, t]);

  const handleCancelEvent = useCallback(() => {
    if (!eventId) return;
    if (event?.recurrenceGroupId) {
      Alert.alert(
        t('eventDetails.modals.recurrenceCancel.title'),
        t('eventDetails.modals.recurrenceCancel.description'),
        [
          { style: 'cancel', text: t('eventDetails.modals.actions.cancel') },
          {
            onPress: () => mutations.cancelEventMutation.mutate({ documentId: eventId }),
            style: 'destructive',
            text: t('eventDetails.modals.recurrenceCancel.actions.thisEvent'),
          },
          {
            onPress: () => mutations.cancelEventMutation.mutate({
              documentId: eventId,
              recurrenceMode: 'future',
            }),
            style: 'destructive',
            text: t('eventDetails.modals.recurrenceCancel.actions.future'),
          },
          {
            onPress: () => mutations.cancelEventMutation.mutate({
              documentId: eventId,
              recurrenceMode: 'all',
            }),
            style: 'destructive',
            text: t('eventDetails.modals.recurrenceCancel.actions.all'),
          },
        ],
      );
      return;
    }

    Alert.alert(
      t('eventDetails.modals.cancelEvent.title'),
      t('eventDetails.modals.cancelEvent.description'),
      [
        { style: 'cancel', text: t('eventDetails.modals.actions.cancel') },
        {
          onPress: () => mutations.cancelEventMutation.mutate({ documentId: eventId }),
          style: 'destructive',
          text: t('eventDetails.modals.actions.confirm'),
        },
      ],
    );
  }, [event?.recurrenceGroupId, eventId, mutations.cancelEventMutation, t]);

  const handleOpenEventActionsMenu = useCallback(() => {
    const actions = [
      { style: 'cancel', text: t('common.cancel', 'Annuler') },
      {
        onPress: handleEditEvent,
        text: t('eventDetails.actions.edit', "Modifier l'événement"),
      },
    ];

    if (canManageFeatured && canRequestFeatured) {
      actions.push({
        // @ts-ignore: FIXME: Baseline TS regression
        onPress: () => setIsFeaturedModalVisible(true),
        text: 'Mettre à la une',
      });
    }

    actions.push({
      onPress: handleCancelEvent,
      style: 'destructive',
      text: t('eventDetails.actions.cancelEvent', "Annuler l'événement"),
    });

    Alert.alert(
      t('eventDetails.actions.menuTitle', 'Actions événement'),
      t('eventDetails.actions.menuDescription', 'Choisis une action.'),
      // @ts-ignore: FIXME: Baseline TS regression
      actions,
    );
  }, [canManageFeatured, canRequestFeatured, handleCancelEvent, handleEditEvent, t]);

  const handleOpenTournamentActionsMenu = useCallback(() => {
    const actions = [
      { style: 'cancel', text: t('common.cancel', 'Annuler') },
    ];

    if (canEdit) {
      actions.push({
        // @ts-ignore: FIXME: Baseline TS regression
        onPress: handleOpenTournamentSettings,
        text: 'Paramètres tournoi',
      });
      actions.push({
        // @ts-ignore: FIXME: Baseline TS regression
        onPress: handleOpenEventActionsMenu,
        text: 'Actions événement',
      });
    }

    Alert.alert(
      'Actions tournoi',
      'Choisis ce que tu veux gérer.',
      // @ts-ignore: FIXME: Baseline TS regression
      actions,
    );
  }, [
    canEdit,
    handleOpenEventActionsMenu,
    handleOpenTournamentSettings,
    t,
  ]);

  const openEventLicenseCampaignSettings = useCallback(() => {
    if (!eventClubId || !licenseCampaignEventId) return;
    const navigateToCampaignSettings = () => navigation.navigate(RouteNames.ClubStack, {
      params: {
        clubId: eventClubId,
        createNew: true,
        event: licenseCampaignEvent,
        eventId: licenseCampaignEventId,
      },
      screen: RouteNames.ClubLicenseCampaignSettings,
    });

    if (eventLicenseCampaigns.length > 0) {
      Alert.alert(
        'Campagne déjà liée',
        'Cet événement a déjà une campagne de cotisation. Crée-en une autre seulement si tu veux un paiement distinct.',
        [
          { style: 'cancel', text: t('common.cancel', 'Annuler') },
          {
            onPress: navigateToCampaignSettings,
            text: 'Créer quand même',
          },
        ],
      );
      return;
    }

    navigateToCampaignSettings();
  }, [
    eventClubId,
    eventLicenseCampaigns.length,
    licenseCampaignEvent,
    licenseCampaignEventId,
    navigation,
    t,
  ]);

  const openEventLicenseCampaign = useCallback((/** @type {any} */ campaign) => {
    const campaignId = campaign?.documentId || campaign?.id;
    if (!eventClubId || !campaignId) return;
    navigation.navigate(RouteNames.ClubStack, {
      params: {
        campaignId,
        clubId: eventClubId,
      },
      screen: RouteNames.ClubLicenseCampaignDetail,
    });
  }, [eventClubId, navigation]);

  const editEventLicenseCampaign = useCallback((/** @type {any} */ campaign) => {
    const campaignId = campaign?.documentId || campaign?.id;
    if (!eventClubId || !campaignId) return;
    navigation.navigate(RouteNames.ClubStack, {
      params: {
        campaignId,
        clubId: eventClubId,
        event: licenseCampaignEvent,
        eventId: licenseCampaignEventId,
      },
      screen: RouteNames.ClubLicenseCampaignSettings,
    });
  }, [eventClubId, licenseCampaignEvent, licenseCampaignEventId, navigation]);

  const isMatchEvent = useMemo(() => {
    const typeName = String(event?.type?.name || '').trim().toLowerCase();
    return typeName.includes('match');
  }, [event?.type?.name]);
  const supportsEventComposition = Boolean(event?.team?.documentId || (event?.invitedTeams || []).length > 0);
  const eventActionsToggleLabel = isEventActionsOpen
    ? 'Fermer les actions événement'
    : 'Ouvrir les actions événement';

  // @ts-ignore: FIXME: Baseline TS regression
  const getCompositionSourceLabel = useCallback((source) => {
    switch (source) {
      case 'default_composition':
        return "Favori d'équipe";
      case 'draft':
        return 'Brouillon';
      case 'last_match':
        return 'Dernier match';
      case 'published':
        return "Composition d'équipes publiée";
      default:
        return 'Nouvelle composition';
    }
  }, []);

  const compositionTeamId = useMemo(() => {
    const teams = [event?.team, ...(event?.invitedTeams || [])].filter(Boolean);
    if (!teams.length) return null;

    const userDocumentId = userData?.documentId;
    const trainedTeamIds = new Set(
      (userData?.trainedTeams || [])
        // @ts-ignore: FIXME: Baseline TS regression
        .map((team) => team?.documentId)
        .filter(Boolean),
    );

    const managedTeam = teams.find((team) => trainedTeamIds.has(team?.documentId))
      // @ts-ignore: FIXME: Baseline TS regression
      || teams.find((team) => (team?.trainers || []).some((trainer) => trainer?.documentId === userDocumentId));
    if (managedTeam?.documentId) return managedTeam.documentId;

    // @ts-ignore: FIXME: Baseline TS regression
    const playerTeam = teams.find((team) => (team?.players || []).some((player) => player?.documentId === userDocumentId));
    if (playerTeam?.documentId) return playerTeam.documentId;

    return teams[0]?.documentId || null;
  }, [event?.invitedTeams, event?.team, userData?.documentId, userData?.trainedTeams]);

  const compositionEditorTeam = useMemo(() => {
    const teams = [event?.team, ...(event?.invitedTeams || [])].filter(Boolean);
    return teams.find((team) => team?.documentId === compositionTeamId)
      || event?.team
      || null;
  }, [compositionTeamId, event?.invitedTeams, event?.team]);

  const compositionEditorPlayers = useMemo(
    () => getCompositionPlayersForEvent(event, compositionEditorTeam, isDetectionEvent),
    [compositionEditorTeam, event, isDetectionEvent],
  );

  const compositionSport = useMemo(
    () => compositionEditorTeam?.activities?.[0]?.name || event?.team?.activities?.[0]?.name || 'football',
    [compositionEditorTeam?.activities, event?.team?.activities],
  );

  const compositionEventLabel = useMemo(() => {
    if (externalMatchDisplay?.title) {
      return `Match ${externalMatchDisplay.title}`;
    }

    const preferredLabel = [eventDescriptionText, event?.name, event?.description]
      .find((value) => typeof value === 'string' && value.trim());

    if (typeof preferredLabel === 'string' && preferredLabel.trim()) {
      return preferredLabel.trim();
    }

    return event?.type?.name || 'Evenement';
  }, [event?.description, event?.name, event?.type?.name, eventDescriptionText, externalMatchDisplay?.title]);

  const {
    data: staffCompositionPayload,
    isFetching: isStaffCompositionFetching,
    refetch: refetchTeamComposition,
  } = useGetEventTeamComposition(
    eventId || '',
    compositionTeamId || undefined,
    {
      enabled: Boolean(areDeferredQueriesEnabled && eventId && supportsEventComposition && compositionTeamId && canEdit),
    },
  );

  const {
    data: matchStatsPayload,
    isFetching: isMatchStatsFetching,
    refetch: refetchMatchStats,
  } = useGetEventMatchStats(
    eventId || '',
    compositionTeamId || undefined,
    {
      enabled: Boolean(
        areDeferredQueriesEnabled
          && eventId
          && isMatchEvent
          && compositionTeamId
          && (canEdit || isTeamMember),
      ),
    },
  );

  const {
    data: myMatchResponsePayload,
    isFetching: isMyMatchResponseFetching,
    refetch: refetchMyMatchResponse,
  } = useGetEventMyMatchResponse(
    eventId || '',
    compositionTeamId || undefined,
    {
      enabled: Boolean(
        areDeferredQueriesEnabled
          && eventId
          && isMatchEvent
          && compositionTeamId
          && isTeamMember
          && isMatchFinished,
      ),
    },
  );

  const {
    data: convocationPayload,
    isFetching: isConvocationFetching,
    refetch: refetchConvocation,
  } = useGetEventConvocation(
    eventId || '',
    compositionTeamId || undefined,
    {
      enabled: Boolean(areDeferredQueriesEnabled && eventId && supportsEventComposition && compositionTeamId && canViewPublishedComposition),
    },
  );

  useEffect(() => {
    const safeEventId = String(eventId || '');
    if (
      !safeEventId
      || !areDeferredQueriesEnabled
      || secondaryCompletedEventIdRef.current === safeEventId
      || isAttendanceFetching
      || isParticipationsFetching
      || isStaffCompositionFetching
      || isMatchStatsFetching
      || isMyMatchResponseFetching
      || isConvocationFetching
    ) {
      return;
    }

    secondaryCompletedEventIdRef.current = safeEventId;
    markEventDetailsPerf('event_detail_secondary_queries_completed', {
      eventId: safeEventId,
      hasAttendance: Boolean(attendancePayload),
      hasComposition: Boolean(staffCompositionPayload),
      hasConvocation: Boolean(convocationPayload),
      hasMatchStats: Boolean(matchStatsPayload),
      hasMyMatchResponse: Boolean(myMatchResponsePayload),
      participationPages: eventParticipations?.pages?.length || 0,
    });
  }, [
    areDeferredQueriesEnabled,
    attendancePayload,
    convocationPayload,
    eventId,
    eventParticipations?.pages?.length,
    isAttendanceFetching,
    isConvocationFetching,
    isMatchStatsFetching,
    isMyMatchResponseFetching,
    isParticipationsFetching,
    isStaffCompositionFetching,
    matchStatsPayload,
    myMatchResponsePayload,
    staffCompositionPayload,
  ]);

  const matchStatsReport = matchStatsPayload?.report || null;
  const playerCollectiveRating = matchStatsPayload?.playerCollectiveRating || null;
  const myCoachReview = matchStatsPayload?.myCoachReview || null;
  const myMatchResponse = myMatchResponsePayload?.response || null;
  const isCoachFeedbackHighlighted = highlightedSection === 'coachFeedback';
  const hasMyCoachReview = myCoachReview?.rating != null || Boolean(myCoachReview?.comment);
  const hasExplicitMyMatchResponsePermission = typeof myMatchResponsePayload?.permissions?.canRespond === 'boolean';
  const canRespondMyMatchStats = hasExplicitMyMatchResponsePermission
    ? Boolean(myMatchResponsePayload?.permissions?.canRespond)
    : (!isMyMatchResponseFetching && Boolean(isTeamMember));
  const isMatchStatsFinal = matchStatsReport?.status === 'final';
  const isMatchStatsReviewRequired = Boolean(matchStatsReport?.needsReview);
  const isMatchStatsCompleted = isMatchStatsFinal && !isMatchStatsReviewRequired;
  const canViewMatchStats = Boolean(matchStatsPayload?.permissions?.canView || isTeamMember);
  const canManageMatchStats = Boolean(matchStatsPayload?.permissions?.canManage);
  const matchStatsScoreLabel = useMemo(() => {
    if (!matchStatsPayload?.score?.available) {
      return 'Score à compléter';
    }

    return `${matchStatsPayload?.score?.scoreFor ?? '-'} - ${matchStatsPayload?.score?.scoreAgainst ?? '-'}`;
  }, [
    matchStatsPayload?.score?.available,
    matchStatsPayload?.score?.scoreAgainst,
    matchStatsPayload?.score?.scoreFor,
  ]);
  const matchHeaderScoreSummary = useMemo(() => {
    if (!isMatchEvent) return null;

    const scoreState = matchStatsPayload?.score || null;
    const organizerTeamId = event?.team?.documentId || null;
    const currentTeamId = compositionTeamId || organizerTeamId || null;
    const storedMatchResult = event?.matchResult || null;
    const shouldInvertStoredScore = Boolean(
      storedMatchResult
      && organizerTeamId
      && currentTeamId
      && organizerTeamId !== currentTeamId,
    );

    let fallbackScoreFor = null;
    let fallbackScoreAgainst = null;
    if (storedMatchResult) {
      fallbackScoreFor = shouldInvertStoredScore
        ? storedMatchResult?.scoreAgainst
        : storedMatchResult?.scoreFor;
      fallbackScoreAgainst = shouldInvertStoredScore
        ? storedMatchResult?.scoreFor
        : storedMatchResult?.scoreAgainst;
    }
    const fallbackAvailable = fallbackScoreFor !== null
      && fallbackScoreFor !== undefined
      && fallbackScoreAgainst !== null
      && fallbackScoreAgainst !== undefined;
    const fallbackSource = storedMatchResult?.source || null;

    const available = Boolean(scoreState?.available || fallbackAvailable);
    const resolvedScoreFor = scoreState?.available ? scoreState?.scoreFor : fallbackScoreFor;
    const resolvedScoreAgainst = scoreState?.available ? scoreState?.scoreAgainst : fallbackScoreAgainst;
    const resolvedSource = scoreState?.available ? scoreState?.source : fallbackSource;
    const waitingOfficial = Boolean(
      scoreState?.waitingOfficial || (!scoreState?.available && event?.externalAutoSource),
    );

    if (!available && !isMatchFinished) {
      return null;
    }

    if (!available) {
      return {
        badgeLabel: waitingOfficial ? 'Score officiel' : 'Score du match',
        helperText: waitingOfficial ? 'Score en attente de synchronisation' : 'Score en attente',
        value: 'Score en attente',
      };
    }

    let badgeLabel = 'Score du match';
    if (resolvedSource === 'external_sync') {
      badgeLabel = 'Score officiel';
    } else if (resolvedSource === 'manual') {
      badgeLabel = 'Score manuel';
    }

    return {
      badgeLabel,
      helperText: waitingOfficial ? 'Synchronise automatiquement depuis la source officielle' : null,
      value: `${resolvedScoreFor} - ${resolvedScoreAgainst}`,
    };
  }, [
    compositionTeamId,
    event?.externalAutoSource,
    event?.matchResult,
    event?.team?.documentId,
    isMatchEvent,
    isMatchFinished,
    matchStatsPayload?.score,
  ]);
  const matchStatsSummaryText = useMemo(() => {
    if (isMatchStatsReviewRequired) {
      return 'Le score officiel a changé. Vérification requise avant nouvelle publication.';
    }
    if (isMatchStatsFinal) {
      return 'Rapport finalise pour cette équipe.';
    }
    if (matchStatsPayload?.score?.waitingOfficial) {
      return 'En attente du score officiel.';
    }
    return 'Temps de jeu et statistiques clés à compléter.';
  }, [isMatchStatsFinal, isMatchStatsReviewRequired, matchStatsPayload?.score?.waitingOfficial]);
  const matchStatsStatusMeta = useMemo(() => {
    if (isMatchStatsReviewRequired) {
      return {
        backgroundColor: `${Colors.warning500}20`,
        borderColor: `${Colors.warning500}45`,
        label: 'Vérification requise',
        textColor: Colors.warning500,
      };
    }
    if (isMatchStatsFinal) {
      return {
        backgroundColor: `${Colors.success500}20`,
        borderColor: `${Colors.success500}45`,
        label: 'Stats publiées',
        textColor: Colors.success500,
      };
    }
    if (matchStatsPayload?.score?.waitingOfficial) {
      return {
        backgroundColor: `${Colors.gold500}20`,
        borderColor: `${Colors.gold500}45`,
        label: 'Score officiel en attente',
        textColor: Colors.gold500,
      };
    }
    if (matchStatsPayload?.score?.available) {
      return {
        backgroundColor: `${Colors.primary500}20`,
        borderColor: `${Colors.primary500}45`,
        label: 'A finaliser',
        textColor: Colors.primary500,
      };
    }
    return {
      backgroundColor: `${Colors.neutral00}14`,
      borderColor: `${Colors.neutral00}24`,
      label: 'Score à compléter',
      textColor: Colors.neutral00,
    };
  }, [
    Colors.gold500,
    Colors.neutral00,
    Colors.primary500,
    Colors.success500,
    Colors.warning500,
    isMatchStatsFinal,
    isMatchStatsReviewRequired,
    matchStatsPayload?.score?.available,
    matchStatsPayload?.score?.waitingOfficial,
  ]);

  const convocationBranches = useMemo(() => {
    if (Array.isArray(convocationPayload?.branches)) {
      return convocationPayload.branches;
    }

    if (convocationPayload?.published) {
      return [{
        published: convocationPayload.published,
        team: convocationPayload?.team || {
          documentId: compositionTeamId,
          name: compositionEditorTeam?.name || null,
        },
        viewer: {
          inReserve: false,
          teamEntryIds: [],
        },
      }];
    }

    return [];
  }, [compositionEditorTeam?.name, compositionTeamId, convocationPayload?.branches, convocationPayload?.published, convocationPayload?.team]);
  const hasPublishedComposition = convocationBranches.length > 0;
  const publishedCompositionTeamCount = useMemo(
    () => convocationBranches.reduce((total, branch) => (
      total + (Array.isArray(branch?.published?.teams) ? branch.published.teams.length : 0)
    ), 0),
    [convocationBranches],
  );
  const publishedCompositionReserveCount = useMemo(
    () => convocationBranches.reduce((total, branch) => (
      total + (Array.isArray(branch?.published?.reservePlayerIds) ? branch.published.reservePlayerIds.length : 0)
    ), 0),
    [convocationBranches],
  );
  const compositionEligiblePlayerCount = useMemo(
    () => (Array.isArray(staffCompositionPayload?.eligiblePlayers) ? staffCompositionPayload.eligiblePlayers.length : 0),
    [staffCompositionPayload?.eligiblePlayers],
  );

  const compositionPrimaryAction = useMemo(() => {
    const compositionTitle = "Composition d'équipes";

    if (staffCompositionPayload?.draft) {
      return {
        subtitle: staffCompositionPayload?.draft?.updatedAt
          ? `Brouillon enregistre le ${new Date(staffCompositionPayload.draft.updatedAt).toLocaleString('fr-FR')}`
          : 'Brouillon enregistre',
        title: compositionTitle,
      };
    }

    if (staffCompositionPayload?.published) {
      const publishedVersion = Number(staffCompositionPayload?.published?.version || 1);
      return {
        subtitle: staffCompositionPayload?.published?.publishedAt
          ? `Publication v${publishedVersion} le ${new Date(staffCompositionPayload.published.publishedAt).toLocaleString('fr-FR')}`
          : `Publication v${publishedVersion}`,
        title: compositionTitle,
      };
    }

    const bootstrapSource = staffCompositionPayload?.bootstrap?.source;
    if (bootstrapSource && bootstrapSource !== 'empty') {
      return {
        subtitle: `Preremplissage disponible : ${getCompositionSourceLabel(bootstrapSource)}`,
        title: compositionTitle,
      };
    }

    if (compositionEligiblePlayerCount === 0) {
      return {
        subtitle: 'Tu peux déjà créer les équipes même sans participant: les postes resteront libres et se completeront ensuite.',
        title: compositionTitle,
      };
    }

    return {
      subtitle: 'Crée plusieurs équipes à la main ou génère-les automatiquement, puis publie la version finale.',
      title: compositionTitle,
    };
  }, [compositionEligiblePlayerCount, getCompositionSourceLabel, staffCompositionPayload]);

  const matchStatsPrimaryAction = useMemo(() => {
    if (!isMatchFinished) {
      return {
        disabled: true,
        subtitle: 'Les stats seront disponibles à la fin du match.',
        title: 'Stats du match',
      };
    }
    if (matchStatsPayload?.score?.waitingOfficial) {
      return {
        disabled: true,
        subtitle: 'En attente du score officiel synchronise.',
        title: 'Score officiel en attente',
      };
    }
    if (isMatchStatsReviewRequired) {
      return {
        disabled: false,
        subtitle: 'Le score officiel a changé. Vérifie puis republie cette version.',
        title: 'Mettre à jour après score officiel',
      };
    }
    if (isMatchStatsFinal) {
      return {
        disabled: false,
        subtitle: matchStatsReport?.finalizedAt
          ? `Rapport finalise le ${new Date(matchStatsReport.finalizedAt).toLocaleString('fr-FR')}`
          : 'Rapport finalise',
        title: 'Voir les stats du match',
      };
    }
    if (!canManageMatchStats) {
      return {
        disabled: true,
        subtitle: 'Les membres de ton équipe peuvent encore finaliser ce rapport.',
        title: "En attente de l'équipe",
      };
    }
    if (matchStatsPayload?.score?.available) {
      return {
        disabled: false,
        subtitle: 'Complète le temps de jeu et les stats clés de ton équipe.',
        title: 'Saisir les stats du match',
      };
    }
    return {
      disabled: false,
      subtitle: 'Commence par enregistrer le score du match.',
      title: 'Enregistrer le score',
    };
  }, [
    isMatchFinished,
    isMatchStatsFinal,
    canManageMatchStats,
    isMatchStatsReviewRequired,
    matchStatsPayload?.score?.available,
    matchStatsPayload?.score?.waitingOfficial,
    matchStatsReport?.finalizedAt,
  ]);
  const matchStatsCardButtonTitle = useMemo(() => {
    if (isMatchStatsReviewRequired) return 'Mettre à jour';
    if (isMatchStatsCompleted) return 'Voir';
    return 'Ouvrir';
  }, [isMatchStatsCompleted, isMatchStatsReviewRequired]);
  const myMatchResponseStatusMeta = useMemo(() => {
    if (myMatchResponse?.status === 'draft') {
      return {
        backgroundColor: `${Colors.primary500}20`,
        borderColor: `${Colors.primary500}45`,
        label: 'Brouillon',
        textColor: Colors.primary500,
      };
    }
    if (myMatchResponse?.status === 'submitted') {
      if (myMatchResponse?.participation === 'not_involved') {
        return {
          backgroundColor: `${Colors.neutral00}14`,
          borderColor: `${Colors.neutral00}24`,
          label: 'Non concerne',
          textColor: Colors.neutral00,
        };
      }
      if (myMatchResponse?.quantitativeState === 'unknown') {
        return {
          backgroundColor: `${Colors.gold500}20`,
          borderColor: `${Colors.gold500}45`,
          label: 'Je ne sais pas',
          textColor: Colors.gold500,
        };
      }
      return {
        backgroundColor: `${Colors.success500}20`,
        borderColor: `${Colors.success500}45`,
        label: 'Envoye',
        textColor: Colors.success500,
      };
    }
    return {
      backgroundColor: `${Colors.primary500}20`,
      borderColor: `${Colors.primary500}45`,
      label: 'A faire',
      textColor: Colors.primary500,
    };
  }, [Colors.gold500, Colors.neutral00, Colors.primary500, Colors.success500, myMatchResponse]);
  const myMatchResponseSummary = useMemo(() => {
    if (myMatchResponse?.status === 'submitted') {
      if (myMatchResponse?.participation === 'not_involved') {
        return 'Tu as indique ne pas être concerne par ce match.';
      }
      if (myMatchResponse?.participation === 'present_no_play') {
        return 'Tu as indique que tu etais la sans jouer.';
      }
      if (myMatchResponse?.quantitativeState === 'unknown') {
        return 'Ton ressenti est enregistré, sans stats quantitatives.';
      }
      return 'Tes stats personnelles et ta note sont enregistrées.';
    }
    if (myMatchResponse?.status === 'draft') {
      return 'Ton brouillon perso post-match attend encore une validation.';
    }
    return 'Renseigne ton retour individuel, puis ajoute une note sur 10.';
  }, [myMatchResponse]);
  const myMatchResponseButtonTitle = useMemo(() => {
    if (myMatchResponse?.status === 'draft') return 'Reprendre';
    if (myMatchResponse?.status === 'submitted') return 'Voir';
    return 'Renseigner';
  }, [myMatchResponse]);
  const matchStatsPromptMessage = useMemo(() => {
    if (matchStatsPayload?.score?.available) {
      if (isMatchStatsReviewRequired) {
        return 'Le score officiel a changé. Vérifie les lignes puis republie ce rapport.';
      }

      return 'Le score est prêt. Tu peux maintenant compléter le temps de jeu et les stats clés de ton équipe.';
    }

    return 'Le match est terminé. Enregistre d abord le score puis complète les statistiques de ton équipe.';
  }, [isMatchStatsReviewRequired, matchStatsPayload?.score?.available]);
  const matchStatsPromptSessionKey = useMemo(() => {
    if (!eventId || !compositionTeamId) return '';

    return [
      'event',
      eventId,
      compositionTeamId,
      String(matchStatsReport?.documentId || matchStatsReport?.id || 'report'),
      `version:${Number(matchStatsReport?.version || 0)}`,
      `review:${isMatchStatsReviewRequired ? 'yes' : 'no'}`,
      `score:${matchStatsPayload?.score?.available ? 'ready' : 'pending'}`,
    ].join(':');
  }, [
    compositionTeamId,
    eventId,
    isMatchStatsReviewRequired,
    matchStatsPayload?.score?.available,
    matchStatsReport?.documentId,
    matchStatsReport?.id,
    matchStatsReport?.version,
  ]);
  const dismissMatchStatsPrompt = useCallback(() => {
    if (matchStatsPromptSessionKey) {
      dismissMatchStatsPromptForSession(matchStatsPromptSessionKey);
      setDismissedMatchStatsPromptKey(matchStatsPromptSessionKey);
    }
    setIsMatchStatsPromptVisible(false);
  }, [matchStatsPromptSessionKey]);

  // @ts-ignore: FIXME: Baseline TS regression
  const openCompositionBoard = useCallback((composition, options = {}) => {
    if (!eventId || !compositionTeamId) return;

    // @ts-ignore: FIXME: Baseline TS regression
    let playersForBoard = compositionEditorPlayers;
    // @ts-ignore: FIXME: Baseline TS regression
    if (Array.isArray(options.players) && options.players.length > 0) {
      // @ts-ignore: FIXME: Baseline TS regression
      playersForBoard = options.players;
    // @ts-ignore: FIXME: Baseline TS regression
    } else if (Array.isArray(options?.teamComposition?.eligiblePlayers) && options.teamComposition.eligiblePlayers.length > 0) {
      // @ts-ignore: FIXME: Baseline TS regression
      playersForBoard = options.teamComposition.eligiblePlayers;
    }

    navigation.navigate(RouteNames.TacticalBoardV2, {
      // @ts-ignore: FIXME: Baseline TS regression
      canEdit: Boolean(options.canEdit),
      // @ts-ignore: FIXME: Baseline TS regression
      compositionIntent: options.compositionIntent || null,
      // @ts-ignore: FIXME: Baseline TS regression
      editorMode: options.editorMode || 'event',
      // @ts-ignore: FIXME: Baseline TS regression
      editorSource: options.editorSource || null,
      // @ts-ignore: FIXME: Baseline TS regression
      editorSourceLabel: options.editorSourceLabel || null,
      eventId,
      eventKind: isDetectionEvent ? 'detection' : 'match',
      eventName: compositionEventLabel,
      eventTypeLabel: event?.type?.name || null,
      // @ts-ignore: FIXME: Baseline TS regression
      aggregateBranches: Array.isArray(options.aggregateBranches) ? options.aggregateBranches : undefined,
      existingComposition: composition,
      // @ts-ignore: FIXME: Baseline TS regression
      multiTeamComposition: Boolean(
        Array.isArray(options.aggregateBranches)
          || Array.isArray(composition?.teams)
          || Number(composition?.schemaVersion) === 3
          || Array.isArray(options?.teamComposition?.draft?.teams)
          || Array.isArray(options?.teamComposition?.published?.teams),
      ),
      players: playersForBoard,
      // @ts-ignore: FIXME: Baseline TS regression
      readOnly: Boolean(options.readOnly),
      sport: composition?.sportContext || compositionSport,
      // @ts-ignore: FIXME: Baseline TS regression
      teamComposition: options.teamComposition || staffCompositionPayload || null,
      teamId: compositionTeamId,
      teamName: compositionEditorTeam?.name || staffCompositionPayload?.team?.name || null,
    });
  }, [
    compositionEditorPlayers,
    compositionEditorTeam?.name,
    compositionSport,
    compositionTeamId,
    compositionEventLabel,
    event?.type?.name,
    eventId,
    isDetectionEvent,
    navigation,
    staffCompositionPayload,
  ]);

  const handleManageComposition = useCallback(() => {
    if (!eventId || !compositionTeamId) return;

    if (isStaffCompositionFetching) {
      Alert.alert('Patiente', "On récupère l'état actuel de la composition.");
      return;
    }

    if (staffCompositionPayload?.draft) {
      openCompositionBoard(staffCompositionPayload.draft, {
        canEdit: true,
        compositionIntent: staffCompositionPayload?.draft?.mode || 'manual',
        editorSource: 'draft',
        editorSourceLabel: getCompositionSourceLabel('draft'),
        readOnly: false,
      });
      return;
    }

    if (staffCompositionPayload?.published) {
      openCompositionBoard(staffCompositionPayload.published, {
        canEdit: true,
        compositionIntent: staffCompositionPayload?.published?.mode || 'manual',
        editorSource: 'published',
        editorSourceLabel: getCompositionSourceLabel('published'),
        players: Array.isArray(staffCompositionPayload?.published?.snapshotPlayers)
          ? staffCompositionPayload.published.snapshotPlayers
          : compositionEditorPlayers,
        readOnly: false,
      });
      return;
    }

    const openNewComposition = (intent = 'manual') => {
      openCompositionBoard(staffCompositionPayload?.bootstrap?.composition || null, {
        canEdit: true,
        compositionIntent: intent,
        editorSource: staffCompositionPayload?.bootstrap?.source || 'empty',
        editorSourceLabel: getCompositionSourceLabel(staffCompositionPayload?.bootstrap?.source || 'empty'),
        readOnly: false,
      });
    };

    const hasAutoPresets = Array.isArray(staffCompositionPayload?.availablePresets)
      && staffCompositionPayload.availablePresets.length > 0;

    if (!hasAutoPresets) {
      openNewComposition('manual');
      return;
    }

    Alert.alert(
      "Composition d'équipes",
      'Choisis si tu veux créer les équipes automatiquement ou les faire à la main.',
      [
        { style: 'cancel', text: 'Annuler' },
        { onPress: () => openNewComposition('auto'), text: 'Création auto' },
        { onPress: () => openNewComposition('manual'), text: 'Faire à la main' },
      ],
    );
  }, [
    compositionEditorPlayers,
    compositionTeamId,
    eventId,
    getCompositionSourceLabel,
    isStaffCompositionFetching,
    openCompositionBoard,
    staffCompositionPayload,
  ]);

  const openMatchStatsEditor = useCallback(() => {
    if (!eventId || !compositionTeamId) return;

    navigation.navigate(RouteNames.MatchStatsEditor, {
      eventId,
      sourceType: 'event',
      sport: matchStatsPayload?.sport || compositionSport,
      teamId: compositionTeamId,
      teamName: compositionEditorTeam?.name || matchStatsPayload?.team?.name || null,
      title: 'Bilan équipe',
    });
  }, [
    compositionEditorTeam?.name,
    compositionSport,
    compositionTeamId,
    eventId,
    matchStatsPayload?.sport,
    matchStatsPayload?.team?.name,
    navigation,
  ]);

  const openMyMatchResponse = useCallback(() => {
    if (!eventId || !compositionTeamId) return;

    navigation.navigate(RouteNames.PlayerMatchResponse, {
      eventId,
      matchLabel: compositionEventLabel,
      sourceType: 'event',
      sport: myMatchResponsePayload?.sport || matchStatsPayload?.sport || compositionSport,
      teamId: compositionTeamId,
      teamName: compositionEditorTeam?.name || myMatchResponsePayload?.team?.name || matchStatsPayload?.team?.name || null,
      title: 'Mon retour post-match',
    });
  }, [
    compositionEditorTeam?.name,
    compositionEventLabel,
    compositionSport,
    compositionTeamId,
    eventId,
    matchStatsPayload?.sport,
    matchStatsPayload?.team?.name,
    myMatchResponsePayload?.sport,
    myMatchResponsePayload?.team?.name,
    navigation,
  ]);

  useFocusEffect(useCallback(() => () => {
    setIsMatchStatsPromptVisible(false);
  }, []));

  useEffect(() => {
    if (!canManageMatchStats || !isMatchEvent || !compositionTeamId || !isMatchFinished) {
      setIsMatchStatsPromptVisible(false);
      return;
    }

    if (matchStatsPayload?.score?.waitingOfficial) {
      setIsMatchStatsPromptVisible(false);
      return;
    }

    if (isMatchStatsCompleted) {
      setIsMatchStatsPromptVisible(false);
      return;
    }

    if (
      matchStatsPayload
      && !isMatchStatsFetching
      && dismissedMatchStatsPromptKey !== matchStatsPromptSessionKey
      && !isMatchStatsPromptDismissedForSession(matchStatsPromptSessionKey)
    ) {
      setIsMatchStatsPromptVisible(true);
    }
  }, [canManageMatchStats, compositionTeamId,
    dismissedMatchStatsPromptKey,
    isMatchEvent,
    isMatchFinished,
    isMatchStatsFetching,
    isMatchStatsCompleted,
    matchStatsPayload,
    matchStatsPayload?.score?.waitingOfficial,
    matchStatsPromptSessionKey,
  ]);

  const openCoachLateModal = useCallback((/** @type {User | null | undefined} */ targetUser, /** @type {'coach_mark' | 'coach_edit'} */ mode) => {
    if (!targetUser?.documentId) return;

    const nowIso = new Date(serverNowMs).toISOString();
    const existing = attendanceByUserId[targetUser.documentId];
    const defaultArrival = existing?.arrivedAt || nowIso;
    const defaultMinutes = mode === 'coach_edit'
      ? Number(existing?.lateMinutes || 0)
      : computeLateMinutes(nowIso);

    setLateModalMode(mode);
    setLateModalUser(targetUser);
    setLateModalArrivedAt(defaultArrival);
    setLateModalMinutes(String(Math.max(0, defaultMinutes)));
    setLateModalNote(String(existing?.note || ''));
    setIsLateModalVisible(true);
  }, [attendanceByUserId, computeLateMinutes, serverNowMs]);

  const openSelfLateModal = useCallback(() => {
    const currentUser = userData
      ? {
        avatar: userData.avatar,
        documentId: userData.documentId,
        firstname: userData.firstname,
        lastname: userData.lastname,
      }
      : null;
    if (!currentUser?.documentId) return;

    const existing = attendanceByUserId[currentUser.documentId];
    setLateModalMode(existing?.declaredLateMinutes ? 'player_update' : 'player_declare');
    setLateModalUser(currentUser);
    setLateModalArrivedAt(null);
    setLateModalMinutes(String(Math.max(0, Number(existing?.declaredLateMinutes || 10))));
    setLateModalNote('');
    setIsLateModalVisible(true);
  }, [attendanceByUserId, userData]);

  const closeLateModal = useCallback(() => {
    setIsLateModalVisible(false);
    setLateModalMode('coach_mark');
    setLateModalUser(null);
    setLateModalMinutes('0');
    setLateModalArrivedAt(null);
    setLateModalNote('');
  }, []);

  const handleCoachMarkArrival = useCallback((/** @type {User | null | undefined} */ targetUser) => {
    openCoachLateModal(targetUser, 'coach_mark');
  }, [openCoachLateModal]);

  const handleCoachEditLate = useCallback((/** @type {User | null | undefined} */ targetUser) => {
    openCoachLateModal(targetUser, 'coach_edit');
  }, [openCoachLateModal]);

  // @ts-ignore: FIXME: Baseline TS regression
  const handleSetLatePreset = useCallback((value) => {
    setLateModalMinutes(String(value));
  }, []);

  const handleSaveLateModal = useCallback(() => {
    if (!eventId || !lateModalUser?.documentId) return;

    const parsedMinutes = Number(lateModalMinutes);
    if (!Number.isFinite(parsedMinutes) || parsedMinutes < 0) {
      Alert.alert(t('common.error'), t('eventDetails.late.minutesInvalid', 'Le retard doit être un nombre positif.'));
      return;
    }

    if (lateModalMode === 'player_declare' || lateModalMode === 'player_update') {
      /** @type {any} */ (mutations.selfLateMutation).mutate(
        {
          eventId,
          payload: {
            lateMinutes: Math.floor(parsedMinutes),
          },
        },
        { onSuccess: () => closeLateModal() },
      );
      return;
    }

    const payload = {
      arrivedAt: lateModalArrivedAt || new Date().toISOString(),
      lateMinutes: Math.floor(parsedMinutes),
      note: lateModalNote.trim() || null,
    };

    if (lateModalMode === 'coach_mark') {
      /** @type {any} */ (mutations.coachArrivalMutation).mutate(
        { eventId, payload, userId: lateModalUser.documentId },
        { onSuccess: () => closeLateModal() },
      );
      return;
    }

    /** @type {any} */ (mutations.updateLateMinutesMutation).mutate(
      { eventId, payload, userId: lateModalUser.documentId },
      { onSuccess: () => closeLateModal() },
    );
  }, [
    closeLateModal,
    eventId,
    lateModalArrivedAt,
    lateModalMinutes,
    lateModalMode,
    lateModalNote,
    lateModalUser?.documentId,
    mutations.coachArrivalMutation,
    mutations.selfLateMutation,
    mutations.updateLateMinutesMutation,
    t,
  ]);

  const handleResetLateModal = useCallback(() => {
    if (!eventId || !lateModalUser?.documentId) return;
    /** @type {any} */ (mutations.resetAttendanceMutation).mutate(
      { eventId, userId: lateModalUser.documentId },
      { onSuccess: () => closeLateModal() },
    );
  }, [closeLateModal, eventId, lateModalUser?.documentId, mutations.resetAttendanceMutation]);

  const handleSelfArrival = useCallback(() => {
    if (!eventId) {
      Alert.alert(t('common.error'), "Impossible d'enregistrer ton arrivée (événement introuvable).");
      return;
    }
    if (hasSelfArrived) {
      Alert.alert(t('common.success'), 'Arrivée déjà enregistrée.');
      return;
    }
    setSelfArrivalMarkedLocal(true);
    /** @type {any} */ (mutations.selfArrivalMutation).mutate(
      {
        eventId,
        payload: {},
      },
      {
        onError: () => {
          setSelfArrivalMarkedLocal(false);
        },
        onSuccess: (/** @type {any} */ response) => {
          const lateMinutesFromResponse = Math.max(0, Number(response?.data?.lateMinutes || 0));
          const arrivedAtRaw = response?.data?.arrivedAt || null;
          const eventStartMs = eventStartAt?.getTime() || null;
          const arrivedAtMs = arrivedAtRaw ? new Date(arrivedAtRaw).getTime() : Number.NaN;
          const hasValidTimestamps = Boolean(
            eventStartMs
            && !Number.isNaN(eventStartMs)
            && !Number.isNaN(arrivedAtMs),
          );

          let message = t('eventDetails.late.selfOnTime', 'Arrivée enregistrée a l\'heure.');

          if (hasValidTimestamps && eventStartMs && arrivedAtMs < eventStartMs) {
            const earlyMinutes = Math.max(1, Math.floor((eventStartMs - arrivedAtMs) / 60000));
            message = t('eventDetails.late.selfEarly', `Bravo ! Tu es en avance de ${earlyMinutes} min.`);
          } else {
            const lateMinutesFromDiff = hasValidTimestamps && eventStartMs && arrivedAtMs > eventStartMs
              ? Math.max(0, Math.floor((arrivedAtMs - eventStartMs) / 60000))
              : 0;
            const lateMinutes = Math.max(lateMinutesFromResponse, lateMinutesFromDiff);
            if (lateMinutes > 0) {
              message = t('eventDetails.late.selfLate', `Arrivée enregistrée : ${lateMinutes} min de retard.`);
            }
          }

          Alert.alert(t('common.success'), message);
        },
      },
    );
  }, [eventId, eventStartAt, hasSelfArrived, mutations.selfArrivalMutation, t]);

  const renderTournamentActionsPanel = () => {
    if (!isTournamentEvent || isStageDayEvent) return null;
    const primaryActionTitle = canEdit ? 'Gérer le tournoi' : 'Voir le tournoi';
    const currentUserPendingTournamentMemberStatus = normalizeTournamentText(
      currentUserPendingTournamentTeam?.members?.find(
        // @ts-ignore: FIXME: Baseline TS regression
        (member) => member?.user?.documentId === userData?.documentId,
      )?.responseStatus,
    );
    const canShowTournamentActions = canEdit || (canManageFeatured && canRequestFeatured);

    return (
      <View
        style={[
          ApplicationStyle.backgroundColor.primary700,
          ApplicationStyle.borderRadius24,
          Spaces.paddingHorizontal[16],
          {
            borderColor: `${Colors.primary500}44`,
            borderWidth: 1,
            overflow: 'hidden',
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setIsTournamentActionsOpen((previousValue) => !previousValue)}
          style={[
            // @ts-ignore: FIXME: Baseline TS regression
            Spaces.paddingTop[8],
            Spaces.paddingBottom[12],
            // @ts-ignore: FIXME: Baseline TS regression
            Spaces.gap[8],
          ]}
        >
          <View style={[Alignments.alignCenter]}>
            <View
              style={{
                backgroundColor: `${Colors.neutral00}55`,
                borderRadius: 999,
                height: 4,
                width: 48,
              }}
            />
          </View>
          <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Actions événement</Text>
              <Text style={[Fonts.p4, Fonts.neutral300, { marginTop: 2 }]}>
                Gère le tournoi, les équipes inscrites et les options de l’événement.
              </Text>
            </View>
            <Text style={[Fonts.p3Bold, Fonts.primary500]}>
              {isTournamentActionsOpen ? 'Fermer' : 'Ouvrir'}
            </Text>
          </View>
        </TouchableOpacity>

        {isTournamentActionsOpen ? (
          <View style={[Spaces.gap[12], Spaces.paddingBottom[16]]}>
            <Button
              onPress={handleOpenTournamentManagement}
              title={primaryActionTitle}
              variant={canEdit ? 'Primary' : 'Secondary'}
            />

            {managedTournamentTeam?.documentId ? (
              <Button
                onPress={() => handleOpenTournamentTeam(managedTournamentTeam.documentId)}
                title="Gérer mon équipe inscrite"
                variant="Primary"
              />
            ) : null}

            {!managedTournamentTeam?.documentId && currentUserTournamentTeam?.documentId ? (
              <Button
                onPress={() => handleOpenTournamentTeam(currentUserTournamentTeam.documentId)}
                title="Voir mon équipe inscrite"
                variant="Primary"
              />
            ) : null}

            {!managedTournamentTeam?.documentId && !currentUserTournamentTeam?.documentId && currentUserPendingTournamentTeam?.documentId ? (
              <Button
                onPress={() => handleOpenTournamentTeam(currentUserPendingTournamentTeam.documentId)}
                title={currentUserPendingTournamentMemberStatus === 'invited' ? 'Répondre à mon invitation' : 'Suivre ma demande'}
                variant="Primary"
              />
            ) : null}

            {canRegisterTournamentSourceTeam ? (
              <Button
                onPress={() => setIsTournamentRegisterModalVisible(true)}
                title="Inscrire une équipe du club"
                variant="Secondary"
              />
            ) : null}

            {canCreateCustomTournamentTeam ? (
              <Button
                onPress={() => setIsTournamentCreateModalVisible(true)}
                title="Créer une équipe pour ce tournoi"
                variant="Secondary"
              />
            ) : null}

            {canShowTournamentActions ? (
              <Button
                onPress={handleOpenTournamentActionsMenu}
                title="Actions tournoi"
                variant="Secondary"
              />
            ) : null}
          </View>
        ) : null}
      </View>
    );
  };

  const renderEventLicenseCampaignActions = () => {
    if (!canManageEventLicenseCampaigns) return null;
    if (!eventCampaignCreationSuggested && eventLicenseCampaigns.length === 0) return null;

    const hasLinkedCampaigns = eventLicenseCampaigns.length > 0;
    const createCampaignTitle = eventCampaignCreationSuggested
      ? 'Préparer la campagne de cotisation'
      : 'Créer une campagne de cotisation';

    if (eventLicenseCampaignsQuery.isLoading) {
      return (
        <View style={[Spaces.gap[8], Spaces.paddingTop[4]]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Cotisations</Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            Chargement des campagnes...
          </Text>
        </View>
      );
    }

    if (!hasLinkedCampaigns) {
      return (
        <Button
          onPress={openEventLicenseCampaignSettings}
          title={createCampaignTitle}
          variant={eventCampaignCreationSuggested ? 'Primary' : 'Secondary'}
        />
      );
    }

    return (
      <View style={[Spaces.gap[12], Spaces.paddingTop[4]]}>
        <View style={[Spaces.gap[4]]}>
          <Text style={[Fonts.p2Bold, Fonts.neutral00]}>Cotisations liées</Text>
          <Text style={[Fonts.p3, Fonts.neutral300]}>
            Campagnes de paiement rattachées à cet événement.
          </Text>
        </View>

        {eventLicenseCampaigns.map((/** @type {any} */ campaign) => {
          const campaignId = campaign?.documentId || campaign?.id;
          const assignmentTotal = Number(campaign?.totals?.total || 0);
          return (
            <View
              key={campaignId}
              style={[
                ApplicationStyle.borderRadius16,
                ApplicationStyle.borderWidth1,
                Spaces.padding[12],
                Spaces.gap[8],
                {
                  backgroundColor: Colors.primary700,
                  borderColor: `${Colors.primary500}55`,
                },
              ]}
            >
              <View
                style={[
                  Alignments.row,
                  Alignments.justifySpaceBetween,
                  Alignments.alignCenter,
                  Spaces.gap[12],
                ]}
              >
                <View style={[Spaces.gap[4], { flex: 1 }]}>
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                    {campaign?.name || 'Campagne événement'}
                  </Text>
                  <Text style={[Fonts.p3, Fonts.neutral300]}>
                    {formatCampaignAmount(
                      campaign?.defaultAmountCents,
                      campaign?.currency || 'EUR',
                    )}
                    {' '}
                    par participant
                    {' - '}
                    {assignmentTotal}
                    {' '}
                    affectation(s)
                  </Text>
                </View>
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                  {String(campaign?.status || 'draft').toUpperCase()}
                </Text>
              </View>
              <View style={[Alignments.row, Spaces.gap[8]]}>
                <Button
                  onPress={() => openEventLicenseCampaign(campaign)}
                  style={{ flex: 1 }}
                  title="Ouvrir"
                  variant="Secondary"
                />
                <Button
                  onPress={() => editEventLicenseCampaign(campaign)}
                  style={{ flex: 1 }}
                  title="Modifier"
                  variant="Secondary"
                />
              </View>
            </View>
          );
        })}
        <Button
          onPress={openEventLicenseCampaignSettings}
          title="Créer une autre campagne"
          variant="Secondary"
        />
      </View>
    );
  };

  const renderTournamentSection = () => {
    if (!isTournamentEvent || isStageDayEvent) return null;
    let tournamentFormatLabel = 'Poules uniquement';
    if (event?.tournamentConfig?.formatMode === 'groups_to_knockout') {
      tournamentFormatLabel = 'Poules + finale';
    } else if (event?.tournamentConfig?.formatMode === 'knockout_only') {
      tournamentFormatLabel = 'Phase finale directe';
    } else if (event?.tournamentConfig?.formatMode === 'round_robin') {
      tournamentFormatLabel = 'Championnat';
    }
    const isCompetitionPublished = event?.tournamentConfig?.competitionState === 'published';
    const competitionStateLabel = isCompetitionPublished
      ? 'Compétition publiée'
      : 'Compétition en brouillon';
    let primaryActionHelper = 'Consulte le déroulé, les équipes et les résultats du tournoi.';
    if (canEdit && isCompetitionPublished) {
      primaryActionHelper = 'Calendrier, résultats et classement sont prêts à être pilotés.';
    } else if (canEdit) {
      primaryActionHelper = 'Finalise les équipes et les paramètres avant de lancer le tournoi.';
    }
    const teamsSummary = `${tournamentTeamCounters.accepted} validée(s) · ${tournamentTeamCounters.pending} en attente`;
    const tournamentScopeLabel = event?.tournamentScopeMode === 'autonomous'
      ? 'Tournoi autonome'
      : 'Équipe source';
    const tournamentContextTags = [
      tournamentScopeLabel,
      event?.tournamentActivity?.name,
      event?.tournamentSection?.name,
      event?.tournamentCategory?.name,
    ].filter(Boolean);
    let playerTournamentStatusLabel = 'Réponse attendue';
    let playerTournamentStatusTone = Colors.warning500;
    if (currentUserTournamentStatus === 'present') {
      playerTournamentStatusLabel = 'Présent';
      playerTournamentStatusTone = Colors.success500;
    } else if (currentUserTournamentStatus === 'absent') {
      playerTournamentStatusLabel = 'Absent';
      playerTournamentStatusTone = Colors.error500;
    }
    return (
      <View style={Spaces.gap[16]}>
        <View style={tournamentDs.styles.panelCard}>
          <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.p4Bold, Fonts.primary500]}>TOURNOI</Text>
              <Text style={[Fonts.h3Bold, Fonts.neutral00, Spaces.marginTop[4]]}>
                {competitionStateLabel}
              </Text>
              <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginTop[8], { lineHeight: 20 }]}>
                {primaryActionHelper}
              </Text>
            </View>
            <Tag
              style={tournamentDs.getToneTagStyle(isCompetitionPublished ? Colors.success500 : Colors.warning500)}
              text={isCompetitionPublished ? 'Publié' : 'Brouillon'}
              // @ts-ignore: FIXME: Baseline TS regression
              textColor={isCompetitionPublished ? 'neutral00' : 'warning500'}
              textStyle={isCompetitionPublished ? { color: Colors.success500 } : undefined}
            />
          </View>

          <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
            {tournamentContextTags.map((label) => (
              <Tag
                key={label}
                style={tournamentDs.getToneTagStyle(Colors.primary500)}
                text={label}
                textColor="primary500"
              />
            ))}
            <Tag style={tournamentDs.getToneTagStyle(Colors.primary500)} text={tournamentFormatLabel} textColor="primary500" />
            <Tag
              style={tournamentDs.getToneTagStyle(Colors.warning500)}
              text={teamsSummary}
              textColor={/** @type {any} */ ('warning500')}
            />
            {event?.tournamentConfig?.knockoutSize ? (
              <Tag
                style={tournamentDs.getToneTagStyle(Colors.primary500)}
                text={`Bracket ${event.tournamentConfig.knockoutSize}`}
                textColor="primary500"
              />
            ) : null}
          </View>

          <View style={[Alignments.row, Spaces.gap[12], { flexWrap: 'wrap' }]}>
            <View style={[tournamentDs.styles.insetPanelCard, { flexGrow: 1, minWidth: 132 }]}>
              <Text style={[Fonts.p4, Fonts.neutral300]}>Équipes</Text>
              <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{tournamentTeams.length}</Text>
            </View>
            <View style={[tournamentDs.styles.insetPanelCard, { flexGrow: 1, minWidth: 132 }]}>
              <Text style={[Fonts.p4, Fonts.neutral300]}>Validation</Text>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {event?.tournamentConfig?.registrationMode === 'auto' ? 'Auto' : 'Manuelle'}
              </Text>
            </View>
            <View style={[tournamentDs.styles.insetPanelCard, { flexGrow: 1, minWidth: 132 }]}>
              <Text style={[Fonts.p4, Fonts.neutral300]}>Points</Text>
              <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                {`V${event?.tournamentConfig?.pointsWin ?? 3} N${event?.tournamentConfig?.pointsDraw ?? 1} D${event?.tournamentConfig?.pointsLoss ?? 0}`}
              </Text>
            </View>
          </View>

          {event?.tournamentConfig?.rulesText ? (
            <Text style={[Fonts.p3, Fonts.neutral200, { lineHeight: 20 }]}>
              {event.tournamentConfig.rulesText}
            </Text>
          ) : null}
        </View>

        {currentUserTournamentMember ? (
          <View style={tournamentDs.styles.panelCard}>
            <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
              <View style={{ flex: 1 }}>
                <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Ma réponse au tournoi</Text>
                <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginTop[4], { lineHeight: 20 }]}>
                  Ta réponse concerne ton équipe tournoi, pas le RSVP classique de l’événement.
                </Text>
              </View>
              <Tag
                style={tournamentDs.getToneTagStyle(playerTournamentStatusTone)}
                text={playerTournamentStatusLabel}
                textColor="neutral00"
                textStyle={{ color: playerTournamentStatusTone }}
              />
            </View>

            <View style={[Alignments.row, Spaces.gap[12]]}>
              <View style={{ flex: 1 }}>
                <Button
                  disabled={respondTournamentPresenceMutation.isPending || currentUserTournamentStatus === 'present'}
                  isLoading={respondTournamentPresenceMutation.isPending}
                  onPress={() => handleRespondTournamentPresence('present')}
                  title={currentUserTournamentStatus === 'present' ? 'Présent confirmé' : 'Je suis présent'}
                  variant={currentUserTournamentStatus === 'present' ? 'Primary' : 'Secondary'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  disabled={respondTournamentPresenceMutation.isPending || currentUserTournamentStatus === 'absent'}
                  isLoading={respondTournamentPresenceMutation.isPending}
                  onPress={() => handleRespondTournamentPresence('absent')}
                  title={currentUserTournamentStatus === 'absent' ? 'Absence confirmée' : 'Je suis absent'}
                  variant={currentUserTournamentStatus === 'absent' ? 'Primary' : 'Secondary'}
                />
              </View>
            </View>
          </View>
        ) : null}

        <View style={tournamentDs.styles.panelCard}>
          <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
            <View style={{ flex: 1 }}>
              <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Équipes tournoi</Text>
              <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginTop[4]]}>{teamsSummary}</Text>
            </View>
            {tournamentTeamCounters.warning > 0 ? (
              <Tag
                style={tournamentDs.getToneTagStyle(Colors.gold500)}
                text={`${tournamentTeamCounters.warning} à vérifier`}
                // @ts-ignore: FIXME: Baseline TS regression
                textColor="gold500"
              />
            ) : null}
          </View>

        </View>

        {tournamentTeams.length === 0 ? (
          <View style={tournamentDs.styles.panelCard}>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              Aucune équipe n est encore inscrite sur ce tournoi.
            </Text>
          </View>
        ) : null}

        {tournamentTeams.map((tournamentTeam) => {
          const rosterSummary = getTournamentRosterSummary(tournamentTeam, tournamentConfig);
          const hasRosterWarning = isTournamentTeamNonCompliant(tournamentTeam, tournamentConfig);
          let tournamentTeamStatusLabel = 'Équipe inscrite';
          if (tournamentTeam?.status === 'pending') {
            tournamentTeamStatusLabel = 'Validation en attente';
          } else if (tournamentTeam?.status === 'declined') {
            tournamentTeamStatusLabel = 'Équipe refusée';
          } else if (tournamentTeam?.status === 'archived') {
            tournamentTeamStatusLabel = 'Équipe archivée';
          }

          return (
            <TouchableOpacity
              key={tournamentTeam?.documentId || tournamentTeam?.name}
              onPress={() => handleOpenTournamentTeam(tournamentTeam?.documentId)}
              style={tournamentDs.styles.panelCard}
            >
              <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
                <View style={{ flex: 1 }}>
                  <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                    {tournamentTeam?.name || 'Équipe tournoi'}
                  </Text>
                  <Text style={[Fonts.p4, Fonts.primary100]}>
                    {tournamentTeam?.sourceType === 'club_team'
                      ? `Depuis ${tournamentTeam?.sourceTeam?.name || 'une équipe club'}`
                      : 'Équipe éphémère'}
                  </Text>
                </View>
                <Tag
                  style={tournamentDs.getToneTagStyle(Colors.primary500)}
                  text={String(rosterSummary.totalCount || 0)}
                  textColor="primary500"
                />
              </View>

              <Text style={[Fonts.p4, Fonts.neutral200]}>
                {tournamentTeamStatusLabel}
              </Text>
              <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
                {rosterSummary.invitedCount > 0 ? (
                  <Tag
                    style={tournamentDs.getToneTagStyle(Colors.primary500)}
                    text={`${rosterSummary.invitedCount} invitation${rosterSummary.invitedCount > 1 ? 's' : ''}`}
                    textColor="primary500"
                  />
                ) : null}
                {rosterSummary.requestedCount > 0 ? (
                  <Tag
                    style={tournamentDs.getToneTagStyle(Colors.warning500)}
                    text={`${rosterSummary.requestedCount} demande${rosterSummary.requestedCount > 1 ? 's' : ''}`}
                    // @ts-ignore: FIXME: Baseline TS regression
                    textColor="warning500"
                  />
                ) : null}
                {hasRosterWarning ? (
                  // @ts-ignore: FIXME: Baseline TS regression
                  <Tag style={tournamentDs.getToneTagStyle(Colors.gold500)} text="Warning roster" textColor="gold500" />
                ) : null}
              </View>

              {canEdit && tournamentTeam?.status === 'pending' ? (
                <View style={[Alignments.row, Spaces.gap[12], Spaces.marginTop[4]]}>
                  <Button
                    isLoading={reviewTournamentTeamMutation.isPending}
                    onPress={() => handleReviewTournamentTeam(tournamentTeam?.documentId, 'accepted')}
                    size="sm"
                    title="Valider"
                    variant="Primary"
                  />
                  <Button
                    isLoading={reviewTournamentTeamMutation.isPending}
                    onPress={() => handleReviewTournamentTeam(tournamentTeam?.documentId, 'declined')}
                    size="sm"
                    style={{ borderColor: `${Colors.error500}55` }}
                    textStyle={{ color: Colors.error500 }}
                    title="Refuser"
                    variant="SecondaryLight"
                  />
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderActionButtons = () => {
    const isReservation = event?.type?.name?.toLowerCase()?.includes('reservation')
      || event?.type?.name?.toLowerCase()?.includes('reservation');

    if (isReservation) {
      const userDocumentId = userData?.documentId;
      const hasAlreadyJoined = event?.participations?.some((/** @type {any} */ participation) => participation?.documentId === userDocumentId);
      return (
        <View>
          <EventReservationActions
            event={event}
            hasAlreadyJoined={hasAlreadyJoined}
            mutations={mutations}
            userData={userData}
          />
          {hasAlreadyJoined && <Button disabled title="Je participe !" variant="Primary" />}
          {!hasAlreadyJoined && <Button onPress={handleJoinEvent} title="Reserver" variant="Primary" />}
          {canEdit && (
            <View style={Spaces.marginTop[12]}>
              <Button onPress={handleOpenEventActionsMenu} title="Actions événement" variant="Secondary" />
            </View>
          )}
        </View>
      );
    }

    if (isTournamentEvent && !isStageDayEvent) {
      return null;
    }

    const featuredActionNode = canManageFeatured && canRequestFeatured ? (
      <View style={{ marginTop: 12 }}>
        <Button icon="bell" onPress={() => setIsFeaturedModalVisible(true)} title="Mettre à la une" variant="Secondary" />
      </View>
    ) : null;
    const pendingFeaturedActionNode = (() => {
      if (hasPendingFeaturedScope) {
        return (
          <View style={{ marginTop: 12, opacity: 0.7 }}>
            <Button disabled icon="clock" title="Demande en attente" variant="Secondary" />
          </View>
        );
      }

      if (hasApprovedFeaturedScope && canManageFeatured) {
        return (
          <View style={{ marginTop: 12, opacity: 0.8 }}>
            <Button disabled icon="check" title="Déjà à la une" variant="Secondary" />
          </View>
        );
      }

      return null;
    })();
    const canShowEventActionsPanel = Boolean(
      canEdit || canManageEventLicenseCampaigns,
    );
    const eventLicenseCampaignActionsNode = canManageEventLicenseCampaigns
      ? renderEventLicenseCampaignActions()
      : null;
    const eventAnswerButtonsNode = (
      <EventAnswerButtons
        event={event}
        hasAcceptedRequest={hasAcceptedRequest}
        hasPendingRequest={hasPendingRequest}
        onDecline={() => handleDeclineEvent(event)}
        onDeleteParticipation={handleDeleteParticipation}
        onJoin={handleJoinEvent}
        onLogin={() => openPublicAuthFlow(navigation, {
          origin: RouteNames.EventDetails,
          source: 'event-details-login',
        })}
        onParticipate={() => handleParticipateToEvent(event)}
        participationFlow={tournamentAwareParticipationFlow}
      />
    );
    const actionButtonsNode = (
      <View style={[Spaces.gap[12]]}>
        {canEdit ? (
          <Button
            onPress={handleOpenEventActionsMenu}
            title="Actions événement"
            variant="Secondary"
          />
        ) : null}
        {eventLicenseCampaignActionsNode}
        {canEdit && supportsEventComposition && (
          <View style={{ marginTop: 12 }}>
            <Button
              disabled={isStaffCompositionFetching}
              onPress={handleManageComposition}
              title={isStaffCompositionFetching ? 'Chargement...' : compositionPrimaryAction.title}
              variant="Secondary"
            />
            {compositionPrimaryAction.subtitle ? (
              <Text style={[Fonts.p3, Fonts.neutral300, { marginTop: 8, textAlign: 'center' }]}>
                {compositionPrimaryAction.subtitle}
              </Text>
            ) : null}

            {isMatchEvent ? (
              <View style={{ marginTop: 12 }}>
                <Button
                  disabled={matchStatsPrimaryAction.disabled || isMatchStatsFetching}
                  onPress={openMatchStatsEditor}
                  title={isMatchStatsFetching ? 'Chargement...' : matchStatsPrimaryAction.title}
                  variant="Secondary"
                />
                {matchStatsPrimaryAction.subtitle ? (
                  <Text style={[Fonts.p3, Fonts.neutral300, { marginTop: 8, textAlign: 'center' }]}>
                    {matchStatsPrimaryAction.subtitle}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        )}
      </View>
    );

    if (canEdit && isTournamentEvent && !isStageDayEvent) {
      return null;
    }

    if (canEdit && supportsEventComposition) {
      return (
        <View>
          <View
            style={[
              ApplicationStyle.card,
              ApplicationStyle.backgroundColor.primary900,
              ApplicationStyle.borderColor.primary500,
              ApplicationStyle.borderRadius24,
              ApplicationStyle.borderWidth1,
              Spaces.padding[16],
              Spaces.gap[12],
            ]}
          >
            <View
              style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}
            >
              <View style={[Spaces.gap[4], { flex: 1, paddingRight: 12 }]}>
                <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Actions événement</Text>
                <Text style={[Fonts.p3, Fonts.neutral300]}>
                  Modifie cet evenement, gere son annulation ou prepare la composition d&apos;equipes.
                </Text>
              </View>
              <TouchableOpacity
                accessibilityLabel={eventActionsToggleLabel}
                accessibilityRole="button"
                activeOpacity={0.82}
                hitSlop={{
                  bottom: 8,
                  left: 8,
                  right: 8,
                  top: 8,
                }}
                onPress={() => setIsEventActionsOpen((prev) => !prev)}
                style={[
                  ApplicationStyle.backgroundColor.primary700,
                  ApplicationStyle.borderColor.primary500,
                  ApplicationStyle.borderWidth1,
                  Spaces.paddingHorizontal[12],
                  Spaces.paddingVertical[8],
                  { borderRadius: 20 },
                ]}
              >
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                  {isEventActionsOpen ? 'Fermer' : 'Ouvrir'}
                </Text>
              </TouchableOpacity>
            </View>

            {isEventActionsOpen ? actionButtonsNode : null}
          </View>

          {featuredActionNode}
          {pendingFeaturedActionNode}
        </View>
      );
    }

    if (canShowEventActionsPanel) {
      return (
        <View>
          <View
            style={[
              ApplicationStyle.card,
              ApplicationStyle.backgroundColor.primary900,
              ApplicationStyle.borderColor.primary500,
              ApplicationStyle.borderRadius24,
              ApplicationStyle.borderWidth1,
              Spaces.padding[16],
              Spaces.gap[12],
            ]}
          >
            <View
              style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter]}
            >
              <View style={[Spaces.gap[4], { flex: 1, paddingRight: 12 }]}>
                <Text style={[Fonts.h4Bold, Fonts.neutral00]}>Actions événement</Text>
                <Text style={[Fonts.p3, Fonts.neutral300]}>
                  {canEdit
                    ? 'Modifie cet événement ou gère son annulation.'
                    : 'Gère les cotisations rattachées à cet événement.'}
                </Text>
              </View>
              <TouchableOpacity
                accessibilityLabel={eventActionsToggleLabel}
                accessibilityRole="button"
                activeOpacity={0.82}
                hitSlop={{
                  bottom: 8,
                  left: 8,
                  right: 8,
                  top: 8,
                }}
                onPress={() => setIsEventActionsOpen((prev) => !prev)}
                style={[
                  ApplicationStyle.backgroundColor.primary700,
                  ApplicationStyle.borderColor.primary500,
                  ApplicationStyle.borderWidth1,
                  Spaces.paddingHorizontal[12],
                  Spaces.paddingVertical[8],
                  { borderRadius: 20 },
                ]}
              >
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>
                  {isEventActionsOpen ? 'Fermer' : 'Ouvrir'}
                </Text>
              </TouchableOpacity>
            </View>

            {isEventActionsOpen ? actionButtonsNode : null}
          </View>

          {!canEdit ? (
            <View style={{ marginTop: 12 }}>
              {eventAnswerButtonsNode}
            </View>
          ) : null}
          {featuredActionNode}
          {pendingFeaturedActionNode}
        </View>
      );
    }

    return (
      <View>
        {eventAnswerButtonsNode}
        {featuredActionNode}
        {pendingFeaturedActionNode}
      </View>
    );
  };

  const refreshEventDetails = useCallback((options = {}) => {
    // @ts-ignore: FIXME: Baseline TS regression
    const includeSecondary = options?.includeSecondary !== false;

    refetch();
    if (!includeSecondary || !areDeferredQueriesEnabled) return;

    refetchParticipations();
    if (canAccessAttendance) {
      refetchAttendance();
    }
    if (supportsEventComposition && canEdit && compositionTeamId) {
      refetchTeamComposition();
    }
    if (isMatchEvent && compositionTeamId && (canManageMatchStats || isTeamMember)) {
      refetchMatchStats();
    }
    if (supportsEventComposition && canViewPublishedComposition && compositionTeamId) {
      refetchConvocation();
    }
    if (isMatchEvent && isTeamMember && compositionTeamId) {
      refetchMyMatchResponse();
    }
  }, [
    areDeferredQueriesEnabled,
    canAccessAttendance,
    canEdit,
    canManageMatchStats,
    canViewPublishedComposition,
    compositionTeamId,
    isMatchEvent,
    isTeamMember,
    refetch,
    refetchAttendance,
    refetchConvocation,
    refetchMatchStats,
    refetchMyMatchResponse,
    refetchParticipations,
    refetchTeamComposition,
    supportsEventComposition,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (firstFocusRefreshRef.current) {
        firstFocusRefreshRef.current = false;
        return undefined;
      }

      const now = Date.now();
      const hasFreshPrimaryData = Boolean(
        eventDataUpdatedAt
        && now - eventDataUpdatedAt < EVENT_DETAILS_STALE_MS,
      );
      const recentlyRefreshedOnFocus = Boolean(
        lastFocusRefreshAtRef.current
        && now - lastFocusRefreshAtRef.current < EVENT_DETAILS_STALE_MS,
      );

      if (hasFreshPrimaryData || recentlyRefreshedOnFocus) {
        return undefined;
      }

      lastFocusRefreshAtRef.current = now;
      markEventDetailsPerf('event_detail_focus_refresh_requested', {
        eventId,
        includeSecondary: areDeferredQueriesEnabled,
      });
      refreshEventDetails({ includeSecondary: areDeferredQueriesEnabled });
      return undefined;
    }, [
      areDeferredQueriesEnabled,
      eventDataUpdatedAt,
      eventId,
      refreshEventDetails,
    ]),
  );

  const renderHeaderLeft = useCallback(
    () => (fromEventCreation ? <HeaderBackButton onPress={handleBackAfterCreation} /> : null),
    [fromEventCreation, handleBackAfterCreation],
  );

  const renderHeaderRight = useCallback(
    () => (
      <Button
        icon="flag"
        isOption
        onPress={() => setIsReportModalVisible(true)}
        style={Spaces.marginRight[16]}
        variant="Secondary"
      />
    ),
    [Spaces.marginRight],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: fromEventCreation ? renderHeaderLeft : undefined,
      headerRight: renderHeaderRight,
    });
  }, [fromEventCreation, navigation, renderHeaderLeft, renderHeaderRight]);

  const isCoachLateModal = lateModalMode === 'coach_mark' || lateModalMode === 'coach_edit';
  const isPlayerLateModal = lateModalMode === 'player_declare' || lateModalMode === 'player_update';
  const lateModalAttendance = lateModalUser?.documentId
    ? attendanceByUserId[lateModalUser.documentId]
    : null;
  const canResetLateModal = isCoachLateModal && Boolean(
    lateModalAttendance?.arrivedAt
    || lateModalAttendance?.declaredLateMinutes
    || lateModalAttendance?.manualOverride
    || lateModalAttendance?.note,
  );
  const isLateModalLoading = mutations.coachArrivalMutation.isPending
    || mutations.updateLateMinutesMutation.isPending
    || mutations.selfLateMutation.isPending
    || mutations.resetAttendanceMutation.isPending;
  let lateModalTitle = 'Corriger le retard';
  let lateModalDescription = 'Mets à jour le retard réel ou réinitialise le pointage.';
  let lateModalPrimaryActionTitle = 'Enregistrer';

  if (isPlayerLateModal) {
    lateModalTitle = lateModalMode === 'player_update' ? 'Mettre à jour mon retard' : 'Je serai en retard';
    lateModalDescription = 'Signale ton retard avant d\'arriver. Tu confirmeras ensuite ton arrivée réelle.';
    lateModalPrimaryActionTitle = 'Enregistrer mon retard';
  } else if (lateModalMode === 'coach_mark') {
    lateModalTitle = 'Pointer l\'arrivée';
    lateModalDescription = 'Pointe l\'arrivée et ajuste le retard si nécessaire.';
    lateModalPrimaryActionTitle = 'Pointer l\'arrivée';
  }

  // @ts-ignore: FIXME: Baseline TS regression
  const renderSelfAttendanceActionButton = (action, variant = 'Primary') => {
    if (!action) return null;

    if (action.type === 'arrived') {
      return (
        <Button
          disabled={mutations.selfArrivalMutation.isPending}
          icon="check"
          isLoading={mutations.selfArrivalMutation.isPending}
          onPress={handleSelfArrival}
          title={action.title}
          // @ts-ignore: FIXME: Baseline TS regression
          variant={variant}
        />
      );
    }

    return (
      <Button
        disabled={isLateModalLoading}
        onPress={openSelfLateModal}
        title={action.title}
        // @ts-ignore: FIXME: Baseline TS regression
        variant={variant}
      />
    );
  };

  return (
    <ScreenContainer bgImage="bg2" contentContainerStyle={[Spaces.paddingBottom[32], Spaces.gap[32], Alignments.fill]} gradient={null} withHeaderPadding>
      <View style={[Spaces.gap[8], Alignments.alignCenter]}>
        <Tag style={{}} text={event?.type?.name?.toUpperCase() || ''} textStyle={Fonts.p2} />
      </View>

      <ScrollView
        contentContainerStyle={[Spaces.gap[32], Spaces.paddingBottom[40]]}
        refreshControl={(
          <RefreshControl
            onRefresh={() => refreshEventDetails({ includeSecondary: true })}
            refreshing={isLoading || isEventFetching}
          />
        )}
        showsVerticalScrollIndicator={false}
      >
        <WithDataWrapper error={error} isLoading={isLoading} wrapperStyle={[Alignments.fill, Spaces.gap[24]]}>
          <EventHeader event={event} matchScoreSummary={matchHeaderScoreSummary} />
          {renderTournamentActionsPanel()}
          <View style={[Spaces.gap[24]]}>

            {isStageParentEvent ? (
              <View style={[Spaces.gap[16]]}>
                <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
                  {isTournamentEvent ? 'Tournoi' : 'Stage'}
                </Text>
                <View
                  style={[
                    ApplicationStyle.backgroundColor.primary900,
                    ApplicationStyle.borderRadius24,
                    ApplicationStyle.borderWidth1,
                    Spaces.padding[16],
                    Spaces.gap[16],
                    {
                      borderColor: `${Colors.primary500}55`,
                    },
                  ]}
                >
                  <View style={[Alignments.row, Spaces.gap[8]]}>
                    {[
                      { key: 'overview', label: 'Vue générale' },
                      { key: 'days', label: 'Jours' },
                    ].map((tab) => {
                      const selected = stageDetailsTab === tab.key;
                      return (
                        <TouchableOpacity
                          key={tab.key}
                          onPress={() => setStageDetailsTab(tab.key)}
                          style={[
                            ApplicationStyle.borderRadius100,
                            Spaces.paddingHorizontal[16],
                            Spaces.paddingVertical[12],
                            {
                              backgroundColor: selected ? `${Colors.primary500}22` : 'rgba(255,255,255,0.05)',
                              borderColor: selected ? Colors.primary500 : `${Colors.primary500}40`,
                              borderWidth: 1,
                            },
                          ]}
                        >
                          <Text style={[Fonts.p3Bold, selected ? Fonts.primary500 : Fonts.neutral200]}>
                            {tab.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {stageDetailsTab === 'overview' ? (
                    <View style={[Spaces.gap[12]]}>
                      <View style={[Spaces.gap[4]]}>
                        <Text style={[Fonts.p3, Fonts.neutral200]}>Période</Text>
                        <Text style={[Fonts.p2, Fonts.neutral00]}>{stagePeriodSummary || 'Non renseignée'}</Text>
                      </View>
                      <View style={[Spaces.gap[4]]}>
                        <Text style={[Fonts.p3, Fonts.neutral200]}>Horaires</Text>
                        <Text style={[Fonts.p2, Fonts.primary500]}>{stageHoursSummary || 'Variables'}</Text>
                      </View>
                      <View style={[Spaces.gap[4]]}>
                        <Text style={[Fonts.p3, Fonts.neutral200]}>Lieu principal</Text>
                        <Text style={[Fonts.p2, Fonts.neutral100]}>
                          {event?.facility?.name || event?.locationDetails || 'A définir'}
                        </Text>
                      </View>
                      <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
                        <View
                          style={[
                            ApplicationStyle.card,
                            Spaces.paddingHorizontal[12],
                            Spaces.paddingVertical[8],
                            {
                              backgroundColor: 'rgba(1, 179, 244, 0.08)',
                              borderColor: 'rgba(1, 179, 244, 0.20)',
                            },
                          ]}
                        >
                          <Text style={[Fonts.p3Bold, Fonts.primary500]}>{`${stageChildDays.length} jour(s)`}</Text>
                        </View>
                        <View
                          style={[
                            ApplicationStyle.card,
                            Spaces.paddingHorizontal[12],
                            Spaces.paddingVertical[8],
                            {
                              backgroundColor: 'rgba(1, 179, 244, 0.08)',
                              borderColor: 'rgba(1, 179, 244, 0.20)',
                            },
                          ]}
                        >
                          <Text style={[Fonts.p3Bold, Fonts.primary500]}>{`${event?.participations?.length || 0} inscrit(s)`}</Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={[Spaces.gap[12]]}>
                      {stageChildDays.map((stageDay) => {
                        const summary = getStageDayStatusSummary(stageDay);
                        return (
                          <TouchableOpacity
                            key={stageDay?.documentId || stageDay?.date}
                            onPress={() => navigation.navigate(RouteNames.EventDetails, {
                              eventId: stageDay?.documentId,
                            })}
                            style={[
                              ApplicationStyle.card,
                              Spaces.padding[16],
                              Spaces.gap[8],
                              {
                                backgroundColor: 'rgba(1, 179, 244, 0.08)',
                                borderColor: 'rgba(1, 179, 244, 0.20)',
                              },
                            ]}
                          >
                            <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
                              <View style={{ flex: 1 }}>
                                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                                  {new Date(stageDay?.date).toLocaleDateString('fr-FR', {
                                    day: '2-digit',
                                    month: 'short',
                                    weekday: 'long',
                                  })}
                                </Text>
                                <Text style={[Fonts.p3, Fonts.neutral200, Spaces.marginTop[4]]}>
                                  {`${String(stageDay?.startTime || '').slice(0, 5)} - ${String(stageDay?.endTime || '').slice(0, 5)}`}
                                </Text>
                              </View>
                              <Text style={[Fonts.p3Bold, Fonts.primary500]}>Voir</Text>
                            </View>
                            <View style={[Alignments.row, Spaces.gap[8], { flexWrap: 'wrap' }]}>
                              <Text style={[Fonts.p4, Fonts.neutral200]}>{`${summary.present} presents`}</Text>
                              <Text style={[Fonts.p4, Fonts.neutral200]}>{`${summary.absent} absents`}</Text>
                              <Text style={[Fonts.p4, Fonts.neutral200]}>{`${summary.pending} sans réponse`}</Text>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                      {stageChildDays.length === 0 ? (
                        <Text style={[Fonts.p2, Fonts.neutral200]}>
                          Aucune journee de stage n&apos;est encore disponible.
                        </Text>
                      ) : null}
                    </View>
                  )}
                </View>
              </View>
            ) : null}

            {isStageDayEvent && event?.parentEvent?.documentId ? (
              <TouchableOpacity
                onPress={() => navigation.navigate(RouteNames.EventDetails, {
                  eventId: event.parentEvent.documentId,
                })}
                style={[
                  ApplicationStyle.backgroundColor.primary900,
                  ApplicationStyle.borderRadius24,
                  ApplicationStyle.borderWidth1,
                  Spaces.padding[16],
                  Spaces.gap[8],
                  {
                    borderColor: `${Colors.primary500}55`,
                  },
                ]}
              >
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>Journée de stage</Text>
                <Text style={[Fonts.p2, Fonts.neutral00]}>
                  Cette journée depend du stage principal.
                </Text>
                <Text style={[Fonts.p3Bold, Fonts.primary500]}>Voir le stage</Text>
              </TouchableOpacity>
            ) : null}

            {Array.isArray(event?.eventTasks) && event.eventTasks.length > 0 ? (
              <EventTasksSection
                canManageEvent={canEdit}
                event={event}
                userData={userData}
              />
            ) : null}

            {renderTournamentSection()}

            {eventDescriptionText ? (
              <View style={[Spaces.gap[16]]}>
                <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{t('eventDetails.fields.description')}</Text>
                <Text style={[Fonts.p1, Fonts.primary100]}>{eventDescriptionText}</Text>
              </View>
            ) : null}

            {canSelfMarkArrival && selfAttendanceStatus ? (
              <View style={[Spaces.gap[12]]}>
                <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Statut d&apos;arrivée</Text>
                <View
                  style={[
                    ApplicationStyle.backgroundColor.primary900,
                    ApplicationStyle.borderRadius24,
                    ApplicationStyle.borderWidth1,
                    Spaces.padding[16],
                    Spaces.gap[12],
                    {
                      borderColor: selfAttendanceStatus.accentColor,
                    },
                  ]}
                >
                  <View style={[Alignments.row, Alignments.alignCenter, Alignments.justifySpaceBetween, Spaces.gap[12]]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[Fonts.p3Bold, Fonts.neutral200]}>Présence événement</Text>
                      <Text style={[Fonts.p2, Fonts.neutral100, Spaces.marginTop[4]]}>
                        {selfAttendanceStatus.description}
                      </Text>
                    </View>
                    <View
                      style={[
                        {
                          backgroundColor: selfAttendanceStatus.badgeBackgroundColor,
                          borderColor: selfAttendanceStatus.badgeBorderColor,
                          borderRadius: 18,
                          borderWidth: 1,
                          minWidth: selfAttendanceStatus.badgeValue ? 136 : 104,
                          paddingHorizontal: selfAttendanceStatus.badgeValue ? 14 : 12,
                          paddingVertical: selfAttendanceStatus.badgeValue ? 9 : 7,
                        },
                      ]}
                    >
                      <Text style={[Fonts.p4, { color: selfAttendanceStatus.badgeTextColor, textAlign: 'center' }]}>
                        {selfAttendanceStatus.badgeLabel}
                      </Text>
                      {selfAttendanceStatus.badgeValue ? (
                        <Text
                          style={[
                            Fonts.p4Bold,
                            {
                              color: selfAttendanceStatus.badgeTextColor,
                              marginTop: 2,
                              textAlign: 'center',
                            },
                          ]}
                        >
                          {selfAttendanceStatus.badgeValue}
                        </Text>
                      ) : null}
                    </View>
                  </View>

                  {!selfAttendanceStatus.hasArrived ? (
                    <View style={[Spaces.gap[8]]}>
                      {renderSelfAttendanceActionButton(selfAttendanceStatus.primaryAction, 'Primary')}
                      {selfAttendanceStatus.secondaryAction ? (
                        renderSelfAttendanceActionButton(selfAttendanceStatus.secondaryAction, 'SecondaryLight')
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}

            {detectionSlots.length > 0 ? (
              <EventDetectionSlots
                canEdit={canEdit}
                currentUserHasGenericParticipation={Boolean((hasAcceptedRequest || hasPendingRequest) && !currentUserDetectionParticipation)}
                // @ts-ignore: FIXME: Baseline TS regression
                currentUserSlotId={currentUserDetectionParticipation?.recruitmentAd?.documentId || ''}
                currentUserSlotStatus={String(currentUserDetectionParticipation?.participationStatus || '').toLowerCase()}
                // @ts-ignore: FIXME: Baseline TS regression
                isApplyingSlotId={applyToDetectionSlotMutation.isPending ? String(applyToDetectionSlotMutation.variables?.slotDocumentId || '') : ''}
                onApply={handleApplyToDetectionSlot}
                onOpenSlot={handleOpenDetectionSlot}
                slots={detectionSlots}
              />
            ) : null}

            {Array.isArray(event?.teamAudiences) && event.teamAudiences.length > 0 ? (
              <EventTeamAudiencesSection
                canManageEvent={canEdit}
                event={event}
                userData={userData}
              />
            ) : null}

            {canManageTrainingVisibility ? (
              <View
                style={[
                  ApplicationStyle.backgroundColor.primary900,
                  ApplicationStyle.borderRadius16,
                  ApplicationStyle.borderWidth1,
                  Spaces.padding[16],
                  Spaces.gap[12],
                  {
                    borderColor: `${Colors.primary500}33`,
                  },
                ]}
              >
                <View style={[Spaces.gap[4]]}>
                  <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
                    {trainingOpenConfig.isOpenTraining ? 'Entraînement ouvert' : 'Entraînement prive'}
                  </Text>
                  <Text style={[Fonts.p2, Fonts.neutral200]}>
                    {trainingOpenConfig.isOpenTraining
                      ? 'Les joueurs externes peuvent rejoindre selon ton quota et ton mode de validation.'
                      : 'Ouvre l\'entraînement pour autoriser un quota de joueurs externes sans toucher à tes joueurs internes.'}
                  </Text>
                </View>

                {trainingOpenConfig.externalParticipantLimit !== null ? (
                  <Text style={[Fonts.p3, Fonts.primary100]}>
                    {trainingOpenConfig.isOpenTraining
                      ? `${trainingOpenConfig.externalParticipantLimit} place(s) externes - validation ${trainingOpenConfig.externalParticipantValidationMode === 'auto' ? 'automatique' : 'manuelle'}`
                      : `Dernier reglage mémorise: ${trainingOpenConfig.externalParticipantLimit} place(s) externes - validation ${trainingOpenConfig.externalParticipantValidationMode === 'auto' ? 'automatique' : 'manuelle'}`}
                  </Text>
                ) : null}

                <Button
                  disabled={mutations.updateEventNoNavMutation.isPending}
                  isLoading={mutations.updateEventNoNavMutation.isPending}
                  onPress={trainingOpenConfig.isOpenTraining
                    ? handleCloseTraining
                    : () => setIsTrainingOpenModalVisible(true)}
                  title={trainingOpenConfig.isOpenTraining ? 'Fermer l\'entraînement' : 'Ouvrir l\'entraînement'}
                  variant={trainingOpenConfig.isOpenTraining ? 'SecondaryLight' : 'Primary'}
                />
              </View>
            ) : null}

            {(!isTournamentEvent || isStageDayEvent) ? (
              <EventParticipants
                // @ts-ignore: FIXME: Baseline TS regression
                attendanceByUserId={attendanceByUserId}
                canApprovePendingRequests={canApprovePendingRequests}
                canEdit={canEdit}
                event={event}
                eventStartAt={eventStartAt}
                externalParticipationSection={externalParticipationSection}
                handleExportParticipants={handleExportParticipants}
                handleRemindPlayers={handleRemindPlayers}
                handleShare={() => setIsShareModalVisible(true)}
                handleUpdateParticipation={handleUpdateParticipation}
                handleUserPress={handleUserPress}
                nowMs={serverNowMs}
                onCoachEditLate={handleCoachEditLate}
                onCoachMarkArrival={handleCoachMarkArrival}
                participantsSummary={participantsSummary}
                participationsByStatus={participationsByStatus}
                pendingParticipations={pendingParticipations}
                teamParticipationSections={teamParticipationSections}
              />
            ) : null}

            {isMatchEvent
          && compositionTeamId
          && isTeamMember
          && isMatchFinished
          && myMatchResponsePayload?.attendanceRestriction === 'no_show' ? (
            <View style={[Spaces.gap[12]]}>
              <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Mes stats</Text>
              <View
                style={[
                  ApplicationStyle.backgroundColor.primary900,
                  ApplicationStyle.borderRadius24,
                  Spaces.padding[16],
                  Spaces.gap[12],
                  {
                    borderColor: `${Colors.error500 || 'rgb(248, 113, 113)'}55`,
                    borderWidth: 1,
                  },
                ]}
              >
                <Text style={[Fonts.p4Bold, { color: Colors.error500 || 'rgb(248, 113, 113)' }]}>
                  Pointage à corriger
                </Text>
                <Text style={[Fonts.p2, Fonts.neutral100]}>
                  Ton arrivée n&apos;a pas été confirmée avant la fin du match. Un coach doit corriger ta présence avant de débloquer ton retour post-match.
                </Text>
              </View>
            </View>
              ) : null}

            {isMatchEvent && compositionTeamId && isTeamMember && isMatchFinished && canRespondMyMatchStats ? (
              <View style={[Spaces.gap[12]]}>
                <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Mes stats</Text>
                <View
                  style={[
                    ApplicationStyle.backgroundColor.primary900,
                    ApplicationStyle.borderRadius24,
                    ApplicationStyle.borderColor.primary500,
                    ApplicationStyle.borderWidth1,
                    Spaces.padding[16],
                    Spaces.gap[12],
                  ]}
                >
                  <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[Fonts.p4Bold, Fonts.primary500]}>Retour individuel</Text>
                      <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
                        {myMatchResponse?.selfRating ? `${myMatchResponse.selfRating}/10` : 'A compléter'}
                      </Text>
                    </View>
                    <View
                      style={[
                        Spaces.paddingHorizontal[12],
                        Spaces.paddingVertical[8],
                        {
                          backgroundColor: myMatchResponseStatusMeta.backgroundColor,
                          borderColor: myMatchResponseStatusMeta.borderColor,
                          borderRadius: 999,
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <Text style={[Fonts.p4Bold, { color: myMatchResponseStatusMeta.textColor }]}>
                        {myMatchResponseStatusMeta.label}
                      </Text>
                    </View>
                  </View>

                  <Text style={[Fonts.p2, Fonts.neutral100]}>
                    {myMatchResponseSummary}
                  </Text>

                  {myMatchResponse?.teamRating ? (
                    <View
                      style={[
                        ApplicationStyle.backgroundColor.primary700,
                        ApplicationStyle.borderRadius16,
                        Spaces.padding[12],
                      ]}
                    >
                      <Text style={[Fonts.p4Bold, Fonts.primary100]}>
                        {`Le match de l equipe : ${myMatchResponse.teamRating}/10`}
                      </Text>
                    </View>
                  ) : null}

                  {myMatchResponse?.selfComment ? (
                    <View
                      style={[
                        ApplicationStyle.backgroundColor.primary700,
                        ApplicationStyle.borderRadius16,
                        Spaces.padding[12],
                      ]}
                    >
                      <Text numberOfLines={3} style={[Fonts.p4, Fonts.neutral100]}>
                        {myMatchResponse.selfComment}
                      </Text>
                    </View>
                  ) : null}

                  <Button
                    disabled={isMyMatchResponseFetching}
                    onPress={openMyMatchResponse}
                    size="sm"
                    title={myMatchResponseButtonTitle}
                    variant="Secondary"
                  />
                </View>
              </View>
            ) : null}

            {isMatchEvent && compositionTeamId && isTeamMember && isMatchFinished && canRespondMyMatchStats ? (
              <View style={[Spaces.gap[12]]}>
                <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Mon retour coach</Text>
                <View
                  style={[
                    ApplicationStyle.backgroundColor.primary900,
                    ApplicationStyle.borderRadius24,
                    ApplicationStyle.borderColor.primary500,
                    ApplicationStyle.borderWidth1,
                    Spaces.padding[16],
                    Spaces.gap[12],
                    isCoachFeedbackHighlighted
                      ? {
                        borderColor: Colors.primary200,
                        borderWidth: 2,
                      }
                      : null,
                  ]}
                >
                  <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[Fonts.p4Bold, Fonts.primary500]}>Retour individuel du coach</Text>
                      <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
                        {myCoachReview?.rating != null ? `${myCoachReview.rating}/10` : 'En attente'}
                      </Text>
                    </View>
                    <View
                      style={[
                        Spaces.paddingHorizontal[12],
                        Spaces.paddingVertical[8],
                        {
                          backgroundColor: hasMyCoachReview ? `${Colors.success500}18` : `${Colors.primary500}18`,
                          borderColor: hasMyCoachReview ? `${Colors.success500}55` : `${Colors.primary500}40`,
                          borderRadius: 999,
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <Text style={[Fonts.p4Bold, hasMyCoachReview ? Fonts.success500 : Fonts.primary100]}>
                        {hasMyCoachReview ? 'Disponible' : 'Pas encore partage'}
                      </Text>
                    </View>
                  </View>

                  <Text style={[Fonts.p2, Fonts.neutral100]}>
                    {hasMyCoachReview
                      ? 'Le coach a publié un retour individuel pour ton match.'
                      : "Le coach n'a pas encore laisse d'avis individuel pour ce match."}
                  </Text>

                  {myCoachReview?.comment ? (
                    <View
                      style={[
                        ApplicationStyle.backgroundColor.primary700,
                        ApplicationStyle.borderRadius16,
                        Spaces.padding[12],
                      ]}
                    >
                      <Text style={[Fonts.p4, Fonts.neutral100]}>
                        {myCoachReview.comment}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}

            {isMatchEvent && compositionTeamId && canViewMatchStats ? (
              <View style={[Spaces.gap[12]]}>
                <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Stats du match</Text>
                <View
                  style={[
                    ApplicationStyle.backgroundColor.primary900,
                    ApplicationStyle.borderRadius24,
                    ApplicationStyle.borderColor.primary500,
                    ApplicationStyle.borderWidth1,
                    Spaces.padding[16],
                    Spaces.gap[12],
                  ]}
                >
                  <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[Fonts.p4Bold, Fonts.primary500]}>Suivi post-match</Text>
                      <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{matchStatsScoreLabel}</Text>
                    </View>
                    <View
                      style={[
                        Spaces.paddingHorizontal[12],
                        Spaces.paddingVertical[8],
                        {
                          backgroundColor: matchStatsStatusMeta.backgroundColor,
                          borderColor: matchStatsStatusMeta.borderColor,
                          borderRadius: 999,
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <Text style={[Fonts.p4Bold, { color: matchStatsStatusMeta.textColor }]}>
                        {matchStatsStatusMeta.label}
                      </Text>
                    </View>
                  </View>

                  <Text style={[Fonts.p2, Fonts.neutral100]}>
                    {matchStatsSummaryText}
                  </Text>

                  {matchStatsReport?.collectiveRating || playerCollectiveRating?.average != null ? (
                    <View style={[Alignments.row, Spaces.gap[12]]}>
                      {matchStatsReport?.collectiveRating ? (
                        <View
                          style={[
                            ApplicationStyle.backgroundColor.primary700,
                            ApplicationStyle.borderRadius16,
                            Spaces.padding[12],
                            Spaces.gap[4],
                            { flex: 1 },
                          ]}
                        >
                          <Text style={[Fonts.p4Bold, Fonts.primary100]}>Note coach</Text>
                          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{`${matchStatsReport.collectiveRating}/10`}</Text>
                        </View>
                      ) : null}
                      {playerCollectiveRating?.average != null ? (
                        <View
                          style={[
                            ApplicationStyle.backgroundColor.primary700,
                            ApplicationStyle.borderRadius16,
                            Spaces.padding[12],
                            Spaces.gap[4],
                            { flex: 1 },
                          ]}
                        >
                          <Text style={[Fonts.p4Bold, Fonts.primary100]}>Ressenti joueurs</Text>
                          <Text style={[Fonts.h4Bold, Fonts.neutral00]}>{`${playerCollectiveRating.average}/10`}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {matchStatsReport?.collectiveComment ? (
                    <View
                      style={[
                        ApplicationStyle.backgroundColor.primary700,
                        ApplicationStyle.borderRadius16,
                        Spaces.padding[12],
                      ]}
                    >
                      <Text numberOfLines={3} style={[Fonts.p4, Fonts.neutral100]}>
                        {matchStatsReport.collectiveComment}
                      </Text>
                    </View>
                  ) : null}

                  {(matchStatsReport?.responseEligibleCount || matchStatsReport?.responseCompletionCount || playerCollectiveRating?.count) ? (
                    <View
                      style={[
                        ApplicationStyle.backgroundColor.primary700,
                        ApplicationStyle.borderRadius16,
                        Spaces.padding[12],
                        Spaces.gap[4],
                      ]}
                    >
                      <Text style={[Fonts.p4Bold, Fonts.primary100]}>
                        {`${matchStatsReport?.responseCompletionCount ?? playerCollectiveRating?.count ?? 0}/${matchStatsReport?.responseEligibleCount ?? playerCollectiveRating?.eligibleCount ?? 0} joueurs ont repondu`}
                      </Text>
                      {playerCollectiveRating?.count ? (
                        <Text style={[Fonts.p4, Fonts.neutral100]}>
                          {`${playerCollectiveRating.count} note${playerCollectiveRating.count > 1 ? 's' : ''} collective${playerCollectiveRating.count > 1 ? 's' : ''} prise${playerCollectiveRating.count > 1 ? 's' : ''} en compte`}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  {matchStatsReport ? (
                    <View style={[Alignments.row, Spaces.gap[12]]}>
                      <View
                        style={[
                          ApplicationStyle.backgroundColor.primary700,
                          ApplicationStyle.borderRadius16,
                          Spaces.padding[12],
                          { flex: 1 },
                        ]}
                      >
                        <Text style={[Fonts.p4, Fonts.neutral300]}>Version</Text>
                        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                          {`v${Number(matchStatsReport?.version || 1)}`}
                        </Text>
                      </View>
                      <View
                        style={[
                          ApplicationStyle.backgroundColor.primary700,
                          ApplicationStyle.borderRadius16,
                          Spaces.padding[12],
                          { flex: 2 },
                        ]}
                      >
                        <Text style={[Fonts.p4, Fonts.neutral300]}>Publication</Text>
                        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                          {matchStatsReport?.finalizedAt
                            ? new Date(matchStatsReport.finalizedAt).toLocaleString('fr-FR')
                            : '-'}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {isMatchStatsReviewRequired ? (
                    <View
                      style={[
                        ApplicationStyle.borderRadius16,
                        Spaces.padding[12],
                        {
                          backgroundColor: `${Colors.warning500}14`,
                          borderColor: `${Colors.warning500}45`,
                          borderWidth: 1,
                        },
                      ]}
                    >
                      <Text style={[Fonts.p4, Fonts.warning500]}>
                        Le score officiel a changé après la première publication. Une mise à jour est requise.
                      </Text>
                    </View>
                  ) : null}

                  <Button
                    disabled={matchStatsPrimaryAction.disabled || isMatchStatsFetching}
                    onPress={openMatchStatsEditor}
                    size="sm"
                    title={matchStatsCardButtonTitle}
                    variant="Secondary"
                  />
                </View>
              </View>
            ) : null}

            {supportsEventComposition && (canViewPublishedComposition || canEdit) ? (
              <View style={[Spaces.gap[12]]}>
                <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
                  Composition d&apos;equipes
                </Text>
                {hasPublishedComposition ? (
                  <View style={[Spaces.gap[8]]}>
                    <Text style={[Fonts.p2, Fonts.neutral300]}>
                      {publishedCompositionTeamCount > 0
                        ? `${publishedCompositionTeamCount} équipe(s) publiée(s)`
                        : 'Composition publiée'}
                    </Text>
                    <Text style={[Fonts.p3, Fonts.neutral300]}>
                      {convocationBranches.length}
                      {' '}
                      branche(s) visible(s)
                      {publishedCompositionReserveCount > 0 ? ` · ${publishedCompositionReserveCount} remplacant(s)` : ''}
                    </Text>
                    {convocationBranches[0]?.published?.publishedAt ? (
                      <Text style={[Fonts.p3, Fonts.neutral300]}>
                        Publie le
                        {' '}
                        {new Date(convocationBranches[0].published.publishedAt).toLocaleString('fr-FR')}
                      </Text>
                    ) : null}
                    {publishedCompositionTeamCount > 0 ? (
                      <Button
                        onPress={() => openCompositionBoard(convocationBranches[0]?.published || null, {
                          aggregateBranches: convocationBranches,
                          canEdit: false,
                          editorSource: 'published',
                          editorSourceLabel: getCompositionSourceLabel('published'),
                          readOnly: true,
                        })}
                        title="Voir la composition d'équipes"
                        variant="Secondary"
                      />
                    ) : null}
                  </View>
                ) : (
                  <Text style={[Fonts.p2, Fonts.neutral300]}>
                    Aucune composition publiée pour le moment.
                  </Text>
                )}
              </View>
            ) : null}
          </View>
        </WithDataWrapper>
      </ScrollView>

      <View style={[Spaces.gap[16], Spaces.marginBottom[16]]}>
        {pendingFeaturedApproval?.requestId
          ? (
            <View style={[Alignments.row, Spaces.gap[16]]}>
              <Button
                icon="check"
                isLoading={approveFeaturedRequestMutation.isPending}
                isOption
                onPress={() => approveFeaturedRequestMutation.mutate(pendingFeaturedApproval.requestId)}
                style={{ flex: 1 }}
                title={`Valider ${pendingFeaturedApproval.scopeLabel.toLowerCase()}`}
                variant="Primary"
              />
              <Button
                icon="close"
                isLoading={rejectFeaturedRequestMutation.isPending}
                isOption
                onPress={handleRejectFeaturedApproval}
                style={{ flex: 1 }}
                title="Refuser"
                variant="Secondary"
              />
            </View>
          )
          : renderActionButtons()}
      </View>

      {(() => {
        let joinModalConfirmLabel = currentParticipationFlow?.confirmLabel;
        let joinModalContextNote;
        let joinModalIsSubmitting = mutations.createEventParticipationMutation.isPending;

        // @ts-ignore: FIXME: Baseline TS regression
        if (pendingDetectionSlot?.documentId) {
          joinModalConfirmLabel = 'Participer';
          // @ts-ignore: FIXME: Baseline TS regression
          joinModalContextNote = `Poste choisi : ${pendingDetectionSlot.position}.`;
          joinModalIsSubmitting = applyToDetectionSlotMutation.isPending
            // @ts-ignore: FIXME: Baseline TS regression
            && Boolean(pendingDetectionSlot?.documentId);
        // @ts-ignore: FIXME: Baseline TS regression
        } else if (pendingTournamentAction?.mode === 'create_custom') {
          joinModalConfirmLabel = 'Créer mon équipe';
          // @ts-ignore: FIXME: Baseline TS regression
          joinModalContextNote = `Équipe à créer : ${pendingTournamentAction?.teamName || 'Mon équipe'}.`;
          joinModalIsSubmitting = createTournamentTeamMutation.isPending;
        // @ts-ignore: FIXME: Baseline TS regression
        } else if (pendingTournamentAction?.mode === 'join_existing') {
          joinModalConfirmLabel = 'Envoyer ma demande';
          // @ts-ignore: FIXME: Baseline TS regression
          joinModalContextNote = `Équipe choisie : ${pendingTournamentAction?.teamName || 'Équipe tournoi'}.`;
          joinModalIsSubmitting = requestJoinTournamentTeamMutation.isPending;
        } else if (currentParticipationFlow?.submitMode === 'joinReservation') {
          joinModalIsSubmitting = mutations.joinReservationMutation.isPending;
        }

        /** @type {(acceptance?: { acceptRiskDeclaration?: boolean }) => Promise<void>} */
        let handleJoinModalConfirm = handleConfirmParticipation;

        // @ts-ignore: FIXME: Baseline TS regression
        if (pendingDetectionSlot?.documentId) {
          handleJoinModalConfirm = async (acceptance = {}) => {
            try {
              setJoinModalError('');
              // @ts-ignore: FIXME: Baseline TS regression
              await applyToDetectionSlotMutation.mutateAsync({
                payload: {
                  acceptRiskDeclaration: acceptance?.acceptRiskDeclaration === true,
                },
                // @ts-ignore: FIXME: Baseline TS regression
                slotDocumentId: pendingDetectionSlot.documentId,
              });
              setIsJoinModalVisible(false);
              setPendingDetectionSlot(null);
            } catch (mutationError) {
              setJoinModalError(
                getParticipationErrorMessage(mutationError, 'Impossible de confirmer ta participation pour le moment.'),
              );
            }
          };
        // @ts-ignore: FIXME: Baseline TS regression
        } else if (pendingTournamentAction?.mode === 'create_custom') {
          handleJoinModalConfirm = async (acceptance = {}) => {
            try {
              setJoinModalError('');
              // @ts-ignore: FIXME: Baseline TS regression
              await createTournamentTeamMutation.mutateAsync({
                acceptRiskDeclaration: acceptance?.acceptRiskDeclaration === true,
                // @ts-ignore: FIXME: Baseline TS regression
                name: pendingTournamentAction?.teamName || 'Mon équipe',
              });
            } catch (mutationError) {
              setJoinModalError(
                getParticipationErrorMessage(mutationError, 'Impossible de créer cette équipe de tournoi pour le moment.'),
              );
            }
          };
        // @ts-ignore: FIXME: Baseline TS regression
        } else if (pendingTournamentAction?.mode === 'join_existing') {
          handleJoinModalConfirm = async (acceptance = {}) => {
            try {
              setJoinModalError('');
              // @ts-ignore: FIXME: Baseline TS regression
              await requestJoinTournamentTeamMutation.mutateAsync({
                acceptRiskDeclaration: acceptance?.acceptRiskDeclaration === true,
                // @ts-ignore: FIXME: Baseline TS regression
                teamDocumentId: pendingTournamentAction?.teamDocumentId,
              });
            } catch (mutationError) {
              setJoinModalError(
                getParticipationErrorMessage(mutationError, 'Impossible d envoyer cette demande pour le moment.'),
              );
            }
          };
        }

        return (
          // @ts-ignore: FIXME: Baseline TS regression
          <JoinEventModal
            clubName={event?.team?.club?.name || event?.club?.name || ''}
            confirmLabel={joinModalConfirmLabel}
            contextNote={joinModalContextNote}
            errorMessage={joinModalError || null}
            isSubmitting={joinModalIsSubmitting}
            isVisible={isJoinModalVisible}
            onClose={() => {
              setIsJoinModalVisible(false);
              setPendingDetectionSlot(null);
              setPendingTournamentAction(null);
              setJoinModalError('');
            }}
            onConfirm={handleJoinModalConfirm}
          />
        );
      })()}

      <BottomModal
        close={() => setIsDetectionSlotPickerVisible(false)}
        headerComponent={(
          <View style={[Spaces.gap[12]]}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00, { textAlign: 'center' }]}>
              Choisir un poste
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100, { textAlign: 'center' }]}>
              Sélectionne le poste auquel tu veux participer.
            </Text>
            <Text style={[Fonts.p3, Fonts.primary200, { textAlign: 'center' }]}>
              {`${detectionSlots.length} poste(s) - ${detectionSlotsSummary.totalRequested} place(s) - ${detectionSlotsSummary.totalOpen} ouvert(s)`}
            </Text>
          </View>
        )}
        isVisible={isDetectionSlotPickerVisible}
        snapPoints={['68%']}
        style={{
          borderColor: `${Colors.primary500}24`,
          borderWidth: 1,
        }}
      >
        <View style={[Spaces.gap[16], Spaces.paddingBottom[24]]}>
          {detectionSlots.map((/** @type {any} */ slot) => {
            const slotId = String(slot?.documentId || '').trim();
            // @ts-ignore: FIXME: Baseline TS regression
            const isCurrentUserSlot = currentUserDetectionParticipation?.recruitmentAd?.documentId === slotId;
            const isComplete = Boolean(slot?.isComplete) && !isCurrentUserSlot;
            const isDisabled = isComplete || applyToDetectionSlotMutation.isPending || isCurrentUserSlot;
            let buttonTitle = 'Participer';
            if (isCurrentUserSlot) {
              buttonTitle = 'Demande envoyée';
            } else if (isComplete) {
              buttonTitle = 'Poste complet';
            }
            const remainingLabel = isComplete
              ? 'Complet'
              : `${slot?.remaining || 0} ${Number(slot?.remaining || 0) > 1 ? 'places restantes' : 'place restante'}`;

            return (
              <View
                key={slotId || `${slot?.position}-${slot?.quantity}`}
                style={[
                  ApplicationStyle.borderRadius24,
                  ApplicationStyle.borderWidth1,
                  Spaces.padding[16],
                  Spaces.gap[16],
                  {
                    backgroundColor: isComplete ? 'rgba(255, 215, 0, 0.06)' : 'rgba(1, 179, 244, 0.10)',
                    borderColor: isComplete ? `${Colors.gold500}34` : `${Colors.primary500}28`,
                  },
                ]}
              >
                <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                      {slot?.position || 'Poste'}
                    </Text>
                    <Text style={[Fonts.p3, Fonts.neutral300, { marginTop: 4 }]}>
                      {`${slot?.acceptedCount || 0}/${slot?.quantity || 1} valide - ${slot?.pendingCount || 0} en attente`}
                    </Text>
                  </View>
                  <Tag
                    style={{
                      backgroundColor: isComplete ? `${Colors.gold500}18` : `${Colors.primary500}18`,
                      borderColor: isComplete ? `${Colors.gold500}30` : `${Colors.primary500}30`,
                    }}
                    text={remainingLabel}
                    // @ts-ignore: FIXME: Baseline TS regression
                    textColor={isComplete ? 'gold500' : 'primary500'}
                    textStyle={{ fontWeight: '700' }}
                  />
                </View>

                <View style={Spaces.marginTop[4]}>
                  <Button
                    disabled={isDisabled}
                    // @ts-ignore: FIXME: Baseline TS regression
                    isLoading={applyToDetectionSlotMutation.isPending && applyToDetectionSlotMutation.variables?.slotDocumentId === slotId}
                    onPress={() => handleApplyToDetectionSlotFromPicker(slot)}
                    title={buttonTitle}
                    variant={isDisabled ? 'SecondaryLight' : 'Primary'}
                  />
                </View>
              </View>
            );
          })}
        </View>
      </BottomModal>

      <RefuseParticipationModal
        isVisible={isRefuseModalVisible}
        onClose={() => setIsRefuseModalVisible(false)}
        onSubmit={(reason) => {
          mutations.declineParticipationMutation.mutate({ reason, requestId: selectedParticipationId });
          setIsRefuseModalVisible(false);
        }}
      />
      <ReportEventModal
        isVisible={isReportModalVisible}
        onClose={() => setIsReportModalVisible(false)}
        onSubmit={(reason) => mutations.reportEventMutation.mutate({ event: eventId || '', reason })}
      />
      <ShareEventModal
        event={event ? {
          ...event,
          title: event?.title || event?.name || event?.type?.name || 'Événement FoundClub',
        } : null}
        isVisible={isShareModalVisible}
        onClose={() => setIsShareModalVisible(false)}
        onSelectChat={handleShareEventInChat}
      />

      <TrainingOpenBottomSheet
        Alignments={Alignments}
        ApplicationStyle={ApplicationStyle}
        Colors={Colors}
        Fonts={Fonts}
        initialLimit={trainingOpenConfig.externalParticipantLimit}
        initialValidationMode={trainingOpenConfig.externalParticipantValidationMode}
        isSubmitting={mutations.updateEventNoNavMutation.isPending}
        isVisible={isTrainingOpenModalVisible}
        onClose={() => setIsTrainingOpenModalVisible(false)}
        onSubmit={handleSubmitTrainingOpenConfig}
        Spaces={Spaces}
      />

      <BottomModal
        close={() => setIsSubscriptionFollowUpVisible(false)}
        isVisible={isSubscriptionFollowUpVisible}
        snapPoints={['70%']}
      >
        <View style={[Spaces.gap[16], Spaces.paddingBottom[12]]}>
          <View style={[Spaces.gap[4]]}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>
              Bravo, ton événement est en ligne
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {remainingEventPublishQuota > 0
                ? `Ton credit gratuit événement a bien été utilise. Il t en reste ${remainingEventPublishQuota}${totalEventPublishQuota > 0 ? `/${totalEventPublishQuota}` : ''}.`
                : 'Ton credit gratuit événement a bien été utilise. Les prochaines publications passeront par une offre Team ou Club.'}
            </Text>
          </View>

          <View
            style={[
              ApplicationStyle.backgroundColor.primary900,
              ApplicationStyle.borderRadius24,
              ApplicationStyle.borderWidth1,
              Spaces.padding[16],
              Spaces.gap[8],
              {
                borderColor: `${Colors.primary500}44`,
              },
            ]}
          >
            <Text style={[Fonts.p3Bold, Fonts.primary500]}>
              Suite logique
            </Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              Consulte ton abonnement pour voir les offres FoundClub, tes quotas restants et les droits qui se debloquent ensuite.
            </Text>
          </View>

          <Button
            onPress={handleOpenSubscriptionOverview}
            title="Voir mon abonnement"
            variant="Primary"
          />
          <Button
            onPress={() => setIsSubscriptionFollowUpVisible(false)}
            title="Continuer"
            variant="Secondary"
          />
        </View>
      </BottomModal>

      <BottomModal
        close={closeTournamentParticipationFlow}
        isVisible={isTournamentParticipationModalVisible}
        snapPoints={['42%']}
      >
        <View style={[Spaces.gap[16], Spaces.paddingBottom[12]]}>
          <View style={tournamentDs.styles.headerBlock}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Participer au tournoi</Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              Choisis si tu créés ton équipe éphémère ou si tu rejoins une équipe déjà inscrite.
            </Text>
          </View>

          {canCreateCustomTournamentTeam ? (
            <Button
              onPress={() => {
                setIsTournamentParticipationModalVisible(false);
                setIsTournamentCreateModalVisible(true);
              }}
              title="Créer une équipe pour le tournoi"
              variant="Primary"
            />
          ) : null}

          <Button
            disabled={joinableTournamentTeams.length === 0}
            onPress={() => {
              setIsTournamentParticipationModalVisible(false);
              setIsTournamentJoinSelectorVisible(true);
            }}
            title="Rejoindre une équipe existante"
            variant="Secondary"
          />

          {joinableTournamentTeams.length === 0 ? (
            <Text style={[Fonts.p3, Fonts.neutral200]}>
              Aucune équipe ouverte aux demandes n est disponible pour le moment.
            </Text>
          ) : null}
        </View>
      </BottomModal>

      <BottomModal
        close={() => {
          setIsTournamentJoinSelectorVisible(false);
          setPendingTournamentAction(null);
        }}
        isVisible={isTournamentJoinSelectorVisible}
        snapPoints={['62%']}
      >
        <View style={[Spaces.gap[16], Spaces.paddingBottom[12]]}>
          <View style={tournamentDs.styles.headerBlock}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Équipes ouvertes</Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              Sélectionne une équipe tournoi qui accepte actuellement de nouvelles demandes.
            </Text>
          </View>

          {joinableTournamentTeams.length === 0 ? (
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              Aucune équipe tournoi n accepte de nouvelles demandes pour le moment.
            </Text>
          ) : (
            joinableTournamentTeams.map((team) => {
              const rosterSummary = getTournamentRosterSummary(team, tournamentConfig);
              return (
                <TouchableOpacity
                  key={team?.documentId}
                  onPress={() => handleSelectExistingTournamentTeam(team)}
                  style={tournamentDs.styles.compactPanelCard}
                >
                  <View style={[Alignments.row, Alignments.justifySpaceBetween, Alignments.alignCenter, Spaces.gap[12]]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{team?.name || 'Équipe tournoi'}</Text>
                      <Text style={[Fonts.p4, Fonts.primary100]}>
                        {`${rosterSummary.totalCount || 0} membre(s) - demandes ouvertes`}
                      </Text>
                    </View>
                    <Tag
                      style={tournamentDs.getToneTagStyle(Colors.primary500)}
                      text="Rejoindre"
                      textColor="primary500"
                    />
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </BottomModal>

      <BottomModal
        close={() => setIsTournamentRegisterModalVisible(false)}
        isVisible={isTournamentRegisterModalVisible}
        snapPoints={['52%']}
      >
        <View style={[Spaces.gap[16], Spaces.paddingBottom[12]]}>
          <View style={tournamentDs.styles.headerBlock}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Inscrire mon équipe</Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              Sélectionne une équipe club. L application creera une équipe éphémère de tournoi sans toucher à ton effectif permanent.
            </Text>
          </View>

          {availableTournamentSourceTeams.length === 0 ? (
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              Aucune équipe club disponible à inscrire.
            </Text>
          ) : (
            // @ts-ignore: FIXME: Baseline TS regression
            availableTournamentSourceTeams.map((sourceTeam) => (
              <TouchableOpacity
                key={sourceTeam?.documentId}
                // @ts-ignore: FIXME: Baseline TS regression
                onPress={() => registerTournamentTeamMutation.mutate({ sourceTeamId: sourceTeam.documentId })}
                style={[
                  ...tournamentDs.styles.compactPanelCard,
                  {
                    opacity: registerTournamentTeamMutation.isPending ? 0.7 : 1,
                  },
                ]}
              >
                <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{sourceTeam?.name || 'Equipe'}</Text>
                <Text style={[Fonts.p4, Fonts.primary100]}>
                  {[
                    sourceTeam?.section?.name,
                    sourceTeam?.category?.name || sourceTeam?.category,
                    sourceTeam?.level?.name || sourceTeam?.level,
                  ].filter(Boolean).join(' - ')}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </View>
      </BottomModal>

      <BottomModal
        close={() => setIsTournamentCreateModalVisible(false)}
        isVisible={isTournamentCreateModalVisible}
        snapPoints={['44%']}
      >
        <View style={[Spaces.gap[16], Spaces.paddingBottom[12]]}>
          <View style={tournamentDs.styles.headerBlock}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Créer une équipe</Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              Cette équipe n existera que pour ce tournoi. Tu en deviendras automatiquement le capitaine.
            </Text>
          </View>

          <TextInput
            onChangeText={setTournamentTeamNameDraft}
            placeholder="Nom de l équipe"
            placeholderTextColor={Colors.neutral300}
            style={[
              ...tournamentDs.styles.input,
              Fonts.neutral00,
            ]}
            value={tournamentTeamNameDraft}
          />

          <View style={[Spaces.gap[12]]}>
            <Button
              disabled={createTournamentTeamMutation.isPending}
              onPress={handleCreateTournamentTeam}
              title="Créer mon équipe"
              variant="Primary"
            />
            <Button
              onPress={() => setIsTournamentCreateModalVisible(false)}
              title="Annuler"
              variant="Secondary"
            />
          </View>
        </View>
      </BottomModal>

      <BottomModal
        close={dismissMatchStatsPrompt}
        isVisible={isMatchStatsPromptVisible}
        snapPoints={['42%']}
      >
        <View style={[Spaces.gap[16], Spaces.paddingBottom[12]]}>
          <View style={[Spaces.gap[4]]}>
            <Text style={[Fonts.h3Bold, Fonts.neutral00]}>Stats de fin de match</Text>
            <Text style={[Fonts.p2, Fonts.neutral100]}>
              {matchStatsPromptMessage}
            </Text>
          </View>

          <View
            style={[
              ApplicationStyle.backgroundColor.primary900,
              { borderRadius: 20 },
              Spaces.padding[16],
              Spaces.gap[8],
            ]}
          >
            <Text style={[Fonts.p3, Fonts.neutral300]}>Match</Text>
            <Text style={[Fonts.p2Bold, Fonts.neutral00]}>{compositionEventLabel}</Text>
            <Text style={[Fonts.p3, Fonts.primary100]}>
              {compositionEditorTeam?.name || matchStatsPayload?.team?.name || 'Equipe'}
            </Text>
          </View>

          <Button
            onPress={() => {
              dismissMatchStatsPrompt();
              openMatchStatsEditor();
            }}
            title={matchStatsPrimaryAction.title}
            variant="Primary"
          />
          <Button
            onPress={dismissMatchStatsPrompt}
            title="Plus tard"
            variant="Secondary"
          />
        </View>
      </BottomModal>

      <Modal
        onRequestClose={() => setIsFeaturedModalVisible(false)}
        transparent
        visible={isFeaturedModalVisible}
      >
        <TouchableOpacity
          onPress={() => setIsFeaturedModalVisible(false)}
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', flex: 1, justifyContent: 'flex-end' }}
        >
          <TouchableOpacity activeOpacity={1} style={[ApplicationStyle.backgroundColor.primary700, { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }]}>
            <View style={[Spaces.gap[16]]}>
              <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
                Mettre à la une
              </Text>
              <Text style={[Fonts.p2, Fonts.neutral200]}>
                Choisis ou tu souhaites mettre cet événement en avant.
              </Text>
              {featuredScopeOptions.map((option) => {
                const isDisabled = option.status === 'pending' || option.status === 'approved';
                // @ts-ignore: FIXME: Baseline TS regression
                const isSelected = Boolean(selectedFeaturedScopes[option.kind]);
                const statusLabel = getFeaturedScopeStatusLabel(option.status);

                return (
                  <View
                    key={option.kind}
                    style={[
                      ApplicationStyle.borderRadius16,
                      ApplicationStyle.borderWidth1,
                      Spaces.padding[16],
                      Spaces.gap[8],
                      {
                        borderColor: `${Colors.primary500}55`,
                        opacity: isDisabled ? 0.7 : 1,
                      },
                    ]}
                  >
                    <View style={[Alignments.row, Alignments.alignCenter, Spaces.gap[12]]}>
                      <Checkbox
                        disabled={isDisabled}
                        onValueChange={() => toggleFeaturedScope(option.kind)}
                        value={isSelected}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[Fonts.p2Bold, Fonts.neutral00]}>
                          {option.label}
                        </Text>
                        <Text style={[Fonts.p3, Fonts.neutral200]}>
                          {statusLabel}
                        </Text>
                        {option.summary?.targetName ? (
                          <Text style={[Fonts.p4, Fonts.primary100]}>
                            {option.summary.targetName}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                  </View>
                );
              })}

              <View style={[Spaces.gap[12]]}>
                <Button
                  disabled={!selectedFeaturedScopeKinds.length || mutations.requestFeaturedMutation.isPending}
                  onPress={handleSubmitFeaturedScopes}
                  title="Envoyer la demande"
                  variant="Primary"
                />
                <Button
                  onPress={() => setIsFeaturedModalVisible(false)}
                  title="Annuler"
                  variant="Secondary"
                />
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <Modal
        animationType="fade"
        onRequestClose={closeLateModal}
        statusBarTranslucent
        transparent
        visible={isLateModalVisible}
      >
        <View style={[Alignments.fill, { backgroundColor: 'rgba(0,0,0,0.65)' }]}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={closeLateModal}
            style={Alignments.fill}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
              style={[Alignments.fill, Alignments.justifyCenter, Spaces.paddingHorizontal[24]]}
            >
              <TouchableOpacity activeOpacity={1} onPress={() => null}>
                <View
                  style={[
                    ApplicationStyle.backgroundColor.primary700,
                    ApplicationStyle.borderRadius24,
                    ApplicationStyle.borderWidth1,
                    ApplicationStyle.borderColor.neutral700,
                    Spaces.padding[24],
                    Spaces.gap[16],
                  ]}
                >
                  <View style={[Spaces.gap[4]]}>
                    <Text style={[Fonts.h4Bold, Fonts.neutral00]}>
                      {lateModalTitle}
                    </Text>
                    <Text style={[Fonts.p2, Fonts.neutral200]}>
                      {lateModalDescription}
                    </Text>
                  </View>

                  <View
                    style={[
                      ApplicationStyle.card,
                      ApplicationStyle.borderRadius12,
                      ApplicationStyle.backgroundColor.neutral800,
                      Spaces.padding[12],
                      Spaces.gap[4],
                    ]}
                  >
                    <Text style={[Fonts.p3, Fonts.neutral300]}>
                      {isPlayerLateModal ? 'Participant' : t('eventDetails.late.playerLabel', 'Joueur')}
                    </Text>
                    <Text style={[Fonts.p1Bold, Fonts.neutral00]}>
                      {lateModalUser
                        ? `${lateModalUser.firstname || ''} ${lateModalUser.lastname || ''}`.trim()
                        : '-'}
                    </Text>
                  </View>

                  <View style={[Spaces.gap[8]]}>
                    <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                      {t('eventDetails.late.minutesLabel', 'Minutes de retard')}
                    </Text>
                    <View style={[Alignments.row, Spaces.gap[8]]}>
                      {[5, 10, 15].map((preset) => (
                        <Button
                          key={`late-preset-${preset}`}
                          onPress={() => handleSetLatePreset(preset)}
                          size="sm"
                          title={`+${preset}`}
                          variant="SecondaryLight"
                        />
                      ))}
                    </View>
                    <TextInput
                      keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
                      maxLength={3}
                      onChangeText={(value) => setLateModalMinutes(value.replace(/[^0-9]/g, ''))}
                      placeholder="0"
                      placeholderTextColor={Colors.neutral400}
                      selectionColor={Colors.primary500}
                      style={[
                        ApplicationStyle.input,
                        ApplicationStyle.backgroundColor.neutral800,
                        ApplicationStyle.borderColor.neutral600,
                        Fonts.p1Bold,
                        Fonts.neutral00,
                      ]}
                      value={lateModalMinutes}
                    />
                    <Text style={[Fonts.p3, Fonts.neutral300]}>
                      {isPlayerLateModal
                        ? 'Annonce le retard estime. Tu confirmeras ensuite ton arrivée réelle.'
                        : t('eventDetails.late.helper', '0 = a l\'heure. Ajuste la valeur si nécessaire avant validation.')}
                    </Text>
                  </View>

                  {isCoachLateModal ? (
                    <View style={[Spaces.gap[8]]}>
                      <Text style={[Fonts.p3Bold, Fonts.neutral00]}>
                        Note staff
                      </Text>
                      <TextInput
                        multiline
                        onChangeText={setLateModalNote}
                        placeholder="Facultatif"
                        placeholderTextColor={Colors.neutral400}
                        selectionColor={Colors.primary500}
                        style={[
                          ApplicationStyle.input,
                          ApplicationStyle.backgroundColor.neutral800,
                          ApplicationStyle.borderColor.neutral600,
                          Fonts.p2,
                          Fonts.neutral00,
                          { minHeight: 88, textAlignVertical: 'top' },
                        ]}
                        value={lateModalNote}
                      />
                    </View>
                  ) : null}

                  {canResetLateModal ? (
                    <Button
                      disabled={isLateModalLoading}
                      onPress={handleResetLateModal}
                      title="Réinitialiser le pointage"
                      variant="Secondary"
                    />
                  ) : null}

                  <View style={[Alignments.row, Spaces.gap[12], Spaces.marginTop[8]]}>
                    <Button
                      onPress={closeLateModal}
                      style={{ flex: 1 }}
                      title={t('common.cancel', 'Annuler')}
                      variant="Secondary"
                    />
                    <Button
                      disabled={isLateModalLoading || lateModalMinutes.trim() === ''}
                      isLoading={isLateModalLoading}
                      onPress={handleSaveLateModal}
                      style={{ flex: 1 }}
                      title={lateModalPrimaryActionTitle}
                      variant="Primary"
                    />
                  </View>
                </View>
              </TouchableOpacity>
            </KeyboardAvoidingView>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScreenContainer>
  );
}

export default EventDetails;
