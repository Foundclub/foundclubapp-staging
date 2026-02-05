import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Alert, ActivityIndicator, SafeAreaView } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import useTheme from '@/theme/themeContext';
import LeagueCard from '@/components/atoms/league/LeagueCard';
import TeamShield from '@/components/atoms/teamShield/TeamShield';
import Button from '@/components/atoms/button/Button';
import { getImageUrl } from '@/utils/imageUrl';
import { getMatch, requestRematch } from '@/services/league/leagueMatchService';
import useAuth from '@/domains/auth/useAuth';

/**
 * PastMatchDetails Screen
 * Shows full details of a completed match including ELO changes, goals, and proof
 */
const PastMatchDetails = () => {
    const { Colors, Fonts } = useTheme();
    const route = useRoute();
    const navigation = useNavigation();
    const { userData } = useAuth();
    const { matchId, myTeamId } = route.params || {};

    const [match, setMatch] = useState(null);
    const [loading, setLoading] = useState(true);
    const [requestingRematch, setRequestingRematch] = useState(false);

    useEffect(() => {
        loadMatch();
    }, [matchId]);

    const loadMatch = async () => {
        try {
            const data = await getMatch(matchId);
            setMatch(data);
        } catch (error) {
            console.error('Error loading match:', error);
            Alert.alert('Erreur', 'Impossible de charger le match');
        } finally {
            setLoading(false);
        }
    };

    const handleRematch = async () => {
        const opponent = match.team_a?.documentId === myTeamId ? match.team_b : match.team_a;
        
        Alert.alert(
            "Demander une revanche",
            `Voulez-vous demander une revanche contre ${opponent?.name} ?`,
            [
                { text: "Annuler", style: "cancel" },
                {
                    text: "Oui, revanche !",
                    onPress: async () => {
                        setRequestingRematch(true);
                        try {
                            const result = await requestRematch(myTeamId, opponent.documentId, matchId);
                            Alert.alert(
                                result.matched ? "Match créé !" : "Demande envoyée",
                                result.message
                            );
                            if (result.matched) {
                                navigation.goBack();
                            }
                        } catch (error) {
                            Alert.alert('Erreur', 'Impossible de demander une revanche');
                        } finally {
                            setRequestingRematch(false);
                        }
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.safeArea, { backgroundColor: Colors.neutral900 }]}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary500} />
                </View>
            </SafeAreaView>
        );
    }

    if (!match) {
        return (
            <SafeAreaView style={[styles.safeArea, { backgroundColor: Colors.neutral900 }]}>
                <View style={styles.errorContainer}>
                    <Text style={{ color: Colors.neutral500 }}>Match non trouvé</Text>
                </View>
            </SafeAreaView>
        );
    }

    const teamA = match.team_a;
    const teamB = match.team_b;
    const isTeamA = teamA?.documentId === myTeamId;
    const myTeam = isTeamA ? teamA : teamB;
    const opponent = isTeamA ? teamB : teamA;
    const myScore = isTeamA ? match.score_a : match.score_b;
    const oppScore = isTeamA ? match.score_b : match.score_a;
    
    // Determine result
    let result = 'draw';
    let resultColor = '#FFC107';
    let resultText = 'MATCH NUL';
    if (myScore > oppScore) {
        result = 'win';
        resultColor = '#4CAF50';
        resultText = 'VICTOIRE';
    } else if (myScore < oppScore) {
        result = 'loss';
        resultColor = '#F44336';
        resultText = 'DÉFAITE';
    }

    // ELO calculation (estimate based on K=32)
    const myElo = myTeam?.elo || 1200;
    const oppElo = opponent?.elo || 1200;
    const expectedWin = 1 / (1 + Math.pow(10, (oppElo - myElo) / 400));
    const actualScore = result === 'win' ? 1 : result === 'loss' ? 0 : 0.5;
    const eloDelta = Math.round(32 * (actualScore - expectedWin));

    // Check if captain for rematch button
    const isCaptain = myTeam?.captain?.documentId === userData?.documentId;
    const canRematch = isCaptain && match.status === 'valid';

    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor: Colors.neutral900 }]}>
            <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={{ color: Colors.neutral100, fontSize: 16 }}>← Retour</Text>
                </TouchableOpacity>
                
                {/* Result Banner */}
                <View style={[styles.resultBanner, { backgroundColor: resultColor }]}>
                    <Text style={styles.resultText}>{resultText}</Text>
                </View>

                {/* Score Card */}
                <LeagueCard style={styles.scoreCard}>
                    <View style={styles.matchup}>
                        <View style={styles.teamBox}>
                            <TeamShield initials={teamA?.name?.substring(0,2) || 'A'} />
                            <Text style={[styles.teamName, { color: Colors.neutral100 }]} numberOfLines={2}>
                                {teamA?.name}
                            </Text>
                        </View>
                        
                        <View style={styles.scoreBox}>
                            <Text style={styles.score}>{match.score_a ?? '-'}</Text>
                            <Text style={styles.scoreSeparator}>-</Text>
                            <Text style={styles.score}>{match.score_b ?? '-'}</Text>
                        </View>
                        
                        <View style={styles.teamBox}>
                            {opponent?.crest?.url ? (
                                <Image source={{ uri: getImageUrl(opponent.crest.url) }} style={styles.crestImage} />
                            ) : (
                                <TeamShield initials={teamB?.name?.substring(0,2) || 'B'} />
                            )}
                            <Text style={[styles.teamName, { color: Colors.neutral100 }]} numberOfLines={2}>
                                {teamB?.name}
                            </Text>
                        </View>
                    </View>

                    {/* Date & Venue */}
                    <Text style={[styles.matchInfo, { color: Colors.neutral500 }]}>
                        📅 {format(new Date(match.date), 'EEEE d MMMM yyyy à HH:mm', { locale: fr })}
                    </Text>
                    {match.venue && (
                        <Text style={[styles.matchInfo, { color: Colors.neutral500 }]}>
                            📍 {match.venue}
                        </Text>
                    )}
                </LeagueCard>

                {/* ELO Impact */}
                <LeagueCard style={styles.eloCard}>
                    <Text style={[styles.sectionTitle, { color: Colors.neutral100 }]}>📊 Impact ELO</Text>
                    <View style={styles.eloRow}>
                        <View style={styles.eloItem}>
                            <Text style={{ color: Colors.neutral500, fontSize: 12 }}>Avant</Text>
                            <Text style={[styles.eloValue, { color: Colors.neutral100 }]}>{myElo}</Text>
                        </View>
                        <View style={[styles.eloDelta, { backgroundColor: `${resultColor}20` }]}>
                            <Text style={[styles.eloDeltaText, { color: resultColor }]}>
                                {eloDelta > 0 ? '+' : ''}{eloDelta}
                            </Text>
                        </View>
                        <View style={styles.eloItem}>
                            <Text style={{ color: Colors.neutral500, fontSize: 12 }}>Après</Text>
                            <Text style={[styles.eloValue, { color: Colors.neutral100 }]}>{myElo + eloDelta}</Text>
                        </View>
                    </View>
                </LeagueCard>

                {/* Player Goals (if available) */}
                {match.player_goals && Object.keys(match.player_goals).length > 0 && (
                    <LeagueCard style={styles.goalsCard}>
                        <Text style={[styles.sectionTitle, { color: Colors.neutral100 }]}>⚽ Buteurs</Text>
                        {Object.entries(match.player_goals).map(([playerId, goals]) => (
                            <View key={playerId} style={styles.goalRow}>
                                <Text style={{ color: Colors.neutral300, flex: 1 }}>
                                    Joueur {playerId.substring(0, 8)}...
                                </Text>
                                <Text style={{ color: Colors.primary500, fontWeight: 'bold' }}>
                                    {goals} ⚽
                                </Text>
                            </View>
                        ))}
                    </LeagueCard>
                )}

                {/* Rematch Button */}
                {canRematch && (
                    <TouchableOpacity 
                        onPress={handleRematch}
                        disabled={requestingRematch}
                        style={[styles.rematchButton, requestingRematch && { opacity: 0.5 }]}
                    >
                        <Text style={styles.rematchButtonText}>
                            {requestingRematch ? "Envoi..." : "⚔️ Demander une revanche"}
                        </Text>
                    </TouchableOpacity>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    scrollView: {
        flex: 1,
        padding: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    resultBanner: {
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 16,
    },
    resultText: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
        fontFamily: 'Montserrat-Bold',
    },
    scoreCard: {
        padding: 20,
        marginBottom: 16,
    },
    matchup: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    teamBox: {
        flex: 1,
        alignItems: 'center',
    },
    teamName: {
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'center',
        marginTop: 8,
    },
    crestImage: {
        width: 60,
        height: 60,
        resizeMode: 'contain',
    },
    scoreBox: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    score: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#FFF',
        fontFamily: 'Montserrat-Bold',
    },
    scoreSeparator: {
        fontSize: 28,
        color: 'rgba(255,255,255,0.5)',
        marginHorizontal: 8,
    },
    matchInfo: {
        textAlign: 'center',
        fontSize: 12,
        marginTop: 4,
    },
    eloCard: {
        padding: 16,
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    eloRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    eloItem: {
        alignItems: 'center',
    },
    eloValue: {
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 4,
    },
    eloDelta: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 12,
    },
    eloDeltaText: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    goalsCard: {
        padding: 16,
        marginBottom: 16,
    },
    goalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    rematchButton: {
        backgroundColor: '#d4af37',
        marginTop: 8,
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 12,
        alignItems: 'center',
    },
    safeArea: {
        flex: 1,
    },
    backButton: {
        paddingVertical: 12,
        marginBottom: 8,
    },
    rematchButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
        fontFamily: 'Montserrat-Bold',
    },
});

export default PastMatchDetails;
