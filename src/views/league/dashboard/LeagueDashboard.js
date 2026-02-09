import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Image } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import useTheme from '@/theme/themeContext';
import useAuth from '@/domains/auth/useAuth';
import { getMyLeagueTeam, getRanking } from '@/services/leagueTeam/leagueTeamService';
import { getMatchHistory } from '@/services/league/leagueMatchService';

import ScreenContainer from '@/components/templates/ScreenContainer';
import SectionHeader from '@/components/atoms/SectionHeader/SectionHeader';
import LeagueCard from '@/components/atoms/league/LeagueCard';
import Button from '@/components/atoms/button/Button';
import CompetitiveHero from '@/components/organisms/league/CompetitiveHero';
import MatchHistory from '@/components/organisms/league/MatchHistory';

import NotificationBadge from '@/components/molecules/notificationBadge/NotificationBadge';
import ProfileButton from '@/components/molecules/profileButton/ProfileButton';
import LeagueHeaderSwitch from '@/components/molecules/header/LeagueHeaderSwitch';
import { RouteNames } from '@/navigation/routeNames';

const LeagueDashboard = () => {
    const { Colors, Fonts, Images, Spaces, ApplicationStyle, Alignments } = useTheme();
    const { userData } = useAuth();
    const navigation = useNavigation();

    const [userTeam, setUserTeam] = useState(null);
    const [matchHistory, setMatchHistory] = useState([]);
    const [rankingData, setRankingData] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadDashboard = async () => {
        if (!userData) return;
        setLoading(true);
        try {
            // 1. Get User Team
            const squads = await getMyLeagueTeam(userData.documentId);
            const team = squads && squads.length > 0 ? squads[0] : null;
            setUserTeam(team);
            
            // 2. Load match history & Rankings if team exists
            if (team) {
                try {
                    const history = await getMatchHistory(team.documentId || team.id, 5);
                    setMatchHistory(history);

                    // Fetch Ranking for current division
                    const division = team.division || 10;
                    const rankings = await getRanking(division);
                    setRankingData(rankings);

                } catch (historyErr) {
                    console.log("Data fetch error:", historyErr);
                    setMatchHistory([]);
                    setRankingData([]);
                }
            }
        } catch (error) {
            console.error("Dashboard Load Error:", error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadDashboard();
        }, [userData])
    );

    const handleMatchPress = (match) => {
        navigation.navigate(RouteNames.LeagueMatchDetails, { matchId: match.id });
    };

    // --- Components ---

    const renderHeader = () => (
        <View style={[Alignments.row, Alignments.alignStart, Alignments.justifySpaceBetween, Spaces.marginBottom[24]]}>
            <LeagueHeaderSwitch />
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 4 }}>
                <NotificationBadge />
                <ProfileButton />
            </View>
        </View>
    );

    const renderNoTeamState = () => (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60 }}>
            <LeagueCard style={{ width: '100%', alignItems: 'center', paddingVertical: 40 }}>
                <Text style={[Fonts.h2, { color: Colors.neutral00, marginBottom: 8 }]}>PRÊT À L'ACTION ?</Text>
                <Text style={[Fonts.p2, { color: Colors.neutral300, textAlign: 'center', marginBottom: 24 }]}>
                    Crée ton équipe pour rejoindre la compétition officielle.
                </Text>
                <Button 
                    title="CRÉER UNE SQUAD" 
                    variant="Primary" 
                    icon="plus"
                    iconColor={Colors.primary500}
                    onPress={() => navigation.navigate(RouteNames.TeamStack, { screen: RouteNames.CreateSquad })}
                    style={{ 
                        width: '100%',
                        backgroundColor: Colors.gold500,
                        borderRadius: 30,
                        shadowColor: Colors.gold500,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 5,
                        elevation: 5
                    }}
                    textStyle={{ color: Colors.neutral900 }}
                />
            </LeagueCard>
        </View>
    );

    const renderStats = () => (
        <LeagueCard>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={[Fonts.h2Bold, { color: Colors.neutral00 }]}>{userTeam?.wins || 0}</Text>
                    <Text style={[Fonts.p3, { color: Colors.neutral300, marginTop: 4 }]}>VICTOIRES</Text>
                </View>
                <View style={{ width: 1, backgroundColor: Colors.neutral800 }} />
                <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={[Fonts.h2Bold, { color: Colors.neutral00 }]}>{userTeam?.streak || 0}</Text>
                    <Text style={[Fonts.p3, { color: Colors.neutral300, marginTop: 4 }]}>SÉRIE</Text>
                </View>
                <View style={{ width: 1, backgroundColor: Colors.neutral800 }} />
                <View style={{ alignItems: 'center', flex: 1 }}>
                    <Text style={[Fonts.h2Bold, { color: Colors.neutral00 }]}>{userTeam?.losses || 0}</Text>
                    <Text style={[Fonts.p3, { color: Colors.neutral300, marginTop: 4 }]}>DÉFAITES</Text>
                </View>
            </View>
        </LeagueCard>
    );

    // Real "Top of League" + User logic
    const renderLeaderboard = () => {
        if (!rankingData || rankingData.length === 0) return null;

        // 1. Get Top 3
        const topTeams = rankingData.slice(0, 3).map((t, i) => ({
            rank: i + 1,
            name: t.name,
            points: t.elo,
            form: '✅✅❓', // TODO: Compute form
            isMe: t.documentId === userTeam?.documentId
        }));

        // 2. Add User if not in Top 3
        const userIndex = rankingData.findIndex(t => t.documentId === userTeam?.documentId);
        const isUserInTop = userIndex >= 0 && userIndex < 3;

        let displayTeams = [...topTeams];
        
        if (userTeam && !isUserInTop && userIndex !== -1) {
            displayTeams.push({ type: 'separator' });
            displayTeams.push({ 
                rank: userIndex + 1, 
                name: userTeam.name, 
                points: userTeam.elo, 
                form: '✅✅❓', 
                isMe: true 
            });
        }

        return (
            <View>
                <SectionHeader 
                    title="LEADERBOARD" 
                    subtitle={`DIVISION ${userTeam?.division || 10}`}
                />
                
                <LeagueCard style={{ padding: 0, overflow: 'hidden' }}>
                    {displayTeams.map((team, index) => {
                        if (team.type === 'separator') {
                            return (
                                <View key="sep" style={{ paddingVertical: 8, alignItems: 'center', backgroundColor: Colors.neutral900 }}>
                                    <View style={{ height: 4, width: 4, borderRadius: 2, backgroundColor: Colors.neutral500, marginVertical: 2 }} />
                                    <View style={{ height: 4, width: 4, borderRadius: 2, backgroundColor: Colors.neutral500, marginVertical: 2 }} />
                                    <View style={{ height: 4, width: 4, borderRadius: 2, backgroundColor: Colors.neutral500, marginVertical: 2 }} />
                                </View>
                            );
                        }

                        return (
                            <View 
                                key={index} 
                                style={{ 
                                    flexDirection: 'row', 
                                    padding: 16, 
                                    alignItems: 'center',
                                    backgroundColor: team.isMe ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
                                    borderBottomWidth: (index < displayTeams.length - 1 && displayTeams[index + 1].type !== 'separator') ? 1 : 0,
                                    borderColor: Colors.neutral800
                                }}
                            >
                                <Text style={[Fonts.h4, { width: 35, color: team.rank <= 3 ? Colors.gold500 : Colors.neutral300 }]}>
                                    #{team.rank}
                                </Text>
                                <View style={{ flex: 1, marginLeft: 8 }}>
                                    <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>{team.name}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={[Fonts.p1Bold, { color: Colors.neutral00 }]}>{team.points} pts</Text>
                                    <Text style={{ fontSize: 10, marginTop: 2, color: Colors.neutral300 }}>{team.form}</Text>
                                </View>
                            </View>
                        );
                    })}
                    
                    <TouchableOpacity 
                        style={{ padding: 12, alignItems: 'center', backgroundColor: Colors.neutral800 }}
                        onPress={() => navigation.navigate(RouteNames.LeagueRanking)}
                    >
                        <Text style={[Fonts.p3Bold, { color: Colors.neutral300 }]}>VOIR LE CLASSEMENT COMPLET</Text>
                    </TouchableOpacity>
                </LeagueCard>
            </View>
        );
    };

    return (
        <ScreenContainer bgImage="bg2">
             <ScrollView 
                contentContainerStyle={{ paddingVertical: 24, paddingBottom: 100 }}
                refreshControl={
                    <RefreshControl refreshing={loading} onRefresh={loadDashboard} tintColor={Colors.gold500} colors={[Colors.gold500]} />
                }
            >
                {renderHeader()}

                {!userTeam ? (
                    renderNoTeamState()
                ) : (
                    <>
                        <CompetitiveHero 
                            elo={userTeam.elo} 
                            division={userTeam.division} 
                            rank={rankingData.findIndex(t => t.documentId === userTeam?.documentId) + 1 || '-'}
                            teamName={userTeam.name}
                            nextDivisionElo={1300}
                        />

                        {/* CTA Matchmaking */}
                        <View style={{ marginVertical: 24 }}>
                             <Button 
                                title="TROUVER UN MATCH" 
                                variant="Primary"
                                onPress={() => navigation.navigate(RouteNames.LeagueMatchTab)}
                                style={{ 
                                    backgroundColor: Colors.gold500, 
                                    height: 56,
                                    shadowColor: Colors.gold500, 
                                    shadowOpacity: 0.3, 
                                    shadowRadius: 10, 
                                    elevation: 5 
                                }}
                                textStyle={{ ...Fonts.h4Bold, color: Colors.neutral900, lineHeight: undefined, letterSpacing: 1 }}
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
};

export default LeagueDashboard;

