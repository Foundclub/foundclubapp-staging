import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import LeagueCard from '@/components/atoms/league/LeagueCard';
import SectionHeader from '@/components/atoms/SectionHeader/SectionHeader';
import BottomModal from '@/components/molecules/bottomModal/BottomModal';
import LeagueHeaderSwitch from '@/components/molecules/header/LeagueHeaderSwitch';
import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import ProfileAvatar from '@/components/molecules/profileAvatar/ProfileAvatar';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import CompetitiveHero from '@/components/organisms/league/CompetitiveHero';
import MatchHistory from '@/components/organisms/league/MatchHistory';
import ScreenContainer from '@/components/templates/ScreenContainer';
import LeagueStateView from '@/views/league/components/LeagueStateView';
import { shouldMaskOpponentIdentity } from '@/views/league/match/utils/matchStatus';

import { RouteNames } from '@/navigation/routeNames';

import { getMatch, getMatchHistory } from '@/services/league/leagueMatchService';
import MatchmakingService from '@/services/league/MatchmakingService';
import {
  getInvitedLeagueTeams,
  getMyLeagueTeam,
  getPendingLeagueTeams,
  getRanking,
} from '@/services/leagueTeam/leagueTeamService';

import { getEntityDocumentId } from '@/utils/entityId';
import { clampLeagueDivision, getNextDivisionTargetElo } from '@/utils/league/division';

/**
 * @typedef {{ rank: number, name: string, points: number, form: string, isMe: boolean }} LeaderboardEntry
 */
/**
 * @typedef {{ type: 'separator' }} LeaderboardSeparator
 */
/**
 * @typedef {LeaderboardEntry | LeaderboardSeparator} LeaderboardRow
 */

const normalizeFormResult = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (['v', 'victoire', 'w', 'win', 'won'].includes(normalized)) return 'V';
  if (['d', 'draw', 'n', 'nul'].includes(normalized)) return 'N';
  if (['defaite', 'defeat', 'l', 'lose', 'loss'].includes(normalized)) return 'D';
  return '-';
};

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

const LEAGUE_ACTION_META = {
  confirm\u00E9d_upcoming: {
    accent: 'success',
    actionLabel: 'Voir le match',
    helper: 'Le match est confirm\u00E9. Retrouvez les informations de preparation dans votre espace Match.',
    title: 'Match confirm\u00E9',
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
  waiting_venue: {
    accent: 'warning',
    actionLabel: 'Reserver le terrain',
    helper: "Le match est confirm\u00E9, mais le terrain n'est pas encore r\u00E9serv\u00E9. Finalisez l'organisation d\u00E8s que possible.",
    title: 'Terrain \u00E0 r\u00E9server',
  },
};

/**
 *
 */
function LeagueDashboard() {
  const {
    Alignments, Colors, Fonts, Spaces,
  } = useTheme();
  const { userData } = /** @type {{ userData: User | null }} */ (useAuth());
  const navigation = /** @type {any} */ (useNavigation());

  const [userTeam, setUserTeam] = useState(/** @type {Team | null} */ (null));
  const [matchHistory, setMatchHistory] = useState(/** @type {MatchHistoryEntry[]} */ ([]));
  const [rankingData, setRankingData] = useState(/** @type {Team[]} */ ([]));
  const [invitedSquads, setInvitedSquads] = useState(/** @type {Team[]} */ ([]));
  const [pendingSquads, setPendingSquads] = useState(/** @type {Team[]} */ ([]));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [leagueActionState, setLeagueActionState] = useState(/** @type {any | null} */ (null));
  const [conversationFallbackState, setConversationFallbackState] = useState(/** @type {any | null} */ (null));
  const leagueSurface = {
    backgroundColor: 'rgba(10, 28, 43, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.22)',
  };

  const loadDashboard = useCallback(async () => {
    if (!userData) return;
    setLoading(true);
    setLoadError('');
    try {
      const userId = getEntityDocumentId(userData);
      const [squads, invitationResults, pendingResults] = await Promise.all([
        getMyLeagueTeam(userId),
        getInvitedLeagueTeams(userId),
        getPendingLeagueTeams(userId),
      ]);

      setInvitedSquads(Array.isArray(invitationResults) ? invitationResults : []);
      setPendingSquads(Array.isArray(pendingResults) ? pendingResults : []);

      // 1. Get User Team
      const team = squads && squads.length > 0 ? squads[0] : null;
      setUserTeam(team);
      setLeagueActionState(null);
      setMatchHistory([]);
      setRankingData([]);

      // 2. Load match history & Rankings if team exists
      if (team) {
        try {
          const teamId = getEntityDocumentId(team);
          if (teamId) {
            const searchState = await MatchmakingService.getActiveRequest(teamId);
            setLeagueActionState(searchState || null);
          }

          const history = await getMatchHistory(getEntityDocumentId(team), 5);
          setMatchHistory(Array.isArray(history) ? history : []);

          // Fetch Ranking for current division
          const division = clampLeagueDivision(team?.division);
          const rankings = await getRanking(division);
          setRankingData(Array.isArray(rankings) ? rankings : []);
        } catch (historyErr) {
          console.log('Data fetch error:', historyErr);
          setMatchHistory([]);
          setRankingData([]);
          setLeagueActionState(null);
        }
      }
    } catch (error) {
      console.error('Dashboard Load Error:', error);
      setInvitedSquads([]);
      setPendingSquads([]);
      setUserTeam(null);
      setMatchHistory([]);
      setRankingData([]);
      setLeagueActionState(null);
      setLoadError('Impossible de charger le dashboard League pour le moment.');
    } finally {
      setLoading(false);
    }
  }, [userData]);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard]),
  );

  const isCaptainOnDashboard = getEntityDocumentId(userTeam?.captain) === getEntityDocumentId(userData);
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
    const state = String(leagueActionState?.state || 'idle');

    if (state === 'searching') {
      navigation.navigate(RouteNames.LeagueMatchTab);
      return;
    }

    if (state === 'waiting_venue') {
      openLeagueMatchDetails(leagueActionState?.matchId || leagueActionState?.match?.documentId, 'venueBooking');
      return;
    }

    if (state === 'opponent_found') {
      openLeagueProposalComposer(leagueActionState?.matchId || leagueActionState?.match?.documentId);
      return;
    }

    if (state === 'proposal_received') {
      openLeagueConversation({
        chatId: leagueActionState?.chatId,
        matchId: leagueActionState?.matchId || leagueActionState?.match?.documentId,
        proposalMessageId: leagueActionState?.proposalMessageId,
      });
      return;
    }

    if (['confirm\u00E9d_upcoming', 'proposal_sent_waiting'].includes(state)) {
      if (state === 'proposal_sent_waiting') {
        openLeagueConversation({
          chatId: leagueActionState?.chatId,
          matchId: leagueActionState?.matchId || leagueActionState?.match?.documentId,
          proposalMessageId: leagueActionState?.proposalMessageId,
        });
      } else {
        openLeagueMatchDetails(leagueActionState?.matchId || leagueActionState?.match?.documentId);
      }
      return;
    }

    navigation.navigate(RouteNames.LeagueMatchTab);
  }, [leagueActionState, navigation, openLeagueConversation, openLeagueMatchDetails, openLeagueProposalComposer]);

  const handleSecondaryLeagueAction = useCallback(() => {
    const state = String(leagueActionState?.state || '');

    if (state === 'proposal_received') {
      openLeagueConversation({
        chatId: leagueActionState?.chatId,
        matchId: leagueActionState?.matchId || leagueActionState?.match?.documentId,
        proposalMessageId: leagueActionState?.proposalMessageId,
      });
      return;
    }

    if (state === 'opponent_found' || state === 'proposal_sent_waiting') {
      openLeagueMatchDetails(leagueActionState?.matchId || leagueActionState?.match?.documentId);
      return;
    }

    if (state === 'waiting_venue') {
      openLeagueMatchDetails(leagueActionState?.matchId || leagueActionState?.match?.documentId);
    }
  }, [leagueActionState, openLeagueConversation, openLeagueMatchDetails]);

  const leagueActionMeta = useMemo(() => {
    const state = String(leagueActionState?.state || 'idle');
    return LEAGUE_ACTION_META[state] || LEAGUE_ACTION_META.idle;
  }, [leagueActionState?.state]);

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

  const renderSquadSignalCard = (/** @type {Team} */ squad, /** @type {'invited' | 'pending'} */ state) => {
    const isInvitation = state === 'invited';
    const accentColor = isInvitation ? Colors.gold500 : (Colors.warning500 || Colors.gold500);
    const statusLabel = isInvitation ? 'INVITATION' : 'EN ATTENTE';
    const helperLabel = isInvitation
      ? 'Une squad vous attend d\u00E9j\u00E0. R\u00E9pondez pour rejoindre la comp\u00E9tition.'
      : 'Votre demande a bien \u00E9t\u00E9 envoy\u00E9e. Le capitaine doit encore r\u00E9pondre.';
    const ctaLabel = isInvitation ? 'Voir l invitation' : 'Voir la demande';
    const squadName = squad?.name || 'Squad League';
    const divisionLabel = `Division ${clampLeagueDivision(squad?.division)}`;
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
              {divisionLabel}
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
          {dashboardPendingRequestsCount}
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
    const state = String(leagueActionState?.state || 'idle');
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
    const actionRequired = state === 'proposal_received' || state === 'waiting_venue';
    const hasSecondaryAction = ['opponent_found', 'proposal_received', 'proposal_sent_waiting', 'waiting_venue'].includes(state);
    let secondaryActionLabel = 'Voir le chat';
    if (state === 'proposal_sent_waiting' || state === 'waiting_venue') {
      secondaryActionLabel = 'Voir le match';
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
                <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>
                  {formatLeagueDashboardDate(leagueActionState.date)}
                </Text>
              </Text>
            ) : null}
            {leagueActionState?.venue ? (
              <Text style={[Fonts.p3, { color: Colors.neutral200 }]}>
                Lieu
                {' : '}
                <Text style={[Fonts.p3Bold, { color: Colors.neutral00 }]}>{leagueActionState.venue}</Text>
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

  const renderStats = () => (
    <LeagueCard style={leagueSurface}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={[Fonts.h2Bold, { color: Colors.neutral00 }]}>{userTeam?.wins || 0}</Text>
          <Text style={[Fonts.p3, { color: Colors.neutral200, marginTop: 4 }]}>VICTOIRES</Text>
        </View>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.12)', width: 1 }} />
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={[Fonts.h2Bold, { color: Colors.neutral00 }]}>{userTeam?.streak || 0}</Text>
          <Text style={[Fonts.p3, { color: Colors.neutral200, marginTop: 4 }]}>SÉRIE</Text>
        </View>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.12)', width: 1 }} />
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text style={[Fonts.h2Bold, { color: Colors.neutral00 }]}>{/** @type {any} */ (userTeam)?.losses || 0}</Text>
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
        <Text style={[Fonts.p3, { color: Colors.neutral200, marginBottom: 12, textAlign: 'center' }]}>
          Retrouvez le classement League, les matchs recents et les statistiques post-match de votre squad.
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

  // Real "Top of League" + User logic
  const renderLeaderboard = () => {
    if (!rankingData || rankingData.length === 0) return null;

    // 1. Get Top 3
    const topTeams = /** @type {LeaderboardEntry[]} */ (rankingData.slice(0, 3).map((/** @type {Team} */ t, /** @type {number} */ i) => ({
      form: computeTeamForm(t),
      isMe: getEntityDocumentId(t) === getEntityDocumentId(userTeam),
      name: t.name || 'Équipe',
      points: Number(t.elo || 0),
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
        points: Number(userTeam.elo || 0),
        rank: userIndex + 1,
      });
    }

    return (
      <View>
        <SectionHeader
          subtitle={`DIVISION ${clampLeagueDivision(userTeam?.division)}`}
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
                <Text style={[Fonts.h4, { color: rankedTeam.rank <= 3 ? Colors.gold500 : Colors.neutral300, width: 35 }]}>
                  #
                  {rankedTeam.rank}
                </Text>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>{rankedTeam.name}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
                    {rankedTeam.points}
                    {' '}
                    pts
                  </Text>
                  <Text style={{ color: Colors.neutral300, fontSize: 10, marginTop: 2 }}>{rankedTeam.form}</Text>
                </View>
              </View>
            );
          })}

          <TouchableOpacity
            onPress={() => navigation.navigate(RouteNames.LeagueRanking)}
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
        actionLabel="R\u00E9essayer"
        description={loadError}
        onAction={() => loadDashboard()}
        title="Dashboard indisponible"
      />
    );
  }

  return (
    <ScreenContainer bgImage="bg2">
      <ScrollView
        contentContainerStyle={{ paddingBottom: 100, paddingVertical: 24 }}
        refreshControl={
          <RefreshControl colors={[Colors.gold500]} onRefresh={loadDashboard} refreshing={loading} tintColor={Colors.gold500} />
                }
      >
        {renderHeader()}

        {!userTeam ? (
          renderNoTeamState()
        ) : (
          <>
            <CompetitiveHero
              division={userTeam.division}
              elo={userTeam.elo}
              nextDivisionElo={getNextDivisionTargetElo(userTeam?.division)}
              rank={(() => {
                const index = rankingData.findIndex((/** @type {Team} */ t) => getEntityDocumentId(t) === getEntityDocumentId(userTeam));
                return index >= 0 ? index + 1 : '-';
              })()}
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
