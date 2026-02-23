import React from 'react';
import {
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';

import useTheme from '@/theme/themeContext';

import LeagueCard from '@/components/atoms/league/LeagueCard';
import SectionHeader from '@/components/atoms/SectionHeader/SectionHeader';

/**
 * Match History Component
 * Displays recent matches with results and ELO changes
 * @param root0
 * @param root0.matches
 * @param root0.onViewAll
 * @param root0.onMatchPress
 */
function MatchHistory({ matches = [], onMatchPress, onViewAll }) {
  const { Colors, Fonts } = useTheme();
  const leagueSurface = {
    backgroundColor: 'rgba(10, 28, 43, 0.82)',
    borderColor: 'rgba(1, 179, 244, 0.22)',
  };

  const getResultStyle = (result) => {
    switch (result) {
      case 'draw': return { bg: 'rgba(255, 193, 7, 0.15)', icon: '➖', text: Colors.warning500 || '#ffc107' };
      case 'loss': return { bg: 'rgba(244, 67, 54, 0.15)', icon: '❌', text: Colors.error500 || '#f44336' };
      case 'win': return { bg: 'rgba(76, 175, 80, 0.15)', icon: '✅', text: Colors.success500 || '#4caf50' };
      default: return { bg: 'rgba(255,255,255,0.05)', icon: '⏳', text: Colors.neutral300 };
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  const getEloChange = (match) => {
    if (!match.eloChange) return null;
    const sign = match.eloChange > 0 ? '+' : '';
    return `${sign}${match.eloChange}`;
  };

  if (!matches || matches.length === 0) {
    return (
      <View style={{ marginBottom: 24 }}>
        <SectionHeader subtitle="HISTORIQUE" title="DERNIERS MATCHS" />
        <LeagueCard style={{ alignItems: 'center', paddingVertical: 32, ...leagueSurface }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🏆</Text>
          <Text style={[Fonts.p2, { color: Colors.neutral300, marginTop: 8, textAlign: 'center' }]}>
            Aucun match joué pour l'instant.
            {'\n'}
            Lance une recherche !
          </Text>
        </LeagueCard>
      </View>
    );
  }

  return (
    <View style={{ marginBottom: 24 }}>
      <SectionHeader subtitle="HISTORIQUE" title="DERNIERS MATCHS" />

      <LeagueCard style={{ overflow: 'hidden', padding: 0, ...leagueSurface }}>
        {matches.slice(0, 5).map((match, index) => {
          const result = getResultStyle(match.result);
          const eloChange = getEloChange(match);

          return (
            <TouchableOpacity
              key={match.id || index}
              onPress={() => onMatchPress?.(match)}
              style={[
                styles.matchRow,
                {
                  backgroundColor: result.bg,
                  borderBottomColor: 'rgba(255,255,255,0.08)',
                  borderBottomWidth: index < Math.min(matches.length, 5) - 1 ? 1 : 0,
                },
              ]}
            >
              {/* Result Icon */}
              <Text style={styles.resultIcon}>{result.icon}</Text>

              {/* Match Info */}
              <View style={styles.matchInfo}>
                <Text numberOfLines={1} style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
                  vs 
{' '}
                  {match.opponent?.name || 'Adversaire'}
                </Text>
                <Text style={[Fonts.p3, { color: Colors.neutral300, marginTop: 2 }]}>
                  {formatDate(match.date)}
                  {' '}
                  •{match.score_a}
                  -{match.score_b}
                </Text>
              </View>

              {/* ELO Change */}
              {eloChange && (
              <View style={[styles.eloBadge, { backgroundColor: result.bg }]}>
                <Text style={[Fonts.p2Bold, { color: result.text }]}>
                        {eloChange}
                      </Text>
              </View>
              )}

              {/* Arrow */}
              <Text style={{ color: Colors.neutral500, fontSize: 18 }}>›</Text>
            </TouchableOpacity>
          );
        })}

        {/* View All Button */}
        {matches.length > 5 && (
        <TouchableOpacity
          onPress={onViewAll}
          style={[styles.viewAllButton, { backgroundColor: 'rgba(255,255,255,0.04)' }]}
        >
          <Text style={[Fonts.p3Bold, { color: Colors.primary500 }]}>
            VOIR TOUT L'HISTORIQUE (
            {matches.length}
            )
          </Text>
        </TouchableOpacity>
        )}
      </LeagueCard>
    </View>
  );
}

const styles = StyleSheet.create({
  eloBadge: {
    borderRadius: 12,
    marginRight: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  matchInfo: {
    flex: 1,
  },
  matchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    padding: 14,
  },
  resultIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  viewAllButton: {
    alignItems: 'center',
    padding: 12,
  },
});

export default MatchHistory;
