import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import useTheme from '@/theme/themeContext';
import ScreenContainer from '@/components/templates/ScreenContainer';
import { getMatchHistory } from '@/services/league/leagueMatchService';
import useAuth from '@/domains/auth/useAuth';
import { getMyLeagueTeam } from '@/services/leagueTeam/leagueTeamService';
import { RouteNames } from '@/navigation/routeNames';
import SectionHeader from '@/components/atoms/SectionHeader/SectionHeader';
import { getEntityDocumentId } from '@/utils/entityId';

const MatchHistoryScreen = () => {
    const { Colors, Fonts } = useTheme();
    const navigation = /** @type {any} */ (useNavigation());
    const { userData } = /** @type {{ userData: User | null }} */ (useAuth());
    
    const [matches, setMatches] = useState(/** @type {MatchHistoryEntry[]} */ ([]));
    const [loading, setLoading] = useState(true);
    const [teamId, setTeamId] = useState(/** @type {string | null} */ (null));

    // Initial Load
    useEffect(() => {
        const init = async () => {
            if (userData) {
                try {
                    const teams = await getMyLeagueTeam(getEntityDocumentId(userData));
                    if (teams && teams.length > 0) {
                        setTeamId(getEntityDocumentId(teams[0]) || null);
                    } else {
                        setLoading(false);
                    }
                } catch (e) { 
                    console.log(e); 
                    setLoading(false);
                }
            }
        };
        init();
    }, [userData]);

    // Load Matches
    const loadMatches = async () => {
        if (!teamId) return;
        setLoading(true);
        try {
            const history = await getMatchHistory(teamId, 50); // Fetch up to 50 matches
            setMatches(Array.isArray(history) ? history : []);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (teamId) {
            loadMatches();
        }
    }, [teamId]);

    const getResultStyle = (/** @type {'win' | 'loss' | 'draw' | 'pending' | undefined} */ result) => {
        switch(result) {
            case 'win': return { bg: 'rgba(76, 175, 80, 0.15)', text: Colors.success500 || '#4caf50', icon: '✅' };
            case 'loss': return { bg: 'rgba(244, 67, 54, 0.15)', text: Colors.error500 || '#f44336', icon: '❌' };
            case 'draw': return { bg: 'rgba(255, 193, 7, 0.15)', text: Colors.warning500 || '#ffc107', icon: '➖' };
            default: return { bg: Colors.neutral800, text: Colors.neutral300, icon: '⏳' };
        }
    };

    const formatDate = (/** @type {string | undefined} */ dateString) => {
        const date = new Date(String(dateString || ''));
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    const renderItem = (/** @type {{ item: MatchHistoryEntry }} */ { item }) => {
        const result = getResultStyle(item.result);
        return (
            <TouchableOpacity 
                style={[styles.row, { backgroundColor: Colors.neutral900, borderColor: Colors.neutral800 }]}
                onPress={() => navigation.navigate(RouteNames.PastMatchDetails, { matchId: item.id, myTeamId: teamId })}
            >
                <View style={[styles.resultBadge, { backgroundColor: result.bg }]}>
                    <Text style={{ fontSize: 16 }}>{result.icon}</Text>
                </View>

                <View style={{ flex: 1, marginLeft: 12 }}>
                     <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>
                        vs {item.opponent?.name || 'Adversaire'}
                    </Text>
                    <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
                        {formatDate(item.date)}
                    </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                     <Text style={[Fonts.h3, { color: result.text }]}>
                        {item.score_a} - {item.score_b}
                    </Text>
                    {item.eloChange && (
                        <Text style={[Fonts.p3Bold, { color: result.text }]}>
                            {item.eloChange > 0 ? '+' : ''}{item.eloChange} ELO
                        </Text>
                    )}
                </View>
                
                <Text style={{ color: Colors.neutral500, fontSize: 20, marginLeft: 12 }}>›</Text>
            </TouchableOpacity>
        );
    };

    return (
        <ScreenContainer bgImage="bg2">
            <View style={{ flex: 1, paddingTop: 60, paddingHorizontal: 16 }}>
                 <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24 }}>
                     <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, marginRight: 8 }}>
                        <Text style={{ color: Colors.neutral00, fontSize: 24 }}>←</Text>
                     </TouchableOpacity>
                     <View>
                        <Text style={[Fonts.h1, { color: Colors.neutral00 }]}>HISTORIQUE</Text>
                        <Text style={[Fonts.p2, { color: Colors.gold500 }]}>SAISON EN COURS</Text>
                     </View>
                </View>

                <FlatList
                    data={matches}
                    renderItem={renderItem}
                    keyExtractor={(/** @type {MatchHistoryEntry} */ item) => String(item.id || '')}
                    refreshControl={
                        <RefreshControl refreshing={loading} onRefresh={loadMatches} tintColor={Colors.primary500} />
                    }
                    contentContainerStyle={{ paddingBottom: 40 }}
                    ListEmptyComponent={
                        loading ? null : (
                            <View style={{ alignItems: 'center', marginTop: 100 }}>
                                <Text style={{ fontSize: 40, marginBottom: 16 }}>📜</Text>
                                <Text style={[Fonts.h3, { color: Colors.neutral300 }]}>Aucun match trouvé</Text>
                            </View>
                        )
                    }
                    ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                />
            </View>
        </ScreenContainer>
    );
};

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
    },
    resultBadge: {
        width: 40, 
        height: 40, 
        borderRadius: 20, 
        alignItems: 'center', 
        justifyContent: 'center'
    }
});

export default MatchHistoryScreen;
