import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import i18next from 'i18next';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  Image,
  RefreshControl,
  ScrollView,
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
  return i18next.t('rankingScreen.streakDefeat', 'Defaite');
};

/**
 *
 */
function RankingScreen() {
  const { Colors, Fonts } = useTheme();
  const { t } = useTranslation();
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
      setLoadError(t(
        'rankingScreen.loadError',
        'Impossible de charger le classement League pour cette division.',
      ));
    } finally {
      setLoading(false);
    }
  }, [division, t]);

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
            {t('rankingScreen.winsShort', 'V -')}
            {item.draws}
            {t('rankingScreen.drawsShort', 'N -')}
            {item.losses}
            {t('rankingScreen.lossesShort', 'D')}
          </Text>
          <Text numberOfLines={1} style={[Fonts.p3, { color: Colors.neutral300 }]}>
            {t('rankingScreen.streak', 'Serie')}
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
        description={t('rankingScreen.loadingDescription', 'Chargement du classement League.')}
        isLoading
        title={t('rankingScreen.loadingTitle', 'Chargement du classement')}
      />
    );
  }

  if (loadError && ranking.length === 0) {
    return (
      <LeagueStateView
        actionLabel={t('rankingScreen.retry', 'Réessayer')}
        description={loadError}
        onAction={() => loadData()}
        title={t('rankingScreen.unavailable', 'Classement indisponible')}
      />
    );
  }

  // DEFILEMENT-LOT2 (11/11, « 244- A », relevé D03b ligne 5) — le titre, la ligne « DIVISION » et
  // les en-têtes de colonnes restaient figés (~210 px sur iPhone) ; seule la liste défilait,
  // dans sa carte. Règle C (T3-BANDEAU-HAUT : tout défile sauf la flèche) : tout passe dans un
  // seul défilement ; la flèche de retour reste en place, posée au-dessus, et porte son fond
  // (BOUTONS-FLOTTANTS), comme l'essai `useEnteteFlottant` du 03/11. Le bas ne change pas.
  // ponytail: les lignes ne sont plus virtualisées (une division se lit en entier, `getRanking`
  // ramène toutes les pages) ; si une division dépasse quelques centaines d'équipes, revenir à
  // une FlatList dont l'en-tête porte le haut et le dessus de la carte.
  // Témoin : __tests__/RankingScreen.DEFILEMENT-LOT2.test.js.
  return (
    <ScreenContainer bgImage="bg2">
      <View style={styles.screen}>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => navigation.goBack()}
          style={[
            styles.backButton,
            styles.backButtonFloating,
            { backgroundColor: Colors.primary800 },
          ]}
          testID="ranking-retour"
        >
          <Text style={{ color: Colors.neutral00, fontSize: 24 }}>{'<'}</Text>
        </TouchableOpacity>

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: listBottomPadding }]}
          refreshControl={(
            <RefreshControl
              onRefresh={loadData}
              refreshing={loading}
              tintColor={Colors.primary500}
            />
          )}
          style={styles.scroll}
        >
          <View style={styles.topBar}>
            {/* La place de la flèche, posée au-dessus du défilement. */}
            <View style={styles.backButtonSpace} />
            <Text style={[Fonts.h1, { color: Colors.neutral00 }]}>
              {t('rankingScreen.title', 'CLASSEMENT')}
            </Text>
            <View style={styles.backButtonSpace} />
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
              <Text style={[Fonts.p3Bold, { color: Colors.neutral300, flex: 1 }]}>
                {t('rankingScreen.teamColumn', 'Équipe')}
              </Text>
              <Text style={[Fonts.p3Bold, { color: Colors.neutral300, textAlign: 'center', width: 68 }]}>PTS</Text>
            </View>

            {ranking.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 28 }}>
                <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>
                  {t('rankingScreen.emptyTitle', 'Aucune équipe sur cette division.')}
                </Text>
                <Text style={[Fonts.p3, { color: Colors.neutral300, marginTop: 6 }]}>
                  {t('rankingScreen.emptyHint', 'Change de division ou relance plus tard.')}
                </Text>
              </View>
            ) : ranking.map((/** @type {Team} */ item, /** @type {number} */ index) => (
              <View key={String(getEntityDocumentId(item) || index)}>
                {renderItem({ index, item })}
              </View>
            ))}
          </LeagueCard>
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  backButton: {
    padding: 8,
  },
  backButtonFloating: {
    alignItems: 'center',
    borderRadius: 22,
    justifyContent: 'center',
    left: 16,
    minHeight: 44,
    minWidth: 44,
    position: 'absolute',
    top: 60,
    zIndex: 2,
  },
  backButtonSpace: {
    height: 44,
    width: 44,
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
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
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
