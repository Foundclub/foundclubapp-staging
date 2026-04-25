import { useNavigation } from '@react-navigation/native';
import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';
import {
  FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import useAuth from '@/domains/auth/useAuth';
import useTheme from '@/theme/themeContext';

import ScreenContainer from '@/components/templates/ScreenContainer';
import LeagueStateView from '@/views/league/components/LeagueStateView';

import { RouteNames } from '@/navigation/routeNames';
import useBottomDockLayout from '@/navigation/useBottomDockLayout';

import { getMatchHistory } from '@/services/league/leagueMatchService';
import { getMyLeagueTeam } from '@/services/leagueTeam/leagueTeamService';

import { getEntityDocumentId } from '@/utils/entityId';

/**
 *
 */
function MatchHistoryScreen() {
  const { Colors, Fonts } = useTheme();
  const navigation = /** @type {any} */ (useNavigation());
  const { sceneBottomInset } = useBottomDockLayout();
  const { userData } = /** @type {{ userData: User | null }} */ (useAuth());
  const listBottomPadding = Math.max(sceneBottomInset, 40);

  const [matches, setMatches] = useState(/** @type {MatchHistoryEntry[]} */ ([]));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [teamId, setTeamId] = useState(/** @type {string | null} */ (null));

  const resolveLeagueTeam = useCallback(async () => {
    if (!userData) return;

    setLoading(true);
    setLoadError('');
    try {
      const teams = await getMyLeagueTeam(getEntityDocumentId(userData));
      if (teams && teams.length > 0) {
        setTeamId(getEntityDocumentId(teams[0]) || null);
      } else {
        setTeamId(null);
        setLoading(false);
      }
    } catch (error) {
      console.log(error);
      setTeamId(null);
      setLoadError(error?.message || "Impossible de charger votre squad League.");
      setLoading(false);
    }
  }, [userData]);

  // Initial Load
  useEffect(() => {
    void resolveLeagueTeam();
  }, [resolveLeagueTeam]);

  // Load Matches
  const loadMatches = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    setLoadError('');
    try {
      const history = await getMatchHistory(teamId, 50); // Fetch up to 50 matches
      setMatches(Array.isArray(history) ? history : []);
    } catch (error) {
      console.error(error);
      setLoadError(error?.message || "Impossible de charger l'historique des matchs.");
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    if (teamId) {
      void loadMatches();
    }
  }, [loadMatches, teamId]);

  const getResultStyle = (/** @type {'win' | 'loss' | 'draw' | 'pending' | undefined} */ result) => {
    switch (result) {
      case 'draw': return { bg: 'rgba(255, 193, 7, 0.15)', icon: '➖', text: Colors.warning500 || '#ffc107' };
      case 'loss': return { bg: 'rgba(244, 67, 54, 0.15)', icon: '❌', text: Colors.error500 || '#f44336' };
      case 'win': return { bg: 'rgba(76, 175, 80, 0.15)', icon: '✅', text: Colors.success500 || '#4caf50' };
      default: return { bg: Colors.neutral800, icon: '⏳', text: Colors.neutral300 };
    }
  };

  const formatDate = (/** @type {string | undefined} */ dateString) => {
    const date = new Date(String(dateString || ''));
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric', hour: '2-digit', minute: '2-digit', month: 'short',
    });
  };

  const renderItem = (/** @type {{ item: MatchHistoryEntry }} */ { item }) => {
    const result = getResultStyle(item.result);
    return (
      <TouchableOpacity
        onPress={() => navigation.navigate(RouteNames.PastMatchDetails, { matchId: item.id, myTeamId: teamId })}
        style={[styles.row, { backgroundColor: Colors.neutral900, borderColor: Colors.neutral800 }]}
      >
        <View style={[styles.resultBadge, { backgroundColor: result.bg }]}>
          <Text style={{ fontSize: 16 }}>{result.icon}</Text>
        </View>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
            vs
            {' '}
            {item.opponent?.name || 'Adversaire'}
          </Text>
          <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
            {formatDate(item.date)}
          </Text>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[Fonts.h3, { color: Colors.gold500 }]}>
            {item.score_a}
            {' '}
            -
            {item.score_b}
          </Text>
          {item.eloChange && (
          <Text style={[Fonts.p3Bold, { color: Colors.gold500 }]}>
            {item.eloChange > 0 ? '+' : ''}
            {item.eloChange}
            {' '}
            ELO
          </Text>
          )}
        </View>

        <Text style={{ color: Colors.neutral500, fontSize: 20, marginLeft: 12 }}>›</Text>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <LeagueStateView
        description="Nous chargeons l'historique de vos matchs League."
        isLoading
        title="Chargement de l'historique"
      />
    );
  }

  if (loadError) {
    return (
      <LeagueStateView
        actionLabel="Réessayer"
        description={loadError}
        onAction={() => {
          if (teamId) {
            void loadMatches();
            return;
          }

          void resolveLeagueTeam();
        }}
        title="Chargement impossible"
      />
    );
  }

  if (!teamId) {
    return (
      <LeagueStateView
        description="Aucune squad League n'est reliée à ce compte pour afficher un historique."
        title="Historique indisponible"
      />
    );
  }

  return (
    <ScreenContainer bgImage="bg2">
      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 60 }}>
        <View style={{ alignItems: 'center', flexDirection: 'row', marginBottom: 24 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 8, padding: 8 }}>
            <Text style={{ color: Colors.neutral00, fontSize: 24 }}>←</Text>
          </TouchableOpacity>
          <View>
            <Text style={[Fonts.h1, { color: Colors.neutral00 }]}>HISTORIQUE</Text>
            <Text style={[Fonts.p2, { color: Colors.gold500 }]}>SAISON EN COURS</Text>
          </View>
        </View>

        <FlatList
          contentContainerStyle={{ paddingBottom: listBottomPadding }}
          data={matches}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          keyExtractor={(/** @type {MatchHistoryEntry} */ item) => String(item.id || '')}
          ListEmptyComponent={
                        loading ? null : (
                          <View style={{ alignItems: 'center', marginTop: 100 }}>
                            <Text style={{ fontSize: 40, marginBottom: 16 }}>📜</Text>
                            <Text style={[Fonts.h3, { color: Colors.neutral300 }]}>Aucun match trouvé</Text>
                          </View>
                        )
                    }
          refreshControl={
            <RefreshControl onRefresh={loadMatches} refreshing={loading} tintColor={Colors.primary500} />
                    }
          renderItem={renderItem}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  resultBadge: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  row: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 16,
  },
});

export default MatchHistoryScreen;
