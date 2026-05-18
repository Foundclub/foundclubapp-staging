// @ts-nocheck
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import { useWindowDimensions } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { getCurrentUserEventParticipationState } from '@/domains/event/participationState';
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

import { RouteNames } from '@/navigation/routeNames';

import { useGetEvent } from '@/services/event/eventQueries';
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

import { getEntityDocumentId } from '@/utils/entityId';
import getImageUrl from '@/utils/imageUrl';

/* eslint-disable perfectionist/sort-imports */
import * as LinksPlatform from '@/platform/links';
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
  return 'Aucune reponse';
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

  useEffect(() => {
    if (!fromEventCreation || !eventId) return undefined;

    const refreshTimeout = setTimeout(() => {
      refetch();
    }, 450);

    return () => clearTimeout(refreshTimeout);
  }, [eventId, fromEventCreation, refetch]);

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
  const isReservation = normalizeTypeName(event?.type?.name).includes('reservation');
  const isTournamentEvent = normalizeTypeName(event?.type?.name).includes('tournoi');
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
  const eventLink = LinksPlatform.buildDeepLink(RouteNames.EventDetails, { eventId });
  const participationLabel = getParticipationLabel(
    participationState?.effectiveStatus,
  );

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

  const handleJoin = useCallback(async () => {
    setActionError('');
    try {
      await createParticipationMutation.mutateAsync();
    } catch (joinError) {
      setActionError(joinError?.message || 'Impossible de rejoindre cet evenement.');
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

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    try {
      await SharePlatform.share({
        message: `${event?.name || event?.type?.name || 'Evenement'}\n${eventLink}`,
        title: event?.name || 'Evenement FoundClub',
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
    const proposedName = window.prompt('Nom de l equipe tournoi');
    const trimmedName = String(proposedName || '').trim();
    if (!trimmedName) return;
    setActionError('');
    try {
      await createTournamentTeamMutation.mutateAsync({ name: trimmedName });
    } catch (mutationError) {
      setActionError(mutationError?.message || 'Impossible de creer cette equipe tournoi.');
    }
  }, [createTournamentTeamMutation]);

  const handleRegisterTournamentTeam = useCallback(async () => {
    if (availableTournamentSourceTeams.length === 0) return;
    const optionsText = availableTournamentSourceTeams
      .map((team, index) => `${index + 1}. ${team?.name || 'Equipe'}`)
      .join('\n');
    const rawChoice = window.prompt(`Choisis une equipe a inscrire :\n${optionsText}`);
    const choiceIndex = Number.parseInt(String(rawChoice || '').trim(), 10) - 1;
    const sourceTeam = availableTournamentSourceTeams[choiceIndex];
    if (!sourceTeam?.documentId) return;
    setActionError('');
    try {
      await registerTournamentTeamMutation.mutateAsync(sourceTeam.documentId);
    } catch (mutationError) {
      setActionError(mutationError?.message || 'Impossible d inscrire cette equipe.');
    }
  }, [availableTournamentSourceTeams, registerTournamentTeamMutation]);

  const handleReviewTournamentTeam = useCallback(async (teamDocumentId, status) => {
    setActionError('');
    try {
      await reviewTournamentTeamMutation.mutateAsync({ status, teamDocumentId });
    } catch (mutationError) {
      setActionError(mutationError?.message || 'Impossible de mettre a jour cette equipe.');
    }
  }, [reviewTournamentTeamMutation]);

  const participants = Array.isArray(event?.participations) ? event.participations : [];
  const participationRequests = Array.isArray(event?.participationRequests) ? event.participationRequests : [];
  const invitedTeams = Array.isArray(event?.invitedTeams) ? event.invitedTeams : [];
  const detectedPlayers = Array.isArray(event?.missings) ? event.missings : [];
  const participantIdentitiesHidden = event?.participantIdentitiesHidden === true;

  const renderParticipantsSection = () => {
    if (participants.length === 0) {
      return <div style={{ color: mutedTextColor }}>Aucun participant confirme pour le moment.</div>;
    }

    if (participantIdentitiesHidden) {
      return (
        <div style={{
          background: 'rgba(255,255,255,0.04)',
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
            Les identites des participants sont masquees par l organisateur.
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
                background: 'rgba(255,255,255,0.04)',
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
                <span style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 14 }}>{displayName}</span>
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
            <span>Evenement cree. Verifie les derniers details avant de le partager.</span>
            <button
              onClick={() => navigation.navigate(RouteNames.MyEventList)}
              style={{
                background: 'transparent',
                border: `1px solid ${borderColor}`,
                borderRadius: 999,
                color: textColor,
                cursor: 'pointer',
                padding: '8px 14px',
              }}
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
                  style={{
                    background: 'transparent',
                    border: `1px solid ${borderColor}`,
                    borderRadius: 999,
                    color: textColor,
                    cursor: 'pointer',
                    padding: '10px 14px',
                  }}
                  type="button"
                >
                  Retour
                </button>
                {hasEvent ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <button
                      onClick={handleShare}
                      style={{
                        background: 'transparent',
                        border: `1px solid ${borderColor}`,
                        borderRadius: 999,
                        color: textColor,
                        cursor: 'pointer',
                        padding: '10px 14px',
                      }}
                      type="button"
                    >
                      {isSharing ? 'Partage...' : 'Partager'}
                    </button>
                    {canEdit ? (
                      <button
                        onClick={() => navigation.navigate(RouteNames.EventEdit, { eventId })}
                        style={{
                          background: accentColor,
                          border: 0,
                          borderRadius: 999,
                          color: '#001218',
                          cursor: 'pointer',
                          fontFamily: 'Montserrat-Bold, sans-serif',
                          padding: '10px 16px',
                        }}
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
                      fontFamily: 'Montserrat-Black, sans-serif', fontSize: isTablet ? 38 : 30, lineHeight: 1.1, margin: 0,
                    }}
                    >
                      {event?.name || event?.type?.name || 'Evenement'}
                    </h1>
                    <div style={{
                      color: mutedTextColor, display: 'flex', flexWrap: 'wrap', gap: 14,
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
                      <span style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 999, padding: '9px 14px' }}>
                        {event.facility.name}
                      </span>
                    ) : null}
                    {event?.validationMode ? (
                      <span style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 999, padding: '9px 14px' }}>
                        Validation
                        {' '}
                        {event.validationMode === 'manual' ? 'manuelle' : 'auto'}
                      </span>
                    ) : null}
                    {event?.sessionStatus ? (
                      <span style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 999, padding: '9px 14px' }}>
                        Session
                        {' '}
                        {event.sessionStatus === 'closed' ? 'fermee' : 'ouverte'}
                      </span>
                    ) : null}
                  </div>

                  {String(event?.description || '').trim() ? (
                    <p style={{
                      color: textColor, fontSize: 15, lineHeight: 1.65, margin: 0, maxWidth: 840,
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
                <div style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 15 }}>Mon statut</div>
                <div style={{ color: mutedTextColor, fontSize: 14, lineHeight: 1.5 }}>
                  {participationLabel}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  {!canEdit && !participationState?.isParticipating && !participationState?.hasPendingRequest ? (
                    <button
                      disabled={createParticipationMutation.isPending}
                      onClick={handleJoin}
                      style={{
                        background: accentColor,
                        border: 0,
                        borderRadius: 999,
                        color: '#001218',
                        cursor: createParticipationMutation.isPending ? 'not-allowed' : 'pointer',
                        fontFamily: 'Montserrat-Bold, sans-serif',
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
                        background: 'transparent',
                        border: `1px solid ${borderColor}`,
                        borderRadius: 999,
                        color: textColor,
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
                      style={{
                        background: 'transparent',
                        border: `1px solid ${borderColor}`,
                        borderRadius: 999,
                        color: textColor,
                        cursor: 'pointer',
                        padding: '12px 16px',
                      }}
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
                  <div style={{ color: mutedTextColor, fontSize: 13 }}>
                    Club organisateur:
                    {' '}
                    {event.team.club.name}
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
              style={{
                background: accentColor, border: 0, borderRadius: 999, color: '#001218', cursor: 'pointer', padding: '10px 16px',
              }}
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
            Chargement de l evenement...
          </section>
        ) : null}

        {!isLoading && !error && !hasEvent ? (
          <section style={{
            background: sectionBackground, border: `1px solid ${borderColor}`, borderRadius: 24, color: mutedTextColor, display: 'grid', gap: 10, padding: 22,
          }}
          >
            <div style={{ color: textColor, fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 22 }}>
              Evenement introuvable
            </div>
            <div>
              Cet evenement n est plus disponible ou n a pas pu etre charge.
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

              <h2 style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 20, margin: 0 }}>Participants</h2>
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
                  <h3 style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 18, margin: 0 }}>Demandes en attente</h3>
                  {participationRequests.length === 0 ? (
                    <div style={{ color: mutedTextColor }}>Aucune demande en attente.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 12 }}>
                      {participationRequests.map((request) => (
                        <div
                          key={getEntityDocumentId(request) || getEntityDocumentId(request?.user)}
                          style={{
                            background: 'rgba(255,255,255,0.04)',
                            border: `1px solid ${borderColor}`,
                            borderRadius: 16,
                            display: 'grid',
                            gap: 6,
                            padding: '12px 14px',
                          }}
                        >
                          <span style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 14 }}>
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
                <h2 style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 20, margin: 0 }}>Infos rapides</h2>
                <div style={{
                  color: mutedTextColor, display: 'grid', fontSize: 14, gap: 10,
                }}
                >
                  <span>
                    Type:
                    {event?.type?.name || 'Non defini'}
                  </span>
                  <span>
                    Equipe:
                    {event?.team?.name || 'Non definie'}
                  </span>
                  <span>
                    Section:
                    {event?.team?.section?.name || 'Non definie'}
                  </span>
                  <span>
                    Capacite:
                    {event?.capacity ?? 'Libre'}
                  </span>
                  <span>
                    Joueurs attendus:
                    {event?.totalPlayers ?? 'Non defini'}
                  </span>
                  <span>
                    Prix / personne:
                    {event?.pricePerPerson != null ? `${event.pricePerPerson} EUR` : 'Gratuit ou non defini'}
                  </span>
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
                  <h2 style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 20, margin: 0 }}>Mode tournoi</h2>
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
                        color: canEdit ? '#001218' : textColor,
                        cursor: 'pointer',
                        fontFamily: canEdit ? 'Montserrat-Bold, sans-serif' : 'Montserrat-Regular, sans-serif',
                        padding: '10px 16px',
                      }}
                      type="button"
                    >
                      {canEdit ? 'Piloter la competition' : 'Voir la competition'}
                    </button>
                    {canEdit ? (
                      <button
                        onClick={() => navigation.navigate(RouteNames.TournamentSettingsEdit, { eventId })}
                        style={{
                          background: accentColor,
                          border: 0,
                          borderRadius: 999,
                          color: '#001218',
                          cursor: 'pointer',
                          fontFamily: 'Montserrat-Bold, sans-serif',
                          padding: '10px 16px',
                        }}
                        type="button"
                      >
                        Modifier les parametres
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
                        Gerer mon equipe
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
                        Voir mon equipe
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
                        ) === 'invited' ? 'Repondre a mon invitation' : 'Suivre ma demande'}
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
                        Inscrire mon equipe
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
                        Creer une equipe
                      </button>
                    ) : null}
                  </div>
                  {tournamentTeams.length === 0 ? (
                    <div style={{ color: mutedTextColor, fontSize: 14 }}>
                      Aucune equipe n est encore inscrite.
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
                              background: 'rgba(255,255,255,0.04)',
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
                                <span style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 14 }}>
                                  {team?.name || 'Equipe tournoi'}
                                </span>
                                <span style={{ color: mutedTextColor, fontSize: 13 }}>
                                  {team?.sourceType === 'club_team'
                                    ? `Depuis ${team?.sourceTeam?.name || 'une equipe club'}`
                                    : 'Equipe ephemere'}
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
                                Ouvrir l equipe
                              </button>
                              {canEdit && status === 'pending' ? (
                                <>
                                  <button
                                    onClick={() => handleReviewTournamentTeam(team?.documentId, 'accepted')}
                                    style={{
                                      background: accentColor,
                                      border: 0,
                                      borderRadius: 999,
                                      color: '#001218',
                                      cursor: 'pointer',
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
                <h2 style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 20, margin: 0 }}>Equipes invitees</h2>
                {invitedTeams.length === 0 ? (
                  <div style={{ color: mutedTextColor }}>Aucune equipe invitee.</div>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {invitedTeams.map((team) => (
                      <div
                        key={getEntityDocumentId(team) || team?.name}
                        style={{
                          background: 'rgba(255,255,255,0.04)', border: `1px solid ${borderColor}`, borderRadius: 16, padding: '12px 14px',
                        }}
                      >
                        <div style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 14 }}>{team?.name || 'Equipe'}</div>
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
                  <h2 style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 20, margin: 0 }}>Absences / manques</h2>
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
