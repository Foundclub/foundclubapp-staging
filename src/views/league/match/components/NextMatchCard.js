import { useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Image, ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import { navigateToEndMatchScreen } from '@/views/league/match/utils/leagueNavigation';
import buildLeagueWorkflowViewModel from '@/views/league/match/utils/leagueWorkflowPresenter';
import {
  getMatchDerivedPhase,
  isMatchPastEnd,
  normalizeMatchStatus,
  shouldMaskOpponentIdentity,
} from '@/views/league/match/utils/matchStatus';
import { getProposalLocationLabel } from '@/views/league/match/utils/proposalPayload';

import { RouteNames } from '@/navigation/routeNames';

import { markVenueBooked as markEventVenueBooked, missingEvent } from '@/services/event/eventService';
import { createEventParticipation } from '@/services/eventParticipation/eventParticipationService';
import {
  cancelMatch,
  confirmParticipation,
  declineParticipation,
  getCancellationPenalty,
  markVenueBooked as markLeagueMatchVenueBooked,
} from '@/services/league/leagueMatchService';

import { areSameEntityId, getEntityDocumentId } from '@/utils/entityId';
import { getImageUrl } from '@/utils/imageUrl';
import { isLeagueCaptain } from '@/utils/league/captains';
import {
  doesMatchRequireVenue,
  getMatchDurationMinutes,
  getRequiredPlayersForSport,
} from '@/utils/leagueSportConfig';

import { LEAGUE_LEGAL_SCOPES } from '@/constants/leagueLegalAcceptance';
import useLeagueLegalAcceptance from '@/hooks/useLeagueLegalAcceptance';

const BG_MATCH = require('@/assets/background-card-event/card-match.png');

/**
 * @param {LeagueMatch | null} match
 * @returns {string}
 */
const resolveAddressLabel = (match) => {
  const location = match?.location;
  if (typeof location === 'string') return location;
  if (location && typeof location === 'object') {
    return getProposalLocationLabel(location);
  }
  return getProposalLocationLabel(match?.address);
};

/**
 * @param {unknown} value
 * @returns {string}
 */
const normalizeComparableLabel = (value) => String(value || '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

/**
 * @param {{
 *  match: LeagueMatch,
 *  event?: any,
 *  myTeamId?: string | null,
 *  onRefresh?: (() => void) | undefined,
 *  onPress?: (() => void) | undefined,
 * }} props
 */
function NextMatchCard({
  event, match, myTeamId, onPress, onRefresh,
}) {
  const { Colors, Fonts, Images: ThemeImages } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const { userData } = /** @type {{ userData: User | null }} */ (useAuth());
  const { leagueLegalAcceptanceModal, requestLeagueLegalAcceptance } = useLeagueLegalAcceptance();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Identify Teams
  // Safe chaining for team_a/team_b in case they are just IDs or partial objects
  const teamAId = getEntityDocumentId(match.team_a);
  const isTeamA = areSameEntityId(teamAId, myTeamId);
  const myTeam = isTeamA ? match.team_a : match.team_b;
  const opponent = isTeamA ? match.team_b : match.team_a;

  // Check if current user is captain
  const isCaptain = isLeagueCaptain(myTeam, userData);

  const normalizedStatus = normalizeMatchStatus(match?.status);
  const derivedPhase = getMatchDerivedPhase(match, event, now);
  const isAnonymous = shouldMaskOpponentIdentity(match, event);
  const matchLegalLabel = `${myTeam?.name || 'Votre squad'} VS ${isAnonymous ? 'Adversaire' : opponent?.name || 'Adversaire'}`;
  const isTerminalStatus = ['cancelled', 'forfeit', 'no_show', 'valid'].includes(normalizedStatus);
  const isVenueBooked = event?.venueBooked === true || match?.venueBooked === true || match?.venue_booked === true;
  const venueRequired = doesMatchRequireVenue(match);
  const hasMatchEnded = isMatchPastEnd(match, event, now);
  const canSubmitScoreByPhase = ['disputed', 'pending_validation', 'waiting_score'].includes(derivedPhase);
  const isScoreLockedByTime = normalizedStatus === 'scheduled' && isVenueBooked && !canSubmitScoreByPhase;
  const canManageVenue = Boolean(myTeam) && venueRequired && derivedPhase === 'waiting_venue' && !isTerminalStatus;
  const workflowViewModel = useMemo(
    () => buildLeagueWorkflowViewModel(match, null, { event, isCaptain }),
    [event, isCaptain, match],
  );

  // Participations
  // SOT: use event.participations if available (Event Mode)
  // OR match.participations_a / match.participations_b (League Mode)
  /** @type {User[]} */
  let participations = [];
  if (event && event.participations) {
    participations = /** @type {User[]} */ (event.participations);
  } else {
    // League Match Mode
    participations = /** @type {User[]} */ (isTeamA ? (match.participations_a || []) : (match.participations_b || []));
  }

  const myParticipation = participations.find((/** @type {User} */ p) => areSameEntityId(getEntityDocumentId(p), getEntityDocumentId(userData)));

  // Count confirmed
  const confirmedCount = participations.length;
  const requiredPlayers = getRequiredPlayersForSport(myTeam?.sport);
  const isQuorumReached = confirmedCount >= requiredPlayers;

  // Calculate hours until match
  const matchDate = new Date(event?.date || match?.date || new Date());
  const hoursUntilMatch = (matchDate.getTime() - now.getTime()) / (1000 * 60 * 60);
  const matchAddressLabel = resolveAddressLabel(match);
  const venueLabel = getProposalLocationLabel(match.venue)
    || getProposalLocationLabel(match.proposed_venue)
    || 'Lieu à définir';
  const showAddressDetails = Boolean(
    matchAddressLabel
        && normalizeComparableLabel(matchAddressLabel) !== normalizeComparableLabel(venueLabel),
  );
  const startTimeLabel = format(matchDate, 'HH:mm', { locale: fr });
  const endTimeLabel = useMemo(() => {
    const explicitEndDate = event?.endDate || match?.location?.proposed_end_time || null;
    if (explicitEndDate) {
      const parsed = new Date(explicitEndDate);
      if (!Number.isNaN(parsed.getTime())) {
        return format(parsed, 'HH:mm', { locale: fr });
      }
    }

    if (match?.recurring_end_hour) {
      return String(match.recurring_end_hour).slice(0, 5);
    }

    const durationMinutes = getMatchDurationMinutes(myTeam?.sport || match?.team_a?.sport || match?.team_b?.sport);
    const endDate = new Date(matchDate.getTime() + (durationMinutes * 60 * 1000));
    return format(endDate, 'HH:mm', { locale: fr });
  }, [event?.endDate, match?.location?.proposed_end_time, match?.recurring_end_hour, match?.team_a?.sport, match?.team_b?.sport, matchDate, myTeam?.sport]);

  // ELO Prediction: Calculate expected win/loss points
  const eloPrediction = useMemo(() => {
    const myElo = myTeam?.elo || 1200;
    const oppElo = opponent?.elo || 1200;
    const K = 32;

    // Expected score using Elo formula
    const expectedWin = 1 / (1 + 10 ** ((oppElo - myElo) / 400));

    // Points if you win (result=1) or lose (result=0)
    const pointsIfWin = Math.round(K * (1 - expectedWin));
    const pointsIfLoss = Math.round(K * (0 - expectedWin));

    return {
      ifLoss: pointsIfLoss,
      ifWin: pointsIfWin > 0 ? `+${pointsIfWin}` : pointsIfWin,
      myElo,
      oppElo,
    };
  }, [myTeam?.elo, opponent?.elo]);

  const progressSteps = useMemo(() => {
    const matchPlayed = hasMatchEnded
            || ['disputed', 'pending_validation', 'waiting_score'].includes(derivedPhase)
            || ['forfeit', 'no_show', 'valid'].includes(normalizedStatus);
    const resultSubmitted = ['cancelled', 'disputed', 'forfeit', 'no_show', 'pending_validation', 'valid']
      .includes(normalizedStatus) || ['disputed', 'pending_validation'].includes(derivedPhase);

    return [
      { done: true, key: 'found', label: 'Trouvé' },
      { done: venueRequired ? (isVenueBooked || matchPlayed || resultSubmitted) : true, key: 'booked', label: venueRequired ? 'Terrain réservé' : 'Confirmé' },
      { done: matchPlayed || resultSubmitted, key: 'played', label: 'Match joué' },
      { done: resultSubmitted, key: 'result', label: 'Résultat' },
    ];
  }, [derivedPhase, hasMatchEnded, isVenueBooked, normalizedStatus, venueRequired]);

  const handlePrimaryWorkflowAction = () => {
    if (['disputed', 'pending_validation', 'waiting_score'].includes(workflowViewModel.phase)) {
      navigateToEndMatchScreen(navigation, match);
      return;
    }

    navigation.navigate(RouteNames.LeagueMatchDetails, {
      focusSection: workflowViewModel.focusSection,
      matchId: getEntityDocumentId(match),
    });
  };

  // Handlers
  const handleConfirm = async () => {
    try {
      const currentUserId = getEntityDocumentId(userData);
      if (event) {
        // Event Mode
        const eventId = getEntityDocumentId(event);
        if (!currentUserId) {
          Alert.alert('Erreur', 'Utilisateur introuvable');
          return;
        }
        if (!eventId) {
          Alert.alert('Erreur', 'Événement introuvable');
          return;
        }
        await createEventParticipation({
          event: eventId,
          user: currentUserId,
        });
      } else {
        // League Match Mode
        const matchId = getEntityDocumentId(match);
        const legalAcceptance = await requestLeagueLegalAcceptance({
          metadata: {
            matchLabel: matchLegalLabel,
            teamName: myTeam?.name || null,
          },
          scope: LEAGUE_LEGAL_SCOPES.MATCH_PLAYER_PARTICIPATION,
          sourceScreen: 'next_match_card_participation',
          targetDocumentId: matchId,
          targetLabel: matchLegalLabel,
          targetType: 'league_match',
        });
        if (!legalAcceptance) return;

        await confirmParticipation(matchId, isTeamA ? 'a' : 'b', { legalAcceptance });
      }
      Alert.alert('Succès', 'Présence confirmée !');
      onRefresh && onRefresh();
    } catch (error) {
      console.error('Confirm participation error:', error);
      const apiError = /** @type {any} */ (error);
      Alert.alert('Erreur', apiError?.response?.data?.error?.message || 'Impossible de confirmer');
    }
  };

  const handleDecline = async () => {
    try {
      if (event) {
        const eventId = getEntityDocumentId(event);
        if (!eventId) {
          Alert.alert('Erreur', 'Événement introuvable');
          return;
        }
        await missingEvent(eventId);
      } else {
        await declineParticipation(getEntityDocumentId(match), isTeamA ? 'a' : 'b');
      }
      Alert.alert('Noté', 'Absence notée.');
      onRefresh && onRefresh();
    } catch (error) {
      const apiError = /** @type {any} */ (error);
      Alert.alert('Erreur', apiError?.response?.data?.error?.message || 'Impossible de decliner');
    }
  };

  const handleMarkVenueBooked = async () => {
    try {
      if (event) {
        const eventId = getEntityDocumentId(event);
        if (!eventId) {
          Alert.alert('Erreur', 'Événement introuvable');
          return;
        }
        await markEventVenueBooked(eventId);
      } else {
        const matchId = getEntityDocumentId(match);
        await markLeagueMatchVenueBooked(matchId);
      }
      Alert.alert('Terrain Réservé ✅', 'Le terrain est confirmé !');
      onRefresh && onRefresh();
    } catch (error) {
      console.error('Mark venue booked error:', error);
      Alert.alert('Erreur', 'Impossible de confirmer la réservation');
    }
  };

  const handleCancelMatch = () => {
    const penaltyInfo = getCancellationPenalty(hoursUntilMatch);

    Alert.alert(
      'Annuler le match ?',
      `${penaltyInfo.message}\n\nCette action est irréversible.`,
      [
        { style: 'cancel', text: 'Non' },
        {
          onPress: async () => {
            try {
              // Ensure we use the correct team ID (myTeam.documentId)
              const teamIdToUse = getEntityDocumentId(myTeam);
              const matchIdToUse = getEntityDocumentId(match);

              const result = await cancelMatch(matchIdToUse, teamIdToUse, 'captain_request');
              Alert.alert(
                result.penalty > 0 ? 'Match Annulé ⚠️' : 'Match Annulé',
                result.message || 'Le match a été annulé.',
              );
              onRefresh && onRefresh();
            } catch (error) {
              console.error('Cancel match error:', error);
              Alert.alert('Erreur', "Impossible d'annuler le match");
            }
          },
          style: 'destructive',
          text: penaltyInfo.isSevere ? 'Oui, forfait' : 'Oui, annuler',
        },
      ],
    );
  };

  if (!myTeam || !opponent) return null;

  return (
    <>
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={styles.container}
    >
      <ImageBackground
        imageStyle={{ borderRadius: 24 }}
        resizeMode="cover"
        source={/** @type {any} */ (BG_MATCH)}
        style={StyleSheet.absoluteFill}
      />

      {/* Overlay */}
      <View style={styles.overlay} />

      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>PROCHAIN MATCH</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {derivedPhase === 'confirmed_upcoming' && (
            <View style={[styles.badge, { backgroundColor: '#4CAF50' }]}>
              <Text style={styles.badgeText}>À venir</Text>
            </View>
            )}
            {derivedPhase === 'waiting_venue' && (
            <View style={[styles.badge, { backgroundColor: '#FFC107' }]}>
              <Text style={[styles.badgeText, { color: '#0B1820' }]}>EN ATTENTE TERRAIN</Text>
            </View>
            )}
            {derivedPhase === 'pending_validation' && (
            <View style={[styles.badge, { backgroundColor: '#FFC107' }]}>
              <Text style={[styles.badgeText, { color: '#0B1820' }]}>SCORE EN ATTENTE</Text>
            </View>
            )}
            {derivedPhase === 'disputed' && (
            <View style={[styles.badge, { backgroundColor: '#EF4444' }]}>
              <Text style={styles.badgeText}>LITIGE</Text>
            </View>
            )}
          </View>
        </View>
        <View style={styles.progressChipsRow}>
          {progressSteps.map((step) => (
            <View
              key={step.key}
              style={[
                styles.progressChip,
                step.done ? styles.progressChipDone : styles.progressChipTodo,
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.progressChipText,
                  step.done ? styles.progressChipTextDone : styles.progressChipTextTodo,
                ]}
              >
                {step.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Matchup */}
        <View style={styles.matchup}>
          <View style={styles.teamContainer}>
            <TeamShield initials={myTeam.name?.substring(0, 2) || '??'} isGold size={50} />
            <Text numberOfLines={1} style={styles.teamName}>{myTeam.name}</Text>
          </View>
          <Text style={styles.vsText}>VS</Text>
          <View style={styles.teamContainer}>
            {/* Anonymization Logic */}
            {isAnonymous ? (
              <>
                <View style={{
                  alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', borderColor: 'rgba(255,255,255,0.24)', borderRadius: 25, borderWidth: 1, height: 50, justifyContent: 'center', width: 50,
                }}
                >
                  <Text style={{ fontSize: 24 }}>❓</Text>
                </View>
                <Text numberOfLines={1} style={[styles.teamName, { color: '#ADB1B2', fontStyle: 'italic' }]}>Adversaire Mystère</Text>
              </>
            ) : (
              <>
                {opponent.crest?.url ? (
                  <Image source={{ uri: getImageUrl(opponent.crest.url) }} style={{ height: 50, resizeMode: 'contain', width: 50 }} />
                ) : (
                  <TeamShield initials={opponent.name?.substring(0, 2) || '??'} isGold size={50} />
                )}
                <Text numberOfLines={1} style={styles.teamName}>{opponent.name}</Text>
              </>
            )}
          </View>
        </View>

        {/* Details */}
        <View style={styles.details}>
          <View style={styles.row}>
            <Image source={ThemeImages.calendar} style={styles.icon} />
            <Text style={[styles.detailText, { color: Colors.gold500 }]}>
              {`${format(new Date(event?.date || match?.date || new Date()), 'EEEE d MMMM', { locale: fr }).toUpperCase()} • ${startTimeLabel}-${endTimeLabel}`}
            </Text>
          </View>
          <View style={styles.row}>
            <Image source={ThemeImages.pin} style={styles.icon} />
            <View>
              <Text style={styles.detailText}>
                {venueLabel}
              </Text>
              {/* Address Display */}
              {showAddressDetails ? (
                <Text style={styles.detailSubText}>
                  {matchAddressLabel}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
        {/* Attendance Gauge */}
        <View style={styles.attendance}>
          <Text style={styles.attendanceTitle}>
            Presences joueurs confirmees (
            <Text style={{ color: Colors.gold500 }}>
              {confirmedCount}
              /
              {requiredPlayers}
            </Text>
            )
          </Text>
          <Text style={[styles.attendanceHint, { color: Colors.gold500 }]}>
            {isQuorumReached
              ? 'Quorum atteint. Équipe prête.'
              : `Minimum requis: ${requiredPlayers} joueurs. Il manque ${Math.max(requiredPlayers - confirmedCount, 0)} joueur(s).`}
          </Text>
          <View style={styles.gaugeBg}>
            <View style={[styles.gaugeFill, { backgroundColor: isQuorumReached ? '#4CAF50' : '#FFC107', width: `${Math.min((confirmedCount / Math.max(requiredPlayers, 1)) * 100, 100)}%` }]} />
          </View>
        </View>
        <TouchableOpacity
          onPress={handlePrimaryWorkflowAction}
          style={[
            styles.bookingButton,
            workflowViewModel.isBlockingAction
              ? { backgroundColor: 'rgba(1, 179, 244, 0.15)', borderColor: Colors.primary500 }
              : { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: Colors.neutral600 },
          ]}
        >
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            style={[
              styles.bookingButtonText,
              { color: workflowViewModel.isBlockingAction ? Colors.primary500 : Colors.neutral100 },
            ]}
          >
            {workflowViewModel.primaryCta || 'Voir le match'}
          </Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
      {leagueLegalAcceptanceModal}
    </>
  );
}

const styles = StyleSheet.create({
  actions: {
    marginTop: 12,
  },
  attendance: {
    marginBottom: 16,
    marginTop: 2,
  },
  attendanceHint: {
    color: '#8E9AAD',
    fontSize: 11,
    marginBottom: 10,
  },
  attendanceTitle: {
    color: '#C0C8D6',
    fontSize: 12,
    marginBottom: 4,
  },
  badge: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  bookingButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
    borderColor: '#FFC107',
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bookingButtonText: {
    color: '#FFC107',
    fontFamily: 'Montserrat-Bold',
    fontSize: 14,
    fontWeight: 'bold',
  },
  buttonRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelLinkButton: {
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 6,
  },
  cancelLinkText: {
    color: '#F44336',
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  container: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 24,
    minHeight: 220,
    overflow: 'hidden',
  },
  content: {
    padding: 22,
    paddingBottom: 24, // Ensure padding at bottom for buttons
  },
  details: {
    gap: 8,
    marginBottom: 18,
  },
  detailSubText: {
    color: '#A7B0BF',
    fontSize: 12,
    marginTop: 2,
  },
  detailText: {
    color: '#DDD',
    fontFamily: 'Montserrat-Medium',
    fontSize: 14,
  },
  eloPrediction: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginBottom: 18,
    padding: 12,
  },
  eloPredictionBadge: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  eloPredictionDetails: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
  },
  eloPredictionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  eloPredictionTitle: {
    color: '#FFF',
    fontFamily: 'Montserrat-Bold',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  gaugeBg: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 3,
    height: 8,
    overflow: 'hidden',
  },
  gaugeFill: {
    borderRadius: 3,
    height: '100%',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    color: '#01B3F4',
    fontFamily: 'Montserrat-Bold',
    fontSize: 14,
    letterSpacing: 1,
  },
  icon: {
    height: 16,
    tintColor: '#01B3F4',
    width: 16,
  },
  linkText: {
    color: '#F44336',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  matchup: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 18, 32, 0.78)',
  },
  progressChip: {
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 66,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  progressChipDone: {
    backgroundColor: 'rgba(1, 179, 244, 0.14)',
    borderColor: 'rgba(1, 179, 244, 0.45)',
  },
  progressChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  progressChipText: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 10,
    textAlign: 'center',
  },
  progressChipTextDone: {
    color: '#01B3F4',
  },
  progressChipTextTodo: {
    color: '#A7B0BF',
  },
  progressChipTodo: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: 'rgba(255,255,255,0.18)',
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  statusContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderColor: '#4CAF50',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
  },
  statusText: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  teamContainer: {
    alignItems: 'center',
    width: '40%',
  },
  teamName: {
    color: 'white',
    fontFamily: 'Montserrat-Bold',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  vsText: {
    color: '#888',
    fontFamily: 'Montserrat-Black',
    fontSize: 20,
    fontStyle: 'italic',
  },
});

export default NextMatchCard;
