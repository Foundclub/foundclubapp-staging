// @ts-nocheck
/* eslint-disable no-alert, no-nested-ternary, jsx-a11y/label-has-associated-control, object-curly-newline */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { useWindowDimensions } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { resolveEventDisplayName } from '@/domains/event/eventDisplayName';
import { isDetectionEventType, resolveTrainingOpenConfig } from '@/domains/event/eventUseCases';
import { getCurrentUserEventParticipationState } from '@/domains/event/participationState';
import { withoutDeletedAccountEntries, withoutDeletedAccounts } from '@/domains/user/deletedAccount';
import useTheme from '@/theme/themeContext';

import ScreenContainer from '@/components/templates/ScreenContainer';
import {
  getTournamentPendingMembershipForUser,
  getTournamentRosterSummary,
  getTournamentStatusCounters,
  isTournamentActiveMemberStatus,
  isTournamentTeamNonCompliant,
  normalizeTournamentText,
} from '@/views/event/tournamentUtils';
import { getViewerConvocationRole } from '@/views/playerConvocation/playerConvocationUtils';

import { RouteNames } from '@/navigation/routeNames';

import { celebrate } from '@/services/celebrations/celebrationRuntime';
import {
  useGetEvent,
  useGetEventConvocation,
  useGetEventTeamComposition,
} from '@/services/event/eventQueries';
import { updateEvent } from '@/services/event/eventService';
import { useGetEventParticipations } from '@/services/eventParticipation/eventParticipationQueries';
import {
  createEventParticipation,
  deleteEventParticipation,
} from '@/services/eventParticipation/eventParticipationService';
import {
  createCustomTournamentTeam,
  registerClubTeamToTournament,
  reviewTournamentTeamRegistration,
} from '@/services/tournamentTeam/tournamentTeamService';

import {
  getClubCertificationLabel,
  getClubCertificationPalette,
} from '@/utils/clubCertification';
import { getEntityDocumentId } from '@/utils/entityId';
import getImageUrl from '@/utils/imageUrl';
import { buildPublicEventUrl, buildShareMessageWithUrl } from '@/utils/shareLinks';

/* eslint-disable perfectionist/sort-imports */
import * as SharePlatform from '@/platform/share';
import { BREAKPOINTS } from '@/responsive';
import EventTasksSection from './components/EventTasksSection';
import EventTeamAudiencesSection from './components/EventTeamAudiencesSection';
/* eslint-enable perfectionist/sort-imports */

const flattenPages = (pages) => {
  if (!Array.isArray(pages)) return [];
  return pages.flatMap((page) => (Array.isArray(page?.data) ? page.data : []));
};

const getParticipationLabel = (effectiveStatus) => {
  if (effectiveStatus === 'accepted') return 'Tu participes';
  if (effectiveStatus === 'pending') return 'En attente de validation';
  if (effectiveStatus === 'missing') return 'Tu es signale absent';
  return 'Aucune réponse';
};

const getTournamentTeamStatusLabel = (status) => {
  if (status === 'accepted') return 'Validee';
  if (status === 'declined') return 'Refusee';
  if (status === 'archived') return 'Archivee';
  return 'En attente';
};

const formatDate = (value, options = {}) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('fr-FR', options);
};

const formatDateTimeLabel = (value) => formatDate(value, {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: 'long',
  year: 'numeric',
});

const formatTimeLabel = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw.slice(0, 5);
};

const getUserDisplayName = (user) => `${String(user?.firstname || '').trim()} ${String(user?.lastname || '').trim()}`.trim() || 'Membre';

const getAvatarUrl = (user) => getImageUrl(user?.avatar?.url || '');

const getInitials = (value) => String(value || '')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map((part) => part[0]?.toUpperCase() || '')
  .join('');

const normalizeTypeName = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

/**
 *
 * @param root0
 * @param root0.navigation
 * @param root0.route
 */
function EventDetails({ navigation, route }) {
  const { eventId } = route?.params || {};
  const highlightedSection = route?.params?.focusSection || null;
  const fromEventCreation = Boolean(route?.params?.fromEventCreation);
  const creationCelebration = route?.params?.creationCelebration || null;
  const { width } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINTS.desktop;
  const isTablet = width >= BREAKPOINTS.tablet;
  const queryClient = useQueryClient();
  const {
    Colors,
  } = useTheme();
  const {
    canManageEvent,
    userData,
  } = useAuth();
  const {
    data: event,
    error,
    isLoading,
    refetch,
  } = useGetEvent(eventId || '', {
    refetchOnMount: fromEventCreation ? 'always' : false,
    staleTime: fromEventCreation ? 0 : undefined,
  });
  const {
    data: myParticipationPages,
  } = useGetEventParticipations(eventId || '', userData?.documentId, {
    includeInactive: true,
    pageSize: 20,
  }, {
    enabled: Boolean(eventId && userData?.documentId),
  });
  const [isSharing, setIsSharing] = useState(false);
  const [actionError, setActionError] = useState('');
  const [isTrainingSettingsVisible, setIsTrainingSettingsVisible] = useState(false);
  const [trainingOpenLimitDraft, setTrainingOpenLimitDraft] = useState('');
  const [trainingOpenValidationDraft, setTrainingOpenValidationDraft] = useState('manual');
  const creationCelebrationShownRef = useRef(false);

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
    const task = setTimeout(() => {
      celebrationDelay = setTimeout(() => {
        celebrate(
          resolvedCreationCelebration?.actionKey || 'event_created',
          resolvedCreationCelebration?.payload || {},
        );
        creationCelebrationShownRef.current = true;
      }, 220);
    }, 0);

    return () => {
      clearTimeout(task);
      if (celebrationDelay) {
        clearTimeout(celebrationDelay);
      }
    };
  }, [creationCelebration, event, eventId, fromEventCreation]);

  const myParticipations = useMemo(
    () => flattenPages(myParticipationPages?.pages),
    [myParticipationPages?.pages],
  );

  const participationState = useMemo(() => getCurrentUserEventParticipationState({
    missings: event?.missings || [],
    participationRequests: myParticipations.length > 0 ? myParticipations : event?.participationRequests || [],
    participations: event?.participations || [],
    user: userData,
  }), [event?.missings, event?.participationRequests, event?.participations, myParticipations, userData]);

  const canEdit = Boolean(canManageEvent(event));
  const hasEvent = Boolean(event);
  const trainingOpenConfig = useMemo(() => resolveTrainingOpenConfig(event || {}), [event]);
  const canManageTrainingVisibility = Boolean(canEdit && trainingOpenConfig.isTraining);
  const supportsEventComposition = Boolean(event?.team?.documentId || (event?.invitedTeams || []).length > 0);
  const isTeamMember = useMemo(() => {
    const userDocumentId = userData?.documentId;
    if (!userDocumentId) return false;
    const teams = [event?.team, ...(Array.isArray(event?.invitedTeams) ? event.invitedTeams : [])].filter(Boolean);
    return teams.some((team) => (
      Array.isArray(team?.players) && team.players.some((player) => player?.documentId === userDocumentId)
    ) || (
      Array.isArray(team?.trainers) && team.trainers.some((trainer) => trainer?.documentId === userDocumentId)
    ));
  }, [event?.invitedTeams, event?.team, userData?.documentId]);
  const canViewPublishedComposition = useMemo(() => {
    const effectiveStatus = String(participationState?.effectiveStatus || '').trim().toLowerCase();
    return canEdit || isTeamMember || effectiveStatus === 'accepted' || effectiveStatus === 'missing';
  }, [canEdit, isTeamMember, participationState?.effectiveStatus]);
  const compositionTeamId = useMemo(() => {
    const teams = [event?.team, ...(Array.isArray(event?.invitedTeams) ? event.invitedTeams : [])].filter(Boolean);
    if (!teams.length) return null;

    const userDocumentId = userData?.documentId;
    const trainedTeamIds = new Set((userData?.trainedTeams || []).map((team) => team?.documentId).filter(Boolean));
    const managedTeam = teams.find((team) => trainedTeamIds.has(team?.documentId))
      || teams.find((team) => Array.isArray(team?.trainers) && team.trainers.some((trainer) => trainer?.documentId === userDocumentId));
    if (managedTeam?.documentId) return managedTeam.documentId;

    const playerTeam = teams.find((team) => Array.isArray(team?.players) && team.players.some((player) => player?.documentId === userDocumentId));
    if (playerTeam?.documentId) return playerTeam.documentId;

    return teams[0]?.documentId || null;
  }, [event?.invitedTeams, event?.team, userData?.documentId, userData?.trainedTeams]);
  const compositionEditorTeam = useMemo(() => {
    const teams = [event?.team, ...(Array.isArray(event?.invitedTeams) ? event.invitedTeams : [])].filter(Boolean);
    return teams.find((team) => team?.documentId === compositionTeamId) || event?.team || null;
  }, [compositionTeamId, event?.invitedTeams, event?.team]);
  const isReservation = normalizeTypeName(event?.type?.name).includes('reservation');
  const isTournamentEvent = normalizeTypeName(event?.type?.name).includes('tournoi');
  // D48 : le board decide d'apres cette etiquette s'il propose les commandes de
  // la detection (D44). Le telephone la transmet depuis EventDetails.js:3197 ;
  // le site ne la calculait meme pas. On passe par le helper PARTAGE plutot que
  // par le `normalizeTypeName` local — les deux normalisent a l'identique, mais
  // seul le helper garantit que les deux surfaces resteront d'accord.
  const isDetectionEvent = isDetectionEventType(event?.type?.name);
  const tournamentConfig = useMemo(
    () => event?.tournamentConfig || {},
    [event?.tournamentConfig],
  );
  const tournamentTeams = useMemo(
    () => (Array.isArray(event?.tournamentTeams) ? [...event.tournamentTeams] : [])
      .sort((left, right) => String(left?.name || '').localeCompare(String(right?.name || ''))),
    [event?.tournamentTeams],
  );
  const currentUserTournamentTeam = useMemo(() => {
    const currentUserId = userData?.documentId;
    if (!currentUserId) return null;
    return tournamentTeams.find((team) => Array.isArray(team?.members) && team.members.some((member) => (
      member?.user?.documentId === currentUserId
      && isTournamentActiveMemberStatus(member?.responseStatus)
    ))) || null;
  }, [tournamentTeams, userData?.documentId]);
  const currentUserPendingTournamentTeam = useMemo(
    () => getTournamentPendingMembershipForUser(tournamentTeams, userData?.documentId || ''),
    [tournamentTeams, userData?.documentId],
  );
  const managedTournamentTeam = useMemo(() => {
    const currentUserId = userData?.documentId;
    if (!currentUserId) return null;
    return tournamentTeams.find((team) => (
      team?.captainUser?.documentId === currentUserId
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
      .filter((team) => team?.documentId && !registeredTournamentSourceTeamIds.has(team.documentId)),
    [registeredTournamentSourceTeamIds, userData?.trainedTeams],
  );
  const canCreateCustomTournamentTeam = Boolean(
    isTournamentEvent
    && event?.tournamentConfig?.allowCustomTeams !== false
    && userData?.documentId
    && !currentUserTournamentTeam
    && !currentUserPendingTournamentTeam,
  );
  const canRegisterTournamentSourceTeam = Boolean(
    isTournamentEvent
    && !currentUserTournamentTeam
    && !currentUserPendingTournamentTeam
    && availableTournamentSourceTeams.length > 0,
  );
  const tournamentTeamCounters = useMemo(
    () => getTournamentStatusCounters(tournamentTeams, tournamentConfig),
    [tournamentConfig, tournamentTeams],
  );
  const facilityId = getEntityDocumentId(event?.facility);
  const eventLink = buildPublicEventUrl({ eventId });
  const participationLabel = getParticipationLabel(
    participationState?.effectiveStatus,
  );
  const compositionSport = useMemo(
    () => compositionEditorTeam?.activities?.[0]?.name || event?.team?.activities?.[0]?.name || 'football',
    [compositionEditorTeam?.activities, event?.team?.activities],
  );
  // Y02 — meme regle que la version native : un match dont on connait
  // l'adversaire s'appelle « Match vs X », tout le reste garde son nom d'avant.
  // ⚠️ Les deux ecrans doivent dire la MEME chose : c'est ce nom que porte la
  // carte de compo envoyee dans le tchat, lisible depuis les deux.
  const compositionEventLabel = useMemo(
    () => resolveEventDisplayName(event, 'Evenement'),
    [event],
  );
  const {
    data: staffCompositionPayload,
    isFetching: isStaffCompositionFetching,
  } = useGetEventTeamComposition(
    eventId || '',
    compositionTeamId || undefined,
    {
      enabled: Boolean(eventId && compositionTeamId && supportsEventComposition && canEdit),
    },
  );
  const {
    data: convocationPayload,
  } = useGetEventConvocation(
    eventId || '',
    compositionTeamId || undefined,
    {
      enabled: Boolean(eventId && compositionTeamId && supportsEventComposition && canViewPublishedComposition),
    },
  );
  const convocationBranches = useMemo(() => {
    if (Array.isArray(convocationPayload?.branches)) return convocationPayload.branches;
    if (convocationPayload?.published) {
      return [{
        published: convocationPayload.published,
        team: convocationPayload?.team || { documentId: compositionTeamId, name: compositionEditorTeam?.name || null },
        viewer: { inReserve: false, teamEntryIds: [] },
      }];
    }
    return [];
  }, [compositionEditorTeam?.name, compositionTeamId, convocationPayload?.branches, convocationPayload?.published, convocationPayload?.team]);
  const publishedCompositionTeamCount = useMemo(
    () => convocationBranches.reduce((total, branch) => total + (Array.isArray(branch?.published?.teams) ? branch.published.teams.length : 0), 0),
    [convocationBranches],
  );
  const publishedCompositionReserveCount = useMemo(
    () => convocationBranches.reduce((total, branch) => total + (Array.isArray(branch?.published?.reservePlayerIds) ? branch.published.reservePlayerIds.length : 0), 0),
    [convocationBranches],
  );
  // 🥇 AC08 — LE SITE SUIT LE TELEPHONE. `web` compile PHYSIQUEMENT les sources
  // de `app`, mais un fichier `.web.js` REMPLACE son jumeau : ne poser la porte
  // que dans `EventDetails.js` laisserait ici un appelant frere casse — le motif
  // a deja coute 4 correctifs (D08, D22, D40, D48).
  const viewerConvocationRole = useMemo(
    () => getViewerConvocationRole(convocationPayload, userData?.documentId || userData?.id),
    [convocationPayload, userData?.documentId, userData?.id],
  );
  const compositionEligiblePlayerCount = Array.isArray(staffCompositionPayload?.eligiblePlayers)
    ? staffCompositionPayload.eligiblePlayers.length
    : 0;
  const handleManageComposition = useCallback(() => {
    if (!eventId || !compositionTeamId) return;

    if (isStaffCompositionFetching) {
      window.alert('La composition d\'équipes est encore en cours de chargement.');
      return;
    }

    const openBoard = (composition, options = {}) => {
      // C-A — LA PORTE DES 4 ECRANS NEUFS SUR LE SITE.
      //
      // Les routes du pack composition existent et sont montees depuis D77/D79,
      // mais le site envoyait TOUJOURS vers l'ancien terrain : on ne pouvait les
      // atteindre qu'en tapant l'URL. La condition est celle du fichier natif
      // (EventDetails.js:3232), a l'identique — une divergence entre les deux
      // jumeaux vit indefiniment, aucune porte de `app` ne la voit.
      //
      // C-E (🚪) — LA PORTE DES 3 ECRANS DE DETECTION, SUR LE SITE AUSSI.
      // Le lot C-D a livre les ecrans 13, 14 et 15 ; rien n'y menait. La regle
      // est identique a celle du natif (`EventDetails.js`), volontairement :
      // une divergence entre les deux jumeaux vit indefiniment, aucune porte de
      // `app` ne la voit. La LECTURE SEULE reste sur l'ancien terrain des deux
      // cotes — elle ne compose pas, c'est le lot C-F qui la reprendra.
      const canComposeNow = Boolean(options.canEdit) && !options.readOnly;
      let compositionRoute = RouteNames.TacticalBoardV2;
      if (canComposeNow) {
        compositionRoute = isDetectionEvent
          ? RouteNames.DetectionSquadSetup
          : RouteNames.MatchCallUpSelection;
      }

      navigation.navigate(compositionRoute, {
        aggregateBranches: Array.isArray(options.aggregateBranches) ? options.aggregateBranches : undefined,
        canEdit: Boolean(options.canEdit),
        compositionIntent: options.compositionIntent || null,
        editorMode: 'event',
        editorSource: options.editorSource || null,
        editorSourceLabel: options.editorSourceLabel || null,
        eventId,
        eventKind: isDetectionEvent ? 'detection' : 'match',
        eventName: compositionEventLabel,
        eventTypeLabel: event?.type?.name || null,
        existingComposition: composition,
        multiTeamComposition: true,
        players: Array.isArray(options.players) ? options.players : (Array.isArray(staffCompositionPayload?.eligiblePlayers) ? staffCompositionPayload.eligiblePlayers : []),
        readOnly: Boolean(options.readOnly),
        sport: composition?.sportContext || compositionSport,
        teamComposition: options.teamComposition || staffCompositionPayload || null,
        teamId: compositionTeamId,
        teamName: compositionEditorTeam?.name || staffCompositionPayload?.team?.name || null,
      });
    };

    if (staffCompositionPayload?.draft) {
      openBoard(staffCompositionPayload.draft, {
        canEdit: true,
        compositionIntent: staffCompositionPayload?.draft?.mode || 'manual',
        editorSource: 'draft',
        editorSourceLabel: 'Brouillon',
        readOnly: false,
      });
      return;
    }

    if (staffCompositionPayload?.published) {
      openBoard(staffCompositionPayload.published, {
        canEdit: true,
        compositionIntent: staffCompositionPayload?.published?.mode || 'manual',
        editorSource: 'published',
        editorSourceLabel: "Composition d'équipes publiée",
        players: Array.isArray(staffCompositionPayload?.published?.snapshotPlayers) ? staffCompositionPayload.published.snapshotPlayers : [],
        readOnly: false,
      });
      return;
    }

    const hasAutoPresets = Array.isArray(staffCompositionPayload?.availablePresets) && staffCompositionPayload.availablePresets.length > 0;
    if (!hasAutoPresets) {
      openBoard(staffCompositionPayload?.bootstrap?.composition || null, {
        canEdit: true,
        compositionIntent: 'manual',
        editorSource: staffCompositionPayload?.bootstrap?.source || 'empty',
        editorSourceLabel: 'Nouvelle composition',
        readOnly: false,
      });
      return;
    }

    const wantsAuto = window.confirm('OK pour créer les équipes automatiquement ? Clique sur Annuler pour passer en mode manuel.');
    openBoard(staffCompositionPayload?.bootstrap?.composition || null, {
      canEdit: true,
      compositionIntent: wantsAuto ? 'auto' : 'manual',
      editorSource: staffCompositionPayload?.bootstrap?.source || 'empty',
      editorSourceLabel: 'Nouvelle composition',
      readOnly: false,
    });
  }, [
    compositionEditorTeam?.name,
    compositionEventLabel,
    compositionSport,
    compositionTeamId,
    event?.type?.name,
    eventId,
    isDetectionEvent,
    isStaffCompositionFetching,
    navigation,
    staffCompositionPayload,
  ]);

  useEffect(() => {
    if (!trainingOpenConfig.isTraining) return;
    setTrainingOpenLimitDraft(
      trainingOpenConfig.externalParticipantLimit != null
        ? String(trainingOpenConfig.externalParticipantLimit)
        : '',
    );
    setTrainingOpenValidationDraft(
      trainingOpenConfig.externalParticipantValidationMode || 'manual',
    );
  }, [
    trainingOpenConfig.externalParticipantLimit,
    trainingOpenConfig.externalParticipantValidationMode,
    trainingOpenConfig.isTraining,
  ]);

  useEffect(() => {
    if (!highlightedSection || isLoading) {
      return undefined;
    }
    const frameId = window.requestAnimationFrame(() => {
      const section = document.querySelector(`[data-event-section="${highlightedSection}"]`);
      section?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [highlightedSection, isLoading]);

  const invalidateEventQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['event', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['eventParticipations', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['events'] }),
      queryClient.invalidateQueries({ queryKey: ['recruitmentAds'] }),
      queryClient.invalidateQueries({ queryKey: ['myApplications'] }),
      queryClient.invalidateQueries({ queryKey: ['planning', 'personal'] }),
    ]);
    await refetch();
  }, [eventId, queryClient, refetch]);

  const createParticipationMutation = useMutation({
    mutationFn: () => createEventParticipation({
      event: eventId,
      user: userData?.documentId || '',
    }),
    onSuccess: invalidateEventQueries,
  });

  const cancelParticipationMutation = useMutation({
    mutationFn: (requestId) => deleteEventParticipation(requestId),
    onSuccess: invalidateEventQueries,
  });
  const updateTrainingMutation = useMutation({
    mutationFn: (eventData) => updateEvent({ documentId: eventId, eventData }),
    onSuccess: async () => {
      setActionError('');
      setIsTrainingSettingsVisible(false);
      await invalidateEventQueries();
    },
  });
  const registerTournamentTeamMutation = useMutation({
    mutationFn: (sourceTeamId) => registerClubTeamToTournament(eventId, sourceTeamId),
    onSuccess: invalidateEventQueries,
  });
  const createTournamentTeamMutation = useMutation({
    mutationFn: (payload) => createCustomTournamentTeam(eventId, payload),
    onSuccess: invalidateEventQueries,
  });
  const reviewTournamentTeamMutation = useMutation({
    mutationFn: ({ status, teamDocumentId }) => reviewTournamentTeamRegistration(teamDocumentId, status),
    onSuccess: invalidateEventQueries,
  });

  const activeParticipationRequestId = getEntityDocumentId(participationState?.activeRequest);
  const heroImage = getImageUrl(event?.team?.club?.logo?.url || event?.team?.club?.sponsor?.logo?.url || '');
  const sectionBackground = 'rgba(6, 19, 29, 0.76)';
  const borderColor = 'rgba(255,255,255,0.08)';
  const textColor = Colors?.neutral00 || '#ffffff';
  const mutedTextColor = Colors?.neutral300 || '#adb1b2';
  const accentColor = Colors?.primary500 || '#01b3f4';
  const softTextColor = Colors?.neutral100 || '#e6eef2';
  const softSurfaceColor = 'rgba(255,255,255,0.04)';
  const pillSurfaceColor = 'rgba(255,255,255,0.06)';
  const clubCertificationPalette = getClubCertificationPalette(event?.team?.club, Colors);
  const clubCertificationLabel = getClubCertificationLabel(event?.team?.club);
  const sectionTitleStyle = {
    color: textColor,
    fontFamily: 'Montserrat-Bold, sans-serif',
    fontSize: 20,
    margin: 0,
  };
  const outlineButtonStyle = {
    background: 'transparent',
    border: `1px solid ${borderColor}`,
    borderRadius: 999,
    color: textColor,
    cursor: 'pointer',
    fontFamily: 'Montserrat-SemiBold, Montserrat-Bold, sans-serif',
    padding: '10px 16px',
  };
  const primaryButtonStyle = {
    background: accentColor,
    border: 0,
    borderRadius: 999,
    color: textColor,
    cursor: 'pointer',
    fontFamily: 'Montserrat-Bold, sans-serif',
    padding: '10px 16px',
  };

  const handleJoin = useCallback(async () => {
    setActionError('');
    try {
      await createParticipationMutation.mutateAsync();
    } catch (joinError) {
      setActionError(joinError?.message || 'Impossible de rejoindre cet événement.');
    }
  }, [createParticipationMutation]);

  const handleCancelParticipation = useCallback(async () => {
    if (!activeParticipationRequestId) return;
    setActionError('');
    try {
      await cancelParticipationMutation.mutateAsync(activeParticipationRequestId);
    } catch (cancelError) {
      setActionError(cancelError?.message || 'Impossible d annuler cette participation.');
    }
  }, [activeParticipationRequestId, cancelParticipationMutation]);

  const handleSubmitTrainingOpenConfig = useCallback(async () => {
    if (!eventId) return;

    const externalParticipantLimit = Number.parseInt(String(trainingOpenLimitDraft || '').trim(), 10);
    if (!Number.isFinite(externalParticipantLimit) || externalParticipantLimit < 1) {
      setActionError('Indique combien de places externes tu veux ouvrir pour cet entraînement.');
      return;
    }

    try {
      await updateTrainingMutation.mutateAsync({
        externalParticipantLimit,
        externalParticipantValidationMode: trainingOpenValidationDraft === 'auto' ? 'auto' : 'manual',
        sessionStatus: 'open',
      });
    } catch (mutationError) {
      setActionError(mutationError?.message || 'Impossible d\'ouvrir cet entraînement.');
    }
  }, [
    eventId,
    trainingOpenLimitDraft,
    trainingOpenValidationDraft,
    updateTrainingMutation,
  ]);

  const handleCloseTraining = useCallback(async () => {
    if (!eventId) return;

    try {
      await updateTrainingMutation.mutateAsync({
        sessionStatus: 'closed',
      });
    } catch (mutationError) {
      setActionError(mutationError?.message || 'Impossible de fermer cet entraînement.');
    }
  }, [eventId, updateTrainingMutation]);

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    try {
      const shareMessage = buildShareMessageWithUrl({
        intro: event?.name || event?.type?.name || 'Evenement',
        linkLabel: 'Voir la fiche FoundClub',
        url: eventLink,
      });
      await SharePlatform.share({
        message: shareMessage,
        title: event?.name || 'Événement FoundClub',
        url: eventLink,
      });
    } catch (_error) {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(eventLink);
        window.alert('Lien copie dans le presse-papiers.');
      } else {
        window.alert(eventLink);
      }
    } finally {
      setIsSharing(false);
    }
  }, [event?.name, event?.type?.name, eventLink]);

  const handleOpenTournamentTeam = useCallback((teamDocumentId) => {
    if (!teamDocumentId) return;
    navigation.navigate(RouteNames.TournamentTeamDetails, { eventId, teamId: teamDocumentId });
  }, [eventId, navigation]);

  const handleCreateTournamentTeam = useCallback(async () => {
    const proposedName = window.prompt('Nom de l équipe tournoi');
    const trimmedName = String(proposedName || '').trim();
    if (!trimmedName) return;
    setActionError('');
    try {
      await createTournamentTeamMutation.mutateAsync({ name: trimmedName });
    } catch (mutationError) {
      setActionError(mutationError?.message || 'Impossible de créer cette équipe tournoi.');
    }
  }, [createTournamentTeamMutation]);

  const handleRegisterTournamentTeam = useCallback(async () => {
    if (availableTournamentSourceTeams.length === 0) return;
    const optionsText = availableTournamentSourceTeams
      .map((team, index) => `${index + 1}. ${team?.name || 'Equipe'}`)
      .join('\n');
    const rawChoice = window.prompt(`Choisis une équipe à inscrire :\n${optionsText}`);
    const choiceIndex = Number.parseInt(String(rawChoice || '').trim(), 10) - 1;
    const sourceTeam = availableTournamentSourceTeams[choiceIndex];
    if (!sourceTeam?.documentId) return;
    setActionError('');
    try {
      await registerTournamentTeamMutation.mutateAsync(sourceTeam.documentId);
    } catch (mutationError) {
      setActionError(mutationError?.message || 'Impossible d inscrire cette équipe.');
    }
  }, [availableTournamentSourceTeams, registerTournamentTeamMutation]);

  const handleReviewTournamentTeam = useCallback(async (teamDocumentId, status) => {
    setActionError('');
    try {
      await reviewTournamentTeamMutation.mutateAsync({ status, teamDocumentId });
    } catch (mutationError) {
      setActionError(mutationError?.message || 'Impossible de mettre à jour cette équipe.');
    }
  }, [reviewTournamentTeamMutation]);

  // AA02 — les TROIS listes de personnes de la page web passent par le meme
  // tri que l'application mobile : `web` compile les sources de `app`, donc la
  // fonction partagee est litteralement la meme. Un compte supprime est
  // anonymise et bloque cote serveur, pas efface : sans ce tri il reste ici.
  const participants = withoutDeletedAccounts(event?.participations);
  const participationRequests = withoutDeletedAccountEntries(event?.participationRequests);
  const invitedTeams = Array.isArray(event?.invitedTeams) ? event.invitedTeams : [];
  const detectedPlayers = withoutDeletedAccounts(event?.missings);
  const participantIdentitiesHidden = event?.participantIdentitiesHidden === true;

  const renderParticipantsSection = () => {
    if (participants.length === 0) {
      return <div style={{ color: mutedTextColor }}>Aucun participant confirme pour le moment.</div>;
    }

    if (participantIdentitiesHidden) {
      return (
        <div style={{
          background: softSurfaceColor,
          border: `1px solid ${borderColor}`,
          borderRadius: 16,
          display: 'grid',
          gap: 14,
          padding: '16px 18px',
        }}
        >
          <div style={{ color: textColor, fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 15 }}>
            {participants.length}
            {' '}
            participant
            {participants.length > 1 ? 's' : ''}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {Array.from({ length: Math.min(participants.length, 6) }).map((_, index) => (
              <div
                key={`participant-anon-${index + 1}`}
                style={{
                  alignItems: 'center',
                  background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '50%',
                  color: mutedTextColor,
                  display: 'inline-flex',
                  fontFamily: 'Montserrat-Bold, sans-serif',
                  height: 42,
                  justifyContent: 'center',
                  width: 42,
                }}
              >
                ?
              </div>
            ))}
          </div>
          <div style={{ color: mutedTextColor, fontSize: 13, lineHeight: 1.5 }}>
            Les identités des participants sont masquees par l organisateur.
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: 'grid', gap: 12 }}>
        {participants.map((participant) => {
          const displayName = getUserDisplayName(participant);
          const avatarUrl = getAvatarUrl(participant);
          return (
            <div
              key={getEntityDocumentId(participant) || displayName}
              style={{
                alignItems: 'center',
                background: softSurfaceColor,
                border: `1px solid ${borderColor}`,
                borderRadius: 16,
                display: 'flex',
                gap: 12,
                padding: '12px 14px',
              }}
            >
              {avatarUrl ? (
                <img
                  alt={displayName}
                  src={avatarUrl}
                  style={{
                    borderRadius: '50%', height: 42, objectFit: 'cover', width: 42,
                  }}
                />
              ) : (
                <div style={{
                  alignItems: 'center', background: 'rgba(1,179,244,0.16)', borderRadius: '50%', display: 'inline-flex', height: 42, justifyContent: 'center', width: 42,
                }}
                >
                  {getInitials(displayName)}
                </div>
              )}
              <div style={{ display: 'grid', gap: 4 }}>
                <span style={{ color: textColor, fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 14 }}>{displayName}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <ScreenContainer
      bgImage="bg2"
      contentWidth="wide"
      responsivePadding
      style={{ paddingBottom: 32 }}
    >
      <div style={{ color: textColor, display: 'grid', gap: 24 }}>
        {fromEventCreation ? (
          <section
            style={{
              background: 'rgba(1, 179, 244, 0.10)',
              border: `1px solid ${accentColor}`,
              borderRadius: 20,
              color: textColor,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              justifyContent: 'space-between',
              padding: 16,
            }}
          >
            <span>Événement crée. Vérifie les derniers détails avant de le partager.</span>
            <button
              onClick={() => navigation.navigate(RouteNames.MyEventList)}
              style={{ ...outlineButtonStyle, padding: '8px 14px' }}
              type="button"
            >
              Voir mon planning
            </button>
          </section>
        ) : null}
        <section
          data-event-section="overview"
          style={{
            background: sectionBackground,
            border: `1px solid ${borderColor}`,
            borderRadius: 28,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              alignItems: 'stretch',
              display: 'grid',
              gap: 0,
              gridTemplateColumns: isDesktop && hasEvent ? 'minmax(0, 1.2fr) 320px' : 'minmax(0, 1fr)',
            }}
          >
            <div style={{ display: 'grid', gap: 18, padding: isTablet ? 32 : 22 }}>
              <div style={{
                alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between',
              }}
              >
                <button
                  onClick={() => navigation.goBack()}
                  style={{ ...outlineButtonStyle, padding: '10px 14px' }}
                  type="button"
                >
                  Retour
                </button>
                {hasEvent ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <button
                      onClick={handleShare}
                      style={{ ...outlineButtonStyle, padding: '10px 14px' }}
                      type="button"
                    >
                      {isSharing ? 'Partage...' : 'Partager'}
                    </button>
                    {canEdit ? (
                      <button
                        onClick={() => navigation.navigate(RouteNames.EventEdit, { eventId })}
                        style={primaryButtonStyle}
                        type="button"
                      >
                        Modifier
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {hasEvent ? (
                <>
                  <div style={{ display: 'grid', gap: 10 }}>
                    <span style={{
                      color: accentColor, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase',
                    }}
                    >
                      {event?.type?.name || 'Evenement'}
                    </span>
                    <h1 style={{
                      color: textColor,
                      fontFamily: 'Montserrat-Black, sans-serif',
                      fontSize: isTablet ? 38 : 30,
                      lineHeight: 1.1,
                      margin: 0,
                    }}
                    >
                      {event?.name || event?.type?.name || 'Evenement'}
                    </h1>
                    <div style={{
                      color: softTextColor, display: 'flex', flexWrap: 'wrap', gap: 14,
                    }}
                    >
                      <span>{formatDateTimeLabel(event?.date)}</span>
                      {event?.startTime ? (
                        <span>
                          {formatTimeLabel(event?.startTime)}
                          {' '}
                          -
                          {' '}
                          {formatTimeLabel(event?.endTime)}
                        </span>
                      ) : null}
                      {event?.team?.name ? <span>{event.team.name}</span> : null}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    {event?.facility?.name ? (
                      <span style={{
                        background: pillSurfaceColor, borderRadius: 999, color: textColor, padding: '9px 14px',
                      }}
                      >
                        {event.facility.name}
                      </span>
                    ) : null}
                    {event?.validationMode ? (
                      <span style={{
                        background: pillSurfaceColor, borderRadius: 999, color: textColor, padding: '9px 14px',
                      }}
                      >
                        Validation
                        {' '}
                        {event.validationMode === 'manual' ? 'manuelle' : 'auto'}
                      </span>
                    ) : null}
                    {event?.sessionStatus ? (
                      <span style={{
                        background: pillSurfaceColor, borderRadius: 999, color: textColor, padding: '9px 14px',
                      }}
                      >
                        Session
                        {' '}
                        {event.sessionStatus === 'closed' ? 'fermee' : 'ouverte'}
                      </span>
                    ) : null}
                  </div>

                  {String(event?.description || '').trim() ? (
                    <p style={{
                      color: softTextColor, fontSize: 15, lineHeight: 1.65, margin: 0, maxWidth: 840,
                    }}
                    >
                      {String(event?.description || '').trim()}
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>

            {hasEvent ? (
              <div
                style={{
                  background: heroImage ? `linear-gradient(rgba(3, 13, 20, 0.22), rgba(3, 13, 20, 0.48)), url(${heroImage}) center/cover` : 'linear-gradient(160deg, rgba(1,179,244,0.16), rgba(23,56,68,0.4))',
                  borderLeft: isDesktop ? `1px solid ${borderColor}` : 'none',
                  display: 'grid',
                  gap: 14,
                  padding: isTablet ? 32 : 22,
                }}
              >
                <div style={{ color: textColor, fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 15 }}>Mon statut</div>
                <div style={{ color: mutedTextColor, fontSize: 14, lineHeight: 1.5 }}>
                  {participationLabel}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {!canEdit && !participationState?.isParticipating && !participationState?.hasPendingRequest ? (
                    <button
                      disabled={createParticipationMutation.isPending}
                      onClick={handleJoin}
                      style={{
                        ...primaryButtonStyle,
                        cursor: createParticipationMutation.isPending ? 'not-allowed' : 'pointer',
                        opacity: createParticipationMutation.isPending ? 0.7 : 1,
                        padding: '12px 16px',
                      }}
                      type="button"
                    >
                      {createParticipationMutation.isPending ? 'Envoi...' : 'Participer'}
                    </button>
                  ) : null}
                  {!canEdit && activeParticipationRequestId ? (
                    <button
                      disabled={cancelParticipationMutation.isPending}
                      onClick={handleCancelParticipation}
                      style={{
                        ...outlineButtonStyle,
                        cursor: cancelParticipationMutation.isPending ? 'not-allowed' : 'pointer',
                        opacity: cancelParticipationMutation.isPending ? 0.7 : 1,
                        padding: '12px 16px',
                      }}
                      type="button"
                    >
                      {cancelParticipationMutation.isPending ? 'Annulation...' : 'Annuler ma demande'}
                    </button>
                  ) : null}
                  {isReservation && facilityId ? (
                    <button
                      onClick={() => navigation.navigate(RouteNames.BookingCalendar, { facilityId })}
                      style={{ ...outlineButtonStyle, padding: '12px 16px' }}
                      type="button"
                    >
                      Ouvrir le calendrier
                    </button>
                  ) : null}
                </div>
                {actionError ? (
                  <div style={{ color: '#ffb0ba', fontSize: 13, lineHeight: 1.5 }}>
                    {actionError}
                  </div>
                ) : null}
                {event?.team?.club?.name ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ color: mutedTextColor, fontSize: 13 }}>
                      Club organisateur:
                      {' '}
                      {event.team.club.name}
                    </div>
                    <div
                      style={{
                        alignSelf: 'flex-start',
                        background: clubCertificationPalette.backgroundColor,
                        border: `1px solid ${clubCertificationPalette.borderColor}`,
                        borderRadius: 999,
                        color: clubCertificationPalette.textColor,
                        fontFamily: 'Montserrat-Bold, sans-serif',
                        fontSize: 12,
                        padding: '6px 10px',
                      }}
                    >
                      {clubCertificationLabel}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        {error ? (
          <section style={{
            background: sectionBackground, border: `1px solid ${borderColor}`, borderRadius: 24, padding: 22,
          }}
          >
            <div style={{ color: '#ff6b81', fontFamily: 'Montserrat-Bold, sans-serif', marginBottom: 8 }}>Chargement impossible</div>
            <div style={{ color: mutedTextColor, marginBottom: 14 }}>{error?.message || 'Une erreur est survenue.'}</div>
            <button
              onClick={() => refetch()}
              style={{ ...primaryButtonStyle, padding: '10px 16px' }}
              type="button"
            >
              Recharger
            </button>
          </section>
        ) : null}

        {isLoading ? (
          <section style={{
            background: sectionBackground, border: `1px solid ${borderColor}`, borderRadius: 24, color: mutedTextColor, padding: 22,
          }}
          >
            Chargement de l événement...
          </section>
        ) : null}

        {!isLoading && !error && !hasEvent ? (
          <section style={{
            background: sectionBackground, border: `1px solid ${borderColor}`, borderRadius: 24, color: mutedTextColor, display: 'grid', gap: 10, padding: 22,
          }}
          >
            <div style={{ color: textColor, fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 22 }}>
              Événement introuvable
            </div>
            <div>
              Cet événement n est plus disponible ou n a pas pu être charge.
            </div>
          </section>
        ) : null}

        {!isLoading && event ? (
          <div style={{ display: 'grid', gap: 24, gridTemplateColumns: isDesktop ? 'minmax(0, 1.15fr) minmax(300px, 0.85fr)' : 'minmax(0, 1fr)' }}>
            <section style={{
              background: sectionBackground, border: `1px solid ${borderColor}`, borderRadius: 24, display: 'grid', gap: 18, padding: 22,
            }}
            >
              {Array.isArray(event?.eventTasks) && event.eventTasks.length > 0 ? (
                <div>
                  <EventTasksSection
                    canManageEvent={canEdit}
                    event={event}
                    userData={userData}
                  />
                </div>
              ) : null}

              {canManageTrainingVisibility ? (
                <div
                  style={{
                    background: softSurfaceColor,
                    border: `1px solid ${accentColor}44`,
                    borderRadius: 18,
                    display: 'grid',
                    gap: 12,
                    padding: '16px 18px',
                  }}
                >
                  <div style={{ display: 'grid', gap: 4 }}>
                    <strong style={{ color: textColor, fontFamily: 'Montserrat-Bold, sans-serif' }}>
                      {trainingOpenConfig.isOpenTraining ? 'Entraînement ouvert' : 'Entraînement prive'}
                    </strong>
                    <span style={{ color: mutedTextColor, fontSize: 14, lineHeight: 1.6 }}>
                      {trainingOpenConfig.isOpenTraining
                        ? 'Les joueurs externes peuvent rejoindre selon le quota et le mode de validation choisis.'
                        : 'Ouvre l entraînement pour accueillir des joueurs externes sans compter les membres de tes équipes.'}
                    </span>
                  </div>

                  {trainingOpenConfig.externalParticipantLimit !== null ? (
                    <span style={{ color: softTextColor, fontSize: 14 }}>
                      {trainingOpenConfig.isOpenTraining
                        ? `${trainingOpenConfig.externalParticipantLimit} place(s) externes - validation ${trainingOpenConfig.externalParticipantValidationMode === 'auto' ? 'automatique' : 'manuelle'}`
                        : `Dernier reglage mémorise: ${trainingOpenConfig.externalParticipantLimit} place(s) externes - validation ${trainingOpenConfig.externalParticipantValidationMode === 'auto' ? 'automatique' : 'manuelle'}`}
                    </span>
                  ) : null}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <button
                      disabled={updateTrainingMutation.isPending}
                      onClick={trainingOpenConfig.isOpenTraining
                        ? handleCloseTraining
                        : () => setIsTrainingSettingsVisible((current) => !current)}
                      style={trainingOpenConfig.isOpenTraining ? outlineButtonStyle : primaryButtonStyle}
                      type="button"
                    >
                      {updateTrainingMutation.isPending
                        ? 'Enregistrement...'
                        : (trainingOpenConfig.isOpenTraining ? 'Fermer l entraînement' : 'Ouvrir l entraînement')}
                    </button>
                  </div>

                  {!trainingOpenConfig.isOpenTraining && isTrainingSettingsVisible ? (
                    <div style={{ display: 'grid', gap: 14 }}>
                      <label style={{ display: 'grid', gap: 8 }}>
                        <span style={{ color: mutedTextColor, fontSize: 13 }}>Places externes</span>
                        <input
                          min="1"
                          onChange={(eventObject) => setTrainingOpenLimitDraft(eventObject.target.value)}
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: `1px solid ${borderColor}`,
                            borderRadius: 14,
                            color: textColor,
                            fontFamily: 'Montserrat-Regular, sans-serif',
                            fontSize: 14,
                            outline: 'none',
                            padding: '12px 14px',
                          }}
                          type="number"
                          value={trainingOpenLimitDraft}
                        />
                      </label>

                      <label style={{ display: 'grid', gap: 8 }}>
                        <span style={{ color: mutedTextColor, fontSize: 13 }}>Validation des joueurs externes</span>
                        <select
                          onChange={(eventObject) => setTrainingOpenValidationDraft(eventObject.target.value)}
                          style={{
                            background: 'rgba(255,255,255,0.03)',
                            border: `1px solid ${borderColor}`,
                            borderRadius: 14,
                            color: textColor,
                            fontFamily: 'Montserrat-Regular, sans-serif',
                            fontSize: 14,
                            outline: 'none',
                            padding: '12px 14px',
                          }}
                          value={trainingOpenValidationDraft}
                        >
                          <option value="auto">Automatique</option>
                          <option value="manual">Manuelle</option>
                        </select>
                      </label>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        <button
                          disabled={updateTrainingMutation.isPending}
                          onClick={handleSubmitTrainingOpenConfig}
                          style={primaryButtonStyle}
                          type="button"
                        >
                          Confirmer l ouverture
                        </button>
                        <button
                          disabled={updateTrainingMutation.isPending}
                          onClick={() => setIsTrainingSettingsVisible(false)}
                          style={outlineButtonStyle}
                          type="button"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {supportsEventComposition && (canEdit || canViewPublishedComposition) ? (
                <div
                  style={{
                    background: softSurfaceColor,
                    border: `1px solid ${accentColor}33`,
                    borderRadius: 18,
                    display: 'grid',
                    gap: 12,
                    padding: '16px 18px',
                  }}
                >
                  <div style={{ display: 'grid', gap: 4 }}>
                    <strong style={{ color: textColor, fontFamily: 'Montserrat-Bold, sans-serif' }}>
                      Composition d&apos;equipes
                    </strong>
                    <span style={{ color: mutedTextColor, fontSize: 14, lineHeight: 1.6 }}>
                      {staffCompositionPayload?.draft
                        ? 'Un brouillon existe déjà. Reprends-le, ajuste les équipes puis publie la version finale.'
                        : compositionEligiblePlayerCount === 0
                          ? 'Tu peux déjà créer les équipes même sans participant: les postes resteront libres et se completeront ensuite.'
                          : 'Crée plusieurs équipes à la main ou génère-les automatiquement, puis publie la version finale.'}
                    </span>
                  </div>

                  {convocationBranches.length > 0 ? (
                    <div style={{ color: softTextColor, display: 'grid', fontSize: 14, gap: 6 }}>
                      <span>
                        {publishedCompositionTeamCount}
                        {' '}
                        equipe(s) publiee(s)
                      </span>
                      <span>
                        {convocationBranches.length}
                        {' '}
                        branche(s) visible(s)
                        {publishedCompositionReserveCount > 0 ? ` · ${publishedCompositionReserveCount} remplacant(s)` : ''}
                      </span>
                      {convocationBranches[0]?.published?.publishedAt ? (
                        <span>
                          Publie le
                          {' '}
                          {new Date(convocationBranches[0].published.publishedAt).toLocaleString('fr-FR')}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {canEdit ? (
                      <button
                        disabled={isStaffCompositionFetching}
                        onClick={handleManageComposition}
                        style={primaryButtonStyle}
                        type="button"
                      >
                        {isStaffCompositionFetching ? 'Chargement...' : "Gérer la composition d'équipes"}
                      </button>
                    ) : null}

                    {convocationBranches.length > 0 && viewerConvocationRole ? (
                      <button
                        onClick={() => navigation.navigate(RouteNames.PlayerConvocation, {
                          eventId,
                          teamId: compositionTeamId,
                        })}
                        style={outlineButtonStyle}
                        type="button"
                      >
                        Voir ma convocation
                      </button>
                    ) : null}

                    {convocationBranches.length > 0 && !viewerConvocationRole ? (
                      <button
                        onClick={() => navigation.navigate(RouteNames.TacticalBoardV2, {
                          aggregateBranches: convocationBranches,
                          canEdit: false,
                          compositionIntent: null,
                          editorMode: 'event',
                          editorSource: 'published',
                          editorSourceLabel: "Composition d'équipes publiée",
                          eventId,
                          eventKind: isDetectionEvent ? 'detection' : 'match',
                          eventName: compositionEventLabel,
                          eventTypeLabel: event?.type?.name || null,
                          existingComposition: convocationBranches[0]?.published || null,
                          multiTeamComposition: true,
                          readOnly: true,
                          sport: compositionSport,
                          teamId: compositionTeamId,
                          teamName: compositionEditorTeam?.name || null,
                        })}
                        style={outlineButtonStyle}
                        type="button"
                      >
                        Voir la composition publiée
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <h2 style={sectionTitleStyle}>Participants</h2>
              {renderParticipantsSection()}

              {Array.isArray(event?.teamAudiences) && event.teamAudiences.length > 0 ? (
                <div style={{ marginTop: 24 }}>
                  <EventTeamAudiencesSection
                    canManageEvent={canEdit}
                    event={event}
                    userData={userData}
                  />
                </div>
              ) : null}

              {canEdit ? (
                <>
                  <h3 style={{ ...sectionTitleStyle, fontSize: 18 }}>Demandes en attente</h3>
                  {participationRequests.length === 0 ? (
                    <div style={{ color: mutedTextColor }}>Aucune demande en attente.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                      {participationRequests.map((request) => (
                        <div
                          key={getEntityDocumentId(request) || getEntityDocumentId(request?.user)}
                          style={{
                            background: softSurfaceColor,
                            border: `1px solid ${borderColor}`,
                            borderRadius: 16,
                            display: 'grid',
                            gap: 6,
                            padding: '12px 14px',
                          }}
                        >
                          <span style={{ color: textColor, fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 14 }}>
                            {getUserDisplayName(request?.user)}
                          </span>
                          <span style={{ color: mutedTextColor, fontSize: 13 }}>
                            Statut:
                            {' '}
                            {request?.participationStatus || 'pending'}
                          </span>
                          {request?.sourceTeam?.name ? (
                            <span style={{ color: mutedTextColor, fontSize: 13 }}>
                              Equipe source:
                              {' '}
                              {request.sourceTeam.name}
                            </span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : null}
            </section>

            <section style={{ display: 'grid', gap: 24 }}>
              <div style={{
                background: sectionBackground, border: `1px solid ${borderColor}`, borderRadius: 24, display: 'grid', gap: 14, padding: 22,
              }}
              >
                <h2 style={sectionTitleStyle}>Infos rapides</h2>
                <div style={{ display: 'grid', gap: 12 }}>
                  {[
                    { label: 'Type', value: event?.type?.name || 'Non défini' },
                    { label: 'Equipe', value: event?.team?.name || 'Non définie' },
                    { label: 'Section', value: event?.team?.section?.name || 'Non définie' },
                    { label: 'Capacite', value: event?.capacity ?? 'Libre' },
                    ...(!trainingOpenConfig.isOpenTraining
                      ? [{ label: 'Joueurs attendus', value: event?.totalPlayers ?? 'Non défini' }]
                      : []),
                    { label: 'Prix / personne', value: event?.pricePerPerson != null ? `${event.pricePerPerson} EUR` : 'Gratuit ou non défini' },
                  ].map((item, index, rows) => (
                    <div
                      key={item.label}
                      style={{
                        borderBottom: index < rows.length - 1 ? `1px solid ${borderColor}` : 'none',
                        display: 'grid',
                        gap: 4,
                        paddingBottom: index < rows.length - 1 ? 12 : 0,
                      }}
                    >
                      <span style={{
                        color: mutedTextColor, fontSize: 12, letterSpacing: '0.06em', textTransform: 'uppercase',
                      }}
                      >
                        {item.label}
                      </span>
                      <span style={{ color: textColor, fontFamily: 'Montserrat-SemiBold, Montserrat-Bold, sans-serif', fontSize: 15 }}>
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {isTournamentEvent ? (
                <div
                  data-event-section="tournament"
                  style={{
                    background: sectionBackground,
                    border: `1px solid ${borderColor}`,
                    borderRadius: 24,
                    display: 'grid',
                    gap: 14,
                    padding: 22,
                  }}
                >
                  <h2 style={sectionTitleStyle}>Mode tournoi</h2>
                  <div style={{
                    color: mutedTextColor, display: 'grid', fontSize: 14, gap: 10,
                  }}
                  >
                    <span>
                      Validation des equipes:
                      {event?.tournamentConfig?.registrationMode === 'auto' ? 'Automatique' : 'Manuelle'}
                    </span>
                    <span>
                      Max equipes:
                      {event?.tournamentConfig?.maxTeams ?? 'Non limite'}
                    </span>
                    <span>
                      Effectif:
                      {event?.tournamentConfig?.minRosterSize ?? 'Libre'}
                      {' '}
                      -
                      {event?.tournamentConfig?.maxRosterSize ?? 'Libre'}
                    </span>
                    <span>
                      Equipes ephemeres:
                      {event?.tournamentConfig?.allowCustomTeams !== false ? 'Autorisees' : 'Desactivees'}
                    </span>
                    <span>
                      Mix clubs:
                      {event?.tournamentConfig?.allowCrossClubPlayers === true ? 'Autorise' : 'Non autorise'}
                    </span>
                  </div>
                  {String(event?.tournamentConfig?.rulesText || '').trim() ? (
                    <div style={{ color: textColor, fontSize: 14, lineHeight: 1.6 }}>
                      {String(event?.tournamentConfig?.rulesText || '').trim()}
                    </div>
                  ) : null}
                  <div style={{
                    color: mutedTextColor, display: 'flex', flexWrap: 'wrap', fontSize: 13, gap: 12,
                  }}
                  >
                    <span>
                      {tournamentTeams.length}
                      {' '}
                      equipe(s)
                    </span>
                    <span>
                      {tournamentTeamCounters.pending}
                      {' '}
                      en attente
                    </span>
                    <span>
                      {tournamentTeamCounters.accepted}
                      {' '}
                      validee(s)
                    </span>
                    <span>
                      {tournamentTeamCounters.warning}
                      {' '}
                      warning(s)
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <button
                      onClick={() => navigation.navigate(RouteNames.TournamentManagement, { eventId })}
                      style={{
                        background: canEdit ? accentColor : 'transparent',
                        border: canEdit ? 0 : `1px solid ${borderColor}`,
                        borderRadius: 999,
                        color: textColor,
                        cursor: 'pointer',
                        fontFamily: canEdit ? 'Montserrat-Bold, sans-serif' : 'Montserrat-Regular, sans-serif',
                        padding: '10px 16px',
                      }}
                      type="button"
                    >
                      {canEdit ? 'Piloter la compétition' : 'Voir la compétition'}
                    </button>
                    {canEdit ? (
                      <button
                        onClick={() => navigation.navigate(RouteNames.TournamentSettingsEdit, { eventId })}
                        style={primaryButtonStyle}
                        type="button"
                      >
                        Modifier les paramètres
                      </button>
                    ) : null}
                    {managedTournamentTeam?.documentId ? (
                      <button
                        onClick={() => handleOpenTournamentTeam(managedTournamentTeam.documentId)}
                        style={{
                          background: 'transparent',
                          border: `1px solid ${borderColor}`,
                          borderRadius: 999,
                          color: textColor,
                          cursor: 'pointer',
                          padding: '10px 16px',
                        }}
                        type="button"
                      >
                        Gérer mon équipe
                      </button>
                    ) : null}
                    {!managedTournamentTeam?.documentId && currentUserTournamentTeam?.documentId ? (
                      <button
                        onClick={() => handleOpenTournamentTeam(currentUserTournamentTeam.documentId)}
                        style={{
                          background: 'transparent',
                          border: `1px solid ${borderColor}`,
                          borderRadius: 999,
                          color: textColor,
                          cursor: 'pointer',
                          padding: '10px 16px',
                        }}
                        type="button"
                      >
                        Voir mon équipe
                      </button>
                    ) : null}
                    {!managedTournamentTeam?.documentId && !currentUserTournamentTeam?.documentId && currentUserPendingTournamentTeam?.documentId ? (
                      <button
                        onClick={() => handleOpenTournamentTeam(currentUserPendingTournamentTeam.documentId)}
                        style={{
                          background: 'transparent',
                          border: `1px solid ${borderColor}`,
                          borderRadius: 999,
                          color: textColor,
                          cursor: 'pointer',
                          padding: '10px 16px',
                        }}
                        type="button"
                      >
                        {normalizeTournamentText(
                          currentUserPendingTournamentTeam?.members?.find(
                            (member) => member?.user?.documentId === userData?.documentId,
                          )?.responseStatus,
                        ) === 'invited' ? 'Répondre à mon invitation' : 'Suivre ma demande'}
                      </button>
                    ) : null}
                    {canRegisterTournamentSourceTeam ? (
                      <button
                        disabled={registerTournamentTeamMutation.isPending}
                        onClick={handleRegisterTournamentTeam}
                        style={{
                          background: 'transparent',
                          border: `1px solid ${borderColor}`,
                          borderRadius: 999,
                          color: textColor,
                          cursor: registerTournamentTeamMutation.isPending ? 'not-allowed' : 'pointer',
                          opacity: registerTournamentTeamMutation.isPending ? 0.7 : 1,
                          padding: '10px 16px',
                        }}
                        type="button"
                      >
                        Inscrire mon équipe
                      </button>
                    ) : null}
                    {canCreateCustomTournamentTeam ? (
                      <button
                        disabled={createTournamentTeamMutation.isPending}
                        onClick={handleCreateTournamentTeam}
                        style={{
                          background: 'transparent',
                          border: `1px solid ${borderColor}`,
                          borderRadius: 999,
                          color: textColor,
                          cursor: createTournamentTeamMutation.isPending ? 'not-allowed' : 'pointer',
                          opacity: createTournamentTeamMutation.isPending ? 0.7 : 1,
                          padding: '10px 16px',
                        }}
                        type="button"
                      >
                        Créer une équipe
                      </button>
                    ) : null}
                  </div>
                  {tournamentTeams.length === 0 ? (
                    <div style={{ color: mutedTextColor, fontSize: 14 }}>
                      Aucune équipe n est encore inscrite.
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {tournamentTeams.map((team) => {
                        const rosterSummary = getTournamentRosterSummary(team, tournamentConfig);
                        const hasRosterWarning = isTournamentTeamNonCompliant(team, tournamentConfig);
                        const status = normalizeTournamentText(team?.status);
                        const statusLabel = getTournamentTeamStatusLabel(status);

                        return (
                          <div
                            key={getEntityDocumentId(team) || team?.name}
                            style={{
                              background: softSurfaceColor,
                              border: `1px solid ${borderColor}`,
                              borderRadius: 16,
                              display: 'grid',
                              gap: 8,
                              padding: '12px 14px',
                            }}
                          >
                            <div style={{
                              alignItems: 'center', display: 'flex', gap: 12, justifyContent: 'space-between',
                            }}
                            >
                              <div style={{ display: 'grid', gap: 4 }}>
                                <span style={{ color: textColor, fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 14 }}>
                                  {team?.name || 'Équipe tournoi'}
                                </span>
                                <span style={{ color: mutedTextColor, fontSize: 13 }}>
                                  {team?.sourceType === 'club_team'
                                    ? `Depuis ${team?.sourceTeam?.name || 'une équipe club'}`
                                    : 'Équipe éphémère'}
                                </span>
                              </div>
                              <span style={{ color: accentColor, fontSize: 13 }}>
                                {statusLabel}
                              </span>
                            </div>
                            <div style={{
                              color: mutedTextColor, display: 'flex', flexWrap: 'wrap', fontSize: 13, gap: 12,
                            }}
                            >
                              <span>
                                {rosterSummary.totalCount}
                                {' '}
                                roster
                              </span>
                              <span>
                                {rosterSummary.presentCount}
                                {' '}
                                presents
                              </span>
                              <span>
                                {rosterSummary.pendingCount}
                                {' '}
                                en attente
                              </span>
                              {rosterSummary.invitedCount > 0 ? (
                                <span>
                                  {rosterSummary.invitedCount}
                                  {' '}
                                  invitation(s)
                                </span>
                              ) : null}
                              {rosterSummary.requestedCount > 0 ? (
                                <span>
                                  {rosterSummary.requestedCount}
                                  {' '}
                                  demande(s)
                                </span>
                              ) : null}
                              {hasRosterWarning ? <span style={{ color: '#ffd54a' }}>Warning roster</span> : null}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                              <button
                                onClick={() => handleOpenTournamentTeam(team?.documentId)}
                                style={{
                                  background: 'transparent',
                                  border: `1px solid ${borderColor}`,
                                  borderRadius: 999,
                                  color: textColor,
                                  cursor: 'pointer',
                                  padding: '9px 14px',
                                }}
                                type="button"
                              >
                                Ouvrir l équipe
                              </button>
                              {canEdit && status === 'pending' ? (
                                <>
                                  <button
                                    onClick={() => handleReviewTournamentTeam(team?.documentId, 'accepted')}
                                    style={{
                                      ...primaryButtonStyle,
                                      padding: '9px 14px',
                                    }}
                                    type="button"
                                  >
                                    Valider
                                  </button>
                                  <button
                                    onClick={() => handleReviewTournamentTeam(team?.documentId, 'declined')}
                                    style={{
                                      background: 'transparent',
                                      border: '1px solid rgba(255, 107, 129, 0.38)',
                                      borderRadius: 999,
                                      color: '#ff6b81',
                                      cursor: 'pointer',
                                      padding: '9px 14px',
                                    }}
                                    type="button"
                                  >
                                    Refuser
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}

              <div style={{
                background: sectionBackground, border: `1px solid ${borderColor}`, borderRadius: 24, display: 'grid', gap: 14, padding: 22,
              }}
              >
                <h2 style={sectionTitleStyle}>Équipes invitées</h2>
                {invitedTeams.length === 0 ? (
                  <div style={{ color: mutedTextColor }}>Aucune équipe invitée.</div>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {invitedTeams.map((team) => (
                      <div
                        key={getEntityDocumentId(team) || team?.name}
                        style={{
                          background: softSurfaceColor, border: `1px solid ${borderColor}`, borderRadius: 16, padding: '12px 14px',
                        }}
                      >
                        <div style={{ color: textColor, fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 14 }}>{team?.name || 'Equipe'}</div>
                        <div style={{ color: mutedTextColor, fontSize: 13 }}>{team?.club?.name || team?.section?.name || ''}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {detectedPlayers.length > 0 ? (
                <div style={{
                  background: sectionBackground, border: `1px solid ${borderColor}`, borderRadius: 24, display: 'grid', gap: 14, padding: 22,
                }}
                >
                  <h2 style={sectionTitleStyle}>Absences / manques</h2>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {detectedPlayers.map((player) => (
                      <div key={getEntityDocumentId(player) || getUserDisplayName(player)} style={{ color: mutedTextColor, fontSize: 14 }}>
                        {getUserDisplayName(player)}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </div>
    </ScreenContainer>
  );
}

export default EventDetails;
