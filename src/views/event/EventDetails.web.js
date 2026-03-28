import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions } from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import { getCurrentUserEventParticipationState } from '@/domains/event/participationState';
import { BREAKPOINTS } from '@/responsive';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { RouteNames } from '@/navigation/routeNames';
import { buildDeepLink } from '@/platform/links';
import { share } from '@/platform/share';
import { useGetEvent } from '@/services/event/eventQueries';
import {
  createEventParticipation,
  deleteEventParticipation,
} from '@/services/eventParticipation/eventParticipationService';
import { useGetEventParticipations } from '@/services/eventParticipation/eventParticipationQueries';
import useTheme from '@/theme/themeContext';
import { getEntityDocumentId } from '@/utils/entityId';
import getImageUrl from '@/utils/imageUrl';

const flattenPages = (pages) => {
  if (!Array.isArray(pages)) return [];
  return pages.flatMap((page) => (Array.isArray(page?.data) ? page.data : []));
};

const formatDate = (value, options = {}) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('fr-FR', options);
};

const formatDateLabel = (value) => formatDate(value, {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

const formatDateTimeLabel = (value) => formatDate(value, {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
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

function EventDetails({ navigation, route }) {
  const { eventId } = route?.params || {};
  const { width } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINTS.desktop;
  const isTablet = width >= BREAKPOINTS.tablet;
  const { t } = useTranslation();
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
  } = useGetEvent(eventId || '');
  const {
    data: myParticipationPages,
  } = useGetEventParticipations(eventId || '', userData?.documentId, {
    includeInactive: true,
    pageSize: 20,
  }, {
    enabled: Boolean(eventId && userData?.documentId),
  });
  const [isSharing, setIsSharing] = useState(false);

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
  const isReservation = normalizeTypeName(event?.type?.name).includes('reservation');
  const facilityId = getEntityDocumentId(event?.facility);
  const eventLink = buildDeepLink(RouteNames.EventDetails, { eventId });
  const participationLabel = participationState?.effectiveStatus === 'accepted'
    ? 'Tu participes'
    : participationState?.effectiveStatus === 'pending'
      ? 'En attente de validation'
      : participationState?.effectiveStatus === 'missing'
        ? 'Tu es signale absent'
        : 'Aucune reponse';

  const invalidateEventQueries = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['event', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['eventParticipations', eventId] }),
      queryClient.invalidateQueries({ queryKey: ['events'] }),
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

  const activeParticipationRequestId = getEntityDocumentId(participationState?.activeRequest);
  const heroImage = getImageUrl(event?.team?.club?.logo?.url || event?.team?.club?.sponsor?.logo?.url || '');
  const sectionBackground = 'rgba(6, 19, 29, 0.76)';
  const borderColor = 'rgba(255,255,255,0.08)';
  const textColor = Colors?.neutral00 || '#ffffff';
  const mutedTextColor = Colors?.neutral300 || '#adb1b2';
  const accentColor = Colors?.primary500 || '#01b3f4';

  const handleJoin = useCallback(async () => {
    try {
      await createParticipationMutation.mutateAsync();
    } catch (joinError) {
      window.alert(joinError?.message || 'Impossible de rejoindre cet evenement.');
    }
  }, [createParticipationMutation]);

  const handleCancelParticipation = useCallback(async () => {
    if (!activeParticipationRequestId) return;
    try {
      await cancelParticipationMutation.mutateAsync(activeParticipationRequestId);
    } catch (cancelError) {
      window.alert(cancelError?.message || 'Impossible d annuler cette participation.');
    }
  }, [activeParticipationRequestId, cancelParticipationMutation]);

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    try {
      await share({
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

  const participants = Array.isArray(event?.participations) ? event.participations : [];
  const participationRequests = Array.isArray(event?.participationRequests) ? event.participationRequests : [];
  const invitedTeams = Array.isArray(event?.invitedTeams) ? event.invitedTeams : [];
  const detectedPlayers = Array.isArray(event?.missings) ? event.missings : [];

  return (
    <ScreenContainer
      bgImage="bg2"
      contentWidth="wide"
      responsivePadding
      style={{ paddingBottom: 32 }}
    >
      <div style={{ color: textColor, display: 'grid', gap: 24 }}>
        <section
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
              gridTemplateColumns: isDesktop ? 'minmax(0, 1.2fr) 320px' : 'minmax(0, 1fr)',
            }}
          >
            <div style={{ display: 'grid', gap: 18, padding: isTablet ? 32 : 22 }}>
              <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
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
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                <span style={{ color: accentColor, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {event?.type?.name || 'Evenement'}
                </span>
                <h1 style={{ fontFamily: 'Montserrat-Black, sans-serif', fontSize: isTablet ? 38 : 30, lineHeight: 1.1, margin: 0 }}>
                  {event?.name || event?.type?.name || 'Evenement'}
                </h1>
                <div style={{ color: mutedTextColor, display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                  <span>{formatDateTimeLabel(event?.date)}</span>
                  {event?.startTime ? <span>{formatTimeLabel(event?.startTime)} - {formatTimeLabel(event?.endTime)}</span> : null}
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
                    Validation {event.validationMode === 'manual' ? 'manuelle' : 'auto'}
                  </span>
                ) : null}
                {event?.sessionStatus ? (
                  <span style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 999, padding: '9px 14px' }}>
                    Session {event.sessionStatus === 'closed' ? 'fermee' : 'ouverte'}
                  </span>
                ) : null}
              </div>

              {String(event?.description || '').trim() ? (
                <p style={{ color: textColor, fontSize: 15, lineHeight: 1.65, margin: 0, maxWidth: 840 }}>
                  {String(event?.description || '').trim()}
                </p>
              ) : null}
            </div>

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
              {event?.team?.club?.name ? (
                <div style={{ color: mutedTextColor, fontSize: 13 }}>
                  Club organisateur: {event.team.club.name}
                </div>
              ) : null}
            </div>
          </div>
        </section>

        {error ? (
          <section style={{ background: sectionBackground, border: `1px solid ${borderColor}`, borderRadius: 24, padding: 22 }}>
            <div style={{ color: '#ff6b81', fontFamily: 'Montserrat-Bold, sans-serif', marginBottom: 8 }}>Chargement impossible</div>
            <div style={{ color: mutedTextColor, marginBottom: 14 }}>{error?.message || 'Une erreur est survenue.'}</div>
            <button
              onClick={() => refetch()}
              style={{ background: accentColor, border: 0, borderRadius: 999, color: '#001218', cursor: 'pointer', padding: '10px 16px' }}
              type="button"
            >
              Recharger
            </button>
          </section>
        ) : null}

        {isLoading ? (
          <section style={{ background: sectionBackground, border: `1px solid ${borderColor}`, borderRadius: 24, color: mutedTextColor, padding: 22 }}>
            Chargement de l evenement...
          </section>
        ) : null}

        {!isLoading && event ? (
          <div style={{ display: 'grid', gap: 24, gridTemplateColumns: isDesktop ? 'minmax(0, 1.15fr) minmax(300px, 0.85fr)' : 'minmax(0, 1fr)' }}>
            <section style={{ background: sectionBackground, border: `1px solid ${borderColor}`, borderRadius: 24, display: 'grid', gap: 18, padding: 22 }}>
              <h2 style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 20, margin: 0 }}>Participants</h2>
              {participants.length === 0 ? (
                <div style={{ color: mutedTextColor }}>Aucun participant confirme pour le moment.</div>
              ) : (
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
                            style={{ borderRadius: '50%', height: 42, objectFit: 'cover', width: 42 }}
                          />
                        ) : (
                          <div style={{ alignItems: 'center', background: 'rgba(1,179,244,0.16)', borderRadius: '50%', display: 'inline-flex', height: 42, justifyContent: 'center', width: 42 }}>
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
              )}

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
                            Statut: {request?.participationStatus || 'pending'}
                          </span>
                          {request?.sourceTeam?.name ? (
                            <span style={{ color: mutedTextColor, fontSize: 13 }}>
                              Equipe source: {request.sourceTeam.name}
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
              <div style={{ background: sectionBackground, border: `1px solid ${borderColor}`, borderRadius: 24, display: 'grid', gap: 14, padding: 22 }}>
                <h2 style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 20, margin: 0 }}>Infos rapides</h2>
                <div style={{ color: mutedTextColor, display: 'grid', gap: 10, fontSize: 14 }}>
                  <span>Type: {event?.type?.name || 'Non defini'}</span>
                  <span>Equipe: {event?.team?.name || 'Non definie'}</span>
                  <span>Section: {event?.team?.section?.name || 'Non definie'}</span>
                  <span>Capacite: {event?.capacity ?? 'Libre'}</span>
                  <span>Joueurs attendus: {event?.totalPlayers ?? 'Non defini'}</span>
                  <span>Prix / personne: {event?.pricePerPerson != null ? `${event.pricePerPerson} EUR` : 'Gratuit ou non defini'}</span>
                </div>
              </div>

              <div style={{ background: sectionBackground, border: `1px solid ${borderColor}`, borderRadius: 24, display: 'grid', gap: 14, padding: 22 }}>
                <h2 style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 20, margin: 0 }}>Equipes invitees</h2>
                {invitedTeams.length === 0 ? (
                  <div style={{ color: mutedTextColor }}>Aucune equipe invitee.</div>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    {invitedTeams.map((team) => (
                      <div
                        key={getEntityDocumentId(team) || team?.name}
                        style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${borderColor}`, borderRadius: 16, padding: '12px 14px' }}
                      >
                        <div style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 14 }}>{team?.name || 'Equipe'}</div>
                        <div style={{ color: mutedTextColor, fontSize: 13 }}>{team?.club?.name || team?.section?.name || ''}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {detectedPlayers.length > 0 ? (
                <div style={{ background: sectionBackground, border: `1px solid ${borderColor}`, borderRadius: 24, display: 'grid', gap: 14, padding: 22 }}>
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
