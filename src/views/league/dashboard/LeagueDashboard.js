import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
  Image, RefreshControl, ScrollView, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import Button from '@/components/atoms/button/Button';
import LeagueCard from '@/components/atoms/league/LeagueCard';
import SectionHeader from '@/components/atoms/SectionHeader/SectionHeader';
import LeagueHeaderSwitch from '@/components/molecules/header/LeagueHeaderSwitch';
import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import CompetitiveHero from '@/components/organisms/league/CompetitiveHero';
import MatchHistory from '@/components/organisms/league/MatchHistory';
import ScreenContainer from '@/components/templates/ScreenContainer';

import { RouteNames } from '@/navigation/routeNames';

import { getMatchHistory } from '@/services/league/leagueMatchService';
import MatchmakingService from '@/services/league/MatchmakingService';
import { getMyLeagueTeam, getRanking } from '@/services/leagueTeam/leagueTeamService';

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
  const rawSeries = Array.isArray(team?.recentResults)
    ? team.recentResults
    : Array.isArray(team?.form)
      ? team.form
      : [];

  if (!rawSeries.length) {
    return '---';
  }

  return rawSeries.slice(0, 3).map(normalizeFormResult).join('');
};

/**
 *
 */
function LeagueDashboard() {
  const {
    Alignments, ApplicationStyle, Colors, Fonts, Images, Spaces,
  } = useTheme();
  const { userData } = /** @type {{ userData: User | null }} */ (useAuth());
  const navigation = /** @type {any} */ (useNavigation());

  const [userTeam, setUserTeam] = useState(/** @type {Team | null} */ (null));
  const [matchHistory, setMatchHistory] = useState(/** @type {MatchHistoryEntry[]} */ ([]));
  const [rankingData, setRankingData] = useState(/** @type {Team[]} */ ([]));
  const [loading, setLoading] = useState(true);
  const [isSearchRunning, setIsSearchRunning] = useState(false);
  const leagueSurface = {
    backgroundColor: 'rgba(10, 28, 43, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.22)',
  };

  const loadDashboard = async () => {
    if (!userData) return;
    setLoading(true);
    try {
      // 1. Get User Team
      const squads = await getMyLeagueTeam(getEntityDocumentId(userData));
      const team = squads && squads.length > 0 ? squads[0] : null;
      setUserTeam(team);
      setIsSearchRunning(false);

      // 2. Load match history & Rankings if team exists
      if (team) {
        try {
          const teamId = getEntityDocumentId(team);
          if (teamId) {
            const searchState = await MatchmakingService.getActiveRequest(teamId);
            setIsSearchRunning(searchState?.state === 'searching' || searchState?.state === 'matched');
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
          setIsSearchRunning(false);
        }
      }
    } catch (error) {
      console.error('Dashboard Load Error:', error);
      setIsSearchRunning(false);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [userData]),
  );

  const handleMatchPress = (/** @type {MatchHistoryEntry} */ match) => {
    navigation.navigate(RouteNames.PastMatchDetails, {
      matchId: getEntityDocumentId(match),
      myTeamId: getEntityDocumentId(userTeam),
    });
  };

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

  const renderNoTeamState = () => (
    <View style={{
      alignItems: 'center', flex: 1, justifyContent: 'center', marginTop: 60,
    }}
    >
      <LeagueCard style={{
        alignItems: 'center', paddingVertical: 40, width: '100%', ...leagueSurface,
      }}
      >
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
    </View>
  );

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
    </LeagueCard>
  );

  // Real "Top of League" + User logic
  const renderLeaderboard = () => {
    if (!rankingData || rankingData.length === 0) return null;

    // 1. Get Top 3
    const topTeams = /** @type {LeaderboardEntry[]} */ (rankingData.slice(0, 3).map((/** @type {Team} */ t, /** @type {number} */ i) => ({
      form: computeTeamForm(t),
      isMe: getEntityDocumentId(t) === getEntityDocumentId(userTeam),
      name: t.name || 'Equipe',
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
        name: userTeam.name || 'Equipe',
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
                key={index}
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

            {/* CTA Matchmaking */}
            <View style={{ marginVertical: 24 }}>
              <Button
                onPress={() => navigation.navigate(RouteNames.LeagueMatchTab)}
                style={{
                  backgroundColor: Colors.gold500,
                  borderColor: 'rgba(255, 219, 102, 0.35)',
                  borderRadius: 30,
                  borderWidth: 1,
                  height: 56,
                }}
                textStyle={{
                  ...Fonts.h4Bold, color: Colors.neutral900, letterSpacing: 1, lineHeight: undefined,
                }}
                title={isSearchRunning ? 'RECHERCHE EN COURS' : 'TROUVER UN MATCH'}
                variant="Primary"
              />
            </View>

            {/* Stats */}
            <View style={{ marginBottom: 24 }}>
              {renderStats()}
            </View>

            {/* Match History */}
            <MatchHistory
              matches={matchHistory}
              onMatchPress={handleMatchPress}
              onViewAll={() => navigation.navigate('MatchHistoryScreen')}
            />

            {/* Leaderboard */}
            {renderLeaderboard()}

            {/* Squad shortcut */}
            <TouchableOpacity
              onPress={() => navigation.navigate('LeagueSquadTab')}
              style={{ alignItems: 'center', marginTop: 16 }}
            >
              <Text style={[Fonts.p2, { color: Colors.neutral300, textDecorationLine: 'underline' }]}>
                Gérer mon effectif & Rôles
              </Text>
            </TouchableOpacity>
          </>
        )}

      </ScrollView>
    </ScreenContainer>
  );
}

export default LeagueDashboard;
