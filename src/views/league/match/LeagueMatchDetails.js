import { useFocusEffect, useIsFocused } from '@react-navigation/native';
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
import SegmentedControl from '@/components/molecules/segmentedControl/SegmentedControl';
import VenueProposalModal from '@/components/organisms/venueProposalModal/VenueProposalModal';
import ScreenContainer from '@/components/templates/ScreenContainer';
import LeagueStateView from '@/views/league/components/LeagueStateView';
import { navigateToEndMatchScreen } from '@/views/league/match/utils/leagueNavigation';
import buildWorkflowViewModel from '@/views/league/match/utils/leagueWorkflowPresenter';
import {
  getMatchDerivedPhase,
  getMatchStatusBadgeConfig,
  isVenueBookedForMatch,
  normalizeMatchStatus,
  shouldMaskOpponentIdentity,
} from '@/views/league/match/utils/matchStatus';
import {
  buildProposalDefaultsFromMatch,
} from '@/views/league/match/utils/proposalDefaults';
import {
  buildCanonicalLeagueProposalPayload,
  getProposalLocationLabel,
} from '@/views/league/match/utils/proposalPayload';
import {
  buildLocalScoreFlow,
  formatScoreFlowCountdown,
} from '@/views/league/match/utils/scoreFlow';

import { RouteNames } from '@/navigation/routeNames';
import useBottomDockLayout from '@/navigation/useBottomDockLayout';

import {
  getPendingLeagueActionQueryKey,
  usePendingLeagueAction,
} from '@/services/league/leagueActionQueries';
import { loadLeagueMatchWithCache } from '@/services/league/leagueMatchQueries';
import {
  cancelMatch,
  confirmParticipation,
  createLeagueProposal,
  declineParticipation,
  markVenueBooked,
  respondToLeagueProposal,
  submitPostSlotResponse,
} from '@/services/league/leagueMatchService';
import {
  useGetLeagueMatchStats,
  useGetLeagueMyMatchResponse,
} from '@/services/matchStats/matchStatsQueries';

import { areSameEntityId, getEntityDocumentId } from '@/utils/entityId';
import { isLeagueCaptain, isLeagueMember } from '@/utils/league/captains';
import {
  doesMatchRequireVenue,
  getMatchDurationMinutes,
  getRequiredPlayersForSport,
} from '@/utils/leagueSportConfig';
import {
  dismissMatchStatsPromptForSession,
  isMatchStatsPromptDismissedForSession,
} from '@/utils/matchStatsPromptSession';

import { LEAGUE_LEGAL_SCOPES } from '@/constants/leagueLegalAcceptance';
import { useAppFeedback } from '@/context/AppFeedbackContext';
import useLeagueLegalAcceptance from '@/hooks/useLeagueLegalAcceptance';

/**
 * @typedef {{navigation: any, route: {params: {matchId: string}}}} LeagueMatchDetailsProps
 */

const normalizeComparableText = (/** @type {unknown} */ value) => String(value || '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();
const resolveVenueLabel = (/** @type {LeagueMatch | null} */ match) => (
  getProposalLocationLabel(match?.venue)
    || getProposalLocationLabel(match?.proposed_venue)
    || 'Lieu \u00E0 d\u00E9finir'
);
const resolveAddressLabel = (/** @type {LeagueMatch | null} */ match) => (
  getProposalLocationLabel(match?.location?.address)
    || getProposalLocationLabel(match?.address)
    || ''
);
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

const LIVE_MATCH_POLLING_PHASES = new Set([
  'disputed',
  'opponent_found',
  'pending_validation',
  'post_slot_resolution',
  'proposal_received',
  'proposal_sent_waiting',
  'waiting_proposal',
  'waiting_score',
  'waiting_venue',
]);

const isAlreadyResolvedError = (error) => {
  const status = Number(error?.response?.status || error?.status || 0);
  const code = String(error?.response?.data?.error?.code || error?.code || '');
  return status === 409 || code === 'ALREADY_RESOLVED';
};

/**
 * @param {LeagueMatchDetailsProps} props
 * @returns {import('react').ReactElement}
 */
function LeagueMatchDetails({ navigation, route }) {
  const { matchId } = route.params;
  const highlightedSection = route?.params?.focusSection || null;
  const queryClient = useQueryClient();
  const isFocused = useIsFocused();
  const { Colors, Fonts, Images } = useTheme();
  const { userData } = /** @type {{ userData: User | null }} */ (useAuth());
  const { showBanner } = useAppFeedback();
  const { leagueLegalAcceptanceModal, requestLeagueLegalAcceptance } = useLeagueLegalAcceptance();
  const { floatingActionBottomOffset, sceneBottomInset } = useBottomDockLayout();
  const leagueCardTextColor = Colors.primary500;
  const leagueAccentSurface = 'rgba(1, 179, 244, 0.12)';
  const leagueAccentSurfaceSoft = 'rgba(1, 179, 244, 0.07)';
  const leagueGoldSurface = 'rgba(255, 215, 0, 0.08)';

  const [actionLoading, setActionLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [match, setMatch] = useState(/** @type {LeagueMatch | null} */ (null));
  const [isMatchStatsPromptVisible, setIsMatchStatsPromptVisible] = useState(false);
  const [dismissedMatchStatsPromptKey, setDismissedMatchStatsPromptKey] = useState(null);
  const [isNegotiationModalVisible, setIsNegotiationModalVisible] = useState(false);
  const [isNegotiationResponseSheetVisible, setIsNegotiationResponseSheetVisible] = useState(false);
  const [isPostSlotResolutionVisible, setIsPostSlotResolutionVisible] = useState(false);
  const [postSlotResolutionStep, setPostSlotResolutionStep] = useState(/** @type {string | null} */ (null));
  const [isActionDockExpanded, setIsActionDockExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedContentTab, setSelectedContentTab] = useState('match');

  const userId = getEntityDocumentId(userData);

  const loadMatch = useCallback(async (options = {}) => {
    if (!matchId) {
      setLoadError("Aucun match n'est associe a ce lien.");
      setMatch(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      setLoadError('');
      const data = await loadLeagueMatchWithCache(queryClient, matchId, {
        staleTime: options?.forceFresh ? 0 : 30_000,
      });
      setMatch(data);
    } catch (error) {
      console.error('Error loading match:', error);
      setMatch(null);
      setLoadError(error?.message || 'Impossible de charger le match pour le moment.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [matchId, queryClient]);

  const matchPhase = useMemo(() => getMatchDerivedPhase(match), [match]);
  const shouldPollLiveMatch = LIVE_MATCH_POLLING_PHASES.has(String(matchPhase || '').trim().toLowerCase());

  useFocusEffect(
    useCallback(() => {
      loadMatch();
      if (!shouldPollLiveMatch) {
        return undefined;
      }

      const interval = setInterval(() => {
        loadMatch({ forceFresh: true });
      }, 15000);

      return () => clearInterval(interval);
    }, [loadMatch, shouldPollLiveMatch]),
  );

  useEffect(() => {
    setIsActionDockExpanded(false);
    setSelectedContentTab('match');
    setIsNegotiationResponseSheetVisible(false);
  }, [matchId]);

  const isInTeamA = useMemo(() => {
    const membersA = match?.team_a?.members || [];
    return (
      isLeagueMember(match?.team_a, userId)
      || membersA.some((/** @type {User} */ m) => areSameEntityId(getEntityDocumentId(m), userId))
    );
  }, [match, userId]);

  const isInTeamB = useMemo(() => {
    const membersB = match?.team_b?.members || [];
    return (
      isLeagueMember(match?.team_b, userId)
      || membersB.some((/** @type {User} */ m) => areSameEntityId(getEntityDocumentId(m), userId))
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
    enabled: isFocused && Boolean(myTeamId),
    refetchOnMount: false,
  });

  const {
    data: leagueMatchStatsPayload,
    isFetching: isLeagueMatchStatsFetching,
    refetch: refetchLeagueMatchStats,
  } = useGetLeagueMatchStats(matchId, myTeamId || undefined, {
    enabled: isFocused && Boolean(matchId && myTeamId && String(match?.status || '').toLowerCase() === 'valid'),
  });
  const {
    data: leagueMyMatchResponsePayload,
    isFetching: isLeagueMyMatchResponseFetching,
    refetch: refetchLeagueMyMatchResponse,
  } = useGetLeagueMyMatchResponse(matchId, myTeamId || undefined, {
    enabled: isFocused && Boolean(matchId && myTeamId && String(match?.status || '').toLowerCase() === 'valid'),
  });

  const isCaptainA = isLeagueCaptain(match?.team_a, userId);
  const isCaptainB = isLeagueCaptain(match?.team_b, userId);
  const isCaptain = isCaptainA || isCaptainB;

  const participations = teamSide === 'a' ? (match?.participations_a || []) : (match?.participations_b || []);
  const hasConfirm\u00E9d = participations.some((/** @type {User} */ p) => areSameEntityId(getEntityDocumentId(p), userId));
  const participationCount = participations.length;
  const requiredPlayers = useMemo(() => getRequiredPlayersForSport(myTeam?.sport), [myTeam?.sport]);
  const venueRequired = useMemo(() => doesMatchRequireVenue(match), [match]);
  const primaryFocusSection = venueRequired ? 'venueBooking' : 'presence';

  const normalizedStatus = useMemo(() => normalizeMatchStatus(match?.status), [match?.status]);
  const isVenueBooked = useMemo(() => isVenueBookedForMatch(match), [match]);
  const isAnonymous = useMemo(() => shouldMaskOpponentIdentity(match), [match]);
  const matchLegalLabel = useMemo(() => {
    const left = match?.team_a?.name || 'Equipe A';
    const right = isAnonymous ? 'Adversaire' : (match?.team_b?.name || 'Equipe B');
    return `${left} VS ${right}`;
  }, [isAnonymous, match?.team_a?.name, match?.team_b?.name]);
  const scoreFlow = useMemo(
    () => buildLocalScoreFlow(match, { isCaptainA, isCaptainB, teamSide }),
    [isCaptainA, isCaptainB, match, teamSide],
  );
  const isScoreActionPhase = useMemo(
    () => ['disputed', 'pending_validation', 'waiting_score'].includes(matchPhase)
      || ['admin_resolution', 'opponent_score_pending', 'ready_to_submit', 'submitted_waiting_opponent'].includes(scoreFlow.state),
    [matchPhase, scoreFlow.state],
  );
  const leagueStatsReport = leagueMatchStatsPayload?.report || null;
  const leaguePlayerCollectiveRating = leagueMatchStatsPayload?.playerCollectiveRating || null;
  const leagueMyCoachReview = leagueMatchStatsPayload?.myCoachReview || null;
  const leagueMyMatchResponse = leagueMyMatchResponsePayload?.response || null;
  const isCoachFeedbackHighlighted = highlightedSection === 'coachFeedback';
  const isVenueBookingHighlighted = venueRequired && highlightedSection === 'venueBooking';
  const hasLeagueCoachReview = leagueMyCoachReview?.rating != null || Boolean(leagueMyCoachReview?.comment);
  const isLeagueStatsFinal = leagueStatsReport?.status === 'final';
  const isLeagueStatsReviewRequired = Boolean(leagueStatsReport?.needsReview);
  const isLeagueStatsCompleted = isLeagueStatsFinal && !isLeagueStatsReviewRequired;
  const canViewLeagueStats = Boolean(leagueMatchStatsPayload?.permissions?.canView || teamSide);
  const canManageLeagueStats = Boolean(leagueMatchStatsPayload?.permissions?.canManage);
  const matchStatsPromptSessionKey = useMemo(() => (
    [
      'league',
      matchId,
      String(leagueStatsReport?.documentId || leagueStatsReport?.id || 'report'),
      `version:${Number(leagueStatsReport?.version || 0)}`,
      `review:${isLeagueStatsReviewRequired ? 'yes' : 'no'}`,
      `status:${normalizedStatus || 'unknown'}`,
    ].join(':')
  ), [
    isLeagueStatsReviewRequired,
    leagueStatsReport?.documentId,
    leagueStatsReport?.id,
    leagueStatsReport?.version,
    matchId,
    normalizedStatus,
  ]);
  const dismissMatchStatsPrompt = useCallback(() => {
    if (matchStatsPromptSessionKey) {
      dismissMatchStatsPromptForSession(matchStatsPromptSessionKey);
      setDismissedMatchStatsPromptKey(matchStatsPromptSessionKey);
    }
    setIsMatchStatsPromptVisible(false);
  }, [matchStatsPromptSessionKey]);
  const canRespondMyLeagueStats = Boolean(leagueMyMatchResponsePayload?.permissions?.canRespond || teamSide);
  const canSubmitScore = useMemo(
    () => Boolean(teamSide && scoreFlow.canSubmit),
    [scoreFlow.canSubmit, teamSide],
  );
  const isScoreLockedByTime = useMemo(
    () => Boolean(teamSide && scoreFlow.state === 'locked_before_start'),
    [scoreFlow.state, teamSide],
  );
  const pendingLeagueAction = pendingLeagueActionPayload?.nextAction || null;
  const workflowViewModel = useMemo(
    () => buildWorkflowViewModel(match, pendingLeagueAction, { isCaptain }),
    [isCaptain, match, pendingLeagueAction],
  );
  const leagueTimeline = Array.isArray(match?.workflow?.timeline) ? match.workflow.timeline : [];
  const isPendingActionForCurrentMatch = useMemo(() => {
    const currentMatchId = getEntityDocumentId(match);
    return areSameEntityId(pendingLeagueAction?.matchId, matchId)
      || areSameEntityId(pendingLeagueAction?.matchId, currentMatchId);
  }, [match, matchId, pendingLeagueAction?.matchId]);
  const isPostSlotResolutionCurrentMatch = useMemo(() => {
    const nextActionState = String(pendingLeagueAction?.state || '').trim();
    return matchPhase === 'post_slot_resolution'
      || (isPendingActionForCurrentMatch && nextActionState === 'post_slot_resolution');
  }, [isPendingActionForCurrentMatch, matchPhase, pendingLeagueAction?.state]);
  const effectivePostSlotResolutionStep = postSlotResolutionStep || pendingLeagueAction?.step || 'ask_happened';
  const lastProposalSide = String(match?.automation_meta?.last_proposal_by_side || '').trim().toLowerCase();
  const fallbackNegotiationState = useMemo(() => {
    if (matchPhase !== 'waiting_proposal') return null;
    if (teamSide && lastProposalSide) {
      return lastProposalSide === teamSide ? 'proposal_sent_waiting' : 'proposal_received';
    }
    return 'opponent_found';
  }, [lastProposalSide, matchPhase, teamSide]);
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
  const isTimelineHighlighted = highlightedSection === 'timeline';
  const negotiationProposalDate = pendingLeagueAction?.date || match?.proposed_time || match?.date || null;
  const negotiationProposalVenue = getProposalLocationLabel(pendingLeagueAction?.venue)
    || getProposalLocationLabel(match?.proposed_venue)
    || getProposalLocationLabel(match?.venue)
    || 'Lieu \u00E0 d\u00E9finir';
  const negotiationProposalMessageId = String(pendingLeagueAction?.proposalMessageId || '').trim();
  const hasNegotiationConversation = Boolean(getEntityDocumentId(match?.chat));
  const canReplyFromNegotiationCard = negotiationState === 'proposal_received' && Boolean(negotiationProposalMessageId);
  const canCreateFirstProposalFromNegotiationCard = negotiationState === 'opponent_found';
  const canCounterProposeFromNegotiationCard = Boolean(
    hasNegotiationConversation && ['proposal_received', 'proposal_sent_waiting'].includes(String(negotiationState || '')),
  );
  const proposalDefaults = useMemo(
    () => buildProposalDefaultsFromMatch(match || null),
    [match],
  );
  const negotiationMeta = useMemo(() => {
    let title = 'Negociation du match';
    let helper = "Retrouve la conversation avec l'adversaire pour conclure rapidement.";
    let origin = 'Discussion League active';

    if (negotiationState === 'proposal_received') {
      title = 'Proposition reçue';
      helper = 'Une proposition adverse attend votre r\u00E9ponse. Vous pouvez accepter, refuser ou contre-proposer.';
      origin = "Envoy\u00E9e par l'adversaire";
    } else if (negotiationState === 'proposal_sent_waiting') {
      title = 'Proposition envoy\u00E9e';
      helper = 'Votre squad attend maintenant la r\u00E9ponse adverse. La conversation reste le centre de la negociation.';
      origin = 'Envoy\u00E9e par votre squad';
    } else if (negotiationState === 'opponent_found') {
      title = 'Adversaire trouve';
      helper = venueRequired
        ? 'Le match est cree. Envoyez une proposition de date et de terrain pour lancer la negociation.'
        : 'Le match est cree. Envoyez une proposition de date, avec un lieu si vous voulez le fixer tout de suite.';
      origin = 'Aucune proposition d\u00E9finitive pour le moment';
    }

    let formattedDate = 'Date \u00E0 d\u00E9finir';
    if (negotiationProposalDate) {
      try {
        formattedDate = format(new Date(negotiationProposalDate), "EEEE d MMMM 'a' HH'h'mm", { locale: fr });
      } catch (_error) {
        formattedDate = 'Date \u00E0 d\u00E9finir';
      }
    }

    return {
      formattedDate,
      helper,
      origin,
      title,
    };
  }, [negotiationProposalDate, negotiationState, venueRequired]);
  const renderNegotiationActions = useCallback(() => {
    if (canCreateFirstProposalFromNegotiationCard && !hasNegotiationConversation) {
      return (
        <View style={{ gap: 10, marginTop: 16 }}>
          <Button
            disabled={actionLoading}
            onPress={handleOpenCounterProposal}
            title="Envoyer une proposition"
            variant="Primary"
          />
        </View>
      );
    }

    if (canReplyFromNegotiationCard) {
      return (
        <View style={{ gap: 10, marginTop: 16 }}>
          <Button
            disabled={actionLoading}
            onPress={handleOpenNegotiationResponseSheet}
            style={{
              backgroundColor: Colors.gold500,
              borderColor: Colors.gold500,
            }}
            textStyle={{ color: Colors.primary900 }}
            title="Repondre"
            variant="Primary"
          />
          {hasNegotiationConversation ? (
            <TouchableOpacity
              disabled={actionLoading}
              onPress={handleOpenChat}
              style={{ alignSelf: 'flex-start', paddingVertical: 2 }}
            >
              <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
                Ouvrir dans le chat &gt;
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      );
    }

    if (canCounterProposeFromNegotiationCard) {
      return (
        <View style={{ gap: 10, marginTop: 16 }}>
          <Button
            disabled={actionLoading}
            onPress={handleOpenChat}
            title="Ouvrir le chat"
            variant="SecondaryLight"
          />
          <TouchableOpacity
            disabled={actionLoading}
            onPress={handleOpenCounterProposal}
            style={{ alignItems: 'center', paddingVertical: 4 }}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
              Envoyer une nouvelle proposition
            </Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  }, [
    actionLoading,
    canCreateFirstProposalFromNegotiationCard,
    canCounterProposeFromNegotiationCard,
    canReplyFromNegotiationCard,
    Colors.gold500,
    Colors.primary500,
    Colors.primary900,
    Fonts.p4Bold,
    Fonts.p3Bold,
    handleOpenChat,
    handleOpenCounterProposal,
    handleOpenNegotiationResponseSheet,
    hasNegotiationConversation,
  ]);
  const renderPostSlotResolutionActions = useCallback(() => {
    if (effectivePostSlotResolutionStep === 'choose_not_played_action') {
      return (
        <View style={styles.bottomCaptainButtonsStack}>
          <Button
            disabled={actionLoading}
            onPress={() => handleSubmitPostSlotResolution({ nextAction: 'reschedule', outcome: 'not_played' })}
            title="Replanifier ce match"
            variant="Primary"
          />
          <Button
            disabled={actionLoading}
            onPress={() => handleSubmitPostSlotResolution({ nextAction: 'cancel', outcome: 'not_played' })}
            title="Annuler le match"
            variant="Secondary"
          />
          <Button
            disabled={actionLoading}
            onPress={() => setPostSlotResolutionStep(null)}
            title="Retour"
            variant="Secondary"
          />
        </View>
      );
    }

    if (effectivePostSlotResolutionStep === 'confirm_reschedule') {
      return (
        <View style={styles.bottomCaptainButtonsStack}>
          <Button
            disabled={actionLoading}
            onPress={() => handleSubmitPostSlotResolution({ nextAction: 'reschedule', outcome: 'not_played' })}
            title="Confirmer la replanification"
            variant="Primary"
          />
          <Button
            disabled={actionLoading}
            onPress={() => handleSubmitPostSlotResolution({ outcome: 'played' })}
            title="Le match a eu lieu"
            variant="Secondary"
          />
        </View>
      );
    }

    if (effectivePostSlotResolutionStep === 'confirm_cancel') {
      return (
        <View style={styles.bottomCaptainButtonsStack}>
          <Button
            disabled={actionLoading}
            onPress={() => handleSubmitPostSlotResolution({ nextAction: 'cancel', outcome: 'not_played' })}
            title="Confirmer l annulation"
            variant="Primary"
          />
          <Button
            disabled={actionLoading}
            onPress={() => handleSubmitPostSlotResolution({ outcome: 'played' })}
            title="Le match a eu lieu"
            variant="Secondary"
          />
        </View>
      );
    }

    return (
      <View style={styles.bottomCaptainButtonsStack}>
        <Button
          disabled={actionLoading}
          onPress={() => handleSubmitPostSlotResolution({ outcome: 'played' })}
          title="Oui, le match a eu lieu"
          variant="Primary"
        />
        <Button
          disabled={actionLoading}
          onPress={openPostSlotNoMatchChoices}
          title="Non, le match n a pas eu lieu"
          variant="Secondary"
        />
      </View>
    );
  }, [
    actionLoading,
    effectivePostSlotResolutionStep,
    handleSubmitPostSlotResolution,
    openPostSlotNoMatchChoices,
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
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderColor: 'rgba(255, 255, 255, 0.18)',
        label: 'EXTERIEUR',
        subtitle: 'Deplacement League',
        textColor: Colors.neutral200,
      };
    }

    return null;
  }, [Colors.neutral200, Colors.primary500, teamSide]);
  const remainingPlayers = useMemo(
    () => Math.max(requiredPlayers - participationCount, 0),
    [participationCount, requiredPlayers],
  );
  const isRosterFull = participationCount >= requiredPlayers;
  const hasOfficialScore = match?.score_a !== null && match?.score_b !== null;
  const pr\u00E9senceCompactHelperText = useMemo(() => {
    if (hasConfirm\u00E9d) {
      if (remainingPlayers <= 0) return 'Le quorum est atteint pour ton \u00E9quipe.';
      return `Encore ${remainingPlayers} joueur${remainingPlayers > 1 ? 's' : ''} pour atteindre le quorum.`;
    }

    if (isRosterFull) return 'Effectif complet pour le moment.';
    return `Il manque ${remainingPlayers} joueur${remainingPlayers > 1 ? 's' : ''} pour atteindre le quorum.`;
  }, [hasConfirm\u00E9d, isRosterFull, remainingPlayers]);
  const pr\u00E9sencePrimaryTitle = useMemo(() => {
    if (isRosterFull) return 'Complet';
    return 'Je participe';
  }, [isRosterFull]);

  const formattedDate = useMemo(() => {
    if (!match?.date) return 'Date \u00E0 d\u00E9finir';
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

  const canManageVenue = Boolean(venueRequired && teamSide && matchPhase === 'waiting_venue');
  const hasCaptainQuickActions = Boolean(
    canManageVenue
      || canSubmitScore
      || isScoreLockedByTime
      || (isCaptain && isPostSlotResolutionCurrentMatch),
  );
  const canShowCaptainPrimary = hasCaptainQuickActions;
  const canShowCaptainCancel = isCaptain && normalizedStatus === 'scheduled';
  const hasBottomPresenceBar = Boolean(
    teamSide && ['confirmed_upcoming', 'waiting_venue'].includes(String(matchPhase || '').trim()),
  );
  const shouldShowInlineCaptainActions = Boolean(teamSide && hasCaptainQuickActions && !hasBottomPresenceBar);
  const hasBottomActionBar = Boolean(teamSide && hasBottomPresenceBar);
  const bottomBarFloatingStyle = useMemo(() => ({
    bottom: floatingActionBottomOffset,
  }), [floatingActionBottomOffset]);
  const scrollBottomPadding = useMemo(() => {
    const dockOffset = hasBottomActionBar ? floatingActionBottomOffset : 0;
    if (!hasBottomActionBar) return Math.max(sceneBottomInset, 52);
    if (!isActionDockExpanded) return dockOffset + 124;
    if (hasBottomPresenceBar && hasCaptainQuickActions) return dockOffset + 344;
    if (hasCaptainQuickActions) return dockOffset + 212;
    if (canShowCaptainCancel) return dockOffset + 236;
    return dockOffset + 192;
  }, [
    canShowCaptainCancel,
    floatingActionBottomOffset,
    hasBottomActionBar,
    hasBottomPresenceBar,
    hasCaptainQuickActions,
    isActionDockExpanded,
    sceneBottomInset,
  ]);
  const renderCaptainQuickActionButtons = () => (
    <View pointerEvents="box-none" style={styles.bottomCaptainButtonsStack}>
      {isPostSlotResolutionCurrentMatch ? (
        <Button
          disabled={actionLoading}
          icon="flag"
          iconColor={Colors.primary900}
          iconPosition="before"
          onPress={handleOpenPostSlotResolution}
          size="small"
          style={{
            backgroundColor: Colors.gold500,
            borderColor: Colors.gold500,
          }}
          textStyle={{ color: Colors.primary900 }}
          title="Confirmer le match"
          variant="Primary"
        />
      ) : null}
      {canManageVenue ? (
        <Button
          disabled={actionLoading}
          icon="stadium"
          iconColor={Colors.neutral00}
          iconPosition="before"
          onPress={handleMarkVenueBooked}
          size="small"
          style={{
            backgroundColor: Colors.primary500,
            borderColor: Colors.primary500,
          }}
          textStyle={{ color: Colors.neutral00 }}
          title="Marquer terrain reserve"
          variant="Primary"
        />
      ) : null}
      {isScoreLockedByTime && !canSubmitScore ? (
        <View
          pointerEvents="none"
          style={[
            styles.bottomLockedInfo,
            {
              backgroundColor: 'rgba(1, 179, 244, 0.08)',
              borderColor: 'rgba(1, 179, 244, 0.24)',
            },
          ]}
        >
          <Image source={Images.clock} style={{ height: 16, tintColor: Colors.primary500, width: 16 }} />
          <Text style={[Fonts.p4Bold, { color: Colors.neutral200, flex: 1 }]}>
            Score disponible au debut du match + 1 min.
          </Text>
        </View>
      ) : null}
      {canSubmitScore ? (
        <Button
          disabled={actionLoading}
          icon="edit"
          iconColor={Colors.neutral00}
          iconPosition="before"
          onPress={handleGoToScoreEntry}
          size="small"
          style={{
            backgroundColor: Colors.primary500,
            borderColor: Colors.primary500,
          }}
          textStyle={{ color: Colors.neutral00 }}
          title={scoreQuickActionMeta.title}
          variant="Primary"
        />
      ) : null}
    </View>
  );
  const isScoreToSubmitBadge = String(statusConfig.label || '').toLowerCase().includes('saisir');
  const scoreQuickActionMeta = useMemo(() => {
    const countdown = formatScoreFlowCountdown(scoreFlow.remainingSeconds);
    if (scoreFlow.state === 'opponent_score_pending') {
      return {
        helper: `La squad adverse a saisi un score. Confirmez ou contestez avant auto-validation dans ${countdown}.`,
        label: 'Score adverse',
        title: 'Valider le score adverse',
      };
    }

    if (scoreFlow.state === 'submitted_waiting_opponent' || scoreFlow.state === 'auto_validation_pending') {
      return {
        helper: `Votre score est enregistre. Sans reponse adverse, il sera valide automatiquement dans ${countdown}.`,
        label: 'Score saisi',
        title: 'Score saisi',
      };
    }

    if (matchPhase === 'pending_validation') {
      return {
        helper: `Un score attend une validation. Sans action, le score soumis sera traite a la deadline dans ${countdown}.`,
        label: 'Score a valider',
        title: 'Valider le score',
      };
    }

    if (matchPhase === 'disputed') {
      return {
        helper: 'Un litige score est ouvert. Ajoutez les elements utiles ou attendez la resolution SuperAdmin.',
        label: 'Litige score',
        title: 'Traiter le litige',
      };
    }

    return {
      helper: 'Le match est joué. Le score officiel doit être saisi pour lancer le bilan League.',
      label: 'Score à saisir',
      title: 'Saisir le score final',
    };
  }, [matchPhase, scoreFlow.remainingSeconds, scoreFlow.state]);
  const heroStatusMeta = useMemo(() => {
    if (isScoreActionPhase || isScoreToSubmitBadge) {
      return {
        accentColor: Colors.gold500,
        icon: Images.edit,
        label: isCaptain ? 'Action capitaine' : 'Action equipe',
        text: scoreQuickActionMeta.helper,
      };
    }

    if (normalizedStatus === 'scheduled' && venueRequired && !isVenueBooked) {
      return {
        accentColor: Colors.gold500,
        icon: Images.stadium,
        label: 'Organisation \u00E9quipe',
        text: "Le terrain doit encore être confirmé avant le coup d'envoi.",
      };
    }

    if (normalizedStatus === 'scheduled') {
      return {
        accentColor: Colors.primary500,
        icon: Images.clock,
        label: 'Avant match',
        text: 'Les confirmations de pr\u00E9sence restent ouvertes avant le d\u00E9but.',
      };
    }

    if (normalizedStatus === 'valid') {
      return {
        accentColor: Colors.success500,
        icon: Images.check,
        label: 'Résultat validé',
        text: 'Le match est verrouill\u00E9 avec son score officiel.',
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
    Images.check,
    Images.clock,
    Images.edit,
    Images.flag,
    Images.stadium,
    isScoreActionPhase,
    isScoreToSubmitBadge,
    isVenueBooked,
    normalizedStatus,
    isCaptain,
    scoreQuickActionMeta.helper,
    venueRequired,
  ]);
  const heroSupportText = useMemo(() => {
    if (hasOfficialScore && normalizedStatus === 'valid') {
      return 'Score officiel enregistré pour cette affiche League.';
    }
    if (isScoreActionPhase || isScoreToSubmitBadge) {
      return scoreQuickActionMeta.helper;
    }
    if (normalizedStatus === 'scheduled' && venueRequired && !isVenueBooked) {
      return "Le terrain doit encore être confirmé avant le coup d'envoi.";
    }
    if (normalizedStatus === 'scheduled') {
      return 'Les confirmations de pr\u00E9sence restent ouvertes avant le d\u00E9but.';
    }
    return heroStatusMeta.text;
  }, [
    hasOfficialScore,
    heroStatusMeta.text,
    isScoreActionPhase,
    isScoreToSubmitBadge,
    isVenueBooked,
    normalizedStatus,
    scoreQuickActionMeta.helper,
    venueRequired,
  ]);
  const captainQuickActionMeta = useMemo(() => {
    if (isPostSlotResolutionCurrentMatch) {
      return {
        accentColor: Colors.gold500,
        helper: 'Le creneau est depasse. Confirmez si le match a eu lieu.',
        label: 'Resolution a faire',
        title: 'Confirmation du match',
      };
    }

    if (canSubmitScore) {
      return {
        accentColor: Colors.primary500,
        helper: scoreQuickActionMeta.helper,
        label: scoreQuickActionMeta.label,
        title: 'Score officiel',
      };
    }

    if (isScoreLockedByTime) {
      return {
        accentColor: Colors.primary500,
        helper: "Le score se débloque automatiquement à l'heure de début du match + 1 minute.",
        label: 'Score bientôt disponible',
        title: 'Score verrouillé',
      };
    }

    return {
      accentColor: Colors.primary500,
      helper: venueRequired
        ? "Le terrain doit etre confirme avant le coup d'envoi pour garder le workflow League propre."
        : "Le match reste a confirmer par les equipes avant le coup d'envoi.",
      label: venueRequired ? 'Terrain a confirmer' : 'Match a confirmer',
      title: 'Organisation du match',
    };
  }, [
    Colors.gold500,
    Colors.primary500,
    canSubmitScore,
    isPostSlotResolutionCurrentMatch,
    isScoreLockedByTime,
    scoreQuickActionMeta.helper,
    scoreQuickActionMeta.label,
    venueRequired,
  ]);
  const captainPrimarySummaryText = useMemo(() => {
    if (isPostSlotResolutionCurrentMatch) {
      return 'Confirmez si le match a eu lieu.';
    }
    if (canManageVenue) {
      return 'Confirmez le terrain du match.';
    }
    if (canSubmitScore) {
      return 'Saisissez le score officiel.';
    }
    if (isScoreLockedByTime) {
      return 'Le score sera disponible au coup d envoi.';
    }
    return captainQuickActionMeta.helper;
  }, [
    canManageVenue,
    canSubmitScore,
    captainQuickActionMeta.helper,
    isPostSlotResolutionCurrentMatch,
    isScoreLockedByTime,
  ]);
  const actionDockMeta = useMemo(() => {
    if (hasBottomPresenceBar) {
      return {
        accentColor: hasConfirm\u00E9d ? Colors.success500 : Colors.primary500,
        helper: pr\u00E9senceCompactHelperText,
        label: `${participationCount}/${requiredPlayers}`,
        title: hasConfirm\u00E9d ? 'Présence confirmée' : 'Disponibilité',
      };
    }

    if (hasCaptainQuickActions) {
      return {
        accentColor: captainQuickActionMeta.accentColor,
        helper: captainQuickActionMeta.helper,
        label: captainQuickActionMeta.label,
        title: captainQuickActionMeta.title,
      };
    }

    return {
      accentColor: Colors.primary500,
      helper: '',
      label: '',
      title: 'Actions du match',
    };
  }, [
    Colors.primary500,
    Colors.success500,
    captainQuickActionMeta.accentColor,
    captainQuickActionMeta.helper,
    captainQuickActionMeta.label,
    captainQuickActionMeta.title,
    hasBottomPresenceBar,
    hasCaptainQuickActions,
    hasConfirm\u00E9d,
    participationCount,
    pr\u00E9senceCompactHelperText,
    requiredPlayers,
  ]);
  const captainSectionHelperText = useMemo(() => {
    if (shouldShowInlineCaptainActions) {
      return null;
    }
    if (venueRequired) {
      return 'Les actions rapides terrain, score et resolution restent visibles dans la barre du bas pour agir sans quitter la fiche.';
    }
    return 'Les actions rapides presence, score et resolution restent visibles dans la barre du bas pour agir sans quitter la fiche.';
  }, [shouldShowInlineCaptainActions, venueRequired]);
  const captainSectionTitle = useMemo(() => {
    if (canShowCaptainPrimary) return 'Action prioritaire';
    return isCaptain ? 'Zone Capitaine' : 'Organisation du match';
  }, [canShowCaptainPrimary, isCaptain]);
  const captainSectionLabel = useMemo(() => {
    if (canShowCaptainPrimary) return 'ACTION PRIORITAIRE';
    return isCaptain ? 'PRIORITE MATCH' : 'ACTION EQUIPE';
  }, [canShowCaptainPrimary, isCaptain]);
  const shouldRenderCaptainSectionHelper = Boolean(canShowCaptainPrimary && captainSectionHelperText);
  const shouldRenderInlineCaptainActions = Boolean(canShowCaptainPrimary && shouldShowInlineCaptainActions);
  const postSlotResolutionModalMeta = useMemo(() => {
    if (effectivePostSlotResolutionStep === 'confirm_reschedule') {
      return {
        helper: 'L adversaire indique que le match n a pas eu lieu et propose de replanifier ce meme match.',
        title: 'Confirmer la replanification ?',
      };
    }

    if (effectivePostSlotResolutionStep === 'confirm_cancel') {
      return {
        helper: 'L adversaire indique que le match n a pas eu lieu et propose d annuler ce match sans penalite.',
        title: 'Confirmer l annulation ?',
      };
    }

    if (effectivePostSlotResolutionStep === 'choose_not_played_action') {
      return {
        helper: 'Choisissez la suite a donner a ce match : replanifier avec le meme adversaire ou annuler sans penalite.',
        title: 'Le match n a pas eu lieu',
      };
    }

    return {
      helper: venueRequired
        ? 'Le creneau est depasse sans terrain confirme. Les capitaines doivent confirmer si le match a eu lieu.'
        : 'Le creneau est depasse. Les capitaines doivent confirmer si le match a eu lieu.',
      title: 'Le match a-t-il eu lieu ?',
    };
  }, [effectivePostSlotResolutionStep, venueRequired]);
  const leagueWorkflowSteps = useMemo(() => {
    const hasProposal = Boolean(negotiationState) || normalizedStatus === 'scheduled' || normalizedStatus === 'valid';
    const hasEnoughPlayers = participationCount >= requiredPlayers || normalizedStatus !== 'scheduled';
    const venueResolved = !venueRequired || isVenueBooked || normalizedStatus !== 'scheduled';
    const matchHasStarted = normalizedStatus !== 'scheduled' || hasOfficialScore || canSubmitScore;
    const scoreDone = hasOfficialScore && normalizedStatus === 'valid';
    let scoreState = 'todo';
    if (scoreDone) {
      scoreState = 'done';
    } else if (canSubmitScore) {
      scoreState = 'active';
    }

    return [
      {
        key: 'proposal',
        label: 'Proposition',
        state: hasProposal ? 'done' : 'todo',
      },
      {
        key: 'venue',
        label: venueRequired ? 'Terrain' : 'Confirme',
        state: venueResolved ? 'done' : 'active',
      },
      {
        key: 'presence',
        label: 'Présences',
        state: hasEnoughPlayers ? 'done' : 'active',
      },
      {
        key: 'match',
        label: 'Match',
        state: matchHasStarted ? 'done' : 'todo',
      },
      {
        key: 'score',
        label: 'Score',
        state: scoreState,
      },
    ];
  }, [
    canSubmitScore,
    hasOfficialScore,
    isVenueBooked,
    negotiationState,
    normalizedStatus,
    participationCount,
    requiredPlayers,
    venueRequired,
  ]);
  const detailTabOptions = useMemo(() => ([
    { label: 'Match', value: 'match' },
    { label: 'Equipe', value: 'team' },
    { label: 'Historique', value: 'history' },
  ]), []);
  const activeWorkflowStepLabel = useMemo(() => {
    const activeStep = leagueWorkflowSteps.find((step) => step.state === 'active');
    if (activeStep?.label) return activeStep.label;

    const nextStep = leagueWorkflowSteps.find((step) => step.state !== 'done');
    if (nextStep?.label) return nextStep.label;

    return 'Terminé';
  }, [leagueWorkflowSteps]);
  const heroSummaryChips = useMemo(() => {
    const chips = [
      {
        key: 'players',
        tone: 'primary',
        value: `${participationCount}/${requiredPlayers} joueurs`,
      },
      {
        key: 'workflow',
        tone: activeWorkflowStepLabel === 'Terminé' ? 'success' : 'neutral',
        value: activeWorkflowStepLabel,
      },
    ];

    if (hasNegotiationConversation) {
      chips.push({
        key: 'chat',
        tone: 'neutral',
        value: 'Chat actif',
      });
    }

    return chips;
  }, [activeWorkflowStepLabel, hasNegotiationConversation, participationCount, requiredPlayers]);
  const leagueStatsAction = useMemo(() => {
    if (normalizedStatus !== 'valid') {
      return {
        disabled: true,
        subtitle: 'Les stats seront disponibles une fois le score valid\u00E9.',
        title: 'Stats bient\u00F4t disponibles',
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
          ? `Rapport finalis\u00E9 le ${new Date(leagueStatsReport.finalizedAt).toLocaleString('fr-FR')}`
          : 'Rapport finalis\u00E9',
        title: 'Voir les stats du match',
      };
    }

    if (canManageLeagueStats) {
      return {
        disabled: false,
        subtitle: 'Note collective, retours capitaine et stats manquantes \u00E0 compl\u00E9ter pour ton \u00E9quipe.',
        title: 'Finaliser le bilan \u00E9quipe',
      };
    }

    return {
      disabled: true,
      subtitle: 'Le bilan \u00E9quipe est encore en cours de finalisation.',
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
      return 'Le rapport stats de ton \u00E9quipe est finalis\u00E9.';
    }

    if (normalizedStatus !== 'valid') {
      return 'Les stats seront disponibles une fois le score valid\u00E9.';
    }

    if (canManageLeagueStats) {
      return 'Complete le bilan collectif, les retours individuels et les stats manquantes maintenant que le score est valid\u00E9.';
    }

    return 'Le bilan \u00E9quipe est encore en cours de finalisation.';
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
        label: 'Score valid\u00E9 en attente',
        textColor: Colors.gold500,
      };
    }

    return {
      backgroundColor: `${Colors.primary500}20`,
      borderColor: `${Colors.primary500}45`,
      label: '\u00C0 finaliser',
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
          backgroundColor: `${Colors.primary500}14`,
          borderColor: `${Colors.primary500}32`,
          label: 'Non concerne',
          textColor: Colors.primary500,
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
  const invalidateLeagueQueries = useCallback(() => Promise.all([
    queryClient.invalidateQueries({ queryKey: getPendingLeagueActionQueryKey(undefined) }),
    myTeamId
      ? queryClient.invalidateQueries({ queryKey: getPendingLeagueActionQueryKey(myTeamId) })
      : Promise.resolve(),
    queryClient.invalidateQueries({ queryKey: ['leagueMatchStats', matchId] }),
    queryClient.invalidateQueries({ queryKey: ['leagueMyMatchResponse', matchId] }),
    queryClient.invalidateQueries({ queryKey: ['chat', getEntityDocumentId(match?.chat)] }),
    queryClient.invalidateQueries({ queryKey: ['chat-messages', getEntityDocumentId(match?.chat)] }),
    queryClient.invalidateQueries({ queryKey: ['league-match', matchId] }),
    queryClient.invalidateQueries({ queryKey: ['league-matches'] }),
  ]), [match?.chat, matchId, myTeamId, queryClient]);
  const handleGoToScoreEntry = useCallback(() => {
    if (isScoreLockedByTime) {
      Alert.alert(
        'Score indisponible',
        "Vous pourrez saisir le score une fois l'heure de d\u00E9but du match d\u00E9pass\u00E9e de 1 minute.",
      );
      return;
    }

    navigateToEndMatchScreen(navigation, matchId);
  }, [isScoreLockedByTime, matchId, navigation]);

  const handleConfirmParticipation = async () => {
    if (!teamSide) return;
    const legalAcceptance = await requestLeagueLegalAcceptance({
      metadata: {
        matchLabel: matchLegalLabel,
        teamName: myTeam?.name || null,
      },
      scope: LEAGUE_LEGAL_SCOPES.MATCH_PLAYER_PARTICIPATION,
      sourceScreen: 'league_match_details_participation',
      targetDocumentId: matchId,
      targetLabel: matchLegalLabel,
      targetType: 'league_match',
    });
    if (!legalAcceptance) return;

    setActionLoading(true);
    try {
      const result = await confirmParticipation(matchId, teamSide, { legalAcceptance });
      showBanner({
        body: result.message || 'Presence confirmee',
        title: 'Presence confirmee',
        tone: 'league',
      });
      await loadMatch({ forceFresh: true });
    } catch (error) {
      console.error(error);
      showBanner({
        body: 'Echec confirmation',
        title: 'Erreur',
        tone: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeclineParticipation = async () => {
    if (!teamSide) return;
    setActionLoading(true);
    try {
      await declineParticipation(matchId, teamSide);
      showBanner({
        body: 'Votre participation a ete annulee',
        title: 'Participation annulee',
        tone: 'league',
      });
      await loadMatch({ forceFresh: true });
    } catch (error) {
      console.error(error);
      showBanner({
        body: 'Echec annulation',
        title: 'Erreur',
        tone: 'error',
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkVenueBooked = async () => {
    setActionLoading(true);
    try {
      await markVenueBooked(matchId);
      await invalidateLeagueQueries();
      await refetchPendingLeagueAction();
      Alert.alert('Succes', 'Terrain marque comme reserve.');
      await loadMatch({ forceFresh: true });
    } catch (error) {
      console.error(error);
      Alert.alert('Erreur', 'Impossible de mettre a jour le statut');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenPostSlotResolution = useCallback(() => {
    setIsActionDockExpanded(false);
    setPostSlotResolutionStep(null);
    setIsPostSlotResolutionVisible(true);
  }, []);

  const handleClosePostSlotResolution = useCallback(() => {
    setPostSlotResolutionStep(null);
    setIsPostSlotResolutionVisible(false);
  }, []);

  const openPostSlotNoMatchChoices = useCallback(() => {
    setPostSlotResolutionStep('choose_not_played_action');
  }, []);

  const handleSubmitPostSlotResolution = useCallback(async (payload) => {
    if (!matchId || actionLoading) return;

    setActionLoading(true);
    try {
      const response = await submitPostSlotResponse(matchId, payload);
      await invalidateLeagueQueries();
      await refetchPendingLeagueAction();
      await loadMatch({ forceFresh: true });
      handleClosePostSlotResolution();

      const resolution = String(response?.resolution || response?.data?.resolution || '').trim().toLowerCase();
      if (resolution === 'score_flow') {
        const didNavigate = navigateToEndMatchScreen(navigation, matchId);
        if (!didNavigate) {
          handleGoToScoreEntry();
        }
        return;
      }

      if (resolution === 'rescheduled') {
        const chatId = getEntityDocumentId(match?.chat);
        if (chatId) {
          navigation.navigate(RouteNames.Conversation, { chatId });
        }
        return;
      }

      showBanner({
        body: 'Votre reponse a ete enregistree.',
        title: 'Resolution mise a jour',
        tone: 'league',
      });
    } catch (error) {
      console.error(error);
      const serverMessage = String(
        error?.response?.data?.error?.message
        || error?.response?.data?.message
        || error?.message
        || '',
      ).trim();
      Alert.alert('Erreur', serverMessage || "Impossible d'enregistrer cette réponse.");
    } finally {
      setActionLoading(false);
    }
  }, [
    actionLoading,
    handleGoToScoreEntry,
    handleClosePostSlotResolution,
    invalidateLeagueQueries,
    loadMatch,
    match?.chat,
    matchId,
    navigation,
    refetchPendingLeagueAction,
    showBanner,
  ]);

  const handleCancelMatch = () => {
    Alert.alert(
      'Annuler le match ?',
      'Action irreversible. \u00CAtes-vous s\u00FBr ?',
      [
        { style: 'cancel', text: 'Non' },
        {
          onPress: async () => {
            setActionLoading(true);
            try {
              const targetTeamId = getEntityDocumentId(myTeam);
              if (!targetTeamId) {
                Alert.alert('Erreur', '\u00C9quipe introuvable.');
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
        'La conversation avec l\'adversaire n est pas encore disponible. Reessayez dans quelques secondes.',
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

  const handleAcceptNegotiationProposal = useCallback(async () => {
    if (!matchId || actionLoading) return;
    try {
      if (!negotiationProposalMessageId) {
        throw new Error('Missing proposal message id');
      }
      const legalAcceptance = await requestLeagueLegalAcceptance({
        metadata: {
          matchLabel: matchLegalLabel,
          teamName: myTeam?.name || null,
        },
        scope: LEAGUE_LEGAL_SCOPES.MATCH_CAPTAIN_ACCEPTANCE,
        sourceScreen: 'league_match_details_accept_proposal',
        targetDocumentId: matchId,
        targetLabel: matchLegalLabel,
        targetType: 'league_match',
      });
      if (!legalAcceptance) return;

      setActionLoading(true);
      await respondToLeagueProposal(matchId, negotiationProposalMessageId, 'accept', { legalAcceptance });
      await invalidateLeagueQueries();
      await refetchPendingLeagueAction();
      await loadMatch({ forceFresh: true });
      navigation.navigate(RouteNames.LeagueMatchDetails, {
        focusSection: primaryFocusSection,
        matchId,
      });
    } catch (error) {
      if (isAlreadyResolvedError(error)) {
        await invalidateLeagueQueries();
        await refetchPendingLeagueAction();
        await loadMatch({ forceFresh: true });
        return;
      }
      Alert.alert('Erreur', 'Impossible d accepter la proposition pour le moment.');
    } finally {
      setActionLoading(false);
    }
  }, [
    actionLoading,
    invalidateLeagueQueries,
    loadMatch,
    matchLegalLabel,
    matchId,
    myTeam?.name,
    navigation,
    negotiationProposalMessageId,
    primaryFocusSection,
    refetchPendingLeagueAction,
    requestLeagueLegalAcceptance,
  ]);

  const handleDeclineNegotiationProposal = useCallback(async () => {
    if (!negotiationProposalMessageId || actionLoading) return;
    setActionLoading(true);
    try {
      await respondToLeagueProposal(matchId, negotiationProposalMessageId, 'decline');
      await invalidateLeagueQueries();
      await refetchPendingLeagueAction();
      await loadMatch({ forceFresh: true });
      setIsNegotiationModalVisible(true);
    } catch (error) {
      if (isAlreadyResolvedError(error)) {
        await invalidateLeagueQueries();
        await refetchPendingLeagueAction();
        await loadMatch({ forceFresh: true });
        return;
      }
      Alert.alert('Erreur', 'Impossible de refuser la proposition pour le moment.');
    } finally {
      setActionLoading(false);
    }
  }, [
    actionLoading,
    invalidateLeagueQueries,
    loadMatch,
    matchId,
    negotiationProposalMessageId,
    refetchPendingLeagueAction,
  ]);

  const handleOpenCounterProposal = useCallback(() => {
    setIsNegotiationModalVisible(true);
  }, []);
  const handleOpenNegotiationResponseSheet = useCallback(() => {
    if (!canReplyFromNegotiationCard) return;
    setIsNegotiationResponseSheetVisible(true);
  }, [canReplyFromNegotiationCard]);
  const handleAcceptNegotiationProposalFromSheet = useCallback(() => {
    setIsNegotiationResponseSheetVisible(false);
    handleAcceptNegotiationProposal();
  }, [handleAcceptNegotiationProposal]);
  const handleDeclineNegotiationProposalFromSheet = useCallback(() => {
    setIsNegotiationResponseSheetVisible(false);
    handleDeclineNegotiationProposal();
  }, [handleDeclineNegotiationProposal]);
  const handleCounterProposalFromSheet = useCallback(() => {
    setIsNegotiationResponseSheetVisible(false);
    handleOpenCounterProposal();
  }, [handleOpenCounterProposal]);

  const handleSendCounterProposal = useCallback(async (
    proposalData,
    /** @type {{ legalAcceptance?: Record<string, unknown> } | undefined} */ options = undefined,
  ) => {
    const chatId = getEntityDocumentId(match?.chat);
    if (!matchId || actionLoading) return;

    try {
      const proposalPayload = buildCanonicalLeagueProposalPayload(proposalData);
      if (venueRequired && !proposalPayload.venueLabel) {
        throw new Error('Missing proposal venue');
      }
      const legalAcceptance = options?.legalAcceptance || await requestLeagueLegalAcceptance({
        metadata: {
          matchLabel: matchLegalLabel,
          teamName: myTeam?.name || null,
          ...(proposalPayload.venueLabel ? { venueLabel: proposalPayload.venueLabel } : {}),
        },
        scope: LEAGUE_LEGAL_SCOPES.MATCH_CAPTAIN_PROPOSAL,
        sourceScreen: 'league_match_details_counter_proposal',
        targetDocumentId: matchId,
        targetLabel: matchLegalLabel,
        targetType: 'league_match',
      });
      if (!legalAcceptance) return;

      setActionLoading(true);
      const result = await createLeagueProposal(matchId, proposalPayload, { legalAcceptance });
      await invalidateLeagueQueries();
      await refetchPendingLeagueAction();
      await loadMatch({ forceFresh: true });
      setIsNegotiationModalVisible(false);
      const nextChatId = getEntityDocumentId(result?.match?.chat) || chatId;
      if (nextChatId) {
        navigation.navigate(RouteNames.Conversation, {
          chatId: nextChatId,
          focusLatestProposal: true,
          leagueNegotiationFocusToken: String(Date.now()),
          subTitle: 'Negociation du match en cours',
          title: isAnonymous
            ? `${myTeam?.name || 'Votre squad'} vs Adversaire`
            : `${match?.team_a?.name} vs ${match?.team_b?.name}`,
        });
      }
    } catch (error) {
      if (isAlreadyResolvedError(error)) {
        await invalidateLeagueQueries();
        await refetchPendingLeagueAction();
        await loadMatch({ forceFresh: true });
        setIsNegotiationModalVisible(false);
        return;
      }
      Alert.alert('Erreur', "Impossible d'envoyer la contre-proposition.");
    } finally {
      setActionLoading(false);
    }
  }, [
    actionLoading,
    invalidateLeagueQueries,
    isAnonymous,
    loadMatch,
    match?.chat,
    match?.team_a?.name,
    match?.team_b?.name,
    matchLegalLabel,
    matchId,
    myTeam?.name,
    navigation,
    refetchPendingLeagueAction,
    requestLeagueLegalAcceptance,
    venueRequired,
  ]);

  const handleOpenMatchStats = useCallback(() => {
    if (!myTeamId) return;

    navigation.navigate(RouteNames.MatchStatsEditor, {
      matchId,
      matchLabel: `${match?.team_a?.name || '\u00C9quipe A'} VS ${match?.team_b?.name || '\u00C9quipe B'}`,
      sourceType: 'league',
      sport: myTeam?.sport || match?.team_a?.sport || match?.team_b?.sport || 'football',
      teamId: myTeamId,
      teamName: myTeam?.name || null,
      title: 'Bilan \u00E9quipe',
    });
  }, [match?.team_a?.name, match?.team_a?.sport, match?.team_b?.name, match?.team_b?.sport, matchId, myTeam?.name, myTeam?.sport, myTeamId, navigation]);
  const handleOpenMyMatchResponse = useCallback(() => {
    if (!myTeamId) return;

    navigation.navigate(RouteNames.PlayerMatchResponse, {
      matchId,
      matchLabel: `${match?.team_a?.name || '\u00C9quipe A'} VS ${match?.team_b?.name || '\u00C9quipe B'}`,
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

  useFocusEffect(useCallback(() => () => {
    setIsMatchStatsPromptVisible(false);
  }, []));

  useEffect(() => {
    if (!canManageLeagueStats || normalizedStatus !== 'valid' || isLeagueStatsCompleted) {
      setIsMatchStatsPromptVisible(false);
      return;
    }

    if (
      leagueMatchStatsPayload
      && !isLeagueMatchStatsFetching
      && dismissedMatchStatsPromptKey !== matchStatsPromptSessionKey
      && !isMatchStatsPromptDismissedForSession(matchStatsPromptSessionKey)
    ) {
      setIsMatchStatsPromptVisible(true);
    }
  }, [
    canManageLeagueStats,
    dismissedMatchStatsPromptKey,
    isLeagueMatchStatsFetching,
    isLeagueStatsCompleted,
    leagueMatchStatsPayload,
    matchStatsPromptSessionKey,
    normalizedStatus,
  ]);
  useEffect(() => {
    setPostSlotResolutionStep(null);
    if (!isPostSlotResolutionCurrentMatch) {
      setIsPostSlotResolutionVisible(false);
    }
  }, [isPostSlotResolutionCurrentMatch, pendingLeagueAction?.key, pendingLeagueAction?.step]);

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

  if (loadError && !match) {
    return (
      <LeagueStateView
        actionLabel="Recharger"
        description={loadError}
        onAction={() => {
          setLoading(true);
          loadMatch({ forceFresh: true });
        }}
        title="Chargement impossible"
      />
    );
  }

  if (!match) {
    return (
      <LeagueStateView
        actionLabel="Retour aux matchs"
        description="Ce match n'existe plus ou n'est pas accessible depuis ce lien."
        onAction={() => navigation.navigate(RouteNames.LeagueMatchTab)}
        title="Match introuvable"
      />
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
          <Text style={[Fonts.h3, styles.headerTitle, { color: Colors.neutral00 }]}>Détails du match</Text>
          <View style={[styles.headerSide, styles.headerSideRight]}>
            {match.chat ? (
              <TouchableOpacity onPress={handleOpenChat} style={styles.chatButton}>
                <Image source={Images.envelope} style={{ height: 18, tintColor: Colors.primary500, width: 18 }} />
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
                loadMatch({ forceFresh: true });
              }}
              refreshing={refreshing}
              tintColor={Colors.primary500}
            />
          )}
        >
          <LeagueCard style={styles.heroCard}>
            {teamContextMeta ? (
              <View
                style={[
                  styles.heroContextPill,
                  {
                    alignSelf: 'center',
                    backgroundColor: teamContextMeta.backgroundColor,
                    borderColor: teamContextMeta.borderColor,
                    marginBottom: 16,
                  },
                ]}
              >
                <Text style={[Fonts.label, { color: teamContextMeta.textColor }]}>
                  {teamContextMeta.label}
                </Text>
              </View>
            ) : null}

            <View style={styles.heroMatchupRow}>
              <View style={styles.heroTeamBlock}>
                <TeamShield initials={String(match.team_a?.initials || match.team_a?.name || '?')} isGold size={68} />
                <Text numberOfLines={2} style={[Fonts.h4, styles.heroTeamName, { color: Colors.neutral00 }]}>
                  {match.team_a?.name || '\u00C9quipe A'}
                </Text>
              </View>

              <View
                style={[
                  styles.heroScorePanel,
                  {
                    backgroundColor: 'rgba(1, 179, 244, 0.09)',
                    borderColor: 'rgba(1, 179, 244, 0.18)',
                  },
                ]}
              >
                <Text style={[Fonts.p4Bold, { color: leagueCardTextColor, marginBottom: 8 }]}>
                  {hasOfficialScore ? 'SCORE' : 'MATCH'}
                </Text>
                {hasOfficialScore ? (
                  <Text style={[Fonts.h1, styles.heroScoreValue, { color: Colors.gold500 }]}>
                    {match.score_a}
                    {' '}
                    -
                    {' '}
                    {match.score_b}
                  </Text>
                ) : (
                  <Text style={[Fonts.h1, styles.heroVsValue, { color: Colors.primary500 }]}>VS</Text>
                )}
              </View>

              <View style={styles.heroTeamBlock}>
                {isAnonymous ? (
                  <>
                    <View style={styles.heroGhostShield}>
                      <Text style={[Fonts.h2, { color: Colors.primary500 }]}>?</Text>
                    </View>
                    <Text
                      numberOfLines={2}
                      style={[Fonts.h4, styles.heroTeamName, { color: Colors.neutral200, fontStyle: 'italic' }]}
                    >
                      Adversaire mystere
                    </Text>
                  </>
                ) : (
                  <>
                    <TeamShield initials={String(match.team_b?.initials || match.team_b?.name || '?')} isGold size={68} />
                    <Text numberOfLines={2} style={[Fonts.h4, styles.heroTeamName, { color: Colors.neutral00 }]}>
                      {match.team_b?.name || '\u00C9quipe B'}
                    </Text>
                  </>
                )}
              </View>
            </View>

            <View style={styles.heroMetaRow}>
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: isScoreToSubmitBadge ? 'rgba(255, 215, 0, 0.18)' : statusConfig.bg,
                    borderColor: isScoreToSubmitBadge ? 'rgba(255, 215, 0, 0.35)' : `${statusConfig.color}28`,
                    borderWidth: 1,
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
            </View>

            <Text style={[Fonts.p3, styles.heroSummaryText, { color: Colors.neutral200 }]}>
              {heroSupportText}
            </Text>
            <View style={styles.progressChipsRow}>
              {heroSummaryChips.map((chip) => {
                let chipTone = Colors.primary500;
                let chipBackgroundColor = 'rgba(1, 179, 244, 0.08)';
                let chipBorderColor = 'rgba(1, 179, 244, 0.24)';

                if (chip.tone === 'success') {
                  chipTone = Colors.success500;
                  chipBackgroundColor = 'rgba(34, 197, 94, 0.10)';
                  chipBorderColor = 'rgba(34, 197, 94, 0.28)';
                } else if (chip.tone === 'neutral') {
                  chipTone = Colors.neutral200;
                  chipBackgroundColor = 'rgba(255, 255, 255, 0.05)';
                  chipBorderColor = 'rgba(255, 255, 255, 0.12)';
                }

                return (
                  <View
                    key={chip.key}
                    style={[
                      styles.workflowStep,
                      {
                        backgroundColor: chipBackgroundColor,
                        borderColor: chipBorderColor,
                      },
                    ]}
                  >
                    <View style={[styles.workflowDot, { backgroundColor: chipTone }]} />
                    <Text style={[Fonts.p4Bold, { color: chipTone }]}>{chip.value}</Text>
                  </View>
                );
              })}
            </View>
          </LeagueCard>

          <View style={styles.detailsTabsWrap}>
            <SegmentedControl
              centerContent
              onChange={setSelectedContentTab}
              options={detailTabOptions}
              value={selectedContentTab}
            />
          </View>

          {selectedContentTab === 'match' && (canShowCaptainPrimary || canShowCaptainCancel) ? (
            <>
              {renderSectionHeader(captainSectionTitle, Colors.gold500)}
              <LeagueCard style={[styles.leagueCardSurface, isVenueBookingHighlighted ? { borderColor: Colors.gold500, borderWidth: 2 } : null]}>
                <View
                  style={[
                    styles.captainHeroCard,
                    {
                      backgroundColor: isVenueBookingHighlighted ? 'rgba(255, 215, 0, 0.10)' : leagueAccentSurface,
                      borderColor: isVenueBookingHighlighted ? 'rgba(255, 215, 0, 0.28)' : 'rgba(1, 179, 244, 0.22)',
                    },
                  ]}
                >
                  <Text style={[Fonts.p4Bold, { color: Colors.gold500, marginBottom: 4 }]}>
                    {captainSectionLabel}
                  </Text>
                  <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
                    {canShowCaptainPrimary ? captainPrimarySummaryText : captainQuickActionMeta.helper}
                  </Text>
                </View>
                {shouldRenderCaptainSectionHelper ? (
                  <Text style={[Fonts.p3, { color: leagueCardTextColor, marginBottom: 14 }]}>
                    {captainSectionHelperText}
                  </Text>
                ) : null}
                {shouldRenderInlineCaptainActions ? renderCaptainQuickActionButtons() : null}
                {canShowCaptainCancel ? (
                  <TouchableOpacity
                    disabled={actionLoading}
                    onPress={handleCancelMatch}
                    style={{ alignItems: 'center', paddingBottom: 6, paddingTop: canShowCaptainPrimary ? 12 : 6 }}
                  >
                    <Text style={[Fonts.p3Bold, { color: Colors.error500, textDecorationLine: 'underline' }]}>
                      Annuler le match
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </LeagueCard>
            </>
          ) : null}

          {selectedContentTab === 'match' && negotiationState ? (
            <>
              {renderSectionHeader('Negociation')}
              <LeagueCard
                style={[styles.leagueCardSurface, isNegotiationHighlighted ? { borderColor: Colors.primary500, borderWidth: 2 } : null]}
              >
                <View
                  style={[
                    styles.captainHeroCard,
                    {
                      backgroundColor: 'rgba(1, 179, 244, 0.08)',
                      borderColor: isNegotiationHighlighted ? 'rgba(1, 179, 244, 0.40)' : 'rgba(1, 179, 244, 0.22)',
                    },
                  ]}
                >
                  <Text style={[Fonts.p4Bold, { color: Colors.primary500, marginBottom: 4 }]}>
                    {negotiationMeta.title}
                  </Text>
                  <Text style={[Fonts.p2Bold, { color: Colors.neutral00, lineHeight: 24 }]}>
                    {negotiationMeta.helper}
                  </Text>
                </View>

                <View style={styles.infoStack}>
                  <View
                    style={[
                      styles.infoPill,
                      {
                        backgroundColor: 'rgba(1, 179, 244, 0.05)',
                        borderColor: 'rgba(1, 179, 244, 0.16)',
                      },
                    ]}
                  >
                    <View style={[styles.infoIconWrap, { backgroundColor: 'rgba(1, 179, 244, 0.14)' }]}>
                      <Image source={Images.calendar} style={{ height: 18, tintColor: Colors.primary500, width: 18 }} />
                    </View>
                    <View style={styles.infoTextWrap}>
                      <Text style={[Fonts.p4Bold, { color: Colors.primary500, marginBottom: 4 }]}>
                        Proposition recue
                      </Text>
                      <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>{negotiationMeta.formattedDate}</Text>
                      <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginTop: 8 }]}>
                        {negotiationProposalVenue}
                      </Text>
                      <Text style={[Fonts.p3, { color: leagueCardTextColor, marginTop: 6 }]}>
                        {negotiationMeta.origin}
                      </Text>
                    </View>
                  </View>
                </View>

                {!hasNegotiationConversation ? (
                  <View
                    style={[
                      styles.heroStatusSupportCard,
                      {
                        backgroundColor: 'rgba(1, 179, 244, 0.06)',
                        borderColor: 'rgba(1, 179, 244, 0.24)',
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
                          loadMatch({ forceFresh: true });
                        }}
                        title="Réessayer"
                        variant="SecondaryLight"
                      />
                    </View>
                  </View>
                ) : null}

                {renderNegotiationActions()}
              </LeagueCard>
            </>
          ) : null}

          {selectedContentTab === 'match' ? renderSectionHeader('Organisation') : null}
          {selectedContentTab === 'match' ? (
            <LeagueCard
              style={[styles.leagueCardSurface, {
                backgroundColor: leagueAccentSurfaceSoft,
                borderColor: 'rgba(1, 179, 244, 0.28)',
              }]}
            >
              <View style={styles.infoStack}>
                <View
                  style={[
                    styles.infoPill,
                    {
                      backgroundColor: 'rgba(255,255,255,0.04)',
                      borderColor: 'rgba(255,255,255,0.10)',
                    },
                  ]}
                >
                  <View style={[styles.infoIconWrap, { backgroundColor: 'rgba(1, 179, 244, 0.14)' }]}>
                    <Image source={Images.calendar} style={{ height: 18, tintColor: Colors.primary500, width: 18 }} />
                  </View>
                  <View style={styles.infoTextWrap}>
                    <Text style={[Fonts.p4Bold, { color: Colors.primary500, marginBottom: 4 }]}>Date et heure</Text>
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
                    <Image source={Images.pin} style={{ height: 18, tintColor: Colors.primary500, width: 18 }} />
                  </View>
                  <View style={styles.infoTextWrap}>
                    <Text style={[Fonts.p4Bold, { color: Colors.primary500, marginBottom: 4 }]}>Lieu</Text>
                    <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>{venueLabel}</Text>
                    {showAddressLine ? (
                      <Text style={[Fonts.p2, { color: Colors.neutral200, marginTop: 4 }]}>
                        {addressLabel}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>

              {eloPrediction ? (
                <>
                  <View style={[styles.separator, { backgroundColor: 'rgba(1, 179, 244, 0.16)' }]} />
                  <View style={styles.eloContainer}>
                    <Text style={[Fonts.label, { color: Colors.primary500, marginBottom: 8, textAlign: 'center' }]}>
                      ENJEUX DU MATCH (ELO matchmaking)
                    </Text>
                    <View style={styles.eloRow}>
                      <View
                        style={[
                          styles.eloTeam,
                          {
                            backgroundColor: 'rgba(255,255,255,0.04)',
                            borderColor: 'rgba(255,255,255,0.10)',
                          },
                        ]}
                      >
                        <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>{match.team_a?.name}</Text>
                        <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>
                          +
                          {eloPrediction.winA}
                          {' / '}
                          <Text style={{ color: Colors.neutral00 }}>{eloPrediction.lossA}</Text>
                        </Text>
                      </View>
                      <View style={[styles.verticalSep, { backgroundColor: 'rgba(1, 179, 244, 0.28)' }]} />
                      <View
                        style={[
                          styles.eloTeam,
                          {
                            backgroundColor: leagueAccentSurface,
                            borderColor: 'rgba(1, 179, 244, 0.16)',
                          },
                        ]}
                      >
                        <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>{isAnonymous ? '???' : match.team_b?.name}</Text>
                        <Text style={[Fonts.p1, { color: Colors.neutral00 }]}>
                          +
                          {eloPrediction.winB}
                          {' / '}
                          <Text style={{ color: Colors.neutral00 }}>{eloPrediction.lossB}</Text>
                        </Text>
                      </View>
                    </View>
                  </View>
                </>
              ) : null}
            </LeagueCard>
          ) : null}

          {selectedContentTab === 'team' && teamSide && normalizedStatus === 'valid' && canRespondMyLeagueStats ? (
            <>
              {renderSectionHeader('Mes stats')}
              <LeagueCard style={styles.leagueCardSurface}>
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
                      <Text style={[Fonts.h1, styles.responseLargeScore, { color: Colors.gold500 }]}>
                        {leagueMyMatchResponse?.selfRating ? `${leagueMyMatchResponse.selfRating}/10` : '\u00C0 compl\u00E9ter'}
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
                        backgroundColor: 'rgba(1, 179, 244, 0.08)',
                        borderRadius: 20,
                        padding: 16,
                      }}
                    >
                      <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
                        {`Le match de l \u00E9quipe : ${leagueMyMatchResponse.teamRating}/10`}
                      </Text>
                    </View>
                  ) : null}

                  {leagueMyMatchResponse?.selfComment ? (
                    <View
                      style={{
                        backgroundColor: 'rgba(1, 179, 244, 0.08)',
                        borderRadius: 20,
                        padding: 16,
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

          {selectedContentTab === 'team' && teamSide && normalizedStatus === 'valid' && canRespondMyLeagueStats ? (
            <>
              {renderSectionHeader('Mon retour capitaine', Colors.gold500)}
              <LeagueCard style={[styles.leagueCardSurface, isCoachFeedbackHighlighted ? { borderColor: Colors.gold500, borderWidth: 2 } : null]}>
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
                      <Text style={[Fonts.h1, styles.responseLargeScore, { color: Colors.gold500 }]}>
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
                        backgroundColor: 'rgba(1, 179, 244, 0.08)',
                        borderRadius: 20,
                        padding: 16,
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

          {selectedContentTab === 'match' && canViewLeagueStats ? (
            <>
              {renderSectionHeader('Stats du match')}
              <LeagueCard style={styles.leagueCardSurface}>
                <View style={{ gap: 12 }}>
                  <View style={[styles.infoRow, { alignItems: 'flex-start' }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[Fonts.label, { color: Colors.primary500, marginBottom: 6 }]}>SUIVI POST-MATCH</Text>
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
                            backgroundColor: 'rgba(1, 179, 244, 0.08)',
                            borderRadius: 16,
                            flex: 1,
                            gap: 4,
                            padding: 12,
                          }}
                        >
                          <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>Note capitaine</Text>
                          <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
                            {`${leagueStatsReport.collectiveRating}/10`}
                          </Text>
                        </View>
                      ) : null}
                      {leaguePlayerCollectiveRating?.average != null ? (
                        <View
                          style={{
                            backgroundColor: 'rgba(1, 179, 244, 0.08)',
                            borderRadius: 16,
                            flex: 1,
                            gap: 4,
                            padding: 12,
                          }}
                        >
                          <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>Ressenti joueurs</Text>
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
                        backgroundColor: 'rgba(1, 179, 244, 0.08)',
                        borderRadius: 20,
                        padding: 16,
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
                        backgroundColor: 'rgba(1, 179, 244, 0.08)',
                        borderRadius: 20,
                        gap: 6,
                        padding: 16,
                      }}
                    >
                      <Text style={[Fonts.p4Bold, { color: Colors.gold500 }]}>
                        {`${leagueStatsReport?.responseCompletionCount ?? leaguePlayerCollectiveRating?.count ?? 0}/${leagueStatsReport?.responseEligibleCount ?? leaguePlayerCollectiveRating?.eligibleCount ?? 0} joueurs ont répondu`}
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
                          backgroundColor: 'rgba(1, 179, 244, 0.08)',
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
                          backgroundColor: 'rgba(1, 179, 244, 0.08)',
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

          {selectedContentTab === 'team' ? renderSectionHeader(
            `Compositions (${match.participations_a?.length || 0} vs ${match.participations_b?.length || 0})`,
          ) : null}

          {selectedContentTab === 'team' ? (
            <LeagueCard style={styles.leagueCardSurface}>
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
          ) : null}

          {selectedContentTab === 'history' && leagueTimeline.length ? (
            <>
              {renderSectionHeader('Historique League')}
              <LeagueCard style={[styles.leagueCardSurface, isTimelineHighlighted ? { borderColor: Colors.warning500, borderWidth: 2 } : null]}>
                <Text style={[Fonts.p3, { color: leagueCardTextColor, marginBottom: 14 }]}>
                  {workflowViewModel.helper}
                </Text>
                <View style={{ gap: 12 }}>
                  {leagueTimeline.slice(0, 6).map((entry) => (
                    <View
                      key={entry?.key || `${entry?.type || 'event'}:${entry?.at || 'na'}`}
                      style={{
                        alignItems: 'flex-start',
                        borderBottomColor: 'rgba(1, 179, 244, 0.10)',
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        flexDirection: 'row',
                        gap: 10,
                        paddingBottom: 10,
                      }}
                    >
                      <View
                        style={{
                          backgroundColor: Colors.primary500,
                          borderRadius: 999,
                          height: 8,
                          marginTop: 7,
                          width: 8,
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>{entry?.title || 'Mise a jour League'}</Text>
                        <Text style={[Fonts.p4, { color: leagueCardTextColor, marginTop: 2 }]}>
                          {entry?.at ? new Date(entry.at).toLocaleString('fr-FR') : 'Horodatage indisponible'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </LeagueCard>
            </>
          ) : null}
          {selectedContentTab === 'history' && !leagueTimeline.length ? (
            <>
              {renderSectionHeader('Historique League')}
              <LeagueCard style={styles.leagueCardSurface}>
                <Text style={[Fonts.p2, { color: leagueCardTextColor }]}>
                  Les prochaines mises a jour League apparaitront ici des qu une action
                  sera enregistree sur ce match.
                </Text>
              </LeagueCard>
            </>
          ) : null}

        </ScrollView>

        {hasBottomActionBar && !isPostSlotResolutionVisible ? (
          <View pointerEvents="box-none" style={[styles.bottomBar, bottomBarFloatingStyle]}>
            <View pointerEvents="box-none" style={styles.bottomBarContent}>
              <TouchableOpacity
                activeOpacity={0.86}
                onPress={() => setIsActionDockExpanded((value) => !value)}
                style={styles.bottomDockHandle}
              >
                <View style={styles.bottomDockTitleRow}>
                  <View style={[styles.bottomCaptainDot, { backgroundColor: actionDockMeta.accentColor }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>{actionDockMeta.title}</Text>
                    {actionDockMeta.helper ? (
                      <Text numberOfLines={1} style={[Fonts.p4, { color: leagueCardTextColor, marginTop: 2 }]}>
                        {actionDockMeta.helper}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View style={styles.bottomDockRightRow}>
                  {actionDockMeta.label ? (
                    <View
                      style={[
                        styles.bottomCaptainPill,
                        {
                          backgroundColor: `${actionDockMeta.accentColor}16`,
                          borderColor: `${actionDockMeta.accentColor}2E`,
                        },
                      ]}
                    >
                      <Text style={[Fonts.p4Bold, { color: actionDockMeta.accentColor }]}>
                        {actionDockMeta.label}
                      </Text>
                    </View>
                  ) : null}
                  <Text style={[Fonts.p4Bold, { color: Colors.primary500 }]}>
                    {isActionDockExpanded ? 'Fermer' : 'Actions'}
                  </Text>
                </View>
              </TouchableOpacity>

              {!isActionDockExpanded && hasBottomPresenceBar && !hasConfirm\u00E9d ? (
                <View pointerEvents="box-none" style={styles.pr\u00E9senceActionsRow}>
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
                      flex: 0.92,
                    }}
                    textStyle={{ color: Colors.error500 }}
                    title="Absent"
                    variant="Secondary"
                  />
                  <Button
                    disabled={actionLoading || isRosterFull}
                    icon="check"
                    iconColor={isRosterFull ? Colors.neutral300 : Colors.neutral00}
                    iconPosition="before"
                    onPress={handleConfirmParticipation}
                    size="small"
                    style={{
                      backgroundColor: isRosterFull ? 'rgba(1, 179, 244, 0.10)' : Colors.primary500,
                      borderColor: isRosterFull ? 'rgba(1, 179, 244, 0.28)' : Colors.primary500,
                      flex: 1.08,
                    }}
                    textStyle={{ color: isRosterFull ? Colors.neutral300 : Colors.neutral00 }}
                    title={pr\u00E9sencePrimaryTitle}
                    variant="Primary"
                  />
                </View>
              ) : null}

              {isActionDockExpanded && hasBottomPresenceBar && hasConfirm\u00E9d ? (
                <View pointerEvents="box-none" style={styles.confirmedActionsRow}>
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
                      width: '100%',
                    }}
                    textStyle={{ color: Colors.error500 }}
                    title="Passer absent"
                    variant="Secondary"
                  />
                </View>
              ) : null}

              {isActionDockExpanded && hasBottomPresenceBar && !hasConfirm\u00E9d ? (
                <View pointerEvents="box-none" style={styles.pr\u00E9senceActionsRow}>
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
                      flex: 0.92,
                    }}
                    textStyle={{ color: Colors.error500 }}
                    title="Absent"
                    variant="Secondary"
                  />
                  <Button
                    disabled={actionLoading || isRosterFull}
                    icon="check"
                    iconColor={isRosterFull ? Colors.neutral300 : Colors.neutral00}
                    iconPosition="before"
                    onPress={handleConfirmParticipation}
                    size="small"
                    style={{
                      backgroundColor: isRosterFull ? 'rgba(1, 179, 244, 0.10)' : Colors.primary500,
                      borderColor: isRosterFull ? 'rgba(1, 179, 244, 0.28)' : Colors.primary500,
                      flex: 1.08,
                    }}
                    textStyle={{ color: isRosterFull ? Colors.neutral300 : Colors.neutral00 }}
                    title={pr\u00E9sencePrimaryTitle}
                    variant="Primary"
                  />
                </View>
              ) : null}
              {isActionDockExpanded && hasCaptainQuickActions ? (
                <View
                  pointerEvents="box-none"
                  style={[
                    styles.bottomCaptainCard,
                    {
                      backgroundColor: `${captainQuickActionMeta.accentColor}12`,
                      borderColor: `${captainQuickActionMeta.accentColor}38`,
                    },
                  ]}
                >
                  <View pointerEvents="none" style={styles.bottomCaptainHeaderRow}>
                    <View style={styles.bottomCaptainTitleRow}>
                      <View
                        style={[
                          styles.bottomCaptainDot,
                          { backgroundColor: captainQuickActionMeta.accentColor },
                        ]}
                      />
                      <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
                        {isCaptain ? 'Actions capitaine' : 'Actions equipe'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.bottomCaptainPill,
                        {
                          backgroundColor: `${captainQuickActionMeta.accentColor}16`,
                          borderColor: `${captainQuickActionMeta.accentColor}2E`,
                        },
                      ]}
                    >
                      <Text style={[Fonts.p4Bold, { color: captainQuickActionMeta.accentColor }]}>
                        {captainQuickActionMeta.label}
                      </Text>
                    </View>
                  </View>
                  <Text pointerEvents="none" style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>{captainQuickActionMeta.title}</Text>
                  <Text pointerEvents="none" style={[Fonts.p4, { color: leagueCardTextColor }]}>{captainQuickActionMeta.helper}</Text>
                  {renderCaptainQuickActionButtons()}
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        <BottomModal
          close={dismissMatchStatsPrompt}
          isVisible={isMatchStatsPromptVisible}
          snapPoints={['40%']}
        >
          <View style={{ gap: 16, paddingBottom: 12 }}>
            <View style={{ gap: 4 }}>
              <Text style={[Fonts.h3Bold, { color: Colors.neutral00 }]}>Stats de fin de match</Text>
              <Text style={[Fonts.p2, { color: leagueCardTextColor }]}>
                {isLeagueStatsReviewRequired
                  ? 'Le score officiel a change. Verifie les lignes puis republie ce rapport.'
                  : 'Le score est valid\u00E9. Tu peux maintenant compl\u00E9ter le temps de jeu et les stats cl\u00E9s de ton \u00E9quipe.'}
              </Text>
            </View>

            <LeagueCard style={styles.leagueCardSurface}>
              <Text style={[Fonts.p3, { color: leagueCardTextColor }]}>Équipe concernée</Text>
              <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginTop: 6 }]}>
                {myTeam?.name || 'Mon \u00E9quipe'}
              </Text>
              <Text style={[Fonts.p3, { color: Colors.gold500, marginTop: 6 }]}>
                {match?.team_a?.name || '\u00C9quipe A'}
                {' VS '}
                {match?.team_b?.name || '\u00C9quipe B'}
              </Text>
            </LeagueCard>

            <Button
              onPress={() => {
                dismissMatchStatsPrompt();
                handleOpenMatchStats();
              }}
              title={leagueStatsAction.title}
              variant="Primary"
            />
            <Button
              onPress={dismissMatchStatsPrompt}
              title="Plus tard"
              variant="Secondary"
            />
          </View>
        </BottomModal>
        <BottomModal
          close={() => setIsNegotiationResponseSheetVisible(false)}
          isVisible={isNegotiationResponseSheetVisible}
          snapPoints={['56%']}
        >
          <View style={{ gap: 16, paddingBottom: 12 }}>
            <View style={{ gap: 4 }}>
              <Text style={[Fonts.h3Bold, { color: Colors.neutral00 }]}>Repondre a la proposition</Text>
              <Text style={[Fonts.p2, { color: leagueCardTextColor }]}>
                Choisissez une seule action pour repondre a cette proposition de match.
              </Text>
            </View>

            <LeagueCard style={styles.leagueCardSurface}>
              <View style={{ gap: 12 }}>
                <View style={styles.infoRow}>
                  <Text style={[Fonts.p4Bold, { color: Colors.primary500, minWidth: 72 }]}>Date</Text>
                  <Text style={[Fonts.p2Bold, { color: Colors.neutral00, flex: 1 }]}>
                    {negotiationMeta.formattedDate}
                  </Text>
                </View>
                <View style={[styles.separator, { backgroundColor: 'rgba(255,255,255,0.08)', marginVertical: 0 }]} />
                <View style={styles.infoRow}>
                  <Text style={[Fonts.p4Bold, { color: Colors.primary500, minWidth: 72 }]}>Lieu</Text>
                  <Text style={[Fonts.p2Bold, { color: Colors.neutral00, flex: 1 }]}>
                    {negotiationProposalVenue}
                  </Text>
                </View>
              </View>
            </LeagueCard>

            <View style={styles.bottomCaptainButtonsStack}>
              <Button
                disabled={actionLoading}
                isLoading={actionLoading}
                onPress={handleAcceptNegotiationProposalFromSheet}
                title="Accepter"
                variant="Primary"
              />
              <Button
                disabled={actionLoading}
                onPress={handleDeclineNegotiationProposalFromSheet}
                title="Refuser"
                variant="Secondary"
              />
              <Button
                disabled={actionLoading}
                onPress={handleCounterProposalFromSheet}
                title="Contre-proposer"
                variant="SecondaryLight"
              />
              {hasNegotiationConversation ? (
                <TouchableOpacity
                  disabled={actionLoading}
                  onPress={() => {
                    setIsNegotiationResponseSheetVisible(false);
                    handleOpenChat();
                  }}
                  style={{ alignItems: 'center', paddingVertical: 4 }}
                >
                  <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
                    Voir la proposition dans le chat
                  </Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </BottomModal>
        <BottomModal
          close={handleClosePostSlotResolution}
          isVisible={isPostSlotResolutionVisible}
          snapPoints={['64%']}
        >
          <View style={{ gap: 16, paddingBottom: 12 }}>
            <View style={{ gap: 4 }}>
              <Text style={[Fonts.h3Bold, { color: Colors.neutral00 }]}>{postSlotResolutionModalMeta.title}</Text>
              <Text style={[Fonts.p2, { color: leagueCardTextColor }]}>{postSlotResolutionModalMeta.helper}</Text>
            </View>

            <LeagueCard style={styles.leagueCardSurface}>
              <Text style={[Fonts.p4Bold, { color: Colors.gold500, marginBottom: 8 }]}>Match concerne</Text>
              <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>
                {match?.team_a?.name || 'Equipe A'}
                {' VS '}
                {isAnonymous ? 'Adversaire' : match?.team_b?.name || 'Equipe B'}
              </Text>
              <Text style={[Fonts.p3, { color: Colors.gold500, marginTop: 8 }]}>{formattedDate}</Text>
              <Text style={[Fonts.p3, { color: Colors.gold500, marginTop: 4 }]}>{venueLabel}</Text>
            </LeagueCard>

            {renderPostSlotResolutionActions()}
          </View>
        </BottomModal>
        <VenueProposalModal
          durationMinutes={getMatchDurationMinutes(myTeam?.sport || match?.team_a?.sport || match?.team_b?.sport)}
          initialDate={proposalDefaults.date}
          initialEndTime={proposalDefaults.end}
          initialStartTime={proposalDefaults.start}
          isSubmitting={actionLoading}
          isVisible={isNegotiationModalVisible}
          legalAcceptanceConfig={{
            metadata: {
              matchLabel: matchLegalLabel,
              teamName: myTeam?.name || null,
            },
            scope: LEAGUE_LEGAL_SCOPES.MATCH_CAPTAIN_PROPOSAL,
            sourceScreen: 'league_match_details_counter_proposal',
            targetDocumentId: matchId,
            targetLabel: matchLegalLabel,
            targetType: 'league_match',
          }}
          onClose={() => setIsNegotiationModalVisible(false)}
          onSend={handleSendCounterProposal}
          onSkip={() => setIsNegotiationModalVisible(false)}
          venueRequired={venueRequired}
        />
        {leagueLegalAcceptanceModal}
      </SafeAreaView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    backgroundColor: 'rgba(3, 22, 33, 0.97)',
    borderTopColor: 'rgba(1, 179, 244, 0.34)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    bottom: 0,
    elevation: 12,
    left: 0,
    paddingBottom: 14,
    paddingHorizontal: 16,
    paddingTop: 10,
    position: 'absolute',
    right: 0,
    shadowColor: 'black',
    shadowOffset: { height: -8, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
  },
  bottomBarContent: {
    gap: 10,
    width: '100%',
  },
  bottomCaptainButtonsStack: {
    gap: 10,
    width: '100%',
  },
  bottomCaptainCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  bottomCaptainDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  bottomCaptainHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  bottomCaptainPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  bottomCaptainTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  bottomDockHandle: {
    alignItems: 'center',
    backgroundColor: 'rgba(1, 179, 244, 0.08)',
    borderColor: 'rgba(1, 179, 244, 0.22)',
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  bottomDockRightRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    marginLeft: 12,
  },
  bottomDockTitleRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 10,
  },
  bottomLockedInfo: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  captainHeroCard: {
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  chatButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(1, 179, 244, 0.08)',
    borderColor: 'rgba(1, 179, 244, 0.32)',
    borderRadius: 999,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  coachTag: {
    backgroundColor: 'rgba(1, 179, 244, 0.08)',
    borderColor: 'rgba(1, 179, 244, 0.25)',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  compoColumn: {
    borderRadius: 20,
    borderWidth: 1,
    flex: 1,
    minHeight: 140,
    padding: 18,
  },
  compoRow: {
    flexDirection: 'row',
  },
  confirmedActionsRow: {
    alignItems: 'stretch',
    width: '100%',
  },
  detailsTabsWrap: {
    marginBottom: 10,
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
  heroCard: {
    backgroundColor: 'rgba(7, 24, 36, 0.94)',
    borderColor: 'rgba(1, 179, 244, 0.28)',
    borderRadius: 22,
    borderWidth: 1,
    marginBottom: 18,
    marginTop: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  heroContextPill: {
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroGhostShield: {
    alignItems: 'center',
    backgroundColor: 'rgba(1, 179, 244, 0.08)',
    borderColor: 'rgba(1, 179, 244, 0.22)',
    borderRadius: 22,
    borderWidth: 1,
    height: 68,
    justifyContent: 'center',
    width: 68,
  },
  heroMatchupRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  heroMetaRow: {
    alignItems: 'center',
    marginTop: 12,
  },
  heroScorePanel: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 96,
    paddingHorizontal: 10,
    paddingVertical: 14,
    width: '32%',
  },
  heroScoreValue: {
    fontSize: 28,
    lineHeight: 32,
    textAlign: 'center',
  },
  heroStatusSupportCard: {
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 10,
    paddingHorizontal: 18,
    paddingVertical: 16,
    width: '100%',
  },
  heroSummaryText: {
    marginTop: 10,
    textAlign: 'center',
  },
  heroTeamBlock: {
    alignItems: 'center',
    width: '30%',
  },
  heroTeamName: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  heroVsValue: {
    fontSize: 24,
    lineHeight: 28,
    textAlign: 'center',
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
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  infoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: 8,
  },
  infoStack: {
    gap: 14,
  },
  infoTextWrap: {
    flex: 1,
    marginLeft: 12,
  },
  leagueCardGoldSurface: {
    backgroundColor: 'rgba(255, 215, 0, 0.06)',
    borderColor: 'rgba(255, 215, 0, 0.34)',
    borderRadius: 24,
    padding: 20,
  },
  leagueCardSurface: {
    backgroundColor: 'rgba(4, 28, 42, 0.96)',
    borderColor: 'rgba(1, 179, 244, 0.28)',
    borderRadius: 24,
    padding: 20,
  },
  playerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 8,
  },
  pr\u00E9senceActionsRow: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  pr\u00E9senceCountPill: {
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 56,
    paddingHorizontal: 10,
    paddingVertical: 4,
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
    marginTop: 14,
  },
  progressChipText: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 10,
    textAlign: 'center',
  },
  progressChipTodo: {
    backgroundColor: 'rgba(1, 179, 244, 0.06)',
    borderColor: 'rgba(1, 179, 244, 0.28)',
  },
  responseHeroCard: {
    alignItems: 'flex-start',
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 18,
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
  verticalSep: {
    height: 30,
    marginHorizontal: 16,
    width: 1,
  },
  workflowCard: {
    backgroundColor: 'rgba(4, 28, 42, 0.96)',
    borderColor: 'rgba(1, 179, 244, 0.28)',
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  workflowDot: {
    borderRadius: 999,
    height: 8,
    width: 8,
  },
  workflowHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  workflowStep: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  workflowStepsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
});

export default LeagueMatchDetails;
