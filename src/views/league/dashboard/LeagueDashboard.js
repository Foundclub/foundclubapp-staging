import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Image } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import useTheme from '@/theme/themeContext';
import useAuth from '@/domains/auth/useAuth';
import { getMyLeagueTeam } from '@/services/leagueTeam/leagueTeamService';
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
    const [loading, setLoading] = useState(true);

    const loadDashboard = async () => {
        if (!userData) return;
        setLoading(true);
        try {
            const squads = await getMyLeagueTeam(userData.documentId);
            const team = squads && squads.length > 0 ? squads[0] : null;
            setUserTeam(team);
            
            // Load match history if team exists
            if (team) {
                try {
                    const history = await getMatchHistory(team.documentId || team.id, 5);
                    setMatchHistory(history);
                } catch (historyErr) {
                    console.log("Match history not available:", historyErr);
                    setMatchHistory([]);
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
                    title="CRÉER UNE ÉQUIPE" 
                    variant="Primary" 
                    onPress={() => navigation.navigate('SquadName')}
                    style={{ width: '100%' }}
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

    // Mock "Top of League" + User logic
    const renderLeaderboard = () => {
        const topTeams = [
            { rank: 1, name: 'Galacticos', points: 2100, form: '✅✅✅' },
            { rank: 2, name: 'Red Star', points: 2050, form: '✅✅➖' },
            { rank: 3, name: 'Olympique', points: 1980, form: '✅❌✅' },
        ];

        const userRank = 42; 
        const isUserInTop = userRank <= 3;

        let displayTeams = [...topTeams];
        if (!isUserInTop && userTeam) {
            displayTeams.push({ type: 'separator' });
            displayTeams.push({ 
                rank: userRank, 
                name: userTeam.name || 'Mon Équipe', 
                points: userTeam.elo || 1200, 
                form: '✅✅❓', 
                isMe: true 
            });
        }

        return (
            <View>
                <SectionHeader 
                    title="LEADERBOARD" 
                    subtitle="TOP ÉQUIPES"
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
                    
                    <TouchableOpacity style={{ padding: 12, alignItems: 'center', backgroundColor: Colors.neutral800 }}>
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
                            rank={42}
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

