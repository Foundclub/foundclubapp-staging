import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import LeagueCard from '@/components/atoms/league/LeagueCard';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import ScreenContainer from '@/components/templates/ScreenContainer';
import LeagueStateView from '@/views/league/components/LeagueStateView';

import useBottomDockLayout from '@/navigation/useBottomDockLayout';

import { loadLeagueTeamContextWithCache } from '@/services/leagueTeam/leagueTeamQueries';
import { getRanking } from '@/services/leagueTeam/leagueTeamService';

import { getEntityDocumentId } from '@/utils/entityId';
import { clampLeagueDivision } from '@/utils/league/division';

const getLeaguePoints = (team) => Number(team?.division_points ?? team?.divisionPoints ?? 0);
const getHighestStreak = (team) => Math.max(0, Number(team?.highest_streak ?? team?.highestStreak ?? 0));
const RANKING_FOCUS_REFRESH_MIN_INTERVAL_MS = 120000;

const formatCurrentStreak = (value) => {
  const streak = Number(value || 0);
  if (!Number.isFinite(streak) || streak === 0) return 'Stable';
  if (streak > 0) return `x${streak}`;
  return 'Defaite';
};

/**
 *
 */
function RankingScreen() {
  const { Colors, Fonts } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const queryClient = useQueryClient();
  const route = /** @type {any} */ (useRoute());
  const { sceneBottomInset } = useBottomDockLayout();
  const { userData } = /** @type {{ userData: User | null }} */ (useAuth());
  const listBottomPadding = Math.max(sceneBottomInset, 12);
  const routeDivision = route?.params?.division;

  const [division, setDivision] = useState(() => clampLeagueDivision(routeDivision || 5));
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [ranking, setRanking] = useState(/** @type {Team[]} */ ([]));
  const lastRankingFocusLoadRef = useRef({ division: null, loadedAt: 0 });

  const leagueSurface = {
    backgroundColor: 'rgba(10, 28, 43, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.22)',
  };

  useEffect(() => {
    if (routeDivision !== undefined && routeDivision !== null) {
      setDivision(clampLeagueDivision(routeDivision));
    }
  }, [routeDivision]);

  useEffect(() => {
    if (routeDivision !== undefined && routeDivision !== null) return;
    const init = async () => {
      if (!userData) return;
      try {
        const context = await loadLeagueTeamContextWithCache(
          queryClient,
          getEntityDocumentId(userData),
        );
        const teams = Array.isArray(context?.squads) ? context.squads : [];
        const defaultSquad = context?.defaultSquadId
          ? teams.find((team) => getEntityDocumentId(team) === context.defaultSquadId)
          : null;
        const resolvedSquad = defaultSquad || teams[0] || null;
        if (resolvedSquad) {
          setDivision(clampLeagueDivision(resolvedSquad.division));
        }
      } catch (error) {
        console.log(error);
      }
    };
    init();
  }, [queryClient, routeDivision, userData]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await getRanking(division);
      setRanking(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);
      setRanking([]);
      setLoadError('Impossible de charger le classement League pour cette division.');
    } finally {
      setLoading(false);
    }
  }, [division]);

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      const hasWarmRankingState = ranking.length > 0 || Boolean(loadError);
      const lastFocusedLoad = lastRankingFocusLoadRef.current;
      if (
        hasWarmRankingState
        && lastFocusedLoad.division === division
        && now - Number(lastFocusedLoad.loadedAt || 0) < RANKING_FOCUS_REFRESH_MIN_INTERVAL_MS
      ) {
        return undefined;
      }
      lastRankingFocusLoadRef.current = {
        division,
        loadedAt: now,
      };
      loadData();
      return undefined;
    }, [division, loadData, loadError, ranking.length]),
  );

  const changeDivision = (/** @type {number} */ delta) => {
    const nextDivision = division + delta;
    if (nextDivision >= 1 && nextDivision <= 5) {
      setDivision(nextDivision);
    }
  };

  const renderItem = (/** @type {{ item: Team, index: number }} */ { index, item }) => (
    <TouchableOpacity
      style={[
        styles.row,
        {
          backgroundColor: 'transparent',
          borderBottomColor: 'rgba(255,255,255,0.08)',
        },
      ]}
    >
      <View style={styles.rankCol}>
        <Text style={[Fonts.h3, { color: Colors.gold500 }]}>
          {index + 1}
        </Text>
      </View>

      <View style={styles.teamCol}>
        <View style={[styles.crestWrap, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
          {item.crest?.url ? (
            <Image source={{ uri: item.crest.url }} style={styles.crestImage} />
          ) : (
            <TeamShield initials={String(item.name || '??').substring(0, 2)} isGold size={32} />
          )}
        </View>
        <View style={styles.teamTextWrap}>
          <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>{item.name}</Text>
          <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.gold500 }]}>
            {item.wins}
            V -
            {item.draws}
            N -
            {item.losses}
            D
          </Text>
          <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300 }]}>
            Serie
            {' '}
            {formatCurrentStreak(item.streak)}
            {' | Best x'}
            {getHighestStreak(item)}
          </Text>
        </View>
      </View>

      <View style={styles.pointsCol}>
        <Text style={[Fonts.h3, { color: Colors.gold500 }]}>{getLeaguePoints(item)}</Text>
        <Text style={[Fonts.p3, { color: Colors.gold500, opacity: 0.85 }]}>PTS</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading && ranking.length === 0) {
    return (
      <LeagueStateView
        description="Chargement du classement League."
        isLoading
        title="Chargement du classement"
      />
    );
  }

  if (loadError && ranking.length === 0) {
    return (
      <LeagueStateView
        actionLabel="Réessayer"
        description={loadError}
        onAction={() => loadData()}
        title="Classement indisponible"
      />
    );
  }

  return (
    <ScreenContainer bgImage="bg2">
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={{ color: Colors.neutral00, fontSize: 24 }}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={[Fonts.h1, { color: Colors.neutral00 }]}>CLASSEMENT</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.divisionRow}>
          <TouchableOpacity onPress={() => changeDivision(-1)} style={styles.divisionArrow}>
            <Text style={[Fonts.h2, { color: Colors.gold500 }]}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={[Fonts.h2, { color: Colors.neutral00, marginHorizontal: 20 }]}>
            DIVISION
            {' '}
            <Text style={{ color: Colors.gold500 }}>{division}</Text>
          </Text>
          <TouchableOpacity onPress={() => changeDivision(1)} style={styles.divisionArrow}>
            <Text style={[Fonts.h2, { color: Colors.gold500 }]}>{'>'}</Text>
          </TouchableOpacity>
        </View>

        <LeagueCard style={{ overflow: 'hidden', padding: 0, ...leagueSurface }}>
          <View style={[styles.headerRow, { borderBottomColor: 'rgba(255,255,255,0.12)' }]}>
            <Text style={[Fonts.p3Bold, { color: Colors.neutral300, textAlign: 'center', width: 40 }]}>#</Text>
            <Text style={[Fonts.p3Bold, { color: Colors.neutral300, flex: 1 }]}>Équipe</Text>
            <Text style={[Fonts.p3Bold, { color: Colors.neutral300, textAlign: 'center', width: 68 }]}>PTS</Text>
          </View>

          <FlatList
            contentContainerStyle={{ paddingBottom: listBottomPadding }}
            data={ranking}
            keyExtractor={(/** @type {Team} */ item) => String(getEntityDocumentId(item) || '')}
            ListEmptyComponent={(
              <View style={{ alignItems: 'center', paddingVertical: 28 }}>
                <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>
                  Aucune équipe sur cette division.
                </Text>
                <Text style={[Fonts.p3, { color: Colors.neutral300, marginTop: 6 }]}>
                  Change de division ou relance plus tard.
                </Text>
              </View>
            )}
            refreshControl={(
              <RefreshControl
                onRefresh={loadData}
                refreshing={loading}
                tintColor={Colors.primary500}
              />
            )}
            renderItem={renderItem}
          />
        </LeagueCard>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  backButton: {
    padding: 8,
  },
  crestImage: {
    height: '100%',
    width: '100%',
  },
  crestWrap: {
    borderRadius: 16,
    height: 32,
    marginRight: 12,
    overflow: 'hidden',
    width: 32,
  },
  divisionArrow: {
    padding: 10,
  },
  divisionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  headerRow: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    marginBottom: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pointsCol: {
    alignItems: 'center',
    width: 68,
  },
  rankCol: {
    alignItems: 'center',
    marginRight: 8,
    width: 30,
  },
  row: {
    alignItems: 'center',
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  screen: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 60,
  },
  teamCol: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
  },
  teamTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
});

export default RankingScreen;
