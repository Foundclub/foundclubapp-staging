import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import useTheme from '@/theme/themeContext';
import LeagueCard from '@/components/atoms/league/LeagueCard';
import SectionHeader from '@/components/atoms/SectionHeader/SectionHeader';

/**
 * Match History Component
 * Displays recent matches with results and ELO changes
 */
const MatchHistory = ({ matches = [], onViewAll, onMatchPress }) => {
    const { Colors, Fonts } = useTheme();
    const leagueSurface = {
        backgroundColor: 'rgba(10, 28, 43, 0.82)',
        borderColor: 'rgba(1, 179, 244, 0.22)',
    };

    const getResultStyle = (result) => {
        switch(result) {
            case 'win': return { bg: 'rgba(76, 175, 80, 0.15)', text: Colors.success500 || '#4caf50', icon: '✅' };
            case 'loss': return { bg: 'rgba(244, 67, 54, 0.15)', text: Colors.error500 || '#f44336', icon: '❌' };
            case 'draw': return { bg: 'rgba(255, 193, 7, 0.15)', text: Colors.warning500 || '#ffc107', icon: '➖' };
            default: return { bg: 'rgba(255,255,255,0.05)', text: Colors.neutral300, icon: '⏳' };
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
                <SectionHeader title="DERNIERS MATCHS" subtitle="HISTORIQUE" />
                <LeagueCard style={{ alignItems: 'center', paddingVertical: 32, ...leagueSurface }}>
                    <Text style={{ fontSize: 40, marginBottom: 12 }}>🏆</Text>
                    <Text style={[Fonts.p2, { color: Colors.neutral300, marginTop: 8, textAlign: 'center' }]}>
                        Aucun match joué pour l'instant.{'\n'}Lance une recherche !
                    </Text>
                </LeagueCard>
            </View>
        );
    }

    return (
        <View style={{ marginBottom: 24 }}>
            <SectionHeader title="DERNIERS MATCHS" subtitle="HISTORIQUE" />
            
            <LeagueCard style={{ padding: 0, overflow: 'hidden', ...leagueSurface }}>
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
                                    borderBottomWidth: index < Math.min(matches.length, 5) - 1 ? 1 : 0,
                                    borderBottomColor: 'rgba(255,255,255,0.08)'
                                }
                            ]}
                        >
                            {/* Result Icon */}
                            <Text style={styles.resultIcon}>{result.icon}</Text>
                            
                            {/* Match Info */}
                            <View style={styles.matchInfo}>
                                <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]} numberOfLines={1}>
                                    vs {match.opponent?.name || 'Adversaire'}
                                </Text>
                                <Text style={[Fonts.p3, { color: Colors.neutral300, marginTop: 2 }]}>
                                    {formatDate(match.date)} • {match.score_a}-{match.score_b}
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
                            VOIR TOUT L'HISTORIQUE ({matches.length})
                        </Text>
                    </TouchableOpacity>
                )}
            </LeagueCard>
        </View>
    );
};

const styles = StyleSheet.create({
    matchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
    },
    resultIcon: {
        fontSize: 18,
        marginRight: 12,
    },
    matchInfo: {
        flex: 1,
    },
    eloBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginRight: 8,
    },
    viewAllButton: {
        padding: 12,
        alignItems: 'center',
    }
});

export default MatchHistory;


