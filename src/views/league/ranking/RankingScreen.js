import React, { useEffect, useState } from 'react';
import {
    FlatList,
    Image,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import LeagueCard from '@/components/atoms/league/LeagueCard';
import ScreenContainer from '@/components/templates/ScreenContainer';
import useAuth from '@/domains/auth/useAuth';
import { getMyLeagueTeam, getRanking } from '@/services/leagueTeam/leagueTeamService';
import useTheme from '@/theme/themeContext';

const RankingScreen = () => {
    const { Colors, Fonts } = useTheme();
    const navigation = useNavigation();
    const { userData } = useAuth();

    const [division, setDivision] = useState(10);
    const [loading, setLoading] = useState(true);
    const [ranking, setRanking] = useState([]);

    const leagueSurface = {
        backgroundColor: 'rgba(10, 28, 43, 0.82)',
        borderColor: 'rgba(1, 179, 244, 0.22)',
    };

    useEffect(() => {
        const init = async () => {
            if (!userData) return;
            try {
                const teams = await getMyLeagueTeam(userData.documentId);
                if (teams && teams.length > 0) {
                    setDivision(teams[0].division || 10);
                }
            } catch (error) {
                console.log(error);
            }
        };
        init();
    }, [userData]);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await getRanking(division);
            setRanking(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error(error);
            setRanking([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [division]);

    const changeDivision = (delta) => {
        const nextDivision = division + delta;
        if (nextDivision >= 1 && nextDivision <= 10) {
            setDivision(nextDivision);
        }
    };

    const renderItem = ({ item, index }) => (
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
                <Text style={[Fonts.h3, { color: index < 3 ? Colors.gold500 : Colors.neutral300 }]}>
                    {index + 1}
                </Text>
            </View>

            <View style={styles.teamCol}>
                <View style={[styles.crestWrap, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                    {item.crest?.url ? (
                        <Image source={{ uri: item.crest.url }} style={styles.crestImage} />
                    ) : (
                        <View style={styles.crestFallback}>
                            <Text style={[Fonts.p3Bold, { color: Colors.neutral400 }]}>
                                {String(item.name || '??').substring(0, 2).toUpperCase()}
                            </Text>
                        </View>
                    )}
                </View>
                <View>
                    <Text style={[Fonts.p2Bold, { color: Colors.neutral00 }]}>{item.name}</Text>
                    <Text style={[Fonts.p3, { color: Colors.neutral300 }]}>
                        {item.wins}V - {item.draws}N - {item.losses}D
                    </Text>
                </View>
            </View>

            <View style={styles.pointsCol}>
                <Text style={[Fonts.h3, { color: Colors.primary500 }]}>{item.elo}</Text>
                <Text style={[Fonts.p3, { color: Colors.primary500, opacity: 0.75 }]}>PTS</Text>
            </View>
        </TouchableOpacity>
    );

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
                        DIVISION {division}
                    </Text>
                    <TouchableOpacity onPress={() => changeDivision(1)} style={styles.divisionArrow}>
                        <Text style={[Fonts.h2, { color: Colors.gold500 }]}>{'>'}</Text>
                    </TouchableOpacity>
                </View>

                <LeagueCard style={{ padding: 0, overflow: 'hidden', ...leagueSurface }}>
                    <View style={[styles.headerRow, { borderBottomColor: 'rgba(255,255,255,0.12)' }]}>
                        <Text style={[Fonts.p3Bold, { color: Colors.neutral300, textAlign: 'center', width: 40 }]}>#</Text>
                        <Text style={[Fonts.p3Bold, { color: Colors.neutral300, flex: 1 }]}>EQUIPE</Text>
                        <Text style={[Fonts.p3Bold, { color: Colors.neutral300, textAlign: 'center', width: 60 }]}>ELO</Text>
                    </View>

                    <FlatList
                        contentContainerStyle={{ paddingBottom: 12 }}
                        data={ranking}
                        keyExtractor={(item) => String(item.id || item.documentId)}
                        ListEmptyComponent={(
                            <View style={{ alignItems: 'center', paddingVertical: 28 }}>
                                <Text style={[Fonts.p2, { color: Colors.neutral200 }]}>
                                    Aucune equipe sur cette division.
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
};

const styles = StyleSheet.create({
    backButton: {
        padding: 8,
    },
    crestFallback: {
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
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
        width: 60,
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
    topBar: {
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
});

export default RankingScreen;
