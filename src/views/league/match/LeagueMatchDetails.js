import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  useCallback, useEffect, useMemo, useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import HeaderBackButton from '@/components/atoms/headerBackButton/HeaderBackButton';
import LeagueCard from '@/components/atoms/league/LeagueCard';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import VenueProposalModal from '@/components/organisms/venueProposalModal/VenueProposalModal';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { navigateToEndMatchScreen } from '@/views/league/match/utils/leagueNavigation';
import {
  getMatchDerivedPhase,
  getMatchStatusBadgeConfig,
  isVenueBookedForMatch,
  normalizeMatchStatus,
  shouldMaskOpponentIdentity,
} from '@/views/league/match/utils/matchStatus';
import { buildProposalDefaultsFromMatch } from '@/views/league/match/utils/proposalDefaults';
import { buildLeagueProposalPayload } from '@/views/league/match/utils/proposalPayload';

import { RouteNames } from '@/navigation/routeNames';

import {
  createChatMessage,
  respondProposalMessage,
} from '@/services/chat/chatService';
import { usePendingLeagueAction } from '@/services/league/leagueActionQueries';
import {
  cancelMatch,
  confirmMatch,
  confirmParticipation,
  declineParticipation,
  fetchMatch,
  markVenueBooked,
  updateMatch,
} from '@/services/league/leagueMatchService';
import {
  useGetLeagueMatchStats,
  useGetLeagueMyMatchResponse,
} from '@/services/matchStats/matchStatsQueries';

import { areSameEntityId, getEntityDocumentId } from '@/utils/entityId';

/**
 * @typedef {{navigation: any, route: {params: {matchId: string}}}} LeagueMatchDetailsProps
 */

const normalizeComparableText = (/** @type {unknown} */ value) => String(value || '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();
const resolveVenueLabel = (/** @type {LeagueMatch | null} */ match) => match?.venue || match?.proposed_venue || 'Lieu a definir';
const resolveAddressLabel = (/** @type {LeagueMatch | null} */ match) => match?.location?.address || match?.address || '';
const normalizePhoneCandidate = (/** @type {unknown} */ value) => String(value || '').replace(/[\s().-]/g, '');
const looksLikePhone = (/** @type {unknown} */ value) => /^\+?\d{8,15}$/.test(normalizePhoneCandidate(value));
const getParticipantDisplayName = (/** @type {User | null | undefined} */ participant) => {
  const firstName = participant?.firstname || participant?.firstName || '';
  const lastName = participant?.lastname || participant?.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim();
  if (fullName) return fullName;
  if (firstName) return firstName;
  if (lastName) return lastName;
  if (participant?.username && !looksLikePhone(participant.username)) return participant.username;
  return 'Joueur';
};

const isAlreadyResolvedError = (error) => {
  const status = Number(error?.response?.status || error?.status || 0);
  const code = String(error?.response?.data?.error?.code || error?.code || '');
  return status === 409 || code === 'ALREADY_RESOLVED';
};

/**
 * @param {unknown} sportValue
 * @returns {number}
 */
const getRequiredPlayersForSport = (sportValue) => {
  const normalized = String(sportValue || '').trim().toLowerCase();
  if (normalized.includes('padel')) return 2;
  return 5;
};

/**
 * @param {LeagueMatchDetailsProps} props
 * @returns {import('react').ReactElement}
 */
function LeagueMatchDetails({ navigation, route }) {
  const { matchId } = route.params;
  const highlightedSection = route?.params?.focusSection || null;
  const queryClient = useQueryClient();
  const { Colors, Fonts, Images } = useTheme();
  const { userData } = /** @type {{ userData: User | null }} */ (useAuth());
  const leagueCardTextColor = Colors.primary500;
  const leagueAccentSurface = 'rgba(1, 179, 244, 0.12)';
  const leagueGoldSurface = 'rgba(255, 215, 0, 0.08)';

  const [actionLoading, setActionLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState(/** @type {LeagueMatch | null} */ (null));
  const [isMatchStatsPromptVisible, setIsMatchStatsPromptVisible] = useState(false);
  const [hasDismissedMatchStatsPrompt, setHasDismissedMatchStatsPrompt] = useState(false);
  const [isNegotiationModalVisible, setIsNegotiationModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const userId = getEntityDocumentId(userData);

  const loadMatch = useCallback(async () => {
    try {
      const data = await fetchMatch(matchId);
      setMatch(data);
    } catch (error) {
      console.error('Error loading match:', error);
      Alert.alert('Erreur', 'Impossible de charger le match');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [matchId]);

  useFocusEffect(
    useCallback(() => {
      loadMatch();
    }, [loadMatch]),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      loadMatch();
    }, 10000);
    return () => clearInterval(interval);
  }, [loadMatch]);

  const isInTeamA = useMemo(() => {
    const rosterA = match?.team_a?.roster || [];
    const membersA = match?.team_a?.members || [];
    return (
      rosterA.some((/** @type {User} */ m) => areSameEntityId(getEntityDocumentId(m), userId))
      || membersA.some((/** @type {User} */ m) => areSameEntityId(getEntityDocumentId(m), userId))
      || areSameEntityId(getEntityDocumentId(match?.team_a?.captain), userId)
    );
  }, [match, userId]);

  const isInTeamB = useMemo(() => {
    const rosterB = match?.team_b?.roster || [];
    const membersB = match?.team_b?.members || [];
    return (
      rosterB.some((/** @type {User} */ m) => areSameEntityId(getEntityDocumentId(m), userId))
      || membersB.some((/** @type {User} */ m) => areSameEntityId(getEntityDocumentId(m), userId))
      || areSameEntityId(getEntityDocumentId(match?.team_b?.captain), userId)
    );
  }, [match, userId]);

  const teamSide = useMemo(() => {
    if (isInTeamA) return 'a';
    if (isInTeamB) return 'b';
    return null;
  }, [isInTeamA, isInTeamB]);
  const myTeam = useMemo(() => {
    if (teamSide === 'a') return match?.team_a || null;
    if (teamSide === 'b') return match?.team_b || null;
    return null;
  }, [match?.team_a, match?.team_b, teamSide]);
  const myTeamId = getEntityDocumentId(myTeam);
  const {
    data: pendingLeagueActionPayload,
    refetch: refetchPendingLeagueAction,
  } = usePendingLeagueAction(myTeamId || undefined, {
    enabled: Boolean(myTeamId),
  });

  const {
    data: leagueMatchStatsPayload,
    isFetching: isLeagueMatchStatsFetching,
    refetch: refetchLeagueMatchStats,
  } = useGetLeagueMatchStats(matchId, myTeamId || undefined, {
    enabled: Boolean(matchId && myTeamId && String(match?.status || '').toLowerCase() === 'valid'),
  });
  const {
    data: leagueMyMatchResponsePayload,
    isFetching: isLeagueMyMatchResponseFetching,
    refetch: refetchLeagueMyMatchResponse,
  } = useGetLeagueMyMatchResponse(matchId, myTeamId || undefined, {
    enabled: Boolean(matchId && myTeamId && String(match?.status || '').toLowerCase() === 'valid'),
  });

  const isCaptainA = areSameEntityId(getEntityDocumentId(match?.team_a?.captain), userId);
  const isCaptainB = areSameEntityId(getEntityDocumentId(match?.team_b?.captain), userId);
  const isCaptain = isCaptainA || isCaptainB;

  const participations = teamSide === 'a' ? (match?.participations_a || []) : (match?.participations_b || []);
  const hasConfirmed = participations.some((/** @type {User} */ p) => areSameEntityId(getEntityDocumentId(p), userId));
  const participationCount = participations.length;
  const requiredPlayers = useMemo(() => getRequiredPlayersForSport(myTeam?.sport), [myTeam?.sport]);

  const normalizedStatus = useMemo(() => normalizeMatchStatus(match?.status), [match?.status]);
  const isVenueBooked = useMemo(() => isVenueBookedForMatch(match), [match]);
  const isAnonymous = useMemo(() => shouldMaskOpponentIdentity(match), [match]);
  const matchPhase = useMemo(() => getMatchDerivedPhase(match), [match]);
  const leagueStatsReport = leagueMatchStatsPayload?.report || null;
  const leaguePlayerCollectiveRating = leagueMatchStatsPayload?.playerCollectiveRating || null;
  const leagueMyCoachReview = leagueMatchStatsPayload?.myCoachReview || null;
  const leagueMyMatchResponse = leagueMyMatchResponsePayload?.response || null;
  const isCoachFeedbackHighlighted = highlightedSection === 'coachFeedback';
  const isVenueBookingHighlighted = highlightedSection === 'venueBooking';
  const hasLeagueCoachReview = leagueMyCoachReview?.rating != null || Boolean(leagueMyCoachReview?.comment);
  const isLeagueStatsFinal = leagueStatsReport?.status === 'final';
  const isLeagueStatsReviewRequired = Boolean(leagueStatsReport?.needsReview);
  const isLeagueStatsCompleted = isLeagueStatsFinal && !isLeagueStatsReviewRequired;
  const canViewLeagueStats = Boolean(leagueMatchStatsPayload?.permissions?.canView || teamSide);
  const canManageLeagueStats = Boolean(leagueMatchStatsPayload?.permissions?.canManage);
  const canRespondMyLeagueStats = Boolean(leagueMyMatchResponsePayload?.permissions?.canRespond || teamSide);
  const canSubmitScore = useMemo(
    () => isCaptain && ['disputed', 'pending_validation', 'waiting_score'].includes(matchPhase),
    [isCaptain, matchPhase],
  );
  const isScoreLockedByTime = useMemo(
    () => isCaptain && normalizedStatus === 'scheduled' && isVenueBooked && !canSubmitScore,
    [canSubmitScore, isCaptain, isVenueBooked, normalizedStatus],
  );
  const pendingLeagueAction = pendingLeagueActionPayload?.nextAction || null;
  const isPendingActionForCurrentMatch = useMemo(() => {
    const currentMatchId = getEntityDocumentId(match);
    return areSameEntityId(pendingLeagueAction?.matchId, matchId)
      || areSameEntityId(pendingLeagueAction?.matchId, currentMatchId);
  }, [match, matchId, pendingLeagueAction?.matchId]);
  const lastProposalSide = String(match?.automation_meta?.last_proposal_by_side || '').trim().toLowerCase();
  const fallbackNegotiationState = useMemo(() => {
    if (matchPhase !== 'waiting_proposal') return null;
    if (teamSide && lastProposalSide) {
      return lastProposalSide === teamSide ? 'proposal_sent_waiting' : 'proposal_received';
    }
    return match?.chat ? 'opponent_found' : null;
  }, [lastProposalSide, match?.chat, matchPhase, teamSide]);
  const negotiationState = useMemo(() => {
    const nextState = String(pendingLeagueAction?.state || '').trim();
    if (
      isPendingActionForCurrentMatch
      && ['opponent_found', 'proposal_received', 'proposal_sent_waiting'].includes(nextState)
    ) {
      return nextState;
    }
    return fallbackNegotiationState;
  }, [fallbackNegotiationState, isPendingActionForCurrentMatch, pendingLeagueAction?.state]);
  const isNegotiationHighlighted = highlightedSection === 'negotiation';
  const negotiationProposalDate = pendingLeagueAction?.date || match?.proposed_time || match?.date || null;
  const negotiationProposalVenue = pendingLeagueAction?.venue || match?.proposed_venue || match?.venue || 'Lieu a definir';
  const negotiationProposalMessageId = String(pendingLeagueAction?.proposalMessageId || '').trim();
  const hasNegotiationConversation = Boolean(getEntityDocumentId(match?.chat));
  const canReplyFromNegotiationCard = negotiationState === 'proposal_received' && Boolean(negotiationProposalMessageId);
  const canCounterProposeFromNegotiationCard = Boolean(
    hasNegotiationConversation && ['proposal_received', 'proposal_sent_waiting'].includes(String(negotiationState || '')),
  );
  const proposalDefaults = useMemo(
    () => buildProposalDefaultsFromMatch(match || null),
    [match],
  );
  const negotiationMeta = useMemo(() => {
    let title = 'Negociation du match';
    let helper = 'Retrouve la conversation avec l adversaire pour conclure rapidement.';
    let origin = 'Discussion League active';

    if (negotiationState === 'proposal_received') {
      title = 'Proposition recue';
      helper = 'Une proposition adverse attend votre reponse. Vous pouvez accepter, refuser ou contre-proposer.';
      origin = 'Envoyee par l adversaire';
    } else if (negotiationState === 'proposal_sent_waiting') {
      title = 'Proposition envoyee';
      helper = 'Votre squad attend maintenant la reponse adverse. La conversation reste le centre de la negociation.';
      origin = 'Envoyee par votre squad';
    } else if (negotiationState === 'opponent_found') {
      title = 'Adversaire trouve';
      helper = 'Le match est cree. Lancez la conversation pour envoyer la premiere proposition.';
      origin = 'Aucune proposition definitive pour le moment';
    }

    let formattedDate = 'Date a definir';
    if (negotiationProposalDate) {
      try {
        formattedDate = format(new Date(negotiationProposalDate), "EEEE d MMMM 'a' HH'h'mm", { locale: fr });
      } catch (_error) {
        formattedDate = 'Date a definir';
      }
    }

    return {
      formattedDate,
      helper,
      origin,
      title,
    };
  }, [negotiationProposalDate, negotiationState]);
  const renderNegotiationActions = useCallback(() => {
    if (canReplyFromNegotiationCard) {
      return (
        <View style={{ gap: 10, marginTop: 16 }}>
          <Button
            disabled={actionLoading}
            onPress={handleAcceptNegotiationProposal}
            title="Accepter"
            variant="Primary"
          />
          <Button
            disabled={actionLoading}
            onPress={handleDeclineNegotiationProposal}
            title="Refuser"
            variant="Secondary"
          />
          <Button
            disabled={actionLoading}
            onPress={handleOpenCounterProposal}
            title="Contre-proposer"
            variant="SecondaryLight"
          />
        </View>
      );
    }

    if (canCounterProposeFromNegotiationCard) {
      return (
        <View style={{ gap: 10, marginTop: 16 }}>
          <Button
            disabled={actionLoading}
            onPress={handleOpenCounterProposal}
            title="Contre-proposer"
            variant="Secondary"
          />
        </View>
      );
    }

    return null;
  }, [
    actionLoading,
    canCounterProposeFromNegotiationCard,
    canReplyFromNegotiationCard,
    handleAcceptNegotiationProposal,
    handleDeclineNegotiationProposal,
    handleOpenCounterProposal,
  ]);

  const venueLabel = useMemo(() => resolveVenueLabel(match), [match]);
  const addressLabel = useMemo(() => resolveAddressLabel(match), [match]);
  const showAddressLine = useMemo(
    () => Boolean(addressLabel && normalizeComparableText(addressLabel) !== normalizeComparableText(venueLabel)),
    [addressLabel, venueLabel],
  );
  const teamContextMeta = useMemo(() => {
    if (teamSide === 'a') {
      return {
        backgroundColor: 'rgba(1, 179, 244, 0.16)',
        borderColor: 'rgba(1, 179, 244, 0.35)',
        label: 'DOMICILE',
        subtitle: 'Tu joues chez toi',
        textColor: Colors.primary500,
      };
    }

    if (teamSide === 'b') {
      return {
        backgroundColor: 'rgba(255, 215, 0, 0.12)',
        borderColor: 'rgba(255, 215, 0, 0.28)',
        label: 'EXTERIEUR',
        subtitle: 'Deplacement League',
        textColor: Colors.gold500,
      };
    }

    return null;
  }, [Colors.gold500, Colors.primary500, teamSide]);
  const remainingPlayers = useMemo(
    () => Math.max(requiredPlayers - participationCount, 0),
    [participationCount, requiredPlayers],
  );
  const isRosterFull = participationCount >= requiredPlayers;
  const presenceHelperText = useMemo(() => {
    if (hasConfirmed) {
      return `Tu es compte dans la feuille de match (${participationCount}/${requiredPlayers}).`;
    }

    if (isRosterFull) {
      return 'L effectif est complet pour le moment. Tu peux rester absent ou attendre une place.';
    }

    if (remainingPlayers <= 1) {
      return 'Derniere place disponible pour ton equipe.';
    }

    return `${remainingPlayers} places encore disponibles pour ton equipe.`;
  }, [hasConfirmed, isRosterFull, participationCount, remainingPlayers, requiredPlayers]);
  const presencePrimaryTitle = useMemo(() => {
    if (isRosterFull) return `Effectif complet (${participationCount}/${requiredPlayers})`;
    return `Confirmer ma presence (${participationCount}/${requiredPlayers})`;
  }, [isRosterFull, participationCount, requiredPlayers]);

  const formattedDate = useMemo(() => {
    if (!match?.date) return 'Date a definir';
    try {
      return format(new Date(match.date), "EEEE d MMMM 'a' HH'h'mm", { locale: fr });
    } catch (_error) {
      return match.date;
    }
  }, [match?.date]);

  const statusConfig = useMemo(() => getMatchStatusBadgeConfig(match, Colors), [Colors, match]);

  const eloPrediction = useMemo(() => {
    if (!match?.team_a?.elo || !match?.team_b?.elo) return null;
    const eloA = match.team_a.elo;
    const eloB = match.team_b.elo;
    const k = 32;
    const expectedA = 1 / (1 + 10 ** ((eloB - eloA) / 400));
    const winA = Math.round(k * (1 - expectedA));
    const lossA = Math.round(k * (0 - expectedA));
    return {
      lossA,
      lossB: -winA,
      winA,
      winB: -lossA,
    };
  }, [match]);

  const canManageVenue = Boolean(teamSide && normalizedStatus === 'scheduled' && !isVenueBooked);
  const canShowCaptainPrimary = (canSubmitScore || isScoreLockedByTime) || canManageVenue;
  const canShowCaptainCancel = isCaptain && normalizedStatus === 'scheduled';
  const hasBottomPresenceBar = Boolean(teamSide && normalizedStatus === 'scheduled');
  const scrollBottomPadding = useMemo(() => {
    if (!hasBottomPresenceBar) return 52;
    if (canShowCaptainPrimary || canShowCaptainCancel) return 320;
    return 250;
  }, [canShowCaptainCancel, canShowCaptainPrimary, hasBottomPresenceBar]);
  const isScoreToSubmitBadge = statusConfig.label === 'Score a saisir';
  const heroStatusMeta = useMemo(() => {
    if (isScoreToSubmitBadge || canSubmitScore) {
      return {
        accentColor: Colors.gold500,
        icon: Images.edit,
        label: 'Action capitaine',
        text: 'Le score final doit etre saisi pour debloquer le bilan League.',
      };
    }

    if (normalizedStatus === 'scheduled' && !isVenueBooked) {
      return {
        accentColor: Colors.warning500,
        icon: Images.stadium,
        label: 'Organisation equipe',
        text: 'Le terrain doit encore etre confirme avant le coup d envoi.',
      };
    }

    if (normalizedStatus === 'scheduled') {
      return {
        accentColor: Colors.primary500,
        icon: Images.clock,
        label: 'Avant match',
        text: 'Les confirmations de presence restent ouvertes avant le debut.',
      };
    }

    if (normalizedStatus === 'valid') {
      return {
        accentColor: Colors.success500,
        icon: Images.check,
        label: 'Resultat valide',
        text: 'Le match est verrouille avec son score officiel.',
      };
    }

    return {
      accentColor: Colors.primary500,
      icon: Images.flag,
      label: 'Statut League',
      text: 'Le suivi League reste disponible dans les sections ci-dessous.',
    };
  }, [
    Colors.gold500,
    Colors.primary500,
    Colors.success500,
    Colors.warning500,
    Images.check,
    Images.clock,
    Images.edit,
    Images.flag,
    Images.stadium,
    canSubmitScore,
    isScoreToSubmitBadge,
    isVenueBooked,
    normalizedStatus,
  ]);
  const leagueStatsAction = useMemo(() => {
    if (normalizedStatus !== 'valid') {
      return {
        disabled: true,
        subtitle: 'Les stats seront disponibles une fois le score valide.',
        title: 'Stats bientot disponibles',
      };
    }

    if (isLeagueStatsReviewRequired) {
      return {
        disabled: false,
        subtitle: 'Le score officiel a change. Verifie puis republie cette version.',
        title: 'Mettre a jour apres score officiel',
      };
    }

    if (isLeagueStatsFinal) {
      return {
        disabled: false,
        subtitle: leagueStatsReport?.finalizedAt
          ? `Rapport finalise le ${new Date(leagueStatsReport.finalizedAt).toLocaleString('fr-FR')}`
          : 'Rapport finalise',
        title: 'Voir les stats du match',
      };
    }

    if (canManageLeagueStats) {
      return {
        disabled: false,
        subtitle: 'Note collective, retours capitaine et stats manquantes a completer pour ton equipe.',
        title: 'Finaliser le bilan equipe',
      };
    }

    return {
      disabled: true,
      subtitle: 'Le bilan equipe est encore en cours de finalisation.',
      title: 'En attente du bilan',
    };
  }, [
    canManageLeagueStats,
    isLeagueStatsFinal,
    isLeagueStatsReviewRequired,
    leagueStatsReport?.finalizedAt,
    normalizedStatus,
  ]);
  const leagueStatsSummaryText = useMemo(() => {
    if (isLeagueStatsReviewRequired) {
      return 'Le score officiel a change. Verification requise avant nouvelle publication.';
    }

    if (isLeagueStatsFinal) {
      return 'Le rapport stats de ton equipe est finalise.';
    }

    if (normalizedStatus !== 'valid') {
      return 'Les stats seront disponibles une fois le score valide.';
    }

    if (canManageLeagueStats) {
      return 'Complete le bilan collectif, les retours individuels et les stats manquantes maintenant que le score est valide.';
    }

    return 'Le bilan equipe est encore en cours de finalisation.';
  }, [canManageLeagueStats, isLeagueStatsFinal, isLeagueStatsReviewRequired, normalizedStatus]);
  const leagueStatsStatusMeta = useMemo(() => {
    if (isLeagueStatsReviewRequired) {
      return {
        backgroundColor: `${Colors.warning500}20`,
        borderColor: `${Colors.warning500}45`,
        label: 'Verification requise',
        textColor: Colors.warning500,
      };
    }

    if (isLeagueStatsFinal) {
      return {
        backgroundColor: `${Colors.success500}20`,
        borderColor: `${Colors.success500}45`,
        label: 'Stats publiees',
        textColor: Colors.success500,
      };
    }

    if (normalizedStatus !== 'valid') {
      return {
        backgroundColor: `${Colors.gold500}20`,
        borderColor: `${Colors.gold500}45`,
        label: 'Score valide en attente',
        textColor: Colors.gold500,
      };
    }

    return {
      backgroundColor: `${Colors.primary500}20`,
      borderColor: `${Colors.primary500}45`,
      label: 'A finaliser',
      textColor: Colors.primary500,
    };
  }, [Colors.gold500, Colors.primary500, Colors.success500, Colors.warning500, isLeagueStatsFinal, isLeagueStatsReviewRequired, normalizedStatus]);
  const leagueStatsCardButtonTitle = useMemo(() => {
    if (isLeagueStatsReviewRequired) return 'Mettre a jour';
    if (isLeagueStatsCompleted) return 'Voir';
    return 'Ouvrir';
  }, [isLeagueStatsCompleted, isLeagueStatsReviewRequired]);
  const myLeagueMatchResponseStatusMeta = useMemo(() => {
    if (leagueMyMatchResponse?.status === 'draft') {
      return {
        backgroundColor: `${Colors.primary500}20`,
        borderColor: `${Colors.primary500}45`,
        label: 'Brouillon',
        textColor: Colors.primary500,
      };
    }

    if (leagueMyMatchResponse?.status === 'submitted') {
      if (leagueMyMatchResponse?.participation === 'not_involved') {
        return {
          backgroundColor: `${Colors.neutral00}14`,
          borderColor: `${Colors.neutral00}24`,
          label: 'Non concerne',
          textColor: Colors.neutral00,
        };
      }

      if (leagueMyMatchResponse?.quantitativeState === 'unknown') {
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
  }, [
    Colors.gold500,
    Colors.neutral00,
    Colors.primary500,
    Colors.success500,
    leagueMyMatchResponse,
  ]);
  const myLeagueMatchResponseSummary = useMemo(() => {
    if (leagueMyMatchResponse?.status === 'submitted') {
      if (leagueMyMatchResponse?.participation === 'not_involved') {
        return 'Tu as indique ne pas etre concerne par ce match.';
      }

      if (leagueMyMatchResponse?.participation === 'present_no_play') {
        return 'Tu as indique que tu etais la sans jouer.';
      }

      if (leagueMyMatchResponse?.quantitativeState === 'unknown') {
        return 'Ton ressenti est enregistre, sans stats quantitatives.';
      }

      return 'Tes stats personnelles et ta note sont enregistrees.';
    }

    if (leagueMyMatchResponse?.status === 'draft') {
      return 'Ton brouillon perso post-match attend encore une validation.';
    }

    return 'Renseigne ton retour individuel, puis ajoute une note sur 10.';
  }, [leagueMyMatchResponse]);
  const myLeagueMatchResponseButtonTitle = useMemo(() => {
    if (leagueMyMatchResponse?.status === 'draft') return 'Reprendre';
    if (leagueMyMatchResponse?.status === 'submitted') return 'Voir';
    return 'Renseigner';
  }, [leagueMyMatchResponse]);
  const renderSectionHeader = useCallback((title, accentColor = leagueCardTextColor) => (
    <View style={styles.sectionHeaderRow}>
      <View style={[styles.sectionHeaderDot, { backgroundColor: accentColor }]} />
      <Text style={[Fonts.h4, styles.sectionHeaderText, { color: accentColor }]}>{title}</Text>
      <View style={[styles.sectionHeaderLine, { backgroundColor: `${accentColor}33` }]} />
    </View>
  ), [Fonts.h4, leagueCardTextColor]);

  const handleConfirmParticipation = async () => {
    if (!teamSide) return;
    setActionLoading(true);
    try {
      const result = await confirmParticipation(matchId, teamSide);
      Alert.alert('Confirme', result.message || 'Presence confirmee');
      await loadMatch();
    } catch (error) {
      console.error(error);
      Alert.alert('Erreur', 'Echec confirmation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineParticipation = async () => {
    if (!teamSide) return;
    setActionLoading(true);
    try {
      await declineParticipation(matchId, teamSide);
      Alert.alert('Participation annulee', 'Votre participation a ete annulee');
      await loadMatch();
    } catch (error) {
      console.error(error);
      Alert.alert('Erreur', 'Echec annulation');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkVenueBooked = async () => {
    setActionLoading(true);
    try {
      await markVenueBooked(matchId);
      Alert.alert('Succes', 'Terrain marque comme reserve');
      await loadMatch();
    } catch (error) {
      console.error(error);
      Alert.alert('Erreur', 'Impossible de mettre a jour le statut');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelMatch = () => {
    Alert.alert(
      'Annuler le match ?',
      'Action irreversible. Etes-vous sur ?',
      [
        { style: 'cancel', text: 'Non' },
        {
          onPress: async () => {
            setActionLoading(true);
            try {
              const targetTeamId = getEntityDocumentId(myTeam);
              if (!targetTeamId) {
                Alert.alert('Erreur', 'Equipe introuvable.');
                return;
              }
              await cancelMatch(matchId, targetTeamId, 'Annule par le capitaine');
              Alert.alert('Match annule', 'Le match a ete annule.');
              navigation.goBack();
            } catch (_error) {
              Alert.alert('Erreur', 'Echec annulation');
            } finally {
              setActionLoading(false);
            }
          },
          style: 'destructive',
          text: 'Oui, annuler',
        },
      ],
    );
  };

  const handleOpenChat = useCallback(() => {
    if (!match) return;
    const chatId = getEntityDocumentId(match?.chat);
    if (!chatId) {
      Alert.alert(
        'Conversation en preparation',
        'La conversation avec l adversaire n est pas encore disponible. Reessayez dans quelques secondes.',
      );
      return;
    }
    navigation.navigate(RouteNames.Conversation, {
      chatId,
      focusLatestProposal: true,
      focusProposalMessageId: negotiationProposalMessageId || undefined,
      focusSection: undefined,
      leagueNegotiationFocusToken: String(Date.now()),
      subTitle: 'Negociation du match en cours',
      title: isAnonymous
        ? `${myTeam?.name || 'Votre squad'} vs Adversaire`
        : `${match.team_a?.name} vs ${match.team_b?.name}`,
    });
  }, [isAnonymous, match, myTeam?.name, navigation, negotiationProposalMessageId]);

  const invalidateNegotiationQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['pendingLeagueAction'] });
    queryClient.invalidateQueries({ queryKey: ['chat', getEntityDocumentId(match?.chat)] });
    queryClient.invalidateQueries({ queryKey: ['chat-messages', getEntityDocumentId(match?.chat)] });
    queryClient.invalidateQueries({ queryKey: ['league-matches'] });
  }, [match?.chat, queryClient]);

  const handleAcceptNegotiationProposal = useCallback(async () => {
    if (!matchId || actionLoading) return;
    setActionLoading(true);
    try {
      await confirmMatch(matchId);
      if (negotiationProposalMessageId) {
        await respondProposalMessage(negotiationProposalMessageId, 'accepted');
      }
      invalidateNegotiationQueries();
      await refetchPendingLeagueAction();
      await loadMatch();
      navigation.navigate(RouteNames.LeagueMatchDetails, {
        focusSection: 'venueBooking',
        matchId,
      });
    } catch (error) {
      if (isAlreadyResolvedError(error)) {
        invalidateNegotiationQueries();
        await refetchPendingLeagueAction();
        await loadMatch();
        return;
      }
      Alert.alert('Erreur', 'Impossible d accepter la proposition pour le moment.');
    } finally {
      setActionLoading(false);
    }
  }, [
    actionLoading,
    invalidateNegotiationQueries,
    loadMatch,
    matchId,
    navigation,
    negotiationProposalMessageId,
    refetchPendingLeagueAction,
  ]);

  const handleDeclineNegotiationProposal = useCallback(async () => {
    if (!negotiationProposalMessageId || actionLoading) return;
    setActionLoading(true);
    try {
      await respondProposalMessage(negotiationProposalMessageId, 'declined');
      invalidateNegotiationQueries();
      await refetchPendingLeagueAction();
      await loadMatch();
      setIsNegotiationModalVisible(true);
    } catch (error) {
      if (isAlreadyResolvedError(error)) {
        invalidateNegotiationQueries();
        await refetchPendingLeagueAction();
        await loadMatch();
        return;
      }
      Alert.alert('Erreur', 'Impossible de refuser la proposition pour le moment.');
    } finally {
      setActionLoading(false);
    }
  }, [
    actionLoading,
    invalidateNegotiationQueries,
    loadMatch,
    negotiationProposalMessageId,
    refetchPendingLeagueAction,
  ]);

  const handleOpenCounterProposal = useCallback(() => {
    setIsNegotiationModalVisible(true);
  }, []);

  const handleSendCounterProposal = useCallback(async (proposalData) => {
    const chatId = getEntityDocumentId(match?.chat);
    if (!matchId || !chatId || actionLoading) return;

    setActionLoading(true);
    try {
      const payload = buildLeagueProposalPayload(matchId, proposalData, match?.location);
      if (canReplyFromNegotiationCard && negotiationProposalMessageId) {
        await respondProposalMessage(negotiationProposalMessageId, 'declined');
      }
      await updateMatch(matchId, payload.matchUpdate);
      await createChatMessage({
        chatId,
        composition: payload.message.composition,
        message: payload.message.message,
      });
      invalidateNegotiationQueries();
      await refetchPendingLeagueAction();
      await loadMatch();
      setIsNegotiationModalVisible(false);
      navigation.navigate(RouteNames.Conversation, {
        chatId,
        focusLatestProposal: true,
        leagueNegotiationFocusToken: String(Date.now()),
        subTitle: 'Negociation du match en cours',
        title: isAnonymous
          ? `${myTeam?.name || 'Votre squad'} vs Adversaire`
          : `${match?.team_a?.name} vs ${match?.team_b?.name}`,
      });
    } catch (error) {
      if (isAlreadyResolvedError(error)) {
        invalidateNegotiationQueries();
        await refetchPendingLeagueAction();
        await loadMatch();
        setIsNegotiationModalVisible(false);
        return;
      }
      Alert.alert('Erreur', "Impossible d'envoyer la contre-proposition.");
    } finally {
      setActionLoading(false);
    }
  }, [
    actionLoading,
    canReplyFromNegotiationCard,
    invalidateNegotiationQueries,
    isAnonymous,
    loadMatch,
    match?.chat,
    match?.location,
    match?.team_a?.name,
    match?.team_b?.name,
    matchId,
    myTeam?.name,
    navigation,
    negotiationProposalMessageId,
    refetchPendingLeagueAction,
  ]);

  const handleGoToScoreEntry = () => {
    if (isScoreLockedByTime) {
      Alert.alert(
        'Score indisponible',
        "Vous pourrez saisir le score une fois l'heure de debut du match depassee de 1 minute.",
      );
      return;
    }

    navigateToEndMatchScreen(navigation, matchId);
  };

  const handleOpenMatchStats = useCallback(() => {
    if (!myTeamId) return;

    navigation.navigate(RouteNames.MatchStatsEditor, {
      matchId,
      matchLabel: `${match?.team_a?.name || 'Equipe A'} VS ${match?.team_b?.name || 'Equipe B'}`,
      sourceType: 'league',
      sport: myTeam?.sport || match?.team_a?.sport || match?.team_b?.sport || 'football',
      teamId: myTeamId,
      teamName: myTeam?.name || null,
      title: 'Bilan equipe',
    });
  }, [match?.team_a?.name, match?.team_a?.sport, match?.team_b?.name, match?.team_b?.sport, matchId, myTeam?.name, myTeam?.sport, myTeamId, navigation]);
  const handleOpenMyMatchResponse = useCallback(() => {
    if (!myTeamId) return;

    navigation.navigate(RouteNames.PlayerMatchResponse, {
      matchId,
      matchLabel: `${match?.team_a?.name || 'Equipe A'} VS ${match?.team_b?.name || 'Equipe B'}`,
      sourceType: 'league',
      sport: leagueMyMatchResponsePayload?.sport || myTeam?.sport || match?.team_a?.sport || match?.team_b?.sport || 'football',
      teamId: myTeamId,
      teamName: myTeam?.name || null,
      title: 'Mon retour post-match',
    });
  }, [
    leagueMyMatchResponsePayload?.sport,
    match?.team_a?.name,
    match?.team_a?.sport,
    match?.team_b?.name,
    match?.team_b?.sport,
    matchId,
    myTeam?.name,
    myTeam?.sport,
    myTeamId,
    navigation,
  ]);
  const handleOpenSquadStatistics = useCallback(() => {
    if (!myTeamId) return;

    navigation.navigate(RouteNames.SquadDetails, {
      focusSection: 'statistics',
      teamId: myTeamId,
    });
  }, [myTeamId, navigation]);

  useFocusEffect(
    useCallback(() => {
      setHasDismissedMatchStatsPrompt(false);
      return () => {
        setIsMatchStatsPromptVisible(false);
      };
    }, []),
  );

  useEffect(() => {
    if (!canManageLeagueStats || normalizedStatus !== 'valid' || isLeagueStatsCompleted) {
      setIsMatchStatsPromptVisible(false);
      return;
    }

    if (leagueMatchStatsPayload && !isLeagueMatchStatsFetching && !hasDismissedMatchStatsPrompt) {
      setIsMatchStatsPromptVisible(true);
    }
  }, [
    canManageLeagueStats,
    hasDismissedMatchStatsPrompt,
    isLeagueMatchStatsFetching,
    isLeagueStatsCompleted,
    leagueMatchStatsPayload,
    normalizedStatus,
  ]);

  const screenContainerStyle = useMemo(() => ({
    paddingHorizontal: 0,
  }), []);

  if (loading) {
    return (
      <ScreenContainer bgImage="bg2" style={[screenContainerStyle]}>
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.primary500} size="large" />
        </View>
      </ScreenContainer>
    );
  }

  if (!match) {
    return (
      <ScreenContainer bgImage="bg2" style={[screenContainerStyle]}>
        <View style={styles.header}>
          <View style={styles.headerSide}>
            <HeaderBackButton
              borderColor="primary500"
              color="primary500"
              onPress={() => navigation.goBack()}
              style={styles.headerBackButton}
              withDefaultMargin={false}
            />
          </View>
          <Text style={[Fonts.h4, styles.headerTitle, { color: leagueCardTextColor }]}>Details du match</Text>
          <View style={[styles.headerSide, styles.headerSideRight]} />
        </View>
        <View style={styles.centered}>
          <Text style={[Fonts.p1, { color: leagueCardTextColor }]}>Match introuvable</Text>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer bgImage="bg2" style={[screenContainerStyle]}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <View style={styles.headerSide}>
            <HeaderBackButton
              borderColor="primary500"
              color="primary500"
              onPress={() => navigation.goBack()}
              style={styles.headerBackButton}
              withDefaultMargin={false}
            />
          </View>
          <Text style={[Fonts.h3, styles.headerTitle, { color: Colors.gold500 }]}>Details du match</Text>
          <View style={[styles.headerSide, styles.headerSideRight]}>
            {match.chat ? (
              <TouchableOpacity onPress={handleOpenChat} style={styles.chatButton}>
                <Image source={Images.envelope} style={{ height: 18, tintColor: Colors.gold500, width: 18 }} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: scrollBottomPadding, paddingHorizontal: 16 }}
          refreshControl={(
            <RefreshControl
              onRefresh={() => {
                setRefreshing(true);
                if (myTeamId && normalizedStatus === 'valid') {
                  refetchLeagueMatchStats();
                  refetchLeagueMyMatchResponse();
                }
                loadMatch();
              }}
              refreshing={refreshing}
              tintColor={Colors.primary500}
            />
          )}
        >
          <View style={styles.heroSection}>
            <View style={styles.teamColumn}>
              <TeamShield initials={String(match.team_a?.initials || match.team_a?.name || '?')} isGold size={80} />
              <Text style={[Fonts.h4, styles.teamName, { color: Colors.neutral00 }]}>{match.team_a?.name || 'Equipe A'}</Text>
            </View>

            <View
              style={[
                styles.scoreColumn,
                {
                  backgroundColor: 'rgba(1, 179, 244, 0.08)',
                  borderColor: 'rgba(1, 179, 244, 0.24)',
                  shadowColor: Colors.primary500,
                },
              ]}
            >
              {teamContextMeta ? (
                <View
                  style={[
                    styles.heroContextPill,
                    {
                      backgroundColor: teamContextMeta.backgroundColor,
                      borderColor: teamContextMeta.borderColor,
                    },
                  ]}
                >
                  <Text style={[Fonts.label, { color: teamContextMeta.textColor }]}>
                    {teamContextMeta.label}
                  </Text>
                </View>
              ) : null}
              <Text style={[Fonts.p4Bold, { color: leagueCardTextColor, marginBottom: 6 }]}>
                {match.score_a !== null && match.score_b !== null ? 'SCORE' : 'MATCH'}
              </Text>
              {match.score_a !== null && match.score_b !== null ? (
                <Text style={[Fonts.h1, { color: Colors.neutral00, fontSize: 32 }]}>
                  {match.score_a}
                  {' '}
                  -
                  {match.score_b}
                </Text>
              ) : (
                <Text style={[Fonts.h1, { color: Colors.gold500, fontSize: 24, fontStyle: 'italic' }]}>VS</Text>
              )}
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: isScoreToSubmitBadge ? 'rgba(255, 215, 0, 0.18)' : statusConfig.bg,
                    borderColor: isScoreToSubmitBadge ? 'rgba(255, 215, 0, 0.45)' : 'transparent',
                    borderWidth: isScoreToSubmitBadge ? 1 : 0,
                  },
                ]}
              >
                <View style={styles.statusBadgeContent}>
                  <Image
                    source={heroStatusMeta.icon}
                    style={{
                      height: 12,
                      marginRight: 6,
                      tintColor: statusConfig.color,
                      width: 12,
                    }}
                  />
                  <Text style={[Fonts.label, { color: statusConfig.color, textTransform: 'uppercase' }]}>
                    {statusConfig.label}
                  </Text>
                </View>
              </View>
              <Text style={[Fonts.p4, { color: leagueCardTextColor, marginTop: 8 }]}>
                {match.score_a !== null && match.score_b !== null ? 'Tableau officiel' : 'En attente du resultat'}
              </Text>
              <View
                style={[
                  styles.heroStatusSupportCard,
                  {
                    backgroundColor: `${heroStatusMeta.accentColor}12`,
                    borderColor: `${heroStatusMeta.accentColor}30`,
                  },
                ]}
              >
                <Text style={[Fonts.p4Bold, { color: heroStatusMeta.accentColor, marginBottom: 4 }]}>
                  {heroStatusMeta.label}
                </Text>
                <Text style={[Fonts.p4, { color: leagueCardTextColor, textAlign: 'center' }]}>
                  {heroStatusMeta.text}
                </Text>
              </View>
              {teamContextMeta?.subtitle ? (
                <Text style={[Fonts.p4, { color: teamContextMeta.textColor, marginTop: 6, textAlign: 'center' }]}>
                  {teamContextMeta.subtitle}
                </Text>
              ) : null}
            </View>

            <View style={styles.teamColumn}>
              {isAnonymous ? (
                <>
                  <View style={[styles.mysteryShield, { borderColor: Colors.gold500 }]}>
                    <Text style={{ color: leagueCardTextColor, fontSize: 30 }}>?</Text>
                  </View>
                  <Text style={[Fonts.h4, styles.teamName, { color: leagueCardTextColor, fontStyle: 'italic' }]}>
                    Mystere
                  </Text>
                </>
              ) : (
                <>
                  <TeamShield initials={String(match.team_b?.initials || match.team_b?.name || '?')} isGold size={80} />
                  <Text style={[Fonts.h4, styles.teamName, { color: Colors.neutral00 }]}>{match.team_b?.name || 'Equipe B'}</Text>
                </>
              )}
            </View>
          </View>

          {negotiationState ? (
            <>
              {renderSectionHeader('Negociation')}
              <LeagueCard
                style={isNegotiationHighlighted ? { borderColor: Colors.warning500, borderWidth: 2 } : null}
              >
                <View
                  style={[
                    styles.captainHeroCard,
                    {
                      backgroundColor: isNegotiationHighlighted ? 'rgba(245, 158, 11, 0.14)' : leagueAccentSurface,
                      borderColor: isNegotiationHighlighted ? 'rgba(245, 158, 11, 0.34)' : 'rgba(1, 179, 244, 0.22)',
                    },
                  ]}
                >
                  <Text style={[Fonts.p4Bold, { color: Colors.gold500, marginBottom: 4 }]}>
                    {negotiationMeta.title}
                  </Text>
                  <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
                    {negotiationMeta.helper}
                  </Text>
                </View>

                <View style={styles.infoStack}>
                  <View
                    style={[
                      styles.infoPill,
                      {
                        backgroundColor: leagueGoldSurface,
                        borderColor: 'rgba(255, 215, 0, 0.18)',
                      },
                    ]}
                  >
                    <View style={[styles.infoIconWrap, { backgroundColor: 'rgba(255, 215, 0, 0.14)' }]}>
                      <Image source={Images.calendar} style={{ height: 18, tintColor: Colors.gold500, width: 18 }} />
                    </View>
                    <View style={styles.infoTextWrap}>
                      <Text style={[Fonts.p4Bold, { color: Colors.gold500, marginBottom: 4 }]}>Derniere proposition</Text>
                      <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>{negotiationMeta.formattedDate}</Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.infoPill,
                      {
                        backgroundColor: leagueAccentSurface,
                        borderColor: 'rgba(1, 179, 244, 0.18)',
                      },
                    ]}
                  >
                    <View style={[styles.infoIconWrap, { backgroundColor: 'rgba(1, 179, 244, 0.14)' }]}>
                      <Image source={Images.pin} style={{ height: 18, tintColor: Colors.gold500, width: 18 }} />
                    </View>
                    <View style={styles.infoTextWrap}>
                      <Text style={[Fonts.p4Bold, { color: Colors.gold500, marginBottom: 4 }]}>Origine et lieu</Text>
                      <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>{negotiationProposalVenue}</Text>
                      <Text style={[Fonts.p2, { color: leagueCardTextColor, marginTop: 4 }]}>
                        {negotiationMeta.origin}
                      </Text>
                    </View>
                  </View>
                </View>

                {hasNegotiationConversation ? (
                  <View style={{ gap: 10, marginTop: 16 }}>
                    <Button
                      disabled={actionLoading}
                      onPress={handleOpenChat}
                      style={{ backgroundColor: Colors.gold500 }}
                      textStyle={{ color: Colors.primary900 }}
                      title="Repondre"
                      variant="Primary"
                    />
                    <Button
                      disabled={actionLoading}
                      onPress={handleOpenChat}
                      title={negotiationProposalMessageId ? 'Voir la proposition dans le chat' : 'Voir le fil de negociation'}
                      variant="Secondary"
                    />
                  </View>
                ) : (
                  <View
                    style={[
                      styles.heroStatusSupportCard,
                      {
                        backgroundColor: 'rgba(255,255,255,0.04)',
                        borderColor: 'rgba(255,255,255,0.12)',
                        marginTop: 16,
                      },
                    ]}
                  >
                    <Text style={[Fonts.p4Bold, { color: Colors.warning500, marginBottom: 4 }]}>
                      Conversation en preparation
                    </Text>
                    <Text style={[Fonts.p4, { color: leagueCardTextColor, textAlign: 'center' }]}>
                      La conversation avec l adversaire arrive bientot. Reessayez dans quelques secondes ou poursuivez depuis cette fiche match.
                    </Text>
                    <View style={{ gap: 10, marginTop: 14, width: '100%' }}>
                      <Button
                        disabled={actionLoading}
                        onPress={() => {
                          refetchPendingLeagueAction();
                          loadMatch();
                        }}
                        title="Reessayer"
                        variant="SecondaryLight"
                      />
                    </View>
                  </View>
                )}

                {renderNegotiationActions()}
              </LeagueCard>
            </>
          ) : null}

          <LeagueCard isGold>
            <View style={styles.infoStack}>
              <View
                style={[
                  styles.infoPill,
                  {
                    backgroundColor: leagueGoldSurface,
                    borderColor: 'rgba(255, 215, 0, 0.18)',
                  },
                ]}
              >
                <View style={[styles.infoIconWrap, { backgroundColor: 'rgba(255, 215, 0, 0.14)' }]}>
                  <Image source={Images.calendar} style={{ height: 18, tintColor: Colors.gold500, width: 18 }} />
                </View>
                <View style={styles.infoTextWrap}>
                  <Text style={[Fonts.p4Bold, { color: Colors.gold500, marginBottom: 4 }]}>Date et heure</Text>
                  <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>
                    {formattedDate}
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.infoPill,
                  {
                    backgroundColor: leagueAccentSurface,
                    borderColor: isVenueBookingHighlighted ? Colors.warning500 : 'rgba(1, 179, 244, 0.18)',
                    borderWidth: isVenueBookingHighlighted ? 2 : 1,
                  },
                ]}
              >
                <View style={[styles.infoIconWrap, { backgroundColor: 'rgba(1, 179, 244, 0.14)' }]}>
                  <Image source={Images.pin} style={{ height: 18, tintColor: Colors.gold500, width: 18 }} />
                </View>
                <View style={styles.infoTextWrap}>
                  <Text style={[Fonts.p4Bold, { color: Colors.gold500, marginBottom: 4 }]}>Lieu</Text>
                  <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>{venueLabel}</Text>
                  {showAddressLine ? (
                    <Text style={[Fonts.p2, { color: leagueCardTextColor, marginTop: 4 }]}>
                      {addressLabel}
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>

            {eloPrediction ? (
              <>
                <View style={[styles.separator, { backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                <View style={styles.eloContainer}>
                  <Text style={[Fonts.label, { color: Colors.gold500, marginBottom: 8, textAlign: 'center' }]}>
                    ENJEUX DU MATCH (ELO)
                  </Text>
                  <View style={styles.eloRow}>
                    <View
                      style={[
                        styles.eloTeam,
                        {
                          backgroundColor: leagueGoldSurface,
                          borderColor: 'rgba(255, 215, 0, 0.16)',
                        },
                      ]}
                    >
                      <Text style={[Fonts.p2, { color: leagueCardTextColor }]}>{match.team_a?.name}</Text>
                      <Text style={[Fonts.p1, { color: Colors.success500 }]}>
                        +
                        {eloPrediction.winA}
                        {' / '}
                        <Text style={{ color: Colors.error500 }}>{eloPrediction.lossA}</Text>
                      </Text>
                    </View>
                    <View style={[styles.verticalSep, { backgroundColor: 'rgba(255,255,255,0.16)' }]} />
                    <View
                      style={[
                        styles.eloTeam,
                        {
                          backgroundColor: leagueAccentSurface,
                          borderColor: 'rgba(1, 179, 244, 0.16)',
                        },
                      ]}
                    >
                      <Text style={[Fonts.p2, { color: leagueCardTextColor }]}>{isAnonymous ? '???' : match.team_b?.name}</Text>
                      <Text style={[Fonts.p1, { color: Colors.success500 }]}>
                        +
                        {eloPrediction.winB}
                        {' / '}
                        <Text style={{ color: Colors.error500 }}>{eloPrediction.lossB}</Text>
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            ) : null}
          </LeagueCard>

          {teamSide && normalizedStatus === 'valid' && canRespondMyLeagueStats ? (
            <>
              {renderSectionHeader('Mes stats')}
              <LeagueCard>
                <View style={{ gap: 12 }}>
                  <View
                    style={[
                      styles.responseHeroCard,
                      {
                        backgroundColor: leagueAccentSurface,
                        borderColor: 'rgba(1, 179, 244, 0.2)',
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[Fonts.label, { color: Colors.gold500, marginBottom: 6 }]}>RETOUR INDIVIDUEL</Text>
                      <Text style={[Fonts.h1, styles.responseLargeScore, { color: Colors.neutral00 }]}>
                        {leagueMyMatchResponse?.selfRating ? `${leagueMyMatchResponse.selfRating}/10` : 'A completer'}
                      </Text>
                      <Text style={[Fonts.p4, { color: leagueCardTextColor, marginTop: 4 }]}>
                        {leagueMyMatchResponse?.selfRating ? 'Note personnelle' : 'Renseigne ton ressenti de match'}
                      </Text>
                    </View>
                    <View
                      style={{
                        alignSelf: 'flex-start',
                        backgroundColor: myLeagueMatchResponseStatusMeta.backgroundColor,
                        borderColor: myLeagueMatchResponseStatusMeta.borderColor,
                        borderRadius: 999,
                        borderWidth: 1,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                      }}
                    >
                      <Text style={[Fonts.p4Bold, { color: myLeagueMatchResponseStatusMeta.textColor }]}>
                        {myLeagueMatchResponseStatusMeta.label}
                      </Text>
                    </View>
                  </View>

                  <Text style={[Fonts.p2, { color: leagueCardTextColor }]}>
                    {myLeagueMatchResponseSummary}
                  </Text>

                  {leagueMyMatchResponse?.teamRating ? (
                    <View
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderRadius: 16,
                        padding: 12,
                      }}
                    >
                      <Text style={[Fonts.p4Bold, { color: Colors.gold500 }]}>
                        {`Le match de l equipe : ${leagueMyMatchResponse.teamRating}/10`}
                      </Text>
                    </View>
                  ) : null}

                  {leagueMyMatchResponse?.selfComment ? (
                    <View
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderRadius: 16,
                        padding: 12,
                      }}
                    >
                      <Text numberOfLines={3} style={[Fonts.p4, { color: leagueCardTextColor }]}>
                        {leagueMyMatchResponse.selfComment}
                      </Text>
                    </View>
                  ) : null}

                  <Button
                    disabled={isLeagueMyMatchResponseFetching}
                    onPress={handleOpenMyMatchResponse}
                    size="small"
                    title={myLeagueMatchResponseButtonTitle}
                    variant="Secondary"
                  />
                </View>
              </LeagueCard>
            </>
          ) : null}

          {teamSide && normalizedStatus === 'valid' && canRespondMyLeagueStats ? (
            <>
              {renderSectionHeader('Mon retour capitaine', Colors.gold500)}
              <LeagueCard style={isCoachFeedbackHighlighted ? { borderColor: Colors.gold500, borderWidth: 2 } : null}>
                <View style={{ gap: 12 }}>
                  <View
                    style={[
                      styles.responseHeroCard,
                      {
                        backgroundColor: 'rgba(255, 215, 0, 0.08)',
                        borderColor: 'rgba(255, 215, 0, 0.18)',
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={styles.responseTitleRow}>
                        <Text style={[Fonts.label, { color: Colors.gold500, marginBottom: 6 }]}>RETOUR INDIVIDUEL</Text>
                        <View style={styles.coachTag}>
                          <Text style={[Fonts.p4Bold, { color: Colors.gold500 }]}>CAPITAINE</Text>
                        </View>
                      </View>
                      <Text style={[Fonts.h1, styles.responseLargeScore, { color: Colors.neutral00 }]}>
                        {leagueMyCoachReview?.rating != null ? `${leagueMyCoachReview.rating}/10` : 'En attente'}
                      </Text>
                      <Text style={[Fonts.p4, { color: leagueCardTextColor, marginTop: 4 }]}>
                        {hasLeagueCoachReview ? 'Evaluation publiee' : 'Retour pas encore disponible'}
                      </Text>
                    </View>
                    <View
                      style={{
                        alignSelf: 'flex-start',
                        backgroundColor: hasLeagueCoachReview ? `${Colors.success500}18` : `${Colors.primary500}18`,
                        borderColor: hasLeagueCoachReview ? `${Colors.success500}55` : `${Colors.primary500}40`,
                        borderRadius: 999,
                        borderWidth: 1,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                      }}
                    >
                      <Text style={[Fonts.p4Bold, { color: hasLeagueCoachReview ? Colors.success500 : Colors.gold500 }]}>
                        {hasLeagueCoachReview ? 'Disponible' : 'Pas encore partage'}
                      </Text>
                    </View>
                  </View>

                  <Text style={[Fonts.p2, { color: leagueCardTextColor }]}>
                    {hasLeagueCoachReview
                      ? 'Le capitaine a publie un retour individuel pour ton match.'
                      : "Le capitaine n'a pas encore laisse d'avis individuel pour ce match."}
                  </Text>

                  {leagueMyCoachReview?.comment ? (
                    <View
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderRadius: 16,
                        padding: 12,
                      }}
                    >
                      <Text style={[Fonts.p4, { color: leagueCardTextColor }]}>
                        {leagueMyCoachReview.comment}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </LeagueCard>
            </>
          ) : null}

          {canViewLeagueStats ? (
            <>
              {renderSectionHeader('Stats du match')}
              <LeagueCard>
                <View style={{ gap: 12 }}>
                  <View style={[styles.infoRow, { alignItems: 'flex-start' }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[Fonts.label, { color: Colors.gold500, marginBottom: 6 }]}>SUIVI POST-MATCH</Text>
                      <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>
                        {leagueMatchStatsPayload?.score?.available
                          ? `${leagueMatchStatsPayload?.score?.scoreFor ?? '-'} - ${leagueMatchStatsPayload?.score?.scoreAgainst ?? '-'}`
                          : 'Score en attente'}
                      </Text>
                    </View>
                    <View
                      style={{
                        alignSelf: 'flex-start',
                        backgroundColor: leagueStatsStatusMeta.backgroundColor,
                        borderColor: leagueStatsStatusMeta.borderColor,
                        borderRadius: 999,
                        borderWidth: 1,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                      }}
                    >
                      <Text style={[Fonts.p4Bold, { color: leagueStatsStatusMeta.textColor }]}>
                        {leagueStatsStatusMeta.label}
                      </Text>
                    </View>
                  </View>

                  <Text style={[Fonts.p2, { color: leagueCardTextColor }]}>
                    {leagueStatsSummaryText}
                  </Text>

                  {leagueStatsReport?.collectiveRating || leaguePlayerCollectiveRating?.average != null ? (
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                      {leagueStatsReport?.collectiveRating ? (
                        <View
                          style={{
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            borderRadius: 16,
                            flex: 1,
                            gap: 4,
                            padding: 12,
                          }}
                        >
                          <Text style={[Fonts.p4Bold, { color: Colors.gold500 }]}>Note capitaine</Text>
                          <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
                            {`${leagueStatsReport.collectiveRating}/10`}
                          </Text>
                        </View>
                      ) : null}
                      {leaguePlayerCollectiveRating?.average != null ? (
                        <View
                          style={{
                            backgroundColor: 'rgba(255,255,255,0.05)',
                            borderRadius: 16,
                            flex: 1,
                            gap: 4,
                            padding: 12,
                          }}
                        >
                          <Text style={[Fonts.p4Bold, { color: Colors.gold500 }]}>Ressenti joueurs</Text>
                          <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
                            {`${leaguePlayerCollectiveRating.average}/10`}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}

                  {leagueStatsReport?.collectiveComment ? (
                    <View
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderRadius: 16,
                        padding: 12,
                      }}
                    >
                      <Text numberOfLines={3} style={[Fonts.p4, { color: leagueCardTextColor }]}>
                        {leagueStatsReport.collectiveComment}
                      </Text>
                    </View>
                  ) : null}

                  {(leagueStatsReport?.responseEligibleCount || leagueStatsReport?.responseCompletionCount || leaguePlayerCollectiveRating?.count) ? (
                    <View
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.05)',
                        borderRadius: 16,
                        gap: 4,
                        padding: 12,
                      }}
                    >
                      <Text style={[Fonts.p4Bold, { color: Colors.gold500 }]}>
                        {`${leagueStatsReport?.responseCompletionCount ?? leaguePlayerCollectiveRating?.count ?? 0}/${leagueStatsReport?.responseEligibleCount ?? leaguePlayerCollectiveRating?.eligibleCount ?? 0} joueurs ont repondu`}
                      </Text>
                      {leaguePlayerCollectiveRating?.count ? (
                        <Text style={[Fonts.p4, { color: leagueCardTextColor }]}>
                          {`${leaguePlayerCollectiveRating.count} note${leaguePlayerCollectiveRating.count > 1 ? 's' : ''} collective${leaguePlayerCollectiveRating.count > 1 ? 's' : ''} prise${leaguePlayerCollectiveRating.count > 1 ? 's' : ''} en compte`}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  {leagueStatsReport ? (
                    <View style={{ flexDirection: 'row', gap: 16 }}>
                      <View
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          borderRadius: 16,
                          flex: 1,
                          padding: 12,
                        }}
                      >
                        <Text style={[Fonts.p3, { color: leagueCardTextColor }]}>Version</Text>
                        <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
                          {`v${Number(leagueStatsReport?.version || 1)}`}
                        </Text>
                      </View>
                      <View
                        style={{
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          borderRadius: 16,
                          flex: 2,
                          padding: 12,
                        }}
                      >
                        <Text style={[Fonts.p3, { color: leagueCardTextColor }]}>Publication</Text>
                        <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
                          {leagueStatsReport?.finalizedAt
                            ? new Date(leagueStatsReport.finalizedAt).toLocaleString('fr-FR')
                            : '-'}
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {isLeagueStatsReviewRequired ? (
                    <View
                      style={{
                        backgroundColor: `${Colors.warning500}14`,
                        borderColor: `${Colors.warning500}45`,
                        borderRadius: 16,
                        borderWidth: 1,
                        padding: 12,
                      }}
                    >
                      <Text style={[Fonts.p3, { color: Colors.warning400 }]}>
                        Le score officiel a change apres la premiere publication. Une mise a jour est requise.
                      </Text>
                    </View>
                  ) : null}

                  <Button
                    disabled={leagueStatsAction.disabled || isLeagueMatchStatsFetching}
                    onPress={handleOpenMatchStats}
                    size="small"
                    title={leagueStatsCardButtonTitle}
                    variant="Secondary"
                  />
                  {myTeamId && normalizedStatus === 'valid' ? (
                    <Button
                      onPress={handleOpenSquadStatistics}
                      size="small"
                      title="Voir les stats de la squad"
                      variant="SecondaryLight"
                    />
                  ) : null}
                </View>
              </LeagueCard>
            </>
          ) : null}

          {renderSectionHeader(
            `Compositions (${match.participations_a?.length || 0} vs ${match.participations_b?.length || 0})`,
          )}

          <LeagueCard>
            <View style={[styles.compoRow, { gap: 12 }]}>
              <View
                style={[
                  styles.compoColumn,
                  {
                    backgroundColor: leagueGoldSurface,
                    borderColor: 'rgba(255, 215, 0, 0.18)',
                  },
                ]}
              >
                <Text style={[Fonts.label, { color: Colors.gold500, marginBottom: 12 }]}>{match.team_a?.name}</Text>
                {(match.participations_a || []).map((/** @type {User} */ p, /** @type {number} */ i) => (
                  <View key={`${getEntityDocumentId(p) || i}-a`} style={styles.playerRow}>
                    <View style={[styles.dot, { backgroundColor: Colors.gold500 }]} />
                    <Text style={[Fonts.p2, { color: leagueCardTextColor }]}>{getParticipantDisplayName(p)}</Text>
                    {p.isCaptain ? <Text style={{ color: Colors.gold500, fontSize: 10, marginLeft: 4 }}>C</Text> : null}
                  </View>
                ))}
                {(!match.participations_a || match.participations_a.length === 0) ? (
                  <Text style={[Fonts.p2, { color: leagueCardTextColor, fontStyle: 'italic' }]}>Aucun joueur</Text>
                ) : null}
              </View>

              <View
                style={[
                  styles.compoColumn,
                  {
                    backgroundColor: leagueAccentSurface,
                    borderColor: 'rgba(1, 179, 244, 0.18)',
                  },
                ]}
              >
                <Text style={[Fonts.label, { color: leagueCardTextColor, marginBottom: 12 }]}>
                  {isAnonymous ? 'Adversaire' : match.team_b?.name}
                </Text>
                {isAnonymous ? (
                  <Text style={[Fonts.p2, { color: leagueCardTextColor, fontStyle: 'italic' }]}>Masque</Text>
                ) : (
                  <>
                    {(match.participations_b || []).map((/** @type {User} */ p, /** @type {number} */ i) => (
                      <View key={`${getEntityDocumentId(p) || i}-b`} style={styles.playerRow}>
                        <View style={[styles.dot, { backgroundColor: leagueCardTextColor }]} />
                        <Text style={[Fonts.p2, { color: leagueCardTextColor }]}>{getParticipantDisplayName(p)}</Text>
                      </View>
                    ))}
                    {(!match.participations_b || match.participations_b.length === 0) ? (
                      <Text style={[Fonts.p2, { color: leagueCardTextColor, fontStyle: 'italic' }]}>Aucun joueur</Text>
                    ) : null}
                  </>
                )}
              </View>
            </View>
          </LeagueCard>

          {(canShowCaptainPrimary || canShowCaptainCancel) ? (
            <>
              {renderSectionHeader(isCaptain ? 'Zone Capitaine' : 'Organisation du match')}
              <LeagueCard style={isVenueBookingHighlighted ? { borderColor: Colors.warning500, borderWidth: 2 } : null}>
                <View
                  style={[
                    styles.captainHeroCard,
                    {
                      backgroundColor: isVenueBookingHighlighted ? 'rgba(245, 158, 11, 0.14)' : leagueAccentSurface,
                      borderColor: isVenueBookingHighlighted ? 'rgba(245, 158, 11, 0.34)' : 'rgba(1, 179, 244, 0.22)',
                    },
                  ]}
                >
                  <Text style={[Fonts.p4Bold, { color: Colors.gold500, marginBottom: 4 }]}>
                    {isCaptain ? 'PRIORITE MATCH' : 'ACTION EQUIPE'}
                  </Text>
                  <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
                    {isCaptain
                      ? 'Valide les actions terrain et score pour debloquer le suivi League.'
                      : 'Le terrain doit etre confirme pour finaliser l organisation du match.'}
                  </Text>
                </View>
                {canSubmitScore || isScoreLockedByTime ? (
                  <Button
                    disabled={actionLoading}
                    icon="edit"
                    iconColor={isScoreLockedByTime ? Colors.neutral300 : Colors.neutral00}
                    iconPosition="before"
                    onPress={handleGoToScoreEntry}
                    style={{
                      backgroundColor: isScoreLockedByTime ? 'rgba(255,255,255,0.08)' : Colors.primary500,
                      borderColor: isScoreLockedByTime ? 'rgba(255,255,255,0.2)' : Colors.primary500,
                      marginBottom: 12,
                    }}
                    textStyle={{ color: isScoreLockedByTime ? Colors.neutral300 : Colors.neutral00 }}
                    title={isScoreLockedByTime ? 'Score verrouille (avant debut + 1 min)' : 'Saisir le score final'}
                    variant="Primary"
                  />
                ) : null}
                {isScoreLockedByTime ? (
                  <Text style={[Fonts.p3, { color: leagueCardTextColor, marginBottom: 12 }]}>
                    Le score sera disponible apres l&apos;heure de debut du match (+1 min).
                  </Text>
                ) : null}
                {canManageVenue ? (
                  <Button
                    disabled={actionLoading}
                    icon="stadium"
                    iconColor={Colors.primary900}
                    iconPosition="before"
                    onPress={handleMarkVenueBooked}
                    style={{ backgroundColor: Colors.gold500, marginBottom: 10 }}
                    textStyle={{ color: Colors.primary900 }}
                    title="Marquer terrain reserve"
                    variant="Primary"
                  />
                ) : null}
                {canShowCaptainCancel ? (
                  <TouchableOpacity
                    disabled={actionLoading}
                    onPress={handleCancelMatch}
                    style={{ alignItems: 'center', paddingVertical: 6 }}
                  >
                    <Text style={[Fonts.p3Bold, { color: Colors.error500, textDecorationLine: 'underline' }]}>
                      Annuler le match
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </LeagueCard>
            </>
          ) : null}
        </ScrollView>

        {teamSide && normalizedStatus === 'scheduled' ? (
          <View style={styles.bottomBar}>
            <View style={styles.bottomBarContent}>
              <View
                style={[
                  styles.presenceSummaryCard,
                  hasConfirmed
                    ? {
                      backgroundColor: 'rgba(34, 197, 94, 0.12)',
                      borderColor: 'rgba(34, 197, 94, 0.28)',
                    }
                    : {
                      backgroundColor: 'rgba(1, 179, 244, 0.08)',
                      borderColor: 'rgba(1, 179, 244, 0.22)',
                    },
                ]}
              >
                <View style={styles.presenceSummaryHeader}>
                  <View style={styles.presenceSummaryTitleRow}>
                    <View
                      style={[
                        styles.presenceSummaryDot,
                        { backgroundColor: hasConfirmed ? Colors.success500 : Colors.primary500 },
                      ]}
                    />
                    <Text
                      style={[
                        Fonts.p2Bold,
                        {
                          color: hasConfirmed ? Colors.success500 : Colors.neutral00,
                        },
                      ]}
                    >
                      {hasConfirmed ? 'Presence confirmee' : 'Disponibilite match'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.presenceCountPill,
                      {
                        backgroundColor: hasConfirmed ? 'rgba(34, 197, 94, 0.14)' : 'rgba(1, 179, 244, 0.14)',
                        borderColor: hasConfirmed ? 'rgba(34, 197, 94, 0.24)' : 'rgba(1, 179, 244, 0.24)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        Fonts.p4Bold,
                        {
                          color: hasConfirmed ? Colors.success500 : leagueCardTextColor,
                        },
                      ]}
                    >
                      {participationCount}
                      /
                      {requiredPlayers}
                    </Text>
                  </View>
                </View>
                <Text style={[Fonts.p3, { color: leagueCardTextColor, marginTop: 10 }]}>
                  {presenceHelperText}
                </Text>
              </View>
              {hasConfirmed ? (
                <View style={styles.confirmedActionsRow}>
                  <Button
                    disabled={actionLoading}
                    icon="close"
                    iconColor={Colors.error500}
                    iconPosition="before"
                    onPress={handleDeclineParticipation}
                    size="small"
                    style={{
                      backgroundColor: 'transparent',
                      borderColor: Colors.error500,
                      minWidth: 156,
                    }}
                    textStyle={{ color: Colors.error500 }}
                    title="Passer absent"
                    variant="Secondary"
                  />
                </View>
              ) : (
                <View style={styles.presenceActionsRow}>
                  <Button
                    disabled={actionLoading}
                    icon="close"
                    iconColor={Colors.error500}
                    iconPosition="before"
                    onPress={handleDeclineParticipation}
                    style={{
                      backgroundColor: 'transparent',
                      borderColor: Colors.error500,
                      flex: 0.92,
                    }}
                    textStyle={{ color: Colors.error500 }}
                    title="Absent"
                    variant="Secondary"
                  />
                  <Button
                    disabled={actionLoading || isRosterFull}
                    icon="check"
                    iconColor={isRosterFull ? Colors.neutral300 : Colors.primary900}
                    iconPosition="before"
                    onPress={handleConfirmParticipation}
                    style={{
                      backgroundColor: isRosterFull ? 'rgba(255,255,255,0.08)' : Colors.gold500,
                      borderColor: isRosterFull ? 'rgba(255,255,255,0.16)' : Colors.gold500,
                      flex: 1.4,
                    }}
                    textStyle={{ color: isRosterFull ? Colors.neutral300 : Colors.primary900 }}
                    title={presencePrimaryTitle}
                    variant="Primary"
                  />
                </View>
              )}
            </View>
          </View>
        ) : null}

        <BottomModal
          close={() => {
            setHasDismissedMatchStatsPrompt(true);
            setIsMatchStatsPromptVisible(false);
          }}
          isVisible={isMatchStatsPromptVisible}
          snapPoints={['40%']}
        >
          <View style={{ gap: 16, paddingBottom: 12 }}>
            <View style={{ gap: 4 }}>
              <Text style={[Fonts.h3Bold, { color: Colors.neutral00 }]}>Stats de fin de match</Text>
              <Text style={[Fonts.p2, { color: leagueCardTextColor }]}>
                {isLeagueStatsReviewRequired
                  ? 'Le score officiel a change. Verifie les lignes puis republie ce rapport.'
                  : 'Le score est valide. Tu peux maintenant completer le temps de jeu et les stats cles de ton equipe.'}
              </Text>
            </View>

            <LeagueCard>
              <Text style={[Fonts.p3, { color: leagueCardTextColor }]}>Equipe concernee</Text>
              <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginTop: 6 }]}>
                {myTeam?.name || 'Mon equipe'}
              </Text>
              <Text style={[Fonts.p3, { color: Colors.gold500, marginTop: 6 }]}>
                {match?.team_a?.name || 'Equipe A'}
                {' VS '}
                {match?.team_b?.name || 'Equipe B'}
              </Text>
            </LeagueCard>

            <Button
              onPress={() => {
                setHasDismissedMatchStatsPrompt(true);
                setIsMatchStatsPromptVisible(false);
                handleOpenMatchStats();
              }}
              title={leagueStatsAction.title}
              variant="Primary"
            />
            <Button
              onPress={() => {
                setHasDismissedMatchStatsPrompt(true);
                setIsMatchStatsPromptVisible(false);
              }}
              title="Plus tard"
              variant="Secondary"
            />
          </View>
        </BottomModal>
        <VenueProposalModal
          initialDate={proposalDefaults.date}
          initialEndTime={proposalDefaults.end}
          initialStartTime={proposalDefaults.start}
          isVisible={isNegotiationModalVisible}
          onClose={() => setIsNegotiationModalVisible(false)}
          onSend={handleSendCounterProposal}
          onSkip={() => setIsNegotiationModalVisible(false)}
        />
      </SafeAreaView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    backgroundColor: 'rgba(10, 28, 43, 0.96)',
    borderTopColor: 'rgba(1, 179, 244, 0.25)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    bottom: 0,
    elevation: 18,
    left: 0,
    paddingBottom: 30,
    paddingHorizontal: 16,
    paddingTop: 12,
    position: 'absolute',
    right: 0,
    shadowColor: '#000',
    shadowOffset: { height: -10, width: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 14,
  },
  bottomBarContent: {
    width: '100%',
  },
  captainHeroCard: {
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  chatButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderColor: 'rgba(255, 215, 0, 0.42)',
    borderRadius: 999,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  coachTag: {
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderColor: 'rgba(255, 215, 0, 0.25)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  compoColumn: {
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    minHeight: 140,
    padding: 14,
  },
  compoRow: {
    flexDirection: 'row',
  },
  confirmedActionsRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    width: '100%',
  },
  dot: {
    borderRadius: 3,
    height: 6,
    marginRight: 8,
    width: 6,
  },
  eloContainer: {
    marginTop: 8,
  },
  eloRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-around',
  },
  eloTeam: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBackButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 0,
  },
  headerSide: {
    alignItems: 'flex-start',
    minWidth: 42,
  },
  headerSideRight: {
    alignItems: 'flex-end',
  },
  headerTitle: {
    flex: 1,
    letterSpacing: 1,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  heroContextPill: {
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroSection: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
    marginTop: 10,
  },
  heroStatusSupportCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    width: '100%',
  },
  infoIconWrap: {
    alignItems: 'center',
    borderRadius: 14,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  infoPill: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  infoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 8,
  },
  infoStack: {
    gap: 10,
  },
  infoTextWrap: {
    flex: 1,
    marginLeft: 12,
  },
  mysteryShield: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 40,
    borderStyle: 'dashed',
    borderWidth: 2,
    height: 80,
    justifyContent: 'center',
    width: 80,
  },
  playerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 8,
  },
  presenceActionsRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  presenceCountPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  presenceSummaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  presenceSummaryDot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  presenceSummaryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  presenceSummaryTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  progressChip: {
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 70,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  progressChipDone: {
    backgroundColor: 'rgba(1, 179, 244, 0.14)',
    borderColor: 'rgba(1, 179, 244, 0.42)',
  },
  progressChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  progressChipText: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 10,
    textAlign: 'center',
  },
  progressChipTodo: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.16)',
  },
  responseHeroCard: {
    alignItems: 'flex-start',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  responseLargeScore: {
    fontSize: 34,
    lineHeight: 38,
  },
  responseTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scoreColumn: {
    alignItems: 'center',
    borderRadius: 28,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 132,
    paddingHorizontal: 10,
    paddingVertical: 16,
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    width: '40%',
  },
  sectionHeaderDot: {
    borderRadius: 999,
    height: 10,
    marginRight: 10,
    width: 10,
  },
  sectionHeaderLine: {
    flex: 1,
    height: 1,
    marginLeft: 12,
  },
  sectionHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 12,
    marginTop: 24,
  },
  sectionHeaderText: {
    letterSpacing: 0.4,
  },
  sectionTitle: {
    marginBottom: 12,
    marginTop: 24,
  },
  separator: {
    height: 1,
    marginVertical: 8,
    width: '100%',
  },
  statusBadge: {
    borderRadius: 4,
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusBadgeContent: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  teamColumn: {
    alignItems: 'center',
    width: '30%',
  },
  teamName: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  verticalSep: {
    height: 30,
    marginHorizontal: 16,
    width: 1,
  },
});

export default LeagueMatchDetails;
