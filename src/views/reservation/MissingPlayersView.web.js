import { useMutation, useQueryClient } from '@tanstack/react-query';
import { differenceInHours, formatDistanceToNowStrict, isBefore, startOfDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useMemo, useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { BREAKPOINTS } from '@/responsive';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { RouteNames } from '@/navigation/routeNames';
import { joinReservation } from '@/services/reservation/reservationService';
import { useGetReservations } from '@/services/reservation/reservationQueries';
import useTheme from '@/theme/themeContext';

const flattenReservationPages = (pages) => {
  if (!Array.isArray(pages)) return [];
  return pages.flatMap((page) => (Array.isArray(page?.data) ? page.data : []));
};

const getReservationLabel = (reservation) => {
  return reservation?.name
    || reservation?.team?.activities?.[0]?.name
    || reservation?.reservationActivity?.name
    || 'Reservation';
};

const getLocationLabel = (reservation) => {
  const rawDetails = reservation?.locationDetails;

  if (typeof rawDetails === 'string' && rawDetails.trim()) {
    try {
      const parsed = JSON.parse(rawDetails);
      return parsed?.address?.description
        || parsed?.address?.label
        || parsed?.address?.address
        || rawDetails;
    } catch {
      return rawDetails;
    }
  }

  if (typeof reservation?.location === 'string') return reservation.location;
  if (reservation?.location?.label) return reservation.location.label;
  if (reservation?.location?.address) return reservation.location.address;
  return '';
};

const formatReservationDate = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'long',
  });
};

function MissingPlayersView({ navigation }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= BREAKPOINTS.desktop;
  const isTablet = width >= BREAKPOINTS.tablet;
  const { Colors } = useTheme();
  const queryClient = useQueryClient();
  const [activeReservationId, setActiveReservationId] = useState('');

  const {
    data: reservationPages,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
  } = useGetReservations({
    pageSize: 24,
    startDateAfter: startOfDay(new Date()).toISOString(),
  });

  const reservations = useMemo(() => {
    const allReservations = flattenReservationPages(reservationPages?.pages);
    const filteredReservations = allReservations.filter((reservation) => {
      const isShared = reservation?.bookingStatus === 'shared' || reservation?.reservationMode === 'RECRUITING';
      const hasMissingPlayers = Number(reservation?.missingPlayers || 0) > 0;
      const isFuture = reservation?.date && !isBefore(new Date(reservation.date), new Date());
      return isShared && hasMissingPlayers && isFuture;
    });

    return filteredReservations.sort((left, right) => {
      if (left?.isLastMinuteAlert && !right?.isLastMinuteAlert) return -1;
      if (!left?.isLastMinuteAlert && right?.isLastMinuteAlert) return 1;
      return differenceInHours(new Date(left?.date || 0), new Date()) - differenceInHours(new Date(right?.date || 0), new Date());
    });
  }, [reservationPages?.pages]);

  const joinReservationMutation = useMutation({
    mutationFn: (reservationId) => joinReservation(reservationId),
    onMutate: (reservationId) => {
      setActiveReservationId(String(reservationId || ''));
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['reservations'] }),
        queryClient.invalidateQueries({ queryKey: ['events'] }),
        queryClient.invalidateQueries({ queryKey: ['planning', 'personal'] }),
      ]);
      setActiveReservationId('');
      refetch();
      window.alert('Participation confirmee.');
    },
    onError: (joinError) => {
      setActiveReservationId('');
      window.alert(joinError?.message || 'Impossible de rejoindre cette reservation.');
    },
  });

  const borderColor = 'rgba(255,255,255,0.08)';
  const panelBackground = 'rgba(6, 19, 29, 0.78)';
  const cardBackground = 'rgba(8, 26, 39, 0.9)';
  const textColor = Colors?.neutral00 || '#ffffff';
  const mutedTextColor = Colors?.neutral300 || '#adb1b2';
  const accentColor = Colors?.primary500 || '#01b3f4';
  const urgentCount = reservations.filter((reservation) => reservation?.isLastMinuteAlert).length;

  return (
    <ScreenContainer
      bgImage="bg2"
      contentWidth="wide"
      responsivePadding
      style={{ paddingBottom: 32 }}
    >
      <div style={{ color: textColor, display: 'grid', gap: 24 }}>
        <section style={{ background: panelBackground, border: `1px solid ${borderColor}`, borderRadius: 28, padding: isTablet ? 28 : 20 }}>
          <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', marginBottom: 18 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: accentColor, fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Reservations partagees
              </span>
              <h1 style={{ fontFamily: 'Montserrat-Black, sans-serif', fontSize: isTablet ? 34 : 28, margin: 0 }}>
                Joueurs recherches
              </h1>
              <p style={{ color: mutedTextColor, margin: 0, maxWidth: 720 }}>
                Rejoins rapidement les réservations ouvertes qui cherchent encore des joueurs, avec priorité sur les SOS de dernière minute.
              </p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <button
                onClick={() => navigation.navigate(RouteNames.SearchReservations)}
                style={{ background: 'transparent', border: `1px solid ${borderColor}`, borderRadius: 999, color: textColor, cursor: 'pointer', padding: '10px 14px' }}
                type="button"
              >
                Voir toutes les reservations
              </button>
              <button
                onClick={() => refetch()}
                style={{ background: accentColor, border: 0, borderRadius: 999, color: '#04131d', cursor: 'pointer', fontFamily: 'Montserrat-Bold, sans-serif', padding: '10px 14px' }}
                type="button"
              >
                Rafraîchir
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: isDesktop ? 'repeat(3, minmax(0, 1fr))' : '1fr' }}>
            {[
              { label: 'Reservations ouvertes', value: reservations.length },
              { label: 'SOS urgents', value: urgentCount },
              { label: 'A pourvoir', value: reservations.reduce((sum, reservation) => sum + Number(reservation?.missingPlayers || 0), 0) },
            ].map((item) => (
              <div key={item.label} style={{ background: cardBackground, border: `1px solid ${borderColor}`, borderRadius: 20, display: 'grid', gap: 6, padding: 18 }}>
                <span style={{ color: mutedTextColor, fontSize: 13 }}>{item.label}</span>
                <strong style={{ fontFamily: 'Montserrat-Black, sans-serif', fontSize: 30 }}>{item.value}</strong>
              </div>
            ))}
          </div>
        </section>

        {error ? (
          <section style={{ background: 'rgba(160, 40, 40, 0.18)', border: '1px solid rgba(255,120,120,0.28)', borderRadius: 20, color: '#ffd6d6', padding: 18 }}>
            {error?.message || 'Impossible de charger les reservations.'}
          </section>
        ) : null}

        {isLoading ? (
          <section style={{ background: cardBackground, border: `1px solid ${borderColor}`, borderRadius: 24, color: mutedTextColor, padding: 24 }}>
            Chargement des reservations…
          </section>
        ) : reservations.length === 0 ? (
          <section style={{ background: cardBackground, border: `1px solid ${borderColor}`, borderRadius: 24, display: 'grid', gap: 8, justifyItems: 'start', padding: 24 }}>
            <h2 style={{ fontFamily: 'Montserrat-Bold, sans-serif', margin: 0 }}>Aucune reservation ouverte pour l’instant</h2>
            <p style={{ color: mutedTextColor, margin: 0 }}>
              Reviens plus tard ou passe par la recherche pour voir toutes les reservations disponibles.
            </p>
          </section>
        ) : (
          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: isDesktop ? 'repeat(2, minmax(0, 1fr))' : '1fr' }}>
            {reservations.map((reservation) => {
              const reservationId = String(reservation?.documentId || '');
              const isJoining = joinReservationMutation.isPending && activeReservationId === reservationId;
              const clubName = reservation?.team?.club?.name || reservation?.club?.name || 'Club';
              const missingPlayers = Number(reservation?.missingPlayers || 0);
              const totalPlayers = Number(reservation?.totalPlayers || 0);
              const currentPlayers = Number(reservation?.currentPlayers || 0);
              const timeToGo = reservation?.date
                ? formatDistanceToNowStrict(new Date(reservation.date), { addSuffix: true, locale: fr })
                : '';

              return (
                <article key={reservationId} style={{ background: cardBackground, border: `1px solid ${borderColor}`, borderRadius: 24, display: 'grid', gap: 16, padding: isTablet ? 22 : 18 }}>
                  <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
                    <div style={{ display: 'grid', gap: 8 }}>
                      <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {reservation?.isLastMinuteAlert ? (
                          <span style={{ background: 'rgba(255, 107, 53, 0.16)', border: '1px solid rgba(255, 107, 53, 0.34)', borderRadius: 999, color: '#ffb399', fontSize: 12, padding: '5px 10px' }}>
                            SOS urgent
                          </span>
                        ) : null}
                        <span style={{ background: 'rgba(1,179,244,0.12)', border: `1px solid ${borderColor}`, borderRadius: 999, color: accentColor, fontSize: 12, padding: '5px 10px' }}>
                          {clubName}
                        </span>
                      </div>
                      <h2 style={{ fontFamily: 'Montserrat-Bold, sans-serif', fontSize: 24, margin: 0 }}>
                        {getReservationLabel(reservation)}
                      </h2>
                    </div>
                    <strong style={{ color: accentColor, fontFamily: 'Montserrat-Black, sans-serif', fontSize: 28 }}>
                      {missingPlayers}
                    </strong>
                  </div>

                  <div style={{ display: 'grid', gap: 10, gridTemplateColumns: isTablet ? 'repeat(2, minmax(0, 1fr))' : '1fr' }}>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${borderColor}`, borderRadius: 18, display: 'grid', gap: 4, padding: 14 }}>
                      <span style={{ color: mutedTextColor, fontSize: 12 }}>Date</span>
                      <strong style={{ fontFamily: 'Montserrat-Bold, sans-serif' }}>{formatReservationDate(reservation?.date)}</strong>
                      <span style={{ color: accentColor, fontSize: 12 }}>{timeToGo}</span>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${borderColor}`, borderRadius: 18, display: 'grid', gap: 4, padding: 14 }}>
                      <span style={{ color: mutedTextColor, fontSize: 12 }}>Composition</span>
                      <strong style={{ fontFamily: 'Montserrat-Bold, sans-serif' }}>
                        {currentPlayers}
                        {' / '}
                        {totalPlayers || '—'}
                      </strong>
                      <span style={{ color: mutedTextColor, fontSize: 12 }}>
                        {missingPlayers}
                        {' '}
                        place{missingPlayers > 1 ? 's' : ''} restante{missingPlayers > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 8 }}>
                    {getLocationLabel(reservation) ? (
                      <p style={{ color: mutedTextColor, margin: 0 }}>
                        {getLocationLabel(reservation)}
                      </p>
                    ) : null}
                    <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {reservation?.pricePerPerson != null ? (
                        <span style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${borderColor}`, borderRadius: 999, padding: '6px 10px' }}>
                          {reservation.pricePerPerson}
                          {' '}
                          EUR / joueur
                        </span>
                      ) : null}
                      <span style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${borderColor}`, borderRadius: 999, padding: '6px 10px' }}>
                        {reservation?.bookingStatus === 'shared' ? 'Ouverte' : 'En recherche'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <button
                      onClick={() => navigation.navigate(RouteNames.ReservationDetails, { reservationId })}
                      style={{ background: 'transparent', border: `1px solid ${borderColor}`, borderRadius: 999, color: textColor, cursor: 'pointer', padding: '11px 15px' }}
                      type="button"
                    >
                      Voir le detail
                    </button>
                    <button
                      disabled={isJoining}
                      onClick={() => joinReservationMutation.mutate(reservationId)}
                      style={{
                        background: isJoining ? 'rgba(255,255,255,0.14)' : accentColor,
                        border: 0,
                        borderRadius: 999,
                        color: '#04131d',
                        cursor: isJoining ? 'not-allowed' : 'pointer',
                        fontFamily: 'Montserrat-Bold, sans-serif',
                        padding: '11px 15px',
                      }}
                      type="button"
                    >
                      {isJoining ? 'Participation…' : 'Rejoindre'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {hasNextPage ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              disabled={isFetchingNextPage}
              onClick={() => fetchNextPage()}
              style={{
                background: 'transparent',
                border: `1px solid ${borderColor}`,
                borderRadius: 999,
                color: textColor,
                cursor: isFetchingNextPage ? 'not-allowed' : 'pointer',
                padding: '12px 18px',
              }}
              type="button"
            >
              {isFetchingNextPage ? 'Chargement…' : 'Charger plus de reservations'}
            </button>
          </div>
        ) : null}
      </div>
    </ScreenContainer>
  );
}

export default MissingPlayersView;
