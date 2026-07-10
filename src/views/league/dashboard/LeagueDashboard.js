import { useFocusEffect, useIsFocused, useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Image, RefreshControl, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import LeagueCard from '@/components/atoms/league/LeagueCard';
import SectionHeader from '@/components/atoms/SectionHeader/SectionHeader';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import LeagueHeaderSwitch from '@/components/molecules/header/LeagueHeaderSwitch';
import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import CompetitiveHero from '@/components/organisms/league/CompetitiveHero';
import MatchHistory from '@/components/organisms/league/MatchHistory';
import ScreenContainer from '@/components/templates/ScreenContainer';
import LeagueStateView from '@/views/league/components/LeagueStateView';
import { navigateToEndMatchScreen } from '@/views/league/match/utils/leagueNavigation';
import { getMatchDerivedPhase, shouldMaskOpponentIdentity } from '@/views/league/match/utils/matchStatus';

import { RouteNames } from '@/navigation/routeNames';
import useBottomDockLayout from '@/navigation/useBottomDockLayout';

import { usePendingLeagueAction } from '@/services/league/leagueActionQueries';
import { getMatch, getMatchHistory } from '@/services/league/leagueMatchService';
import { loadLeagueTeamContextWithCache } from '@/services/leagueTeam/leagueTeamQueries';
import {
  getRanking,
} from '@/services/leagueTeam/leagueTeamService';

import { areSameEntityId, getEntityDocumentId } from '@/utils/entityId';
import { getImageUrl } from '@/utils/imageUrl';
import { isLeagueCaptain } from '@/utils/league/captains';
import {
  clampLeagueDivision,
  getDivisionProgressState,
  getDivisionPromotionTargetPoints,
  getNextStreakBonus,
} from '@/utils/league/division';

/**
 * @typedef {{ rank: number, name: string, points: number, form: string, isMe: boolean }} LeaderboardEntry
 */
/**
 * @typedef {{ type: 'separator' }} LeaderboardSeparator
 */
/**
 * @typedef {LeaderboardEntry | LeaderboardSeparator} LeaderboardRow
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
const normalizeFormResult = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (['v', 'victoire', 'w', 'win', 'won'].includes(normalized)) return 'V';
  if (['d', 'draw', 'n', 'nul'].includes(normalized)) return 'N';
  if (['defaite', 'defeat', 'l', 'lose', 'loss'].includes(normalized)) return 'D';
  return '-';
};

/**
 * @param {any} team
 * @returns {string}
 */
const computeTeamForm = (team) => {
  let rawSeries = [];
  if (Array.isArray(team?.recentResults)) {
    rawSeries = team.recentResults;
  } else if (Array.isArray(team?.form)) {
    rawSeries = team.form;
  }

  if (!rawSeries.length) {
    return '---';
  }

  return rawSeries.slice(0, 3).map(normalizeFormResult).join('');
};

/** @param {any} team @returns {number} */
const getTeamDivisionPoints = (team) => Number(team?.division_points ?? team?.divisionPoints ?? 0);
/** @param {any} team @returns {number} */
const getTeamSeasonPoints = (team) => Number(team?.season_points ?? team?.seasonPoints ?? 0);
/** @param {any} team @returns {number} */
const getTeamHighestStreak = (team) => Number(team?.highest_streak ?? team?.highestStreak ?? 0);

/**
 * @param {unknown} streak
 * @returns {string}
 */
const formatPositiveStreak = (streak) => {
  const value = Number(streak || 0);
  if (!Number.isFinite(value) || value <= 0) return 'Stable';
  return `x${value}`;
};

/**
 * @param {unknown} value
 * @returns {string}
 */
const formatLeagueDashboardDate = (value) => {
  if (!value) return 'Date \u00E0 d\u00E9finir';
  try {
    return new Date(value).toLocaleString('fr-FR', {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: 'short',
    });
  } catch (_error) {
    return 'Date \u00E0 d\u00E9finir';
  }
};

/**
 * Resolve Strapi media URL from the common nested media shapes.
 * @param {unknown} media
 * @returns {string | undefined}
 */
const resolveMediaUrl = (media) => {
  if (!media) return undefined;
  if (typeof media === 'string') return media;
  if (typeof media !== 'object') return undefined;

  const source = /** @type {Record<string, any>} */ (media);
  const direct = [source.url, source.uri, source.path].find(
    (value) => typeof value === 'string' && value.length > 0,
  );
  if (direct) return direct;

  const attributes = source.attributes && typeof source.attributes === 'object'
    ? /** @type {Record<string, any>} */ (source.attributes)
    : null;
  return attributes
    ? [attributes.url, attributes.uri, attributes.path].find(
      (value) => typeof value === 'string' && value.length > 0,
    )
    : undefined;
};

/**
 * @param {Team | null | undefined} squad
 * @returns {string | undefined}
 */
const getSquadLogoUri = (squad) => {
  const media = squad?.crest || squad?.logo || squad?.club?.logo;
  return getImageUrl(resolveMediaUrl(media));
};

/**
 * @param {string | undefined | null} squadName
 * @returns {string}
 */
const getSquadShieldInitials = (squadName) => String(squadName || 'SQ')
  .trim()
  .slice(0, 2)
  .toUpperCase();

const LEAGUE_ACTION_META = {
  confirmed_upcoming: {
    accent: 'success',
    actionLabel: 'Voir le match',
    helper: 'Le match est confirm\u00E9. Retrouvez les informations de preparation dans votre espace Match.',
    title: 'Match confirm\u00E9',
  },
  disputed: {
    accent: 'warning',
    actionLabel: 'Traiter le litige',
    helper: 'Un litige est ouvert sur le score. Ouvrez le match pour le traiter.',
    title: 'Litige score',
  },
  idle: {
    accent: 'neutral',
    actionLabel: 'Trouver un match',
    helper: 'Lancez une recherche pour trouver un adversaire compatible avec les cr\u00E9neaux de votre squad.',
    title: 'Aucun match actif',
  },
  opponent_found: {
    accent: 'primary',
    actionLabel: 'Envoyer une proposition',
    helper: 'Un adversaire a ete trouve. Il reste a vous accorder sur la proposition de match.',
    title: 'Adversaire trouve',
  },
  pending_validation: {
    accent: 'warning',
    actionLabel: 'Valider le score',
    helper: 'Un score attend une validation. Confirmez ou contestez le resultat.',
    title: 'Score a valider',
  },
  post_slot_resolution: {
    accent: 'warning',
    actionLabel: 'Le match a-t-il eu lieu ?',
    helper: 'Le creneau est depasse sans terrain confirme. Le capitaine doit dire si le match a eu lieu.',
    title: 'Confirmation match',
  },
  proposal_received: {
    accent: 'warning',
    actionLabel: 'R\u00E9pondre',
    helper: 'Une proposition adverse attend votre r\u00E9ponse. Ouvrez la conversation pour accepter, refuser ou contre-proposer.',
    title: 'Nouvelle proposition re\u00E7ue',
  },
  proposal_sent_waiting: {
    accent: 'gold',
    actionLabel: 'Voir la proposition',
    helper: "Votre proposition a \u00E9t\u00E9 envoy\u00E9e. Continuez l'echange dans la conversation avec l'adversaire.",
    title: 'Proposition envoy\u00E9e',
  },
  searching: {
    accent: 'gold',
    actionLabel: 'Ouvrir le centre de match',
    helper: 'La recherche est en cours. Les meilleures correspondances continuent a etre analysees.',
    title: 'Recherche en cours',
  },
  valid: {
    accent: 'success',
    actionLabel: 'Voir le résultat',
    helper: 'Le score est valide. Consultez le recapitulatif du match.',
    title: 'Résultat validé',
  },
  waiting_score: {
    accent: 'gold',
    actionLabel: 'Saisir le score',
    helper: 'Le match est joue. Saisissez le score final pour lancer la validation League.',
    title: 'Score a saisir',
  },
  waiting_venue: {
    accent: 'warning',
    actionLabel: 'Marquer terrain reserve',
    helper: "Le match est confirm\u00E9, mais le terrain n'est pas encore r\u00E9serv\u00E9. Finalisez l'organisation d\u00E8s que possible.",
    title: 'Terrain \u00E0 r\u00E9server',
  },
};

LEAGUE_ACTION_META.confirm\u00E9d_upcoming = LEAGUE_ACTION_META.confirmed_upcoming;

const SCORE_ACTION_STATES = new Set(['disputed', 'pending_validation', 'waiting_score']);

const resolveLeagueActionMatchId = (leagueActionState) => (
  leagueActionState?.matchId
  || leagueActionState?.match?.documentId
  || leagueActionState?.match?.id
  || ''
);

const resolveLeagueActionStateKey = (leagueActionState) => {
  const directState = String(
    leagueActionState?.state
    || leagueActionState?.phase
    || leagueActionState?.match?.phase
    || '',
  ).trim();

  if (LEAGUE_ACTION_META[directState]) return directState;

  const derivedPhase = leagueActionState?.match
    ? getMatchDerivedPhase(leagueActionState.match, leagueActionState.match?.event)
    : '';

  if (LEAGUE_ACTION_META[derivedPhase]) return derivedPhase;
  return directState || 'idle';
};

const DASHBOARD_FOCUS_REFRESH_MIN_INTERVAL_MS = 120000;

/**
 *
 */
function LeagueDashboard() {
  const {
    Alignments, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const queryClient = useQueryClient();
  const { userData } = /** @type {{ userData: User | null }} */ (useAuth());
  const navigation = /** @type {any} */ (useNavigation());
  const isFocused = useIsFocused();
  const { sceneBottomInset } = useBottomDockLayout();
  const scrollBottomPadding = Math.max(sceneBottomInset, 100);

  const [userTeam, setUserTeam] = useState(/** @type {Team | null} */ (null));
  const [allSquads, setAllSquads] = useState(/** @type {Team[]} */ ([]));
  const [activeSquadId, setActiveSquadId] = useState('');
  const [matchHistory, setMatchHistory] = useState(/** @type {MatchHistoryEntry[]} */ ([]));
  const [rankingData, setRankingData] = useState(/** @type {Team[]} */ ([]));
  const [invitedSquads, setInvitedSquads] = useState(/** @type {Team[]} */ ([]));
  const [pendingSquads, setPendingSquads] = useState(/** @type {Team[]} */ ([]));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isSquadSelectorVisible, setIsSquadSelectorVisible] = useState(false);
  const [conversationFallbackState, setConversationFallbackState] = useState(/** @type {any | null} */ (null));
  const lastDashboardFocusLoadAtRef = useRef(0);
  const pendingLeagueActionTeamId = activeSquadId || getEntityDocumentId(userTeam) || undefined;
  const {
    data: pendingLeagueActionPayload,
  } = usePendingLeagueAction(pendingLeagueActionTeamId, {
    enabled: isFocused && Boolean(pendingLeagueActionTeamId),
    refetchOnMount: false,
  });
  const leagueActionState = pendingLeagueActionPayload?.nextAction || null;
  const leagueSurface = {
    backgroundColor: 'rgba(10, 28, 43, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.22)',
  };

  const hydrateSquadDashboard = useCallback(async (/** @type {Team | null} */ team) => {
    setUserTeam(team);
    setMatchHistory([]);
    setRankingData([]);

    if (!team) return;

    const teamId = getEntityDocumentId(team);
    try {
      const [history, rankings] = await Promise.all([
        teamId ? getMatchHistory(teamId, 5) : Promise.resolve([]),
        getRanking(clampLeagueDivision(team?.division)),
      ]);
      setMatchHistory(Array.isArray(history) ? history : []);
      setRankingData(Array.isArray(rankings) ? rankings : []);
    } catch (historyErr) {
      console.log('Data fetch error:', historyErr);
      setMatchHistory([]);
      setRankingData([]);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!userData) return;
    setLoading(true);
    setLoadError('');
    try {
      const userId = getEntityDocumentId(userData);
      const context = await loadLeagueTeamContextWithCache(queryClient, userId);
      const squads = Array.isArray(context?.squads) ? context.squads : [];
      setAllSquads(squads);
      setInvitedSquads(Array.isArray(context?.invitedSquads) ? context.invitedSquads : []);
      setPendingSquads(Array.isArray(context?.pendingSquads) ? context.pendingSquads : []);

      const selectedSquad = activeSquadId
        ? squads.find((squad) => areSameEntityId(getEntityDocumentId(squad), activeSquadId))
        : null;
      const defaultSquad = context?.defaultSquadId
        ? squads.find((squad) => areSameEntityId(getEntityDocumentId(squad), context.defaultSquadId))
        : null;
      const team = selectedSquad || defaultSquad || squads[0] || null;
      const teamId = getEntityDocumentId(team);
      if (teamId && !activeSquadId) {
        setActiveSquadId(teamId);
      }

      await hydrateSquadDashboard(team);
    } catch (error) {
      console.error('Dashboard Load Error:', error);
      setAllSquads([]);
      setInvitedSquads([]);
      setPendingSquads([]);
      setUserTeam(null);
      setMatchHistory([]);
      setRankingData([]);
      setLoadError('Impossible de charger le dashboard League pour le moment.');
    } finally {
      setLoading(false);
    }
  }, [activeSquadId, hydrateSquadDashboard, queryClient, userData]);

  useFocusEffect(
    useCallback(() => {
      const hasWarmDashboardState = Boolean(
        userTeam
        || allSquads.length > 0
        || invitedSquads.length > 0
        || pendingSquads.length > 0
        || matchHistory.length > 0
        || rankingData.length > 0
        || loadError,
      );
      const now = Date.now();
      if (
        hasWarmDashboardState
        && now - lastDashboardFocusLoadAtRef.current < DASHBOARD_FOCUS_REFRESH_MIN_INTERVAL_MS
      ) {
        return undefined;
      }
      lastDashboardFocusLoadAtRef.current = now;
      loadDashboard();
      return undefined;
    }, [
      allSquads.length,
      invitedSquads.length,
      loadDashboard,
      loadError,
      matchHistory.length,
      pendingSquads.length,
      rankingData.length,
      userTeam,
    ]),
  );

  const handleSquadSwitch = useCallback(async (/** @type {Team} */ squad) => {
    setIsSquadSelectorVisible(false);
    const squadId = getEntityDocumentId(squad);
    if (!squadId || areSameEntityId(squadId, getEntityDocumentId(userTeam))) return;

    setActiveSquadId(squadId);
    setLoading(true);
    setLoadError('');
    try {
      await hydrateSquadDashboard(squad);
      navigation.navigate(RouteNames.LeagueMatchTab, {
        activeSquadId: squadId,
        squadSwitchToken: String(Date.now()),
      });
    } finally {
      setLoading(false);
    }
  }, [hydrateSquadDashboard, navigation, userTeam]);

  const isCaptainOnDashboard = isLeagueCaptain(userTeam, userData);
  const dashboardPendingRequestsCount = Array.isArray(userTeam?.join_requests)
    ? userTeam.join_requests.length
    : 0;

  const handleMatchPress = (/** @type {MatchHistoryEntry} */ match) => {
    navigation.navigate(RouteNames.PastMatchDetails, {
      matchId: getEntityDocumentId(match),
      myTeamId: getEntityDocumentId(userTeam),
    });
  };

  const handleOpenSquadStatistics = useCallback(() => {
    const squadId = getEntityDocumentId(userTeam);
    if (!squadId) return;

    navigation.navigate(RouteNames.SquadDetails, {
      focusSection: 'statistics',
      teamId: squadId,
    });
  }, [navigation, userTeam]);

  const openLeagueConversation = useCallback(async (options = {}) => {
    let chatId = options?.chatId || leagueActionState?.chatId || '';
    const matchId = options?.matchId || leagueActionState?.matchId || leagueActionState?.match?.documentId || '';
    const shouldHideOpponentName = shouldMaskOpponentIdentity(leagueActionState?.match || null);
    const opponentName = shouldHideOpponentName
      ? 'Adversaire'
      : options?.opponentName || leagueActionState?.opponent?.name || leagueActionState?.opponentDetails?.name || 'Adversaire';

    if (!chatId && matchId) {
      try {
        const latestMatch = await getMatch(matchId);
        chatId = latestMatch?.chat?.documentId || latestMatch?.chat?.id || '';
      } catch (_error) {
        chatId = '';
      }
    }

    if (!chatId) {
      setConversationFallbackState({
        matchId,
        opponentName,
        proposalMessageId: options?.proposalMessageId || leagueActionState?.proposalMessageId || '',
      });
      return;
    }

    navigation.navigate(RouteNames.Conversation, {
      chatId,
      focusLatestProposal: true,
      focusProposalMessageId: options?.proposalMessageId || leagueActionState?.proposalMessageId || undefined,
      leagueNegotiationFocusToken: String(Date.now()),
      subTitle: 'Negociation du match en cours',
      title: `${userTeam?.name || 'Votre squad'} vs ${opponentName}`,
    });
  }, [leagueActionState, navigation, userTeam?.name]);

  const openLeagueProposalComposer = useCallback((matchId) => {
    navigation.navigate(RouteNames.LeagueMatchTab, {
      matchId: matchId || undefined,
      openLeagueProposal: true,
      openLeagueProposalToken: String(Date.now()),
    });
  }, [navigation]);

  const openLeagueMatchDetails = useCallback((matchId, focusSection = undefined) => {
    if (!matchId) {
      navigation.navigate(RouteNames.LeagueMatchTab);
      return;
    }
    navigation.navigate(RouteNames.LeagueMatchDetails, {
      ...(focusSection ? { focusSection } : {}),
      matchId,
    });
  }, [navigation]);

  const handlePrimaryLeagueAction = useCallback(() => {
    const state = resolveLeagueActionStateKey(leagueActionState);
    const matchId = resolveLeagueActionMatchId(leagueActionState);

    if (state === 'searching') {
      navigation.navigate(RouteNames.LeagueMatchTab);
      return;
    }

    if (SCORE_ACTION_STATES.has(state)) {
      if (!navigateToEndMatchScreen(navigation, matchId)) {
        openLeagueMatchDetails(matchId);
      }
      return;
    }

    if (state === 'post_slot_resolution') {
      openLeagueMatchDetails(matchId, 'timeline');
      return;
    }

    if (state === 'valid') {
      openLeagueMatchDetails(matchId);
      return;
    }

    if (state === 'waiting_venue') {
      openLeagueMatchDetails(matchId, 'venueBooking');
      return;
    }

    if (state === 'opponent_found') {
      openLeagueProposalComposer(matchId);
      return;
    }

    if (state === 'proposal_received') {
      openLeagueMatchDetails(matchId, 'negotiation');
      return;
    }

    if (state === 'proposal_sent_waiting') {
      openLeagueMatchDetails(matchId, 'negotiation');
      return;
    }

    if (['confirmed_upcoming', 'confirm\u00E9d_upcoming'].includes(state)) {
      openLeagueMatchDetails(matchId);
      return;
    }

    navigation.navigate(RouteNames.LeagueMatchTab);
  }, [leagueActionState, navigation, openLeagueMatchDetails, openLeagueProposalComposer]);

  const handleSecondaryLeagueAction = useCallback(() => {
    const state = resolveLeagueActionStateKey(leagueActionState);
    const matchId = resolveLeagueActionMatchId(leagueActionState);

    if (state === 'proposal_received') {
      openLeagueConversation({
        chatId: leagueActionState?.chatId,
        matchId,
        proposalMessageId: leagueActionState?.proposalMessageId,
      });
      return;
    }

    if (state === 'proposal_sent_waiting') {
      openLeagueConversation({
        chatId: leagueActionState?.chatId,
        matchId,
        proposalMessageId: leagueActionState?.proposalMessageId,
      });
      return;
    }

    if (state === 'opponent_found') {
      openLeagueMatchDetails(matchId);
      return;
    }

    if ([
      'disputed',
      'pending_validation',
      'post_slot_resolution',
      'valid',
      'waiting_score',
      'waiting_venue',
    ].includes(state)) {
      openLeagueMatchDetails(matchId);
    }
  }, [leagueActionState, openLeagueConversation, openLeagueMatchDetails]);

  const leagueActionMeta = useMemo(() => {
    const state = resolveLeagueActionStateKey(leagueActionState);
    return LEAGUE_ACTION_META[state] || LEAGUE_ACTION_META.idle;
  }, [leagueActionState]);

  // --- Components ---

  const renderHeader = () => (
    <View style={[Alignments.row, Alignments.alignStart, Alignments.justifySpaceBetween, Spaces.marginBottom[24]]}>
      <LeagueHeaderSwitch />
      <View style={{ alignItems: 'center', flexDirection: 'row', paddingTop: 4 }}>
        <NotificationBadge />
        <ProfileButton />
      </View>
    </View>
  );

  const renderSquadSwitcherBar = () => {
    if (!userTeam) return null;

    const squadLogoUri = getSquadLogoUri(userTeam);
    const canSwitchSquad = allSquads.length > 1;

    return (
      <LeagueCard
        style={{
          ...leagueSurface,
          marginBottom: 16,
          paddingHorizontal: 14,
          paddingVertical: 14,
        }}
      >
        <View style={{ alignItems: 'center', flexDirection: 'row', width: '100%' }}>
          <View
            style={{
              alignItems: 'center',
              backgroundColor: 'rgba(0, 18, 24, 0.74)',
              borderColor: squadLogoUri ? 'rgba(1, 179, 244, 0.48)' : 'rgba(255, 215, 0, 0.55)',
              borderRadius: 26,
              borderWidth: 1,
              height: 52,
              justifyContent: 'center',
              marginRight: 12,
              overflow: 'hidden',
              width: 52,
            }}
          >
            {squadLogoUri ? (
              <Image
                resizeMode="cover"
                source={{ uri: squadLogoUri }}
                style={{ height: 48, width: 48 }}
              />
            ) : (
              <TeamShield
                initials={getSquadShieldInitials(userTeam?.name)}
                isGold
                size={44}
              />
            )}
          </View>

          <View style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
            <Text style={[Fonts.p4Bold, { color: Colors.gold500, marginBottom: 4, textTransform: 'uppercase' }]}>
              Vue squad active
            </Text>
            <Text numberOfLines={1} style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
              {userTeam?.name || 'Votre squad'}
            </Text>
            <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300, marginTop: 3 }]}>
              {userTeam?.sport || 'Sport'}
              {' - Div '}
              <Text style={{ color: Colors.gold500 }}>{clampLeagueDivision(userTeam?.division)}</Text>
            </Text>
          </View>

          <TouchableOpacity
            accessibilityHint="Ouvre la liste des squads League"
            accessibilityLabel="Changer de squad"
            accessibilityRole="button"
            activeOpacity={canSwitchSquad ? 0.8 : 1}
            disabled={!canSwitchSquad}
            onPress={() => setIsSquadSelectorVisible(true)}
            style={{
              alignItems: 'center',
              backgroundColor: canSwitchSquad ? 'rgba(1, 179, 244, 0.14)' : 'rgba(255,255,255,0.04)',
              borderColor: canSwitchSquad ? 'rgba(1, 179, 244, 0.58)' : 'rgba(255,255,255,0.08)',
              borderRadius: 999,
              borderWidth: 1,
              flexDirection: 'row',
              minHeight: 34,
              opacity: canSwitchSquad ? 1 : 0.72,
              paddingHorizontal: 12,
              paddingVertical: 7,
            }}
          >
            <Text style={[Fonts.p3Bold, { color: canSwitchSquad ? Colors.primary500 : Colors.neutral300, marginRight: canSwitchSquad ? 6 : 0 }]}>
              {canSwitchSquad ? 'Changer' : 'Unique'}
            </Text>
            {canSwitchSquad ? (
              <Image
                source={Images.chevronDown}
                style={{ height: 12, tintColor: Colors.primary500, width: 12 }}
              />
            ) : null}
          </TouchableOpacity>
        </View>
      </LeagueCard>
    );
  };

  const renderSquadSelectorModal = () => (
    <BottomModal
      close={() => setIsSquadSelectorVisible(false)}
      closeIconTintColor="primary200"
      contentContainerStyle={{ paddingBottom: 18 }}
      headerComponent={(
        <View style={{ alignItems: 'center' }}>
          <Text style={[Fonts.h3, { color: Colors.neutral00, textAlign: 'center' }]}>
            Changer de squad
          </Text>
          <Text style={[Fonts.p3, { color: Colors.neutral300, marginTop: 6, textAlign: 'center' }]}>
            Selectionnez la squad active pour votre dashboard League.
          </Text>
        </View>
      )}
      isVisible={isSquadSelectorVisible}
      snapPoints={['48%', '76%']}
      style={{
        backgroundColor: Colors.primary900,
        borderColor: 'rgba(1, 179, 244, 0.30)',
        borderWidth: 1,
      }}
    >
      <View style={{ paddingBottom: 24 }}>
        {allSquads.length === 0 ? (
          <LeagueCard
            style={{
              ...leagueSurface,
              alignItems: 'center',
              marginBottom: 0,
              paddingHorizontal: 16,
              paddingVertical: 18,
            }}
          >
            <Text style={[Fonts.p2, { color: Colors.neutral300 }]}>
              Aucune squad disponible.
            </Text>
          </LeagueCard>
        ) : null}

        {allSquads.map((/** @type {Team} */ squad) => {
          const squadId = getEntityDocumentId(squad);
          const isActiveSquad = areSameEntityId(squadId, getEntityDocumentId(userTeam));
          const squadLogoUri = getSquadLogoUri(squad);
          const hasSquadLogo = Boolean(squadLogoUri);

          return (
            <TouchableOpacity
              activeOpacity={0.82}
              key={squadId || squad?.id || squad?.name}
              onPress={() => handleSquadSwitch(squad)}
              style={{
                alignItems: 'center',
                backgroundColor: isActiveSquad ? 'rgba(1, 179, 244, 0.18)' : 'rgba(23, 56, 68, 0.52)',
                borderColor: isActiveSquad ? 'rgba(1, 179, 244, 0.78)' : 'rgba(1, 179, 244, 0.35)',
                borderRadius: 16,
                borderWidth: 1,
                flexDirection: 'row',
                marginBottom: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
              }}
            >
              <View
                style={{
                  alignItems: 'center',
                  backgroundColor: 'rgba(0, 18, 24, 0.72)',
                  borderColor: hasSquadLogo ? 'rgba(1, 179, 244, 0.48)' : 'rgba(255, 215, 0, 0.55)',
                  borderRadius: 28,
                  borderWidth: 1,
                  height: 56,
                  justifyContent: 'center',
                  marginRight: 12,
                  overflow: 'hidden',
                  padding: 2,
                  width: 56,
                }}
              >
                {hasSquadLogo ? (
                  <Image
                    resizeMode="cover"
                    source={{ uri: squadLogoUri }}
                    style={{ height: 52, width: 52 }}
                  />
                ) : (
                  <TeamShield
                    initials={getSquadShieldInitials(squad?.name)}
                    isGold
                    size={48}
                  />
                )}
              </View>

              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text numberOfLines={1} style={[Fonts.p1Bold, { color: Colors.neutral00, flex: 1, marginRight: 8 }]}>
                    {squad?.name || 'Squad'}
                  </Text>
                  {isActiveSquad ? (
                    <View
                      style={{
                        alignItems: 'center',
                        backgroundColor: 'rgba(1, 179, 244, 0.14)',
                        borderColor: 'rgba(1, 179, 244, 0.45)',
                        borderRadius: 999,
                        borderWidth: 1,
                        flexDirection: 'row',
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                      }}
                    >
                      <Image
                        source={Images.check}
                        style={{
                          height: 12,
                          marginRight: 4,
                          tintColor: Colors.primary500,
                          width: 12,
                        }}
                      />
                      <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>Actif</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[Fonts.p3, { color: Colors.neutral300, marginTop: 4 }]}>
                  {squad?.sport || 'Sport'}
                  {' - Div '}
                  <Text style={{ color: Colors.gold500 }}>{clampLeagueDivision(squad?.division)}</Text>
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </BottomModal>
  );

  const renderSquadSignalCard = (/** @type {Team} */ squad, /** @type {'invited' | 'pending'} */ state) => {
    const isInvitation = state === 'invited';
    const accentColor = isInvitation ? Colors.gold500 : (Colors.warning500 || Colors.gold500);
    const statusLabel = isInvitation ? 'INVITATION' : 'EN ATTENTE';
    const helperLabel = isInvitation
      ? 'Une squad vous attend d\u00E9j\u00E0. R\u00E9pondez pour rejoindre la comp\u00E9tition.'
      : 'Votre demande a bien \u00E9t\u00E9 envoy\u00E9e. Le capitaine doit encore r\u00E9pondre.';
    const ctaLabel = isInvitation ? 'Voir l invitation' : 'Voir la demande';
    const squadName = squad?.name || 'Squad League';
    const divisionValue = clampLeagueDivision(squad?.division);
    const sportLabel = String(squad?.sport || 'Sport').trim();

    return (
      <TouchableOpacity
        key={`${state}-${squad?.documentId || squad?.id || squadName}`}
        onPress={() => navigation.navigate(RouteNames.SquadDetails, {
          teamId: getEntityDocumentId(squad),
        })}
        style={{
          backgroundColor: 'rgba(10, 28, 43, 0.90)',
          borderColor: `${accentColor}45`,
          borderRadius: 20,
          borderWidth: 1,
          marginBottom: 12,
          padding: 16,
          width: '100%',
        }}
      >
        <View style={{ alignItems: 'center', flexDirection: 'row' }}>
          {squad?.crest?.url ? (
            <ProfileAvatar
              imageUrl={squad.crest.url}
              shape="rounded"
              size={54}
              style={{
                backgroundColor: Colors.neutral00,
                borderColor: `${accentColor}55`,
                borderRadius: 16,
                borderWidth: 1,
              }}
              variant="logo"
            />
          ) : (
            <LeagueCard
              isGold={isInvitation}
              style={{
                alignItems: 'center',
                backgroundColor: `${accentColor}14`,
                borderColor: `${accentColor}45`,
                borderRadius: 16,
                borderWidth: 1,
                height: 54,
                justifyContent: 'center',
                marginBottom: 0,
                padding: 0,
                width: 54,
              }}
            >
              <Text style={[Fonts.p2Bold, { color: accentColor }]}>
                {String(squadName).slice(0, 2).toUpperCase()}
              </Text>
            </LeagueCard>
          )}

          <View style={{ flex: 1, marginLeft: 12, paddingRight: 12 }}>
            <Text numberOfLines={1} style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
              {squadName}
            </Text>
            <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300, marginTop: 4 }]}>
              {sportLabel}
              {' · '}
              Division
              {' '}
              <Text style={{ color: Colors.gold500 }}>{divisionValue}</Text>
            </Text>
          </View>

          <View
            style={{
              backgroundColor: `${accentColor}14`,
              borderColor: `${accentColor}55`,
              borderRadius: 999,
              borderWidth: 1,
              paddingHorizontal: 10,
              paddingVertical: 6,
            }}
          >
            <Text style={[Fonts.p3Bold, { color: accentColor }]}>{statusLabel}</Text>
          </View>
        </View>

        <Text style={[Fonts.p3, { color: Colors.neutral200, marginTop: 12 }]}>
          {helperLabel}
        </Text>

        <View
          style={{
            alignItems: 'center',
            borderTopColor: `${accentColor}28`,
            borderTopWidth: 1,
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginTop: 12,
            paddingTop: 12,
          }}
        >
          <Text style={[Fonts.p3Bold, { color: Colors.neutral300, flex: 1, paddingRight: 12 }]}>
            Signal League prioritaire
          </Text>
          <View
            style={{
              backgroundColor: `${accentColor}14`,
              borderColor: `${accentColor}55`,
              borderRadius: 999,
              borderWidth: 1,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Text style={[Fonts.p2Bold, { color: accentColor }]}>{ctaLabel}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderNoTeamState = () => (
    <View style={{
      alignItems: 'center', flex: 1, justifyContent: 'center', marginTop: 60,
    }}
    >
      <LeagueCard style={{
        alignItems: 'center', paddingVertical: 40, width: '100%', ...leagueSurface,
      }}
      >
        {/* eslint-disable-next-line react/no-unescaped-entities */}
        <Text style={[Fonts.h2, { color: Colors.neutral00, marginBottom: 8 }]}>PRÊT À L'ACTION ?</Text>
        <Text style={[Fonts.p2, { color: Colors.neutral300, marginBottom: 24, textAlign: 'center' }]}>
          Crée ton équipe pour rejoindre la compétition officielle.
        </Text>
        <Button
          onPress={() => navigation.navigate(RouteNames.SquadSearch)}
          style={{ marginBottom: 12, width: '100%' }}
          title="RECHERCHER UNE SQUAD"
          variant="Secondary"
        />
        <Button
          icon="plus"
          iconColor={Colors.primary500}
          onPress={() => navigation.navigate(RouteNames.TeamStack, { screen: RouteNames.CreateSquad })}
          style={{
            backgroundColor: Colors.gold500,
            borderColor: 'rgba(255, 219, 102, 0.35)',
            borderRadius: 30,
            borderWidth: 1,
            width: '100%',
          }}
          textStyle={{ color: Colors.neutral900 }}
          title="CRÉER UNE SQUAD"
          variant="Primary"
        />
      </LeagueCard>
      {(invitedSquads.length > 0 || pendingSquads.length > 0) ? (
        <View style={{ marginTop: 8, width: '100%' }}>
          <SectionHeader
            subtitle="A TRAITER MAINTENANT"
            title="SIGNAUX SQUAD"
          />
          {invitedSquads.map((squad) => renderSquadSignalCard(squad, 'invited'))}
          {pendingSquads.map((squad) => renderSquadSignalCard(squad, 'pending'))}
          <TouchableOpacity
            onPress={() => navigation.navigate(RouteNames.LeagueSquadTab)}
            style={{ alignItems: 'center', marginTop: 8 }}
          >
            <Text style={[Fonts.p2Bold, { color: Colors.primary500, textDecorationLine: 'underline' }]}>
              Ouvrir mon onglet Squad
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );

  const renderCaptainRequestsSignal = () => {
    if (!isCaptainOnDashboard || dashboardPendingRequestsCount <= 0) return null;

    return (
      <LeagueCard
        style={{
          backgroundColor: 'rgba(127, 29, 29, 0.22)',
          borderColor: 'rgba(239, 68, 68, 0.45)',
          marginBottom: 24,
        }}
      >
        <Text style={[Fonts.p3Bold, { color: Colors.error500, marginBottom: 8 }]}>
          VALIDATION CAPITAINE
        </Text>
        <Text style={[Fonts.h4Bold, { color: Colors.neutral00, marginBottom: 8 }]}>
          <Text style={{ color: Colors.gold500 }}>{dashboardPendingRequestsCount}</Text>
          {' '}
          demande
          {dashboardPendingRequestsCount > 1 ? 's' : ''}
          {' '}
          attendent votre réponse
        </Text>
        <Text style={[Fonts.p2, { color: Colors.neutral200, marginBottom: 16 }]}>
          Ouvrez les demandes de votre squad pour accepter ou refuser les joueurs en attente.
        </Text>
        <Button
          onPress={() => navigation.navigate(RouteNames.SquadRequests, { teamId: getEntityDocumentId(userTeam) })}
          title="VOIR LES DEMANDES"
          variant="Secondary"
        />
      </LeagueCard>
    );
  };

  const renderLeagueActionCard = () => {
    const state = resolveLeagueActionStateKey(leagueActionState);
    const accentPalette = (() => {
      switch (leagueActionMeta.accent) {
        case 'gold':
          return {
            bg: `${Colors.gold500}14`,
            border: `${Colors.gold500}42`,
            text: Colors.gold500,
          };
        case 'neutral':
          return {
            bg: `${Colors.neutral300}14`,
            border: `${Colors.neutral300}30`,
            text: Colors.neutral200,
          };
        case 'success':
          return {
            bg: `${Colors.success500}18`,
            border: `${Colors.success500}45`,
            text: Colors.success500,
          };
        case 'warning':
          return {
            bg: `${Colors.warning500}18`,
            border: `${Colors.warning500}45`,
            text: Colors.warning500,
          };
        default:
          return {
            bg: `${Colors.primary500}16`,
            border: `${Colors.primary500}40`,
            text: Colors.primary500,
          };
      }
    })();

    const shouldHideOpponentName = shouldMaskOpponentIdentity(leagueActionState?.match || null);
    const opponentName = shouldHideOpponentName
      ? 'Adversaire'
      : leagueActionState?.opponent?.name || leagueActionState?.opponentDetails?.name || 'Adversaire';
    const actionRequired = [
      'disputed',
      'pending_validation',
      'post_slot_resolution',
      'proposal_received',
      'waiting_score',
      'waiting_venue',
    ].includes(state);
    const hasSecondaryAction = [
      'disputed',
      'opponent_found',
      'pending_validation',
      'post_slot_resolution',
      'proposal_received',
      'proposal_sent_waiting',
      'waiting_score',
      'waiting_venue',
    ].includes(state);
    let secondaryActionLabel = 'Voir le chat';
    if (state === 'proposal_sent_waiting' || state === 'waiting_venue' || state === 'post_slot_resolution') {
      secondaryActionLabel = 'Voir le match';
    } else if (SCORE_ACTION_STATES.has(state)) {
      secondaryActionLabel = 'Voir la fiche match';
    }

    return (
      <LeagueCard style={{ ...leagueSurface, marginBottom: 24 }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }}>
          <View
            style={{
              backgroundColor: accentPalette.bg,
              borderColor: accentPalette.border,
              borderRadius: 999,
              borderWidth: 1,
              paddingHorizontal: 12,
              paddingVertical: 7,
            }}
          >
            <Text style={[Fonts.p3Bold, { color: accentPalette.text }]}>{leagueActionMeta.title}</Text>
          </View>
          {actionRequired ? (
            <View
              style={{
                backgroundColor: `${Colors.error500}16`,
                borderColor: `${Colors.error500}40`,
                borderRadius: 999,
                borderWidth: 1,
                paddingHorizontal: 10,
                paddingVertical: 6,
              }}
            >
              <Text style={[Fonts.p4Bold, { color: Colors.error500 }]}>ACTION REQUISE</Text>
            </View>
          ) : null}
        </View>

        <Text style={[Fonts.h4Bold, { color: Colors.neutral00, marginTop: 14 }]}>
          {state === 'searching' || state === 'idle'
            ? (userTeam?.name || 'Votre squad')
            : `${userTeam?.name || 'Votre squad'} VS ${opponentName}`}
        </Text>

        <Text style={[Fonts.p2, { color: Colors.neutral200, marginTop: 10 }]}>
          {leagueActionMeta.helper}
        </Text>

        {(leagueActionState?.date || leagueActionState?.venue) ? (
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.04)',
              borderColor: 'rgba(255,255,255,0.08)',
              borderRadius: 18,
              borderWidth: 1,
              gap: 8,
              marginTop: 16,
              padding: 14,
            }}
          >
            {leagueActionState?.date ? (
              <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
                Date
                {' : '}
                <Text style={[Fonts.p3Bold, { color: Colors.gold500 }]}>
                  {formatLeagueDashboardDate(leagueActionState.date)}
                </Text>
              </Text>
            ) : null}
            {leagueActionState?.venue ? (
              <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
                Lieu
                {' : '}
                <Text style={[Fonts.p3Bold, { color: Colors.gold500 }]}>{leagueActionState.venue}</Text>
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={{ gap: 12, marginTop: 18 }}>
          <Button
            onPress={handlePrimaryLeagueAction}
            style={{ backgroundColor: Colors.gold500 }}
            textStyle={{ color: Colors.primary900 }}
            title={leagueActionMeta.actionLabel}
            variant="Primary"
          />
          {hasSecondaryAction ? (
            <Button
              onPress={handleSecondaryLeagueAction}
              style={{ borderColor: Colors.gold500 }}
              textStyle={{ color: Colors.gold500 }}
              title={secondaryActionLabel}
              variant="Secondary"
            />
          ) : null}
        </View>
      </LeagueCard>
    );
  };

  const renderStats = () => {
    const divisionProgress = getDivisionProgressState(
      getTeamDivisionPoints(userTeam),
      userTeam?.division,
    );
    const rawStreak = Number(userTeam?.streak || 0);
    const nextStreakBonus = rawStreak > 0 ? getNextStreakBonus(rawStreak) : 0;
    let streakHelper = 'Prochaine victoire: +20 pts';
    if (rawStreak > 0) {
      streakHelper = `Prochain bonus: +${nextStreakBonus}`;
    } else if (rawStreak < 0) {
      streakHelper = 'Dernier resultat: defaite';
    }
    const promotionHelper = divisionProgress.maxDivisionReached
      ? 'Division 1 prestige'
      : `${Math.round(divisionProgress.pointsToPromotion)} pts avant promotion`;

    return (
      <LeagueCard style={leagueSurface}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={[Fonts.h2Bold, { color: Colors.gold500 }]}>{userTeam?.wins || 0}</Text>
            <Text style={[Fonts.p3, { color: Colors.neutral200, marginTop: 4 }]}>VICTOIRES</Text>
          </View>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.12)', width: 1 }} />
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={[Fonts.h2Bold, { color: Colors.gold500 }]}>{formatPositiveStreak(userTeam?.streak)}</Text>
            <Text style={[Fonts.p3, { color: Colors.neutral200, marginTop: 4 }]}>SÉRIE</Text>
          </View>
          <View style={{ backgroundColor: 'rgba(255,255,255,0.12)', width: 1 }} />
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={[Fonts.h2Bold, { color: Colors.gold500 }]}>{/** @type {any} */ (userTeam)?.losses || 0}</Text>
            <Text style={[Fonts.p3, { color: Colors.neutral200, marginTop: 4 }]}>DÉFAITES</Text>
          </View>
        </View>

        <View
          style={{
            alignItems: 'center',
            borderTopColor: 'rgba(255,255,255,0.08)',
            borderTopWidth: 1,
            marginTop: 16,
            paddingTop: 16,
          }}
        >
          <Text style={[Fonts.p3Bold, { color: Colors.gold500, marginBottom: 4, textAlign: 'center' }]}>
            {getTeamDivisionPoints(userTeam)}
            /100 pts
            {' - '}
            {promotionHelper}
          </Text>
          <Text style={[Fonts.p3, { color: Colors.neutral200, marginBottom: 12, textAlign: 'center' }]}>
            {streakHelper}
            {' | Meilleure serie: x'}
            {getTeamHighestStreak(userTeam)}
          </Text>
          <Button
            onPress={handleOpenSquadStatistics}
            size="small"
            title="VOIR LES STATISTIQUES DE LA SQUAD"
            variant="Secondary"
          />
        </View>
      </LeagueCard>
    );
  };

  // Real "Top of League" + User logic
  const renderLeaderboard = () => {
    if (!rankingData || rankingData.length === 0) return null;

    // 1. Get Top 3
    const topTeams = /** @type {LeaderboardEntry[]} */ (rankingData.slice(0, 3).map((/** @type {Team} */ t, /** @type {number} */ i) => ({
      form: computeTeamForm(t),
      isMe: getEntityDocumentId(t) === getEntityDocumentId(userTeam),
      name: t.name || 'Équipe',
      points: getTeamDivisionPoints(t),
      rank: i + 1,
    })));

    // 2. Add User if not in Top 3
    const userIndex = rankingData.findIndex((/** @type {Team} */ t) => getEntityDocumentId(t) === getEntityDocumentId(userTeam));
    const isUserInTop = userIndex >= 0 && userIndex < 3;

    const displayTeams = /** @type {any[]} */ ([...topTeams]);

    if (userTeam && !isUserInTop && userIndex !== -1) {
      displayTeams.push({ type: 'separator' });
      displayTeams.push({
        form: computeTeamForm(userTeam),
        isMe: true,
        name: userTeam.name || 'Équipe',
        points: getTeamDivisionPoints(userTeam),
        rank: userIndex + 1,
      });
    }

    return (
      <View>
        <SectionHeader
          subtitle={(
            <>
              DIVISION
              {' '}
              <Text style={{ color: Colors.gold500 }}>{clampLeagueDivision(userTeam?.division)}</Text>
            </>
          )}
          title="LEADERBOARD"
        />

        <LeagueCard style={{ overflow: 'hidden', padding: 0, ...leagueSurface }}>
          {displayTeams.map((/** @type {any} */ team, /** @type {number} */ index) => {
            if ('type' in team && team.type === 'separator') {
              return (
                <View key="sep" style={{ alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', paddingVertical: 8 }}>
                  <View style={{
                    backgroundColor: Colors.neutral500, borderRadius: 2, height: 4, marginVertical: 2, width: 4,
                  }}
                  />
                  <View style={{
                    backgroundColor: Colors.neutral500, borderRadius: 2, height: 4, marginVertical: 2, width: 4,
                  }}
                  />
                  <View style={{
                    backgroundColor: Colors.neutral500, borderRadius: 2, height: 4, marginVertical: 2, width: 4,
                  }}
                  />
                </View>
              );
            }

            const rankedTeam = /** @type {LeaderboardEntry} */ (team);
            return (
              <View
                key={`rank-${rankedTeam.rank}-${rankedTeam.name}`}
                style={{
                  alignItems: 'center',
                  backgroundColor: rankedTeam.isMe ? 'rgba(212, 175, 55, 0.14)' : 'transparent',
                  borderBottomWidth: (() => {
                    if (index >= displayTeams.length - 1) return 0;
                    const nextTeam = displayTeams[index + 1];
                    if (!nextTeam) return 0;
                    return ('type' in nextTeam && nextTeam.type === 'separator') ? 0 : 1;
                  })(),
                  borderColor: 'rgba(255,255,255,0.08)',
                  flexDirection: 'row',
                  padding: 16,
                }}
              >
                <Text style={[Fonts.h4, { color: Colors.gold500, width: 35 }]}>
                  #
                  {rankedTeam.rank}
                </Text>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>{rankedTeam.name}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[Fonts.p1Bold, { color: Colors.gold500 }]}>
                    {rankedTeam.points}
                    {' '}
                    pts
                  </Text>
                  <Text style={{ color: Colors.gold500, fontSize: 10, marginTop: 2 }}>{rankedTeam.form}</Text>
                </View>
              </View>
            );
          })}

          <TouchableOpacity
            onPress={() => navigation.navigate(RouteNames.LeagueRanking, {
              division: userTeam?.division,
            })}
            style={{ alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', padding: 12 }}
          >
            <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>VOIR LE CLASSEMENT COMPLET</Text>
          </TouchableOpacity>
        </LeagueCard>
      </View>
    );
  };

  if (loading && !userTeam && !loadError) {
    return (
      <LeagueStateView
        description="Chargement du dashboard League et de votre squad."
        isLoading
        title="Chargement League"
      />
    );
  }

  if (loadError && !userTeam) {
    return (
      <LeagueStateView
        actionLabel="Réessayer"
        description={loadError}
        onAction={() => loadDashboard()}
        title="Dashboard indisponible"
      />
    );
  }

  return (
    <ScreenContainer bgImage="bg2">
      <ScrollView
        contentContainerStyle={{ paddingBottom: scrollBottomPadding, paddingVertical: 24 }}
        refreshControl={
          <RefreshControl colors={[Colors.gold500]} onRefresh={loadDashboard} refreshing={loading} tintColor={Colors.gold500} />
                }
      >
        {renderHeader()}

        {!userTeam ? (
          renderNoTeamState()
        ) : (
          <>
            {renderSquadSwitcherBar()}

            <CompetitiveHero
              division={userTeam.division}
              divisionPoints={getTeamDivisionPoints(userTeam)}
              elo={userTeam.elo}
              nextDivisionPoints={getDivisionPromotionTargetPoints(userTeam?.division)}
              rank={(() => {
                const index = rankingData.findIndex((/** @type {Team} */ t) => getEntityDocumentId(t) === getEntityDocumentId(userTeam));
                return index >= 0 ? index + 1 : '-';
              })()}
              seasonPoints={getTeamSeasonPoints(userTeam)}
              teamName={userTeam.name}
            />

            {renderCaptainRequestsSignal()}

            {renderLeagueActionCard()}

            {/* Stats */}
            <View style={{ marginBottom: 24 }}>
              {renderStats()}
            </View>

            {/* Match History */}
            <MatchHistory
              matches={matchHistory}
              onMatchPress={handleMatchPress}
              onViewAll={() => navigation.navigate(RouteNames.MatchHistoryScreen)}
            />

            {/* Leaderboard */}
            {renderLeaderboard()}

            {/* Squad shortcut */}
            <TouchableOpacity
              onPress={() => navigation.navigate(RouteNames.LeagueSquadTab)}
              style={{ alignItems: 'center', marginTop: 16 }}
            >
              <Text style={[Fonts.p2, { color: Colors.neutral300, textDecorationLine: 'underline' }]}>
                Gérer mon effectif & Rôles
              </Text>
            </TouchableOpacity>
          </>
        )}

      </ScrollView>
      {renderSquadSelectorModal()}
      <BottomModal
        close={() => setConversationFallbackState(null)}
        isVisible={Boolean(conversationFallbackState)}
      >
        <View style={{ gap: 16, paddingBottom: 12 }}>
          <View style={{ gap: 6 }}>
            <Text style={[Fonts.h3Bold, { color: Colors.neutral00, textAlign: 'center' }]}>
              Conversation en preparation
            </Text>
            <Text style={[Fonts.p2, { color: Colors.neutral200, textAlign: 'center' }]}>
              La conversation avec l&apos;adversaire n&apos;est pas encore prete. Reessayez dans quelques secondes ou ouvrez la fiche match pour suivre l&apos;organisation.
            </Text>
          </View>
          <LeagueCard style={{ ...leagueSurface, marginBottom: 0 }}>
            <Text style={[Fonts.p4Bold, { color: Colors.gold500 }]}>Etat League</Text>
            <Text style={[Fonts.p2Bold, { color: Colors.neutral00, marginTop: 6 }]}>
              {conversationFallbackState?.opponentName || 'Adversaire'}
            </Text>
          </LeagueCard>
          <Button
            onPress={async () => {
              const fallbackState = conversationFallbackState;
              setConversationFallbackState(null);
              await openLeagueConversation({
                matchId: fallbackState?.matchId,
                opponentName: fallbackState?.opponentName,
                proposalMessageId: fallbackState?.proposalMessageId,
              });
            }}
            title="Repondre"
            variant="Primary"
          />
          {conversationFallbackState?.matchId ? (
            <Button
              onPress={() => {
                const nextMatchId = conversationFallbackState?.matchId;
                setConversationFallbackState(null);
                if (nextMatchId) {
                  openLeagueMatchDetails(nextMatchId, 'negotiation');
                }
              }}
              title="Voir le match"
              variant="Secondary"
            />
          ) : null}
          <Button
            onPress={() => setConversationFallbackState(null)}
            title="Fermer"
            variant="SecondaryLight"
          />
        </View>
      </BottomModal>
    </ScreenContainer>
  );
}

export default LeagueDashboard;
