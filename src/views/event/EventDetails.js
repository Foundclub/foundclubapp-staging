import { useFocusEffect } from '@react-navigation/native';
import {
  useCallback, useEffect, useLayoutEffect, useMemo, useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { USER_ROLES } from '@/domains/auth/authUseCases';
import useAuth from '@/domains/auth/useAuth';
import useMessaging from '@/domains/messaging/useMessaging';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import Tag from '@/components/atoms/tag/Tag';
import EventAnswerButtons from '@/components/molecules/eventAnswerButtons/EventAnswerButtons';
import WithDataWrapper from '@/components/molecules/withDataWrapper/WithDataWrapper';
import JoinEventModal from '@/components/organisms/joinEventModal/JoinEventModal';
import RefuseParticipationModal from '@/components/organisms/refuseParticipationModal/RefuseParticipationModal';
import ReportEventModal from '@/components/organisms/reportEventModal/ReportEventModal';
import ShareEventModal from '@/components/organisms/shareEventModal/ShareEventModal';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { useGetEvent, useGetEventAttendance } from '@/services/event/eventQueries';
import { exportEventParticipants } from '@/services/event/eventService';
import { useGetEventParticipations } from '@/services/eventParticipation/eventParticipationQueries';

import EventHeader from './components/EventHeader';
import EventParticipants from './components/EventParticipants';
import EventReservationActions from './components/EventReservationActions';
import { resolveEventAttendanceGate } from './eventAttendanceGate';
import { useEventMutations } from './hooks/useEventMutations';

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
 * @param {{ navigation: import('@react-navigation/native').NavigationProp<any>; route: { params?: { eventId?: string, fromEventCreation?: boolean } } }} props
 */
function EventDetails({ navigation, route }) {
  const { eventId } = route?.params ?? {};
  const fromEventCreation = Boolean(route?.params?.fromEventCreation);

  const [isJoinModalVisible, setIsJoinModalVisible] = useState(false);
  const [isRefuseModalVisible, setIsRefuseModalVisible] = useState(false);
  const [isReportModalVisible, setIsReportModalVisible] = useState(false);
  const [isFeaturedModalVisible, setIsFeaturedModalVisible] = useState(false);
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [selectedParticipationId, setSelectedParticipationId] = useState('');

  const [isLateModalVisible, setIsLateModalVisible] = useState(false);
  const [lateModalMode, setLateModalMode] = useState(/** @type {'mark' | 'edit'} */ ('mark'));
  const [lateModalUser, setLateModalUser] = useState(/** @type {User | null} */ (null));
  const [lateModalMinutes, setLateModalMinutes] = useState('0');
  const [lateModalArrivedAt, setLateModalArrivedAt] = useState(/** @type {string | null} */ (null));
  const [elapsedSinceServerNowMs, setElapsedSinceServerNowMs] = useState(0);
  const [selfArrivalMarkedLocal, setSelfArrivalMarkedLocal] = useState(false);

  const {
    Alignments, ApplicationStyle, Colors, Fonts, Spaces,
  } = useTheme();
  const { t } = useTranslation();
  const { canEditEvent, canManageEvent, userData } = useAuth();
  const { sendMessage } = useMessaging();

  const {
    data: event, error, isLoading, refetch,
  } = useGetEvent(eventId || '');
  const canEdit = Boolean(canManageEvent(event));
  const canApprovePendingRequests = Boolean(canEditEvent(event?.team?.documentId || ''));

  const isTeamMember = useMemo(() => {
    const userDocId = userData?.documentId;
    if (!userDocId) return false;
    const teams = [event?.team, ...(event?.invitedTeams || [])].filter(Boolean);
    const players = teams.flatMap((team) => team?.players || []);
    const trainers = teams.flatMap((team) => team?.trainers || []);
    return players.some((player) => player?.documentId === userDocId)
      || trainers.some((trainer) => trainer?.documentId === userDocId);
  }, [event?.invitedTeams, event?.team, userData?.documentId]);

  const isCurrentUserParticipating = useMemo(() => {
    const currentUserId = userData?.documentId;
    if (!currentUserId) return false;
    return (event?.participations || []).some(
      (/** @type {User} */ participant) => participant?.documentId === currentUserId,
    );
  }, [event?.participations, userData?.documentId]);

  const { canAccessAttendance, canSelfMarkArrival } = useMemo(
    () => resolveEventAttendanceGate({
      canEdit,
      isCurrentUserParticipating,
      isTeamMember,
    }),
    [canEdit, isCurrentUserParticipating, isTeamMember],
  );

  const { data: attendancePayload, refetch: refetchAttendance } = useGetEventAttendance(
    eventId || '',
    { enabled: Boolean(eventId && canAccessAttendance) },
  );

  const eventStartAt = useMemo(() => {
    const backendStart = attendancePayload?.data?.eventStartAt;
    if (backendStart) {
      const parsed = new Date(backendStart);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return resolveEventStartAt(event);
  }, [attendancePayload?.data?.eventStartAt, event]);

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
    fetchNextPage: fetchNextParticipationsPage,
    hasNextPage: hasNextParticipationsPage,
    isFetchingNextPage: isFetchingNextParticipationsPage,
    refetch: refetchParticipations,
  } = useGetEventParticipations(eventId || '', undefined, {
    includeInactive: true,
    pageSize: 100,
  });

  useEffect(() => {
    if (!hasNextParticipationsPage || isFetchingNextParticipationsPage) return;
    fetchNextParticipationsPage();
  }, [
    fetchNextParticipationsPage,
    hasNextParticipationsPage,
    isFetchingNextParticipationsPage,
  ]);

  const mutations = useEventMutations(eventId, refetch, refetchParticipations);

  const attendanceByUserId = useMemo(() => {
    const items = /** @type {any[]} */ (attendancePayload?.data?.items || []);
    /** @type {Record<string, { arrivedAt?: string | null, lateMinutes?: number | null, source?: string | null, manualOverride?: boolean }>} */
    const map = {};
    items.forEach((item) => {
      const userDocId = item?.user?.documentId;
      if (!userDocId) return;
      map[userDocId] = {
        arrivedAt: item?.attendance?.arrivedAt || null,
        lateMinutes: item?.attendance?.lateMinutes || 0,
        manualOverride: Boolean(item?.attendance?.manualOverride),
        source: item?.attendance?.source || null,
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

  const selfArrivalTiming = useMemo(() => {
    if (!canSelfMarkArrival || !eventStartAt) {
      return { isLate: false, message: '' };
    }

    if (myAttendance?.arrivedAt) {
      const eventStartMs = eventStartAt.getTime();
      const arrivedAtMs = new Date(myAttendance.arrivedAt).getTime();
      const hasValidArrival = !Number.isNaN(arrivedAtMs);

      if (hasValidArrival && arrivedAtMs < eventStartMs) {
        const earlyMinutes = Math.max(1, Math.ceil((eventStartMs - arrivedAtMs) / 60000));
        return {
          isLate: false,
          message: `Arrivee enregistree: ${earlyMinutes} min en avance.`,
        };
      }

      const lateMinutesFromRecord = Math.max(0, Number(myAttendance.lateMinutes || 0));
      const lateMinutesFromDiff = hasValidArrival && arrivedAtMs > eventStartMs
        ? Math.max(1, Math.ceil((arrivedAtMs - eventStartMs) / 60000))
        : 0;
      const lateMinutes = Math.max(lateMinutesFromRecord, lateMinutesFromDiff);
      if (lateMinutes > 0) {
        return {
          isLate: true,
          message: `Arrivee enregistree: +${lateMinutes} min de retard.`,
        };
      }

      return {
        isLate: false,
        message: 'Arrivee enregistree a l heure.',
      };
    }

    const diffMs = eventStartAt.getTime() - serverNowMs;
    if (diffMs > 0) {
      const minutesLeft = Math.max(1, Math.ceil(diffMs / 60000));
      return {
        isLate: false,
        message: `Il vous reste ${minutesLeft} min pour ne pas etre en retard.`,
      };
    }

    const lateMinutes = Math.max(1, Math.ceil(Math.abs(diffMs) / 60000));
    return {
      isLate: true,
      message: `Vous avez ${lateMinutes} min de retard.`,
    };
  }, [
    canSelfMarkArrival,
    eventStartAt,
    myAttendance?.arrivedAt,
    myAttendance?.lateMinutes,
    serverNowMs,
  ]);

  const allEventParticipations = useMemo(() => {
    const pages = /** @type {any[]} */ (eventParticipations?.pages || []);
    /** @type {Map<string, EventParticipation>} */
    const deduped = new Map();
    pages.forEach((page) => {
      (page?.data || []).forEach((/** @type {EventParticipation} */ participation) => {
        const key = participation?.documentId
          || `${getUserKey(participation?.user) || 'user'}:${participation?.participationStatus || 'status'}:${participation?.updatedAt || ''}:${participation?.isActive === false ? 'inactive' : 'active'}`;
        if (!key || deduped.has(key)) return;
        deduped.set(key, participation);
      });
    });
    return /** @type {EventParticipation[]} */ (Array.from(deduped.values()));
  }, [eventParticipations?.pages]);

  const activeEventParticipations = useMemo(
    () => allEventParticipations.filter((participation) => participation?.isActive !== false),
    [allEventParticipations],
  );

  const hasPendingRequest = useMemo(() => activeEventParticipations.some(
    (participation) => participation.participationStatus === 'pending'
      && participation.user.documentId === userData?.documentId,
  ), [activeEventParticipations, userData?.documentId]);

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
        players: uniqueUsers(event.team.players || []),
        teamName: event.team.name || 'Equipe organisatrice',
      } : null,
      ...((event?.invitedTeams || []).map((/** @type {any} */ team) => ({
        isHome: false,
        key: team?.documentId || `invited-${team?.name || 'team'}`,
        players: uniqueUsers(team?.players || []),
        teamName: team?.name || 'Equipe invitee',
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

    const participatingUsers = event?.participations || [];
    const missingUsers = event?.missings || [];
    const participatingKeys = new Set(participatingUsers.map((/** @type {User} */ participant) => getUserKey(participant)).filter(Boolean));
    const missingKeys = new Set(missingUsers.map((/** @type {User} */ missing) => getUserKey(missing)).filter(Boolean));

    const pendingByUserKey = new Map();
    pendingParticipations.forEach((participation) => {
      const key = getUserKey(participation?.user);
      if (!key) return;
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
        const teamName = resolvedTeamName || 'Equipe retiree';
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
  }, [canEdit, event, inactiveEventParticipations, pendingParticipations]);

  const participationsByStatus = useMemo(() => {
    if (!canEdit) {
      return { missing: [], notAnswered: [], participating: event?.participations || [] };
    }

    const teamPlayers = uniqueUsers([
      ...(event?.team?.players || []),
      ...((event?.invitedTeams || []).flatMap((/** @type {any} */ team) => team?.players || [])),
    ]);
    const participatingPlayers = event?.participations || [];
    const missingPlayers = event?.missings || [];
    const pendingKeys = new Set((pendingParticipations || []).map((participation) => getUserKey(participation?.user)).filter(Boolean));

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
  }, [canEdit, event, pendingParticipations]);

  const canRequestFeatured = useMemo(() => {
    const hasParentMultisport = Boolean(event?.team?.club?.parentMultisport);
    const isNotAlreadyFeatured = !event?.isFeatured;
    const isNotPending = event?.featuredRequestStatus !== 'pending';
    const isNotApproved = event?.featuredRequestStatus !== 'approved';
    return hasParentMultisport && isNotAlreadyFeatured && isNotPending && isNotApproved && canEdit;
  }, [canEdit, event?.featuredRequestStatus, event?.isFeatured, event?.team?.club?.parentMultisport]);

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

  const handleJoinEvent = () => setIsJoinModalVisible(true);

  const handleParticipateToEvent = (/** @type {any} */ eventToJoin) => {
    if (!eventToJoin?.documentId || !userData?.documentId) return;
    mutations.createEventParticipationMutation.mutate({
      event: eventToJoin.documentId,
      user: userData.documentId,
    });
    setIsJoinModalVisible(false);
  };

  const handleDeclineEvent = (/** @type {any} */ eventToDecline) => {
    if (!eventToDecline?.documentId) return;
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
        { onPress: () => setSelectedParticipationId(''), style: 'cancel', text: t('common.cancel') },
        {
          onPress: () => {
            mutations.acceptParticipationMutation.mutate(participationId);
            setSelectedParticipationId('');
          },
          text: t('common.confirm'),
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
    const myParticipation = activeEventParticipations.find(
      (participation) => participation.user.documentId === userData?.documentId,
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

    if (event?.missings?.some((/** @type {User} */ missing) => missing.documentId === userData?.documentId)) {
      Alert.alert(
        t('eventDetails.modals.editResponse.title'),
        t('eventDetails.modals.editResponse.description'),
        [
          { style: 'cancel', text: t('common.cancel') },
          { onPress: () => handleParticipateToEvent(event), text: t('common.confirm') },
        ],
      );
    }
  }, [activeEventParticipations, event, mutations, t, userData?.documentId]);

  const handleExportParticipants = useCallback(async () => {
    if (!eventId) return;
    Alert.alert(t('common.loading'), t('eventDetails.exporting'));
    try {
      const path = await exportEventParticipants(eventId, event?.name || 'participants');
      if (Platform.OS === 'ios') {
        setTimeout(() => Share.share({ title: 'Participants', url: path }), 500);
      } else {
        const ReactNativeBlobUtil = require('react-native-blob-util').default;
        ReactNativeBlobUtil.android
          .actionViewIntent(path, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
          .catch(() => Alert.alert(t('common.success'), t('eventDetails.exportSuccess')));
      }
    } catch (exportError) {
      Alert.alert(t('common.error'), t('eventDetails.exportError'));
    }
  }, [event?.name, eventId, t]);

  const handleCancelEvent = () => {
    if (!eventId) return;
    if (event?.recurrenceGroupId) {
      Alert.alert(t('eventDetails.modals.recurrenceCancel.title'), t('eventDetails.modals.recurrenceCancel.description'), [
        { style: 'cancel', text: t('common.cancel') },
        { onPress: () => mutations.cancelEventMutation.mutate({ documentId: eventId }), style: 'destructive', text: t('this') },
        { onPress: () => mutations.cancelEventMutation.mutate({ documentId: eventId, recurrenceMode: 'future' }), style: 'destructive', text: t('future') },
        { onPress: () => mutations.cancelEventMutation.mutate({ documentId: eventId, recurrenceMode: 'all' }), style: 'destructive', text: t('all') },
      ]);
      return;
    }

    Alert.alert(t('title'), t('desc'), [
      { style: 'cancel', text: t('cancel') },
      { onPress: () => mutations.cancelEventMutation.mutate({ documentId: eventId }), style: 'destructive', text: t('confirm') },
    ]);
  };

  const openCoachLateModal = useCallback((/** @type {User | null | undefined} */ targetUser, /** @type {'mark' | 'edit'} */ mode) => {
    if (!targetUser?.documentId) return;

    const nowIso = new Date(serverNowMs).toISOString();
    const existing = attendanceByUserId[targetUser.documentId];
    const defaultArrival = existing?.arrivedAt || nowIso;
    const defaultMinutes = mode === 'edit'
      ? Number(existing?.lateMinutes || 0)
      : computeLateMinutes(nowIso);

    setLateModalMode(mode);
    setLateModalUser(targetUser);
    setLateModalArrivedAt(defaultArrival);
    setLateModalMinutes(String(Math.max(0, defaultMinutes)));
    setIsLateModalVisible(true);
  }, [attendanceByUserId, computeLateMinutes, serverNowMs]);

  const closeLateModal = useCallback(() => {
    setIsLateModalVisible(false);
    setLateModalMode('mark');
    setLateModalUser(null);
    setLateModalMinutes('0');
    setLateModalArrivedAt(null);
  }, []);

  const handleCoachMarkArrival = useCallback((/** @type {User | null | undefined} */ targetUser) => {
    openCoachLateModal(targetUser, 'mark');
  }, [openCoachLateModal]);

  const handleCoachEditLate = useCallback((/** @type {User | null | undefined} */ targetUser) => {
    openCoachLateModal(targetUser, 'edit');
  }, [openCoachLateModal]);

  const handleSaveLateModal = useCallback(() => {
    if (!eventId || !lateModalUser?.documentId) return;

    const parsedMinutes = Number(lateModalMinutes);
    if (!Number.isFinite(parsedMinutes) || parsedMinutes < 0) {
      Alert.alert(t('common.error'), t('eventDetails.late.minutesInvalid', 'Le retard doit etre un nombre positif.'));
      return;
    }

    const payload = {
      arrivedAt: lateModalArrivedAt || new Date().toISOString(),
      lateMinutes: Math.floor(parsedMinutes),
    };

    if (lateModalMode === 'mark') {
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
    lateModalUser?.documentId,
    mutations.coachArrivalMutation,
    mutations.updateLateMinutesMutation,
    t,
  ]);

  const handleSelfArrival = useCallback(() => {
    if (!eventId) {
      Alert.alert(t('common.error'), "Impossible d'enregistrer votre arrivée (événement introuvable).");
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

          let message = t('eventDetails.late.selfOnTime', 'Arrivee enregistree a l heure.');

          if (hasValidTimestamps && eventStartMs && arrivedAtMs < eventStartMs) {
            const earlyMinutes = Math.max(1, Math.ceil((eventStartMs - arrivedAtMs) / 60000));
            message = t('eventDetails.late.selfEarly', `Bravo ! Vous etes en avance de ${earlyMinutes} min.`);
          } else {
            const lateMinutesFromDiff = hasValidTimestamps && eventStartMs && arrivedAtMs > eventStartMs
              ? Math.max(1, Math.ceil((arrivedAtMs - eventStartMs) / 60000))
              : 0;
            const lateMinutes = Math.max(lateMinutesFromResponse, lateMinutesFromDiff);
            if (lateMinutes > 0) {
              message = t('eventDetails.late.selfLate', `Arrivee enregistree: ${lateMinutes} min de retard.`);
            }
          }

          Alert.alert(t('common.success'), message);
        },
      },
    );
  }, [eventId, eventStartAt, hasSelfArrived, mutations.selfArrivalMutation, t]);

  const renderActionButtons = () => {
    const isReservation = event?.type?.name?.toLowerCase()?.includes('reservation')
      || event?.type?.name?.toLowerCase()?.includes('réservation');

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
            <View style={[Alignments.row, Spaces.gap[12], Spaces.marginTop[12]]}>
              <Button icon="edit" isOption onPress={handleEditEvent} style={{ flex: 1 }} title="Modifier" variant="Secondary" />
              <Button icon="close" isOption onPress={handleCancelEvent} style={{ flex: 1 }} title="Annuler" variant="Secondary" />
            </View>
          )}
        </View>
      );
    }

    return (
      <View>
        <EventAnswerButtons
          event={event}
          hasPendingRequest={hasPendingRequest}
          onCancel={canEdit ? handleCancelEvent : undefined}
          onDecline={() => handleDeclineEvent(event)}
          onDeleteParticipation={handleDeleteParticipation}
          onEdit={canEdit ? handleEditEvent : undefined}
          onJoin={handleJoinEvent}
          onLogin={() => navigation.navigate(RouteNames.HomeTab, { screen: RouteNames.AuthStackAccount })}
          onParticipate={() => handleParticipateToEvent(event)}
        />
        {canEdit && canRequestFeatured && (
          <View style={{ marginTop: 12 }}>
            <Button icon="bell" onPress={() => setIsFeaturedModalVisible(true)} title="Mettre a la une" variant="Secondary" />
          </View>
        )}
        {event?.featuredRequestStatus === 'pending' && (
          <View style={{ marginTop: 12, opacity: 0.7 }}>
            <Button disabled icon="clock" title="Demande en attente" variant="Secondary" />
          </View>
        )}
      </View>
    );
  };

  useFocusEffect(
    useCallback(() => {
      refetch();
      refetchParticipations();
      if (canAccessAttendance) {
        refetchAttendance();
      }
    }, [canAccessAttendance, refetch, refetchAttendance, refetchParticipations]),
  );

  useLayoutEffect(() => {
    const options = {
      headerLeft: fromEventCreation
        ? () => (
          <HeaderBackButton onPress={handleBackAfterCreation} />
        )
        : undefined,
      headerRight: () => (
        <Button
          icon="flag"
          isOption
          onPress={() => setIsReportModalVisible(true)}
          style={Spaces.marginRight[16]}
          variant="Secondary"
        />
      ),
    };

    navigation.setOptions(options);
  }, [Spaces.marginRight, fromEventCreation, handleBackAfterCreation, navigation]);

  const isLateModalLoading = mutations.coachArrivalMutation.isPending
    || mutations.updateLateMinutesMutation.isPending;

  return (
    <ScreenContainer bgImage="bg2" contentContainerStyle={[Spaces.paddingBottom[32], Spaces.gap[32], Alignments.fill]} gradient={null} withHeaderPadding>
      <View style={[Spaces.gap[8], Alignments.alignCenter]}>
        <Tag style={{}} text={event?.type?.name?.toUpperCase() || ''} textStyle={Fonts.p2} />
      </View>

      <ScrollView
        contentContainerStyle={[Spaces.gap[32], Spaces.paddingBottom[40]]}
        refreshControl={(
          <RefreshControl
            onRefresh={() => {
              refetch();
              refetchParticipations();
              if (canAccessAttendance) refetchAttendance();
            }}
            refreshing={isLoading}
          />
        )}
        showsVerticalScrollIndicator={false}
      >
        <WithDataWrapper error={error?.message} isLoading={isLoading} wrapperStyle={[Alignments.fill, Spaces.gap[24]]}>
          <EventHeader event={event} />

          {event?.description && (
            <View style={[Spaces.gap[16]]}>
              <Text style={[Fonts.h3Bold, Fonts.neutral00]}>{t('eventDetails.fields.description')}</Text>
              <Text style={[Fonts.p1, Fonts.primary100]}>{event.description}</Text>
            </View>
          )}

          <EventParticipants
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
        </WithDataWrapper>
      </ScrollView>

      <View style={[Spaces.gap[16], Spaces.marginBottom[16]]}>
        {canSelfMarkArrival && selfArrivalTiming.message ? (
          <Text
            style={[
              Fonts.p2,
              Fonts.textCenter,
              selfArrivalTiming.isLate
                ? { color: Colors.error500 || '#f87171' }
                : Fonts.primary100,
            ]}
          >
            {selfArrivalTiming.message}
          </Text>
        ) : null}
        {canSelfMarkArrival && (
          <Button
            disabled={mutations.selfArrivalMutation.isPending}
            icon="check"
            isLoading={mutations.selfArrivalMutation.isPending}
            onPress={handleSelfArrival}
            title={hasSelfArrived
              ? t('eventDetails.actions.selfArrivalDone', 'Arrivee enregistree')
              : t('eventDetails.actions.selfArrival', 'Je suis arrive')}
            variant="SecondaryLight"
          />
        )}
        {userData?.role?.name === USER_ROLES.superAdmin && event?.featuredRequestStatus === 'pending'
          ? (
            <View style={[Alignments.row, Spaces.gap[16]]}>
              <Button
                icon="check"
                isOption
                onPress={() => /** @type {any} */ (mutations.updateEventMutation).mutate({ documentId: eventId || '', eventData: { featuredRequestStatus: 'approved', isFeatured: true } })}
                style={{ flex: 1 }}
                title="Valider"
                variant="Primary"
              />
              <Button
                icon="close"
                isOption
                onPress={() => /** @type {any} */ (mutations.updateEventMutation).mutate({ documentId: eventId || '', eventData: { featuredRequestStatus: 'rejected' } })}
                style={{ flex: 1 }}
                title="Refuser"
                variant="Secondary"
              />
            </View>
          )
          : renderActionButtons()}
      </View>

      <JoinEventModal
        clubName={event?.team?.club?.name || ''}
        createEventParticipationMutation={mutations.createEventParticipationMutation}
        eventId={eventId || ''}
        isVisible={isJoinModalVisible}
        onClose={() => setIsJoinModalVisible(false)}
      />

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
        event={event}
        isVisible={isShareModalVisible}
        onClose={() => setIsShareModalVisible(false)}
        onSelectChat={(/** @type {string} */ chatId) => sendMessage(chatId, 'Partage', { event: eventId || '' })}
      />

      <Modal
        onRequestClose={() => setIsFeaturedModalVisible(false)}
        transparent
        visible={isFeaturedModalVisible}
      >
        <TouchableOpacity
          onPress={() => setIsFeaturedModalVisible(false)}
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', flex: 1, justifyContent: 'flex-end' }}
        >
          <View style={[ApplicationStyle.backgroundColor.primary700, { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }]}>
            <Button
              onPress={() => {
                setIsFeaturedModalVisible(false);
                mutations.requestFeaturedMutation.mutate(eventId || '');
              }}
              title="Tout le club"
              variant="Primary"
            />
          </View>
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
                      {lateModalMode === 'mark'
                        ? t('eventDetails.late.markTitle', 'Confirmer l arrivee')
                        : t('eventDetails.late.editTitle', 'Modifier le retard')}
                    </Text>
                    <Text style={[Fonts.p2, Fonts.neutral200]}>
                      {lateModalMode === 'mark'
                        ? t('eventDetails.late.markDescription', 'Confirmez l arrivee puis ajustez le retard si besoin.')
                        : t('eventDetails.late.editDescription', 'Modifiez le retard en minutes pour ce participant.')}
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
                      {t('eventDetails.late.playerLabel', 'Joueur')}
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
                      {t('eventDetails.late.helper', '0 = a l heure. Ajustez la valeur si necessaire avant validation.')}
                    </Text>
                  </View>

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
                      title={t('common.confirm', 'Enregistrer')}
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
